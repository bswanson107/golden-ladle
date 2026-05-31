import { getContext } from 'svelte';
import type { Session, User } from '@supabase/supabase-js';

export const AUTH_CONTEXT_KEY = Symbol('auth');

export type AuthStore = {
	get session(): Session | null;
	get user(): User | null;
	get loading(): boolean;
};

export function useAuth(): AuthStore {
	const auth = getContext<AuthStore>(AUTH_CONTEXT_KEY);
	if (!auth) {
		throw new Error('useAuth() must be used inside the root layout');
	}
	return auth;
}
