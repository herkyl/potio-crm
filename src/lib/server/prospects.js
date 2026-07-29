// The one canonical mutation path for a prospect. SPEC §7.
//
// Whether a stage change comes from a drag on the board or a select in the card
// modal, it goes through `changeStage` — there is no second implementation.
// Every change atomically: writes the stage, resets stage_entered_at, sets the
// matching milestone *only if not already set*, and appends an activities row.
//
// Reverse moves preserving milestones is the point of the COALESCE: dragging a
// card back to shortlist must not erase that you sent an invite on the 3rd.

import { newId, nowIso } from './client.js';
import { STAGE_IDS, STAGE_MILESTONE, STATUSES } from '$lib/stages.js';

const PERSON_FIELDS = [
	'full_name',
	'first_name',
	'last_name',
	'headline',
	'location',
	'company',
	'linkedin_slug',
	'linkedin_url',
	'website_url',
	'notes'
];

/**
 * Move a prospect to a stage.
 * @returns {Promise<{ changed: boolean, from: string, to: string }>}
 */
export async function changeStage(db, prospectId, toStage) {
	if (!STAGE_IDS.includes(toStage)) throw new Error(`Unknown stage: ${toStage}`);

	const current = await db.get('SELECT stage, status FROM prospects WHERE id = ?', [prospectId]);
	if (!current) throw new Error('Prospect not found');

	const reopening = current.status !== 'open';
	if (current.stage === toStage && !reopening) {
		return { changed: false, from: current.stage, to: toStage };
	}

	const now = nowIso();
	const milestone = STAGE_MILESTONE[toStage];

	const statements = [
		{
			// COALESCE on the milestone is what makes backwards drags safe.
			sql: `UPDATE prospects SET
					stage = ?,
					status = 'open',
					closed_at = NULL,
					close_reason = NULL,
					stage_entered_at = ?,
					${milestone} = COALESCE(${milestone}, ?),
					updated_at = ?
				  WHERE id = ?`,
			args: [toStage, now, now, now, prospectId]
		},
		{
			sql: `INSERT INTO activities (id, prospect_id, type, from_stage, to_stage, occurred_at)
				  VALUES (?, ?, 'stage_change', ?, ?, ?)`,
			args: [newId(), prospectId, current.stage, toStage, now]
		}
	];

	// Dragging a card out of Won/Lost/Parked and back onto the board reopens it.
	if (reopening) {
		statements.push({
			sql: `INSERT INTO activities (id, prospect_id, type, body, occurred_at)
				  VALUES (?, ?, 'status_change', ?, ?)`,
			args: [newId(), prospectId, `Reopened from ${current.status}`, now]
		});
	}

	await db.batch(statements);
	return { changed: true, from: current.stage, to: toStage };
}

/**
 * Close (or reopen) a prospect. Orthogonal to stage — the stage the card died in
 * is retained, which is what gives funnel drop-off data for free. SPEC §3.3.
 */
export async function changeStatus(db, prospectId, status, reason = null) {
	if (!STATUSES.includes(status)) throw new Error(`Unknown status: ${status}`);

	const current = await db.get('SELECT stage, status FROM prospects WHERE id = ?', [prospectId]);
	if (!current) throw new Error('Prospect not found');
	if (current.status === status) return { changed: false };

	const now = nowIso();
	const closing = status !== 'open';

	await db.batch([
		{
			sql: `UPDATE prospects SET
					status = ?,
					close_reason = ?,
					closed_at = ?,
					updated_at = ?
				  WHERE id = ?`,
			args: [status, closing ? reason : null, closing ? now : null, now, prospectId]
		},
		{
			sql: `INSERT INTO activities (id, prospect_id, type, from_stage, to_stage, body, occurred_at)
				  VALUES (?, ?, 'status_change', ?, ?, ?, ?)`,
			args: [
				newId(),
				prospectId,
				current.status,
				status,
				reason || `${current.status} → ${status}`,
				now
			]
		}
	]);

	return { changed: true };
}

/** Inline edits from the card modal. Every person field is hand-editable (§3.4). */
export async function updatePerson(db, personId, patch, prospectId = null) {
	const fields = Object.keys(patch).filter((k) => PERSON_FIELDS.includes(k));
	if (fields.length === 0) return { changed: false };

	const now = nowIso();
	const sets = fields.map((f) => `${f} = ?`).join(', ');
	const args = fields.map((f) => (patch[f] === '' ? null : patch[f]));

	await db.run(`UPDATE people SET ${sets}, updated_at = ? WHERE id = ?`, [...args, now, personId]);

	if (prospectId) {
		await db.run(
			`INSERT INTO activities (id, prospect_id, type, body, occurred_at)
			 VALUES (?, ?, 'field_edit', ?, ?)`,
			[newId(), prospectId, `Edited ${fields.join(', ')}`, now]
		);
	}

	return { changed: true, fields };
}

export async function setNextAction(db, prospectId, nextAction, nextActionAt) {
	await db.run(
		'UPDATE prospects SET next_action = ?, next_action_at = ?, updated_at = ? WHERE id = ?',
		[nextAction || null, nextActionAt || null, nowIso(), prospectId]
	);
}

/** Append-only, timestamped, freeform. SPEC §3.4.6. */
export async function addNote(db, prospectId, body) {
	const text = String(body ?? '').trim();
	if (!text) return { changed: false };

	await db.run(
		`INSERT INTO activities (id, prospect_id, type, body, occurred_at)
		 VALUES (?, ?, 'note', ?, ?)`,
		[newId(), prospectId, text, nowIso()]
	);
	return { changed: true };
}

/** Manually created prospect for someone who never came through a source (§3.4). */
export async function createManualProspect(db, fields) {
	const now = nowIso();
	const personId = newId();
	const prospectId = newId();

	await db.batch([
		{
			sql: `INSERT INTO people (
					id, full_name, first_name, last_name, headline, location, company,
					linkedin_slug, linkedin_url, website_url, created_at, updated_at
				  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			args: [
				personId,
				fields.full_name,
				fields.first_name ?? null,
				fields.last_name ?? null,
				fields.headline ?? null,
				fields.location ?? null,
				fields.company ?? null,
				fields.linkedin_slug ?? null,
				fields.linkedin_url ?? null,
				fields.website_url ?? null,
				now,
				now
			]
		},
		{
			sql: `INSERT INTO prospects (
					id, person_id, stage, status, stage_entered_at, shortlisted_at, created_at, updated_at
				  ) VALUES (?, ?, 'shortlist', 'open', ?, ?, ?, ?)`,
			args: [prospectId, personId, now, now, now, now]
		},
		{
			sql: `INSERT INTO activities (id, prospect_id, type, to_stage, body, occurred_at)
				  VALUES (?, ?, 'accepted', 'shortlist', 'Added manually', ?)`,
			args: [newId(), prospectId, now]
		}
	]);

	return { personId, prospectId };
}
