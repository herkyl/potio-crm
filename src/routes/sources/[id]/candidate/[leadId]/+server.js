import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { getCandidate } from '$lib/server/queries.js';

// The triage list keeps 400 rows in memory; loading every candidate's posts and
// evidence with it would be wasteful when most are never opened. The modal
// fetches detail on click instead.
export async function GET({ params }) {
	const candidate = await getCandidate(db(), params.leadId);
	if (!candidate) error(404, 'Candidate not found');
	return json(candidate);
}
