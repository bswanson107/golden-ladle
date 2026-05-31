export type League = {
	id: string;
	name: string;
	season_year: number;
	commissioner_id: string;
	invite_code: string;
	is_active: boolean;
	created_at: string;
};

export type LeagueMembership = {
	league_id: string;
	joined_at: string;
	leagues: League;
};

export type LeagueWithRole = League & {
	is_commissioner: boolean;
	joined_at: string;
};
