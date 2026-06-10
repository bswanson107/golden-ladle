<script lang="ts">
	import TeamLogo from '$lib/components/TeamLogo.svelte';
	import type { LeaguePick, PickOutcome } from '$lib/types/standings';

	type CellDisplay = 'empty' | 'hidden' | 'visible' | 'missed';

	let {
		picks,
		standings = [],
		currentUserId = null,
		viewWeek = null
	}: {
		picks: LeaguePick[];
		standings?: { user_id: string; display_name: string; standing_rank: number }[];
		currentUserId?: string | null;
		viewWeek?: number | null;
	} = $props();

	const now = Date.now();

	const rankByUser = $derived(new Map(standings.map((s) => [s.user_id, s.standing_rank])));

	const weeks = $derived.by(() => {
		const allWeeks = [...new Set(picks.map((p) => p.week_number))].sort((a, b) => b - a);
		if (viewWeek !== null) {
			return allWeeks.includes(viewWeek) ? [viewWeek] : viewWeek > 0 ? [viewWeek] : allWeeks;
		}
		return allWeeks;
	});

	const players = $derived.by(() => {
		const byUser = new Map<string, { name: string; picks: Map<number, LeaguePick> }>();

		for (const row of standings) {
			byUser.set(row.user_id, { name: row.display_name, picks: new Map() });
		}

		for (const pick of picks) {
			let entry = byUser.get(pick.user_id);
			if (!entry) {
				entry = { name: pick.display_name, picks: new Map() };
				byUser.set(pick.user_id, entry);
			}
			entry.picks.set(pick.week_number, pick);
		}

		return [...byUser.entries()]
			.map(([userId, data]) => ({ userId, ...data }))
			.sort((a, b) => {
				const rankA = rankByUser.get(a.userId) ?? 999;
				const rankB = rankByUser.get(b.userId) ?? 999;
				return rankA - rankB || a.name.localeCompare(b.name);
			});
	});

	function outcomeClass(outcome: PickOutcome): string {
		switch (outcome) {
			case 'win':
				return 'win';
			case 'loss':
			case 'missed':
				return 'loss';
			case 'tie':
				return 'tie';
			default:
				return 'pending';
		}
	}

	function cellDisplay(pick: LeaguePick | undefined, userId: string): CellDisplay {
		if (!pick) return 'empty';
		if (pick.is_missed || pick.outcome === 'missed') return 'missed';

		const kickedOff = new Date(pick.kickoff_at).getTime() <= now;
		if (!kickedOff && userId === currentUserId) return 'hidden';
		if (!kickedOff) return 'empty';

		return 'visible';
	}
</script>

<div class="grid-wrap">
	<table class="picks-grid">
		<thead>
			<tr>
				<th scope="col" class="sticky player-col">Player</th>
				{#each weeks as week (week)}
					<th scope="col" class="week-col">Wk {week}</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each players as player (player.userId)}
				<tr>
					<th scope="row" class="sticky player-col">{player.name}</th>
					{#each weeks as week (week)}
						{@const pick = player.picks.get(week)}
						{@const display = cellDisplay(pick, player.userId)}
						<td
							class="pick-cell {pick && display === 'visible'
								? outcomeClass(pick.outcome)
								: display}"
						>
							{#if display === 'hidden'}
								<span class="hidden-pick" title="Pick saved — hidden from others until kickoff">🔒</span>
							{:else if display === 'missed'}
								<span class="missed-label" title="Missed pick">missed</span>
							{:else if display === 'visible' && pick}
								<span class="team-pick">
									<TeamLogo teamCode={pick.team_id} size={24} tile={false} />
									<span class="team">{pick.team_abbreviation}</span>
								</span>
								{#if pick.outcome === 'win' && pick.is_underdog_at_pick}
									<span class="underdawg" title="Underdawg win (2 pts)">2</span>
								{/if}
								{#if pick.is_commissioner_override}
									<span class="override-badge" title="Commissioner override">✎</span>
								{/if}
							{/if}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<p class="grid-legend muted">
	🔒 = your pick saved (hidden from others until kickoff) · empty = no pick yet ·
	<span class="missed-label inline">missed</span> = no pick before deadline
</p>

<style>
	.grid-wrap {
		overflow-x: auto;
		max-width: 100%;
		border: 1px solid var(--border);
		border-radius: 8px;
	}

	.picks-grid {
		border-collapse: collapse;
		font-size: 0.8rem;
		min-width: max-content;
	}

	th,
	td {
		padding: 0.45rem 0.5rem;
		border-bottom: 1px solid var(--border);
		border-right: 1px solid var(--border);
		text-align: center;
		white-space: nowrap;
	}

	th:last-child,
	td:last-child {
		border-right: none;
	}

	thead th {
		background: var(--bg-elevated);
		color: var(--text-muted);
		font-weight: 600;
		font-size: 0.7rem;
	}

	.sticky {
		position: sticky;
		left: 0;
		z-index: 1;
		background: var(--bg-elevated);
	}

	.player-col {
		text-align: left;
		min-width: 6.5rem;
		max-width: 8rem;
		font-weight: 500;
		color: var(--text);
	}

	.week-col {
		min-width: 3rem;
	}

	.pick-cell {
		font-variant-numeric: tabular-nums;
	}

	.team-pick {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		vertical-align: middle;
	}

	.pick-cell.win {
		background: rgba(94, 224, 109, 0.12);
		color: var(--accent);
	}

	.pick-cell.win .team {
		font-weight: 700;
	}

	.pick-cell.loss,
	.pick-cell.missed {
		color: var(--text-muted);
	}

	.pick-cell.tie {
		background: rgba(255, 193, 7, 0.1);
		color: #e6b800;
	}

	.pick-cell.pending {
		color: var(--text-muted);
	}

	.pick-cell.hidden,
	.pick-cell.locked {
		color: var(--text-muted);
	}

	.hidden-pick {
		font-size: 0.85rem;
		opacity: 0.85;
	}

	.missed-label {
		font-size: 0.68rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: #c97878;
	}

	.missed-label.inline {
		font-size: inherit;
		text-transform: none;
		letter-spacing: normal;
	}

	.underdawg {
		display: inline-block;
		margin-left: 0.15rem;
		font-size: 0.65rem;
		font-weight: 700;
		padding: 0.05rem 0.25rem;
		border-radius: 4px;
		background: var(--underdog-bg);
		color: var(--underdog);
		vertical-align: super;
	}

	.override-badge {
		margin-left: 0.15rem;
		font-size: 0.7rem;
		color: #d4a843;
		vertical-align: super;
	}

	.grid-legend {
		margin: 0.65rem 0 0;
		font-size: 0.78rem;
		line-height: 1.4;
	}
</style>
