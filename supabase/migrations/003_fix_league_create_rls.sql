-- Fix league creation RLS issues
-- Run in Supabase SQL Editor after 001 and 002.

-- Commissioners can read leagues they own (INSERT RETURNING + before member row visible)
drop policy if exists "leagues_select_commissioner" on public.leagues;
create policy "leagues_select_commissioner"
  on public.leagues for select
  using (commissioner_id = auth.uid());

-- Users who signed up before the auth trigger may lack a profile row
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

create or replace function public.ensure_profile()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.profiles (id, display_name)
  select
    u.id,
    coalesce(u.raw_user_meta_data ->> 'display_name', split_part(u.email, '@', 1))
  from auth.users u
  where u.id = auth.uid()
  on conflict (id) do nothing;
end;
$$;

create or replace function public.create_league(p_name text, p_season_year integer)
returns public.leagues
language plpgsql
security definer
set search_path = public
as $$
declare
  v_league public.leagues;
  v_name text := trim(p_name);
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if v_name is null or v_name = '' then
    raise exception 'League name is required';
  end if;

  perform public.ensure_profile();

  insert into public.leagues (name, season_year, commissioner_id)
  values (v_name, p_season_year, auth.uid())
  returning * into v_league;

  insert into public.league_members (league_id, user_id)
  values (v_league.id, auth.uid())
  on conflict (league_id, user_id) do nothing;

  return v_league;
end;
$$;

grant execute on function public.ensure_profile() to authenticated;
grant execute on function public.create_league(text, integer) to authenticated;
