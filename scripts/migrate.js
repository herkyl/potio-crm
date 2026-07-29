// Applies migrations/*.sql in filename order, recording each in schema_migrations.
//
// Run with: npm run migrate
//
// Safety (SPEC §9.2): this refuses to execute any statement that drops, truncates
// or bulk-deletes. The database holds live scanner data and triage decisions that
// cannot be re-derived. A migration that needs a subtractive change is a manual,
// backed-up operation by the user — not something this script will do.

import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createDb } from '../src/lib/server/client.js';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

const FORBIDDEN = /\b(DROP\s+(TABLE|INDEX|VIEW|TRIGGER)|TRUNCATE|DELETE\s+FROM)\b/i;

/** Strip full-line `--` comments, then split on ';'. libSQL runs one statement per call. */
function statementsOf(sql) {
	return sql
		.split('\n')
		.filter((line) => !line.trim().startsWith('--'))
		.join('\n')
		.split(';')
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}

async function main() {
	const db = createDb(process.env.TURSO_DATABASE_URL, process.env.TURSO_AUTH_TOKEN);

	await db.run(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
		  version    TEXT PRIMARY KEY,
		  applied_at TEXT DEFAULT (datetime('now'))
		)
	`);

	const applied = new Set(
		(await db.all('SELECT version FROM schema_migrations')).map((r) => r.version)
	);

	const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();

	for (const file of files) {
		const version = file.replace(/\.sql$/, '');
		if (applied.has(version)) {
			console.log(`  skip  ${version} (already applied)`);
			continue;
		}

		const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
		const statements = statementsOf(sql);

		for (const stmt of statements) {
			if (FORBIDDEN.test(stmt)) {
				throw new Error(
					`Refusing to run a destructive statement in ${file}:\n\n${stmt}\n\n` +
						`See SPEC §9.2. Subtractive changes are manual and require a backup first.`
				);
			}
		}

		for (const stmt of statements) {
			await db.run(stmt);
		}

		await db.run('INSERT INTO schema_migrations (version) VALUES (?)', [version]);
		console.log(`  apply ${version} (${statements.length} statements)`);
	}

	console.log('\nMigrations up to date.');
}

main().catch((err) => {
	console.error(err.message);
	process.exit(1);
});
