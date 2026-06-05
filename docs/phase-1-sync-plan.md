# Phase 1: Live NFL Data Sync

## Goal

Replace the static seeded schedule with a live sync that keeps `nfl_games`,
`season_team_records`, and pick outcomes fresh throughout the 2026 season.
A **Supabase Edge Function** (`sync-nfl-data`) is the only trusted writer.
The browser calls it on page load; the service role key never leaves the server.

---

## Architecture

```
Browser (authenticated user)
  └─ supabase.functions.invoke('sync-nfl-data')
       └─ Edge Function (Deno, service role)
            ├─ Check sync_state rate limit  →  skip if < 5 min since last run
            ├─ Fetch nflverse schedule + scores CSV
            ├─ Fetch nflverse betting lines CSV (odds → win %)
            ├─ Upsert nfl_games (status, scores, winner, win %)
            ├─ Upsert season_team_records (weekly W/L totals)
            ├─ Lock win_pct_at_pick on pre-kickoff picks whose game just kicked off
            ├─ Mark missed picks (members with no pick after week's last kickoff)
            └─ Update sync_state (last_completed_at, games_updated)
```

The existing DB trigger (`on_game_status_change`) already calls
`score_picks_for_game` when `status` changes to `'final'`, so scoring is
handled automatically once the sync writes the correct status.

---

## Data Sources

### Schedule + Scores
- **URL pattern**: `https://github.com/nflverse/nflverse-data/releases/download/schedules/schedules.csv`
- Already used as the shape for `data/games_2026.csv`
- Updated by nflverse during season — usually within 30 min of final whistle
- Key columns: `game_id`, `season`, `week`, `gameday`, `gametime`, `game_type`,
  `away_team`, `home_team`, `away_score`, `home_score`, `result` (score diff),
  `winner_team` (direct field when final)

### Odds / Win %
- **URL pattern**: `https://github.com/nflverse/nflverse-data/releases/download/betting/nfl_betting_lines.csv`
- Columns include moneylines; same `americanToImpliedProb` + vig-normalisation
  already in `scripts/generate-games-migration.mjs`
- Match to `nfl_games` via `espn_event_id` = `game_id` from nflverse

### Team Records
- Derived from the scores CSV (cumulative W/L through each game's week)
- No separate data source needed

---

## New Files

```
supabase/
  functions/
    sync-nfl-data/
      index.ts          ← Edge Function HTTP handler
  migrations/
    010_sync_state.sql  ← sync_state table + RLS

src/lib/sync/
  types.ts              ← SyncResult, GameRow, OddsRow types
  nflverse.ts           ← fetch + parse both CSVs
  winPct.ts             ← americanToImpliedProb (extracted from generator script)
  diffGames.ts          ← compare API rows vs DB rows, produce upsert list
  applyUpdates.ts       ← upsert nfl_games + season_team_records via admin client
  kickoffLock.ts        ← lock win_pct_at_pick/is_underdog_at_pick at kickoff
  missedPicks.ts        ← mark missed picks after week's last game kicks off
  index.ts              ← runSync(adminClient): orchestrates all steps, returns SyncResult

scripts/
  sync-nfl-data.mjs     ← Node entry for local/GHA use (same runSync logic)
```

Frontend integration:
- `src/lib/syncGames.ts` — thin browser wrapper: calls the Edge Function, returns
  `SyncResult`, handles errors gracefully
- `PickWeekPanel.svelte` — invoke sync before loading games; refresh games after
  if `gamesUpdated > 0`
- A "Last updated X min ago" line in the sticky bar footer

---

## Task Breakdown

---

### TASK 1 — Migration 010: `sync_state` table

**File**: `supabase/migrations/010_sync_state.sql`

Create a single-row table that tracks the last sync run. The Edge Function holds
an advisory lock via this row to prevent parallel runs.

```sql
create table if not exists public.sync_state (
  key text primary key,               -- always 'nfl_games'
  last_started_at timestamptz,
  last_completed_at timestamptz,
  last_error text,
  games_updated integer not null default 0,
  odds_updated integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Seed the single row
insert into public.sync_state (key)
values ('nfl_games')
on conflict (key) do nothing;

-- Only service role can write; authenticated users can read last_completed_at
alter table public.sync_state enable row level security;

create policy "sync_state_select_authenticated"
  on public.sync_state for select
  to authenticated
  using (true);

-- No insert/update/delete for regular users (service role bypasses RLS)
```

**Acceptance**: Row `nfl_games` exists after migration; authenticated user can
select it; insert/update from anon client is rejected.

---

### TASK 2 — `src/lib/sync/types.ts`

Types shared by the Edge Function and the local script.

```ts
export type GameSyncRow = {
  espnEventId: string;
  season: number;
  week: number;
  gameday: string;       // 'YYYY-MM-DD'
  gametime: string;      // 'HH:MM' Eastern
  awayTeam: string;
  homeTeam: string;
  awayScore: number | null;
  homeScore: number | null;
  status: 'scheduled' | 'in_progress' | 'final' | 'postponed' | 'cancelled';
  winner: string | null; // team id or null
  isTie: boolean;
  awayWinPct: number | null;
  homeWinPct: number | null;
};

export type SyncResult = {
  skipped: boolean;
  inProgress: boolean;
  lastSyncAt: string | null;
  gamesUpdated: number;
  oddsUpdated: number;
  error: string | null;
};
```

---

### TASK 3 — `src/lib/sync/winPct.ts`

Extract `americanToImpliedProb` and `normalizedWinPcts` from
`scripts/generate-games-migration.mjs` into a shared ES module so both the
Edge Function and the generator can import it.

```ts
export function americanToImpliedProb(odds: number): number | null {
  if (!isFinite(odds) || odds === 0) return null;
  return odds < 0 ? -odds / (-odds + 100) : 100 / (odds + 100);
}

/** Removes vig; returns [awayPct, homePct] rounded to 2 dp, or [null,null]. */
export function normalizedWinPcts(
  awayMl: number | null,
  homeMl: number | null
): { away: number | null; home: number | null } {
  const awayRaw = awayMl !== null ? americanToImpliedProb(awayMl) : null;
  const homeRaw = homeMl !== null ? americanToImpliedProb(homeMl) : null;
  if (awayRaw === null || homeRaw === null) return { away: null, home: null };
  const total = awayRaw + homeRaw;
  return {
    away: Math.round((awayRaw / total) * 10000) / 100,
    home: Math.round((homeRaw / total) * 10000) / 100,
  };
}
```

Update `scripts/generate-games-migration.mjs` to import from this file instead
of duplicating the logic.

---

### TASK 4 — `src/lib/sync/nflverse.ts`

Fetch and parse the two nflverse CSVs. Runs in both Deno (Edge Function) and
Node (local script) — use `fetch()` only, no Node-specific APIs.

```ts
import { normalizedWinPcts } from './winPct.ts';
import type { GameSyncRow } from './types.ts';

const TEAM_MAP: Record<string, string> = { LA: 'LAR' };
function mapTeam(t: string): string { return TEAM_MAP[t] ?? t; }

const SCHEDULES_URL =
  'https://github.com/nflverse/nflverse-data/releases/download/schedules/schedules.csv';
const BETTING_URL =
  'https://github.com/nflverse/nflverse-data/releases/download/betting/nfl_betting_lines.csv';

/** Returns only regular-season rows for the given season year. */
export async function fetchNflverseGames(seasonYear: number): Promise<GameSyncRow[]>;

/** Returns moneyline map: espnEventId → { awayMl, homeMl } */
export async function fetchNflverseOdds(
  seasonYear: number
): Promise<Map<string, { awayMl: number; homeMl: number }>>;
```

Implementation notes:
- Parse CSV with a simple line-split parser (no external CSV lib — keep deps zero).
- `game_type !== 'REG'` rows are skipped (postseason, preseason).
- Status derivation:
  - Both scores present and not null → `'final'`
  - `result` column present (nflverse marks postponed games) → `'postponed'`
  - Otherwise → `'scheduled'`
- Winner: `home_score > away_score` → home team; `<` → away team; `===` → `null`
  (tie, use `isTie: true`).
- Kickoff: `gameday` + `gametime` → same `AT TIME ZONE 'America/New_York'`
  pattern as migration 007. Store as ISO string for the upsert.

---

### TASK 5 — `src/lib/sync/diffGames.ts`

Compare incoming `GameSyncRow[]` against current DB rows. Return only rows
that need an upsert (changed status, scores, odds, or kickoff).

```ts
import type { GameSyncRow } from './types.ts';

export type GameDbRow = {
  espn_event_id: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  winner_team_id: string | null;
  is_tie: boolean;
  home_win_pct: number | null;
  away_win_pct: number | null;
  kickoff_at: string;
};

export function diffGames(
  incoming: GameSyncRow[],
  current: GameDbRow[]
): { toUpsert: GameSyncRow[]; oddsChanged: number };
```

A row needs upsert if **any** of these changed: `status`, `home_score`,
`away_score`, `winner`, `isTie`, `homeWinPct`, `awayWinPct`, `kickoff_at`.

Return `oddsChanged` count separately for the `SyncResult`.

---

### TASK 6 — `src/lib/sync/applyUpdates.ts`

Write changed rows to the DB using a Supabase admin client (service role).
This module never runs in the browser — only in the Edge Function and the
local Node script.

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { GameSyncRow } from './types.ts';

/** Upsert nfl_games rows. Returns count of rows written. */
export async function upsertGames(
  adminClient: SupabaseClient,
  games: GameSyncRow[]
): Promise<number>;

/**
 * Rebuild season_team_records for the given season from the full schedule.
 * Call after upsertGames with the full incoming list (not just diff).
 */
export async function updateTeamRecords(
  adminClient: SupabaseClient,
  seasonYear: number,
  games: GameSyncRow[]
): Promise<void>;
```

Implementation notes for `upsertGames`:
- Use `.upsert(rows, { onConflict: 'espn_event_id' })` — matches the migration 007 pattern.
- Map `GameSyncRow` to DB column names (snake_case); derive `kickoff_at` as UTC
  ISO string from gameday + gametime Eastern.
- The existing `on_game_status_change` trigger fires automatically when
  `status` changes to `'final'`, calling `score_picks_for_game`. No explicit
  scoring call needed here.

Implementation notes for `updateTeamRecords`:
- Count wins/losses/ties per team from games where status = 'final'.
- Use `.upsert(records, { onConflict: 'season_year,team_id' })`.

---

### TASK 7 — `src/lib/sync/kickoffLock.ts`

For picks submitted before kickoff (the "plan ahead" 2026 feature), the rules
say win % is locked at the picked team's kickoff time. The current trigger only
snapshots at pick-submission time, not at kickoff.

After upserting games, find picks that:
- Are on a game whose `kickoff_at <= now()`
- Have `outcome = 'pending'` (not yet scored)
- Have a `win_pct_at_pick` that differs from the current game win %

Update those picks to match the current game win % (the "true" kickoff value).

```ts
export async function lockKickoffWinPcts(
  adminClient: SupabaseClient,
  seasonYear: number
): Promise<number>; // returns count updated
```

Implementation notes:
- Query picks joined to nfl_games where `kickoff_at <= now()` and
  `outcome = 'pending'` and `is_commissioner_override = false`.
- Only update `win_pct_at_pick` and `is_underdog_at_pick`; do not change
  `outcome` or `points_awarded`.
- This is idempotent — safe to call every sync run.

---

### TASK 8 — `src/lib/sync/missedPicks.ts`

After a week's **last** game kicks off, any league member with no pick for
that week gets a `missed` pick inserted (0 points, correct semantics for
standings).

```ts
export async function markMissedPicks(
  adminClient: SupabaseClient,
  seasonYear: number
): Promise<number>; // returns count inserted
```

Implementation notes:
- Find weeks where `max(kickoff_at) <= now()` (last game of week has kicked off).
- For each such week: find `league_members` in leagues for this season who have
  no active pick (`superseded_by_pick_id is null`) for that week.
- Insert a `picks` row with:
  - `outcome = 'missed'`, `points_awarded = 0`, `is_commissioner_override = false`
  - `game_id`: the last-kicking-off game of that week (pick a real game ID for
    FK constraint; use the last-kickoff game as the canonical missed-pick game)
  - `team_id`: the picked team — for missed picks use a sentinel approach: insert
    with the home team of the game; or better, add a nullable `team_id` path.

**Note**: Check whether the `picks` table constraints allow a "no real pick"
row for missed. If `team_id NOT NULL` and `no_reuse` unique index would block,
a simpler approach is a separate `missed_picks` table or a
`commissioner_override_pick` call with outcome `'missed'`. Document this and
choose the cleanest path after reading the constraint in migration 001 (see
picks table: `team_id text not null` + unique index on `(league_id, user_id,
season_year, team_id) where superseded_by_pick_id is null`). The sentinel team
approach will violate uniqueness if the same member misses two weeks with the
same game chosen. The safest approach: **add a `missed_at timestamptz` column
to picks and relax the unique index to exclude missed picks**, via a new
migration `011_missed_pick_support.sql`. Alternatively, call
`commissioner_override_pick` which bypasses the uniqueness check.

---

### TASK 9 — `src/lib/sync/index.ts`

Orchestrator that runs all steps in order and returns `SyncResult`. Works in
both Deno and Node (no runtime-specific imports).

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SyncResult } from './types.ts';
import { fetchNflverseGames, fetchNflverseOdds } from './nflverse.ts';
import { diffGames } from './diffGames.ts';
import { upsertGames, updateTeamRecords } from './applyUpdates.ts';
import { lockKickoffWinPcts } from './kickoffLock.ts';
import { markMissedPicks } from './missedPicks.ts';

export async function runSync(
  adminClient: SupabaseClient,
  seasonYear: number
): Promise<SyncResult>;
```

Steps in order:
1. Fetch nflverse schedule for `seasonYear`
2. Fetch nflverse odds for `seasonYear`
3. Merge odds into schedule rows (`normalizedWinPcts`)
4. Load current `nfl_games` rows from DB (just the diff-relevant columns)
5. Diff → get `toUpsert`
6. If `toUpsert.length > 0`: `upsertGames`, `updateTeamRecords`
7. `lockKickoffWinPcts`
8. `markMissedPicks`
9. Return `SyncResult`

---

### TASK 10 — Supabase Edge Function: `supabase/functions/sync-nfl-data/index.ts`

```ts
import { createClient } from '@supabase/supabase-js'
import { runSync } from '../../../src/lib/sync/index.ts'

const COOLDOWN_MS = 5 * 60 * 1000;   // 5 min
const LOCK_TIMEOUT_MS = 2 * 60 * 1000; // 2 min — assume stuck after this

Deno.serve(async (req) => {
  // 1. Verify JWT (Supabase verifies automatically when verify_jwt = true)

  // 2. Check rate limit / lock via sync_state
  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: state } = await adminClient
    .from('sync_state')
    .select('last_started_at, last_completed_at')
    .eq('key', 'nfl_games')
    .single();

  const now = Date.now();

  // Already completed recently — skip
  if (state?.last_completed_at) {
    const age = now - new Date(state.last_completed_at).getTime();
    if (age < COOLDOWN_MS) {
      return Response.json({
        skipped: true,
        inProgress: false,
        lastSyncAt: state.last_completed_at,
        gamesUpdated: 0,
        oddsUpdated: 0,
        error: null,
      });
    }
  }

  // In progress (and not stuck) — skip
  if (state?.last_started_at && !state?.last_completed_at) {
    const age = now - new Date(state.last_started_at).getTime();
    if (age < LOCK_TIMEOUT_MS) {
      return Response.json({ skipped: false, inProgress: true, ... });
    }
  }

  // 3. Mark started
  await adminClient.from('sync_state').update({
    last_started_at: new Date().toISOString(),
    last_completed_at: null,
    last_error: null,
  }).eq('key', 'nfl_games');

  // 4. Run sync
  try {
    const result = await runSync(adminClient, 2026);
    await adminClient.from('sync_state').update({
      last_completed_at: new Date().toISOString(),
      games_updated: result.gamesUpdated,
      odds_updated: result.oddsUpdated,
    }).eq('key', 'nfl_games');
    return Response.json(result);
  } catch (err) {
    await adminClient.from('sync_state').update({
      last_error: String(err),
      last_completed_at: new Date().toISOString(), // unblock future runs
    }).eq('key', 'nfl_games');
    return Response.json({ error: String(err) }, { status: 500 });
  }
});
```

**`supabase/functions/sync-nfl-data/deno.json`** (import map):
```json
{
  "imports": {
    "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@2"
  }
}
```

**`supabase/functions/sync-nfl-data/.env`** (not committed):
```
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_URL=https://ddgibtrznerkvtrzokvh.supabase.co
```

---

### TASK 11 — `scripts/sync-nfl-data.mjs` (local / GHA)

Node entry point for running the same sync without deploying.

```mjs
import { createClient } from '@supabase/supabase-js';
import { runSync } from '../src/lib/sync/index.ts';  // ts-node / tsx

const adminClient = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const result = await runSync(adminClient, 2026);
console.log(JSON.stringify(result, null, 2));
if (result.error) process.exitCode = 1;
```

Add to `package.json`:
```json
"sync:nfl": "node --import tsx/esm scripts/sync-nfl-data.mjs"
```

Add `tsx` to devDependencies (already a common pattern in SvelteKit projects).

Local usage:
```bash
SUPABASE_SERVICE_ROLE_KEY=... npm run sync:nfl
```

---

### TASK 12 — `src/lib/syncGames.ts` (browser wrapper)

Thin client module that invokes the Edge Function. Never contains service role.

```ts
import { getSupabase } from '$lib/supabase';
import type { SyncResult } from '$lib/sync/types';

const SYNC_FUNCTION = 'sync-nfl-data';

export async function requestGameSync(): Promise<SyncResult> {
  const supabase = getSupabase();
  const { data, error } = await supabase.functions.invoke<SyncResult>(SYNC_FUNCTION);
  if (error) {
    return {
      skipped: false,
      inProgress: false,
      lastSyncAt: null,
      gamesUpdated: 0,
      oddsUpdated: 0,
      error: error.message,
    };
  }
  return data!;
}

/** Read last sync time without triggering a sync (for display only). */
export async function getLastSyncTime(): Promise<string | null> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('sync_state')
    .select('last_completed_at')
    .eq('key', 'nfl_games')
    .single();
  return data?.last_completed_at ?? null;
}
```

---

### TASK 13 — Integrate sync into `PickWeekPanel.svelte`

**Where**: in the `$effect` that already calls `fetchWeekGames` (around line 198).

**Behavior**:
1. On mount (and when `activeWeek` changes for live mode), call `requestGameSync()`.
2. Don't block the initial game load — fire sync in parallel; if `gamesUpdated > 0`
   after it resolves, re-fetch the current week's games.
3. Show last sync time in the sticky bar: `"Odds updated X min ago"`.
4. Only invoke for `mode === 'live'` (not demo).

**Sticky bar addition** (below the pick toolbar):
```svelte
{#if mode === 'live' && lastSyncAt}
  <p class="sync-meta">Odds updated {timeAgo(lastSyncAt)}</p>
{/if}
```

Add a `timeAgo(iso: string): string` helper (e.g. "2 min ago", "just now").

New props needed: none — sync is internal to the panel.

New state:
```ts
let lastSyncAt = $state<string | null>(null);
let syncError = $state<string | null>(null);
```

---

### TASK 14 — Current week detection (replaces localStorage Week 1 default)

Currently `loadViewWeek` defaults to `1` if nothing is saved. For live mode,
new users should land on the current NFL week.

**`src/lib/season.ts`** — add:
```ts
/**
 * Given the list of games for the season, return the current active week:
 * the earliest week that has at least one unplayed scheduled game.
 * Falls back to the last week in the list.
 */
export function getCurrentWeek(games: { week_number: number; status: string }[]): number;
```

**`src/routes/league/[id]/pick/+page.svelte`** — after loading live picks,
if no saved `viewWeek` exists for this user+league, call `fetchCurrentWeek`
and default to that.

Alternative (simpler, no extra query): derive from `Date.now()` and the
hardcoded season start date (Sep 9, 2026 = Week 1). A week is ~7 days;
`Math.min(Math.max(Math.floor((now - SEASON_START_MS) / WEEK_MS) + 1, 1), 18)`.

---

### TASK 15 — Migration 011: missed pick constraint fix

**File**: `supabase/migrations/011_missed_pick_support.sql`

The `picks` table has a `NOT NULL` on `team_id` and a unique index on
`(league_id, user_id, season_year, team_id)` that would block two missed picks
(same user, same team sentinel). Fix:

**Option (recommended)**: add `is_missed boolean not null default false` to
`picks`, and exclude missed rows from the team-reuse unique index:

```sql
alter table public.picks add column if not exists is_missed boolean not null default false;

-- Drop and recreate the no-team-reuse index to exclude missed picks
drop index if exists picks_no_team_reuse_idx;
create unique index picks_no_team_reuse_idx
  on public.picks (league_id, user_id, season_year, team_id)
  where (superseded_by_pick_id is null and is_missed = false);
```

Update `missedPicks.ts` to set `is_missed = true` on inserted rows.
Update `enforce_pick_rules()` trigger (migration 009 version) to skip win-pct
and kickoff deadline checks when `is_missed = true`.

---

### TASK 16 — `package.json` + `.env.example`

Add to `package.json` scripts:
```json
"sync:nfl": "node --import tsx/esm scripts/sync-nfl-data.mjs",
"functions:deploy": "supabase functions deploy sync-nfl-data"
```

Add `tsx` to `devDependencies`:
```bash
npm install --save-dev tsx
```

Create `.env.example`:
```
# Public (already in .env)
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Server-only (never commit, only for local sync + GHA)
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

### TASK 17 — Optional GHA cron (safety net)

Add `.github/workflows/sync-nfl.yml`:

```yaml
name: Sync NFL Data

on:
  schedule:
    # Every 15 min Thu–Mon during NFL season (Sep–Jan)
    - cron: '*/15 * * * 4-1'   # Thu=4, Fri=5, Sat=6, Sun=0, Mon=1 in cron
  workflow_dispatch:             # manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run sync:nfl
        env:
          PUBLIC_SUPABASE_URL: ${{ secrets.PUBLIC_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

Note: GHA and the Edge Function both call `runSync()`. The rate-limit in
`sync_state` prevents double-work if both run within the 5-min cooldown.

---

## Execution Order for Composer

Work through tasks **in this order** (each builds on the previous):

1. **TASK 1** — `010_sync_state.sql` (apply to Supabase before anything else)
2. **TASK 15** — `011_missed_pick_support.sql` (schema change needed before write logic)
3. **TASK 2** — `src/lib/sync/types.ts`
4. **TASK 3** — `src/lib/sync/winPct.ts` + update generator script
5. **TASK 4** — `src/lib/sync/nflverse.ts`
6. **TASK 5** — `src/lib/sync/diffGames.ts`
7. **TASK 6** — `src/lib/sync/applyUpdates.ts`
8. **TASK 7** — `src/lib/sync/kickoffLock.ts`
9. **TASK 8** — `src/lib/sync/missedPicks.ts`
10. **TASK 9** — `src/lib/sync/index.ts`
11. **TASK 11** — `scripts/sync-nfl-data.mjs` + `npm run sync:nfl` + `tsx` dep
12. **TASK 10** — `supabase/functions/sync-nfl-data/index.ts`
13. **TASK 12** — `src/lib/syncGames.ts`
14. **TASK 13** — Integrate into `PickWeekPanel.svelte`
15. **TASK 14** — Current week detection in `season.ts` + pick page
16. **TASK 16** — `.env.example`, `package.json` scripts
17. **TASK 17** — GHA cron workflow (last, optional)

---

## Known Open Questions (decide before or during implementation)

| # | Question | Default recommendation |
|---|----------|----------------------|
| 1 | Does nflverse betting lines CSV have game_id matching nflverse schedules CSV? | Yes — `game_id` field is shared. Verify column name in both CSVs before TASK 4. |
| 2 | Rate limit cooldown: 5 min ok for family league? | Yes — first member opens app, syncs for everyone. |
| 3 | Season year hardcoded as `2026`? | Yes for now; parameterize later if multi-season support needed. |
| 4 | What to use as `team_id` for missed pick row? | `is_missed = true` + use game's home team; uniqueness index excludes it (TASK 15). |
| 5 | Should sync be invoked on league *standings* page too? | Yes, same call — add after TASK 13 is stable. |
| 6 | Deno import compatibility for `src/lib/sync/*.ts`? | Use only standard TS + `@supabase/supabase-js`; no SvelteKit-specific imports. `$app/*` must not appear in sync modules. |

---

## What Is Explicitly Out of Scope for Phase 1

- Commissioner override UI (existing RPC works; UI is Phase 2)
- Email/push reminders
- Postponed game repick UI
- Automated test suite
- Multi-season support (year is hardcoded to 2026)
- ESPN as data source (nflverse is sufficient; ESPN is a Phase 1.5 option if
  odds aren't fresh enough)
