<script lang="ts">
	import TeamLogo from '$lib/components/TeamLogo.svelte';
	import GameKickoffInfo from '$lib/components/pick/GameKickoffInfo.svelte';
	import WinPctBar from '$lib/components/pick/WinPctBar.svelte';
	import { getTeamName } from '$lib/data/nflTeams';
	import { getGameKickoffInfo } from '$lib/gameKickoff';
	import { isUnderdog } from '$lib/demo';
	import type { WeekGame } from '$lib/types/game';

	let {
		game,
		selectedTeamId = null,
		teamUsageByWeek = new Map<string, number>(),
		activeWeek = 1,
		pickingEnabled = true,
		showResults = false,
		underdogThreshold = 33,
		onSelectTeam
	}: {
		game: WeekGame;
		selectedTeamId?: string | null;
		teamUsageByWeek?: Map<string, number>;
		activeWeek?: number;
		pickingEnabled?: boolean;
		showResults?: boolean;
		underdogThreshold?: number;
		onSelectTeam?: (teamId: string) => void;
	} = $props();

	const logoSize = 92;
	const kickoffInfo = $derived(getGameKickoffInfo(game.kickoff_at));

	function teamState(teamId: string): 'selected' | 'selectable' | 'locked' | 'used-elsewhere' {
		if (selectedTeamId === teamId) return pickingEnabled ? 'selectable' : 'selected';
		if (!pickingEnabled) return 'locked';
		if (teamUsageByWeek.has(teamId)) return 'used-elsewhere';
		return 'selectable';
	}

	function teamTitle(teamId: string): string | undefined {
		const usedWeek = teamUsageByWeek.get(teamId);
		if (usedWeek === undefined) return undefined;
		return `Already selected — Week ${usedWeek}`;
	}

	function displayName(teamId: string, fallbackName: string): string {
		const fromCatalog = getTeamName(teamId);
		return fromCatalog !== teamId ? fromCatalog : fallbackName;
	}

	function handleSelect(teamId: string) {
		const state = teamState(teamId);
		if (state === 'locked') return;
		onSelectTeam?.(teamId);
	}

	function scoreLine(): string | null {
		if (!showResults || game.status !== 'final') return null;
		if (game.home_score === null || game.away_score === null) return null;
		return `${displayName(game.away.id, game.away.name)} ${game.away_score} – ${game.home_score} ${displayName(game.home.id, game.home.name)}`;
	}

	const resultLine = $derived(scoreLine());
</script>

<article class="game-card {kickoffInfo.highlightClass ?? ''}" class:has-result={resultLine !== null}>
	<GameKickoffInfo kickoffAt={game.kickoff_at} />

	{#if resultLine}
		<p class="final-score">{resultLine}</p>
	{/if}

	<div class="matchup">
		<button
			type="button"
			class="team-side away {teamState(game.away.id)}"
			class:is-picked={selectedTeamId === game.away.id}
			disabled={teamState(game.away.id) === 'locked'}
			title={teamTitle(game.away.id)}
			onclick={() => handleSelect(game.away.id)}
		>
			<span class="side-label">Away</span>
			<div class="logo-wrap">
				<TeamLogo teamCode={game.away.id} size={logoSize} />
			</div>
			<span class="team-name">{displayName(game.away.id, game.away.name)}</span>
			<div class="badges">
				{#if game.away_win_pct !== null && isUnderdog(game.away_win_pct, underdogThreshold)}
					<span class="underdawg-badge">Underdawg · 2 pts</span>
				{/if}
				{#if teamUsageByWeek.has(game.away.id)}
					<span class="used-note">Week {teamUsageByWeek.get(game.away.id)}</span>
				{/if}
				{#if selectedTeamId === game.away.id}
					<span class="pick-marker">Your pick</span>
				{/if}
			</div>
		</button>

		<button
			type="button"
			class="team-side home {teamState(game.home.id)}"
			class:is-picked={selectedTeamId === game.home.id}
			disabled={teamState(game.home.id) === 'locked'}
			title={teamTitle(game.home.id)}
			onclick={() => handleSelect(game.home.id)}
		>
			<span class="side-label">Home</span>
			<div class="logo-wrap">
				<TeamLogo teamCode={game.home.id} size={logoSize} />
			</div>
			<span class="team-name">{displayName(game.home.id, game.home.name)}</span>
			<div class="badges">
				{#if game.home_win_pct !== null && isUnderdog(game.home_win_pct, underdogThreshold)}
					<span class="underdawg-badge">Underdawg · 2 pts</span>
				{/if}
				{#if teamUsageByWeek.has(game.home.id)}
					<span class="used-note">Week {teamUsageByWeek.get(game.home.id)}</span>
				{/if}
				{#if selectedTeamId === game.home.id}
					<span class="pick-marker">Your pick</span>
				{/if}
			</div>
		</button>
	</div>

	<WinPctBar
		awayTeamCode={game.away.id}
		homeTeamCode={game.home.id}
		awayWinPct={game.away_win_pct}
		homeWinPct={game.home_win_pct}
	/>
</article>

<style>
	.game-card {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		padding: 1rem 1rem 1.1rem;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--bg-elevated);
	}

	.game-card.has-result {
		border-color: rgba(94, 224, 109, 0.25);
	}

	.game-card.slot-tnf {
		border-color: rgba(0, 168, 225, 0.28);
	}

	.game-card.slot-snf {
		border-color: rgba(212, 175, 55, 0.32);
	}

	.game-card.slot-mnf {
		border-color: rgba(239, 68, 68, 0.28);
	}

	.game-card.slot-international {
		border-color: rgba(52, 211, 153, 0.28);
	}

	.game-card.slot-season-opener {
		border-color: rgba(168, 85, 247, 0.28);
	}

	.game-card.slot-thanksgiving-eve {
		border-color: rgba(251, 146, 60, 0.28);
	}

	.game-card.slot-thanksgiving {
		border-color: rgba(234, 88, 12, 0.32);
	}

	.game-card.slot-black-friday {
		border-color: rgba(148, 163, 184, 0.32);
	}

	.game-card.slot-christmas-eve {
		border-color: rgba(34, 197, 94, 0.28);
	}

	.game-card.slot-christmas {
		border-color: rgba(220, 38, 38, 0.32);
	}

	.game-card.slot-saturday {
		border-color: rgba(148, 163, 184, 0.28);
	}

	.final-score {
		margin: 0;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-muted);
		text-align: center;
	}

	.matchup {
		display: grid;
		grid-template-columns: 1fr 1fr;
		align-items: stretch;
		gap: 0.65rem;
	}

	.team-side {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		gap: 0.55rem;
		min-height: 11.5rem;
		padding: 0.85rem 0.75rem 0.9rem;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--bg);
		color: var(--text);
		text-align: center;
		cursor: pointer;
		transition:
			border-color 0.15s,
			background 0.15s,
			box-shadow 0.15s;
	}

	.team-side.selectable:hover,
	.team-side.used-elsewhere:hover {
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

	.team-side.used-elsewhere {
		border-style: dashed;
		border-color: rgba(126, 184, 255, 0.45);
	}

	.team-side.locked {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.side-label {
		font-size: 0.68rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-muted);
	}

	.logo-wrap {
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 1;
		width: 100%;
		min-height: 5.75rem;
		padding: 0.15rem 0;
	}

	.team-name {
		font-size: 0.88rem;
		font-weight: 700;
		line-height: 1.25;
		color: var(--text);
		max-width: 100%;
	}

	.badges {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		min-height: 1.1rem;
	}

	.underdawg-badge {
		font-size: 0.65rem;
		font-weight: 700;
		color: var(--underdog);
		padding: 0.1rem 0.35rem;
		border-radius: 4px;
		background: var(--underdog-bg);
	}

	.used-note {
		font-size: 0.65rem;
		font-weight: 600;
		color: var(--link);
	}

	.pick-marker {
		font-size: 0.65rem;
		font-weight: 700;
		color: var(--accent);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
</style>
