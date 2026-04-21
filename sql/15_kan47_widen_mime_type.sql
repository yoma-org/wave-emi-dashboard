-- ============================================================================
-- EMI Dashboard — KAN-47 Widen mime_type column for modern MIME strings
-- Date: 2026-04-21
-- Context:
--   Supabase Storage accepted XLSX uploads after bucket MIME allow-list was
--   expanded, but the subsequent INSERT into ticket_attachments failed with
--   "value too long for type character varying(50)". The XLSX MIME string
--   `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` is
--   65 chars — longer than the original VARCHAR(50) cap on ticket_attachments
--   .mime_type from migration 02 (Binh's design).
--
--   Pre-KAN-47 only PDF/PNG/JPEG flowed through (all <16 chars), so no one
--   hit the limit. KAN-47 adds multi-attachment support with XLSX/CSV/etc.
--   Wave Money real clients send XLSX (see Kim's NSK disbursement email).
--
-- Strategy:
--   Postgres won't ALTER a column type if a view depends on it. tickets_flat
--   (from migration 14) exposes ticket_attachments.mime_type as
--   attachment_mime_type. So: DROP view → ALTER column → recreate view, all
--   in one transaction for atomicity.
--
-- Run AFTER 14_kan36_source_wallet_currency.sql
-- ============================================================================

BEGIN;

-- ─── STEP 1: Drop tickets_flat view (removes the column-type dependency) ───
DROP VIEW IF EXISTS tickets_flat;

-- ─── STEP 2: Widen mime_type column 50 → 255 ──────────────────────────────
-- VARCHAR(255) is enough for every IANA-registered MIME type (longest known
-- are ~80 chars). Matches the convention of file_name VARCHAR(255).
-- Widening is a metadata change in Postgres — no table rewrite, no risk.
ALTER TABLE ticket_attachments
  ALTER COLUMN mime_type TYPE VARCHAR(255);

-- ─── STEP 3: Recreate tickets_flat exactly as it was (from migration 14) ───
-- Column order and set preserved verbatim so dashboard queries keep working.
-- Only difference: attachment_mime_type is now sourced from a wider column.
CREATE VIEW tickets_flat AS
SELECT
  -- Core (from tickets_v2) — ORIGINAL ORDER
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

  -- Email (latest email per ticket) — ORIGINAL ORDER
  e.source_email_id, e.from_email, e.to_email, e.cc_emails,
  e.reply_to, e.email_date, e.message_id, e.thread_id,
  e.original_subject, e.body_preview, e.email_body_full,
  e.has_attachments, e.attachment_names, e.attachment_count,
  e.n8n_parsed_at,

  -- Attachment — ORIGINAL ORDER
  a.storage_url AS attachment_url,
  a.mime_type AS attachment_mime_type,
  a.file_name AS attachment_file_name,

  -- Vision — ORIGINAL ORDER
  v.vision_parsed, v.vision_confidence, v.vision_status,
  v.document_type, v.document_signers,

  -- Employee extraction — ORIGINAL ORDER
  x.extracted_employees,
  x.employee_count AS extracted_employee_count,
  x.confidence AS employee_extraction_confidence,
  x.status AS employee_extraction_status,
  x.total_amount AS employee_total_extracted,
  x.amount_mismatch AS employee_amount_mismatch,

  -- APPENDED v11 KAN-35 / KAN-36 columns (migration 13) — ORIGINAL ORDER
  t.payment_date, t.payroll_period,
  t.initiator_name, t.purpose, t.cost_center,
  t.doc_company_name, t.doc_payment_date,
  t.doc_initiator_name, t.doc_purpose, t.doc_cost_center,

  -- APPENDED v11.4 Source Info column (migration 14)
  t.corporate_wallet

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

COMMIT;

-- ─── STEP 4: Verification (run after the transaction above commits) ────────
-- SELECT column_name, data_type, character_maximum_length
-- FROM information_schema.columns
-- WHERE table_name = 'ticket_attachments' AND column_name = 'mime_type';
-- Expected: mime_type | character varying | 255
--
-- SELECT column_name, character_maximum_length
-- FROM information_schema.columns
-- WHERE table_name = 'tickets_flat' AND column_name = 'attachment_mime_type';
-- Expected: attachment_mime_type | 255

-- ─── ROLLBACK (if needed) ──────────────────────────────────────────────────
-- BEGIN;
-- DROP VIEW IF EXISTS tickets_flat;
-- ALTER TABLE ticket_attachments ALTER COLUMN mime_type TYPE VARCHAR(50);
-- -- (then re-run the CREATE VIEW block above)
-- COMMIT;
-- NOTE: rollback may fail if any rows have mime_type > 50 chars. Those rows
-- would need to be deleted or truncated first:
-- DELETE FROM ticket_attachments WHERE LENGTH(mime_type) > 50;
