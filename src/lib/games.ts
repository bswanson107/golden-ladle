import { getSupabase } from '$lib/supabase';
import type { GameStatus, NflTeam, WeekGame } from '$lib/types/game';

type TeamRow = {
	id: string;
	abbreviation: string;
	name: string;
	city: string | null;
};

type GameQueryRow = {
	id: string;
	week_number: number;
	kickoff_at: string;
	status: GameStatus;
	home_score: number | null;
	away_score: number | null;
	is_tie: boolean;
	winner_team_id: string | null;
	home_win_pct: number | null;
	away_win_pct: number | null;
	home_team: TeamRow | TeamRow[] | null;
	away_team: TeamRow | TeamRow[] | null;
};

function firstRelation<T>(value: T | T[] | null): T | null {
	if (!value) return null;
	return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapTeam(row: TeamRow | null): NflTeam | null {
	if (!row) return null;
	return {
		id: row.id,
		abbreviation: row.abbreviation,
		name: row.name,
		city: row.city
	};
}

function mapGameRow(row: GameQueryRow): WeekGame | null {
	const home = mapTeam(firstRelation(row.home_team));
	const away = mapTeam(firstRelation(row.away_team));
	if (!home || !away) return null;

	return {
		id: row.id,
		week_number: row.week_number,
		kickoff_at: row.kickoff_at,
		status: row.status,
		home_score: row.home_score,
		away_score: row.away_score,
		is_tie: row.is_tie,
		winner_team_id: row.winner_team_id,
		home_win_pct: row.home_win_pct !== null ? Number(row.home_win_pct) : null,
		away_win_pct: row.away_win_pct !== null ? Number(row.away_win_pct) : null,
		home,
		away
	};
}

export async function fetchWeekGames(
	seasonYear: number,
	weekNumber: number
): Promise<{ games: WeekGame[]; error: string | null }> {
	const supabase = getSupabase();

	const { data, error } = await supabase
		.from('nfl_games')
		.select(
			`
			id,
			week_number,
			kickoff_at,
			status,
			home_score,
			away_score,
			is_tie,
			winner_team_id,
			home_win_pct,
			away_win_pct,
			home_team:nfl_teams!home_team_id ( id, abbreviation, name, city ),
			away_team:nfl_teams!away_team_id ( id, abbreviation, name, city )
		`
		)
		.eq('season_year', seasonYear)
		.eq('week_number', weekNumber)
		.order('kickoff_at');

	if (error) {
		return { games: [], error: error.message };
	}

	const games = (data ?? [])
		.map((row) => mapGameRow(row as GameQueryRow))
		.filter((game): game is WeekGame => game !== null);

	return { games, error: null };
}
