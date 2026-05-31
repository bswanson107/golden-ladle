import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { browser } from '$app/environment';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';

export function createSupabaseBrowserClient(): SupabaseClient {
	return createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
}

let browserClient: SupabaseClient | undefined;

/** Singleton Supabase client for browser use (auth, queries). */
export function getSupabase(): SupabaseClient {
	if (!browser) {
		throw new Error('getSupabase() can only be called in the browser');
	}

	browserClient ??= createSupabaseBrowserClient();
	return browserClient;
}
