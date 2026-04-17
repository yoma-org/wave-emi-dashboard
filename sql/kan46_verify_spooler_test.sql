-- Run this in Supabase SQL Editor AFTER the Spooler test fires
-- Expected: 1 row with status='pending'

SELECT
  id,
  message_id,
  from_address,
  subject,
  status,
  attempts,
  notification_sent,
  received_at,
  created_at,
  jsonb_pretty(payload) AS payload_pretty
FROM email_queue
WHERE message_id = 'test-spooler-001-apr17';

-- Expected result:
--   1 row
--   status = 'pending'
--   from_address = 'test-sender@example.com'
--   subject = 'KAN-46 Spooler Test — Ignore'
--   attempts = 0
--   notification_sent = false
--   payload contains raw_email + attachments array (empty) + spooled_at timestamp
