<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { useAuth } from '$lib/auth';
	import { createLeague, currentNflSeasonYear } from '$lib/leagues';

	const auth = useAuth();

	let name = $state('');
	let seasonYear = $state(currentNflSeasonYear());
	let error = $state<string | null>(null);
	let submitting = $state(false);

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (!auth.user) return;

		error = null;
		submitting = true;

		const { league, error: createError } = await createLeague(name, seasonYear);

		submitting = false;

		if (createError || !league) {
			error = createError ?? 'Could not create league.';
			return;
		}

		goto(`${base}/league/${league.id}`);
	}
</script>

<main class="page">
	<h1 class="page-title">Create league</h1>
	<p class="page-subtitle">You'll be the commissioner and can share the invite code.</p>

	<form class="auth-form" onsubmit={handleSubmit}>
		<label>
			League name
			<input
				type="text"
				name="name"
				placeholder="Geiger Family Pool"
				required
				maxlength="80"
				bind:value={name}
				disabled={submitting}
			/>
		</label>

		<label>
			Season year
			<input
				type="number"
				name="seasonYear"
				min="2020"
				max="2035"
				required
				bind:value={seasonYear}
				disabled={submitting}
			/>
		</label>

		{#if error}
			<p class="auth-error" role="alert">{error}</p>
		{/if}

		<button type="submit" class="btn btn-primary" disabled={submitting}>
			{submitting ? 'Creating…' : 'Create league'}
		</button>
	</form>

	<p class="auth-footer">
		<a href="{base}/leagues">Back to my leagues</a>
	</p>
</main>
