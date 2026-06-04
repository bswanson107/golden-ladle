<script lang="ts">
	import { getGameKickoffInfo } from '$lib/gameKickoff';

	let { kickoffAt }: { kickoffAt: string } = $props();

	const info = $derived(getGameKickoffInfo(kickoffAt));
</script>

<div
	class="kickoff {info.highlightClass ?? ''}"
	class:highlighted={info.badges.length > 0}
>
	{#each info.badges as badge (badge.id)}
		<span class="slot-badge slot-{badge.id}" title={badge.label}>{badge.short}</span>
	{/each}
	<time class="kickoff-time" datetime={kickoffAt}>{info.formatted}</time>
</div>

<style>
	.kickoff {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-wrap: wrap;
		gap: 0.45rem;
		padding: 0.45rem 0.65rem;
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid transparent;
	}

	.kickoff.highlighted {
		padding: 0.5rem 0.7rem;
	}

	.kickoff.slot-tnf {
		border-color: rgba(0, 168, 225, 0.35);
		background: rgba(0, 168, 225, 0.08);
	}

	.kickoff.slot-snf {
		border-color: rgba(212, 175, 55, 0.4);
		background: rgba(212, 175, 55, 0.08);
	}

	.kickoff.slot-mnf {
		border-color: rgba(239, 68, 68, 0.35);
		background: rgba(239, 68, 68, 0.08);
	}

	.kickoff.slot-international {
		border-color: rgba(52, 211, 153, 0.35);
		background: rgba(52, 211, 153, 0.08);
	}

	.kickoff.slot-season-opener {
		border-color: rgba(168, 85, 247, 0.35);
		background: rgba(168, 85, 247, 0.08);
	}

	.kickoff.slot-thanksgiving-eve {
		border-color: rgba(251, 146, 60, 0.35);
		background: rgba(251, 146, 60, 0.08);
	}

	.kickoff.slot-thanksgiving {
		border-color: rgba(234, 88, 12, 0.4);
		background: rgba(234, 88, 12, 0.1);
	}

	.kickoff.slot-black-friday {
		border-color: rgba(30, 30, 30, 0.5);
		background: rgba(255, 255, 255, 0.06);
	}

	.kickoff.slot-christmas-eve {
		border-color: rgba(34, 197, 94, 0.35);
		background: rgba(34, 197, 94, 0.08);
	}

	.kickoff.slot-christmas {
		border-color: rgba(220, 38, 38, 0.4);
		background: rgba(220, 38, 38, 0.1);
	}

	.kickoff.slot-saturday {
		border-color: rgba(148, 163, 184, 0.35);
		background: rgba(148, 163, 184, 0.08);
	}

	.kickoff-time {
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}

	.kickoff.highlighted .kickoff-time {
		color: var(--text);
	}

	.slot-badge {
		display: inline-flex;
		align-items: center;
		padding: 0.18rem 0.5rem;
		border-radius: 999px;
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		border: 1px solid transparent;
	}

	.slot-tnf {
		color: #7dd3fc;
		background: rgba(0, 168, 225, 0.18);
		border-color: rgba(0, 168, 225, 0.45);
	}

	.slot-snf {
		color: #f5d76e;
		background: rgba(212, 175, 55, 0.16);
		border-color: rgba(212, 175, 55, 0.45);
	}

	.slot-mnf {
		color: #fca5a5;
		background: rgba(239, 68, 68, 0.16);
		border-color: rgba(239, 68, 68, 0.45);
	}

	.slot-international {
		color: #86efac;
		background: rgba(52, 211, 153, 0.16);
		border-color: rgba(52, 211, 153, 0.45);
	}

	.slot-season-opener {
		color: #d8b4fe;
		background: rgba(168, 85, 247, 0.18);
		border-color: rgba(168, 85, 247, 0.45);
	}

	.slot-thanksgiving-eve {
		color: #fdba74;
		background: rgba(251, 146, 60, 0.16);
		border-color: rgba(251, 146, 60, 0.45);
	}

	.slot-thanksgiving {
		color: #fdba74;
		background: rgba(234, 88, 12, 0.18);
		border-color: rgba(234, 88, 12, 0.5);
	}

	.slot-black-friday {
		color: #e2e8f0;
		background: rgba(15, 23, 42, 0.55);
		border-color: rgba(148, 163, 184, 0.45);
	}

	.slot-christmas-eve {
		color: #86efac;
		background: rgba(34, 197, 94, 0.16);
		border-color: rgba(34, 197, 94, 0.45);
	}

	.slot-christmas {
		color: #fca5a5;
		background: rgba(220, 38, 38, 0.18);
		border-color: rgba(220, 38, 38, 0.5);
	}

	.slot-saturday {
		color: #cbd5e1;
		background: rgba(148, 163, 184, 0.16);
		border-color: rgba(148, 163, 184, 0.45);
	}
</style>
