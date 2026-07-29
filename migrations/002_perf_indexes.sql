-- Performance indexes. Purely additive — CREATE INDEX IF NOT EXISTS only.
--
-- Found by EXPLAIN QUERY PLAN on the board query, which was doing
-- `SCAN source_leads` inside four correlated subqueries: a full scan of every
-- source_leads row, once per prospect. At 487 prospects × 1131 leads that is
-- ~2.2M row reads for a single board load.

-- The board and the card modal both look leads up by person. `status` is in the
-- index so the `status = 'accepted'` filter is satisfied without touching the
-- table, making it a covering index for the count/max aggregates.
CREATE INDEX IF NOT EXISTS idx_source_leads_person
  ON source_leads(person_id, status);

-- Triage resolves "which prospect does this candidate belong to" per row, and
-- the card modal loads provenance by person. The only existing index on
-- prospects(person_id) is partial (WHERE status = 'open'), so lookups for closed
-- or disqualified prospects fell back to a scan.
CREATE INDEX IF NOT EXISTS idx_prospects_person
  ON prospects(person_id);

-- The board orders by stage_entered_at and the list view sorts on it by default;
-- without this the query builds a temp B-tree on every load.
CREATE INDEX IF NOT EXISTS idx_prospects_stage_entered
  ON prospects(stage_entered_at DESC);

-- The worklist counts prospects with a next action falling due.
CREATE INDEX IF NOT EXISTS idx_prospects_next_action
  ON prospects(next_action_at)
  WHERE next_action_at IS NOT NULL;
