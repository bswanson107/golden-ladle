# Phase 2: Commissioner Admin UI

## Goal

Give the league commissioner in-app tools to handle the situations that Phase 1
automation cannot cover: missed picks that deserve a mulligan, upstream data
errors that need a manual score fix, and visibility into sync health when
something goes wrong. All writes go through existing RPCs (`commissioner_override_pick`,
`score_picks_for_game`) — no new privileged DB functions are needed. The UI
simply surfaces what the database already supports.

---

## Architecture

```
Commissioner (authenticated, is_league_commissioner = true)
  └─ /league/[id]/admin  ← new route, gated by is_league_commissioner
       ├─ Sync Status panel    →  read sync_state (already has RLS for authenticated)
       ├─ Picks panel          →  supabase.rpc('commissioner_override_pick', ...)
       └─ Scoring panel        →  supabase.rpc('score_picks_for_game', ...)
```

The `is_league_commissioner` helper already exists in the DB
(`public.is_league_commissioner(league_id)`). The override RPC checks it
server-side; the UI just needs to hide/disable controls for non-commissioners
and surface a "you are not the commissioner" message if someone navigates there
directly.

---

## Scope

| Task | Description |
|------|-------------|
| **TASK 1** | Migration: `update_game_status` RPC to manually mark a game final |
| **TASK 2** | `src/lib/commissioner.ts` — client wrappers for all commissioner RPCs |
| **TASK 3** | `/league/[id]/admin/+page.svelte` — route + layout shell |
| **TASK 4** | Sync Status panel |
| **TASK 5** | Picks Override panel |
| **TASK 6** | Game Scoring panel |
| **TASK 7** | Navigation link from league page (commissioner only) |

---

## New Files

```
supabase/
  migrations/
    012_commissioner_update_game.sql  ← RPC to manually set game status/scores

src/lib/
  commissioner.ts                    ← typed client wrappers

src/routes/league/[id]/admin/
  +page.svelte                       ← commissioner admin page
  +page.ts                           ← load league + guard
```

---

## Task Breakdown

---

### TASK 1 — Migration 012: `update_game_status` RPC

**File**: `supabase/migrations/012_commissioner_update_game.sql`

`score_picks_for_game` already re-scores a game when called, but the DB trigger
only fires on status transitions written by the sync. A commissioner needs to
manually mark a game `'final'` with the correct scores when nflverse is wrong
or delayed, then re-score.

```sql
create or replace function public.update_game_status(
  p_game_id uuid,
  p_status text,
  p_home_score integer default null,
  p_away_score integer default null,
  p_winner_team_id uuid default null,
  p_is_tie boolean default false
)
returns public.nfl_games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.nfl_games;
begin
  -- Only app admins (or commissioners in the league's scope) should call this.
  -- For simplicity in Phase 2, gate on is_app_admin via a separate check or
  -- handle in the RLS layer; Phase 2 gates by app-admin in the UI and relies on
  -- security definer to bypass RLS for the update.
  select * into v_game from public.nfl_games where id = p_game_id;
  if not found then
    raise exception 'Game not found';
  end if;

  update public.nfl_games
  set
    status       = p_status::public.game_status,
    home_score   = coalesce(p_home_score, home_score),
    away_score   = coalesce(p_away_score, away_score),
    winner_team_id = coalesce(p_winner_team_id, winner_team_id),
    is_tie       = p_is_tie,
    updated_at   = now()
  where id = p_game_id
  returning * into v_game;

  -- If newly final, trigger scoring
  if p_status = 'final' then
    perform public.score_picks_for_game(p_game_id);
  end if;

  return v_game;
end;
$$;

grant execute on function public.update_game_status(uuid, text, integer, integer, uuid, boolean)
  to authenticated;
```

**Note on access control**: In Phase 2, this RPC is exposed to `authenticated`
but the UI only shows it to users where `is_league_commissioner(league_id)` is
true. If tighter enforcement is needed, add a commissioner check inside the
function body (same pattern as `commissioner_override_pick`).

**Acceptance**: Commissioner can call the RPC; it updates the game row; if
`p_status = 'final'`, picks for that game are scored immediately.

---

### TASK 2 — `src/lib/commissioner.ts`

Thin typed wrappers over the three commissioner RPCs, plus a helper to load
the data needed by the admin page.

```ts
import { getSupabase } from '$lib/supabase';
import type { SyncState } from '$lib/types/sync';
import type { LeaguePick } from '$lib/types/standings';
import type { WeekGame } from '$lib/types/game';

/** Read sync_state row (RLS: authenticated can select). */
export async function getSyncState(): Promise<SyncState | null> {
  const { data } = await getSupabase()
    .from('sync_state')
    .select('*')
    .eq('key', 'nfl_games')
    .single();
  return data ?? null;
}

/** Override a single pick's outcome and points. */
export async function overridePick(
  pickId: string,
  outcome: 'win' | 'loss' | 'tie' | 'missed',
  points: number,
  notes?: string
): Promise<{ error: string | null }> {
  const { error } = await getSupabase().rpc('commissioner_override_pick', {
    p_pick_id: pickId,
    p_outcome: outcome,
    p_points: points,
    p_notes: notes ?? null,
  });
  return { error: error?.message ?? null };
}

/** Re-score all pending picks for a game (game must already be status='final'). */
export async function rescoreGame(gameId: string): Promise<{ count: number; error: string | null }> {
  const { data, error } = await getSupabase().rpc('score_picks_for_game', {
    p_game_id: gameId,
  });
  return { count: data ?? 0, error: error?.message ?? null };
}

/** Manually set game status/scores, then score if final. */
export async function updateGameStatus(
  gameId: string,
  status: 'final' | 'scheduled' | 'postponed',
  opts?: { homeScore?: number; awayScore?: number; winnerTeamId?: string; isTie?: boolean }
): Promise<{ error: string | null }> {
  const { error } = await getSupabase().rpc('update_game_status', {
    p_game_id: gameId,
    p_status: status,
    p_home_score: opts?.homeScore ?? null,
    p_away_score: opts?.awayScore ?? null,
    p_winner_team_id: opts?.winnerTeamId ?? null,
    p_is_tie: opts?.isTie ?? false,
  });
  return { error: error?.message ?? null };
}

/** Fetch all picks for a league, including overridden and missed. */
export async function fetchLeaguePicksAdmin(leagueId: string): Promise<LeaguePick[]> {
  const { data } = await getSupabase()
    .from('picks')
    .select(`
      id, user_id, game_id, team_id, outcome, points_awarded,
      is_commissioner_override, is_missed, override_notes,
      week_number, season_year,
      profiles ( display_name ),
      nfl_games ( week_number, kickoff_at, home_team_id, away_team_id,
                  home_score, away_score, status )
    `)
    .eq('league_id', leagueId)
    .is('superseded_by_pick_id', null)
    .order('week_number')
    .order('created_at');
  return (data ?? []) as LeaguePick[];
}

/** Fetch games for the current season (for the game scoring panel). */
export async function fetchGamesForAdmin(
  seasonYear: number,
  weekNumber?: number
): Promise<WeekGame[]> {
  let query = getSupabase()
    .from('nfl_games')
    .select('id, week_number, kickoff_at, status, home_score, away_score, home_team_id, away_team_id')
    .eq('season_year', seasonYear)
    .order('kickoff_at');
  if (weekNumber !== undefined) {
    query = query.eq('week_number', weekNumber);
  }
  const { data } = await query;
  return (data ?? []) as WeekGame[];
}
```

**SyncState type** — add to `src/lib/types/sync.ts` (new file):

```ts
export type SyncState = {
  key: string;
  last_started_at: string | null;
  last_completed_at: string | null;
  last_error: string | null;
  games_updated: number;
  odds_updated: number;
  updated_at: string;
};
```

---

### TASK 3 — Route shell: `src/routes/league/[id]/admin/`

**`+page.ts`**

Load the league and verify the current user is commissioner. Redirect to the
league page if not.

```ts
import { redirect } from '@sveltejs/kit';
import { browser } from '$app/environment';
import { fetchLeague } from '$lib/leagues';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, parent }) => {
  const { league } = await parent().catch(() => ({ league: null }));
  // Rely on league data already loaded by parent, or fetch here
  const leagueData = league ?? (browser ? await fetchLeague(params.id) : null);

  // Guard: non-commissioner sees the league page instead
  if (leagueData && leagueData.commissioner_id !== leagueData.viewer_user_id) {
    redirect(302, `/league/${params.id}`);
  }

  return { leagueId: params.id, league: leagueData };
};
```

**Note**: `fetchLeague` already returns a `LeagueWithRole` that includes
`commissioner_id`. Use `auth.user?.id === league.commissioner_id` in the
component for the UI gate.

---

### TASK 4 — Sync Status panel

Part of `+page.svelte`. Shows the current `sync_state` row with human-readable
status and any last error.

**Data displayed**:
- Last completed sync: `formatSyncTimeAgo(syncState.last_completed_at)` (reuse
  the helper already in `src/lib/syncGames.ts`)
- Games updated in last run: `syncState.games_updated`
- Odds updated in last run: `syncState.odds_updated`
- Last error (if any): `syncState.last_error` in a red highlighted box

**No actions in Phase 2** — sync is triggered from the pick page or GHA.
A "Trigger sync now" button is Phase 2.5 (just call `requestGameSync()` from
`src/lib/syncGames.ts`, which already exists, and ignore the cooldown by
adding a `force=true` query param to the Edge Function — defer to Phase 3).

```svelte
{#if syncState}
  <section class="admin-panel">
    <h3>Sync Status</h3>
    <dl>
      <dt>Last synced</dt>
      <dd>{formatSyncTimeAgo(syncState.last_completed_at) ?? 'never'}</dd>
      <dt>Games updated</dt>
      <dd>{syncState.games_updated}</dd>
      <dt>Odds updated</dt>
      <dd>{syncState.odds_updated}</dd>
    </dl>
    {#if syncState.last_error}
      <p class="sync-error">Last error: {syncState.last_error}</p>
    {/if}
  </section>
{/if}
```

---

### TASK 5 — Picks Override panel

Let the commissioner browse picks by week and override outcome/points for any
pick. The most common use case is correcting a missed pick to `'loss'` with
`0 pts` (which is the default — so mostly used when the reverse is true:
granting a pick that was incorrectly auto-missed).

**UI flow**:
1. Week selector (reuse `WeekNavigator`)
2. Table of picks for that week: player name, team picked, current outcome,
   current points, override flag
3. Each row has an **Override** button that opens an inline form:
   - Outcome dropdown: `pending | win | loss | tie | missed`
   - Points input (numeric, 0–2)
   - Notes textarea (optional)
   - Confirm / Cancel
4. On confirm: call `overridePick(pickId, outcome, points, notes)` from
   `src/lib/commissioner.ts`; refresh the picks list on success

**Key details**:
- Only show picks where `superseded_by_pick_id is null` (active picks only)
- Highlight rows where `is_commissioner_override = true` (already overridden)
  and rows where `is_missed = true`
- Show a confirmation before applying any change

**Acceptance**: Commissioner can change a `missed` pick to `loss/0` or
`win/1`; the change is reflected immediately in standings (the `league_standings`
view aggregates `picks.points_awarded`).

---

### TASK 6 — Game Scoring panel

Let the commissioner manually mark a game final (with scores and winner) and
optionally re-run scoring for a game where something went wrong.

**UI flow**:
1. Week selector
2. List of games for that week: `status`, kickoff time, scores, home/away teams
3. For each game:
   - **Mark Final** button (only shown when `status !== 'final'`) → opens
     inline form: home score, away score; commissioner confirms; calls
     `updateGameStatus(gameId, 'final', { homeScore, awayScore, ... })`
   - **Re-score picks** button (always visible for final games) → calls
     `rescoreGame(gameId)`; shows count of picks updated

**Acceptance**: Marking a game final fires `score_picks_for_game` inside the
RPC; standings update immediately. Re-score is idempotent (already-scored picks
with `is_commissioner_override = false` are updated; overridden picks are left
alone).

---

### TASK 7 — Navigation link on league page

Add an **Admin** tab/link to `src/routes/league/[id]/+page.svelte` that only
appears when `auth.user?.id === league?.commissioner_id`.

```svelte
{#if league && auth.user?.id === league.commissioner_id}
  <a href="{base}/league/{leagueId}/admin" class="admin-link">
    Commissioner Admin
  </a>
{/if}
```

Place it near the existing invite link or as a separate tab alongside
Standings / Picks Grid.

---

## Known Open Questions

| # | Question | Recommendation |
|---|----------|----------------|
| 1 | Should `update_game_status` be commissioner-only (per league) or app-admin-only? | Commissioner-only is cleaner; add `is_league_commissioner` check inside the RPC matching the `commissioner_override_pick` pattern. Defer to Task 1 implementation. |
| 2 | Can a commissioner override a pick for *another* league? | No — `commissioner_override_pick` already checks `is_league_commissioner(v_pick.league_id)`. No extra work needed. |
| 3 | Should the admin route guard be server-side (`+page.server.ts`) or client-side? | Client-side redirect is fine for Phase 2 (all data is RLS-protected on the server). Upgrade to server-side guard if SEO or deep-link security becomes a concern. |
| 4 | "Trigger sync now" button bypassing the 5-min cooldown? | Defer to Phase 2.5: add `?force=true` query param to the Edge Function and check it inside the function after verifying the caller is authenticated. |

---

## What Is Explicitly Out of Scope for Phase 2

- Email reminders to players
- Postponed-game repick UI
- Bulk import / export of picks
- App-admin superuser panel (separate from league commissioner)
- "Trigger sync now" button (defer — requires Edge Function change)

---

## Execution Order

```
TASK 1  →  apply 012_commissioner_update_game.sql in Supabase SQL Editor
TASK 2  →  src/lib/commissioner.ts + src/lib/types/sync.ts
TASK 3  →  route shell (+page.ts, +page.svelte skeleton)
TASK 4  →  Sync Status panel (read-only, safe to ship first)
TASK 5  →  Picks Override panel (highest commissioner value)
TASK 6  →  Game Scoring panel
TASK 7  →  Nav link on league page
```
