-- ============================================================================
-- EMI Dashboard — Harden activity_log (append-only for anon)
-- Date: April 13, 2026 — 3:40 PM
-- Issue: Testing showed anon can DELETE from activity_log (audit violation).
-- Expected: activity_log should be INSERT + SELECT only for anon.
--           UPDATE and DELETE must be blocked (audit trail integrity).
-- Fix: Ensure RLS is enabled. Add explicit deny for UPDATE/DELETE via
--      restrictive policy that always returns false.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- Step 1: Diagnose — check current RLS status and policies
-- ────────────────────────────────────────────────────────────────────────────
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
WHERE c.relname = 'activity_log';
-- If rls_enabled = false, we have the bug

SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'activity_log'
ORDER BY policyname;
-- Shows all current policies

-- ────────────────────────────────────────────────────────────────────────────
-- Step 2: Force RLS ON (idempotent)
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log FORCE ROW LEVEL SECURITY;
-- FORCE applies RLS even to the table owner (safer for production)

-- ────────────────────────────────────────────────────────────────────────────
-- Step 3: Revoke blanket DELETE/UPDATE from anon at the GRANT level
-- ────────────────────────────────────────────────────────────────────────────
REVOKE DELETE, UPDATE, TRUNCATE ON activity_log FROM anon;
-- Belt-and-suspenders: even if RLS misbehaves, no DELETE/UPDATE grant.

-- Keep INSERT and SELECT grants (needed for dashboard to log user actions)
GRANT SELECT, INSERT ON activity_log TO anon;

-- ────────────────────────────────────────────────────────────────────────────
-- Step 4: Verify
-- ────────────────────────────────────────────────────────────────────────────
SELECT
  grantee,
  string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE table_name = 'activity_log' AND grantee = 'anon'
GROUP BY grantee;
-- Expected: anon has INSERT, SELECT only (no DELETE, no UPDATE)

-- ────────────────────────────────────────────────────────────────────────────
-- Step 5: Also harden tickets_v2 delete prevention
-- ────────────────────────────────────────────────────────────────────────────
-- (We already have SELECT + UPDATE policies on tickets_v2.
--  Ensure DELETE is also blocked at GRANT level.)
REVOKE DELETE, TRUNCATE ON tickets_v2 FROM anon;
REVOKE DELETE, TRUNCATE ON ticket_emails FROM anon;
REVOKE DELETE, TRUNCATE ON ticket_attachments FROM anon;
REVOKE DELETE, TRUNCATE ON ticket_vision_results FROM anon;
REVOKE DELETE, TRUNCATE ON ticket_employee_extractions FROM anon;

-- ────────────────────────────────────────────────────────────────────────────
-- Step 6: Final audit — show ALL anon grants on our tables
-- ────────────────────────────────────────────────────────────────────────────
SELECT
  table_name,
  string_agg(privilege_type, ', ' ORDER BY privilege_type) AS anon_can
FROM information_schema.role_table_grants
WHERE grantee = 'anon'
  AND table_name IN (
    'tickets_v2', 'ticket_emails', 'ticket_attachments',
    'ticket_vision_results', 'ticket_employee_extractions', 'activity_log'
  )
GROUP BY table_name
ORDER BY table_name;
-- Expected:
--   activity_log: INSERT, SELECT
--   tickets_v2: SELECT, UPDATE
--   ticket_emails: SELECT
--   ticket_attachments: SELECT
--   ticket_vision_results: SELECT
--   ticket_employee_extractions: SELECT
