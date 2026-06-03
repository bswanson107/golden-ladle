import { getSupabase } from '$lib/supabase';
import type { LeaguePick, PickOutcome, StandingRow } from '$lib/types/standings';

type StandingsRpcRow = {
	user_id: string;
	display_name: string;
	total_points: number;
	tiebreaker_picked_team_wins: number;
	pending_picks: number;
	standing_rank: number;
};

type PickQueryRow = {
	id: string;
	user_id: string;
	week_number: number;
	team_id: string;
	win_pct_at_pick: number;
	is_underdog_at_pick: boolean;
	outcome: PickOutcome;
	points_awarded: number;
	team_season_wins_at_pick?: number;
	profiles: { display_name: string } | { display_name: string }[] | null;
	nfl_teams: { abbreviation: string; name: string } | { abbreviation: string; name: string }[] | null;
};

function firstRelation<T>(value: T | T[] | null): T | null {
	if (!value) return null;
	return Array.isArray(value) ? (value[0] ?? null) : value;
}

function recordFromPicks(picks: LeaguePick[]): Pick<StandingRow, 'wins' | 'losses' | 'ties'> {
	let wins = 0;
	let losses = 0;
	let ties = 0;

	for (const pick of picks) {
		if (pick.outcome === 'win') wins += 1;
		else if (pick.outcome === 'tie') ties += 1;
		else if (pick.outcome === 'loss' || pick.outcome === 'missed') losses += 1;
	}

	return { wins, losses, ties };
}

function mapPickRow(row: PickQueryRow): LeaguePick | null {
	const profile = firstRelation(row.profiles);
	const team = firstRelation(row.nfl_teams);
	if (!profile || !team) return null;

	return {
		id: row.id,
		user_id: row.user_id,
		display_name: profile.display_name,
		week_number: row.week_number,
		team_id: row.team_id,
		team_abbreviation: team.abbreviation,
		team_name: team.name,
		win_pct_at_pick: row.win_pct_at_pick,
		is_underdog_at_pick: row.is_underdog_at_pick,
		outcome: row.outcome,
		points_awarded: row.points_awarded,
		team_season_wins_at_pick: row.team_season_wins_at_pick ?? 0
	};
}

export async function fetchLeaguePicks(leagueId: string): Promise<{
	picks: LeaguePick[];
	error: string | null;
}> {
	const supabase = getSupabase();

	const { data, error } = await supabase
		.from('picks')
		.select(
			`
			id,
			user_id,
			week_number,
			team_id,
			win_pct_at_pick,
			is_underdog_at_pick,
			outcome,
			points_awarded,
			team_season_wins_at_pick,
			profiles ( display_name ),
			nfl_teams ( abbreviation, name )
		`
		)
		.eq('league_id', leagueId)
		.is('superseded_by_pick_id', null)
		.order('week_number', { ascending: false });

	if (error) {
		return { picks: [], error: error.message };
	}

	const picks = (data ?? [])
		.map((row) => mapPickRow(row as PickQueryRow))
		.filter((pick): pick is LeaguePick => pick !== null);

	return { picks, error: null };
}

export async function fetchLeagueStandings(leagueId: string): Promise<{
	standings: StandingRow[];
	error: string | null;
}> {
	const supabase = getSupabase();

	const [{ data, error }, picksResult] = await Promise.all([
		supabase.rpc('get_league_standings', { p_league_id: leagueId }),
		fetchLeaguePicks(leagueId)
	]);

	if (error) {
		return { standings: [], error: error.message };
	}

	if (picksResult.error) {
		return { standings: [], error: picksResult.error };
	}

	const picksByUser = new Map<string, LeaguePick[]>();
	for (const pick of picksResult.picks) {
		const list = picksByUser.get(pick.user_id) ?? [];
		list.push(pick);
		picksByUser.set(pick.user_id, list);
	}

	const standings = ((data ?? []) as StandingsRpcRow[]).map((row) => {
		const userPicks = picksByUser.get(row.user_id) ?? [];
		return {
			user_id: row.user_id,
			display_name: row.display_name,
			total_points: Number(row.total_points),
			tiebreaker_picked_team_wins: row.tiebreaker_picked_team_wins,
			pending_picks: row.pending_picks,
			standing_rank: Number(row.standing_rank),
			...recordFromPicks(userPicks)
		};
	});

	return { standings: standings.sort((a, b) => a.standing_rank - b.standing_rank), error: null };
}
