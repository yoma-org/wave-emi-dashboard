-- ============================================================================
-- EMI Dashboard — Enhanced Schema (Binh's design + missing fields)
-- Author: Binh (original) + DK + Claude (enhancements)
-- Date: April 10, 2026
-- Usage: Run in Supabase SQL Editor — Phase A of migration
-- ============================================================================

-- Step 1: ENUMs (expanded to match full 12-status workflow)
DROP TYPE IF EXISTS ticket_status CASCADE;
DROP TYPE IF EXISTS ticket_scenario CASCADE;
DROP TYPE IF EXISTS ticket_risk_level CASCADE;
DROP TYPE IF EXISTS ticket_type CASCADE;

CREATE TYPE ticket_status AS ENUM (
  'AWAITING_EMPLOYEE_LIST', 'ASKED_CLIENT', 'PENDING_FINANCE',
  'READY_FOR_CHECKER', 'SENT_TO_CHECKER', 'PREPARING_FILES',
  'WITH_CHECKER', 'GROUP_MAPPING', 'DISBURSING',
  'CLOSING', 'COMPLETED', 'REJECTED'
);

CREATE TYPE ticket_scenario AS ENUM (
  'NORMAL', 'AMOUNT_MISMATCH', 'MISSING_APPROVAL'
);

CREATE TYPE ticket_risk_level AS ENUM ('LOW', 'MEDIUM', 'HIGH');

CREATE TYPE ticket_type AS ENUM ('SalaryToMA', 'SalaryToOTC');


-- Step 2: Core tickets table (Binh's + 25 missing fields)
CREATE TABLE tickets_v2 (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_number            VARCHAR(10) UNIQUE NOT NULL,  -- TKT-001 (human-readable)
  company                  VARCHAR(100) NOT NULL DEFAULT 'Unknown Company',
  type                     ticket_type NOT NULL DEFAULT 'SalaryToMA',
  currency                 VARCHAR(3) NOT NULL DEFAULT 'MMK',
  scenario                 ticket_scenario NOT NULL DEFAULT 'NORMAL',
  status                   ticket_status NOT NULL DEFAULT 'AWAITING_EMPLOYEE_LIST',
  risk_level               ticket_risk_level NOT NULL DEFAULT 'LOW',

  -- Amounts (NUMERIC for financial precision — Binh's design)
  amount_requested         NUMERIC(18,2) NOT NULL DEFAULT 0,
  amount_on_bank_slip      NUMERIC(18,2) NOT NULL DEFAULT 0,
  amount_on_document       NUMERIC(18,2) NOT NULL DEFAULT 0,
  has_mismatch             BOOLEAN NOT NULL DEFAULT false,

  -- Approval matrix (changed TEXT → JSONB for structure)
  approval_matrix_complete BOOLEAN NOT NULL DEFAULT false,
  required_approvals       JSONB DEFAULT '[]'::jsonb,   -- [{role, name}]
  email_approvals          JSONB DEFAULT '[]'::jsonb,    -- [{role, name}]

  -- Finance workflow (MISSING from Binh's schema)
  finance_status           VARCHAR(20) NOT NULL DEFAULT 'PENDING',  -- PENDING/APPROVED/REJECTED
  finance_approved_by      TEXT,
  finance_approved_at      TIMESTAMPTZ,
  finance_notes            TEXT,

  -- Employee processing (MISSING from Binh's schema)
  prechecks_done           BOOLEAN NOT NULL DEFAULT false,
  prechecks_at             TIMESTAMPTZ,
  employee_data            JSONB DEFAULT '[]'::jsonb,    -- validated employee rows
  employee_total           NUMERIC(18,2) DEFAULT 0,
  total_employees          INT DEFAULT 0,
  invalid_msisdn_count     INT DEFAULT 0,
  names_cleaned_count      INT DEFAULT 0,
  employee_file_name       TEXT,
  reconciliation           JSONB,                         -- reconciliation check results

  -- Bank slip metadata
  bank_slip_filename       TEXT,
  bank_slip_type           VARCHAR(50),
  remark                   TEXT DEFAULT '',
  transaction_id           TEXT DEFAULT '',
  depositor_name           TEXT DEFAULT '',

  -- E-Money workflow state (MISSING from Binh's schema — drives deriveStatus())
  sent_to_checker          BOOLEAN NOT NULL DEFAULT false,
  checker_name             TEXT,
  checker_request          JSONB,     -- {corpWallet, dmmWallet, fee, batch, refNo}
  files_prepared           BOOLEAN NOT NULL DEFAULT false,
  mapping_in_progress      BOOLEAN NOT NULL DEFAULT false,
  mapping_complete         BOOLEAN NOT NULL DEFAULT false,
  disbursing               BOOLEAN NOT NULL DEFAULT false,
  monitor_results          JSONB,     -- {total, success, failed, paidAmount, failedAmount}
  closed                   BOOLEAN NOT NULL DEFAULT false,

  -- Source tracking
  n8n_source               BOOLEAN NOT NULL DEFAULT false,

  -- Timestamps
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- Step 3: Child tables (Binh's design — minor enhancements noted)
CREATE TABLE ticket_emails (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id        UUID NOT NULL REFERENCES tickets_v2(id) ON DELETE CASCADE,
  source_email_id  TEXT NOT NULL,
  from_email       VARCHAR(255) DEFAULT '',    -- widened from Binh's 100
  to_email         VARCHAR(255) DEFAULT '',    -- widened from Binh's 100
  cc_emails        TEXT DEFAULT '',
  reply_to         TEXT DEFAULT '',
  email_date       TIMESTAMPTZ,
  message_id       TEXT DEFAULT '',
  thread_id        TEXT DEFAULT '',
  original_subject TEXT DEFAULT '',
  body_preview     TEXT DEFAULT '',
  email_body_full  TEXT DEFAULT '',
  -- Added: dashboard needs these for display
  has_attachments  BOOLEAN NOT NULL DEFAULT false,
  attachment_names JSONB DEFAULT '[]'::jsonb,
  attachment_count INT DEFAULT 0,
  -- Binh's original fields
  n8n_source       BOOLEAN NOT NULL DEFAULT true,
  n8n_parsed_at    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ticket_attachments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id   UUID NOT NULL REFERENCES tickets_v2(id) ON DELETE CASCADE,
  file_name   VARCHAR(255) NOT NULL,
  mime_type   VARCHAR(50),
  storage_url TEXT,          -- Supabase Storage path
  size_bytes  BIGINT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ticket_vision_results (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id           UUID NOT NULL REFERENCES tickets_v2(id) ON DELETE CASCADE,
  attachment_id       UUID REFERENCES ticket_attachments(id),
  vision_parsed       BOOLEAN NOT NULL DEFAULT false,
  vision_confidence   NUMERIC(5,4) DEFAULT 0,
  vision_status       VARCHAR(20) DEFAULT 'none',
  document_type       VARCHAR(50) DEFAULT '',
  document_signers    JSONB DEFAULT '[]'::jsonb,
  -- Added: raw AI extraction (immutable audit trail)
  amount_on_document  NUMERIC(18,2) DEFAULT 0,
  depositor_name      TEXT DEFAULT '',
  remark              TEXT DEFAULT '',
  transaction_id      TEXT DEFAULT '',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ticket_employee_extractions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id           UUID NOT NULL REFERENCES tickets_v2(id) ON DELETE CASCADE,
  extracted_employees JSONB DEFAULT '[]'::jsonb,
  employee_count      INT DEFAULT 0,
  total_amount        NUMERIC(18,2) DEFAULT 0,
  confidence          NUMERIC(5,4) DEFAULT 0,
  status              VARCHAR(50) DEFAULT 'none',
  amount_mismatch     BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- Step 4: Indexes (for query performance)
CREATE INDEX idx_ticket_emails_ticket_id ON ticket_emails(ticket_id);
CREATE INDEX idx_ticket_attachments_ticket_id ON ticket_attachments(ticket_id);
CREATE INDEX idx_ticket_vision_ticket_id ON ticket_vision_results(ticket_id);
CREATE INDEX idx_ticket_extraction_ticket_id ON ticket_employee_extractions(ticket_id);
CREATE INDEX idx_tickets_v2_status ON tickets_v2(status);
CREATE INDEX idx_tickets_v2_ticket_number ON tickets_v2(ticket_number);
CREATE INDEX idx_tickets_v2_created_at ON tickets_v2(created_at DESC);


-- Step 5: Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tickets_v2_updated_at
  BEFORE UPDATE ON tickets_v2
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- Step 6: Auto-generate ticket_number (TKT-001, TKT-002, ...)
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER AS $$
DECLARE
  max_num INT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_number FROM 5) AS INT)), 0)
  INTO max_num
  FROM tickets_v2
  WHERE ticket_number LIKE 'TKT-%';

  NEW.ticket_number := 'TKT-' || LPAD(CAST(max_num + 1 AS TEXT), 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tickets_v2_auto_number
  BEFORE INSERT ON tickets_v2
  FOR EACH ROW
  WHEN (NEW.ticket_number IS NULL OR NEW.ticket_number = '')
  EXECUTE FUNCTION generate_ticket_number();
