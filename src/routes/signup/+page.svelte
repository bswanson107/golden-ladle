<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { useAuth } from '$lib/auth';
	import { getSupabase } from '$lib/supabase';

	const auth = useAuth();

	let email = $state('');
	let password = $state('');
	let displayName = $state('');
	let error = $state<string | null>(null);
	let message = $state<string | null>(null);
	let submitting = $state(false);

	$effect(() => {
		if (!auth.loading && auth.user) {
			goto(`${base}/leagues`);
		}
	});

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		error = null;
		message = null;
		submitting = true;

		const { data, error: signUpError } = await getSupabase().auth.signUp({
			email: email.trim(),
			password,
			options: {
				data: {
					display_name: displayName.trim() || undefined
				}
			}
		});

		submitting = false;

		if (signUpError) {
			error = signUpError.message;
			return;
		}

		if (data.session) {
			goto(`${base}/leagues`);
			return;
		}

		message =
			'Account created. Check your email to confirm, then sign in.';
	}
</script>

<main class="page">
	<h1 class="page-title">Create account</h1>
	<p class="page-subtitle">Join the family pool</p>

	{#if auth.loading}
		<p class="page-subtitle">Checking session…</p>
	{:else}
		<form class="auth-form" onsubmit={handleSubmit}>
			<label>
				Display name
				<input
					type="text"
					name="displayName"
					autocomplete="name"
					placeholder="Optional"
					bind:value={displayName}
					disabled={submitting}
				/>
			</label>

			<label>
				Email
				<input
					type="email"
					name="email"
					autocomplete="email"
					required
					bind:value={email}
					disabled={submitting}
				/>
			</label>

			<label>
				Password
				<input
					type="password"
					name="password"
					autocomplete="new-password"
					required
					minlength="6"
					bind:value={password}
					disabled={submitting}
				/>
			</label>

			{#if error}
				<p class="auth-error" role="alert">{error}</p>
			{/if}

			{#if message}
				<p class="auth-message" role="status">{message}</p>
			{/if}

			<button type="submit" class="btn btn-primary" disabled={submitting}>
				{submitting ? 'Creating account…' : 'Create account'}
			</button>
		</form>

		<p class="auth-footer">
			Already have an account? <a href="{base}/login">Sign in</a>
		</p>
	{/if}
</main>

<style>
	.auth-message {
		margin: 0;
		padding: 0.65rem 0.75rem;
		border-radius: var(--radius);
		background: var(--win-muted);
		color: var(--win-bg);
		font-size: 0.875rem;
		box-shadow: var(--shadow-sm);
	}
</style>
