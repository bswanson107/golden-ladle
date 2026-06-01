<script lang="ts">
	import type { StandingRow } from '$lib/types/standings';

	let {
		standings,
		currentUserId = null
	}: {
		standings: StandingRow[];
		currentUserId?: string | null;
	} = $props();

	function formatRecord(row: StandingRow): string {
		if (row.ties > 0) {
			return `${row.wins}-${row.losses}-${row.ties}`;
		}
		return `${row.wins}-${row.losses}`;
	}
</script>

<div class="table-wrap">
	<table class="standings">
		<thead>
			<tr>
				<th scope="col">#</th>
				<th scope="col">Player</th>
				<th scope="col" class="num">Pts</th>
				<th scope="col" class="num">W-L</th>
				<th scope="col" class="num">TB</th>
			</tr>
		</thead>
		<tbody>
			{#each standings as row (row.user_id)}
				<tr
					class:leader={row.standing_rank === 1}
					class:me={currentUserId !== null && row.user_id === currentUserId}
				>
					<td class="num rank">{row.standing_rank}</td>
					<td class="name">
						{row.display_name}
						{#if row.standing_rank === 1}
							<span class="crown" aria-label="Leader">👑</span>
						{/if}
					</td>
					<td class="num points">{row.total_points.toFixed(1)}</td>
					<td class="num">{formatRecord(row)}</td>
					<td class="num tb">{row.tiebreaker_picked_team_wins}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.table-wrap {
		overflow-x: auto;
	}

	.standings {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	th,
	td {
		padding: 0.55rem 0.65rem;
		text-align: left;
		border-bottom: 1px solid var(--border);
	}

	th {
		color: var(--text-muted);
		font-weight: 600;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.num {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.rank {
		color: var(--text-muted);
		width: 2rem;
	}

	.name {
		font-weight: 500;
		min-width: 8rem;
	}

	.points {
		font-weight: 700;
		color: var(--accent);
	}

	.tb {
		color: var(--text-muted);
	}

	.leader .name {
		color: var(--accent);
	}

	.me {
		background: rgba(94, 224, 109, 0.06);
	}

	.crown {
		margin-left: 0.25rem;
	}
</style>
