<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { useAdmin, useAuth } from '$lib/auth';
	import { isAppAdmin } from '$lib/admin';
	import DemoBanner from '$lib/components/pick/DemoBanner.svelte';
	import WeekNavigator from '$lib/components/pick/WeekNavigator.svelte';
	import PickReminderPanel from '$lib/components/league/PickReminderPanel.svelte';
	import StandingsTable from '$lib/components/league/StandingsTable.svelte';
	import PicksGrid from '$lib/components/league/PicksGrid.svelte';
	import TeamLogo from '$lib/components/TeamLogo.svelte';
	import {
		formatPoints,
		getLatestScoredPick,
		getMaxVisibleWeek,
		hasDemoPicks,
		loadDemoState,
		mergeDemoLeagueView,
		outcomeLabel,
		resetDemoPicks,
		saveDemoState,
		simulatedWeekLabel
	} from '$lib/demo';
	import { fetchWeekGames } from '$lib/games';
	import { formatPickDeadline } from '$lib/gameKickoff';
	import { getPickCtaState } from '$lib/leaguePickStatus';
	import { adminKickLeagueMember, fetchLeague } from '$lib/leagues';
	import { fetchLeaguePicks, fetchLeagueStandings } from '$lib/standings';
	import { getCurrentWeekFromDate, isDemoSeason } from '$lib/season';
	import type { DemoState } from '$lib/types/demo';
	import type { WeekGame } from '$lib/types/game';
	import type { LeagueWithRole } from '$lib/types/league';
	import type { LeaguePick, StandingRow } from '$lib/types/standings';

	const auth = useAuth();
	const admin = useAdmin();

	let league = $state<LeagueWithRole | null>(null);
	let standings = $state<StandingRow[]>([]);
	let picks = $state<LeaguePick[]>([]);
	let demoState = $state<DemoState>({ enabled: false, simulatedWeek: 1, picks: {} });
	let demoGamesByWeek = $state<Map<number, WeekGame[]>>(new Map());
	let liveWeekGames = $state<WeekGame[]>([]);
	let viewWeek = $state(1);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let copied = $state(false);
	let kickingUserId = $state<string | null>(null);
	let kickError = $state<string | null>(null);

	const leagueId = $derived($page.params.id);

	const adminKickEnabled = $derived(
		isAppAdmin(auth.user?.email) && admin.adminModeEnabled
	);

	const isDemo = $derived(league !== null && isDemoSeason(league.season_year));

	const playerDisplayName = $derived.by(() => {
		const user = auth.user;
		if (!user) return 'You';
		const fromStandings = standings.find((row) => row.user_id === user.id)?.display_name;
		if (fromStandings) return fromStandings;
		const meta = user.user_metadata?.display_name;
		if (typeof meta === 'string' && meta.trim()) return meta.trim();
		return user.email?.split('@')[0] ?? 'You';
	});

	const leagueView = $derived.by(() => {
		const user = auth.user;
		if (!user) {
			return { picks, standings, maxVisibleWeek: 18 as number | null, demoActive: false };
		}

		if (!demoState.enabled) {
			return { picks, standings, maxVisibleWeek: null, demoActive: false };
		}

		if (!isDemoSeason(league?.season_year ?? 0)) {
			return { picks, standings, maxVisibleWeek: null, demoActive: false };
		}

		return {
			...mergeDemoLeagueView(
				picks,
				standings,
				demoState,
				demoGamesByWeek,
				user.id,
				playerDisplayName
			),
			demoActive: true
		};
	});

	const latestDemoPick = $derived.by(() => {
		if (!isDemo || !demoState.enabled) return null;
		return getLatestScoredPick(demoState, demoGamesByWeek);
	});

	const userCurrentWeekPick = $derived.by(() => {
		const user = auth.user;
		if (!user || isDemo) return undefined;
		return picks.find(
			(p) => p.user_id === user.id && p.week_number === viewWeek && !p.is_missed
		);
	});

	const pickCta = $derived.by(() => {
		if (isDemo || !league) return { kind: 'hidden' as const };
		return getPickCtaState(viewWeek, liveWeekGames, userCurrentWeekPick);
	});

	function handleLiveWeekChange(week: number) {
		viewWeek = week;
	}

	function refreshDemoState() {
		const user = auth.user;
		const id = leagueId;
		if (!user || !id || !league) return;
		demoState = loadDemoState(id, user.id, league.season_year);
	}

	function persistDemoState(next: DemoState) {
		const user = auth.user;
		const id = leagueId;
		if (!user || !id) return;
		demoState = next;
		saveDemoState(id, user.id, next);
	}

	function handleDemoWeekChange(simulatedWeek: number) {
		if (!isDemo) return;
		persistDemoState({ ...demoState, simulatedWeek });
	}

	function handleResetDemo() {
		persistDemoState(resetDemoPicks(demoState));
	}

	async function reloadLeagueData() {
		const user = auth.user;
		const id = leagueId;
		if (!user || !id) return;

		const [standingsResult, picksResult] = await Promise.all([
			fetchLeagueStandings(id),
			fetchLeaguePicks(id)
		]);

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

	async function handleKickPlayer(userId: string, displayName: string) {
		const id = leagueId;
		if (!id || !adminKickEnabled) return;

		const confirmed = confirm(`Remove ${displayName} from this league?`);
		if (!confirmed) return;

		kickError = null;
		kickingUserId = userId;

		const result = await adminKickLeagueMember(id, userId);
		kickingUserId = null;

		if (result.error) {
			kickError = result.error;
			return;
		}

		standings = standings.filter((row) => row.user_id !== userId);
		picks = picks.filter((pick) => pick.user_id !== userId);

		await reloadLeagueData();
	}

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
				demoState = { enabled: false, simulatedWeek: 1, picks: {} };
			} else {
				league = leagueResult.league;
				if (!isDemoSeason(leagueResult.league.season_year)) {
					viewWeek = getCurrentWeekFromDate(
						new Date(),
						leagueResult.league.season_year
					);
				}
				demoState = loadDemoState(id, user.id, leagueResult.league.season_year);
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

	$effect(() => {
		const leagueData = league;
		const week = viewWeek;
		if (!leagueData || isDemoSeason(leagueData.season_year)) {
			liveWeekGames = [];
			return;
		}

		fetchWeekGames(leagueData.season_year, week).then((result) => {
			liveWeekGames = result.games;
		});
	});

	$effect(() => {
		const state = demoState;
		const leagueData = league;
		if (!state.enabled || !leagueData) {
			demoGamesByWeek = new Map();
			return;
		}

		const weeks = [...new Set(Object.keys(state.picks).map(Number))];
		if (weeks.length === 0) {
			demoGamesByWeek = new Map();
			return;
		}

		Promise.all(weeks.map((week) => fetchWeekGames(leagueData.season_year, week))).then(
			(results) => {
				const next = new Map<number, WeekGame[]>();
				weeks.forEach((week, index) => {
					next.set(week, results[index]?.games ?? []);
				});
				demoGamesByWeek = next;
			}
		);
	});

	afterNavigate(() => {
		refreshDemoState();
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
		{#if isDemo}
			<DemoBanner />
		{/if}

		<h1 class="page-title">{league.name}</h1>
		<p class="page-subtitle">{league.season_year} season</p>

		<nav class="league-nav" aria-label="League sections">
			<a href="{base}/league/{league.id}/rules" class="league-nav-link">Rules</a>
		</nav>

		{#if isDemo}
			<section class="card pick-cta">
				<div class="pick-cta-row">
					<div>
						<h2 class="card-title">Your pick</h2>
						<p class="muted">Preview picks with historical 2025 results.</p>
					</div>
					<a href="{base}/league/{league.id}/pick" class="btn btn-primary btn-sm">Make your pick</a>
				</div>
				<p class="demo-summary">
					Viewing {simulatedWeekLabel(demoState.simulatedWeek)}
					{#if latestDemoPick}
						<span class="demo-summary-result">
							· Latest result:
							<TeamLogo teamCode={latestDemoPick.team_id} size={24} />
							{latestDemoPick.team_abbreviation}
							({outcomeLabel(latestDemoPick.outcome)}, {formatPoints(latestDemoPick.points_awarded)} pts)
						</span>
					{/if}
				</p>
			</section>
		{:else if pickCta.kind === 'needs_pick'}
			<section class="card pick-cta pick-cta-alert">
				<div class="pick-cta-row">
					<div>
						<h2 class="card-title">Week {pickCta.week} · pick before {formatPickDeadline(pickCta.deadlineLabel)}</h2>
						<p class="muted">You haven't submitted a pick for this week yet.</p>
					</div>
					<a href="{base}/league/{league.id}/pick" class="btn btn-primary btn-sm">Make your pick →</a>
				</div>
			</section>
		{:else if pickCta.kind === 'submitted'}
			<section class="card pick-cta pick-cta-done">
				<div class="pick-cta-row">
					<div>
						<h2 class="card-title">Week {pickCta.week} pick saved ✓</h2>
						<p class="muted">
							{#if pickCta.changeable}
								You can change your pick anytime before kickoff. It's hidden from others until
								then.
							{:else if pickCta.teamAbbreviation}
								You picked <strong>{pickCta.teamAbbreviation}</strong>.
							{:else}
								Your pick is in for this week.
							{/if}
						</p>
					</div>
					{#if pickCta.changeable}
						<a href="{base}/league/{league.id}/pick" class="btn btn-ghost btn-sm">Change pick</a>
					{/if}
				</div>
			</section>
		{/if}

		{#if isDemo}
			<section class="demo-travel-wrap">
				<WeekNavigator
					viewWeek={demoState.simulatedWeek}
					onWeekChange={handleDemoWeekChange}
					label="Simulated time"
					showReset
					canReset={hasDemoPicks(demoState)}
					onReset={handleResetDemo}
				/>
			</section>
		{/if}

		{#if !isDemo}
			<section class="live-week-wrap">
				<WeekNavigator viewWeek={viewWeek} onWeekChange={handleLiveWeekChange} label="View week" />
			</section>
		{/if}

		{#if league.is_commissioner}
			<section class="card commissioner-tools">
				<div class="commissioner-tools-row">
					<div>
						<h2 class="card-title">Commissioner</h2>
						<p class="muted">Override picks, fix scores, and view sync diagnostics.</p>
					</div>
					<a href="{base}/league/{league.id}/admin" class="btn btn-ghost btn-sm">Admin tools</a>
				</div>
				{#if !isDemo}
					<PickReminderPanel
						weekNumber={viewWeek}
						standings={leagueView.standings}
						picks={leagueView.picks}
						games={liveWeekGames}
					/>
				{/if}
			</section>

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
			{#if leagueView.demoActive}
				{@const visibleThrough = getMaxVisibleWeek(demoState.simulatedWeek)}
				<p class="muted demo-view-note">
					Viewing through {simulatedWeekLabel(demoState.simulatedWeek)}
					{#if visibleThrough > 0}
						(weeks 1–{visibleThrough} only)
					{:else}
						(no completed weeks yet)
					{/if}
				</p>
			{:else}
				<p class="muted">Ranked by total points. TB = sum of picked teams' season wins (lower is better).</p>
			{/if}
			{#if kickError}
				<p class="auth-error" role="alert">{kickError}</p>
			{/if}
			{#if leagueView.standings.length === 0}
				<p class="muted">No standings yet.</p>
			{:else}
				<StandingsTable
					standings={leagueView.standings}
					currentUserId={auth.user?.id ?? null}
					adminKickEnabled={adminKickEnabled}
					commissionerId={league.commissioner_id}
					{kickingUserId}
					onKickPlayer={handleKickPlayer}
				/>
			{/if}
		</section>

		<section class="card">
			<h2 class="card-title">Weekly picks</h2>
			<p class="muted">
				{#if isDemo}
					Green = win, gray = loss, amber = tie. Gold badge "2" = underdawg win.
				{:else}
					Viewing Week {viewWeek}. Green = win, gray = loss, amber = tie.
				{/if}
			</p>
			{#if leagueView.picks.length === 0}
				<p class="muted">No picks yet.</p>
			{:else}
				<PicksGrid
					picks={leagueView.picks}
					standings={leagueView.standings}
					currentUserId={auth.user?.id ?? null}
					viewWeek={isDemo ? null : viewWeek}
				/>
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

	.pick-cta-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.commissioner-tools-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.league-nav {
		display: flex;
		gap: 0.75rem;
		margin-top: 0.5rem;
	}

	.league-nav-link {
		font-size: 0.9rem;
		color: var(--link);
		text-decoration: none;
	}

	.league-nav-link:hover {
		text-decoration: underline;
	}

	.pick-cta-alert {
		border-color: rgba(94, 224, 109, 0.35);
		background: rgba(94, 224, 109, 0.06);
	}

	.pick-cta-done {
		border-color: var(--border);
	}

	.live-week-wrap {
		margin-top: 1.25rem;
	}

	.demo-summary {
		margin: 0.75rem 0 0;
		padding-top: 0.75rem;
		border-top: 1px solid var(--border);
		font-size: 0.85rem;
		color: var(--link);
	}

	.demo-summary-result {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}

	.demo-view-note {
		color: var(--link);
	}

	.demo-travel-wrap {
		margin-top: 1.25rem;
	}
</style>
