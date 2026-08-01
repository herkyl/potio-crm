// Opening a prospect must never change which view you are on.
//
// The card modal used to live at /board/[prospectId], which meant opening a row
// from the list view navigated to the board and left you there. The open record
// is a query parameter on the current page instead, applied with SvelteKit's
// shallow routing so no load function re-runs and the view underneath is never
// torn down.
//
//   ?prospect=<id>   a card on the board / in the list
//   ?candidate=<id>  a not-yet-accepted lead in triage

import { pushState, replaceState } from '$app/navigation';
import { page } from '$app/state';

export const PROSPECT_PARAM = 'prospect';
export const CANDIDATE_PARAM = 'candidate';

const PARAMS = [PROSPECT_PARAM, CANDIDATE_PARAM];

/** The current URL with every modal parameter cleared, then `param=id` set. */
function urlWith(param, id) {
	const url = new URL(page.url);
	for (const key of PARAMS) url.searchParams.delete(key);
	if (id) url.searchParams.set(param, id);
	return url;
}

/**
 * Which record is open.
 *
 * Read from both places on purpose. `pushState` updates the address bar but not
 * `page.url` — shallow routing's reactive channel is `page.state` — while a
 * pasted or reloaded URL arrives with the query parameter and no state at all.
 * Checking state first and falling back to the URL covers both without the
 * caller caring which happened.
 */
export const openIdFrom = (source, param) => {
	// Callers may hand us `page` or, historically, `page.url`.
	const isPage = source && typeof source === 'object' && 'url' in source;
	const url = isPage ? source.url : source;
	const state = isPage ? source.state : undefined;

	if (state && param in state) return state[param];
	return url?.searchParams?.get(param) ?? null;
};

/**
 * Open a record. This pushes a history entry, so Back closes the modal — the
 * gesture people reach for on a phone.
 */
export function openModal(param, id) {
	pushState(urlWith(param, id), { crmModal: true, [param]: id });
}

/**
 * Step to another record in the same set. Replaces rather than pushes: walking
 * 40 cards with the arrow keys shouldn't cost 40 presses of Back to undo.
 */
export function selectModal(param, id) {
	replaceState(urlWith(param, id), { crmModal: true, [param]: id });
}

/**
 * Close. Going back keeps the history stack tidy when we were the ones who
 * pushed; landing here from a pasted URL has no entry of ours to pop, so the
 * parameter is stripped in place instead.
 */
export function closeModal() {
	if (page.state?.crmModal) history.back();
	else replaceState(urlWith(null, null), {});
}

/**
 * Clearing both channels at once. Used when a record stops existing under the
 * modal — accepting a candidate, say — where going back would land on a URL
 * pointing at something that has moved on.
 */
export function clearModal(param) {
	replaceState(urlWith(param, null), {});
}
