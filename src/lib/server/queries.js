// Read paths. Everything here is SELECT-only.

const num = (v) => Number(v ?? 0);

// --- Sources ---------------------------------------------------------------

/**
 * Source cards with their triage counts, plus the scanner's own sync state.
 * The scanner timestamps are what make a silently dead cron visible (§3.1).
 */
export async function listSources(db) {
	const sources = await db.all(`
		SELECT s.id, s.name, s.kind, s.enabled, s.last_synced_at,
			SUM(CASE WHEN sl.status = 'new'      THEN 1 ELSE 0 END) AS new_count,
			SUM(CASE WHEN sl.status = 'accepted' THEN 1 ELSE 0 END) AS accepted_count,
			SUM(CASE WHEN sl.status = 'rejected' THEN 1 ELSE 0 END) AS rejected_count,
			COUNT(sl.id) AS total_count
		FROM sources s
		LEFT JOIN source_leads sl ON sl.source_id = s.id
		GROUP BY s.id
		ORDER BY s.name
	`);

	const scanner = await db.all('SELECT source, last_synced_at, last_seen_item_at FROM sync_state');

	return sources.map((s) => ({
		id: s.id,
		name: s.name,
		kind: s.kind,
		enabled: !!s.enabled,
		lastSyncedAt: s.last_synced_at,
		counts: {
			new: num(s.new_count),
			accepted: num(s.accepted_count),
			rejected: num(s.rejected_count),
			total: num(s.total_count)
		},
		scanner: scanner.map((r) => ({
			source: r.source,
			lastSyncedAt: r.last_synced_at,
			lastSeenItemAt: r.last_seen_item_at
		}))
	}));
}

export function getSource(db, id) {
	return db.get('SELECT id, name, kind, enabled, last_synced_at FROM sources WHERE id = ?', [id]);
}

// --- Triage ----------------------------------------------------------------

/**
 * Candidates for the triage list.
 * @param {object} filters
 * @param {'new'|'accepted'|'rejected'|'all'} filters.tab
 * @param {string} [filters.label] classification label, or 'any'
 * @param {number} [filters.minConfidence]
 * @param {string} [filters.search]
 */
export async function listCandidates(db, sourceId, filters = {}) {
	const { tab = 'new', label = 'any', minConfidence = 0, search = '' } = filters;

	const where = ['sl.source_id = ?'];
	const args = [sourceId];

	if (tab !== 'all') {
		where.push('sl.status = ?');
		args.push(tab);
	}

	if (label && label !== 'any') {
		where.push('sl.label = ?');
		args.push(label);
	}

	if (minConfidence > 0) {
		where.push('COALESCE(sl.confidence, 0) >= ?');
		args.push(minConfidence);
	}

	if (search.trim()) {
		// snapshot_json holds the name and bio, so a LIKE over it covers both.
		where.push('(lower(sl.snapshot_json) LIKE ? OR lower(sl.reasoning) LIKE ?)');
		const needle = `%${search.trim().toLowerCase()}%`;
		args.push(needle, needle);
	}

	const rows = await db.all(
		`SELECT sl.id, sl.external_id, sl.status, sl.label, sl.confidence, sl.reasoning,
		        sl.evidence_json, sl.snapshot_json, sl.found_at, sl.triaged_at, sl.person_id,
		        -- Any prospect, not just an open one: a closed or disqualified card
		        -- must still be reachable from the Accepted tab. Open wins if there
		        -- are several.
		        (SELECT id FROM prospects
		          WHERE person_id = sl.person_id
		          ORDER BY (status = 'open') DESC, created_at DESC LIMIT 1) AS prospect_id
		 FROM source_leads sl
		 WHERE ${where.join(' AND ')}
		 ORDER BY COALESCE(sl.confidence, 0) DESC, sl.found_at DESC
		 LIMIT 400`,
		args
	);

	return rows;
}

/** Tab counts, unaffected by the label/confidence filters so they stay stable. */
export async function candidateTabCounts(db, sourceId) {
	const row = await db.get(
		`SELECT
			SUM(CASE WHEN status = 'new'      THEN 1 ELSE 0 END) AS new_count,
			SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) AS accepted_count,
			SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected_count,
			COUNT(*) AS all_count
		 FROM source_leads WHERE source_id = ?`,
		[sourceId]
	);
	return {
		new: num(row?.new_count),
		accepted: num(row?.accepted_count),
		rejected: num(row?.rejected_count),
		all: num(row?.all_count)
	};
}

export async function getCandidate(db, leadId) {
	const lead = await db.get(
		`SELECT sl.*,
		        (SELECT id FROM prospects
		          WHERE person_id = sl.person_id
		          ORDER BY (status = 'open') DESC, created_at DESC LIMIT 1) AS prospect_id
		 FROM source_leads sl
		 WHERE sl.id = ?`,
		[leadId]
	);
	if (!lead) return null;

	// Their other posts in the group, for context alongside the flagging one.
	const posts = await db.all(
		`SELECT p.id, p.title, p.body, p.url, p.posted_at,
		        pc.is_help_request, pc.lead_score
		 FROM posts p
		 LEFT JOIN post_classification pc ON pc.post_id = p.id
		 WHERE p.author_id = ?
		 ORDER BY p.posted_at DESC
		 LIMIT 20`,
		[lead.external_id]
	);

	return { ...lead, posts };
}

// --- Board -----------------------------------------------------------------

/** Every prospect the board renders, with the counts each card face needs. */
export async function listProspects(db) {
	return db.all(`
		SELECT
			pr.id, pr.stage, pr.status, pr.close_reason,
			pr.next_action, pr.next_action_at, pr.stage_entered_at,
			pr.invite_sent_at, pr.closed_at, pr.created_at,
			pe.id AS person_id, pe.full_name, pe.headline, pe.company,
			pe.location, pe.linkedin_url, pe.linkedin_slug,
			(SELECT COUNT(*) FROM activities a
			  WHERE a.prospect_id = pr.id AND a.type = 'note') AS note_count,
			(SELECT COUNT(*) FROM activities a
			  WHERE a.prospect_id = pr.id) AS activity_count,
			(SELECT COUNT(*) FROM source_leads sl
			  WHERE sl.person_id = pe.id AND sl.status = 'accepted') AS source_count,
			(SELECT group_concat(sl.source_id) FROM source_leads sl
			  WHERE sl.person_id = pe.id AND sl.status = 'accepted') AS source_ids,
			-- Strongest classification across the sources they came from, so the
			-- board can filter on label/confidence the same way triage does.
			(SELECT sl.label FROM source_leads sl
			  WHERE sl.person_id = pe.id AND sl.status = 'accepted'
			  ORDER BY COALESCE(sl.confidence, 0) DESC LIMIT 1) AS label,
			(SELECT MAX(sl.confidence) FROM source_leads sl
			  WHERE sl.person_id = pe.id AND sl.status = 'accepted') AS confidence
		FROM prospects pr
		JOIN people pe ON pe.id = pr.person_id
		ORDER BY pr.stage_entered_at DESC
	`);
}

/** Full detail for the card modal: person, prospect, provenance, timeline. */
export async function getProspect(db, prospectId) {
	const prospect = await db.get(
		`SELECT pr.*, pe.full_name, pe.first_name, pe.last_name, pe.headline, pe.location,
		        pe.company, pe.linkedin_slug, pe.linkedin_url, pe.website_url, pe.notes AS person_notes
		 FROM prospects pr
		 JOIN people pe ON pe.id = pr.person_id
		 WHERE pr.id = ?`,
		[prospectId]
	);
	if (!prospect) return null;

	// Provenance: every source this person came from, with the scanner's verdict.
	const provenance = await db.all(
		`SELECT sl.id, sl.source_id, sl.external_id, sl.label, sl.confidence, sl.reasoning,
		        sl.evidence_json, sl.snapshot_json, sl.found_at, sl.triaged_at,
		        s.name AS source_name
		 FROM source_leads sl
		 JOIN sources s ON s.id = sl.source_id
		 WHERE sl.person_id = ?
		 ORDER BY sl.found_at DESC`,
		[prospect.person_id]
	);

	const activities = await db.all(
		`SELECT id, type, from_stage, to_stage, body, occurred_at
		 FROM activities WHERE prospect_id = ?
		 ORDER BY occurred_at DESC, rowid DESC`,
		[prospectId]
	);

	// Their posts, keyed off whichever external ids we know them by.
	const externalIds = provenance.map((p) => p.external_id).filter(Boolean);
	let posts = [];
	if (externalIds.length) {
		posts = await db.all(
			`SELECT p.id, p.title, p.body, p.url, p.posted_at, pc.is_help_request, pc.lead_score
			 FROM posts p
			 LEFT JOIN post_classification pc ON pc.post_id = p.id
			 WHERE p.author_id IN (${externalIds.map(() => '?').join(',')})
			 ORDER BY p.posted_at DESC
			 LIMIT 20`,
			externalIds
		);
	}

	return { prospect, provenance, activities, posts };
}

// --- Worklist --------------------------------------------------------------

/**
 * The dashboard strip. SPEC §3.6.
 *
 * Every pipeline count keys off `status='open'`, so won / lost / parked /
 * disqualified are all excluded by construction.
 *
 * `invites_7d` deliberately does not filter on status. It is not a funnel stat —
 * it is a rolling count of connection requests actually sent, measured against
 * LinkedIn's weekly cap. Disqualifying someone afterwards does not un-send the
 * invite, so excluding them would under-report how close you are to the limit.
 */
export async function worklist(db) {
	const row = await db.get(`
		SELECT
			(SELECT COUNT(*) FROM prospects WHERE status='open' AND stage='shortlist')       AS to_invite,
			(SELECT COUNT(*) FROM prospects WHERE status='open' AND stage='connected')       AS to_message,
			(SELECT COUNT(*) FROM prospects WHERE status='open' AND stage='in_conversation') AS replies,
			(SELECT COUNT(*) FROM prospects
			  WHERE status='open' AND next_action_at IS NOT NULL
			    AND date(next_action_at) <= date('now'))                                     AS due,
			(SELECT COUNT(*) FROM prospects
			  WHERE invite_sent_at >= datetime('now', '-7 days'))                            AS invites_7d
	`);

	return {
		toInvite: num(row?.to_invite),
		toMessage: num(row?.to_message),
		replies: num(row?.replies),
		due: num(row?.due),
		invites7d: num(row?.invites_7d)
	};
}
