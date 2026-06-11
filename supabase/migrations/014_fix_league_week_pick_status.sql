-- Fix league_week_pick_status: simpler query matching get_league_standings pattern.

create or replace function public.league_week_pick_status(
  p_league_id uuid,
  p_week_number integer
)
returns table (
  user_id uuid,
  status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.user_id,
    case when p.is_missed then 'missed' else 'submitted' end as status
  from public.picks p
  where p.league_id = p_league_id
    and p.week_number = p_week_number
    and p.superseded_by_pick_id is null
    and public.is_league_member(p_league_id);
$$;

grant execute on function public.league_week_pick_status(uuid, integer) to authenticated;
