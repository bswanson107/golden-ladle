import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const { Client } = pg;

const sqlPath = process.argv[2];
const dbUrl = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;

if (!sqlPath) {
	console.error('Usage: SUPABASE_DB_URL=... node scripts/apply-sql.mjs <path-to.sql>');
	process.exit(1);
}

if (!dbUrl) {
	console.error(
		'Missing SUPABASE_DB_URL (or DATABASE_URL). Get it from Supabase → Project Settings → Database → Connection string.'
	);
	process.exit(1);
}

const absolutePath = resolve(sqlPath);
const sql = readFileSync(absolutePath, 'utf8');
const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

try {
	await client.connect();
	await client.query(sql);
	console.log(`Applied ${absolutePath}`);
} catch (error) {
	console.error('Migration failed:', error instanceof Error ? error.message : error);
	process.exitCode = 1;
} finally {
	await client.end();
}
