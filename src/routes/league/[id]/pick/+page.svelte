<script lang="ts">
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { useAuth } from '$lib/auth';
	import DemoBanner from '$lib/components/pick/DemoBanner.svelte';
	import PickWeekPanel from '$lib/components/pick/PickWeekPanel.svelte';
	import { hasDemoPicks, loadDemoState, resetDemoPicks, saveDemoState } from '$lib/demo';
	import { fetchLeague } from '$lib/leagues';
	import { loadViewWeek, saveViewWeek } from '$lib/pickView';
	import { fetchUserLeaguePicks, picksByWeek, saveLeaguePick, type UserLeaguePick } from '$lib/picks';
	import { isDemoSeason } from '$lib/season';
	import { fetchLeaguePicks, fetchLeaguePickSubmissions, fetchLeagueStandings, type PickSubmissionsByCell } from '$lib/standings';
	import { syncSeasonIndicatorForLeague } from '$lib/seasonIndicatorStore.svelte';
	import type { DemoPick, DemoState } from '$lib/types/demo';
	import type { LeagueWithRole } from '$lib/types/league';
	import type { LeaguePick, StandingRow } from '$lib/types/standings';

	const auth = useAuth();

	let league = $state<LeagueWithRole | null>(null);
	let demoState = $state<DemoState>({ enabled: false, simulatedWeek: 1, picks: {} });
	let viewWeek = $state(1);
	let userPicks = $state<UserLeaguePick[]>([]);
	let leaguePicks = $state<LeaguePick[]>([]);
	let standings = $state<StandingRow[]>([]);
	let pickSubmissions = $state<PickSubmissionsByCell>({});
	let pickSubmissionsError = $state<string | null>(null);
	let loading = $state(true);
	let saving = $state(false);
	let error = $state<string | null>(null);
	let saveError = $state<string | null>(null);

	const leagueId = $derived($page.params.id);
	const isDemo = $derived(league !== null && isDemoSeason(league.season_year));
	const userPicksByWeek = $derived(picksByWeek(userPicks));

	$effect(() => {
		const leagueData = league;
		if (!leagueData) return;

		if (isDemo) {
			syncSeasonIndicatorForLeague(leagueData.season_year, demoState.simulatedWeek);
		} else {
			syncSeasonIndicatorForLeague(leagueData.season_year);
		}
	});

	$effect(() => {
		const user = auth.user;
		const id = leagueId;
		if (auth.loading || !user || !id) return;

		loading = true;
		error = null;

		fetchLeague(id, user.id).then(async (result) => {
			if (result.error || !result.league) {
				league = null;
				error = result.error ?? 'League not found.';
				userPicks = [];
				loading = false;
				return;
			}

			league = result.league;

			if (isDemoSeason(result.league.season_year)) {
				demoState = loadDemoState(id, user.id, result.league.season_year);
				viewWeek = demoState.simulatedWeek;
				userPicks = [];
				leaguePicks = [];
				standings = [];
			} else {
				const loadedViewWeek = loadViewWeek(id, user.id, result.league.season_year);
				viewWeek = loadedViewWeek;
				demoState = loadDemoState(id, user.id, result.league.season_year);
				const [picksResult, leaguePicksResult, standingsResult, submissionsResult] =
					await Promise.all([
						fetchUserLeaguePicks(id, user.id),
						fetchLeaguePicks(id),
						fetchLeagueStandings(id),
						fetchLeaguePickSubmissions(id)
					]);
				if (picksResult.error) {
					error = picksResult.error;
					userPicks = [];
				} else {
					userPicks = picksResult.picks;
				}
				if (leaguePicksResult.error && !error) {
					error = leaguePicksResult.error;
					leaguePicks = [];
				} else if (!leaguePicksResult.error) {
					leaguePicks = leaguePicksResult.picks;
				}
				if (standingsResult.error && !error) {
					error = standingsResult.error;
					standings = [];
				} else if (!standingsResult.error) {
					standings = standingsResult.standings;
				}
				if (submissionsResult.error) {
					pickSubmissionsError = submissionsResult.error;
					pickSubmissions = {};
				} else {
					pickSubmissionsError = null;
					pickSubmissions = submissionsResult.byCell;
				}
			}

			loading = false;
		});
	});

	async function reloadLeaguePickData() {
		const user = auth.user;
		const id = leagueId;
		if (!user || !id) return;

		const [picksResult, leaguePicksResult, submissionsResult] = await Promise.all([
			fetchUserLeaguePicks(id, user.id),
			fetchLeaguePicks(id),
			fetchLeaguePickSubmissions(id)
		]);

		if (!picksResult.error) {
			userPicks = picksResult.picks;
		}
		if (!leaguePicksResult.error) {
			leaguePicks = leaguePicksResult.picks;
		}
		if (submissionsResult.error) {
			pickSubmissionsError = submissionsResult.error;
		} else {
			pickSubmissionsError = null;
			pickSubmissions = submissionsResult.byCell;
		}
	}

	async function reloadUserPicks() {
		const user = auth.user;
		const id = leagueId;
		if (!user || !id) return;

		await reloadLeaguePickData();
	}

	function persistDemoState(next: DemoState) {
		const user = auth.user;
		const id = leagueId;
		if (!user || !id) return;
		demoState = next;
		saveDemoState(id, user.id, next);
	}

	function handleWeekChange(week: number) {
		const user = auth.user;
		const id = leagueId;
		if (!user || !id || !league) return;

		if (isDemoSeason(league.season_year)) {
			persistDemoState({ ...demoState, simulatedWeek: week });
			viewWeek = week;
		} else {
			viewWeek = week;
			saveViewWeek(id, user.id, week);
		}
	}

	function handleResetDemo() {
		persistDemoState(resetDemoPicks(demoState));
	}

	function handleSaveDemoPick(week: number, pick: DemoPick, options?: { clearWeek?: number }) {
		const nextPicks = { ...demoState.picks, [week]: pick };
		if (options?.clearWeek !== undefined) {
			delete nextPicks[options.clearWeek];
		}
		persistDemoState({ ...demoState, picks: nextPicks });
	}

	async function handleSaveLivePick(week: number, pick: DemoPick, options?: { clearWeek?: number }) {
		const id = leagueId;
		const user = auth.user;
		if (!id || !user) return;

		saveError = null;
		saving = true;

		const existingPickId = userPicksByWeek.get(week)?.id ?? null;
		const clearWeekPickId =
			options?.clearWeek !== undefined
				? (userPicksByWeek.get(options.clearWeek)?.id ?? null)
				: null;

		const result = await saveLeaguePick({
			leagueId: id,
			week,
			gameId: pick.game_id,
			teamId: pick.team_id,
			userId: user.id,
			existingPickId,
			clearWeekPickId
		});

		saving = false;

		if (result.error) {
			saveError = result.error;
			return;
		}

		await reloadUserPicks();
	}
</script>

<main class="page page-pick">
	<div class="back-nav">
		<a href="{base}/league/{leagueId}" class="btn btn-ghost btn-sm">← Back to league</a>
	</div>

	{#if auth.loading || loading}
		<p class="muted">Loading…</p>
	{:else if error || !league}
		<p class="auth-error" role="alert">{error ?? 'League not found.'}</p>
	{:else}
		{#if isDemo}
			<DemoBanner />
		{/if}

		<h1 class="page-title">Make your pick</h1>
		<p class="page-subtitle">{league.name} · {league.season_year} season</p>

		{#if saveError}
			<p class="auth-error pick-error" role="alert">{saveError}</p>
		{/if}

		{#if pickSubmissionsError}
			<p class="auth-error pick-error" role="alert">
				Could not load league pick status: {pickSubmissionsError}
			</p>
		{/if}

		<section class="pick-section">
			<PickWeekPanel
				mode={isDemo ? 'demo' : 'live'}
				seasonYear={league.season_year}
				viewWeek={isDemo ? demoState.simulatedWeek : viewWeek}
				onWeekChange={handleWeekChange}
				weekNavLabel={isDemo ? 'Simulated time' : 'View week'}
				showWeekReset={isDemo}
				canWeekReset={hasDemoPicks(demoState)}
				onWeekReset={isDemo ? handleResetDemo : undefined}
				demoState={isDemo ? demoState : null}
				{userPicksByWeek}
				leaguePicks={isDemo ? [] : leaguePicks}
				standings={isDemo ? [] : standings}
				pickSubmissions={isDemo ? {} : pickSubmissions}
				currentUserId={auth.user?.id ?? null}
				{saving}
				onSavePick={isDemo ? handleSaveDemoPick : handleSaveLivePick}
			/>
		</section>
	{/if}
</main>

<style>
	.page-pick {
		max-width: 40rem;
	}

	.muted {
		color: var(--text-muted);
		font-size: 0.9rem;
	}

	.pick-section {
		margin-top: 0.75rem;
	}

	.pick-error {
		margin-top: 1rem;
	}
</style>
