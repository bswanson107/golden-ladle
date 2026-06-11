<script lang="ts">
	let {
		open = false,
		leagueName,
		seasonYear,
		threshold = 33,
		onClose
	}: {
		open?: boolean;
		leagueName: string;
		seasonYear: number;
		threshold?: number;
		onClose: () => void;
	} = $props();

	function handleBackdropClick(event: MouseEvent) {
		if (event.currentTarget === event.target) {
			onClose();
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			onClose();
		}
	}

	$effect(() => {
		if (!open) return;

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	});
</script>

{#if open}
	<div
		class="modal-backdrop"
		role="presentation"
		onclick={handleBackdropClick}
	>
		<div
			class="modal"
			role="dialog"
			aria-modal="true"
			aria-labelledby="rules-modal-title"
		>
			<header class="modal-header">
				<h2 id="rules-modal-title" class="modal-title">League rules</h2>
				<p class="modal-subtitle">{leagueName} · {seasonYear} season</p>
			</header>

			<div class="rules-body">
				<section class="rules-section">
					<h3 class="rules-heading">Scoring</h3>
					<ul class="rules-list">
						<li><strong>Win</strong> (favorite): 1 point</li>
						<li><strong>Underdog win</strong>: 2 points</li>
						<li><strong>Loss</strong>: 0 points</li>
						<li><strong>Tie</strong>: 0.5 points</li>
						<li><strong>No pick</strong> by the week's last kickoff: 0 points (counts as a loss)</li>
					</ul>
				</section>

				<section class="rules-section">
					<h3 class="rules-heading">Underdog</h3>
					<p>
						An <strong>underdog</strong> is a team with win probability of
						<strong>{threshold}% or lower</strong> at kickoff. Underdog wins earn the 2-point bonus.
					</p>
					<p class="rules-note">
						Win % is shown on each game card and snapshotted at your picked team's kickoff time.
					</p>
				</section>

				<section class="rules-section">
					<h3 class="rules-heading">Pick deadline</h3>
					<p>
						You must submit your pick <strong>before that team's game kicks off</strong> — not at
						midnight Sunday. You can plan picks early in the week and
						<strong>change them anytime before kickoff</strong>.
					</p>
				</section>

				<section class="rules-section">
					<h3 class="rules-heading">Pick secrecy</h3>
					<p>
						Your pick stays <strong>hidden</strong> from other league members until your game's
						kickoff. After kickoff, everyone can see your selection and result.
					</p>
				</section>

				<section class="rules-section">
					<h3 class="rules-heading">Team reuse</h3>
					<p>Each team can only be picked <strong>once per season</strong> by the same player.</p>
				</section>

				<section class="rules-section">
					<h3 class="rules-heading">Missed picks</h3>
					<p>
						If you don't submit a pick before the week's <strong>last game</strong> kicks off, the
						system records a missed pick automatically (0 points).
					</p>
					<p class="rules-note">The commissioner can override missed picks in exceptional cases.</p>
				</section>

				<section class="rules-section">
					<h3 class="rules-heading">Standings tiebreaker</h3>
					<p>
						Standings rank by total points. If tied, the player with the
						<strong>lower cumulative season wins</strong> of their picked teams ranks higher — rewarding
						success with weaker teams.
					</p>
				</section>

				<section class="rules-section">
					<h3 class="rules-heading">Other policies</h3>
					<ul class="rules-list">
						<li><strong>Postponed games</strong>: your original pick stands; scored when the game is played.</li>
						<li><strong>Season scope</strong>: regular season only (Weeks 1–18).</li>
						<li><strong>Entries</strong>: one entry per person per league.</li>
					</ul>
				</section>
			</div>

			<div class="modal-actions">
				<button type="button" class="btn btn-ghost btn-sm" onclick={onClose}>Close</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 100;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		background: rgba(0, 0, 0, 0.55);
	}

	.modal {
		width: min(100%, 32rem);
		max-height: min(90vh, 40rem);
		display: flex;
		flex-direction: column;
		padding: 1.25rem 1.35rem;
		border: none;
		border-radius: var(--radius);
		background: var(--surface);
		box-shadow: var(--shadow-lg);
	}

	.modal-header {
		flex-shrink: 0;
		margin-bottom: 0.75rem;
	}

	.modal-title {
		margin: 0 0 0.2rem;
		font-family: var(--font-display);
		font-size: 1.25rem;
		color: var(--text);
	}

	.modal-subtitle {
		margin: 0;
		font-size: 0.88rem;
		color: var(--text-muted);
	}

	.rules-body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding-right: 0.15rem;
	}

	.rules-section {
		margin-bottom: 1.1rem;
	}

	.rules-section:last-child {
		margin-bottom: 0;
	}

	.rules-heading {
		margin: 0 0 0.45rem;
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--text);
	}

	.rules-section p {
		margin: 0 0 0.5rem;
		font-size: 0.9rem;
		line-height: 1.5;
		color: var(--text);
	}

	.rules-section p:last-child {
		margin-bottom: 0;
	}

	.rules-note {
		color: var(--text-muted);
		font-size: 0.85rem;
	}

	.rules-list {
		margin: 0;
		padding-left: 1.25rem;
		font-size: 0.9rem;
		line-height: 1.55;
		color: var(--text);
	}

	.rules-list li {
		margin: 0.3rem 0;
	}

	.modal-actions {
		flex-shrink: 0;
		display: flex;
		justify-content: flex-end;
		margin-top: 1rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--border);
	}
</style>
