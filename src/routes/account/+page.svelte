<script lang="ts">
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { useAuth } from '$lib/auth';
	import { fetchProfile, updateDisplayName } from '$lib/profile';

	const auth = useAuth();

	let displayName = $state('');
	let loading = $state(true);
	let saving = $state(false);
	let error = $state<string | null>(null);
	let success = $state<string | null>(null);

	$effect(() => {
		const user = auth.user;
		if (auth.loading || !user) return;

		loading = true;
		error = null;

		fetchProfile(user.id).then((result) => {
			if (result.error) {
				error = result.error;
				displayName = user.email?.split('@')[0] ?? '';
			} else {
				displayName =
					result.displayName?.trim() ||
					(typeof user.user_metadata?.display_name === 'string'
						? user.user_metadata.display_name
						: '') ||
					user.email?.split('@')[0] ||
					'';
			}
			loading = false;
		});
	});

	async function handleSave(event: SubmitEvent) {
		event.preventDefault();
		const user = auth.user;
		if (!user) return;

		saving = true;
		error = null;
		success = null;

		const result = await updateDisplayName(user.id, displayName);
		saving = false;

		if (result.error) {
			error = result.error;
			return;
		}

		success = 'Display name saved.';
	}
</script>

<main class="page page-account">
	<p class="back-link">
		<a href="{base}/leagues">← My leagues</a>
	</p>

	<h1 class="page-title">Account</h1>
	<p class="page-subtitle">How your name appears in standings and the picks grid.</p>

	{#if auth.loading || loading}
		<p class="muted">Loading…</p>
	{:else if !auth.user}
		<p class="auth-error" role="alert">Sign in to edit your profile.</p>
	{:else}
		<section class="card">
			<form class="account-form" onsubmit={handleSave}>
				<label for="display-name">Display name</label>
				<input
					id="display-name"
					type="text"
					bind:value={displayName}
					maxlength="40"
					autocomplete="nickname"
					disabled={saving}
					required
				/>
				<p class="hint muted">Family members see this name instead of your email prefix.</p>

				{#if error}
					<p class="auth-error" role="alert">{error}</p>
				{/if}
				{#if success}
					<p class="success" role="status">{success}</p>
				{/if}

				<button type="submit" class="btn btn-primary" disabled={saving}>
					{saving ? 'Saving…' : 'Save'}
				</button>
			</form>
		</section>

		<p class="email-note muted">Signed in as {auth.user.email}</p>
	{/if}
</main>

<style>
	.page-account {
		max-width: 28rem;
	}

	.back-link {
		margin: 0 0 1rem;
		font-size: 0.9rem;
	}

	.muted {
		color: var(--text-muted);
		font-size: 0.9rem;
	}

	.card {
		margin-top: 1.25rem;
		padding: 1.1rem 1.25rem;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--bg-elevated);
	}

	.account-form {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.account-form label {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-muted);
	}

	.account-form input {
		padding: 0.55rem 0.65rem;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg);
		color: var(--text);
		font-size: 1rem;
	}

	.hint {
		margin: 0;
	}

	.success {
		margin: 0;
		padding: 0.5rem 0.65rem;
		border-radius: 8px;
		background: rgba(100, 200, 120, 0.1);
		border: 1px solid rgba(100, 200, 120, 0.35);
		color: #8fd4a0;
		font-size: 0.9rem;
	}

	.email-note {
		margin-top: 1rem;
	}
</style>
