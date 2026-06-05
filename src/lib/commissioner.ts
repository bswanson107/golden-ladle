import { getSupabase } from '$lib/supabase';
import type { AdminPick } from '$lib/types/commissioner';
import type { SyncState } from '$lib/types/sync';
import type { GameStatus } from '$lib/types/game';
import type { PickOutcome } from '$lib/types/standings';

type AdminPickRow = {
	id: string;
	user_id: string;
	game_id: string;
	week_number: number;
	team_id: string;
	outcome: PickOutcome;
	points_awarded: number;
	is_commissioner_override: boolean;
	is_missed: boolean;
	override_notes: string | null;
	profiles: { display_name: string } | { display_name: string }[] | null;
	nfl_teams: { abbreviation: string; name: string } | { abbreviation: string; name: string }[] | null;
	nfl_games:
		| { status: GameStatus }
		| { status: GameStatus }[]
		| null;
};

function firstRelation<T>(value: T | T[] | null): T | null {
	if (!value) return null;
	return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapAdminPickRow(row: AdminPickRow): AdminPick | null {
	const profile = firstRelation(row.profiles);
	const team = firstRelation(row.nfl_teams);
	const game = firstRelation(row.nfl_games);
	if (!profile || !team) return null;

	return {
		id: row.id,
		user_id: row.user_id,
		game_id: row.game_id,
		display_name: profile.display_name,
		week_number: row.week_number,
		team_id: row.team_id,
		team_abbreviation: team.abbreviation,
		team_name: team.name,
		outcome: row.outcome,
		points_awarded: row.points_awarded,
		is_commissioner_override: row.is_commissioner_override,
		is_missed: row.is_missed,
		override_notes: row.override_notes,
		game_status: game?.status ?? null
	};
}

export async function getSyncState(): Promise<{ state: SyncState | null; error: string | null }> {
	const { data, error } = await getSupabase()
		.from('sync_state')
		.select('*')
		.eq('key', 'nfl_games')
		.single();

	if (error) {
		return { state: null, error: error.message };
	}

	return { state: data as SyncState, error: null };
}

export async function overridePick(
	pickId: string,
	outcome: AdminPick['outcome'],
	points: number,
	notes?: string
): Promise<{ error: string | null }> {
	const { error } = await getSupabase().rpc('commissioner_override_pick', {
		p_pick_id: pickId,
		p_outcome: outcome,
		p_points: points,
		p_notes: notes ?? null
	});

	if (error?.message.includes('commissioner_override_pick')) {
		return { error: 'Override function missing. Run migration 001 in Supabase.' };
	}

	return { error: error?.message ?? null };
}

export async function rescoreGame(
	gameId: string
): Promise<{ count: number; error: string | null }> {
	const { data, error } = await getSupabase().rpc('score_picks_for_game', {
		p_game_id: gameId
	});

	return { count: data ?? 0, error: error?.message ?? null };
}

export async function updateGameStatus(
	leagueId: string,
	gameId: string,
	status: 'final' | 'scheduled' | 'postponed',
	opts?: { homeScore?: number; awayScore?: number; winnerTeamId?: string; isTie?: boolean }
): Promise<{ error: string | null }> {
	const { error } = await getSupabase().rpc('update_game_status', {
		p_league_id: leagueId,
		p_game_id: gameId,
		p_status: status,
		p_home_score: opts?.homeScore ?? null,
		p_away_score: opts?.awayScore ?? null,
		p_winner_team_id: opts?.winnerTeamId ?? null,
		p_is_tie: opts?.isTie ?? false
	});

	if (error?.message.includes('update_game_status')) {
		return {
			error:
				'Update game function missing. Run supabase/migrations/012_commissioner_update_game.sql in Supabase.'
		};
	}

	return { error: error?.message ?? null };
}

export async function fetchLeaguePicksAdmin(leagueId: string): Promise<{
	picks: AdminPick[];
	error: string | null;
}> {
	const { data, error } = await getSupabase()
		.from('picks')
		.select(
			`
			id,
			user_id,
			game_id,
			week_number,
			team_id,
			outcome,
			points_awarded,
			is_commissioner_override,
			is_missed,
			override_notes,
			profiles ( display_name ),
			nfl_teams ( abbreviation, name ),
			nfl_games ( status )
		`
		)
		.eq('league_id', leagueId)
		.is('superseded_by_pick_id', null)
		.order('week_number')
		.order('created_at');

	if (error) {
		return { picks: [], error: error.message };
	}

	const picks = (data ?? [])
		.map((row) => mapAdminPickRow(row as AdminPickRow))
		.filter((pick): pick is AdminPick => pick !== null);

	return { picks, error: null };
}

/** Suggested points for a commissioner override outcome. */
export function defaultPointsForOutcome(
	outcome: PickOutcome,
	isUnderdog?: boolean
): number {
	switch (outcome) {
		case 'win':
			return isUnderdog ? 2 : 1;
		case 'tie':
			return 0.5;
		case 'loss':
		case 'missed':
		case 'pending':
		case 'void':
			return 0;
		default:
			return 0;
	}
}
