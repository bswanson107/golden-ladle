<script lang="ts">
	import TeamLogo from '$lib/components/TeamLogo.svelte';
	import { isUnderdog, formatWinPct } from '$lib/demo';
	import type { WeekGame } from '$lib/types/game';

	let {
		game,
		selectedTeamId = null,
		usedTeamIds = new Set<string>(),
		pickingEnabled = true,
		showResults = false,
		underdogThreshold = 33,
		onSelectTeam
	}: {
		game: WeekGame;
		selectedTeamId?: string | null;
		usedTeamIds?: Set<string>;
		pickingEnabled?: boolean;
		showResults?: boolean;
		underdogThreshold?: number;
		onSelectTeam?: (teamId: string) => void;
	} = $props();

	function teamState(teamId: string): 'selected' | 'disabled' | 'selectable' | 'locked' {
		if (selectedTeamId === teamId) return pickingEnabled ? 'selectable' : 'selected';
		if (!pickingEnabled) return 'locked';
		if (usedTeamIds.has(teamId)) return 'disabled';
		return 'selectable';
	}

	function handleSelect(teamId: string) {
		const state = teamState(teamId);
		if (state !== 'selectable' && state !== 'selected') return;
		onSelectTeam?.(teamId);
	}

	function scoreLine(): string | null {
		if (!showResults || game.status !== 'final') return null;
		if (game.home_score === null || game.away_score === null) return null;
		return `${game.away.abbreviation} ${game.away_score} – ${game.home_score} ${game.home.abbreviation}`;
	}

	const resultLine = $derived(scoreLine());
</script>

<article class="game-card" class:has-result={resultLine !== null}>
	{#if resultLine}
		<p class="final-score">{resultLine}</p>
	{/if}

	<div class="matchup">
		<button
			type="button"
			class="team-side away {teamState(game.away.id)}"
			class:is-picked={selectedTeamId === game.away.id}
			disabled={teamState(game.away.id) === 'locked' || teamState(game.away.id) === 'disabled'}
			onclick={() => handleSelect(game.away.id)}
		>
			<TeamLogo teamCode={game.away.id} size={56} />
			<div class="team-header">
				<span class="abbr">{game.away.abbreviation}</span>
				<span class="win-pct">{formatWinPct(game.away_win_pct)}</span>
			</div>
			<span class="team-name">{game.away.city ?? game.away.name}</span>
			{#if game.away_win_pct !== null && isUnderdog(game.away_win_pct, underdogThreshold)}
				<span class="underdawg-badge">Underdawg · 2 pts</span>
			{/if}
			{#if selectedTeamId === game.away.id}
				<span class="pick-marker">Your pick</span>
			{/if}
		</button>

		<span class="at">@</span>

		<button
			type="button"
			class="team-side home {teamState(game.home.id)}"
			class:is-picked={selectedTeamId === game.home.id}
			disabled={teamState(game.home.id) === 'locked' || teamState(game.home.id) === 'disabled'}
			onclick={() => handleSelect(game.home.id)}
		>
			<TeamLogo teamCode={game.home.id} size={56} />
			<div class="team-header">
				<span class="abbr">{game.home.abbreviation}</span>
				<span class="win-pct">{formatWinPct(game.home_win_pct)}</span>
			</div>
			<span class="team-name">{game.home.city ?? game.home.name}</span>
			{#if game.home_win_pct !== null && isUnderdog(game.home_win_pct, underdogThreshold)}
				<span class="underdawg-badge">Underdawg · 2 pts</span>
			{/if}
			{#if selectedTeamId === game.home.id}
				<span class="pick-marker">Your pick</span>
			{/if}
		</button>
	</div>
</article>

<style>
	.game-card {
		padding: 0.85rem 1rem;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--bg-elevated);
	}

	.game-card.has-result {
		border-color: rgba(94, 224, 109, 0.25);
	}

	.final-score {
		margin: 0 0 0.65rem;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-muted);
		text-align: center;
	}

	.matchup {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: stretch;
		gap: 0.5rem;
	}

	.at {
		align-self: center;
		color: var(--text-muted);
		font-size: 0.85rem;
		font-weight: 600;
	}

	.team-side {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.35rem;
		padding: 0.75rem 0.85rem;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg);
		color: var(--text);
		text-align: left;
		cursor: pointer;
		transition:
			border-color 0.15s,
			background 0.15s;
	}

	.team-side.home {
		align-items: flex-end;
		text-align: right;
	}

	.team-side.selectable:hover {
		border-color: var(--accent);
		background: rgba(94, 224, 109, 0.06);
	}

	.team-side.is-picked {
		border-color: var(--accent);
		background: rgba(94, 224, 109, 0.12);
		box-shadow: 0 0 0 1px rgba(94, 224, 109, 0.2);
	}

	.team-side.selected {
		border-color: var(--accent);
		background: rgba(94, 224, 109, 0.12);
		box-shadow: 0 0 0 1px rgba(94, 224, 109, 0.2);
	}

	.team-side.disabled,
	.team-side.locked {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.team-header {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		width: 100%;
	}

	.team-side.home .team-header {
		justify-content: flex-end;
	}

	.abbr {
		font-size: 1.1rem;
		font-weight: 700;
		letter-spacing: 0.02em;
	}

	.win-pct {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}

	.team-name {
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.underdawg-badge {
		font-size: 0.65rem;
		font-weight: 700;
		color: var(--underdog);
		padding: 0.1rem 0.35rem;
		border-radius: 4px;
		background: var(--underdog-bg);
	}

	.pick-marker {
		font-size: 0.65rem;
		font-weight: 700;
		color: var(--accent);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
</style>
