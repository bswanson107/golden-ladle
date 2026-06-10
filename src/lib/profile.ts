import { getSupabase } from '$lib/supabase';

export async function fetchProfile(userId: string): Promise<{
	displayName: string | null;
	error: string | null;
}> {
	const { data, error } = await getSupabase()
		.from('profiles')
		.select('display_name')
		.eq('id', userId)
		.single();

	if (error) {
		return { displayName: null, error: error.message };
	}

	return { displayName: data?.display_name ?? null, error: null };
}

export async function updateDisplayName(
	userId: string,
	displayName: string
): Promise<{ error: string | null }> {
	const trimmed = displayName.trim();
	if (!trimmed) {
		return { error: 'Display name cannot be empty.' };
	}

	const { error } = await getSupabase()
		.from('profiles')
		.update({ display_name: trimmed })
		.eq('id', userId);

	return { error: error?.message ?? null };
}
