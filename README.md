# Lead CRM

Triages candidates found by the [Skool scanner](../skool-crawl) and works them on a board.
SvelteKit 2 / Svelte 5, JavaScript only, plain scoped CSS. See [SPEC.md](SPEC.md).

**This app has no connection to LinkedIn.** No API, no scraping, no automation. The stages
are named after LinkedIn steps because that's the actual sales process, but every stage
change is a manual action: you send the invite in a normal browser tab, then come here and
move the card.

## Running it

```bash
npm install
npm run migrate   # additive; safe to re-run
npm run ingest    # pull classified members into source_leads
npm run dev
```

`.env` needs `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `AUTH_USER`, `AUTH_PASSWORD`.
See [.env.example](.env.example).

Auth is HTTP Basic, handled in [`src/hooks.server.js`](src/hooks.server.js) — you get the
native browser password prompt. If the credentials are unset the app allows access in dev
and refuses every request in production, so an unconfigured deploy locks itself rather than
publishing a list of leads. **Must be served over HTTPS**: basic auth is base64, not encryption.

## Scripts

| Command | What it does |
|---|---|
| `npm run preflight` | Read-only row counts for every scanner and CRM table |
| `npm run migrate` | Applies `migrations/*.sql` in order, recorded in `schema_migrations` |
| `npm run ingest` | Copies classified members into `source_leads` |

## The database is shared and live

The scanner and this app use the same Turso database. This app **reads** `members`,
`member_classification`, `posts` and `post_classification`, and **writes only** to its own
five tables: `sources`, `source_leads`, `people`, `prospects`, `activities`.

Triage decisions are not reproducible — a rejected candidate cannot be re-derived. So:

- No `DROP`, `TRUNCATE`, or unqualified `DELETE` anywhere in this repo.
  `scripts/migrate.js` refuses to execute such a statement even if one appears in a migration file.
- Migrations are additive only. Anything subtractive is a manual, backed-up operation.
- There is no reset/seed script here, deliberately.

Take a dump before anything unusual:

```bash
turso db shell pricingsaas-skool-potio .dump > backup-$(date +%F).sql
```

## How the pieces fit

```
sources        registry of connectors
  │
source_leads   raw candidates: new | accepted | rejected
  │  accept — always a human decision
  ▼
people         canonical identity, deduped on linkedin_slug
  │
prospects      the pursuit; one card. stage + status.
```

**Ingest** ([`src/lib/server/ingest.js`](src/lib/server/ingest.js)) is insert-only with
`ON CONFLICT DO NOTHING`. That is what makes rejection sticky: the scanner runs hourly, and
without it every rejected candidate would come back as new forever. It never updates `status`.

**Accept** ([`src/lib/server/triage.js`](src/lib/server/triage.js)) matches identity by
normalised LinkedIn slug. With no slug but an exact name match it stops and asks — names are
not identities, so nothing auto-merges on one.

**Closing statuses** are `won`, `lost`, `parked` and `disqualified`. The last two distinctions
matter:

- `lost` — we engaged and it didn't work out. Real funnel drop-off data.
- `disqualified` — shouldn't have been accepted, or can't be worked (not ICP, no LinkedIn
  found, wrong person, competitor, inactive). Never in play, so counting it as lost would
  pollute the drop-off numbers.

Disqualified prospects **stay put** — they are never pushed back to the source. The record
that you tried is worth keeping, and they couldn't resurface anyway: ingest is
`ON CONFLICT DO NOTHING` and the candidate is already marked `accepted`.

Every pipeline count keys off `status = 'open'`, so all four closed statuses are excluded
from the worklist and sidebar by construction. The one exception is the rolling 7-day invite
counter, which deliberately ignores status — it measures requests actually sent against
LinkedIn's weekly cap, and disqualifying someone afterwards doesn't un-send the invite.

**Stage changes** ([`src/lib/server/prospects.js`](src/lib/server/prospects.js)) all go
through `changeStage`, whether triggered by a drag or by the modal. It writes the stage,
resets `stage_entered_at`, sets the milestone timestamp *only if not already set*, and
appends an `activities` row — atomically. The `COALESCE` on the milestone is what makes
backwards drags safe: moving a card back to Shortlist must not erase that you sent the
invite on the 3rd.

## Performance

Turso runs over HTTP, so **every statement is a network round trip**. The number of queries
per request matters more than the cleverness of any one of them, and N+1 patterns that are
invisible against local SQLite are brutal here.

In dev, every request logs its query count and timing:

```
  GET /board 200 — 112ms total · 3 queries 218ms db · 0ms app
```

(`db` can exceed `total` when queries run concurrently — that's the point.) Requests with
more than five queries or over 300ms of database time are marked `⚠` and list their slowest
statements. Set `CRM_TRACE=0` to silence it, `CRM_TRACE=1` to enable it in production.
Responses also carry a `Server-Timing` header, so the browser devtools network panel shows
the same split.

Three rules this codebase follows, learned the hard way:

- **Never `invalidateAll()` after a single edit.** It re-runs every load function on the
  page. Load functions call `depends('crm:board' | 'crm:prospect' | 'crm:counts')` so
  mutations can refresh precisely what they changed.
- **Mutations are optimistic.** A field edit or a stage drag updates local state
  immediately and reconciles in the background, rolling back on failure.
- **Independent queries go out concurrently.** If a query only needs an id, resolve that id
  as a subquery rather than awaiting a prior round trip for it.

## Layout

```
migrations/           numbered, additive SQL
scripts/              node entrypoints (migrate, ingest, preflight)
design/               the visual reference the tokens were read off
src/style/            tokens.less + base.less, imported once globally
src/lib/components/   shared UI
src/lib/server/       db access, ingest, triage, prospect mutations, queries
src/routes/           /sources, /sources/[id], /board, /board/[id], /list, /settings
```

Design tokens live in [`src/style/tokens.less`](src/style/tokens.less) as CSS custom
properties. Everything else is a scoped `<style lang="less">` block in the component that
owns it. No utility classes.

## Not built yet

- **Message draft generation** (SPEC §3.4.5, build step 9). The `outreach_draft` and
  `draft_generated_at` columns exist; nothing writes them.
- Drag-and-drop is wired but has only been verified through the same server path the modal
  uses. The stage `<select>` in the card modal is a complete alternative.
