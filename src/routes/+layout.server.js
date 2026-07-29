import { db } from '$lib/server/db.js';

// Counts for the sidebar badges. Cheap enough to run on every navigation.
export async function load() {
	const row = await db().get(`
		SELECT
			(SELECT COUNT(*) FROM source_leads WHERE status = 'new')  AS new_leads,
			(SELECT COUNT(*) FROM prospects    WHERE status = 'open') AS open_prospects
	`);

	return {
		counts: {
			newLeads: Number(row?.new_leads ?? 0),
			open: Number(row?.open_prospects ?? 0)
		}
	};
}
