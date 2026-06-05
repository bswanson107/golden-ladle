export type SyncState = {
	key: string;
	last_started_at: string | null;
	last_completed_at: string | null;
	last_error: string | null;
	games_updated: number;
	odds_updated: number;
	updated_at: string;
};
