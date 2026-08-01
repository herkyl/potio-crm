import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { listProspects, worklist } from '$lib/server/queries.js';
import { createManualProspect } from '$lib/server/prospects.js';
import { normaliseLinkedInSlug, linkedInUrlFromSlug } from '$lib/linkedin.js';

// The board used to live in a layout so that `/board/[prospectId]` could render
// a modal over it. The modal is a query parameter now, so there's no child route
// and no reason for the split.
export async function load({ depends }) {
	depends('crm:board');

	const [prospects, stats] = await Promise.all([listProspects(db()), worklist(db())]);
	return { prospects, stats };
}

export const actions = {
	// "Add prospect manually" — for someone who never came through a source at all.
	create: async ({ request }) => {
		const data = await request.formData();
		const fullName = String(data.get('full_name') ?? '').trim();
		if (!fullName) return fail(400, { message: 'A name is required' });

		const slug = normaliseLinkedInSlug(data.get('linkedin_url'));
		if (slug) {
			const existing = await db().get('SELECT id, full_name FROM people WHERE linkedin_slug = ?', [
				slug
			]);
			if (existing) {
				return fail(409, {
					message: `${existing.full_name} already exists with that LinkedIn profile.`
				});
			}
		}

		const parts = fullName.split(/\s+/);
		const { prospectId } = await createManualProspect(db(), {
			full_name: fullName,
			first_name: parts[0] ?? null,
			last_name: parts.length > 1 ? parts.slice(1).join(' ') : null,
			headline: String(data.get('headline') ?? '').trim() || null,
			company: String(data.get('company') ?? '').trim() || null,
			location: String(data.get('location') ?? '').trim() || null,
			linkedin_slug: slug,
			linkedin_url: linkedInUrlFromSlug(slug),
			website_url: String(data.get('website_url') ?? '').trim() || null
		});

		redirect(303, `/board/${prospectId}`);
	}
};
