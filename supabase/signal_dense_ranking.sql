-- Consecutive ranks for tied scores, shared by the table and personal placement.
begin;
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
    select *,dense_rank() over(order by case when p_period='day' then moves else -points end)::integer as position from totals
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
commit;
