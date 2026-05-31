<script lang="ts">
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { useAuth } from '$lib/auth';
	import { fetchLeague } from '$lib/leagues';
	import type { LeagueWithRole } from '$lib/types/league';

	const auth = useAuth();

	let league = $state<LeagueWithRole | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let copied = $state(false);

	const leagueId = $derived($page.params.id);

	$effect(() => {
		const user = auth.user;
		const id = leagueId;
		if (auth.loading || !user || !id) return;

		loading = true;
		fetchLeague(id, user.id).then((result) => {
			league = result.league;
			error = result.error;
			loading = false;
		});
	});

	async function copyInviteCode() {
		if (!league) return;
		try {
			await navigator.clipboard.writeText(league.invite_code);
			copied = true;
			setTimeout(() => {
				copied = false;
			}, 2000);
		} catch {
			// fallback: user can select manually
		}
	}
</script>

<main class="page page-wide">
	<p class="back-link">
		<a href="{base}/leagues">← My leagues</a>
	</p>

	{#if auth.loading || loading}
		<p class="muted">Loading league…</p>
	{:else if error || !league}
		<p class="auth-error" role="alert">{error ?? 'League not found.'}</p>
	{:else}
		<h1 class="page-title">{league.name}</h1>
		<p class="page-subtitle">{league.season_year} season</p>

		{#if league.is_commissioner}
			<section class="card">
				<h2 class="card-title">Invite family</h2>
				<p class="muted">Share this code so others can join.</p>
				<div class="invite-row">
					<code class="invite-code">{league.invite_code}</code>
					<button type="button" class="btn btn-ghost btn-sm" onclick={copyInviteCode}>
						{copied ? 'Copied!' : 'Copy'}
					</button>
				</div>
			</section>
		{/if}

		<section class="card">
			<h2 class="card-title">Coming soon</h2>
			<ul class="coming-soon">
				<li>Weekly picks with win %</li>
				<li>Standings &amp; tiebreaker</li>
				<li>Commissioner tools</li>
			</ul>
		</section>
	{/if}
</main>

<style>
	.back-link {
		margin: 0 0 1rem;
		font-size: 0.9rem;
	}

	.muted {
		color: var(--text-muted);
		font-size: 0.9rem;
		margin: 0 0 0.75rem;
	}

	.card {
		margin-top: 1.25rem;
		padding: 1.1rem 1.25rem;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--bg-elevated);
	}

	.card-title {
		margin: 0 0 0.35rem;
		font-size: 1rem;
		color: var(--text);
	}

	.invite-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-top: 0.75rem;
	}

	.invite-code {
		font-size: 1.25rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		color: var(--accent);
		padding: 0.5rem 0.75rem;
		border-radius: 8px;
		background: rgba(94, 224, 109, 0.1);
	}

	.coming-soon {
		margin: 0.5rem 0 0;
		padding-left: 1.2rem;
		color: var(--text-muted);
		font-size: 0.9rem;
	}

	.coming-soon li {
		margin-bottom: 0.35rem;
	}
</style>
