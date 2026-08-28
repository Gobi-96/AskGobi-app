-- Additive. Apply in staging after the existing curiosity migrations.
-- None of these tables contains chat data, raw cookie tokens, email or IP addresses.
begin;
create table if not exists public.signal_boards (
  day date primary key,
  board jsonb not null,
  check ((board->>'version')::int = 1),
  check ((board->>'minimum')::int between 6 and 10)
);
create table if not exists public.signal_guests (
  guest_hash text primary key check (guest_hash ~ '^[a-f0-9]{64}$'),
  alias text not null unique check (alias ~ '^[A-Z]{2,3}-[0-9A-F]{8}$')
);
create table if not exists public.signal_scores (
  guest_hash text not null references public.signal_guests on delete cascade,
  day date not null references public.signal_boards,
  moves integer not null check (moves between 1 and 256),
  points integer not null check (points between 1 and 100),
  primary key (guest_hash, day)
);
create index if not exists signal_scores_day on public.signal_scores(day, moves);
create table if not exists public.signal_receipts (
  nonce text primary key check (nonce ~ '^[a-f0-9]{48}$'),
  guest_hash text references public.signal_guests on delete set null,
  proof text not null check (proof ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  result jsonb not null
);
create index if not exists signal_receipts_expiry on public.signal_receipts(expires_at);
alter table public.signal_boards enable row level security;
alter table public.signal_guests enable row level security;
alter table public.signal_scores enable row level security;
alter table public.signal_receipts enable row level security;
revoke all on public.signal_boards, public.signal_guests, public.signal_scores, public.signal_receipts from public, anon, authenticated;

create or replace function public.signal_freeze_board(p_day date, p_board jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if p_day is null or p_board is null or p_day > (now() at time zone 'UTC')::date or
     p_board->>'id' is distinct from ('d1-' || p_day::text) or p_board->>'day' is distinct from p_day::text then
    raise exception 'invalid_board';
  end if;
  insert into public.signal_boards(day,board) values(p_day,p_board) on conflict(day) do nothing;
  select board into result from public.signal_boards where day=p_day;
  return result;
end;
$$;

create or replace function public.signal_publish(p_nonce text, p_guest_hash text, p_initials text,
  p_day date, p_moves integer, p_points integer, p_proof text, p_expires timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare previous public.signal_receipts%rowtype; minimum integer; computed integer;
  result jsonb; public_alias text; best public.signal_scores%rowtype;
begin
  if p_initials is null or p_initials !~ '^[A-Z]{2,3}$' or p_initials in ('ASS','KKK','FUK','FCK','WTF','SEX') or
     p_moves is null or p_moves not between 1 and 256 or p_expires is null or p_expires <= now() or p_expires > now()+interval '2 hours 1 minute' then
    raise exception 'invalid_submission';
  end if;
  -- Lock only this receipt; separate retries serialize without blocking other attempts.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_nonce,0));
  select * into previous from public.signal_receipts where nonce=p_nonce;
  if found then
    if previous.guest_hash is distinct from p_guest_hash or previous.proof <> p_proof then
      raise exception 'attempt_already_claimed';
    end if;
    return previous.result;
  end if;
  select (board->>'minimum')::integer into minimum from public.signal_boards where day=p_day;
  if minimum is null or p_moves < minimum then raise exception 'invalid_score'; end if;
  computed := floor(100.0 * minimum / p_moves)::integer;
  if computed is distinct from p_points then raise exception 'invalid_points'; end if;
  insert into public.signal_guests(guest_hash,alias)
    values(p_guest_hash,p_initials || '-' || upper(substr(replace(pg_catalog.gen_random_uuid()::text,'-',''),1,8)))
    on conflict(guest_hash) do nothing;
  select alias into public_alias from public.signal_guests where guest_hash=p_guest_hash;
  insert into public.signal_scores(guest_hash,day,moves,points) values(p_guest_hash,p_day,p_moves,computed)
    on conflict(guest_hash,day) do update set moves=excluded.moves,points=excluded.points
    where excluded.moves < public.signal_scores.moves;
  select * into best from public.signal_scores where guest_hash=p_guest_hash and day=p_day;
  result := jsonb_build_object('alias',public_alias,'day',p_day,'moves',best.moves,'points',best.points);
  insert into public.signal_receipts(nonce,guest_hash,proof,expires_at,result) values(p_nonce,p_guest_hash,p_proof,p_expires,result);
  -- Expired tickets cannot be replayed. Opportunistic cleanup needs no new cron service.
  delete from public.signal_receipts where expires_at < now()-interval '24 hours';
  return result;
end;
$$;

create or replace function public.signal_rankings(p_period text, p_day date, p_guest_hash text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if p_period not in ('day','week','all') or p_period is null then raise exception 'invalid_period'; end if;
  with totals as (
    select g.guest_hash,g.alias,sum(s.points)::integer as points,
      case when p_period='day' then min(s.moves) else null end as moves
    from public.signal_scores s join public.signal_guests g using(guest_hash)
    where s.day <= p_day and (p_period='all' or
      (p_period='day' and s.day=p_day) or
      (p_period='week' and s.day >= p_day - ((extract(isodow from p_day)::integer)-1)))
    group by g.guest_hash,g.alias
  ), ranked as (
    select *,rank() over(order by case when p_period='day' then moves else -points end)::integer as position from totals
  ), first_entries as (
    select * from ranked order by position,alias limit 25
  )
  select jsonb_build_object(
    'entries',coalesce((select jsonb_agg(jsonb_build_object('alias',alias,'rank',position,'moves',moves,'points',points) order by position,alias) from first_entries),'[]'::jsonb),
    'count',(select count(*) from ranked),
    'mine',(select jsonb_build_object('rank',position) from ranked where guest_hash=p_guest_hash)
  ) into result;
  return result;
end;
$$;

create or replace function public.signal_remove_guest(p_guest_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  -- Keep a used receipt until expiry so deletion cannot reclaim its ticket.
  -- Remove its old alias/result, then the FK clears the identity hash.
  update public.signal_receipts set result='{}'::jsonb where guest_hash=p_guest_hash;
  delete from public.signal_guests where guest_hash=p_guest_hash;
  return jsonb_build_object('removed',true);
end;
$$;

revoke all on function public.signal_freeze_board(date,jsonb) from public,anon,authenticated;
revoke all on function public.signal_publish(text,text,text,date,integer,integer,text,timestamptz) from public,anon,authenticated;
revoke all on function public.signal_rankings(text,date,text) from public,anon,authenticated;
revoke all on function public.signal_remove_guest(text) from public,anon,authenticated;
grant execute on function public.signal_freeze_board(date,jsonb) to service_role;
grant execute on function public.signal_publish(text,text,text,date,integer,integer,text,timestamptz) to service_role;
grant execute on function public.signal_rankings(text,date,text) to service_role;
grant execute on function public.signal_remove_guest(text) to service_role;
commit;
