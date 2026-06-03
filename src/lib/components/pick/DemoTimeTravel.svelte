<script lang="ts">
	import {
		clampSimulatedWeek,
		hasDemoPicks,
		MAX_SIMULATED_WEEK,
		MIN_SIMULATED_WEEK,
		simulatedWeekLabel
	} from '$lib/demo';
	import type { DemoState } from '$lib/types/demo';

	let {
		demoState,
		onToggle,
		onWeekChange,
		onReset
	}: {
		demoState: DemoState;
		onToggle: (enabled: boolean) => void;
		onWeekChange: (week: number) => void;
		onReset?: () => void;
	} = $props();

	const weekOptions = Array.from(
		{ length: MAX_SIMULATED_WEEK - MIN_SIMULATED_WEEK + 1 },
		(_, i) => MIN_SIMULATED_WEEK + i
	);
	const canReset = $derived(hasDemoPicks(demoState));
	const canStepBack = $derived(demoState.simulatedWeek > MIN_SIMULATED_WEEK);
	const canStepForward = $derived(demoState.simulatedWeek < MAX_SIMULATED_WEEK);

	function stepWeek(delta: number) {
		onWeekChange(clampSimulatedWeek(demoState.simulatedWeek + delta));
	}
</script>

<section class="demo-panel">
	<div class="demo-header">
		<label class="demo-toggle">
			<input
				type="checkbox"
				checked={demoState.enabled}
				onchange={(e) => onToggle((e.currentTarget as HTMLInputElement).checked)}
			/>
			<span>Demo mode</span>
		</label>
		{#if demoState.enabled}
			<span class="demo-badge">Time travel</span>
		{/if}
	</div>

	{#if demoState.enabled}
		<p class="demo-note">
			Picks are saved locally and scored from mock 2025 results.
		</p>

		<div class="week-select">
			<span class="week-select-label">Simulated time</span>
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
					value={demoState.simulatedWeek}
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

		{#if onReset}
			<button type="button" class="reset-btn" disabled={!canReset} onclick={onReset}>
				Reset demo picks
			</button>
		{/if}
	{:else}
		<p class="demo-note muted">Live picks coming soon. Enable demo mode to try the pick flow.</p>
	{/if}
</section>

<style>
	.demo-panel {
		padding: 1rem 1.1rem;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--bg-elevated);
	}

	.demo-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.demo-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 600;
		color: var(--text);
		cursor: pointer;
	}

	.demo-toggle input {
		width: 1rem;
		height: 1rem;
		accent-color: var(--accent);
	}

	.demo-badge {
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 0.2rem 0.5rem;
		border-radius: 999px;
		background: rgba(126, 184, 255, 0.15);
		color: var(--link);
	}

	.demo-note {
		margin: 0.65rem 0 0;
		font-size: 0.85rem;
		color: var(--text-muted);
	}

	.demo-note.muted {
		margin-bottom: 0;
	}

	.week-select {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		margin-top: 0.85rem;
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
</style>
