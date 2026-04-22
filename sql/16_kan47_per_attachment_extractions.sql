-- ============================================================================
-- EMI Dashboard — KAN-47 per-attachment extraction storage
-- Date: 2026-04-22
-- Context:
--   Layer C (v13.3 pipeline) produces per-attachment extraction data
--   (company, amount, currency, payment_date, employees[], etc.) in the
--   webhook payload's attachments[] array. Before this migration, webhook.js
--   only persisted a narrow subset (vision_parsed/confidence/document_type/
--   document_signers/amount_on_document) and dropped the rest on the floor.
--
--   Layer D's multi-column SBS table needs to compare per-attachment values
--   side-by-side (Att 1 Company vs Att 2 Company vs Email Company). With
--   only ticket-level fields today, all attachment columns would render
--   identical values.
--
-- Strategy:
--   Single JSONB column on ticket_vision_results. Captures the full per-
--   attachment extracted object verbatim (minus base64, which is already
--   in Storage). Backward-compatible: existing rows default to '{}'::jsonb.
--
--   tickets_flat VIEW does NOT need recreation — it only surfaces one
--   vision row per ticket via LATERAL LIMIT 1, and doesn't reference
--   this new column. No view dependency → no DROP VIEW + recreate dance.
--
-- Run AFTER 15_kan47_widen_mime_type.sql
-- ============================================================================

BEGIN;

-- ─── STEP 1: Add extracted_fields JSONB column ─────────────────────────────
-- Default '{}'::jsonb so legacy rows have a non-null baseline and dashboard
-- can safely do `row.extracted_fields?.company` without coalescing everywhere.
-- IF NOT EXISTS for re-run safety on environments that already ran partially.

ALTER TABLE ticket_vision_results
  ADD COLUMN IF NOT EXISTS extracted_fields JSONB NOT NULL DEFAULT '{}'::jsonb;


-- ─── STEP 2: Index for JSONB lookups (optional but cheap) ─────────────────
-- GIN index supports `extracted_fields @> '{"company": "..."}'` style queries
-- if we ever want to filter the dashboard by per-document values. Not used
-- by Layer D's current query path (ticket_id-keyed), but low-cost insurance.

CREATE INDEX IF NOT EXISTS idx_ticket_vision_extracted_fields_gin
  ON ticket_vision_results USING GIN (extracted_fields);


COMMIT;


-- ─── STEP 3: Verification queries (run after migration) ────────────────────
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'ticket_vision_results' AND column_name = 'extracted_fields';
-- Expected: 1 row — jsonb, NO, '{}'::jsonb

-- SELECT indexname FROM pg_indexes
-- WHERE tablename = 'ticket_vision_results' AND indexname = 'idx_ticket_vision_extracted_fields_gin';
-- Expected: 1 row

-- -- Smoke test: insert a row with extracted_fields, read it back
-- -- (requires a real ticket_id — skip on first deploy, run on next test ticket)


-- ─── EXPECTED SHAPE of extracted_fields (per-attachment, from Parse v3) ────
-- {
--   "company":                   "ACME Myanmar",
--   "amount":                    5000000,
--   "currency":                  "MMK",
--   "payment_date":              "2026-04-25",
--   "payroll_period":            "April 2026",
--   "initiator_name":            "Kim Lee",
--   "purpose":                   "Monthly salary disbursement",
--   "cost_center":               "CC-OPS-001",
--   "corporate_wallet":          "1200000289",
--   "doc_company_name":          "ACME MYANMAR LTD",
--   "doc_payment_date":          "25-Apr-2026",
--   "doc_initiator_name":        "Kim Lee",
--   "doc_purpose":               "April payroll",
--   "doc_cost_center":           "CC-OPS-001",
--   "employees":                 [{"name": "...", "msisdn": "...", "amount": ...}, ...],
--   "employee_count":            47,
--   "total_amount_on_document":  5000000
-- }
--
-- Fields with dedicated columns on ticket_vision_results (vision_parsed,
-- vision_confidence, vision_status, document_type, document_signers,
-- amount_on_document) are NOT duplicated inside extracted_fields — they
-- stay in their existing columns for backward compat + query ergonomics.


-- ─── ROLLBACK (if needed) ──────────────────────────────────────────────────
-- BEGIN;
-- DROP INDEX IF EXISTS idx_ticket_vision_extracted_fields_gin;
-- ALTER TABLE ticket_vision_results DROP COLUMN IF EXISTS extracted_fields;
-- COMMIT;
-- NOTE: rollback destroys per-attachment data. Only run if Layer D is
-- fully reverted AND you're sure no dashboard code still reads the column.
