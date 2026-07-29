import { error, fail } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { getSource, listCandidates, candidateTabCounts } from '$lib/server/queries.js';
import {
	acceptCandidate,
	rejectCandidate,
	undoTriage,
	updateCandidateSnapshot
} from '$lib/server/triage.js';

/** The classifier is wrong sometimes, so the default view is narrow but the
    filters are one click away. SPEC §3.2. */
const DEFAULT_CONFIDENCE = 0.6;

export async function load({ params, url }) {
	const source = await getSource(db(), params.id);
	if (!source) error(404, 'Source not found');

	const filters = {
		tab: url.searchParams.get('tab') ?? 'new',
		label: url.searchParams.get('label') ?? 'PROSPECT',
		minConfidence: Number(url.searchParams.get('minConfidence') ?? DEFAULT_CONFIDENCE),
		search: url.searchParams.get('q') ?? ''
	};

	const [candidates, counts] = await Promise.all([
		listCandidates(db(), params.id, filters),
		candidateTabCounts(db(), params.id)
	]);

	return { source, candidates, counts, filters };
}

export const actions = {
	accept: async ({ request }) => {
		const data = await request.formData();
		const leadId = data.get('leadId');

		const options = {};
		if (data.get('personId')) options.personId = data.get('personId');
		if (data.get('forceNew') === 'true') options.forceNew = true;

		const result = await acceptCandidate(db(), leadId, options);

		// A name collision can't be resolved unattended — §4.2 forbids merging on
		// name alone, so the row bounces back and the user picks.
		if (result.status === 'duplicate') {
			return fail(409, {
				duplicate: { leadId, candidates: result.candidates, proposed: result.proposed }
			});
		}

		return { done: 'accepted', undo: result.undo ?? null, prospectId: result.prospectId };
	},

	reject: async ({ request }) => {
		const data = await request.formData();
		const result = await rejectCandidate(db(), data.get('leadId'));
		return { done: 'rejected', undo: result.undo };
	},

	bulk: async ({ request }) => {
		const data = await request.formData();
		const ids = data.getAll('leadId');
		const decision = data.get('decision');
		if (!ids.length) return fail(400, { message: 'Nothing selected' });

		let done = 0;
		const skipped = [];

		for (const id of ids) {
			if (decision === 'accept') {
				const result = await acceptCandidate(db(), id);
				// Never auto-merge in bulk. Ambiguous ones stay for a human.
				if (result.status === 'duplicate') skipped.push(id);
				else done++;
			} else {
				await rejectCandidate(db(), id);
				done++;
			}
		}

		return {
			done: decision === 'accept' ? 'bulk-accepted' : 'bulk-rejected',
			count: done,
			skipped: skipped.length
		};
	},

	undo: async ({ request }) => {
		const data = await request.formData();
		try {
			await undoTriage(db(), JSON.parse(data.get('token')));
			return { done: 'undone' };
		} catch (err) {
			return fail(400, { message: err.message });
		}
	},

	// Corrections made in the modal persist whether or not you go on to accept.
	save: async ({ request }) => {
		const data = await request.formData();
		const leadId = data.get('leadId');
		const patch = Object.fromEntries(
			['first_name', 'last_name', 'bio', 'location', 'company', 'linkedin_url', 'website_url']
				.filter((f) => data.has(f))
				.map((f) => [f, data.get(f)])
		);

		await updateCandidateSnapshot(db(), leadId, patch);
		return { done: 'saved' };
	}
};
