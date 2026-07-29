// LinkedIn URL handling. This app never talks to LinkedIn (SPEC §0) — these are
// string functions over text the user typed or the scanner captured.
//
// The slug is the dedupe key for `people`, so normalisation has to be strict:
// lowercase, no protocol or host, no trailing slash, no query string.

/**
 * Pull a canonical profile slug out of anything paste-shaped.
 * Accepts a bare slug, a /in/ URL, with or without protocol, www, locale
 * subdomain, tracking params or a trailing slash.
 * @returns {string | null}
 */
export function normaliseLinkedInSlug(input) {
	if (!input) return null;

	let value = String(input).trim();
	if (!value) return null;

	value = value.split(/[?#]/)[0]; // drop query + fragment
	value = value.replace(/^https?:\/\//i, '').replace(/^[a-z]{2,3}\.linkedin\.com/i, 'linkedin.com');
	value = value.replace(/^www\./i, '');
	value = value.replace(/^linkedin\.com/i, '');
	value = value.replace(/^\/?in\//i, '');
	value = value.replace(/\/+$/, '').replace(/^\/+/, '');

	// Anything with a slash left over isn't a profile URL (company pages, posts).
	if (!value || value.includes('/')) return null;

	const slug = decodeURIComponent(value).toLowerCase();
	return /^[a-z0-9\-_%.]+$/i.test(slug) ? slug : null;
}

export function linkedInUrlFromSlug(slug) {
	return slug ? `https://www.linkedin.com/in/${slug}` : null;
}
