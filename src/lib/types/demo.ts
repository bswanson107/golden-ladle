import type { PickOutcome } from '$lib/types/standings';

export type DemoPick = {
	game_id: string;
	team_id: string;
	team_abbreviation: string;
	team_name: string;
	win_pct_at_pick: number;
	is_underdog_at_pick: boolean;
};

export type DemoState = {
	enabled: boolean;
	simulatedWeek: number;
	picks: Record<number, DemoPick>;
};

export type ScoredDemoPick = DemoPick & {
	week_number: number;
	outcome: PickOutcome;
	points_awarded: number;
};
