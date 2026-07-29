// The app's database handle. One client per server instance.

import { env } from '$env/dynamic/private';
import { createDb } from './client.js';

let _db = null;

export function db() {
	if (!_db) {
		_db = createDb(env.TURSO_DATABASE_URL, env.TURSO_AUTH_TOKEN);
	}
	return _db;
}
