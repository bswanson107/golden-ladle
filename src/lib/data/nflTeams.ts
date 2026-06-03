export type NFLTeamCode =
	| 'ARI'
	| 'ATL'
	| 'BAL'
	| 'BUF'
	| 'CAR'
	| 'CHI'
	| 'CIN'
	| 'CLE'
	| 'DAL'
	| 'DEN'
	| 'DET'
	| 'GB'
	| 'HOU'
	| 'IND'
	| 'JAX'
	| 'KC'
	| 'LV'
	| 'LAC'
	| 'LAR'
	| 'MIA'
	| 'MIN'
	| 'NE'
	| 'NO'
	| 'NYG'
	| 'NYJ'
	| 'PHI'
	| 'PIT'
	| 'SEA'
	| 'SF'
	| 'TB'
	| 'TEN'
	| 'WAS';

export type NFLTeam = {
	code: NFLTeamCode;
	name: string;
	logo: string;
	primaryColor: string;
};

function espnLogoUrl(code: string): string {
	return `https://a.espncdn.com/i/teamlogos/nfl/500/${code.toLowerCase()}.png`;
}

const TEAM_NAMES: Record<NFLTeamCode, string> = {
	ARI: 'Arizona Cardinals',
	ATL: 'Atlanta Falcons',
	BAL: 'Baltimore Ravens',
	BUF: 'Buffalo Bills',
	CAR: 'Carolina Panthers',
	CHI: 'Chicago Bears',
	CIN: 'Cincinnati Bengals',
	CLE: 'Cleveland Browns',
	DAL: 'Dallas Cowboys',
	DEN: 'Denver Broncos',
	DET: 'Detroit Lions',
	GB: 'Green Bay Packers',
	HOU: 'Houston Texans',
	IND: 'Indianapolis Colts',
	JAX: 'Jacksonville Jaguars',
	KC: 'Kansas City Chiefs',
	LV: 'Las Vegas Raiders',
	LAC: 'Los Angeles Chargers',
	LAR: 'Los Angeles Rams',
	MIA: 'Miami Dolphins',
	MIN: 'Minnesota Vikings',
	NE: 'New England Patriots',
	NO: 'New Orleans Saints',
	NYG: 'New York Giants',
	NYJ: 'New York Jets',
	PHI: 'Philadelphia Eagles',
	PIT: 'Pittsburgh Steelers',
	SEA: 'Seattle Seahawks',
	SF: 'San Francisco 49ers',
	TB: 'Tampa Bay Buccaneers',
	TEN: 'Tennessee Titans',
	WAS: 'Washington Commanders'
};

const TEAM_COLORS: Record<NFLTeamCode, string> = {
	ARI: '#97233F',
	ATL: '#A71930',
	BAL: '#241773',
	BUF: '#00338D',
	CAR: '#0085CA',
	CHI: '#0B162A',
	CIN: '#FB4F14',
	CLE: '#311D00',
	DAL: '#003594',
	DEN: '#FB4F14',
	DET: '#0076B6',
	GB: '#203731',
	HOU: '#03202F',
	IND: '#002C5F',
	JAX: '#006778',
	KC: '#E31837',
	LV: '#000000',
	LAC: '#0080C6',
	LAR: '#FFC72C',
	MIA: '#008E97',
	MIN: '#4F2683',
	NE: '#002244',
	NO: '#D3BC8D',
	NYG: '#A2AAAD',
	NYJ: '#FFFFFF',
	PHI: '#004C54',
	PIT: '#FFB612',
	SEA: '#002244',
	SF: '#AA0000',
	TB: '#D50A0A',
	TEN: '#4B92DB',
	WAS: '#5A1414'
};

export const NFL_TEAMS = Object.fromEntries(
	(Object.keys(TEAM_NAMES) as NFLTeamCode[]).map((code) => [
		code,
		{
			code,
			name: TEAM_NAMES[code],
			logo: espnLogoUrl(code),
			primaryColor: TEAM_COLORS[code]
		}
	])
) as Record<NFLTeamCode, NFLTeam>;

export const TEAM_OPTIONS = (Object.keys(TEAM_NAMES) as NFLTeamCode[])
	.map((code) => ({
		value: code,
		label: TEAM_NAMES[code]
	}))
	.sort((a, b) => a.label.localeCompare(b.label));

export const NFL_TEAM_CODES = Object.keys(NFL_TEAMS) as NFLTeamCode[];

export function isNFLTeamCode(teamCode: string): teamCode is NFLTeamCode {
	return teamCode in NFL_TEAMS;
}

export function getTeamLogo(teamCode: string): string {
	if (!isNFLTeamCode(teamCode)) return '';
	return NFL_TEAMS[teamCode].logo;
}

export function getTeamName(teamCode: string): string {
	if (!isNFLTeamCode(teamCode)) return teamCode;
	return NFL_TEAMS[teamCode].name;
}

export function getTeamPrimaryColor(teamCode: string): string {
	if (!isNFLTeamCode(teamCode)) return 'var(--logo-tile-bg)';
	return NFL_TEAMS[teamCode].primaryColor;
}

function hexLuminance(hex: string): number {
	const normalized = hex.replace('#', '');
	if (normalized.length !== 6) return 0;

	const r = parseInt(normalized.slice(0, 2), 16);
	const g = parseInt(normalized.slice(2, 4), 16);
	const b = parseInt(normalized.slice(4, 6), 16);

	return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
	const normalized = hex.replace('#', '');
	if (normalized.length !== 6) return null;

	return {
		r: parseInt(normalized.slice(0, 2), 16),
		g: parseInt(normalized.slice(2, 4), 16),
		b: parseInt(normalized.slice(4, 6), 16)
	};
}

function toHex(r: number, g: number, b: number): string {
	return `#${[r, g, b]
		.map((channel) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, '0'))
		.join('')}`;
}

function adjustHex(hex: string, amount: number): string {
	const rgb = parseHex(hex);
	if (!rgb) return hex;

	return toHex(rgb.r + amount, rgb.g + amount, rgb.b + amount);
}

export function getTeamTileGradient(teamCode: string): string {
	const base = getTeamPrimaryColor(teamCode);
	if (base.startsWith('var(')) return base;

	const isLight = hexLuminance(base) > 0.65;
	const topShift = isLight ? 10 : 20;
	const bottomShift = isLight ? -12 : -20;

	const top = adjustHex(base, topShift);
	const bottom = adjustHex(base, bottomShift);

	return `linear-gradient(145deg, ${top} 0%, ${base} 52%, ${bottom} 100%)`;
}

export function isLightTeamColor(teamCode: string): boolean {
	if (!isNFLTeamCode(teamCode)) return false;
	return hexLuminance(NFL_TEAMS[teamCode].primaryColor) > 0.65;
}
