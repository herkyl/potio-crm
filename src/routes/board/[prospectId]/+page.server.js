import { error, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { getProspect } from '$lib/server/queries.js';
import {
	changeStage,
	changeStatus,
	updatePerson,
	setNextAction,
	addNote
} from '$lib/server/prospects.js';
import { normaliseLinkedInSlug, linkedInUrlFromSlug } from '$lib/linkedin.js';

export async function load({ params }) {
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
		await changeStage(db(), params.prospectId, data.get('stage'));
		return { saved: true };
	},

	status: async ({ request, params }) => {
		const data = await request.formData();
		await changeStatus(db(), params.prospectId, data.get('status'), data.get('reason'));
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
