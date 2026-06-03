<script lang="ts">
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { useAuth } from '$lib/auth';
	import DemoTimeTravel from '$lib/components/pick/DemoTimeTravel.svelte';
	import PickWeekPanel from '$lib/components/pick/PickWeekPanel.svelte';
	import { loadDemoState, resetDemoPicks, saveDemoState } from '$lib/demo';
	import { fetchLeague } from '$lib/leagues';
	import type { DemoPick, DemoState } from '$lib/types/demo';
	import type { LeagueWithRole } from '$lib/types/league';

	const auth = useAuth();

	let league = $state<LeagueWithRole | null>(null);
	let demoState = $state<DemoState>({ enabled: false, simulatedWeek: 1, picks: {} });
	let loading = $state(true);
	let error = $state<string | null>(null);

	const leagueId = $derived($page.params.id);

	$effect(() => {
		const user = auth.user;
		const id = leagueId;
		if (auth.loading || !user || !id) return;

		loading = true;
		error = null;

		fetchLeague(id, user.id).then((result) => {
			if (result.error || !result.league) {
				league = null;
				error = result.error ?? 'League not found.';
			} else {
				league = result.league;
				demoState = loadDemoState(id, user.id);
			}
			loading = false;
		});
	});

	function persistDemoState(next: DemoState) {
		const user = auth.user;
		const id = leagueId;
		if (!user || !id) return;
		demoState = next;
		saveDemoState(id, user.id, next);
	}

	function handleToggle(enabled: boolean) {
		persistDemoState({ ...demoState, enabled });
	}

	function handleWeekChange(simulatedWeek: number) {
		persistDemoState({ ...demoState, simulatedWeek });
	}

	function handleResetDemo() {
		persistDemoState(resetDemoPicks(demoState));
	}

	function handleSavePick(week: number, pick: DemoPick) {
		persistDemoState({
			...demoState,
			picks: { ...demoState.picks, [week]: pick }
		});
	}
</script>

<main class="page page-pick">
	<p class="back-link">
		<a href="{base}/league/{leagueId}">← Back to league</a>
	</p>

	{#if auth.loading || loading}
		<p class="muted">Loading…</p>
	{:else if error || !league}
		<p class="auth-error" role="alert">{error ?? 'League not found.'}</p>
	{:else}
		<h1 class="page-title">Make your pick</h1>
		<p class="page-subtitle">{league.name} · {league.season_year} season</p>

		<DemoTimeTravel
			demoState={demoState}
			onToggle={handleToggle}
			onWeekChange={handleWeekChange}
			onReset={handleResetDemo}
		/>

		<section class="pick-section">
			<PickWeekPanel
				seasonYear={league.season_year}
				demoState={demoState}
				onSavePick={handleSavePick}
			/>
		</section>
	{/if}
</main>

<style>
	.page-pick {
		max-width: 40rem;
	}

	.back-link {
		margin: 0 0 1rem;
		font-size: 0.9rem;
	}

	.muted {
		color: var(--text-muted);
		font-size: 0.9rem;
	}

	.pick-section {
		margin-top: 1.25rem;
	}
</style>
