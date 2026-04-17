-- ═══════════════════════════════════════════════════════════════════
-- KAN-46 Schema — v13.0 "Durable Queue Architecture"
-- Created: Apr 17, 2026
-- Author: DK + AI Council (7/7 consensus)
-- Purpose: Serialize n8n pipeline execution via Supabase queue
-- ═══════════════════════════════════════════════════════════════════
--
-- INSTRUCTIONS FOR DK:
--   1. Copy this entire file
--   2. Open Supabase SQL Editor: https://app.supabase.com/project/dicluyfkfqlqjwqikznl/sql
--   3. Paste and run
--   4. Scroll down to VERIFICATION section at bottom and run those too
--   5. Expected: all statements succeed, verification queries return rows
--
-- IDEMPOTENCY: All statements use CREATE ... IF NOT EXISTS or CREATE OR REPLACE
--   → Safe to re-run if first attempt partial-failed
--
-- ROLLBACK: See "ROLLBACK SECTION" at very bottom if you need to remove these
-- ═══════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────
-- 1. EMAIL QUEUE TABLE
-- ───────────────────────────────────────────────────────────────────
-- Purpose: Durable FIFO queue. Spooler INSERTs here immediately on email arrival.
-- Worker claims one row at a time via claim_next_email_job().
-- UNIQUE(message_id) prevents duplicate inserts (dedup safety net).
-- Status lifecycle: pending → processing → completed | failed
-- notification_sent: atomic "did I send the notification?" flag (Qwen's insight)
-- ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS email_queue (
  id                   BIGSERIAL PRIMARY KEY,
  message_id           TEXT UNIQUE NOT NULL,             -- Outlook email message ID
  from_address         TEXT,                             -- sender email address
  subject              TEXT,                             -- email subject (for dashboard)
  received_at          TIMESTAMPTZ DEFAULT NOW(),        -- when email arrived at emoney@zeyalabs.ai
  status               TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts             INTEGER NOT NULL DEFAULT 0,       -- incremented on each claim
  payload              JSONB NOT NULL DEFAULT '{}'::jsonb, -- full email metadata for worker
  error_message        TEXT,                             -- populated on 'failed' status
  notification_sent    BOOLEAN NOT NULL DEFAULT false,   -- atomic notification dedup
  locked_at            TIMESTAMPTZ,                      -- when claim happened (for TTL)
  locked_by            TEXT,                             -- n8n execution ID holding lock
  completed_at         TIMESTAMPTZ,                      -- when status → completed
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast "next pending job" queries (FIFO by received_at)
CREATE INDEX IF NOT EXISTS idx_email_queue_status_received
  ON email_queue (status, received_at);

-- Index for stuck-row detection (used by dead-letter view)
CREATE INDEX IF NOT EXISTS idx_email_queue_locked_at
  ON email_queue (locked_at) WHERE status = 'processing';


-- ───────────────────────────────────────────────────────────────────
-- 2. ATOMIC CLAIM RPC — claim_next_email_job()
-- ───────────────────────────────────────────────────────────────────
-- Purpose: Worker calls this to atomically claim ONE pending row.
-- Uses FOR UPDATE SKIP LOCKED to prevent race conditions.
-- Includes 5-min TTL recovery: reclaims rows stuck in 'processing' if crash.
-- Returns: the claimed row (with all fields) OR empty if queue empty / lock held.
-- ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION claim_next_email_job(p_worker_id TEXT DEFAULT 'unknown')
RETURNS SETOF email_queue
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  UPDATE email_queue
  SET status = 'processing',
      locked_at = NOW(),
      locked_by = p_worker_id,
      attempts = email_queue.attempts + 1,
      updated_at = NOW()
  WHERE id = (
    SELECT id FROM email_queue
    WHERE status = 'pending'
       OR (status = 'processing' AND locked_at < NOW() - INTERVAL '5 minutes')
    ORDER BY received_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;


-- ───────────────────────────────────────────────────────────────────
-- 3. ATOMIC NOTIFICATION CLAIM — claim_notification()
-- ───────────────────────────────────────────────────────────────────
-- Purpose: Worker calls BEFORE sending notification email.
-- Atomically marks notification_sent=true and returns whether this caller won.
-- Prevents: crash-recovery reclaim → double notification email to sender.
-- Returns: TRUE if caller should send notification, FALSE if already sent.
-- ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION claim_notification(p_message_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  rows_updated INTEGER;
BEGIN
  UPDATE email_queue
  SET notification_sent = true,
      updated_at = NOW()
  WHERE message_id = p_message_id
    AND notification_sent = false;

  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated > 0;
END;
$$;


-- ───────────────────────────────────────────────────────────────────
-- 4. MARK JOB COMPLETE — mark_email_completed()
-- ───────────────────────────────────────────────────────────────────
-- Purpose: Worker calls this at end of successful processing.
-- Sets status='completed' + completed_at + releases lock.
-- ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION mark_email_completed(p_message_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  rows_updated INTEGER;
BEGIN
  UPDATE email_queue
  SET status = 'completed',
      completed_at = NOW(),
      locked_at = NULL,
      locked_by = NULL,
      updated_at = NOW()
  WHERE message_id = p_message_id
    AND status = 'processing';

  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated > 0;
END;
$$;


-- ───────────────────────────────────────────────────────────────────
-- 5. MARK JOB FAILED — mark_email_failed()
-- ───────────────────────────────────────────────────────────────────
-- Purpose: Worker calls this on processing failure.
-- Captures error_message for debugging; releases lock so next poll can retry.
-- Worker logic decides: if attempts >= 3, leave as 'failed'; else status='pending' to retry.
-- ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION mark_email_failed(
  p_message_id TEXT,
  p_error_message TEXT,
  p_retry BOOLEAN DEFAULT false
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  rows_updated INTEGER;
  new_status TEXT;
BEGIN
  new_status := CASE WHEN p_retry THEN 'pending' ELSE 'failed' END;

  UPDATE email_queue
  SET status = new_status,
      error_message = p_error_message,
      locked_at = NULL,
      locked_by = NULL,
      updated_at = NOW()
  WHERE message_id = p_message_id;

  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated > 0;
END;
$$;


-- ───────────────────────────────────────────────────────────────────
-- 6. DEAD-LETTER INSPECTION VIEW — email_queue_stuck
-- ───────────────────────────────────────────────────────────────────
-- Purpose: Dashboard + debugging. Shows rows stuck in 'processing' >5 min.
-- If this view has rows, something crashed or is taking too long.
-- Operator can inspect and decide: retry (set status='pending') or mark failed.
-- ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW email_queue_stuck AS
SELECT
  id,
  message_id,
  from_address,
  subject,
  status,
  attempts,
  locked_at,
  locked_by,
  error_message,
  ROUND(EXTRACT(EPOCH FROM (NOW() - locked_at))/60, 1) AS stuck_minutes,
  received_at,
  updated_at
FROM email_queue
WHERE status = 'processing'
  AND locked_at < NOW() - INTERVAL '5 minutes'
ORDER BY locked_at ASC;


-- ───────────────────────────────────────────────────────────────────
-- 7. QUEUE STATUS SUMMARY VIEW — email_queue_summary
-- ───────────────────────────────────────────────────────────────────
-- Purpose: Fast dashboard counts. One row per status with count + avg age.
-- Dashboard polls this every ~5 sec to show "Pipeline Queue" card.
-- ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW email_queue_summary AS
SELECT
  status,
  COUNT(*) AS count,
  MIN(received_at) AS oldest_received_at,
  MAX(received_at) AS newest_received_at,
  ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - received_at)))/60, 1) AS avg_age_minutes
FROM email_queue
GROUP BY status;


-- ───────────────────────────────────────────────────────────────────
-- 8. UPDATED_AT TRIGGER (keeps updated_at fresh on any UPDATE)
-- ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION email_queue_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_email_queue_updated_at ON email_queue;
CREATE TRIGGER trg_email_queue_updated_at
  BEFORE UPDATE ON email_queue
  FOR EACH ROW
  EXECUTE FUNCTION email_queue_touch_updated_at();


-- ───────────────────────────────────────────────────────────────────
-- 9. RLS (Row Level Security) — follow existing pattern
-- ───────────────────────────────────────────────────────────────────
-- Supabase requires RLS for anon/auth access. We'll allow service_role only
-- (n8n uses service_role key). This matches existing tickets_v2 pattern.
-- ───────────────────────────────────────────────────────────────────

ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "email_queue_service_role_all" ON email_queue;

-- Service role (n8n) has full access
CREATE POLICY "email_queue_service_role_all"
  ON email_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant usage on sequences (for BIGSERIAL)
GRANT USAGE, SELECT ON SEQUENCE email_queue_id_seq TO service_role;

-- Grant execute on RPCs to service_role
GRANT EXECUTE ON FUNCTION claim_next_email_job(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION claim_notification(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION mark_email_completed(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION mark_email_failed(TEXT, TEXT, BOOLEAN) TO service_role;

-- Dashboard reads (anon role) for queue summary views only
GRANT SELECT ON email_queue_summary TO anon;
GRANT SELECT ON email_queue_stuck TO anon;


-- ═══════════════════════════════════════════════════════════════════
-- VERIFICATION SECTION — run these after the main script
-- ═══════════════════════════════════════════════════════════════════

-- V1: Verify email_queue table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'email_queue'
ORDER BY ordinal_position;
-- Expected: 14 columns matching the CREATE TABLE above

-- V2: Verify RPCs exist
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name IN (
  'claim_next_email_job',
  'claim_notification',
  'mark_email_completed',
  'mark_email_failed',
  'email_queue_touch_updated_at'
)
ORDER BY routine_name;
-- Expected: 5 rows

-- V3: Verify views exist
SELECT viewname FROM pg_views
WHERE viewname IN ('email_queue_stuck', 'email_queue_summary');
-- Expected: 2 rows

-- V4: Verify indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'email_queue';
-- Expected: 3+ indexes (PK, status_received, locked_at partial)

-- V5: Verify RLS enabled
SELECT rowsecurity FROM pg_tables WHERE tablename = 'email_queue';
-- Expected: true

-- V6: Test the flow with dummy data (OPTIONAL — run ONLY if you want a smoke test)
-- INSERT INTO email_queue (message_id, from_address, subject, payload)
--   VALUES ('test-message-001', 'test@example.com', 'Test email', '{"test": true}'::jsonb);
--
-- SELECT * FROM claim_next_email_job('test-worker-1');  -- should return the row we just inserted
-- SELECT * FROM email_queue WHERE message_id = 'test-message-001';  -- status should be 'processing'
--
-- SELECT claim_notification('test-message-001');  -- should return true
-- SELECT claim_notification('test-message-001');  -- should return false (already claimed)
--
-- SELECT mark_email_completed('test-message-001');  -- should return true
-- SELECT * FROM email_queue WHERE message_id = 'test-message-001';  -- status should be 'completed'
--
-- -- Cleanup test row
-- DELETE FROM email_queue WHERE message_id = 'test-message-001';


-- ═══════════════════════════════════════════════════════════════════
-- ROLLBACK SECTION — ONLY run if you need to fully remove this
-- ═══════════════════════════════════════════════════════════════════
-- UNCOMMENT BELOW TO ROLLBACK:
--
-- DROP TRIGGER IF EXISTS trg_email_queue_updated_at ON email_queue;
-- DROP FUNCTION IF EXISTS email_queue_touch_updated_at();
-- DROP FUNCTION IF EXISTS mark_email_failed(TEXT, TEXT, BOOLEAN);
-- DROP FUNCTION IF EXISTS mark_email_completed(TEXT);
-- DROP FUNCTION IF EXISTS claim_notification(TEXT);
-- DROP FUNCTION IF EXISTS claim_next_email_job(TEXT);
-- DROP VIEW IF EXISTS email_queue_summary;
-- DROP VIEW IF EXISTS email_queue_stuck;
-- DROP TABLE IF EXISTS email_queue CASCADE;
