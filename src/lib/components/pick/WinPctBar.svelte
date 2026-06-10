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
	<div class="win-pct-values" aria-hidden="true">
		<div class="value-segment away" style:flex-grow={split.away}>
			<span class="pct away-pct">{formatWinPct(awayWinPct)}</span>
		</div>
		<div class="split-gap"></div>
		<div class="value-segment home" style:flex-grow={split.home}>
			<span class="pct home-pct">{formatWinPct(homeWinPct)}</span>
		</div>
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

	<p class="win-pct-label">Win %</p>
</div>

<style>
	.win-pct {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.win-pct-label {
		margin: 0.1rem 0 0;
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
		text-align: center;
	}

	.win-pct-values {
		display: flex;
		align-items: baseline;
		min-height: 1rem;
	}

	.value-segment {
		flex: 1 1 0;
		min-width: 0;
		display: flex;
		align-items: baseline;
	}

	.value-segment.away {
		justify-content: flex-end;
	}

	.value-segment.home {
		justify-content: flex-start;
	}

	.split-gap {
		flex-shrink: 0;
		width: 4px;
	}

	.pct {
		font-size: 0.78rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: var(--text-muted);
		line-height: 1;
	}

	.away-pct {
		padding-right: 0.3rem;
	}

	.home-pct {
		padding-left: 0.5rem;
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
		background: var(--shadow-color);
		z-index: 1;
	}
</style>
