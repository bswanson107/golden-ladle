-- Admin tool: app admin can remove league members via RPC.
-- Admin identity is matched by auth email local-part (before @).

create or replace function public.is_app_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = p_user_id
      and split_part(lower(u.email), '@', 1) = 'bswanson107'
  );
$$;

create or replace function public.admin_kick_league_member(
  p_league_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_app_admin() then
    raise exception 'Not authorized';
  end if;

  if not public.is_league_member(p_league_id) then
    raise exception 'Caller is not a member of this league';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'Cannot remove yourself';
  end if;

  if exists (
    select 1
    from public.leagues l
    where l.id = p_league_id
      and l.commissioner_id = p_user_id
  ) then
    raise exception 'Cannot remove the league commissioner';
  end if;

  if not exists (
    select 1
    from public.league_members lm
    where lm.league_id = p_league_id
      and lm.user_id = p_user_id
  ) then
    raise exception 'User is not a member of this league';
  end if;

  -- Break self-references between superseded picks before delete.
  update public.picks
  set superseded_by_pick_id = null
  where league_id = p_league_id
    and user_id = p_user_id;

  delete from public.commissioner_actions ca
  where ca.target_pick_id in (
    select p.id
    from public.picks p
    where p.league_id = p_league_id
      and p.user_id = p_user_id
  );

  delete from public.picks
  where league_id = p_league_id
    and user_id = p_user_id;

  delete from public.league_members
  where league_id = p_league_id
    and user_id = p_user_id;
end;
$$;

grant execute on function public.is_app_admin(uuid) to authenticated;
grant execute on function public.admin_kick_league_member(uuid, uuid) to authenticated;
