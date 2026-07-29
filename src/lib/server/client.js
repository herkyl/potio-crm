// libSQL (Turso) client factory plus a few query helpers.
//
// This module deliberately has no SvelteKit imports, so the same code runs from
// `+page.server.js` and from the plain node scripts in `scripts/`. The SvelteKit
// singleton lives in `db.js`; scripts build their own via `createDb`.

import { createClient } from '@libsql/client';
import { record } from './instrument.js';

/**
 * @param {string} url
 * @param {string} authToken
 */
export function createDb(url, authToken) {
	if (!url) throw new Error('Missing TURSO_DATABASE_URL');
	const client = createClient({ url, authToken });

	/** Times a round trip and reports it to the per-request tracker. */
	async function timed(sql, fn) {
		const started = performance.now();
		try {
			return await fn();
		} finally {
			record(sql, performance.now() - started);
		}
	}

	return {
		client,

		/** Every row for a query. @returns {Promise<Record<string, any>[]>} */
		async all(sql, args = []) {
			const rs = await timed(sql, () => client.execute({ sql, args }));
			return rs.rows.map((r) => ({ ...r }));
		},

		/** The first row, or null. @returns {Promise<Record<string, any> | null>} */
		async get(sql, args = []) {
			const rs = await timed(sql, () => client.execute({ sql, args }));
			return rs.rows.length ? { ...rs.rows[0] } : null;
		},

		/** A write. @returns {Promise<number>} rows affected */
		async run(sql, args = []) {
			const rs = await timed(sql, () => client.execute({ sql, args }));
			return rs.rowsAffected;
		},

		/**
		 * Several statements as one transaction and — importantly here — one round
		 * trip. Takes an array of `{ sql, args }`; libSQL's batch is atomic.
		 */
		async batch(statements) {
			return timed(`BATCH ×${statements.length}: ${statements[0]?.sql ?? ''}`, () =>
				client.batch(statements, 'write')
			);
		}
	};
}

export const nowIso = () => new Date().toISOString();

/** Short random id, in the same shape across every table. */
export const newId = () => crypto.randomUUID();
