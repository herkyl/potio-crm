// Pulls classified scanner members into source_leads. Run with: npm run ingest
//
// Safe to run repeatedly and safe to run while the scanner is mid-pass: every
// write is an insert guarded by ON CONFLICT DO NOTHING.

import { createDb } from '../src/lib/server/client.js';
import { ingestSkoolMembers } from '../src/lib/server/ingest.js';
import { preflight, formatPreflight } from '../src/lib/server/preflight.js';

const db = createDb(process.env.TURSO_DATABASE_URL, process.env.TURSO_AUTH_TOKEN);

console.log(`\ndatabase: ${process.env.TURSO_DATABASE_URL}\n`);
console.log(formatPreflight(await preflight(db)));

const { inserted, skipped, considered } = await ingestSkoolMembers(db);
console.log(`\ningest: ${considered} considered, ${inserted} inserted, ${skipped} already present`);
console.log('');
