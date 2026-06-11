-- Expose whether league members have submitted picks for a week without
-- revealing team/game details before kickoff (RLS still hides pick rows).

create or replace function public.league_week_pick_status(
  p_league_id uuid,
  p_week_number integer
)
returns table (
  user_id uuid,
  status text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_league_member(p_league_id) then
    raise exception 'Not a league member';
  end if;

  return query
  select
    lm.user_id,
    case
      when exists (
        select 1
        from public.picks p
        where p.league_id = p_league_id
          and p.user_id = lm.user_id
          and p.week_number = p_week_number
          and p.superseded_by_pick_id is null
          and p.is_missed
      ) then 'missed'
      when exists (
        select 1
        from public.picks p
        where p.league_id = p_league_id
          and p.user_id = lm.user_id
          and p.week_number = p_week_number
          and p.superseded_by_pick_id is null
      ) then 'submitted'
      else 'none'
    end as status
  from public.league_members lm
  where lm.league_id = p_league_id
    and case
      when exists (
        select 1
        from public.picks p
        where p.league_id = p_league_id
          and p.user_id = lm.user_id
          and p.week_number = p_week_number
          and p.superseded_by_pick_id is null
      ) then true
      else false
    end;
end;
$$;

grant execute on function public.league_week_pick_status(uuid, integer) to authenticated;
