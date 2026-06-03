<script lang="ts">
	import GameCard from '$lib/components/pick/GameCard.svelte';
	import TeamLogo from '$lib/components/TeamLogo.svelte';
	import {
		buildDemoPick,
		canPickWeek,
		formatPoints,
		formatWinPct,
		getActivePickWeek,
		getUsedTeamIds,
		outcomeLabel,
		resultsVisibleForWeek,
		scoreDemoPick
	} from '$lib/demo';
	import { fetchWeekGames } from '$lib/games';
	import type { DemoPick, DemoState } from '$lib/types/demo';
	import type { WeekGame } from '$lib/types/game';

	let {
		seasonYear,
		demoState,
		underdogThreshold = 33,
		onSavePick
	}: {
		seasonYear: number;
		demoState: DemoState;
		underdogThreshold?: number;
		onSavePick: (week: number, pick: DemoPick) => void;
	} = $props();

	let games = $state<WeekGame[]>([]);
	let priorWeekGames = $state<WeekGame[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let pendingPick = $state<DemoPick | null>(null);

	const activeWeek = $derived(getActivePickWeek(demoState.simulatedWeek));
	const currentPick = $derived(demoState.picks[activeWeek] ?? null);
	const usedTeamIds = $derived(getUsedTeamIds(demoState.picks));
	const weekOpen = $derived(canPickWeek(activeWeek, demoState.simulatedWeek));
	const pickSubmitted = $derived(currentPick !== null);
	const pickingEnabled = $derived(weekOpen && !pickSubmitted);
	const showResults = $derived(resultsVisibleForWeek(activeWeek, demoState.simulatedWeek));
	const displayTeamId = $derived(
		pickSubmitted ? (currentPick?.team_id ?? null) : (pendingPick?.team_id ?? null)
	);

	const priorWeek = $derived(activeWeek > 1 ? activeWeek - 1 : null);
	const priorPick = $derived(priorWeek !== null ? (demoState.picks[priorWeek] ?? null) : null);
	const priorResultsVisible = $derived(
		priorWeek !== null && resultsVisibleForWeek(priorWeek, demoState.simulatedWeek)
	);

	const priorScored = $derived.by(() => {
		if (!priorPick || !priorWeek || !priorResultsVisible) return null;
		const game = priorWeekGames.find((g: WeekGame) => g.id === priorPick.game_id) ?? null;
		return scoreDemoPick(priorWeek, priorPick, game, demoState.simulatedWeek);
	});

	const currentScored = $derived.by(() => {
		if (!currentPick || !showResults) return null;
		const game = games.find((g: WeekGame) => g.id === currentPick.game_id) ?? null;
		return scoreDemoPick(activeWeek, currentPick, game, demoState.simulatedWeek);
	});

	$effect(() => {
		activeWeek;
		pendingPick = null;
	});

	$effect(() => {
		JSON.stringify(demoState.picks);
		pendingPick = null;
	});

	$effect(() => {
		if (!demoState.enabled) {
			games = [];
			priorWeekGames = [];
			loading = false;
			error = null;
			return;
		}

		const week = activeWeek;
		const prevWeek = priorWeek;
		loading = true;
		error = null;

		const fetches = [fetchWeekGames(seasonYear, week)];
		if (prevWeek !== null && priorResultsVisible) {
			fetches.push(fetchWeekGames(seasonYear, prevWeek));
		}

		Promise.all(fetches).then((results) => {
			const [weekResult, priorResult] = results;
			if (weekResult.error) {
				error = weekResult.error;
				games = [];
			} else {
				games = weekResult.games;
			}

			if (priorResult?.error) {
				priorWeekGames = [];
			} else if (priorResult) {
				priorWeekGames = priorResult.games;
			} else {
				priorWeekGames = [];
			}

			loading = false;
		});
	});

	function handleSelectTeam(game: WeekGame, teamId: string) {
		if (!pickingEnabled) return;
		const pick = buildDemoPick(game, teamId, underdogThreshold);
		if (!pick) return;
		pendingPick = pick;
	}

	function handleSubmitPick() {
		if (!pendingPick || pickSubmitted) return;
		onSavePick(activeWeek, pendingPick);
		pendingPick = null;
	}
</script>

{#if !demoState.enabled}
	<p class="muted">Enable demo mode above to make picks.</p>
{:else if loading}
	<p class="muted">Loading Week {activeWeek} games…</p>
{:else if error}
	<p class="error" role="alert">{error}</p>
{:else}
	{#if priorScored}
		<div class="result-banner {priorScored.outcome}">
			<p class="result-title">Week {priorWeek} result</p>
			<p class="result-body">
				<span class="pick-with-logo">
					<TeamLogo teamCode={priorScored.team_id} size={28} />
					You picked <strong>{priorScored.team_abbreviation}</strong>
				</span>
				({formatWinPct(priorScored.win_pct_at_pick)})
				— {outcomeLabel(priorScored.outcome)},
				{formatPoints(priorScored.points_awarded)} pt{formatPoints(priorScored.points_awarded) === '1' ? '' : 's'}
				{#if priorScored.outcome === 'win' && priorScored.is_underdog_at_pick}
					<span class="underdawg-note">Underdawg bonus!</span>
				{/if}
			</p>
		</div>
	{/if}

	<div class="week-header">
		<h3>Week {activeWeek}</h3>
		{#if pickSubmitted}
			<span class="locked-label">Pick submitted</span>
		{:else if pickingEnabled}
			<span class="open-label">Choose a team, then submit</span>
		{/if}
	</div>

	{#if pickSubmitted && !showResults}
		<div class="locked-pick">
			<p class="pick-with-logo">
				<TeamLogo teamCode={currentPick.team_id} size={32} />
				<span>
					Your pick: <strong>{currentPick.team_abbreviation}</strong>
					({formatWinPct(currentPick.win_pct_at_pick)})
				</span>
			</p>
			<p class="muted">Time travel forward to see how you did.</p>
		</div>
	{/if}

	{#if currentScored}
		<div class="result-banner {currentScored.outcome}">
			<p class="result-title">This week's result</p>
			<p class="result-body pick-with-logo">
				<TeamLogo teamCode={currentScored.team_id} size={28} />
				<strong>{currentScored.team_abbreviation}</strong>
				— {outcomeLabel(currentScored.outcome)},
				{formatPoints(currentScored.points_awarded)} pt{formatPoints(currentScored.points_awarded) === '1' ? '' : 's'}
			</p>
		</div>
	{/if}

	{#if games.length === 0}
		<p class="muted">No games found for Week {activeWeek}.</p>
	{:else}
		{#if pickingEnabled}
			<button
				type="button"
				class="submit-pick-btn"
				disabled={!pendingPick}
				onclick={handleSubmitPick}
			>
				{#if pendingPick}
					Submit pick · {pendingPick.team_abbreviation} ({formatWinPct(pendingPick.win_pct_at_pick)})
				{:else}
					Submit pick
				{/if}
			</button>
		{/if}

		<div class="games-list">
			{#each games as game (game.id)}
				<GameCard
					{game}
					selectedTeamId={displayTeamId}
					{usedTeamIds}
					{pickingEnabled}
					{showResults}
					{underdogThreshold}
					onSelectTeam={(teamId) => handleSelectTeam(game, teamId)}
				/>
			{/each}
		</div>
	{/if}
{/if}

<style>
	.muted {
		color: var(--text-muted);
		font-size: 0.9rem;
		margin: 0;
	}

	.error {
		margin: 0;
		padding: 0.65rem 0.75rem;
		border-radius: 8px;
		background: rgba(255, 90, 90, 0.12);
		color: #ff8a8a;
		font-size: 0.875rem;
	}

	.week-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
		margin: 1rem 0 0.75rem;
	}

	.week-header h3 {
		margin: 0;
		font-size: 1.1rem;
		color: var(--text);
	}

	.open-label {
		font-size: 0.8rem;
		color: var(--accent);
		font-weight: 600;
	}

	.locked-label {
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.locked-pick {
		margin-bottom: 0.85rem;
		padding: 0.75rem 0.9rem;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: rgba(94, 224, 109, 0.06);
	}

	.locked-pick p {
		margin: 0;
		font-size: 0.9rem;
	}

	.locked-pick .muted {
		margin-top: 0.35rem;
		font-size: 0.8rem;
	}

	.result-banner {
		margin: 0.85rem 0;
		padding: 0.75rem 0.9rem;
		border-radius: 8px;
		border: 1px solid var(--border);
	}

	.result-banner.win {
		border-color: rgba(94, 224, 109, 0.35);
		background: rgba(94, 224, 109, 0.1);
	}

	.result-banner.loss {
		border-color: rgba(255, 100, 100, 0.25);
		background: rgba(255, 100, 100, 0.08);
	}

	.result-banner.tie {
		border-color: rgba(255, 193, 7, 0.3);
		background: rgba(255, 193, 7, 0.08);
	}

	.result-title {
		margin: 0 0 0.25rem;
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-muted);
	}

	.result-body {
		margin: 0;
		font-size: 0.95rem;
	}

	.pick-with-logo {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}

	.underdawg-note {
		margin-left: 0.35rem;
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--underdog);
	}

	.submit-pick-btn {
		display: block;
		width: 100%;
		margin-bottom: 0.85rem;
		padding: 0.75rem 1rem;
		border: none;
		border-radius: 10px;
		background: var(--accent);
		color: #0c0e12;
		font-size: 0.95rem;
		font-weight: 700;
		cursor: pointer;
		transition: filter 0.15s, opacity 0.15s;
	}

	.submit-pick-btn:hover:not(:disabled) {
		filter: brightness(1.08);
	}

	.submit-pick-btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.games-list {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}
</style>
