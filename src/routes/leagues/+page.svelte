<script lang="ts">
	import { base } from '$app/paths';
	import { useAuth } from '$lib/auth';
	import { fetchMyLeagues } from '$lib/leagues';
	import type { LeagueWithRole } from '$lib/types/league';

	const auth = useAuth();

	let leagues = $state<LeagueWithRole[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	$effect(() => {
		const user = auth.user;
		if (auth.loading) return;

		if (!user) {
			loading = false;
			return;
		}

		loading = true;
		fetchMyLeagues(user.id).then((result) => {
			leagues = result.leagues;
			error = result.error;
			loading = false;
		});
	});
</script>

<main class="page page-wide">
	<div class="page-header">
		<div>
			<h1 class="page-title">My leagues</h1>
			<p class="page-subtitle">Create a pool or join with an invite code.</p>
		</div>
	</div>

	<div class="actions">
		<a href="{base}/leagues/create" class="btn btn-primary">Create league</a>
		<a href="{base}/leagues/join" class="btn btn-ghost">Join league</a>
	</div>

	{#if auth.loading || loading}
		<p class="muted">Loading leagues…</p>
	{:else if error}
		<p class="auth-error" role="alert">{error}</p>
	{:else if leagues.length === 0}
		<div class="empty-card">
			<p>No leagues yet.</p>
			<p class="muted">Create one for the family or ask for an invite code.</p>
		</div>
	{:else}
		<ul class="league-list">
			{#each leagues as league (league.id)}
				<li>
					<a href="{base}/league/{league.id}" class="league-card">
						<div class="league-card-main">
							<span class="league-name">{league.name}</span>
							<span class="league-meta">{league.season_year} season</span>
						</div>
						{#if league.is_commissioner}
							<span class="badge">Commissioner</span>
						{/if}
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</main>

<style>
	.page-header {
		margin-bottom: 0.5rem;
	}

	.page-header .page-subtitle {
		margin-bottom: 0;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin: 1.25rem 0 1.5rem;
	}

	.muted {
		color: var(--text-muted);
		font-size: 0.9rem;
	}

	.empty-card {
		padding: 1.25rem;
		border: 1px dashed var(--border);
		border-radius: 12px;
		background: var(--bg-elevated);
	}

	.empty-card p {
		margin: 0 0 0.35rem;
	}

	.league-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.league-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem 1.1rem;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--bg-elevated);
		text-decoration: none;
		color: inherit;
		transition: border-color 0.15s;
	}

	.league-card:hover {
		border-color: var(--accent);
	}

	.league-card-main {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.league-name {
		font-weight: 600;
		color: var(--text);
	}

	.league-meta {
		font-size: 0.85rem;
		color: var(--text-muted);
	}

	.badge {
		font-size: 0.75rem;
		font-weight: 600;
		padding: 0.25rem 0.5rem;
		border-radius: 6px;
		background: rgba(94, 224, 109, 0.15);
		color: var(--accent);
		white-space: nowrap;
	}
</style>
