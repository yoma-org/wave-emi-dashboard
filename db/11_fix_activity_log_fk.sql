-- ============================================================================
-- EMI Dashboard — Fix activity_log FK after schema refactoring
-- Date: April 13, 2026 — 3:30 PM
-- Issue: activity_log has FK pointing to OLD tickets table (pre-refactor).
--        Inserts for TKT-012+ fail silently (FK violation).
-- Root cause: Schema refactor added tickets_v2 but kept old FK on activity_log.
-- Impact: No audit log entries for TKT-012 through TKT-020 (9 tickets missing).
-- Fix: Drop old FK, add new FK to tickets_v2.ticket_number.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- Step 1: Drop outdated FK (points to old tickets table)
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE activity_log DROP CONSTRAINT IF EXISTS activity_log_ticket_id_fkey;

-- ────────────────────────────────────────────────────────────────────────────
-- Step 2: Add new FK pointing to tickets_v2.ticket_number
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE activity_log
  ADD CONSTRAINT activity_log_ticket_id_fkey
  FOREIGN KEY (ticket_id)
  REFERENCES tickets_v2(ticket_number)
  ON DELETE CASCADE;

-- ────────────────────────────────────────────────────────────────────────────
-- Step 3: Verify FK now points to correct table
-- ────────────────────────────────────────────────────────────────────────────
SELECT conname, confrelid::regclass AS refs_table
FROM pg_constraint
WHERE conrelid = 'activity_log'::regclass AND contype = 'f';
-- Expected: 1 row, refs_table = tickets_v2

-- ────────────────────────────────────────────────────────────────────────────
-- Step 4: Backfill missing CREATE entries for TKT-012 through TKT-020
-- ────────────────────────────────────────────────────────────────────────────
INSERT INTO activity_log (ticket_id, action, message, created_at)
SELECT
  ticket_number,
  'CREATE',
  ticket_number || ' auto-created via n8n from ' || company,
  created_at
FROM tickets_v2
WHERE ticket_number NOT IN (
  SELECT DISTINCT ticket_id FROM activity_log WHERE ticket_id IS NOT NULL
)
AND n8n_source = true;

-- ────────────────────────────────────────────────────────────────────────────
-- Step 5: Verify backfill
-- ────────────────────────────────────────────────────────────────────────────
SELECT ticket_id, action, message
FROM activity_log
WHERE ticket_id IN ('TKT-012','TKT-013','TKT-014','TKT-015','TKT-016','TKT-017','TKT-018','TKT-019','TKT-020')
ORDER BY ticket_id;
-- Expected: 9 rows (one per ticket)

-- ────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (if needed)
-- ────────────────────────────────────────────────────────────────────────────
-- ALTER TABLE activity_log DROP CONSTRAINT activity_log_ticket_id_fkey;
-- ALTER TABLE activity_log ADD CONSTRAINT activity_log_ticket_id_fkey
--   FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE;
