<script lang="ts">
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { useAuth } from '$lib/auth';
	import { fetchLeague } from '$lib/leagues';

	const auth = useAuth();

	let league = $state<Awaited<ReturnType<typeof fetchLeague>>['league']>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	const leagueId = $derived($page.params.id);
	const threshold = $derived(
		league?.underdog_threshold_pct != null
			? Math.round(Number(league.underdog_threshold_pct))
			: 33
	);

	$effect(() => {
		const user = auth.user;
		const id = leagueId;
		if (auth.loading || !user || !id) return;

		loading = true;
		fetchLeague(id, user.id).then((result) => {
			league = result.league;
			error = result.error ?? (result.league ? null : 'League not found.');
			loading = false;
		});
	});
</script>

<main class="page page-rules">
	<div class="back-nav">
		<a href="{base}/league/{leagueId}" class="btn btn-ghost btn-sm">← Back to league</a>
	</div>

	{#if auth.loading || loading}
		<p class="muted">Loading rules…</p>
	{:else if error || !league}
		<p class="auth-error" role="alert">{error ?? 'League not found.'}</p>
	{:else}
		<h1 class="page-title">League rules</h1>
		<p class="page-subtitle">{league.name} · {league.season_year} season</p>

		<section class="card">
			<h2 class="section-title">Scoring</h2>
			<ul class="rules-list">
				<li><strong>Win</strong> (favorite): 1 point</li>
				<li><strong>Underdog win</strong>: 2 points</li>
				<li><strong>Loss</strong>: 0 points</li>
				<li><strong>Tie</strong>: 0.5 points</li>
				<li><strong>No pick</strong> by the week's last kickoff: 0 points (counts as a loss)</li>
			</ul>
		</section>

		<section class="card">
			<h2 class="section-title">Underdog</h2>
			<p>
				An <strong>underdog</strong> is a team with win probability of
				<strong>{threshold}% or lower</strong> at kickoff. Underdog wins earn the 2-point bonus.
			</p>
			<p class="muted">
				Win % is shown on each game card and snapshotted at your picked team's kickoff time.
			</p>
		</section>

		<section class="card">
			<h2 class="section-title">Pick deadline</h2>
			<p>
				You must submit your pick <strong>before that team's game kicks off</strong> — not at
				midnight Sunday. You can plan picks early in the week and <strong>change them anytime
				before kickoff</strong>.
			</p>
		</section>

		<section class="card">
			<h2 class="section-title">Pick secrecy</h2>
			<p>
				Your pick stays <strong>hidden</strong> from other league members until your game's
				kickoff. After kickoff, everyone can see your selection and result.
			</p>
		</section>

		<section class="card">
			<h2 class="section-title">Team reuse</h2>
			<p>Each team can only be picked <strong>once per season</strong> by the same player.</p>
		</section>

		<section class="card">
			<h2 class="section-title">Missed picks</h2>
			<p>
				If you don't submit a pick before the week's <strong>last game</strong> kicks off, the
				system records a missed pick automatically (0 points).
			</p>
			<p class="muted">The commissioner can override missed picks in exceptional cases.</p>
		</section>

		<section class="card">
			<h2 class="section-title">Standings tiebreaker</h2>
			<p>
				Standings rank by total points. If tied, the player with the
				<strong>lower cumulative season wins</strong> of their picked teams ranks higher — rewarding
				success with weaker teams.
			</p>
		</section>

		<details class="card details-card">
			<summary class="section-title">Other policies</summary>
			<ul class="rules-list">
				<li><strong>Postponed games</strong>: your original pick stands; scored when the game is played.</li>
				<li><strong>Season scope</strong>: regular season only (Weeks 1–18).</li>
				<li><strong>Entries</strong>: one entry per person per league.</li>
			</ul>
		</details>
	{/if}
</main>

<style>
	.page-rules {
		max-width: 40rem;
	}

	.muted {
		color: var(--text-muted);
		font-size: 0.9rem;
	}

	.card {
		margin-top: 1rem;
		padding: 1.1rem 1.25rem;
		border: none;
		border-radius: var(--radius);
		background: var(--surface);
		box-shadow: var(--shadow-sm);
	}

	.card p {
		margin: 0 0 0.65rem;
		line-height: 1.5;
	}

	.card p:last-child {
		margin-bottom: 0;
	}

	.section-title {
		margin: 0 0 0.65rem;
		font-size: 1rem;
		color: var(--text);
	}

	.rules-list {
		margin: 0;
		padding-left: 1.25rem;
		line-height: 1.6;
	}

	.rules-list li {
		margin: 0.35rem 0;
	}

	.details-card summary {
		cursor: pointer;
		list-style: none;
	}

	.details-card summary::-webkit-details-marker {
		display: none;
	}

	.details-card[open] summary {
		margin-bottom: 0.65rem;
	}
</style>
