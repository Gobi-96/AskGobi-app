-- Run after signal.sql and curiosity_accounts.sql on existing installations.
begin;
alter table public.signal_guests drop constraint if exists signal_guests_alias_check;
alter table public.signal_guests add constraint signal_guests_alias_check check (alias ~ '^[A-Z]{1,5}-[0-9A-F]{8}$');
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
commit;
