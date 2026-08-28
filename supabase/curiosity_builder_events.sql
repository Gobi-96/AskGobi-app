-- Apply AFTER curiosity_events.sql. Extends the existing aggregate allowlist;
-- preserves counts, permissions, and the table's existing row-level security.
begin;

alter table public.curiosity_daily_events
  drop constraint curiosity_daily_events_event_check;
alter table public.curiosity_daily_events
  add constraint curiosity_daily_events_event_check check (event in (
    'activity_start', 'activity_complete', 'challenge_start', 'challenge_complete',
    'verdict_held_up', 'verdict_stumped', 'verdict_unsure', 'share_intent',
    'build_details_open', 'contact_intent'
  ));

create or replace function public.increment_curiosity_event(event_name text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if event_name is null or event_name not in (
    'activity_start', 'activity_complete', 'challenge_start', 'challenge_complete',
    'verdict_held_up', 'verdict_stumped', 'verdict_unsure', 'share_intent',
    'build_details_open', 'contact_intent'
  ) then
    raise exception 'Invalid event';
  end if;
  insert into public.curiosity_daily_events(day, event, count)
    values ((now() at time zone 'UTC')::date, event_name, 1)
    on conflict (day, event) do update
      set count = public.curiosity_daily_events.count + 1;
end;
$$;
revoke all on function public.increment_curiosity_event(text) from public, anon, authenticated;
grant execute on function public.increment_curiosity_event(text) to service_role;

commit;
