import { error, fail, redirect } from '@sveltejs/kit';
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

export async function load({ params, depends }) {
	depends('crm:prospect');

	const detail = await getProspect(db(), params.prospectId);
	if (!detail) error(404, 'Prospect not found');
	return detail;
}

export const actions = {
	// Every person field is hand-editable (SPEC §3.4). LinkedIn gets special
	// handling because pasting a URL has to update the slug that dedupes on it.
	updatePerson: async ({ request, params }) => {
		const data = await request.formData();
		const patch = {};

		for (const field of ['full_name', 'headline', 'location', 'company', 'website_url', 'notes']) {
			if (data.has(field)) patch[field] = String(data.get(field)).trim();
		}

		if (data.has('linkedin_url')) {
			const slug = normaliseLinkedInSlug(data.get('linkedin_url'));
			patch.linkedin_slug = slug;
			patch.linkedin_url = slug
				? linkedInUrlFromSlug(slug)
				: String(data.get('linkedin_url')).trim();
		}

		try {
			await updatePerson(db(), data.get('personId'), patch, params.prospectId);
		} catch (err) {
			// The slug has a UNIQUE index; a clash means two people, one profile.
			if (String(err.message).includes('UNIQUE')) {
				return { error: 'Another person already has that LinkedIn profile.' };
			}
			throw err;
		}

		return { saved: true };
	},

	stage: async ({ request, params }) => {
		const data = await request.formData();
		const stage = data.get('stage');
		if (!STAGE_IDS.includes(stage)) return fail(400, { error: `Unknown stage: ${stage}` });

		await changeStage(db(), params.prospectId, stage);
		return { saved: true };
	},

	status: async ({ request, params }) => {
		const data = await request.formData();
		const status = data.get('status');
		// A missing status means the submit button didn't carry its name/value.
		// Surface it as a form error rather than a 500.
		if (!STATUSES.includes(status)) return fail(400, { error: `Unknown status: ${status}` });

		const reason = String(data.get('reason') ?? '').trim();
		await changeStatus(db(), params.prospectId, status, reason || null);
		return { saved: true };
	},

	nextAction: async ({ request, params }) => {
		const data = await request.formData();
		await setNextAction(
			db(),
			params.prospectId,
			data.get('next_action'),
			data.get('next_action_at')
		);
		return { saved: true };
	},

	note: async ({ request, params }) => {
		const data = await request.formData();
		await addNote(db(), params.prospectId, data.get('body'));
		return { saved: true };
	},

	close: async () => {
		redirect(303, '/board');
	}
};
