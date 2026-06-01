<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { setContext } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import type { Session } from '@supabase/supabase-js';
	import favicon from '$lib/assets/favicon.svg';
	import { AUTH_CONTEXT_KEY, type AuthStore } from '$lib/auth';
	import { getSupabase } from '$lib/supabase';

	let { children } = $props();

	let session = $state<Session | null>(null);
	let loading = $state(true);
	let signingOut = $state(false);

	const auth: AuthStore = {
		get session() {
			return session;
		},
		get user() {
			return session?.user ?? null;
		},
		get loading() {
			return loading;
		}
	};

	setContext(AUTH_CONTEXT_KEY, auth);

	const publicRoutes = new Set(['/', '/login', '/signup']);

	onMount(() => {
		const supabase = getSupabase();

		supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
			session = initialSession;
			loading = false;
		});

		const {
			data: { subscription }
		} = supabase.auth.onAuthStateChange((_event, nextSession) => {
			session = nextSession;
			loading = false;
		});

		return () => subscription.unsubscribe();
	});

	$effect(() => {
		if (loading) return;

		// Use route id (e.g. "/login"), not pathname — on GitHub Pages the pathname
		// includes the base path ("/golden-ladle/login") and would never match.
		const routeId = $page.route.id;
		const isPublic = routeId !== null && publicRoutes.has(routeId);

		if (!auth.user && !isPublic) {
			goto(`${base}/login`);
		}
	});

	async function signOut() {
		signingOut = true;
		await getSupabase().auth.signOut();
		signingOut = false;
		goto(`${base}/`);
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="app">
	<header class="header">
		<a href="{base}/" class="brand">Golden Ladle</a>

		<nav class="nav">
			{#if auth.loading}
				<span class="nav-muted">…</span>
			{:else if auth.user}
				<a href="{base}/leagues" class="nav-link">Leagues</a>
				<span class="nav-user">{auth.user.email}</span>
				<button
					type="button"
					class="btn btn-ghost btn-sm"
					disabled={signingOut}
					onclick={signOut}
				>
					{signingOut ? 'Signing out…' : 'Sign out'}
				</button>
			{:else}
				<a href="{base}/login" class="nav-link">Sign in</a>
				<a href="{base}/signup" class="btn btn-primary btn-sm">Sign up</a>
			{/if}
		</nav>
	</header>

	<div class="content">
		{@render children()}
	</div>
</div>

<style>
	.app {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--border);
		background: var(--bg-elevated);
	}

	.brand {
		font-weight: 700;
		color: var(--accent);
		text-decoration: none;
		letter-spacing: -0.02em;
	}

	.brand:hover {
		color: var(--accent);
		filter: brightness(1.08);
	}

	.nav {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.nav-user {
		font-size: 0.85rem;
		color: var(--text-muted);
		max-width: 12rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.nav-link {
		font-size: 0.9rem;
		color: var(--text-muted);
		text-decoration: none;
	}

	.nav-link:hover {
		color: var(--text);
	}

	.nav-muted {
		color: var(--text-muted);
	}

	.btn-sm {
		padding: 0.4rem 0.75rem;
		font-size: 0.875rem;
	}

	.content {
		flex: 1;
	}
</style>
