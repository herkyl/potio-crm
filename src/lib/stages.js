// Stage and status vocabulary. SPEC §3.3. Imported by both client and server —
// keep it free of node-only imports.

export const STAGES = [
	{ id: 'shortlist', label: 'Shortlist', hint: 'Accepted, not yet contacted', staleAfter: 7 },
	{ id: 'invite_sent', label: 'Invite sent', hint: 'Awaiting their accept', staleAfter: 21 },
	{ id: 'connected', label: 'Connected', hint: 'Accepted you, no message yet', staleAfter: 3 },
	{ id: 'messaged', label: 'Messaged', hint: 'Awaiting a reply', staleAfter: 7 },
	{ id: 'in_conversation', label: 'In conversation', hint: 'Live dialogue', staleAfter: 5 },
	{ id: 'opportunity', label: 'Opportunity', hint: 'Call booked / scoping', staleAfter: 14 }
];

export const STAGE_IDS = STAGES.map((s) => s.id);

/** Milestone column set when a card first reaches a stage. Never cleared. */
export const STAGE_MILESTONE = {
	shortlist: 'shortlisted_at',
	invite_sent: 'invite_sent_at',
	connected: 'connected_at',
	messaged: 'first_message_at',
	in_conversation: 'first_reply_at',
	opportunity: 'opportunity_at'
};

// `lost` and `disqualified` are deliberately separate. Lost means we engaged and
// it didn't work out — that's real funnel data. Disqualified means the prospect
// should never have been accepted, or can't be worked at all; counting those as
// lost would pollute the drop-off numbers with people who were never in play.
export const TERMINAL_STATUSES = [
	{ id: 'won', label: 'Won', icon: 'trophy' },
	{ id: 'lost', label: 'Lost', icon: 'x' },
	{ id: 'parked', label: 'Parked', icon: 'pause' },
	{ id: 'disqualified', label: 'Disqualified', icon: 'ban' }
];

export const STATUSES = ['open', ...TERMINAL_STATUSES.map((s) => s.id)];

export const statusLabel = (id) => TERMINAL_STATUSES.find((s) => s.id === id)?.label ?? id;

/**
 * Suggested reasons when disqualifying. Suggestions, not a constraint — the
 * field stays free text so an unanticipated reason is still recordable.
 */
export const DISQUALIFY_REASONS = [
	'Not ICP',
	'No LinkedIn found',
	'Wrong person / mismatch',
	'Competitor or peer',
	'Inactive account',
	'Other'
];

/**
 * Disqualified prospects stay put — they are never pushed back to the source.
 * The record that we tried is worth keeping, and they could not resurface
 * anyway: ingest is `ON CONFLICT DO NOTHING` and the candidate is already
 * marked `accepted`.
 */
export const KEEP_ON_DISQUALIFY = true;

export const stageLabel = (id) => STAGES.find((s) => s.id === id)?.label ?? id;

export const staleAfter = (id) => STAGES.find((s) => s.id === id)?.staleAfter ?? Infinity;

/** Days in the current stage exceeds that stage's threshold. Visual only. */
export function isStale(stage, stageEnteredAt, now = Date.now()) {
	if (!stageEnteredAt) return false;
	const days = (now - new Date(stageEnteredAt).getTime()) / 86_400_000;
	return days > staleAfter(stage);
}
