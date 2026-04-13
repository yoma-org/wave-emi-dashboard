-- ============================================================================
-- EMI Dashboard — Backfill Storage Paths
-- Date: April 13, 2026
-- Purpose: Convert legacy public URLs in ticket_attachments.storage_url
--          to relative paths so dashboard uses signed URLs for ALL tickets.
--
-- Before: storage_url = 'https://dicluyfkfqlqjwqikznl.supabase.co/storage/v1/object/public/attachments/TKT-019/file.pdf'
-- After:  storage_url = 'TKT-019/file.pdf'
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- PRE-CHECK: How many rows will be affected?
-- ────────────────────────────────────────────────────────────────────────────
SELECT
  COUNT(*) AS rows_to_backfill
FROM ticket_attachments
WHERE storage_url LIKE 'https://%/storage/v1/object/public/attachments/%';


-- ────────────────────────────────────────────────────────────────────────────
-- PRE-CHECK: Show what will change (dry run preview)
-- ────────────────────────────────────────────────────────────────────────────
SELECT
  id,
  storage_url AS old_url,
  REGEXP_REPLACE(storage_url, '^https://[^/]+/storage/v1/object/public/attachments/', '') AS new_path
FROM ticket_attachments
WHERE storage_url LIKE 'https://%/storage/v1/object/public/attachments/%'
LIMIT 20;


-- ────────────────────────────────────────────────────────────────────────────
-- BACKFILL: Run this only after reviewing the preview above
-- ────────────────────────────────────────────────────────────────────────────
UPDATE ticket_attachments
SET storage_url = REGEXP_REPLACE(storage_url, '^https://[^/]+/storage/v1/object/public/attachments/', '')
WHERE storage_url LIKE 'https://%/storage/v1/object/public/attachments/%';


-- ────────────────────────────────────────────────────────────────────────────
-- VERIFY: After running update, confirm no public URLs remain
-- ────────────────────────────────────────────────────────────────────────────
SELECT
  COUNT(*) FILTER (WHERE storage_url LIKE 'https://%') AS remaining_public_urls,
  COUNT(*) FILTER (WHERE storage_url NOT LIKE 'https://%' AND storage_url IS NOT NULL) AS path_format_rows,
  COUNT(*) AS total_rows
FROM ticket_attachments;
-- Expected: remaining_public_urls = 0


-- ────────────────────────────────────────────────────────────────────────────
-- VERIFY: Sample the new format
-- ────────────────────────────────────────────────────────────────────────────
SELECT id, storage_url FROM ticket_attachments ORDER BY created_at DESC LIMIT 5;
-- Expected: storage_url like 'TKT-XXX/filename.ext'


-- ────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (if needed) — restore by re-prepending the public URL prefix
-- ────────────────────────────────────────────────────────────────────────────
-- UPDATE ticket_attachments
-- SET storage_url = 'https://dicluyfkfqlqjwqikznl.supabase.co/storage/v1/object/public/attachments/' || storage_url
-- WHERE storage_url NOT LIKE 'https://%' AND storage_url IS NOT NULL;
