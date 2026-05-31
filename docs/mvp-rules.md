# Family Survivor Pool MVP Rules

## Core League Rules

- **Team reuse:** Teams cannot be reused by the same user during the season.
- **Entries per user:** One entry per user.
- **Pick deadline:** A pick for a specific team is allowed only before that team's game kickoff.
- **Missed picks:** If a user fails to submit any pick before the final game kickoff, it counts as a loss (0 points). Commissioner can manually override if needed.
- **Pick visibility:** Picks remain hidden until the picked game has kicked off.

## Weekly Scoring

- **Win (favorite or non-underdog):** 1 point
- **Win (underdog):** 2 points
- **Loss:** 0 points
- **Game tie:** 0.5 points
- **No pick submitted by final kickoff:** 0 points

## Underdog Definition

An underdog is a team with a **win probability of 33% or lower** at kickoff (for example, `28%`).

Non-underdog (favorite) picks are teams with win probability **above 33%**.

## Win Probability Display

- Each matchup shows a simple **win %** for both teams (not point spreads).
- Win % is the source of truth for underdog bonus scoring and UI.
- If the data feed does not provide win % directly, derive it from available odds (e.g., moneyline or spread) using a single documented conversion formula applied consistently.

## Standings

- Standings are based on total accumulated points.
- Higher total points rank above lower total points.
- If players are tied on points, apply this tiebreaker:
  - Lower cumulative total of picked teams' season wins ranks higher.
  - This rewards players who succeeded with weaker teams.

## Data Timing Rules

- Win % values are snapshotted at the selected team's kickoff time.
- Scoring uses the snapshotted win % value, not later live updates.
- Underdog status for a pick is determined from that kickoff snapshot (`win_pct <= 33`).

## Suggested Commissioner Controls (MVP-safe)

- Manually override a missed-pick outcome in exceptional cases.
- Manually correct a game result if an upstream API issue occurs.
- Recompute a week's scores after corrections.

## Suggested Rule Clarifications

To reduce disputes, lock these in before launch:

- **Postponed game policy:** If a picked game is postponed beyond the week window, either:
  - automatically allow repick before new kickoff, or
  - keep original pick and score when played.
- **Win % source of truth:** Declare the exact feed/provider and field (or conversion from odds) used for win %.
- **Season scope:** Specify regular season only vs including playoffs.

## MVP Recommendation

For fastest, least-ambiguous launch, use:

- Tie game = 0.5 points
- Postponed game = user may repick until rescheduled kickoff
- Scoring source = one consistent win % snapshot at kickoff (derive from odds only if needed)
- Underdog threshold = win % ≤ 33%
- Season scope = regular season only
- Standings tiebreaker = lower cumulative picked-team season wins
