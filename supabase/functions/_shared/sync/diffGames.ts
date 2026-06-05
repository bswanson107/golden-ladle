import type { GameSyncRow } from './types.ts';

export type GameDbRow = {
	espn_event_id: string;
	status: string;
	home_score: number | null;
	away_score: number | null;
	winner_team_id: string | null;
	is_tie: boolean;
	home_win_pct: number | null;
	away_win_pct: number | null;
	kickoff_at: string;
};

function numEq(a: number | null, b: number | null): boolean {
	if (a === null && b === null) return true;
	if (a === null || b === null) return false;
	return Math.abs(a - b) < 0.001;
}

function kickoffEq(a: string, b: string): boolean {
	return new Date(a).getTime() === new Date(b).getTime();
}

function rowChanged(incoming: GameSyncRow, current: GameDbRow): boolean {
	return (
		incoming.status !== current.status ||
		incoming.awayScore !== current.away_score ||
		incoming.homeScore !== current.home_score ||
		incoming.winner !== current.winner_team_id ||
		incoming.isTie !== current.is_tie ||
		!numEq(incoming.homeWinPct, current.home_win_pct) ||
		!numEq(incoming.awayWinPct, current.away_win_pct) ||
		!kickoffEq(incoming.kickoffAtUtc, current.kickoff_at)
	);
}

function oddsChanged(incoming: GameSyncRow, current: GameDbRow): boolean {
	return (
		!numEq(incoming.homeWinPct, current.home_win_pct) ||
		!numEq(incoming.awayWinPct, current.away_win_pct)
	);
}

export function diffGames(
	incoming: GameSyncRow[],
	current: GameDbRow[]
): { toUpsert: GameSyncRow[]; oddsChanged: number } {
	const byId = new Map(current.map((row) => [row.espn_event_id, row]));
	const toUpsert: GameSyncRow[] = [];
	let oddsChangedCount = 0;

	for (const game of incoming) {
		const existing = byId.get(game.espnEventId);
		if (!existing) {
			toUpsert.push(game);
			if (game.homeWinPct !== null || game.awayWinPct !== null) oddsChangedCount += 1;
			continue;
		}
		if (oddsChanged(game, existing)) oddsChangedCount += 1;
		if (rowChanged(game, existing)) toUpsert.push(game);
	}

	return { toUpsert, oddsChanged: oddsChangedCount };
}
