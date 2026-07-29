// SPEC §4.1 — the bridge from the scanner to the CRM.
//
// The scanner writes `members` and `member_classification`. Triage reads
// `source_leads`. This copies across every classified member that doesn't
// already have a candidate row.
//
// Two rules, both load-bearing:
//
//   1. INSERT ... ON CONFLICT DO NOTHING. Never an update. This is what makes
//      rejection sticky — the scanner runs hourly, and without it every
//      rejected candidate would be re-offered as new, forever.
//   2. Ingest everything classified, whatever the label. Whether the UI shows
//      SPECIALIST rows is a view filter, so a misclassified person stays
//      recoverable.

import { newId, nowIso } from './client.js';

export const SKOOL_SOURCE_ID = 'pricingsaas_skool';

const CHUNK = 100;

/**
 * Copy newly classified scanner members into `source_leads`.
 * @returns {Promise<{ inserted: number, skipped: number, considered: number }>}
 */
export async function ingestSkoolMembers(db) {
	// Classified members with no candidate row yet. The LEFT JOIN is what keeps
	// this cheap on re-runs: after the first pass it returns almost nothing.
	const rows = await db.all(
		`
		SELECT m.id, m.username, m.first_name, m.last_name, m.bio, m.location,
		       m.linkedin_url, m.website_url, m.role, m.joined_at,
		       c.label, c.confidence, c.reasoning
		FROM member_classification c
		JOIN members m ON m.id = c.member_id
		LEFT JOIN source_leads sl
		       ON sl.source_id = ? AND sl.external_id = m.id
		WHERE sl.id IS NULL
		`,
		[SKOOL_SOURCE_ID]
	);

	if (rows.length === 0) {
		await touchSource(db);
		return { inserted: 0, skipped: 0, considered: 0 };
	}

	// The strongest help-request post per author, used as the flagging evidence.
	const evidence = await flaggingPostsByAuthor(db);

	let inserted = 0;
	for (let i = 0; i < rows.length; i += CHUNK) {
		const chunk = rows.slice(i, i + CHUNK);
		const result = await db.batch(
			chunk.map((m) => ({
				sql: `
					INSERT INTO source_leads (
						id, source_id, external_id, status,
						label, confidence, reasoning, evidence_json, snapshot_json, found_at
					) VALUES (?, ?, ?, 'new', ?, ?, ?, ?, ?, ?)
					ON CONFLICT(source_id, external_id) DO NOTHING
				`,
				args: [
					newId(),
					SKOOL_SOURCE_ID,
					m.id,
					m.label ?? null,
					m.confidence ?? null,
					m.reasoning ?? null,
					evidence.has(m.id) ? JSON.stringify(evidence.get(m.id)) : null,
					JSON.stringify(snapshotOf(m)),
					nowIso()
				]
			}))
		);
		inserted += result.reduce((n, rs) => n + rs.rowsAffected, 0);
	}

	await touchSource(db);
	return { inserted, skipped: rows.length - inserted, considered: rows.length };
}

/**
 * Map of author id → their best help-request post, for `evidence_json`.
 * Highest lead_score wins when someone posted more than one.
 */
async function flaggingPostsByAuthor(db) {
	const posts = await db.all(`
		SELECT p.id, p.author_id, p.title, p.body, p.url, p.posted_at,
		       pc.lead_score, pc.reasoning
		FROM post_classification pc
		JOIN posts p ON p.id = pc.post_id
		WHERE pc.is_help_request = 1 AND p.author_id IS NOT NULL
		ORDER BY pc.lead_score DESC
	`);

	const byAuthor = new Map();
	for (const p of posts) {
		if (byAuthor.has(p.author_id)) continue; // already have their strongest
		byAuthor.set(p.author_id, {
			id: p.id,
			title: p.title,
			body: p.body,
			url: p.url,
			posted_at: p.posted_at,
			lead_score: p.lead_score,
			reasoning: p.reasoning
		});
	}
	return byAuthor;
}

/** The member profile as captured, for display before acceptance. */
function snapshotOf(m) {
	return {
		username: m.username,
		first_name: m.first_name,
		last_name: m.last_name,
		bio: m.bio,
		location: m.location,
		linkedin_url: m.linkedin_url,
		website_url: m.website_url,
		role: m.role,
		joined_at: m.joined_at
	};
}

/** Records when the CRM last pulled from this source. */
function touchSource(db) {
	return db.run('UPDATE sources SET last_synced_at = ? WHERE id = ?', [nowIso(), SKOOL_SOURCE_ID]);
}
