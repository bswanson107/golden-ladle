import type { GameStatus } from '$lib/types/game';
import type { PickOutcome } from '$lib/types/standings';

export type AdminPick = {
	id: string;
	user_id: string;
	game_id: string;
	display_name: string;
	week_number: number;
	team_id: string;
	team_abbreviation: string;
	team_name: string;
	outcome: PickOutcome;
	points_awarded: number;
	is_commissioner_override: boolean;
	is_missed: boolean;
	override_notes: string | null;
	game_status: GameStatus | null;
};

export type OverrideOutcome = Extract<PickOutcome, 'pending' | 'win' | 'loss' | 'tie' | 'missed'>;
