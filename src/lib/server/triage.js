// Accepting and rejecting candidates. SPEC §3.2 and §4.2.
//
// Accepting is the only path that creates a person or a prospect. Rejecting
// creates nothing and is reversible — a rejected candidate can be accepted
// later from the Rejected tab, which promotes it normally.

import { newId, nowIso } from './client.js';
import { normaliseLinkedInSlug, linkedInUrlFromSlug } from '$lib/linkedin.js';

/** Fields the triage modal is allowed to correct before acceptance. */
const EDITABLE_SNAPSHOT_FIELDS = [
	'first_name',
	'last_name',
	'bio',
	'location',
	'company',
	'linkedin_url',
	'website_url'
];

const parse = (json, fallback = {}) => {
	if (!json) return fallback;
	try {
		return JSON.parse(json);
	} catch {
		return fallback;
	}
};

/** Person-shaped view of a candidate's snapshot, used for display and on accept. */
export function personFromSnapshot(snapshot) {
	const first = snapshot.first_name?.trim() || '';
	const last = snapshot.last_name?.trim() || '';
	const fullName = [first, last].filter(Boolean).join(' ') || snapshot.username || 'Unknown';
	const slug = normaliseLinkedInSlug(snapshot.linkedin_url);

	return {
		full_name: fullName,
		first_name: first || null,
		last_name: last || null,
		headline: snapshot.bio?.trim() || null,
		location: snapshot.location?.trim() || null,
		company: snapshot.company?.trim() || null,
		linkedin_slug: slug,
		linkedin_url: slug ? linkedInUrlFromSlug(slug) : null,
		website_url: snapshot.website_url?.trim() || null
	};
}

/** Patch a candidate's snapshot in place. Edits survive whether or not you accept. */
export async function updateCandidateSnapshot(db, leadId, patch) {
	const lead = await db.get('SELECT snapshot_json FROM source_leads WHERE id = ?', [leadId]);
	if (!lead) throw new Error('Candidate not found');

	const snapshot = parse(lead.snapshot_json);
	for (const field of EDITABLE_SNAPSHOT_FIELDS) {
		if (field in patch) {
			const value = patch[field];
			snapshot[field] = value === '' ? null : value;
		}
	}

	await db.run('UPDATE source_leads SET snapshot_json = ? WHERE id = ?', [
		JSON.stringify(snapshot),
		leadId
	]);
	return snapshot;
}

/**
 * Promote a candidate to a person + prospect.
 *
 * Identity matching, per SPEC §4.2:
 *   1. normalised slug matches an existing person → attach
 *   2. no slug but an exact name match → return `{ status: 'duplicate' }` and let
 *      the human decide. Never auto-merge on name alone.
 *   3. otherwise create a new person
 *
 * @param {object} options
 * @param {string} [options.personId] attach to this person explicitly (resolves a duplicate)
 * @param {boolean} [options.forceNew] create a new person even if a name matches
 */
export async function acceptCandidate(db, leadId, options = {}) {
	const lead = await db.get('SELECT * FROM source_leads WHERE id = ?', [leadId]);
	if (!lead) throw new Error('Candidate not found');

	// Already accepted — hand back the existing card rather than making a second.
	if (lead.status === 'accepted' && lead.person_id) {
		const existing = await db.get(
			"SELECT id FROM prospects WHERE person_id = ? AND status = 'open'",
			[lead.person_id]
		);
		return { status: 'ok', personId: lead.person_id, prospectId: existing?.id ?? null };
	}

	const snapshot = parse(lead.snapshot_json);
	const fields = personFromSnapshot(snapshot);

	const match = await resolveIdentity(db, fields, options);
	if (match.status === 'duplicate') return match;

	const now = nowIso();
	let personId = match.personId;
	let personCreated = false;

	if (!personId) {
		personId = newId();
		personCreated = true;
		await db.run(
			`INSERT INTO people (
				id, full_name, first_name, last_name, headline, location, company,
				linkedin_slug, linkedin_url, website_url, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				personId,
				fields.full_name,
				fields.first_name,
				fields.last_name,
				fields.headline,
				fields.location,
				fields.company,
				fields.linkedin_slug,
				fields.linkedin_url,
				fields.website_url,
				now,
				now
			]
		);
	} else {
		// Attaching to someone we already know: fill in blanks, never overwrite.
		await db.run(
			`UPDATE people SET
				headline      = COALESCE(headline, ?),
				location      = COALESCE(location, ?),
				company       = COALESCE(company, ?),
				linkedin_slug = COALESCE(linkedin_slug, ?),
				linkedin_url  = COALESCE(linkedin_url, ?),
				website_url   = COALESCE(website_url, ?),
				updated_at    = ?
			 WHERE id = ?`,
			[
				fields.headline,
				fields.location,
				fields.company,
				fields.linkedin_slug,
				fields.linkedin_url,
				fields.website_url,
				now,
				personId
			]
		);
	}

	// One open prospect per person (SPEC §2). If they're already on the board,
	// this source just becomes another provenance row on the same card.
	let prospect = await db.get("SELECT id FROM prospects WHERE person_id = ? AND status = 'open'", [
		personId
	]);
	let prospectCreated = false;

	if (!prospect) {
		const prospectId = newId();
		await db.run(
			`INSERT INTO prospects (
				id, person_id, stage, status, stage_entered_at, shortlisted_at, created_at, updated_at
			) VALUES (?, ?, 'shortlist', 'open', ?, ?, ?, ?)`,
			[prospectId, personId, now, now, now, now]
		);
		prospect = { id: prospectId };
		prospectCreated = true;
	}

	await db.run(
		"UPDATE source_leads SET status = 'accepted', person_id = ?, triaged_at = ? WHERE id = ?",
		[personId, now, leadId]
	);

	await db.run(
		`INSERT INTO activities (id, prospect_id, type, to_stage, body, occurred_at)
		 VALUES (?, ?, 'accepted', 'shortlist', ?, ?)`,
		[newId(), prospect.id, `Accepted from ${lead.source_id}`, now]
	);

	return {
		status: 'ok',
		personId,
		prospectId: prospect.id,
		// Everything undo needs to put the world back exactly as it was.
		undo: {
			kind: 'accept',
			leadId,
			personId,
			prospectId: prospect.id,
			personCreated,
			prospectCreated
		}
	};
}

async function resolveIdentity(db, fields, options) {
	if (options.personId) return { status: 'matched', personId: options.personId };

	if (fields.linkedin_slug) {
		const bySlug = await db.get('SELECT id FROM people WHERE linkedin_slug = ?', [
			fields.linkedin_slug
		]);
		if (bySlug) return { status: 'matched', personId: bySlug.id };
		// A slug is a strong key. If it's new, so is the person.
		return { status: 'matched', personId: null };
	}

	if (options.forceNew) return { status: 'matched', personId: null };

	// No slug. An exact name match is a hint, not proof — ask the human.
	const byName = await db.all(
		'SELECT id, full_name, headline, company, linkedin_url FROM people WHERE lower(full_name) = lower(?)',
		[fields.full_name]
	);
	if (byName.length > 0) {
		return { status: 'duplicate', candidates: byName, proposed: fields };
	}

	return { status: 'matched', personId: null };
}

/** Marks a candidate rejected. Creates nothing. Sticky across ingest re-runs. */
export async function rejectCandidate(db, leadId) {
	const lead = await db.get('SELECT status FROM source_leads WHERE id = ?', [leadId]);
	if (!lead) throw new Error('Candidate not found');

	await db.run("UPDATE source_leads SET status = 'rejected', triaged_at = ? WHERE id = ?", [
		nowIso(),
		leadId
	]);

	return { status: 'ok', undo: { kind: 'reject', leadId, previousStatus: lead.status } };
}

/**
 * Reverse the last triage action. SPEC §3.2 — a misclick on a row button must
 * not be permanent.
 *
 * Undoing an accept removes only what that accept created: the prospect if it
 * was new and has picked up no history since, and the person if this accept
 * created them and nothing else references them.
 */
export async function undoTriage(db, token) {
	if (!token?.kind) throw new Error('Nothing to undo');

	if (token.kind === 'reject') {
		await db.run("UPDATE source_leads SET status = 'new', triaged_at = NULL WHERE id = ?", [
			token.leadId
		]);
		return { status: 'ok' };
	}

	if (token.kind !== 'accept') throw new Error('Nothing to undo');

	await db.run(
		"UPDATE source_leads SET status = 'new', person_id = NULL, triaged_at = NULL WHERE id = ?",
		[token.leadId]
	);

	if (token.prospectCreated) {
		// Only if the card hasn't been worked since — a stage move or a note means
		// the accept is no longer the last thing that happened to it.
		const history = await db.get(
			"SELECT COUNT(*) AS n FROM activities WHERE prospect_id = ? AND type != 'accepted'",
			[token.prospectId]
		);
		if (Number(history.n) === 0) {
			await db.run("DELETE FROM activities WHERE prospect_id = ? AND type = 'accepted'", [
				token.prospectId
			]);
			await db.run('DELETE FROM prospects WHERE id = ?', [token.prospectId]);
		}
	}

	if (token.personCreated) {
		const refs = await db.get(
			`SELECT
				(SELECT COUNT(*) FROM source_leads WHERE person_id = ?) AS leads,
				(SELECT COUNT(*) FROM prospects    WHERE person_id = ?) AS prospects`,
			[token.personId, token.personId]
		);
		if (Number(refs.leads) === 0 && Number(refs.prospects) === 0) {
			await db.run('DELETE FROM people WHERE id = ?', [token.personId]);
		}
	}

	return { status: 'ok' };
}
