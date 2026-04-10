-- ============================================================================
-- EMI Dashboard — Data Migration (flat tickets → normalized tables)
-- Migrates existing 11 tickets from old flat 'tickets' table.
-- Date: April 10, 2026
-- Usage: Run ONCE after 02 + 03 scripts. Old table stays untouched.
-- ============================================================================

-- 1. Core ticket data → tickets_v2
INSERT INTO tickets_v2 (
  ticket_number, company, type, currency, scenario, status, risk_level,
  amount_requested, amount_on_bank_slip, amount_on_document,
  has_mismatch, approval_matrix_complete,
  required_approvals, email_approvals,
  finance_status, prechecks_done, sent_to_checker,
  n8n_source, remark, transaction_id, depositor_name,
  created_at, updated_at
)
SELECT
  id,  -- old TKT-001 becomes ticket_number
  company,
  type::ticket_type,
  currency,
  scenario::ticket_scenario,
  status::ticket_status,
  risk_level::ticket_risk_level,
  COALESCE(amount_requested, 0),
  COALESCE(amount_on_bank_slip, 0),
  COALESCE(amount_on_document, 0),
  COALESCE(has_mismatch, false),
  COALESCE(approval_matrix_complete, false),
  COALESCE(required_approvals::jsonb, '[]'::jsonb),
  COALESCE(email_approvals::jsonb, '[]'::jsonb),
  COALESCE(finance_status, 'PENDING'),
  COALESCE(prechecks_done, false),
  COALESCE(sent_to_checker, false),
  COALESCE(n8n_source, false),
  COALESCE(remark, ''),
  COALESCE(transaction_id, ''),
  COALESCE(depositor_name, ''),
  created_at, updated_at
FROM tickets;


-- 2. Email metadata → ticket_emails
INSERT INTO ticket_emails (
  ticket_id, source_email_id, from_email, to_email, cc_emails,
  reply_to, email_date, message_id, thread_id, original_subject,
  body_preview, email_body_full,
  has_attachments, attachment_names, attachment_count,
  n8n_source, n8n_parsed_at
)
SELECT
  v2.id,
  old.source_email_id,
  COALESCE(old.from_email, ''),
  COALESCE(old.to_email, ''),
  COALESCE(old.cc_emails, ''),
  COALESCE(old.reply_to, ''),
  old.email_date::timestamptz,
  COALESCE(old.message_id, ''),
  COALESCE(old.thread_id, ''),
  COALESCE(old.original_subject, ''),
  COALESCE(old.body_preview, ''),
  COALESCE(old.email_body_full, ''),
  COALESCE(old.has_attachments, false),
  COALESCE(old.attachment_names::jsonb, '[]'::jsonb),
  COALESCE(old.attachment_count, 0),
  COALESCE(old.n8n_source, false),
  old.n8n_parsed_at::timestamptz
FROM tickets old
JOIN tickets_v2 v2 ON v2.ticket_number = old.id
WHERE old.source_email_id IS NOT NULL;


-- 3. Attachments → ticket_attachments
INSERT INTO ticket_attachments (ticket_id, file_name, mime_type, storage_url)
SELECT
  v2.id,
  COALESCE(old.bank_slip_filename, 'attachment'),
  old.attachment_mime_type,
  old.attachment_url
FROM tickets old
JOIN tickets_v2 v2 ON v2.ticket_number = old.id
WHERE old.attachment_url IS NOT NULL AND old.attachment_url != '';


-- 4. Vision results → ticket_vision_results
INSERT INTO ticket_vision_results (
  ticket_id, attachment_id,
  vision_parsed, vision_confidence, vision_status,
  document_type, document_signers,
  amount_on_document, depositor_name, remark, transaction_id
)
SELECT
  v2.id,
  att.id,
  COALESCE(old.vision_parsed, false),
  COALESCE(old.vision_confidence, 0),
  COALESCE(old.vision_status, 'none'),
  COALESCE(old.document_type, ''),
  COALESCE(old.document_signers::jsonb, '[]'::jsonb),
  COALESCE(old.amount_on_document, 0),
  COALESCE(old.depositor_name, ''),
  COALESCE(old.remark, ''),
  COALESCE(old.transaction_id, '')
FROM tickets old
JOIN tickets_v2 v2 ON v2.ticket_number = old.id
LEFT JOIN ticket_attachments att ON att.ticket_id = v2.id
WHERE old.vision_parsed = true;


-- 5. Employee extractions → ticket_employee_extractions
INSERT INTO ticket_employee_extractions (
  ticket_id, extracted_employees, employee_count,
  total_amount, confidence, status, amount_mismatch
)
SELECT
  v2.id,
  COALESCE(old.extracted_employees::jsonb, '[]'::jsonb),
  COALESCE(old.extracted_employee_count, 0),
  COALESCE(old.employee_total_extracted, 0),
  COALESCE(old.employee_extraction_confidence, 0),
  COALESCE(old.employee_extraction_status, 'none'),
  COALESCE(old.employee_amount_mismatch, false)
FROM tickets old
JOIN tickets_v2 v2 ON v2.ticket_number = old.id
WHERE old.extracted_employees IS NOT NULL;


-- ============================================================================
-- VERIFICATION QUERIES (run after migration to validate)
-- ============================================================================

-- Check ticket count matches
-- SELECT COUNT(*) AS old_count FROM tickets;
-- SELECT COUNT(*) AS new_count FROM tickets_v2;

-- Check VIEW returns all tickets
-- SELECT ticket_number, company, status, vision_parsed, extracted_employee_count
-- FROM tickets_flat ORDER BY created_at DESC;

-- Compare old vs new for a specific ticket
-- SELECT id, company, amount_requested, status FROM tickets WHERE id = 'TKT-011';
-- SELECT ticket_number, company, amount_requested, status FROM tickets_flat WHERE ticket_number = 'TKT-011';
