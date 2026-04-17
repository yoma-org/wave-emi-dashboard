-- ═══════════════════════════════════════════════════════════════════
-- KAN-46 Schema Verification — run this after kan46_schema_v1.sql
-- ═══════════════════════════════════════════════════════════════════
-- Purpose: One-shot verification. Run in Supabase SQL Editor.
-- Expected: Every row below should have `ok = true` and `actual_count > 0`.

SELECT
  '1. email_queue table'               AS check_name,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = 'email_queue')   AS actual_count,
  15                                   AS expected_count,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = 'email_queue') = 15 AS ok

UNION ALL

SELECT
  '2. RPCs exist (claim/mark/touch)',
  (SELECT COUNT(*) FROM information_schema.routines
   WHERE routine_name IN (
     'claim_next_email_job',
     'claim_notification',
     'mark_email_completed',
     'mark_email_failed',
     'email_queue_touch_updated_at'
   )),
  5,
  (SELECT COUNT(*) FROM information_schema.routines
   WHERE routine_name IN (
     'claim_next_email_job',
     'claim_notification',
     'mark_email_completed',
     'mark_email_failed',
     'email_queue_touch_updated_at'
   )) = 5

UNION ALL

SELECT
  '3. Views exist (stuck + summary)',
  (SELECT COUNT(*) FROM pg_views
   WHERE viewname IN ('email_queue_stuck', 'email_queue_summary')),
  2,
  (SELECT COUNT(*) FROM pg_views
   WHERE viewname IN ('email_queue_stuck', 'email_queue_summary')) = 2

UNION ALL

SELECT
  '4. Indexes on email_queue',
  (SELECT COUNT(*) FROM pg_indexes
   WHERE tablename = 'email_queue'),
  3,  -- PK + status_received + locked_at
  (SELECT COUNT(*) FROM pg_indexes
   WHERE tablename = 'email_queue') >= 3

UNION ALL

SELECT
  '5. RLS enabled on email_queue',
  CASE WHEN (SELECT rowsecurity FROM pg_tables WHERE tablename = 'email_queue') THEN 1 ELSE 0 END,
  1,
  (SELECT rowsecurity FROM pg_tables WHERE tablename = 'email_queue') = true

UNION ALL

SELECT
  '6. Service role policy exists',
  (SELECT COUNT(*) FROM pg_policies
   WHERE tablename = 'email_queue'
     AND policyname = 'email_queue_service_role_all'),
  1,
  (SELECT COUNT(*) FROM pg_policies
   WHERE tablename = 'email_queue'
     AND policyname = 'email_queue_service_role_all') = 1

UNION ALL

SELECT
  '7. Trigger active on email_queue',
  (SELECT COUNT(*) FROM pg_trigger
   WHERE tgname = 'trg_email_queue_updated_at'),
  1,
  (SELECT COUNT(*) FROM pg_trigger
   WHERE tgname = 'trg_email_queue_updated_at') = 1

ORDER BY check_name;

-- Expected result: 7 rows, all with `ok = true`
-- If any row shows ok = false, that part of the schema is missing.
