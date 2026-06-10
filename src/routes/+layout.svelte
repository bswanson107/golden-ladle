<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { setContext } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import type { Session } from '@supabase/supabase-js';
	import favicon from '$lib/assets/favicon.svg';
	import { AUTH_CONTEXT_KEY, ADMIN_CONTEXT_KEY, type AuthStore, type AdminStore } from '$lib/auth';
	import { getSupabase } from '$lib/supabase';
	import { isAppAdmin, loadAdminMode, saveAdminMode } from '$lib/admin';

	let { children } = $props();

	let session = $state<Session | null>(null);
	let loading = $state(true);
	let signingOut = $state(false);
	let adminModeEnabled = $state(false);

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

	const admin: AdminStore = {
		get adminModeEnabled() {
			return adminModeEnabled;
		},
		setAdminMode(enabled: boolean) {
			adminModeEnabled = enabled;
			saveAdminMode(enabled);
		}
	};

	setContext(AUTH_CONTEXT_KEY, auth);
	setContext(ADMIN_CONTEXT_KEY, admin);

	const showAdminToggle = $derived(
		!auth.loading && auth.user !== null && isAppAdmin(auth.user.email)
	);

	const publicRoutes = new Set(['/', '/login', '/signup', '/design']);

	onMount(() => {
		adminModeEnabled = loadAdminMode();

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
				<a href="{base}/account" class="nav-link">Account</a>
				<a href="{base}/design" class="nav-link">Design demo</a>
				{#if showAdminToggle}
					<label class="admin-toggle">
						<input
							type="checkbox"
							checked={adminModeEnabled}
							onchange={(e) =>
								admin.setAdminMode((e.currentTarget as HTMLInputElement).checked)}
						/>
						<span>Admin</span>
					</label>
				{/if}
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

	.admin-toggle {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--text-muted);
		cursor: pointer;
		user-select: none;
	}

	.admin-toggle input {
		width: 0.9rem;
		height: 0.9rem;
		accent-color: #e89898;
	}

	.admin-toggle:has(input:checked) {
		color: #e89898;
	}

	.btn-sm {
		padding: 0.4rem 0.75rem;
		font-size: 0.875rem;
	}

	.content {
		flex: 1;
	}
</style>
