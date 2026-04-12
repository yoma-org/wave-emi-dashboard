-- ============================================================================
-- EMI Dashboard — Verification Queries (post schema refactoring)
-- Date: April 12, 2026
-- Run these in Supabase SQL Editor to verify system health
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- QUERY 1: Row counts across all tables
-- Expected: tickets=11, tickets_v2=18, activity_log=26+
-- ────────────────────────────────────────────────────────────────────────────
SELECT 'tickets (legacy)' AS table_name, COUNT(*) AS rows FROM tickets
UNION ALL SELECT 'tickets_v2', COUNT(*) FROM tickets_v2
UNION ALL SELECT 'ticket_emails', COUNT(*) FROM ticket_emails
UNION ALL SELECT 'ticket_attachments', COUNT(*) FROM ticket_attachments
UNION ALL SELECT 'ticket_vision_results', COUNT(*) FROM ticket_vision_results
UNION ALL SELECT 'ticket_employee_extractions', COUNT(*) FROM ticket_employee_extractions
UNION ALL SELECT 'activity_log', COUNT(*) FROM activity_log
UNION ALL SELECT 'tickets_flat (view)', COUNT(*) FROM tickets_flat;


-- ────────────────────────────────────────────────────────────────────────────
-- QUERY 2: Latest 8 tickets with child table counts (integrity check)
-- Expected: each ticket has 1 email row minimum, attachments+vision when applicable
-- ────────────────────────────────────────────────────────────────────────────
SELECT
  t.ticket_number,
  t.company,
  t.type,
  t.status,
  (SELECT COUNT(*) FROM ticket_emails WHERE ticket_id = t.id) AS emails,
  (SELECT COUNT(*) FROM ticket_attachments WHERE ticket_id = t.id) AS attachments,
  (SELECT COUNT(*) FROM ticket_vision_results WHERE ticket_id = t.id) AS vision_results,
  (SELECT COUNT(*) FROM ticket_employee_extractions WHERE ticket_id = t.id) AS employee_extractions,
  t.created_at
FROM tickets_v2 t
ORDER BY t.created_at DESC
LIMIT 8;


-- ────────────────────────────────────────────────────────────────────────────
-- QUERY 3: TKT-012 deep inspection (our first end-to-end test)
-- Expected: Full clean data — vision 85%, 12 employees, attachment URL
-- ────────────────────────────────────────────────────────────────────────────
SELECT
  ticket_number, company, type, amount_requested, status, risk_level,
  vision_parsed, vision_confidence, document_type,
  extracted_employee_count, employee_total_extracted,
  attachment_url, has_attachments, from_email
FROM tickets_flat
WHERE ticket_number = 'TKT-012';


-- ────────────────────────────────────────────────────────────────────────────
-- QUERY 4: Orphan detection (should return 0 rows — any result = bug)
-- ────────────────────────────────────────────────────────────────────────────
SELECT 'emails orphan' AS issue, COUNT(*) FROM ticket_emails e WHERE NOT EXISTS (SELECT 1 FROM tickets_v2 WHERE id = e.ticket_id)
UNION ALL
SELECT 'attachments orphan', COUNT(*) FROM ticket_attachments a WHERE NOT EXISTS (SELECT 1 FROM tickets_v2 WHERE id = a.ticket_id)
UNION ALL
SELECT 'vision orphan', COUNT(*) FROM ticket_vision_results v WHERE NOT EXISTS (SELECT 1 FROM tickets_v2 WHERE id = v.ticket_id)
UNION ALL
SELECT 'extraction orphan', COUNT(*) FROM ticket_employee_extractions x WHERE NOT EXISTS (SELECT 1 FROM tickets_v2 WHERE id = x.ticket_id);


-- ────────────────────────────────────────────────────────────────────────────
-- QUERY 5: Activity log for autonomous tickets (Apr 11)
-- Shows what happened while DK was away
-- ────────────────────────────────────────────────────────────────────────────
SELECT ticket_id, action, message, created_at
FROM activity_log
WHERE ticket_id IN ('TKT-013','TKT-014','TKT-015','TKT-016','TKT-017','TKT-018')
ORDER BY created_at DESC;


-- ────────────────────────────────────────────────────────────────────────────
-- QUERY 6: Check ticket_number sequence is intact (no gaps, no duplicates)
-- Expected: returns 1 row with max=18, count=18, min=1
-- ────────────────────────────────────────────────────────────────────────────
SELECT
  COUNT(*) AS total_tickets,
  COUNT(DISTINCT ticket_number) AS unique_numbers,
  MIN(CAST(SUBSTRING(ticket_number FROM 5) AS INT)) AS min_num,
  MAX(CAST(SUBSTRING(ticket_number FROM 5) AS INT)) AS max_num
FROM tickets_v2;


-- ────────────────────────────────────────────────────────────────────────────
-- QUERY 7: Storage verification (all attachments should have URLs)
-- Expected: 0 rows where storage_url is null or empty
-- ────────────────────────────────────────────────────────────────────────────
SELECT COUNT(*) AS attachments_without_url
FROM ticket_attachments
WHERE storage_url IS NULL OR storage_url = '';
