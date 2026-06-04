<script lang="ts">
	import {
		clampSimulatedWeek,
		MAX_SIMULATED_WEEK,
		MIN_SIMULATED_WEEK,
		simulatedWeekLabel
	} from '$lib/demo';

	let {
		viewWeek,
		onWeekChange,
		label = 'View week',
		compact = false,
		showReset = false,
		canReset = false,
		onReset
	}: {
		viewWeek: number;
		onWeekChange: (week: number) => void;
		label?: string;
		compact?: boolean;
		showReset?: boolean;
		canReset?: boolean;
		onReset?: () => void;
	} = $props();

	const weekOptions = Array.from(
		{ length: MAX_SIMULATED_WEEK - MIN_SIMULATED_WEEK + 1 },
		(_, i) => MIN_SIMULATED_WEEK + i
	);
	const canStepBack = $derived(viewWeek > MIN_SIMULATED_WEEK);
	const canStepForward = $derived(viewWeek < MAX_SIMULATED_WEEK);

	function stepWeek(delta: number) {
		onWeekChange(clampSimulatedWeek(viewWeek + delta));
	}
</script>

<section class="week-nav" class:compact>
	<div class="week-select">
		<span class="week-select-label">{label}</span>
		<div class="week-controls">
			<button
				type="button"
				class="week-step"
				disabled={!canStepBack}
				aria-label="Previous week"
				onclick={() => stepWeek(-1)}
			>
				←
			</button>
			<select
				value={viewWeek}
				onchange={(e) => onWeekChange(Number((e.currentTarget as HTMLSelectElement).value))}
			>
				{#each weekOptions as week (week)}
					<option value={week}>{simulatedWeekLabel(week)}</option>
				{/each}
			</select>
			<button
				type="button"
				class="week-step"
				disabled={!canStepForward}
				aria-label="Next week"
				onclick={() => stepWeek(1)}
			>
				→
			</button>
		</div>
	</div>

	{#if showReset && onReset}
		<button type="button" class="reset-btn" disabled={!canReset} onclick={onReset}>
			Reset demo picks
		</button>
	{/if}
</section>

<style>
	.week-nav {
		padding: 1rem 1.1rem;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--bg-elevated);
	}

	.week-select {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-size: 0.85rem;
		color: var(--text-muted);
	}

	.week-select-label {
		font-size: 0.85rem;
	}

	.week-controls {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}

	.week-controls select {
		flex: 1;
		min-width: 0;
		padding: 0.55rem 0.65rem;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg);
		color: var(--text);
		font-size: 0.95rem;
	}

	.week-step {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.25rem;
		height: 2.25rem;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg);
		color: var(--text);
		font-size: 1rem;
		line-height: 1;
		cursor: pointer;
		flex-shrink: 0;
	}

	.week-step:hover:not(:disabled) {
		border-color: var(--link);
		color: var(--link);
	}

	.week-step:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.reset-btn {
		margin-top: 0.85rem;
		padding: 0.5rem 0.75rem;
		border: 1px solid rgba(255, 100, 100, 0.35);
		border-radius: 8px;
		background: rgba(255, 100, 100, 0.08);
		color: #e89898;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s, border-color 0.15s;
	}

	.reset-btn:hover:not(:disabled) {
		background: rgba(255, 100, 100, 0.14);
		border-color: rgba(255, 100, 100, 0.5);
	}

	.reset-btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.week-nav.compact {
		padding: 0;
		border: none;
		border-radius: 0;
		background: transparent;
	}

	.week-nav.compact .week-select {
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.week-nav.compact .week-select-label {
		flex-shrink: 0;
		font-size: 0.78rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.week-nav.compact .week-controls select {
		padding: 0.45rem 0.55rem;
		font-size: 0.9rem;
	}

	.week-nav.compact .week-step {
		width: 2rem;
		height: 2rem;
		font-size: 0.95rem;
	}

	.week-nav.compact .reset-btn {
		margin-top: 0.55rem;
		padding: 0.4rem 0.65rem;
		font-size: 0.78rem;
	}
</style>
