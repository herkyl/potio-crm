// Opening a record must never change which view you are on.
//
// The card modal used to live at /board/[prospectId], which meant opening a row
// from the list navigated to the board and left you there. The open record is a
// query parameter on the current page instead, applied with shallow routing so
// no load function re-runs and the view underneath is never torn down.
//
//   ?prospect=<id>   a card on the board / in the list
//   ?candidate=<id>  a not-yet-accepted lead in triage
//
// Which record is open is held in *component state*, not read back out of
// `page`. That matters: `pushState` updates the address bar but not `page.url`,
// and `page.state` — shallow routing's reactive channel — is wiped by any
// `invalidate()`. Depending on either meant a background refresh closed the
// modal mid-edit. Local state is immune, so views can refresh the moment
// something changes and the modal stays put.

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
 * Call once at component top level. Returns the open id plus the three things a
 * view does with it.
 *
 * @param {string} param 'prospect' | 'candidate'
 */
export function createModalNav(param) {
	// Seeded from the URL so a pasted or reloaded link opens the same record,
	// and so SSR and the first client render agree.
	let id = $state(page.url.searchParams.get(param));

	// Whether *we* pushed the history entry. Tracked locally rather than read
	// from `page.state`, for the same reason as `id`.
	let pushed = false;

	// Back/forward is a real navigation, and should open or close accordingly.
	$effect(() => {
		const sync = () => {
			id = new URL(location.href).searchParams.get(param);
			if (!id) pushed = false;
		};
		window.addEventListener('popstate', sync);
		return () => window.removeEventListener('popstate', sync);
	});

	return {
		get id() {
			return id;
		},

		/** Pushes a history entry, so Back closes the modal. */
		open(next) {
			id = next;
			pushed = true;
			pushState(urlWith(param, next), { crmModal: true });
		},

		/**
		 * Step to another record in the same set. Replaces rather than pushes:
		 * walking 40 cards with the arrow keys shouldn't cost 40 presses of Back.
		 */
		select(next) {
			id = next;
			replaceState(urlWith(param, next), { crmModal: true });
		},

		close() {
			id = null;
			if (pushed) {
				pushed = false;
				history.back();
			} else {
				// Arrived here from a pasted URL — no entry of ours to pop.
				replaceState(urlWith(param, null), {});
			}
		}
	};
}
