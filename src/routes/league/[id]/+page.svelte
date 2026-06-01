<script lang="ts">
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { useAuth } from '$lib/auth';
	import { fetchLeague } from '$lib/leagues';
	import { fetchLeaguePicks, fetchLeagueStandings } from '$lib/standings';
	import StandingsTable from '$lib/components/league/StandingsTable.svelte';
	import PicksGrid from '$lib/components/league/PicksGrid.svelte';
	import type { LeagueWithRole } from '$lib/types/league';
	import type { LeaguePick, StandingRow } from '$lib/types/standings';

	const auth = useAuth();

	let league = $state<LeagueWithRole | null>(null);
	let standings = $state<StandingRow[]>([]);
	let picks = $state<LeaguePick[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let copied = $state(false);

	const leagueId = $derived($page.params.id);

	$effect(() => {
		const user = auth.user;
		const id = leagueId;
		if (auth.loading || !user || !id) return;

		loading = true;
		error = null;

		Promise.all([
			fetchLeague(id, user.id),
			fetchLeagueStandings(id),
			fetchLeaguePicks(id)
		]).then(([leagueResult, standingsResult, picksResult]) => {
			if (leagueResult.error || !leagueResult.league) {
				league = null;
				error = leagueResult.error ?? 'League not found.';
				standings = [];
				picks = [];
			} else {
				league = leagueResult.league;
				if (standingsResult.error) {
					error = standingsResult.error;
					standings = [];
				} else {
					standings = standingsResult.standings;
				}
				if (picksResult.error && !error) {
					error = picksResult.error;
					picks = [];
				} else if (!picksResult.error) {
					picks = picksResult.picks;
				}
			}
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

<main class="page page-league">
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
			<h2 class="card-title">Standings</h2>
			<p class="muted">Ranked by total points. TB = sum of picked teams' season wins (lower is better).</p>
			{#if standings.length === 0}
				<p class="muted">No standings yet.</p>
			{:else}
				<StandingsTable standings={standings} currentUserId={auth.user?.id ?? null} />
			{/if}
		</section>

		<section class="card">
			<h2 class="card-title">Weekly picks</h2>
			<p class="muted">Green = win, gray = loss, amber = tie, red = missed. Badge "2" = underdog win.</p>
			{#if picks.length === 0}
				<p class="muted">No picks yet.</p>
			{:else}
				<PicksGrid {picks} {standings} />
			{/if}
		</section>
	{/if}
</main>

<style>
	.page-league {
		max-width: 56rem;
	}

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
</style>
