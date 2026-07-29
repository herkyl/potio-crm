// HTTP Basic Auth (SPEC §5.2). This produces the native browser password
// prompt, which is the whole point — no login page, no session store, no user
// table for a single-user app.
//
// Basic auth base64-encodes credentials, it does not encrypt them. This must be
// served over HTTPS in production.

import { timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';

const CHALLENGE = {
	'WWW-Authenticate': 'Basic realm="Potio CRM", charset="UTF-8"'
};

/** Length-independent constant-time compare, so timing can't leak the password. */
function safeEqual(a, b) {
	const bufA = Buffer.from(a ?? '', 'utf8');
	const bufB = Buffer.from(b ?? '', 'utf8');
	if (bufA.length !== bufB.length) {
		// Still burn a comparison so the mismatch-length path isn't measurably faster.
		timingSafeEqual(bufA, bufA);
		return false;
	}
	return timingSafeEqual(bufA, bufB);
}

function isAuthorised(request) {
	const user = env.AUTH_USER;
	const password = env.AUTH_PASSWORD;

	// Fail closed in production. An unconfigured deploy locks everyone out
	// rather than silently publishing a list of leads.
	if (!user || !password) return dev;

	const header = request.headers.get('authorization') ?? '';
	const expected = 'Basic ' + Buffer.from(`${user}:${password}`, 'utf8').toString('base64');
	return safeEqual(header, expected);
}

export async function handle({ event, resolve }) {
	if (!isAuthorised(event.request)) {
		return new Response('Unauthorized', { status: 401, headers: CHALLENGE });
	}

	const response = await resolve(event);
	// A page listing leads should never be indexed, whatever links to it.
	response.headers.set('X-Robots-Tag', 'noindex, nofollow');
	return response;
}
