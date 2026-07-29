// Per-request query accounting. Turso runs over HTTP, so every statement is a
// network round trip — the number of queries per request matters far more than
// the cleverness of any one of them. This makes that number visible.
//
// AsyncLocalStorage rather than a module-level counter so concurrent requests
// can't contaminate each other's totals.

import { AsyncLocalStorage } from 'node:async_hooks';

const store = new AsyncLocalStorage();

/** Enabled by default in dev; set CRM_TRACE=0 to silence, CRM_TRACE=1 to force on. */
export function tracingEnabled(dev) {
	const flag = process.env.CRM_TRACE;
	if (flag === '0') return false;
	if (flag === '1') return true;
	return !!dev;
}

export function runTracked(fn) {
	return store.run({ count: 0, dbMs: 0, queries: [] }, fn);
}

export function record(sql, ms) {
	const current = store.getStore();
	if (!current) return;
	current.count++;
	current.dbMs += ms;
	current.queries.push({ sql: squash(sql), ms });
}

export function report() {
	return store.getStore();
}

/** First meaningful line of a statement, for a readable log. */
function squash(sql) {
	return String(sql).replace(/\s+/g, ' ').trim().slice(0, 110);
}

/**
 * One line per request, plus the slowest statements when a request is heavy.
 * The point is to answer "server, network, or client?" without guessing.
 */
export function logRequest({ method, path, status, totalMs }) {
	const stats = report();
	if (!stats) return;

	const { count, dbMs, queries } = stats;
	const appMs = Math.max(0, totalMs - dbMs);
	const heavy = count > 5 || dbMs > 300;

	console.log(
		`${heavy ? '⚠ ' : '  '}${method} ${path} ${status} — ${totalMs}ms total · ` +
			`${count} ${count === 1 ? 'query' : 'queries'} ${Math.round(dbMs)}ms db · ${Math.round(appMs)}ms app`
	);

	if (heavy) {
		for (const q of [...queries].sort((a, b) => b.ms - a.ms).slice(0, 5)) {
			console.log(`      ${String(Math.round(q.ms)).padStart(5)}ms  ${q.sql}`);
		}
	}
}
