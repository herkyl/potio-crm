import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { listSources } from '$lib/server/queries.js';
import { ingestSkoolMembers } from '$lib/server/ingest.js';

export async function load() {
	return { sources: await listSources(db()) };
}

export const actions = {
	// Pulls anything the scanner has classified since the last pass into
	// source_leads. Insert-only, so it can't resurrect a rejected candidate.
	sync: async () => {
		try {
			const result = await ingestSkoolMembers(db());
			return { synced: true, ...result };
		} catch (err) {
			return fail(500, { message: err.message });
		}
	},

	toggle: async ({ request }) => {
		const data = await request.formData();
		const id = data.get('id');
		const enabled = data.get('enabled') === 'true' ? 1 : 0;
		await db().run('UPDATE sources SET enabled = ? WHERE id = ?', [enabled, id]);
		return { toggled: true };
	}
};
