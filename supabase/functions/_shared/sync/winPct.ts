export function americanToImpliedProb(odds: number): number | null {
	if (!Number.isFinite(odds) || odds === 0) return null;
	return odds < 0 ? -odds / (-odds + 100) : 100 / (odds + 100);
}

export function normalizedWinPcts(
	awayMl: number | null,
	homeMl: number | null
): { away: number | null; home: number | null } {
	const awayRaw = awayMl !== null ? americanToImpliedProb(awayMl) : null;
	const homeRaw = homeMl !== null ? americanToImpliedProb(homeMl) : null;
	if (awayRaw === null || homeRaw === null) return { away: null, home: null };
	const total = awayRaw + homeRaw;
	return {
		away: Math.round((awayRaw / total) * 10000) / 100,
		home: Math.round((homeRaw / total) * 10000) / 100
	};
}
