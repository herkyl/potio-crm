// SPEC §9.5 — before writing anything, say what's already there.
//
// Reports which expected tables exist and how many rows each holds, so
// "am I about to clobber something" is answerable in one glance. Read-only.

const SCANNER_TABLES = ['members', 'member_classification', 'posts', 'post_classification'];
const CRM_TABLES = ['sources', 'source_leads', 'people', 'prospects', 'activities'];

export async function preflight(db) {
	const present = new Set(
		(await db.all("SELECT name FROM sqlite_master WHERE type = 'table'")).map((r) => r.name)
	);

	const counts = {};
	for (const table of [...SCANNER_TABLES, ...CRM_TABLES]) {
		if (!present.has(table)) {
			counts[table] = null;
			continue;
		}
		const row = await db.get(`SELECT COUNT(*) AS n FROM ${table}`);
		counts[table] = Number(row.n);
	}

	const crmRows = CRM_TABLES.reduce((sum, t) => sum + (counts[t] ?? 0), 0);

	return {
		counts,
		missingScannerTables: SCANNER_TABLES.filter((t) => !present.has(t)),
		missingCrmTables: CRM_TABLES.filter((t) => !present.has(t)),
		// Any CRM rows at all means this is a normal restart, not a fresh install.
		isRestart: crmRows > 0
	};
}

export function formatPreflight(report) {
	const line = (t) => `${t.padEnd(22)} ${report.counts[t] === null ? '—' : report.counts[t]}`;
	return [
		'scanner tables (read-only to this app):',
		...SCANNER_TABLES.map((t) => '  ' + line(t)),
		'crm tables:',
		...CRM_TABLES.map((t) => '  ' + line(t)),
		report.missingCrmTables.length
			? `\nmissing CRM tables: ${report.missingCrmTables.join(', ')} — run \`npm run migrate\``
			: report.isRestart
				? '\nCRM tables already hold rows. Normal restart, not reinitialising.'
				: '\nCRM tables empty. Fresh install.'
	].join('\n');
}
