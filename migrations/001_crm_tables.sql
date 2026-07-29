-- CRM tables. Purely additive: nothing here touches the scanner's tables
-- (members, member_classification, posts, post_classification, sync_state,
-- notifications). Every statement is IF NOT EXISTS, so applying this twice
-- against a live database is a no-op. See SPEC §9.

CREATE TABLE IF NOT EXISTS sources (
  id             TEXT PRIMARY KEY,        -- 'pricingsaas_skool'
  name           TEXT NOT NULL,
  kind           TEXT,                    -- 'skool'
  enabled        INTEGER DEFAULT 1,
  last_synced_at TEXT,
  config_json    TEXT
);

-- Canonical identity, deduped on linkedin_slug. Created before source_leads,
-- which carries a foreign key to it.
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

-- Raw candidates awaiting a human accept/reject. `status` is sticky: the ingest
-- path only ever inserts, so a rejected candidate is never reset to 'new'.
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

-- The pursuit. One card on the board. Milestone timestamps are never cleared
-- on reverse moves, which is what makes dragging backwards safe.
CREATE TABLE IF NOT EXISTS prospects (
  id                 TEXT PRIMARY KEY,
  person_id          TEXT NOT NULL REFERENCES people(id),
  stage              TEXT NOT NULL DEFAULT 'shortlist',
  status             TEXT NOT NULL DEFAULT 'open',  -- open | won | lost | parked
  close_reason       TEXT,
  next_action        TEXT,
  next_action_at     TEXT,
  stage_entered_at   TEXT,          -- reset every stage change, drives staleness
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

-- The one source we have today. INSERT OR IGNORE so a re-run never clobbers
-- an edited name or a toggled `enabled` flag.
INSERT OR IGNORE INTO sources (id, name, kind, enabled)
VALUES ('pricingsaas_skool', 'PricingSaaS Skool', 'skool', 1);
