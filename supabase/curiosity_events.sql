-- Additive migration. Run once in the existing project's SQL editor.
-- No visitor IDs, locations, questions, answers, or timestamps finer than a day.
create table if not exists public.curiosity_daily_events (
  day date not null,
  event text not null check (event in (
    'activity_start', 'activity_complete', 'challenge_start', 'challenge_complete',
    'verdict_held_up', 'verdict_stumped', 'verdict_unsure', 'share_intent'
  )),
  count bigint not null default 0 check (count >= 0),
  primary key (day, event)
);
alter table public.curiosity_daily_events enable row level security;
revoke all on public.curiosity_daily_events from anon, authenticated;

create or replace function public.increment_curiosity_event(event_name text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if event_name not in ('activity_start', 'activity_complete', 'challenge_start',
    'challenge_complete', 'verdict_held_up', 'verdict_stumped', 'verdict_unsure', 'share_intent') then
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
