import adapter from '@sveltejs/adapter-vercel';
import preprocess from 'svelte-preprocess';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: [preprocess({ less: true })],
	kit: {
		// Pinned so the build doesn't depend on whatever Node the machine happens
		// to run — the adapter refuses to infer a runtime from odd-numbered releases.
		adapter: adapter({ runtime: 'nodejs22.x' }),
		// Nothing here is prerenderable — every page reads the database behind basic auth.
		prerender: { entries: [] }
	}
};

export default config;
