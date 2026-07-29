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

export const TERMINAL_STATUSES = [
	{ id: 'won', label: 'Won', icon: 'trophy' },
	{ id: 'lost', label: 'Lost', icon: 'x' },
	{ id: 'parked', label: 'Parked', icon: 'pause' }
];

export const STATUSES = ['open', 'won', 'lost', 'parked'];

export const stageLabel = (id) => STAGES.find((s) => s.id === id)?.label ?? id;

export const staleAfter = (id) => STAGES.find((s) => s.id === id)?.staleAfter ?? Infinity;

/** Days in the current stage exceeds that stage's threshold. Visual only. */
export function isStale(stage, stageEnteredAt, now = Date.now()) {
	if (!stageEnteredAt) return false;
	const days = (now - new Date(stageEnteredAt).getTime()) / 86_400_000;
	return days > staleAfter(stage);
}
