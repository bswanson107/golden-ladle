<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { useAuth } from '$lib/auth';

	const auth = useAuth();

	$effect(() => {
		if (!auth.loading && auth.user) {
			goto(`${base}/leagues`);
		}
	});
</script>

<main class="page">
	<h1 class="page-title">Golden Ladle</h1>

	{#if auth.loading}
		<p class="page-subtitle">Checking session…</p>
	{:else if !auth.user}
		<p class="page-subtitle">Family NFL survivor pool</p>

		<div class="actions">
			<a href="{base}/login" class="btn btn-primary">Sign in</a>
			<a href="{base}/signup" class="btn btn-ghost">Create account</a>
		</div>
	{/if}
</main>

<style>
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}
</style>
