import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db.js';
import { preflight } from '$lib/server/preflight.js';

// The §9.5 pre-flight summary, on a page rather than in a log. Read-only.
export async function load() {
	const report = await preflight(db());

	const migrations = await db()
		.all('SELECT version, applied_at FROM schema_migrations ORDER BY version')
		.catch(() => []);

	// Host only — never expose the auth token.
	let host = 'not configured';
	try {
		host = new URL(env.TURSO_DATABASE_URL.replace(/^libsql:/, 'https:')).host;
	} catch {
		/* leave the fallback */
	}

	return {
		report,
		migrations,
		host,
		hasGemini: !!env.GOOGLE_GENERATIVE_AI_API_KEY,
		inviteCap: Number(env.INVITE_WEEKLY_CAP ?? 100)
	};
}
