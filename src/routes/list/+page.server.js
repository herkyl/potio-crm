import { db } from '$lib/server/db.js';
import { listProspects, worklist } from '$lib/server/queries.js';
import { changeStage, changeStatus } from '$lib/server/prospects.js';
import { STAGE_IDS } from '$lib/stages.js';

export async function load() {
	const [prospects, stats] = await Promise.all([listProspects(db()), worklist(db())]);
	return { prospects, stats };
}

export const actions = {
	// Bulk edit — past ~100 cards this is faster than dragging (SPEC §3.5).
	bulk: async ({ request }) => {
		const data = await request.formData();
		const ids = data.getAll('prospectId');
		const target = String(data.get('target') ?? '');
		if (!ids.length || !target) return { done: 0 };

		for (const id of ids) {
			if (STAGE_IDS.includes(target)) await changeStage(db(), id, target);
			else await changeStatus(db(), id, target, 'Bulk edit');
		}

		return { done: ids.length, target };
	}
};
