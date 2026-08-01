// Fetch-driven prospect detail and mutations.
//
// The card modal opens over whatever view you were on — board, list, triage —
// without a route change, so it can't rely on a `+page.server.js` load or on
// form actions scoped to a route. Everything it needs goes through here.
//
// Mutations still funnel into `$lib/server/prospects.js`, so the canonical
// stage-change path (SPEC §7) has exactly one implementation.

import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { getProspect } from '$lib/server/queries.js';
import {
	changeStage,
	changeStatus,
	updatePerson,
	setNextAction,
	addNote
} from '$lib/server/prospects.js';
import { STAGE_IDS, STATUSES } from '$lib/stages.js';
import { normaliseLinkedInSlug, linkedInUrlFromSlug } from '$lib/linkedin.js';

/** Person fields the modal is allowed to write. `linkedin_url` is handled apart. */
const PERSON_FIELDS = ['full_name', 'headline', 'location', 'company', 'website_url', 'notes'];

export async function GET({ params }) {
	const detail = await getProspect(db(), params.id);
	if (!detail) error(404, 'Prospect not found');
	return json(detail);
}

export async function POST({ params, request }) {
	const body = await request.json().catch(() => ({}));
	const prospectId = params.id;

	switch (body.op) {
		case 'person':
			return savePerson(prospectId, body);

		case 'stage': {
			if (!STAGE_IDS.includes(body.stage)) return bad(`Unknown stage: ${body.stage}`);
			await changeStage(db(), prospectId, body.stage);
			return json({ ok: true });
		}

		case 'status': {
			// A missing status means the caller lost the button's value somewhere.
			// Surface it as a 400 rather than a 500 out of changeStatus.
			if (!STATUSES.includes(body.status)) return bad(`Unknown status: ${body.status}`);
			const reason = String(body.reason ?? '').trim();
			await changeStatus(db(), prospectId, body.status, reason || null);
			return json({ ok: true });
		}

		case 'nextAction': {
			await setNextAction(db(), prospectId, body.next_action, body.next_action_at);
			return json({ ok: true });
		}

		case 'note': {
			await addNote(db(), prospectId, body.body);
			return json({ ok: true });
		}

		default:
			return bad(`Unknown op: ${body.op}`);
	}
}

/**
 * LinkedIn gets special handling because pasting a URL has to update the slug
 * that dedupes on it.
 */
async function savePerson(prospectId, body) {
	const patch = {};
	const incoming = body.patch ?? {};

	for (const field of PERSON_FIELDS) {
		if (field in incoming) patch[field] = String(incoming[field] ?? '').trim();
	}

	if ('linkedin_url' in incoming) {
		const raw = String(incoming.linkedin_url ?? '').trim();
		const slug = normaliseLinkedInSlug(raw);
		patch.linkedin_slug = slug;
		patch.linkedin_url = slug ? linkedInUrlFromSlug(slug) : raw;
	}

	if (Object.keys(patch).length === 0) return bad('Nothing to save');

	const personId = body.personId;
	if (!personId) return bad('Missing personId');

	try {
		await updatePerson(db(), personId, patch, prospectId);
	} catch (err) {
		// The slug has a UNIQUE index; a clash means two people, one profile.
		if (String(err.message).includes('UNIQUE')) {
			return bad('Another person already has that LinkedIn profile.', 409);
		}
		throw err;
	}

	return json({ ok: true, patch });
}

const bad = (message, status = 400) => json({ ok: false, error: message }, { status });
