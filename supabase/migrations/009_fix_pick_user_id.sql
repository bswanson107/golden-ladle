-- Fix pick insert: default user_id from auth.uid() when omitted by client.

create or replace function public.enforce_pick_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.nfl_games;
  v_league public.leagues;
  v_threshold numeric;
  v_team_win_pct numeric;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if new.user_id is null then
    new.user_id := auth.uid();
  end if;

  if new.user_id is distinct from auth.uid() then
    raise exception 'Cannot submit pick for another user';
  end if;

  select * into v_league from public.leagues where id = new.league_id;
  if not found then
    raise exception 'League not found';
  end if;

  if not public.is_league_member(new.league_id, new.user_id) then
    raise exception 'User is not a member of this league';
  end if;

  select * into v_game from public.nfl_games where id = new.game_id;
  if not found then
    raise exception 'Game not found';
  end if;

  if v_game.season_year <> v_league.season_year then
    raise exception 'Game season does not match league season';
  end if;

  if new.team_id not in (v_game.home_team_id, v_game.away_team_id) then
    raise exception 'Picked team must play in the selected game';
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.superseded_by_pick_id is null then
    if v_game.kickoff_at <= now() then
      raise exception 'Pick deadline passed: game has already kicked off';
    end if;
    if v_game.status = 'postponed' and v_game.kickoff_at > now() then
      null;
    elsif v_game.status not in ('scheduled', 'postponed') then
      raise exception 'Cannot pick for game in status %', v_game.status;
    end if;
  end if;

  v_threshold := v_league.underdog_threshold_pct;

  if new.team_id = v_game.home_team_id then
    v_team_win_pct := v_game.home_win_pct;
  else
    v_team_win_pct := v_game.away_win_pct;
  end if;

  if v_team_win_pct is null then
    v_team_win_pct := 50.0;
  end if;

  new.win_pct_at_pick := v_team_win_pct;
  new.is_underdog_at_pick := public.is_underdog(v_team_win_pct, v_threshold);
  new.season_year := v_game.season_year;
  new.week_number := v_game.week_number;

  select coalesce(str.wins, 0)
  into new.team_season_wins_at_pick
  from public.season_team_records str
  where str.season_year = v_game.season_year
    and str.team_id = new.team_id;

  if new.team_season_wins_at_pick is null then
    new.team_season_wins_at_pick := 0;
  end if;

  if tg_op = 'INSERT' then
    new.points_awarded := 0;
    new.outcome := 'pending';
  end if;

  return new;
end;
$$;
