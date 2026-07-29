// HTTP Basic Auth (SPEC §5.2). This produces the native browser password
// prompt, which is the whole point — no login page, no session store, no user
// table for a single-user app.
//
// Basic auth base64-encodes credentials, it does not encrypt them. This must be
// served over HTTPS in production.

import { timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';
import { runTracked, logRequest, report, tracingEnabled } from '$lib/server/instrument.js';

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

	if (!tracingEnabled(dev)) return withHeaders(await resolve(event));

	// Every Turso statement is an HTTP round trip, so the query count per request
	// is the number that actually matters. Log it rather than guess at it.
	return runTracked(async () => {
		const started = performance.now();
		const response = withHeaders(await resolve(event));
		const totalMs = Math.round(performance.now() - started);

		logRequest({
			method: event.request.method,
			path: event.url.pathname + event.url.search,
			status: response.status,
			totalMs
		});

		response.headers.set(
			'Server-Timing',
			`db;dur=${Math.round(report()?.dbMs ?? 0)}, total;dur=${totalMs}`
		);
		return response;
	});
}

/** A page listing leads should never be indexed, whatever links to it. */
function withHeaders(response) {
	response.headers.set('X-Robots-Tag', 'noindex, nofollow');
	return response;
}
