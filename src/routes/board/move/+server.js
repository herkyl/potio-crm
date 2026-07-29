import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { changeStage, changeStatus } from '$lib/server/prospects.js';

// Drag-and-drop is inherently fetch-driven, so this is the one place stage
// changes arrive over JSON rather than a form action. It still calls the same
// `changeStage` as the modal does — there is no second implementation (SPEC §7).
export async function POST({ request }) {
	const { prospectId, stage, status, reason } = await request.json();
	if (!prospectId) error(400, 'prospectId is required');

	try {
		// Dropping into Won/Lost/Parked is a status change; the card keeps the
		// stage it died in, which is what gives funnel drop-off data.
		if (status) {
			const result = await changeStatus(db(), prospectId, status, reason ?? null);
			return json({ ok: true, ...result });
		}

		const result = await changeStage(db(), prospectId, stage);
		return json({ ok: true, ...result });
	} catch (err) {
		error(400, err.message);
	}
}
