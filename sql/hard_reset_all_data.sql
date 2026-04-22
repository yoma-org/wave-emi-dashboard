-- ============================================================================
-- Hard Reset — All Application Data
-- ============================================================================
-- Purpose: Clear all ticket + queue + log data for a clean slate (e.g., before
--          client handover, fresh testing environment, or end-of-quarter reset).
--
-- What it DOES:
--   1. TRUNCATEs all ticket-related tables (parent + children via CASCADE)
--   2. TRUNCATEs activity_log
--   3. TRUNCATEs email_queue (KAN-46 durable queue)
--   4. Drops the legacy `tickets` table (superseded by tickets_v2 via
--      Binh + DK's Apr 10 refactor; no live runtime references verified)
--
-- What it PRESERVES:
--   - All table SCHEMAS (tickets_v2, ticket_emails, ticket_attachments,
--     ticket_vision_results, ticket_employee_extractions, activity_log,
--     email_queue, worker_config)
--   - The `tickets_flat` VIEW (read path for dashboard)
--   - RLS policies, indexes, triggers
--   - `worker_config` rows (webhook URL + secret needed by v13.2 trigger)
--   - Database trigger: notify_worker_on_queue_insert()
--   - pg_cron scheduled jobs
--   - Storage bucket STRUCTURE (but see "Manual step" below for blob cleanup)
--
-- Run this in Supabase SQL Editor. Review pre/post counts before committing.
--
-- Date first written: 2026-04-20
-- Reusable: yes — run whenever a clean slate is needed
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 1 — Pre-check: baseline row counts (remember these numbers)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'PRE-RESET baseline' AS phase;

SELECT
  (SELECT COUNT(*) FROM tickets_v2)                     AS tickets_v2,
  (SELECT COUNT(*) FROM ticket_emails)                  AS ticket_emails,
  (SELECT COUNT(*) FROM ticket_attachments)             AS ticket_attachments,
  (SELECT COUNT(*) FROM ticket_vision_results)          AS ticket_vision_results,
  (SELECT COUNT(*) FROM ticket_employee_extractions)    AS ticket_employee_extractions,
  (SELECT COUNT(*) FROM activity_log)                   AS activity_log,
  (SELECT COUNT(*) FROM email_queue)                    AS email_queue,
  (SELECT COUNT(*) FROM worker_config)                  AS worker_config_preserved;

-- Legacy table check — information_schema only (do NOT query public.tickets
-- inside THEN, because Postgres parses the whole CASE branch regardless of
-- the EXISTS evaluation. On a DB that already dropped the table the parse
-- fails with 42P01. Bug caught Apr 22, 2026 during KAN-47 post-ship reset.)
SELECT CASE
  WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tickets'
  ) THEN 'Legacy tickets table EXISTS — will be dropped in Step 3'
  ELSE 'Legacy tickets table does not exist — drop step is a no-op'
END AS legacy_tickets_status;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 2 — TRUNCATE all data tables
-- ─────────────────────────────────────────────────────────────────────────────
-- CASCADE handles FK dependencies; RESTART IDENTITY resets any sequences.
TRUNCATE TABLE
  ticket_employee_extractions,
  ticket_vision_results,
  ticket_attachments,
  ticket_emails,
  tickets_v2,
  activity_log,
  email_queue
CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 3 — Drop legacy `tickets` table (pre-Apr-10 refactor artifact)
-- ─────────────────────────────────────────────────────────────────────────────
-- Verified safe 2026-04-20:
--   - Live pipelines (spooler v1, worker v2, v12 rollback) call /api/webhook
--     which uses tickets_v2 (not legacy tickets)
--   - index.html uses tickets_v2 (write) + tickets_flat (read view)
--   - Only reference was api/webhook-legacy.js — archived 2026-04-20
DROP TABLE IF EXISTS public.tickets CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 4 — Post-check: verify all data tables are empty
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'POST-RESET verification' AS phase;

SELECT
  (SELECT COUNT(*) FROM tickets_v2)                     AS tickets_v2,
  (SELECT COUNT(*) FROM ticket_emails)                  AS ticket_emails,
  (SELECT COUNT(*) FROM ticket_attachments)             AS ticket_attachments,
  (SELECT COUNT(*) FROM ticket_vision_results)          AS ticket_vision_results,
  (SELECT COUNT(*) FROM ticket_employee_extractions)    AS ticket_employee_extractions,
  (SELECT COUNT(*) FROM activity_log)                   AS activity_log,
  (SELECT COUNT(*) FROM email_queue)                    AS email_queue;

-- Expected result: all zeros.

-- Confirm worker_config is untouched (schema: id, worker_url, webhook_secret,
-- updated_at — single-row table with id=1). url_len ~60, secret_len=64.
SELECT
  id,
  LENGTH(worker_url) AS url_len,
  LENGTH(webhook_secret) AS secret_len,
  updated_at
FROM worker_config;

-- Confirm legacy tickets is gone
SELECT CASE
  WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tickets'
  ) THEN 'WARNING: legacy tickets table still exists'
  ELSE 'OK: legacy tickets table dropped'
END AS legacy_tickets_status;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 5 — Review, then COMMIT (or ROLLBACK)
-- ─────────────────────────────────────────────────────────────────────────────
-- After reviewing the POST-RESET counts above, choose one:
--   COMMIT;     -- to make the reset permanent
--   ROLLBACK;   -- to abort and restore pre-reset state

COMMIT;

-- ============================================================================
-- Manual step (cannot be done in pure SQL — requires Supabase Dashboard or CLI)
-- ============================================================================
-- Storage bucket cleanup:
--   1. Open Supabase Dashboard → Storage
--   2. Select the bucket used for ticket attachments (e.g., `private` or
--      `ticket-attachments`)
--   3. Select all objects → Delete
--   4. Alternatively via CLI:
--      supabase storage rm --project-ref dicluyfkfqlqjwqikznl \
--        --recursive ss:///private/
--
-- Why SQL can't do it:
--   - `storage.objects` rows can be deleted via SQL, but the physical S3 blobs
--     won't be reclaimed (they become orphans, consuming storage + costing money)
--   - The Dashboard / CLI path cleans both the metadata and the blobs atomically
--
-- Verification after storage cleanup:
--   SELECT COUNT(*) FROM storage.objects;   -- should be 0 for the reset bucket
-- ============================================================================

-- Reset complete. Myanmar team can now start testing against a fresh database.
