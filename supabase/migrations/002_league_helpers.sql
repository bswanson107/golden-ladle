-- League helpers: auto-add commissioner on create, join by invite code
-- Paste into Supabase SQL Editor if not using migration runner.

-- Commissioner becomes a member automatically (required for RLS SELECT on leagues)
create or replace function public.add_commissioner_as_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.league_members (league_id, user_id)
  values (NEW.id, NEW.commissioner_id)
  on conflict (league_id, user_id) do nothing;
  return NEW;
end;
$$;

drop trigger if exists leagues_add_commissioner_member on public.leagues;
create trigger leagues_add_commissioner_member
  after insert on public.leagues
  for each row
  execute function public.add_commissioner_as_member();

-- Join a league via invite code (authenticated user)
create or replace function public.join_league_by_invite(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_league_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select l.id into v_league_id
  from public.leagues l
  where l.invite_code = lower(trim(p_invite_code))
    and l.is_active = true;

  if v_league_id is null then
    raise exception 'Invalid invite code';
  end if;

  insert into public.league_members (league_id, user_id)
  values (v_league_id, auth.uid())
  on conflict (league_id, user_id) do nothing;

  return v_league_id;
end;
$$;

grant execute on function public.join_league_by_invite(text) to authenticated;
