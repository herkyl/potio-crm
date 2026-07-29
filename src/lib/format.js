// Small display helpers shared across components.

const AVATAR_COLORS = [
	'var(--c-blue)',
	'var(--c-green)',
	'var(--c-purple)',
	'var(--c-orange)',
	'var(--c-pink)',
	'var(--c-teal)',
	'var(--c-slate)'
];

/** Stable colour per id, so a person keeps the same avatar between sessions. */
export function avatarColor(id = '') {
	let hash = 0;
	for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
	return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function initials(name = '') {
	const parts = String(name).trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return '?';
	if (parts.length === 1) return parts[0][0].toUpperCase();
	return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** The reference's compact age pattern: 1m / 30m / 2h / 5d / 1w / Jan 5. */
export function shortAge(iso, now = Date.now()) {
	if (!iso) return '';
	const then = new Date(iso).getTime();
	if (Number.isNaN(then)) return '';

	const mins = Math.floor((now - then) / 60_000);
	if (mins < 1) return 'now';
	if (mins < 60) return `${mins}m`;

	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h`;

	const days = Math.floor(hours / 24);
	if (days < 7) return `${days}d`;

	const weeks = Math.floor(days / 7);
	if (weeks < 5) return `${weeks}w`;

	return new Date(then).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** Prose form of `shortAge`, for running text. Avoids "now ago". */
export function ago(iso, now = Date.now()) {
	const age = shortAge(iso, now);
	if (!age) return '';
	if (age === 'now') return 'just now';
	return `${age} ago`;
}

export function fullDate(iso) {
	if (!iso) return '';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '';
	return d.toLocaleString('en-GB', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}

export function daysBetween(iso, now = Date.now()) {
	if (!iso) return null;
	return Math.floor((now - new Date(iso).getTime()) / 86_400_000);
}

export function truncate(text, max = 120) {
	if (!text) return '';
	const clean = String(text).replace(/\s+/g, ' ').trim();
	return clean.length > max ? clean.slice(0, max - 1).trimEnd() + '…' : clean;
}

export const percent = (n) => (n === null || n === undefined ? '' : `${Math.round(n * 100)}%`);

/** Safe JSON.parse for the *_json columns, which are text and may be null. */
export function parseJson(value, fallback = null) {
	if (!value) return fallback;
	try {
		return JSON.parse(value);
	} catch {
		return fallback;
	}
}
