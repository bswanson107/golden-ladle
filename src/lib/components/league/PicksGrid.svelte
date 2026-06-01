<script lang="ts">
	import type { LeaguePick, PickOutcome } from '$lib/types/standings';

	let {
		picks,
		standings = []
	}: { picks: LeaguePick[]; standings?: { user_id: string; standing_rank: number }[] } = $props();

	const rankByUser = $derived(new Map(standings.map((s) => [s.user_id, s.standing_rank])));

	const weeks = $derived(
		[...new Set(picks.map((p) => p.week_number))].sort((a, b) => b - a)
	);

	const players = $derived.by(() => {
		const byUser = new Map<string, { name: string; picks: Map<number, LeaguePick> }>();
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
				return 'loss';
			case 'tie':
				return 'tie';
			case 'missed':
				return 'missed';
			default:
				return 'pending';
		}
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
						<td class="pick-cell {pick ? outcomeClass(pick.outcome) : 'empty'}">
							{#if pick}
								<span class="team">{pick.team_abbreviation}</span>
								{#if pick.outcome === 'win' && pick.is_underdog_at_pick}
									<span class="underdog" title="Underdog win (2 pts)">2</span>
								{:else if pick.outcome === 'missed'}
									<span class="missed-label" title="Missed pick">—</span>
								{/if}
							{/if}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>

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

	.pick-cell.win {
		background: rgba(94, 224, 109, 0.12);
		color: var(--accent);
	}

	.pick-cell.win .team {
		font-weight: 700;
	}

	.pick-cell.loss {
		color: var(--text-muted);
	}

	.pick-cell.tie {
		background: rgba(255, 193, 7, 0.1);
		color: #e6b800;
	}

	.pick-cell.missed {
		background: rgba(255, 100, 100, 0.08);
		color: #c97070;
	}

	.pick-cell.pending {
		color: var(--text-muted);
	}

	.underdog {
		display: inline-block;
		margin-left: 0.15rem;
		font-size: 0.65rem;
		font-weight: 700;
		padding: 0.05rem 0.25rem;
		border-radius: 4px;
		background: rgba(94, 224, 109, 0.25);
		color: var(--accent);
		vertical-align: super;
	}

	.missed-label {
		display: block;
		font-size: 0.65rem;
		color: #c97070;
	}
</style>
