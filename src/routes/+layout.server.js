import { db } from '$lib/server/db.js';

// Counts for the sidebar badges.
//
// Tagged so callers can refresh just this, instead of `invalidateAll()` pulling
// every load function on the page. Only a status change moves these numbers.
export async function load({ depends }) {
	depends('crm:counts');

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
