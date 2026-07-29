# Lead CRM — Build Spec (v2)

Companion to ../skool-crawl/SPEC.md (the Skool scanner). The scanner finds and classifies people. This app is where they get triaged and worked.

---

## 0. Read this first: scope boundary

**This application has no connection to LinkedIn. None.** No API, no scraping, no browser automation, no extension code, no OAuth. It does not read from LinkedIn and it does not write to LinkedIn.

The pipeline stages are named after LinkedIn steps because that is the user's actual sales process, but **every stage change in this app is a manual action by the user.** They send the invite themselves in a normal browser tab, then come here and drag the card.

A Chrome extension may exist later. It will be a **separate project** talking to the same Turso database. Nothing in this repo anticipates it beyond the fact that the schema is sane. Do not build endpoints, tokens, or hooks "for the extension."

---

## 1. Vocabulary

Fixed terms. Use these exact words in code, UI, and commits.

| Term | Means | Table |
|------|-------|-------|
| **Source** | A place leads come from. Today: the PricingSaaS Skool group. | `sources` |
| **Candidate** | A raw, untriaged person from a source. Awaiting accept/reject. | `source_leads` |
| **Person** | A canonical human. Deduplicated. One row per real individual. | `people` |
| **Prospect** | An accepted candidate being actively worked. One card on the board. | `prospects` |

Flow: `candidate --accept--> person + prospect`. Rejecting a candidate creates nothing.

"Source" is the standard CRM term (Salesforce/HubSpot "Lead Source", Pipedrive "Source"). Use it in the UI too.

---

## 2. Core model

```
sources          registry of connectors
   │
source_leads     raw candidates. status: new | accepted | rejected
   │  (accept — a human decision, never automatic)
   ▼
people           canonical identity, deduped on linkedin_slug
   │
prospects        the pursuit. one card. stage + status.
```

Why the three layers:

- **Nothing enters the board automatically.** A scanner hit becomes a candidate and waits for a green button.
- **Future sources don't create duplicates.** A second source surfacing someone already in `people` attaches another `source_leads` row to that same person. The card then shows "found in 2 sources", which is a genuine signal.
- **Re-engagement stays clean.** Lost someone in March, retry in September: new `prospects` row, same `people` row, history intact.

Rule: **one open prospect per person** at a time. Enforced by a partial unique index.

---

## 3. Sections

### 3.1 Sources

Landing page lists each source as a card: name, enabled toggle, last synced, and counts — new / accepted / rejected. Today one source: PricingSaaS Skool. This doubles as scanner monitoring, so a silently dead cron is visible.

Clicking a source opens its **triage view**.

### 3.2 Triage view

A **list**, not a swipe deck. One view, no modes.

**The list.** A compact table of candidates, one row each:

- Name
- Headline / bio snippet (truncated)
- Classification label + confidence
- A short evidence hint (e.g. the flagging post title)
- Found-at
- **Accept** and **Reject** buttons on the row

Row actions are the fast path: when the call is obvious from the snippet, action it without opening anything. Multi-select with checkboxes for bulk accept/reject.

**The detail modal.** Clicking a row opens the full picture — the same modal component used elsewhere (§3.4), in a pre-acceptance variant:

- Name, headline/bio, location, links found on the profile
- Classification: label, confidence, and the **model's reasoning sentence**
- The evidence that flagged them, in full — for Skool, the help-request post: title, body, link, date
- Their other posts and group context
- **Editable fields**, so details can be corrected before accepting — LinkedIn URL especially (§3.4)

**Accept and Reject are available from both the list row and inside the modal.** Accepting from the modal closes it and returns to the list.

- **Accept** → creates/matches a `person`, creates a `prospect` in `shortlist`, marks candidate `accepted`.
- **Reject** → marks candidate `rejected`. Creates nothing.

Anything not actioned simply stays in **New**. There is no explicit skip.

**Undo last action**, available in the header. Cheap to build, and it means a misclick on a row button isn't permanent.

**Tabs:**

- **New** (default) — untriaged
- **Accepted** — each row links through to its prospect card on the board
- **Rejected** — reviewable, and **any rejected candidate can be accepted from here**, which promotes it normally. Rejection is never a dead end.
- **All**

Also filter by classification label and minimum confidence, plus text search. Default view is `label = PROSPECT` above the confidence threshold, with a one-click toggle to show everything — the classifier will be wrong sometimes and you want to catch that.

**Rejected candidates must never resurface as new.** The scanner runs hourly; without a sticky `rejected` status it would re-offer the same people forever. This is a correctness requirement, not a nicety.

### 3.3 Board

Kanban. Columns are **stages**; closing is a **status** change.

**Active stages, left to right:**

| Stage | Meaning | Moves on when |
|-------|---------|---------------|
| `shortlist` | Accepted, not yet contacted | You send the LinkedIn invite |
| `invite_sent` | Connection request sent, awaiting accept | They accept |
| `connected` | Accepted you, no message sent yet | You send the first message |
| `messaged` | First message sent, awaiting reply | They reply |
| `in_conversation` | Live dialogue | Turns into real business talk |
| `opportunity` | Call booked / scoping / proposal | Won or lost |

`connected` and `messaged` stay separate deliberately: the gap between "they accepted" and "I actually wrote" is where outreach dies, and that column is your daily worklist. `messaged` vs `in_conversation` is the waiting-on-them / live distinction that drives follow-up timing.

**Statuses (orthogonal to stage):** `open` · `won` · `lost` · `parked`

Won / Lost / Parked render as three **collapsed columns pinned right**, expandable on click — visible but not clogging. Each carries a soft background wash so the ends of the board read differently from the working stages (§6.3). Closing **retains the stage** the card died in, which gives funnel drop-off data for free. `parked` is the icebox: still interesting, wrong time.

**Column headers** show the stage name in small uppercase muted type, with the prospect count large and bold beneath it, plus a stale count alongside when non-zero. See §6.3.

**Mechanics:**

- Drag between any stages, both directions. No forced linearity.
- Reverse moves **preserve existing timestamps**. Dragging back to `shortlist` must not erase that you sent an invite on the 3rd.
- Every move appends an `activities` row (from_stage → to_stage, timestamp).
- Undo on the last action.
- Card face: name, headline, stage age, next action + due date, source badge(s), stale flag.
- **Stale flag** when days-in-stage exceeds a per-stage threshold. Suggested: shortlist 7, invite_sent 21, connected 3, messaged 7, in_conversation 5, opportunity 14. Visual only.
- Filters: source, stale only, next-action due, label/confidence, text search.

### 3.4 Card modal, and manual editing

**Every field is editable by hand.** The scanner is a starting point, not an authority. Inline edit on click, save on blur or explicit save. Specifically required: **LinkedIn URL is manually editable**, since many Skool profiles have it blank and it's the dedupe key. Paste a full URL and the app normalises it to a slug.

Also hand-editable: name, headline, location, company, website, and any other person field. Plus the ability to **create a person from scratch** (an "Add prospect manually" button on the board) for someone who never came through a source at all.

Modal sections:

1. **Identity** — all person fields, editable. Stage, status, next action + date.
2. **Provenance** — every source this person came from, when, plus the scanner's label, confidence, and reasoning string. Seeing *why* the AI flagged someone is what makes it trustworthy.
3. **Source context** — the flagging post in full (title, body, link, date, comments), their other posts, group join date, role.
4. **Timeline** — reverse-chron activities: stage moves, notes, manual log entries.
5. **Message draft** — generated first-message draft, with Copy / Regenerate / Edit. Generating a draft **never moves the card**.
6. **Notes** — append-only, timestamped, freeform.
7. **Close** — won / lost / parked, with optional reason.

### 3.5 List view

Board data as a sortable, filterable table with bulk edit. Add it early; past ~100 cards it's faster than dragging.

### 3.6 Worklist panel

Small dashboard strip: "N to invite · N connected awaiting message · N replies to handle · N next-actions due · invites sent this week: N."

The invite counter is derived from your own `invite_sent_at` timestamps in this database — not from LinkedIn. It exists because LinkedIn caps connection requests (roughly 100–200/week and they tighten it without notice), so a rolling 7-day count against a configurable soft cap is useful self-discipline. Advisory only.

---

## 4. Schema

Extends the scanner schema. SQLite/libSQL via Turso. ISO-8601 text timestamps.

```sql
CREATE TABLE IF NOT EXISTS sources (
  id             TEXT PRIMARY KEY,        -- 'pricingsaas_skool'
  name           TEXT NOT NULL,
  kind           TEXT,                    -- 'skool'
  enabled        INTEGER DEFAULT 1,
  last_synced_at TEXT,
  config_json    TEXT
);

CREATE TABLE IF NOT EXISTS source_leads (
  id            TEXT PRIMARY KEY,
  source_id     TEXT NOT NULL REFERENCES sources(id),
  external_id   TEXT NOT NULL,               -- Skool member id
  person_id     TEXT REFERENCES people(id),  -- set on accept
  status        TEXT NOT NULL DEFAULT 'new', -- new | accepted | rejected
  label         TEXT,                        -- SPECIALIST | PROSPECT | UNKNOWN
  confidence    REAL,
  reasoning     TEXT,
  evidence_json TEXT,                        -- flagging post: id, title, body, url, date
  snapshot_json TEXT,                        -- profile as captured, for display pre-accept
  found_at      TEXT DEFAULT (datetime('now')),
  triaged_at    TEXT,
  UNIQUE(source_id, external_id)
);
CREATE INDEX IF NOT EXISTS idx_source_leads_triage ON source_leads(source_id, status, found_at DESC);

CREATE TABLE IF NOT EXISTS people (
  id            TEXT PRIMARY KEY,
  full_name     TEXT,
  first_name    TEXT,
  last_name     TEXT,
  headline      TEXT,
  location      TEXT,
  company       TEXT,
  linkedin_slug TEXT UNIQUE,       -- dedupe key, e.g. 'serge-herkul'
  linkedin_url  TEXT,
  website_url   TEXT,
  notes         TEXT,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT
);

CREATE TABLE IF NOT EXISTS prospects (
  id                 TEXT PRIMARY KEY,
  person_id          TEXT NOT NULL REFERENCES people(id),
  stage              TEXT NOT NULL DEFAULT 'shortlist',
  status             TEXT NOT NULL DEFAULT 'open',  -- open | won | lost | parked
  close_reason       TEXT,
  next_action        TEXT,
  next_action_at     TEXT,
  stage_entered_at   TEXT,          -- reset every stage change, drives staleness
  -- milestones, never cleared on reverse moves
  shortlisted_at     TEXT,
  invite_sent_at     TEXT,
  connected_at       TEXT,
  first_message_at   TEXT,
  first_reply_at     TEXT,
  opportunity_at     TEXT,
  closed_at          TEXT,
  outreach_draft     TEXT,
  draft_generated_at TEXT,
  created_at         TEXT DEFAULT (datetime('now')),
  updated_at         TEXT
);
CREATE INDEX IF NOT EXISTS idx_prospects_board ON prospects(status, stage);
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_open_per_person
  ON prospects(person_id) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS activities (
  id          TEXT PRIMARY KEY,
  prospect_id TEXT NOT NULL REFERENCES prospects(id),
  type        TEXT NOT NULL,   -- stage_change | status_change | note |
                               -- invite_sent | accepted | message_sent |
                               -- message_received | draft_generated | field_edit
  from_stage  TEXT,
  to_stage    TEXT,
  body        TEXT,
  occurred_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_activities_prospect ON activities(prospect_id, occurred_at DESC);
```

### 4.1 Bridge from the scanner (this was previously unspecified)

The scanner writes `members` and `member_classification`. The CRM reads `source_leads`. Something must connect them.

Implement an **ingest step** that runs after each scanner pass (or as a CRM-side job, either is fine):

```
for each member with a classification and no matching source_leads row:
    INSERT INTO source_leads (source_id='pricingsaas_skool',
                              external_id=member.id,
                              label, confidence, reasoning,
                              evidence_json = flagging post if any,
                              snapshot_json = member profile,
                              status='new')
    ON CONFLICT(source_id, external_id) DO NOTHING
```

`ON CONFLICT DO NOTHING` is what makes rejection sticky — a rejected candidate is never reset to `new` on a later run. Do not update `status` from the ingest path, ever.

Whether the CRM surfaces all labels or only `PROSPECT` is a **view filter**, not an ingest filter. Ingest everything classified; let the UI decide what's shown. That way a misclassified specialist is still recoverable.

### 4.2 Identity matching on accept

1. Normalised LinkedIn slug matches an existing person → attach to them.
2. No slug, but exact name match within the same source → surface as "possible duplicate", human decides. **Never auto-merge on name alone.**
3. Otherwise create a new person.

Normalise slugs before comparing: lowercase, strip protocol/host, strip trailing slash, strip query params.

---

## 5. Stack

- **SvelteKit 2 / Svelte 5**, **JavaScript only — no TypeScript.** Use `jsconfig.json`. JSDoc comments are welcome for editor hints; `.ts` files are not.
- **Turso** via `@libsql/client`, same database as the scanner.
- **`svelte-dnd-action`** for drag and drop. (Not dnd-kit — that's React-only.)
- **Plain scoped CSS.** See §6. No Tailwind, no utility-class frameworks, no CSS-in-JS.
- **Gemini** for message drafts, server-side only, reusing the scanner's `generateObject` setup.
- Deploy target: whatever's simplest (Vercel adapter or node adapter). Single user, low traffic.

### 5.1 Existing project as reference

The user has an existing Svelte project. **Read it first** and match its conventions: folder structure, naming, store patterns, CSS organisation, component granularity, build config. Where this spec conflicts with established conventions in that repo, **the repo wins** — this spec's stack details are fallbacks, not mandates.

### 5.2 Auth

HTTP Basic Auth in `src/hooks.server.js`. This produces the native browser password prompt, which is exactly the desired UX and requires no login page, session store, or user table.

```js
// hooks.server.js — sketch
export async function handle({ event, resolve }) {
  const auth = event.request.headers.get('authorization');
  const expected = 'Basic ' + btoa(`${env.AUTH_USER}:${env.AUTH_PASSWORD}`);
  if (auth !== expected) {
    return new Response('Unauthorized', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="CRM", charset="UTF-8"' }
    });
  }
  return resolve(event);
}
```

Use a constant-time comparison for the credential check. Must be served over HTTPS — basic auth sends credentials base64-encoded, not encrypted. Credentials from env vars, never committed. Also send `X-Robots-Tag: noindex` on all responses; a page listing leads should never be indexed.

---

## 6. Visual design

Style insipiration image added as style-example.webp

The reference is a Kanban CRM shot the user likes: **white board area, columns as a barely-there warm gray, white cards with very light shadows, generous rounding, a single bright green accent.** Calm and airy. Not flat, not heavy, not bordered-boxy.

The tokens in §6.2 were read directly off that reference. Commit the image to the repo (e.g. `design/reference-board.webp`) and consult it for spacing and proportion, but §6.2 is the authority for values — text survives context loss, images don't.

### 6.1 Approach

- **Design tokens as CSS custom properties** in `src/lib/styles/tokens.css`, imported once globally.
- **Component styles in the component**, using Svelte's scoped `<style>` blocks.
- **Semantic class names** (`.card`, `.column-header`, `.stage-badge`). Not utility soup.
- A small `app.css` for reset and base element styles only.
- Prefer CSS Grid/Flex and custom properties over any framework. Nesting is fine (Svelte's preprocessor or plain modern CSS).

### 6.2 Tokens (read off the reference)

```css
:root {
  /* surfaces — note the hierarchy, it's inverted from typical Trello */
  --bg-canvas:     #efefed;   /* page behind the app frame, warm gray */
  --bg-app:        #ffffff;   /* the app shell and board area is WHITE */
  --bg-column:     #f6f6f5;   /* columns are a barely-there warm gray on white */
  --bg-card:       #ffffff;   /* cards are white, sitting on the gray column */
  --bg-hover:      #fafafa;
  --bg-sidebar:    #ffffff;

  /* tinted columns for terminal states */
  --bg-column-won:    #f1f8ee;
  --bg-column-lost:   #f7f6f6;
  --bg-column-parked: #faf8f3;

  /* text */
  --text-primary:   #171717;
  --text-secondary: #6b7280;
  --text-muted:     #9ca3af;

  /* lines */
  --border-subtle: #e8e8e6;
  --border-input:  #dfdfdc;

  /* radii — generous, this is the look */
  --radius-sm:   6px;
  --radius-md:  12px;   /* cards */
  --radius-lg:  14px;   /* columns, buttons */
  --radius-xl:  18px;   /* modals, app frame */
  --radius-pill: 999px;

  /* shadows — very light. cards barely lift off the column. */
  --shadow-card:  0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.05);
  --shadow-hover: 0 2px 4px rgba(16,24,40,.06), 0 4px 12px rgba(16,24,40,.07);
  --shadow-drag:  0 8px 24px rgba(16,24,40,.14);
  --shadow-modal: 0 12px 40px rgba(16,24,40,.16);
  --shadow-frame: 0 4px 24px rgba(16,24,40,.06);

  /* spacing */
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px;
  --space-4: 16px; --space-5: 24px; --space-6: 32px;

  /* type — reference uses a geometric grotesque; Inter is the closest free match */
  --font-sans: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --text-xs:   11px;  /* column header labels, meta counts */
  --text-sm:   13px;  /* secondary lines */
  --text-base: 14px;  /* body, names */
  --text-lg:   16px;  /* card titles */
  --text-2xl:  22px;  /* column totals */
  --text-3xl:  28px;  /* page title */

  --weight-normal: 400;
  --weight-medium: 500;
  --weight-semi:   600;
  --weight-bold:   700;

  /* brand + intent — the reference leans on a single bright green */
  --accent:        #86cf4a;   /* primary actions, active nav, brand */
  --accent-hover:  #78c23c;
  --accent-soft:   #edf7e8;   /* active nav background, won column tint source */
  --accent-text:   #3f7220;   /* green text on soft backgrounds */

  --accept:      #86cf4a;     /* same green — accept IS the primary action */
  --accept-soft: #edf7e8;
  --reject:      #dc2626;
  --reject-soft: #fee2e2;
  --warn:        #d97706;
  --warn-soft:   #fef3c7;

  /* avatar / label palette (reference uses saturated flat circles) */
  --c-blue: #3b82f6;  --c-green: #22c55e; --c-purple: #a855f7;
  --c-orange: #f97316; --c-pink: #ec4899; --c-teal: #14b8a6;
  --c-slate: #64748b;

  --transition: 140ms ease;
}
```

### 6.3 What the reference actually does (structural notes)

Three things worth copying, one thing worth noting as a correction to my earlier guess:

**Correction: the surface hierarchy is inverted.** I had assumed a gray canvas with lighter columns. The reference does the opposite — the board area is **white**, and columns are a **very faint warm gray** (`--bg-column`) with cards in **pure white** on top. The result reads as much airier than a typical Trello board. The gray canvas only appears *outside* the app frame. Build it this way.

**Colour-coded tag bars.** Cards carry 1–3 tiny rounded bars (~3px tall, ~28px wide, pill-radius) along the top edge, above the title. Cheap, quiet, scannable. Use them for **source badges** — one bar per source the person came from, so "found in 2 sources" is visible at a glance without text.

**Tinted terminal columns.** The final column in the reference has a soft green wash across the whole column, header included. Apply this to the status columns: Won gets `--bg-column-won`, Lost `--bg-column-lost`, Parked `--bg-column-parked`. It makes the ends of the board read differently from the working stages without adding chrome.

**Column headers carry an aggregate.** The reference shows a large bold total with a smaller count beside it. There's no deal value in this CRM (§9), so use: stage name in `--text-xs` uppercase with letter-spacing and `--text-secondary`, then the prospect count large and bold below it, with a stale count beside it in muted text when non-zero. A `…` menu sits top-right.

### 6.4 Card anatomy

The reference card maps almost one-to-one onto a prospect card. Follow this order:

```
┌──────────────────────────────────────┐
│ ▬▬  ▬▬                          ···  │  source tag bars, overflow menu
│ Jane Cooper                          │  name          --text-lg, semi
│ Founder & CEO, Slice                 │  headline      --text-sm, secondary
│ ⬤ PricingSaaS Skool                  │  source row w/ avatar
│ 📝 3   💬 1   ⏱ 5d          ⚠  1w   │  meta counts, stage age, stale flag
└──────────────────────────────────────┘
```

- **Tag bars** top edge, before the title.
- **Name** as the card title (this CRM's card is a person, not a deal).
- **Headline / company** as the secondary line, truncated to one line.
- **Avatar circle** with the person's initial, coloured from the palette above, deterministic by id so it stays stable.
- **Meta row**: small outline icons with counts (notes, activities), then stage age right-aligned in `--text-xs` muted, matching the reference's "1m / 30m / 2h / 1w / Jan 5" pattern.
- **Stale flag** rides in the meta row: the age text turns `--warn` and gains a small dot. No banner, no colour block.

### 6.5 App shell

The reference's shell is worth adopting wholesale since this spec never defined one:

- **Left sidebar**, white, ~240px, fixed. Grouped nav with small uppercase muted section labels. Nav items are icon + label, `--radius-lg`, and the **active item gets `--accent-soft` background with a green icon and dark text**. Collapsible via a chevron in the header.
  - Group 1: Board, List
  - Group 2: Sources
  - Bottom: settings / build info
- **Top bar**: page title in `--text-3xl` bold on the left; actions right-aligned. Primary action is a filled `--accent` button with a leading icon; secondary actions are white with `--border-subtle`, both at `--radius-lg`.
- **Sub-nav strip** below the title: the Board / List view toggle as icon+label tabs with a **green underline and green icon on the active tab**, a couple of inline summary stats (open prospects, due next actions), then search / filter / sort right-aligned.

### 6.6 Component notes

- **Cards:** `--bg-card`, `--radius-md`, `--shadow-card`, `--space-4` padding, `--space-3` gap between cards. Hover lifts to `--shadow-hover` with a 1px translate. Dragging gets `--shadow-drag` and a slight scale.
- **Columns:** `--bg-column`, `--radius-lg`, `--space-3` padding, `--space-4` between columns. Scrolls internally; the board scrolls horizontally.
- **Buttons:** `--radius-lg`, comfortable padding. Primary = filled accent, white text. Secondary = white, `--border-subtle`. Danger = `--reject`.
- **Triage buttons:** legible at row scale — accent green accept, red reject, clear hover/active. Larger and more prominent in the detail modal than in a list row.
- **Modal:** `--radius-xl`, `--shadow-modal`, dimmed backdrop, sticky header, scrollable body.
- Respect `prefers-reduced-motion`.

**Note on the reference:** it's a visual reference for surfaces, spacing, radii and shadow weight only. Do not copy its branding, its icon set, or its deal-oriented information architecture. This app has no revenue figures and no deal values.

---

## 7. Routes

```
/                          → redirect to /board
/sources                   → source list + health
/sources/[id]              → triage list (tab filters), modal on row click
/board                     → kanban
/board/[prospectId]        → card modal (over the board)
/list                      → table view
```

Server logic in `+page.server.js` load functions and form actions. Use SvelteKit **form actions** for mutations where practical (they work without JS and keep logic server-side). Fall back to `+server.js` endpoints for things that need to be fetch-driven, like drag-and-drop stage changes.

**One canonical stage-change path**, server-side, whether triggered by drag or by the modal. It must atomically: update `stage`/`status`, reset `stage_entered_at`, set the matching milestone timestamp **only if not already set**, and append an `activities` row. Do not duplicate this logic anywhere.

---

## 8. Build order

1. Schema + `sources` seed + the scanner→`source_leads` ingest step (§4.1).
2. Sources list page.
3. Triage list: rows, tabs, accept/reject from the row, bulk select. Verify rejection stays sticky across an ingest re-run.
4. Candidate detail modal, with accept/reject inside it and editable fields.
5. Board: columns, drag, canonical stage-change path, activity logging.
6. Card modal: full detail + manual field editing, especially LinkedIn.
7. Design token pass — make it look right.
8. List view, filters, worklist panel, next action + staleness.
9. Draft generation.

Steps 1–6 are the usable product.

---

## 9. Working with the existing database

**The target database already contains real data.** The scanner has been running and its tables hold classified members, posts, and sync state. Triage decisions made in this app are not reproducible — a rejected candidate cannot be re-derived. Treat the database as production from day one.

### 9.1 The migration is purely additive

This app adds five tables: `sources`, `source_leads`, `people`, `prospects`, `activities`. It does **not** modify, rename, or drop anything the scanner owns (`members`, `member_classification`, `posts`, `post_classification`, `sync_state`, `notifications`).

There are no `ALTER TABLE` statements, no column changes, and no data backfill. Every statement in §4 is `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`, which is a safe no-op against a live database. Applying the schema twice must be harmless.

### 9.2 Hard rules

These are not stylistic preferences.

- **Never** issue `DROP TABLE`, `DROP INDEX`, `TRUNCATE`, or unqualified `DELETE FROM` against this database.
- **Never** "rebuild the schema cleanly" to resolve a mismatch. If the live schema differs from `schema.sql`, stop and report the difference. Do not reconcile it destructively.
- **Never** run a reset/seed script against the real database. The scanner repo contains `scripts/reset-db.js`; it must refuse to run unless pointed at a database whose name contains `dev` or `test`, and it should not exist in this repo at all.
- **Never** modify the scanner's tables. This app reads `members` and `member_classification`; it writes only to its own five tables.
- SQLite's column-altering workaround (create new table → copy → drop old → rename) is **forbidden** here. If a future change genuinely needs it, surface it as a proposal for the user to run manually, with a backup taken first.

### 9.3 Build against a copy

Do not develop against the live database. Turso supports creating a new database seeded from an existing one, which gives a realistic dataset with zero risk:

```bash
# verify current syntax against `turso db create --help`
turso db create crm-dev --from-db <production-db-name>
turso db show crm-dev --url
turso db tokens create crm-dev
```

Point local `.env` at `crm-dev`. Switch to the real database only once triage, promote, and stage-change paths have been exercised end to end. Take a dump before that first real run:

```bash
turso db shell <production-db-name> .dump > backup-$(date +%F).sql
```

### 9.4 Migrations beyond the initial create

Idempotent `CREATE TABLE IF NOT EXISTS` covers the initial setup. For anything later, use a numbered migrations directory and a tracking table:

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    TEXT PRIMARY KEY,
  applied_at TEXT DEFAULT (datetime('now'))
);
```

`migrations/001_crm_tables.sql`, `002_...`, applied in order, each recorded on success and skipped if already present. Additive changes only: new tables, new indexes, and `ALTER TABLE ... ADD COLUMN` (which SQLite supports safely). Anything subtractive is a manual, backed-up operation by the user.

### 9.5 Pre-flight check

On first startup against any database, log a summary before writing anything: which of the expected tables exist, and row counts for `members`, `member_classification`, and each CRM table. If CRM tables already hold rows, that is a normal restart — do not reinitialise. This makes "am I about to clobber something" visible in one line.

---

## 10. Not in this project

- **Anything touching LinkedIn.** Restated because it matters: no API, no scraping, no automation, no extension. See §0.
- Multi-user, roles, permissions, assignment.
- Email / WhatsApp / other channels. `activities.type` is free-text, so adding one later needs no migration.
- Deal value, revenue forecasting, quotas.
- Automated sequences or scheduled sending.