import { db } from '$lib/server/db.js';
import { listProspects, worklist } from '$lib/server/queries.js';

// The board lives in the layout so `/board/[prospectId]` can render a modal over
// it without tearing down and refetching the columns underneath.
export async function load() {
	const [prospects, stats] = await Promise.all([listProspects(db()), worklist(db())]);
	return { prospects, stats };
}
