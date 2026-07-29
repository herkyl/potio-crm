// Read-only summary of what's in the target database. Run with: npm run preflight

import { createDb } from '../src/lib/server/client.js';
import { preflight, formatPreflight } from '../src/lib/server/preflight.js';

const db = createDb(process.env.TURSO_DATABASE_URL, process.env.TURSO_AUTH_TOKEN);

console.log(`\ndatabase: ${process.env.TURSO_DATABASE_URL}\n`);
console.log(formatPreflight(await preflight(db)));
console.log('');
