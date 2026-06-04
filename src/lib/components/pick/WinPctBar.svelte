<script lang="ts">
	import { formatWinPct } from '$lib/demo';
	import { getTeamTileGradient } from '$lib/data/nflTeams';

	let {
		awayTeamCode,
		homeTeamCode,
		awayWinPct = null,
		homeWinPct = null
	}: {
		awayTeamCode: string;
		homeTeamCode: string;
		awayWinPct?: number | null;
		homeWinPct?: number | null;
	} = $props();

	const split = $derived.by(() => {
		const away = awayWinPct ?? 50;
		const home = homeWinPct ?? 50;
		const total = away + home;
		return {
			away: total > 0 ? (away / total) * 100 : 50,
			home: total > 0 ? (home / total) * 100 : 50
		};
	});

	const awayGradient = $derived(getTeamTileGradient(awayTeamCode));
	const homeGradient = $derived(getTeamTileGradient(homeTeamCode));
</script>

<div class="win-pct">
	<div class="win-pct-header">
		<span class="win-pct-label">Win %</span>
		<span class="win-pct-values">
			<span class="away-value">{formatWinPct(awayWinPct)}</span>
			<span class="sep">·</span>
			<span class="home-value">{formatWinPct(homeWinPct)}</span>
		</span>
	</div>

	<div class="win-pct-track" aria-hidden="true">
		<div
			class="segment away"
			style:flex-grow={split.away}
			style:background={awayGradient}
		></div>
		<div class="divider"></div>
		<div
			class="segment home"
			style:flex-grow={split.home}
			style:background={homeGradient}
		></div>
	</div>
</div>

<style>
	.win-pct {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.win-pct-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.win-pct-label {
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
	}

	.win-pct-values {
		font-size: 0.78rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: var(--text-muted);
	}

	.sep {
		margin: 0 0.2rem;
		opacity: 0.55;
	}

	.win-pct-track {
		display: flex;
		align-items: stretch;
		height: 1.1rem;
		border: 1px solid var(--border);
		border-radius: 999px;
		overflow: hidden;
		background: var(--bg);
		box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.18);
	}

	.segment {
		flex: 1 1 0;
		min-width: 0;
		height: 100%;
		transition: flex-grow 0.2s ease;
	}

	.divider {
		flex-shrink: 0;
		width: 4px;
		background: rgba(12, 14, 18, 0.92);
		box-shadow:
			-1px 0 0 rgba(255, 255, 255, 0.08),
			1px 0 0 rgba(255, 255, 255, 0.08);
		z-index: 1;
	}
</style>
