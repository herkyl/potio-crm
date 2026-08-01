// Fetch-driven candidate detail and mutations, the pre-acceptance twin of
// /api/prospect/[id]. Same reason for existing: the modal is opened from a
// query parameter over whatever view you were on, not from a route.

import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { getCandidate } from '$lib/server/queries.js';
import { acceptCandidate, rejectCandidate, updateCandidateSnapshot } from '$lib/server/triage.js';

export async function GET({ params }) {
	const candidate = await getCandidate(db(), params.id);
	if (!candidate) error(404, 'Candidate not found');
	return json(candidate);
}

export async function POST({ params, request }) {
	const body = await request.json().catch(() => ({}));
	const leadId = params.id;

	switch (body.op) {
		case 'person': {
			const patch = snapshotPatch(body.patch ?? {});
			if (Object.keys(patch).length === 0) return bad('Nothing to save');
			await updateCandidateSnapshot(db(), leadId, patch);
			return json({ ok: true });
		}

		case 'accept': {
			const options = {};
			if (body.personId) options.personId = body.personId;
			if (body.forceNew) options.forceNew = true;

			const result = await acceptCandidate(db(), leadId, options);

			// A name collision can't be resolved unattended — §4.2 forbids merging
			// on name alone, so it bounces back and the user picks.
			if (result.status === 'duplicate') {
				return json(
					{
						ok: false,
						duplicate: { leadId, candidates: result.candidates, proposed: result.proposed }
					},
					{ status: 409 }
				);
			}

			return json({ ok: true, prospectId: result.prospectId, undo: result.undo ?? null });
		}

		case 'reject': {
			const result = await rejectCandidate(db(), leadId);
			return json({ ok: true, undo: result.undo });
		}

		default:
			return bad(`Unknown op: ${body.op}`);
	}
}

/**
 * The modal edits one set of field names whichever kind of record is open. A
 * candidate is still a raw Skool snapshot, which names some of them
 * differently and keeps the name in two halves — translate on the way in.
 */
function snapshotPatch(incoming) {
	const out = {};

	if ('full_name' in incoming) {
		const parts = String(incoming.full_name ?? '')
			.trim()
			.split(/\s+/)
			.filter(Boolean);
		out.first_name = parts.shift() ?? '';
		out.last_name = parts.join(' ');
	}

	if ('headline' in incoming) out.bio = String(incoming.headline ?? '').trim();

	for (const field of ['company', 'location', 'linkedin_url', 'website_url']) {
		if (field in incoming) out[field] = String(incoming[field] ?? '').trim();
	}

	return out;
}

const bad = (message, status = 400) => json({ ok: false, error: message }, { status });
