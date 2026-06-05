import type { SupabaseClient } from '@supabase/supabase-js';

type WeekGameRow = {
	id: string;
	week_number: number;
	kickoff_at: string;
	home_team_id: string;
	season_year: number;
};

type LeagueRow = {
	id: string;
	season_year: number;
};

type MemberRow = {
	league_id: string;
	user_id: string;
};

type ExistingPickRow = {
	league_id: string;
	user_id: string;
	week_number: number;
};

export async function markMissedPicks(
	adminClient: SupabaseClient,
	seasonYear: number
): Promise<number> {
	const now = new Date().toISOString();

	const { data: games, error: gamesError } = await adminClient
		.from('nfl_games')
		.select('id, week_number, kickoff_at, home_team_id, season_year')
		.eq('season_year', seasonYear)
		.order('kickoff_at', { ascending: true });

	if (gamesError) throw new Error(`markMissedPicks games query failed: ${gamesError.message}`);

	const gamesByWeek = new Map<number, WeekGameRow[]>();
	for (const game of (games ?? []) as WeekGameRow[]) {
		const list = gamesByWeek.get(game.week_number) ?? [];
		list.push(game);
		gamesByWeek.set(game.week_number, list);
	}

	const closedWeeks: { week: number; lastGame: WeekGameRow }[] = [];
	for (const [week, weekGames] of gamesByWeek) {
		const lastGame = weekGames[weekGames.length - 1];
		if (lastGame.kickoff_at <= now) {
			closedWeeks.push({ week, lastGame });
		}
	}

	if (closedWeeks.length === 0) return 0;

	const { data: leagues, error: leaguesError } = await adminClient
		.from('leagues')
		.select('id, season_year')
		.eq('season_year', seasonYear)
		.eq('is_active', true);

	if (leaguesError) throw new Error(`markMissedPicks leagues query failed: ${leaguesError.message}`);

	const leagueIds = ((leagues ?? []) as LeagueRow[]).map((l) => l.id);
	if (leagueIds.length === 0) return 0;

	const { data: members, error: membersError } = await adminClient
		.from('league_members')
		.select('league_id, user_id')
		.in('league_id', leagueIds);

	if (membersError) throw new Error(`markMissedPicks members query failed: ${membersError.message}`);

	const closedWeekNumbers = closedWeeks.map((w) => w.week);
	const { data: existingPicks, error: picksError } = await adminClient
		.from('picks')
		.select('league_id, user_id, week_number')
		.in('league_id', leagueIds)
		.in('week_number', closedWeekNumbers)
		.eq('season_year', seasonYear)
		.is('superseded_by_pick_id', null);

	if (picksError) throw new Error(`markMissedPicks picks query failed: ${picksError.message}`);

	const hasPick = new Set(
		((existingPicks ?? []) as ExistingPickRow[]).map(
			(p) => `${p.league_id}:${p.user_id}:${p.week_number}`
		)
	);

	const { data: missedAlready, error: missedError } = await adminClient
		.from('picks')
		.select('league_id, user_id, week_number')
		.in('league_id', leagueIds)
		.in('week_number', closedWeekNumbers)
		.eq('is_missed', true);

	if (missedError) throw new Error(`markMissedPicks missed query failed: ${missedError.message}`);

	for (const row of (missedAlready ?? []) as ExistingPickRow[]) {
		hasPick.add(`${row.league_id}:${row.user_id}:${row.week_number}`);
	}

	const toInsert: {
		league_id: string;
		user_id: string;
		season_year: number;
		week_number: number;
		game_id: string;
		team_id: string;
		outcome: 'missed';
		points_awarded: number;
		win_pct_at_pick: number;
		is_underdog_at_pick: boolean;
		team_season_wins_at_pick: number;
		is_missed: boolean;
	}[] = [];

	for (const { week, lastGame } of closedWeeks) {
		for (const member of (members ?? []) as MemberRow[]) {
			const key = `${member.league_id}:${member.user_id}:${week}`;
			if (hasPick.has(key)) continue;

			toInsert.push({
				league_id: member.league_id,
				user_id: member.user_id,
				season_year: seasonYear,
				week_number: week,
				game_id: lastGame.id,
				team_id: lastGame.home_team_id,
				outcome: 'missed',
				points_awarded: 0,
				win_pct_at_pick: 50,
				is_underdog_at_pick: false,
				team_season_wins_at_pick: 0,
				is_missed: true
			});
			hasPick.add(key);
		}
	}

	if (toInsert.length === 0) return 0;

	const { error: insertError } = await adminClient.from('picks').insert(toInsert);
	if (insertError) throw new Error(`markMissedPicks insert failed: ${insertError.message}`);

	return toInsert.length;
}
