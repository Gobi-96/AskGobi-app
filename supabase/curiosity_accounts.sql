-- Additive; apply after signal.sql in the same project as authentication.
begin;
create table if not exists public.curiosity_saved (
 user_id uuid not null references auth.users(id) on delete cascade,
 card_id text not null check(length(card_id) between 1 and 80),
 saved_at timestamptz not null default now(), primary key(user_id,card_id)
);
create table if not exists public.curiosity_results (
 user_id uuid not null references auth.users(id) on delete cascade,
 puzzle_id text not null check(length(puzzle_id) between 1 and 80), day date,
 moves integer not null check(moves between 1 and 256),
 points integer not null check(points between 1 and 100),
 saved_at timestamptz not null default now(), primary key(user_id,puzzle_id)
);
create table if not exists public.curiosity_players (
 user_id uuid primary key references auth.users(id) on delete cascade,
 guest_hash text not null unique check(guest_hash ~ '^[a-f0-9]{64}$')
);
create table if not exists public.curiosity_claims (
 guest_hash text primary key, user_id uuid not null references auth.users(id) on delete cascade
);
alter table public.curiosity_saved enable row level security;
alter table public.curiosity_results enable row level security;
alter table public.curiosity_players enable row level security;
alter table public.curiosity_claims enable row level security;
revoke all on public.curiosity_saved, public.curiosity_results, public.curiosity_players, public.curiosity_claims from public,anon,authenticated;

create or replace function public.curiosity_player(p_user uuid,p_create boolean default false)
returns text language plpgsql security definer set search_path='' as $$
declare result text;
begin
 if p_create then
  insert into public.curiosity_players(user_id,guest_hash)
  values(p_user,replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','')) on conflict(user_id) do nothing;
 end if;
 select guest_hash into result from public.curiosity_players where user_id=p_user;
 return result;
end $$;

create or replace function public.curiosity_progress(p_user uuid)
returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object(
 'discoveries',coalesce((select jsonb_agg(r order by r.saved_at desc) from (select card_id,saved_at from public.curiosity_saved where user_id=p_user) r),'[]'::jsonb),
 'results',coalesce((select jsonb_agg(r order by r.saved_at desc) from (select puzzle_id,day,moves,points,saved_at from public.curiosity_results where user_id=p_user order by saved_at desc limit 100) r),'[]'::jsonb));
$$;

create or replace function public.curiosity_save(p_user uuid,p_card text default null,p_puzzle text default null,p_day date default null,p_moves integer default null,p_points integer default null)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_card is not null then
  insert into public.curiosity_saved(user_id,card_id) values(p_user,p_card) on conflict do nothing;
 elsif p_puzzle is not null then
  insert into public.curiosity_results(user_id,puzzle_id,day,moves,points) values(p_user,p_puzzle,p_day,p_moves,p_points)
  on conflict(user_id,puzzle_id) do update set moves=excluded.moves,points=excluded.points,saved_at=now() where excluded.moves<curiosity_results.moves;
 else raise exception 'invalid_progress'; end if;
 return jsonb_build_object('saved',true);
end $$;

create or replace function public.curiosity_claim(p_user uuid,p_guest text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target text; owner uuid; alias_value text;
begin
 -- Account lock then guest lock: concurrent devices converge on one player.
 perform pg_advisory_xact_lock(hashtextextended('account:'||p_user::text,0));
 perform pg_advisory_xact_lock(hashtextextended('guest:'||p_guest,0));
 select user_id into owner from public.curiosity_claims where guest_hash=p_guest;
 if owner is not null and owner<>p_user then raise exception 'guest_already_claimed'; end if;
 if not exists(select 1 from public.signal_guests where guest_hash=p_guest) then return jsonb_build_object('claimed',owner=p_user); end if;
 target:=public.curiosity_player(p_user,true);
 perform pg_advisory_xact_lock(hashtextextended('guest:'||target,0));
 select alias into alias_value from public.signal_guests where guest_hash=p_guest for update;
 -- Preserve the first account alias; move a guest alias without violating uniqueness.
 if not exists(select 1 from public.signal_guests where guest_hash=target) then
  update public.signal_guests set alias='QA-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)) where guest_hash=p_guest;
  insert into public.signal_guests(guest_hash,alias) values(target,alias_value);
 end if;
 insert into public.curiosity_results(user_id,puzzle_id,day,moves,points)
 select p_user,'d1-'||day::text,day,moves,points from public.signal_scores where guest_hash=p_guest
 on conflict(user_id,puzzle_id) do update set moves=excluded.moves,points=excluded.points where excluded.moves<curiosity_results.moves;
 insert into public.signal_scores(guest_hash,day,moves,points)
 select target,day,moves,points from public.signal_scores where guest_hash=p_guest
 on conflict(guest_hash,day) do update set moves=excluded.moves,points=excluded.points where excluded.moves<signal_scores.moves;
 -- Old bearer tickets stay consumed; canonical identity is never sent to the browser.
 update public.signal_receipts set guest_hash=null,result='{}'::jsonb where guest_hash=p_guest;
 delete from public.signal_guests where guest_hash=p_guest;
 insert into public.curiosity_claims values(p_guest,p_user) on conflict do nothing;
 return jsonb_build_object('claimed',true);
end $$;
revoke all on function public.curiosity_player(uuid,boolean), public.curiosity_progress(uuid), public.curiosity_save(uuid,text,text,date,integer,integer), public.curiosity_claim(uuid,text) from public,anon,authenticated;
grant execute on function public.curiosity_player(uuid,boolean), public.curiosity_progress(uuid), public.curiosity_save(uuid,text,text,date,integer,integer), public.curiosity_claim(uuid,text) to service_role;
create or replace function public.signal_publish(p_nonce text, p_guest_hash text, p_initials text,
  p_day date, p_moves integer, p_points integer, p_proof text, p_expires timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare previous public.signal_receipts%rowtype; minimum integer; computed integer;
  result jsonb; public_alias text; best public.signal_scores%rowtype;
begin
  if p_initials is null or p_initials !~ '^[A-Z]{1,5}$' or p_initials in ('ASS','KKK','FUK','FCK','WTF','SEX') or
     p_moves is null or p_moves not between 1 and 256 or p_expires is null or p_expires <= now() or p_expires > now()+interval '2 hours 1 minute' then
    raise exception 'invalid_submission';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('guest:'||p_guest_hash,0));
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


create or replace function public.signal_remove_guest(p_guest_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('guest:'||p_guest_hash,0));
  -- Keep a used receipt until expiry so deletion cannot reclaim its ticket.
  -- Remove its old alias/result, then the FK clears the identity hash.
  update public.signal_receipts set result='{}'::jsonb where guest_hash=p_guest_hash;
  delete from public.signal_guests where guest_hash=p_guest_hash;
  return jsonb_build_object('removed',true);
end;
$$;


commit;
