-- Fix partial apply of 015: drop the unsecured view, ensure RPC exists.

drop view if exists public.league_pick_submissions;

create or replace function public.get_league_pick_submissions(p_league_id uuid)
returns table (
  user_id uuid,
  week_number integer,
  status text
)
language plpgsql
stable
security definer
set search_path = public
set row_security = off
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
    p.user_id,
    p.week_number,
    case when p.is_missed then 'missed' else 'submitted' end as status
  from public.picks p
  where p.league_id = p_league_id
    and p.superseded_by_pick_id is null;
end;
$$;

grant execute on function public.get_league_pick_submissions(uuid) to authenticated;
