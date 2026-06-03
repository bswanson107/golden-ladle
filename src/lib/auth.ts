import { getContext } from 'svelte';
import type { Session, User } from '@supabase/supabase-js';

export const AUTH_CONTEXT_KEY = Symbol('auth');
export const ADMIN_CONTEXT_KEY = Symbol('admin');

export type AuthStore = {
	get session(): Session | null;
	get user(): User | null;
	get loading(): boolean;
};

export type AdminStore = {
	get adminModeEnabled(): boolean;
	setAdminMode(enabled: boolean): void;
};

export function useAuth(): AuthStore {
	const auth = getContext<AuthStore>(AUTH_CONTEXT_KEY);
	if (!auth) {
		throw new Error('useAuth() must be used inside the root layout');
	}
	return auth;
}

export function useAdmin(): AdminStore {
	const admin = getContext<AdminStore>(ADMIN_CONTEXT_KEY);
	if (!admin) {
		throw new Error('useAdmin() must be used inside the root layout');
	}
	return admin;
}
