import { normalizedWinPcts } from './winPct.ts';
import type { GameStatus, GameSyncRow } from './types.ts';

const TEAM_MAP: Record<string, string> = { LA: 'LAR' };

export function mapTeam(abbr: string): string {
	return TEAM_MAP[abbr] ?? abbr;
}

/** Convert Eastern wall-clock kickoff to UTC ISO string. */
export function easternKickoffToUtcIso(gameday: string, gametime: string): string {
	const time = gametime?.trim() || '13:00';
	const [year, month, day] = gameday.split('-').map(Number);
	const [hour, minute] = time.split(':').map(Number);

	let low = Date.UTC(year, month - 1, day, hour - 6, minute);
	let high = Date.UTC(year, month - 1, day, hour + 6, minute);

	for (let i = 0; i < 24; i++) {
		const mid = Math.floor((low + high) / 2);
		const parts = getEasternParts(mid);
		const cmp =
			parts.year !== year
				? parts.year - year
				: parts.month !== month
					? parts.month - month
					: parts.day !== day
						? parts.day - day
						: parts.hour !== hour
							? parts.hour - hour
							: parts.minute - minute;

		if (cmp === 0) return new Date(mid).toISOString();
		if (cmp < 0) low = mid + 1;
		else high = mid - 1;
	}

	return new Date(low).toISOString();
}

function getEasternParts(utcMs: number): {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
} {
	const formatter = new Intl.DateTimeFormat('en-US', {
		timeZone: 'America/New_York',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false
	});
	const parts = formatter.formatToParts(new Date(utcMs));
	const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
	return {
		year: Number(get('year')),
		month: Number(get('month')),
		day: Number(get('day')),
		hour: Number(get('hour')),
		minute: Number(get('minute'))
	};
}

function parseCsvLine(line: string): string[] {
	const result: string[] = [];
	let current = '';
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (ch === '"') {
			inQuotes = !inQuotes;
			continue;
		}
		if (ch === ',' && !inQuotes) {
			result.push(current.trim());
			current = '';
			continue;
		}
		current += ch;
	}
	result.push(current.trim());
	return result;
}

function parseCsv(text: string): Record<string, string>[] {
	const lines = text.trim().split('\n');
	if (lines.length < 2) return [];
	const header = parseCsvLine(lines[0]);
	return lines.slice(1).map((line) => {
		const cols = parseCsvLine(line);
		return Object.fromEntries(header.map((key, i) => [key, cols[i] ?? '']));
	});
}

function parseScore(value: string): number | null {
	if (value === '' || value === undefined) return null;
	const n = Number(value);
	return Number.isFinite(n) ? n : null;
}

function parseMoneyline(value: string): number | null {
	if (value === '' || value === undefined) return null;
	const n = Number(value);
	return Number.isFinite(n) ? n : null;
}

function deriveStatus(
	awayScore: number | null,
	homeScore: number | null,
	overtime: string
): GameStatus {
	if (overtime === 'POSTP' || overtime === 'PSTP') return 'postponed';
	if (awayScore !== null && homeScore !== null) return 'final';
	return 'scheduled';
}

export const NFLVERSE_GAMES_URL =
	'https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv';

export async function fetchNflverseGames(seasonYear: number): Promise<GameSyncRow[]> {
	const response = await fetch(NFLVERSE_GAMES_URL);
	if (!response.ok) {
		throw new Error(`Failed to fetch nflverse games: ${response.status} ${response.statusText}`);
	}

	const rows = parseCsv(await response.text());

	return rows
		.filter((row) => row.game_type === 'REG' && Number(row.season) === seasonYear)
		.map((row) => {
			const awayTeam = mapTeam(row.away_team);
			const homeTeam = mapTeam(row.home_team);
			const awayScore = parseScore(row.away_score);
			const homeScore = parseScore(row.home_score);
			const isTie = awayScore !== null && homeScore !== null && awayScore === homeScore;
			let winner: string | null = null;
			if (awayScore !== null && homeScore !== null && !isTie) {
				winner = awayScore > homeScore ? awayTeam : homeTeam;
			}

			const awayMl = parseMoneyline(row.away_moneyline);
			const homeMl = parseMoneyline(row.home_moneyline);
			const { away: awayWinPct, home: homeWinPct } = normalizedWinPcts(awayMl, homeMl);

			const gameday = row.gameday;
			const gametime = row.gametime || '13:00';

			return {
				espnEventId: row.game_id,
				season: seasonYear,
				week: Number(row.week),
				gameday,
				gametime,
				awayTeam,
				homeTeam,
				awayScore,
				homeScore,
				status: deriveStatus(awayScore, homeScore, row.overtime ?? ''),
				winner,
				isTie,
				awayWinPct,
				homeWinPct,
				kickoffAtUtc: easternKickoffToUtcIso(gameday, gametime)
			};
		});
}
