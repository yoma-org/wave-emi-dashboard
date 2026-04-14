-- ============================================================================
-- EMI Dashboard — KAN-36 Extraction Field Migration
-- Adds 10 new columns to tickets_v2 for KAN-36 + retroactive KAN-35 fields.
-- Recreates tickets_flat VIEW to expose them to the dashboard.
-- Date: 2026-04-15
-- Run AFTER 12_harden_activity_log.sql
-- ============================================================================

-- ─── STEP 1: Add email-side fields to tickets_v2 ────────────────────────────
-- These come from Groq AI extraction on the email body.

ALTER TABLE tickets_v2
  ADD COLUMN IF NOT EXISTS payment_date     TEXT DEFAULT '',   -- KAN-35: client's pay day (e.g., "2026-04-20")
  ADD COLUMN IF NOT EXISTS payroll_period   TEXT DEFAULT '',   -- KAN-35: period salary covers (e.g., "March 2026")
  ADD COLUMN IF NOT EXISTS initiator_name   TEXT DEFAULT '',   -- KAN-36: who in client company is requesting
  ADD COLUMN IF NOT EXISTS purpose          TEXT DEFAULT '',   -- KAN-36: why this disbursement
  ADD COLUMN IF NOT EXISTS cost_center      TEXT DEFAULT '';   -- KAN-36: accounting cost center code (soft-gate)

-- ─── STEP 2: Add document-side mirror fields to tickets_v2 ──────────────────
-- These come from Vision (Gemini PDF / Groq image) extraction on the attachment.
-- Used for side-by-side "Email vs Document" comparison in the ticket detail modal.

ALTER TABLE tickets_v2
  ADD COLUMN IF NOT EXISTS doc_company_name   TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS doc_payment_date   TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS doc_initiator_name TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS doc_purpose        TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS doc_cost_center    TEXT DEFAULT '';

-- ─── STEP 3: Recreate tickets_flat VIEW to expose the new columns ──────────
-- Dashboard reads from this VIEW. Adding the fields here makes them
-- automatically available via loadState() → state.tickets[id].
--
-- IMPORTANT: PostgreSQL CREATE OR REPLACE VIEW requires existing columns
-- to stay in the SAME ORDER at the SAME POSITIONS. You can only APPEND new
-- columns at the END. Attempting to insert new columns in the middle fails
-- with "cannot change name of view column ... to ..." (error 42P16).
-- Therefore we keep every existing column in its exact original position
-- and append the 10 new KAN-35/36 columns at the END.

CREATE OR REPLACE VIEW tickets_flat AS
SELECT
  -- Core (from tickets_v2) — ORIGINAL ORDER, DO NOT MODIFY
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

  -- Attachment (latest attachment per ticket) — ORIGINAL ORDER
  a.storage_url AS attachment_url,
  a.mime_type AS attachment_mime_type,
  a.file_name AS attachment_file_name,

  -- Vision (latest vision result per ticket) — ORIGINAL ORDER
  v.vision_parsed, v.vision_confidence, v.vision_status,
  v.document_type, v.document_signers,

  -- Employee extraction (latest extraction per ticket) — ORIGINAL ORDER
  x.extracted_employees,
  x.employee_count AS extracted_employee_count,
  x.confidence AS employee_extraction_confidence,
  x.status AS employee_extraction_status,
  x.total_amount AS employee_total_extracted,
  x.amount_mismatch AS employee_amount_mismatch,

  -- ─── APPENDED v11 KAN-35 / KAN-36 columns (NEW) ─────────────────────────
  -- These MUST stay at the end so CREATE OR REPLACE VIEW doesn't reject.
  -- If you ever add more columns in the future, APPEND after these.
  t.payment_date, t.payroll_period,
  t.initiator_name, t.purpose, t.cost_center,
  t.doc_company_name, t.doc_payment_date,
  t.doc_initiator_name, t.doc_purpose, t.doc_cost_center

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

-- ─── STEP 4: Verification queries (run after migration to confirm) ─────────
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'tickets_v2' AND column_name IN (
--   'payment_date','payroll_period','initiator_name','purpose','cost_center',
--   'doc_company_name','doc_payment_date','doc_initiator_name','doc_purpose','doc_cost_center'
-- );
-- Expected: 10 rows.

-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'tickets_flat' AND column_name LIKE '%purpose%' OR column_name LIKE '%initiator%';
-- Expected: purpose, doc_purpose, initiator_name, doc_initiator_name.

-- ─── ROLLBACK (if needed) ──────────────────────────────────────────────────
-- To revert: drop columns (view will auto-rebuild on next webhook POST that
-- references them — actually, the VIEW will error; recreate from 03_bridge_view.sql first):
-- BEGIN;
--   CREATE OR REPLACE VIEW tickets_flat AS (paste content of db/03_bridge_view.sql);
--   ALTER TABLE tickets_v2
--     DROP COLUMN IF EXISTS payment_date,
--     DROP COLUMN IF EXISTS payroll_period,
--     DROP COLUMN IF EXISTS initiator_name,
--     DROP COLUMN IF EXISTS purpose,
--     DROP COLUMN IF EXISTS cost_center,
--     DROP COLUMN IF EXISTS doc_company_name,
--     DROP COLUMN IF EXISTS doc_payment_date,
--     DROP COLUMN IF EXISTS doc_initiator_name,
--     DROP COLUMN IF EXISTS doc_purpose,
--     DROP COLUMN IF EXISTS doc_cost_center;
-- COMMIT;
