<script lang="ts">
	import TeamLogo from '$lib/components/TeamLogo.svelte';
	import { NFL_TEAM_CODES, getTeamName } from '$lib/data/nflTeams';
</script>

<div class="gallery">
	{#each NFL_TEAM_CODES as code (code)}
		<article class="team-card">
			<TeamLogo teamCode={code} size={56} />
			<p class="team-name">{getTeamName(code)}</p>
			<p class="team-code">{code}</p>
		</article>
	{/each}
</div>

<style>
	.gallery {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(7.5rem, 1fr));
		gap: 0.75rem;
	}

	.team-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 0.85rem 0.5rem;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--bg-elevated);
		text-align: center;
	}

	.team-name {
		margin: 0;
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--text);
		line-height: 1.25;
	}

	.team-code {
		margin: 0;
		font-size: 0.65rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		color: var(--text-muted);
	}
</style>
