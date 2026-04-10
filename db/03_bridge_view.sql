-- ============================================================================
-- EMI Dashboard — Bridge VIEW (tickets_flat)
-- Joins all 5 normalized tables into the flat shape the dashboard expects.
-- Dashboard reads from this VIEW — zero frontend change for reads.
-- Date: April 10, 2026
-- Usage: Run AFTER 02_enhanced_schema.sql
-- ============================================================================

CREATE OR REPLACE VIEW tickets_flat AS
SELECT
  -- Core (from tickets_v2)
  t.id,
  t.ticket_number,
  t.company, t.type::text, t.currency,
  t.scenario::text, t.status::text, t.risk_level::text,
  t.amount_requested, t.amount_on_bank_slip, t.amount_on_document,
  t.has_mismatch, t.approval_matrix_complete,
  t.required_approvals, t.email_approvals,
  t.finance_status, t.finance_approved_by, t.finance_approved_at, t.finance_notes,
  t.prechecks_done, t.prechecks_at,
  t.employee_data, t.employee_total, t.total_employees,
  t.invalid_msisdn_count, t.names_cleaned_count, t.employee_file_name,
  t.reconciliation,
  t.bank_slip_filename, t.bank_slip_type,
  t.remark, t.transaction_id, t.depositor_name,
  t.sent_to_checker, t.checker_name, t.checker_request, t.files_prepared,
  t.mapping_in_progress, t.mapping_complete, t.disbursing,
  t.monitor_results, t.closed,
  t.n8n_source,
  t.created_at, t.updated_at,

  -- Email (latest email per ticket)
  e.source_email_id, e.from_email, e.to_email, e.cc_emails,
  e.reply_to, e.email_date, e.message_id, e.thread_id,
  e.original_subject, e.body_preview, e.email_body_full,
  e.has_attachments, e.attachment_names, e.attachment_count,
  e.n8n_parsed_at,

  -- Attachment (latest attachment per ticket)
  a.storage_url AS attachment_url,
  a.mime_type AS attachment_mime_type,
  a.file_name AS attachment_file_name,

  -- Vision (latest vision result per ticket)
  v.vision_parsed, v.vision_confidence, v.vision_status,
  v.document_type, v.document_signers,

  -- Employee extraction (latest extraction per ticket)
  x.extracted_employees,
  x.employee_count AS extracted_employee_count,
  x.confidence AS employee_extraction_confidence,
  x.status AS employee_extraction_status,
  x.total_amount AS employee_total_extracted,
  x.amount_mismatch AS employee_amount_mismatch

FROM tickets_v2 t
LEFT JOIN LATERAL (
  SELECT * FROM ticket_emails WHERE ticket_id = t.id ORDER BY created_at DESC LIMIT 1
) e ON true
LEFT JOIN LATERAL (
  SELECT * FROM ticket_attachments WHERE ticket_id = t.id ORDER BY created_at DESC LIMIT 1
) a ON true
LEFT JOIN LATERAL (
  SELECT * FROM ticket_vision_results WHERE ticket_id = t.id ORDER BY created_at DESC LIMIT 1
) v ON true
LEFT JOIN LATERAL (
  SELECT * FROM ticket_employee_extractions WHERE ticket_id = t.id ORDER BY created_at DESC LIMIT 1
) x ON true;
