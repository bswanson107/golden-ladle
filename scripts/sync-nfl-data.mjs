import { createClient } from '@supabase/supabase-js';
import { runSync, SYNC_STATE_KEY, DEFAULT_SEASON_YEAR } from '../src/lib/sync/index.ts';

try {
	process.loadEnvFile();
} catch {
	// .env optional — CI and production pass env vars directly
}

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
	console.error(
		'Missing PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY'
	);
	process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceRoleKey);
const seasonYear = Number(process.env.SYNC_SEASON_YEAR ?? DEFAULT_SEASON_YEAR);

const { data: state } = await adminClient
	.from('sync_state')
	.select('last_started_at, last_completed_at')
	.eq('key', SYNC_STATE_KEY)
	.single();

await adminClient
	.from('sync_state')
	.update({
		last_started_at: new Date().toISOString(),
		last_completed_at: null,
		last_error: null,
		updated_at: new Date().toISOString()
	})
	.eq('key', SYNC_STATE_KEY);

try {
	const result = await runSync(adminClient, seasonYear);
	await adminClient
		.from('sync_state')
		.update({
			last_completed_at: result.lastSyncAt,
			games_updated: result.gamesUpdated,
			odds_updated: result.oddsUpdated,
			last_error: null,
			updated_at: new Date().toISOString()
		})
		.eq('key', SYNC_STATE_KEY);

	console.log(JSON.stringify({ ok: true, previous: state, ...result }, null, 2));
} catch (err) {
	const message = err instanceof Error ? err.message : String(err);
	await adminClient
		.from('sync_state')
		.update({
			last_error: message,
			last_completed_at: new Date().toISOString(),
			updated_at: new Date().toISOString()
		})
		.eq('key', SYNC_STATE_KEY);
	console.error(message);
	process.exitCode = 1;
}
