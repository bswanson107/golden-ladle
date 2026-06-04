import { browser } from '$app/environment';
import { clampSimulatedWeek } from '$lib/demo';

const VIEW_WEEK_PREFIX = 'golden-ladle-view-week';

function viewWeekKey(leagueId: string, userId: string): string {
	return `${VIEW_WEEK_PREFIX}:${leagueId}:${userId}`;
}

export function loadViewWeek(leagueId: string, userId: string): number {
	if (!browser) return 1;

	try {
		const raw = localStorage.getItem(viewWeekKey(leagueId, userId));
		if (!raw) return 1;
		return clampSimulatedWeek(Number(raw) || 1);
	} catch {
		return 1;
	}
}

export function saveViewWeek(leagueId: string, userId: string, week: number): void {
	if (!browser) return;
	localStorage.setItem(viewWeekKey(leagueId, userId), String(clampSimulatedWeek(week)));
}
