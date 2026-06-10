import type { WeekGame } from '$lib/types/game';
import type { LeaguePick, StandingRow } from '$lib/types/standings';

/** Members with no active non-missed pick for the given week. */
export function getMissingPickers(
	members: StandingRow[],
	picks: LeaguePick[],
	weekNumber: number
): StandingRow[] {
	const pickedUserIds = new Set(
		picks
			.filter((p) => p.week_number === weekNumber && !p.is_missed)
			.map((p) => p.user_id)
	);
	return members.filter((m) => !pickedUserIds.has(m.user_id));
}

/** Earliest kickoff in a week (first pick deadline for Thu games). */
export function getWeekFirstKickoff(games: WeekGame[]): string | null {
	if (games.length === 0) return null;
	return games.reduce(
		(earliest, game) =>
			game.kickoff_at < earliest ? game.kickoff_at : earliest,
		games[0].kickoff_at
	);
}

/** Latest kickoff in a week (week pick window closes). */
export function getWeekLastKickoff(games: WeekGame[]): string | null {
	if (games.length === 0) return null;
	return games.reduce(
		(latest, game) => (game.kickoff_at > latest ? game.kickoff_at : latest),
		games[0].kickoff_at
	);
}

export function hasWeekStarted(games: WeekGame[], now = Date.now()): boolean {
	const first = getWeekFirstKickoff(games);
	return first !== null && new Date(first).getTime() <= now;
}

export function hasWeekClosed(games: WeekGame[], now = Date.now()): boolean {
	const last = getWeekLastKickoff(games);
	return last !== null && new Date(last).getTime() <= now;
}

export type PickCtaState =
	| { kind: 'hidden' }
	| { kind: 'needs_pick'; week: number; deadlineLabel: string }
	| { kind: 'submitted'; week: number; changeable: boolean; teamAbbreviation?: string }
	| { kind: 'closed'; week: number };

export function getPickCtaState(
	weekNumber: number,
	games: WeekGame[],
	userPick: LeaguePick | undefined,
	now = Date.now()
): PickCtaState {
	if (games.length === 0) {
		return { kind: 'hidden' };
	}

	if (hasWeekStarted(games, now)) {
		return { kind: 'closed', week: weekNumber };
	}

	const firstKickoff = getWeekFirstKickoff(games);
	if (!firstKickoff) {
		return { kind: 'hidden' };
	}

	if (!userPick) {
		return {
			kind: 'needs_pick',
			week: weekNumber,
			deadlineLabel: firstKickoff
		};
	}

	const kickedOff = new Date(userPick.kickoff_at).getTime() <= now;

	return {
		kind: 'submitted',
		week: weekNumber,
		changeable: !kickedOff,
		teamAbbreviation: kickedOff ? userPick.team_abbreviation : undefined
	};
}
