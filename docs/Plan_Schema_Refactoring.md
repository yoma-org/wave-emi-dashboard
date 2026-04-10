# Schema Refactoring Plan — From Flat to Normalized

**Author:** DK + Claude | **Date:** April 10, 2026
**Based on:** Binh's `init.sql` + current flat schema analysis
**Go-live:** April 19, 2026 (delayed from Apr 15 — Myanmar holiday)
**Scope:** Database schema, webhook, dashboard, localStorage

---

## 1. Current State vs Target State

### Current: 1 Flat Table (~70 columns)
```
tickets (everything in one row)
├── core: id, company, type, currency, scenario, status, risk_level
├── amounts: amount_requested, amount_on_bank_slip, amount_on_document
├── email: from_email, to_email, cc_emails, subject, body, message_id...
├── vision: vision_parsed, vision_confidence, document_type, signers...
├── employees: extracted_employees (JSON), employee_count, confidence...
├── finance: finance_status, finance_approved_by, finance_approved_at...
├── workflow: prechecks_done, sent_to_checker, checker_name, files_prepared...
├── attachment: attachment_url, attachment_mime_type
└── timestamps: created_at, updated_at
```

### Target: 6 Normalized Tables (Binh's schema + enhancements)
```
tickets (core business data)
ticket_emails (email metadata, 1:many)
ticket_attachments (files in Supabase Storage, 1:many)
ticket_vision_results (OCR/AI results per attachment, 1:many)
ticket_employee_extractions (extracted employee lists, 1:many)
activity_log (audit trail, existing — keep as-is)
```

### Bridge: PostgreSQL VIEW
```
tickets_flat (JOIN of all tables → same shape as current flat table)
└── Dashboard reads from this VIEW — zero frontend change for reads
```

---

## 2. Enhanced Schema (Binh's + Missing Fields)

### 2.1 tickets (core — 35 fields)

**What Binh has (keeping):**
- id, company, type, currency, scenario, status, risk_level
- amount_requested, amount_on_bank_slip, amount_on_document
- has_mismatch, approval_matrix_complete
- required_approvals, email_approvals (→ change to JSONB)
- remark, transaction_id, depositor_name
- created_at, updated_at

**What Binh is MISSING (must add):**

| Field | Type | Why Needed |
|-------|------|-----------|
| `ticket_number` | `VARCHAR(10) UNIQUE` | Human-readable ID (TKT-001). UUIDs are internal only. |
| `finance_status` | `VARCHAR(20) DEFAULT 'PENDING'` | PENDING/APPROVED/REJECTED — drives deriveStatus() |
| `finance_approved_by` | `TEXT` | Who approved (name) |
| `finance_approved_at` | `TIMESTAMPTZ` | When approved |
| `finance_notes` | `TEXT` | Approval/rejection notes |
| `prechecks_done` | `BOOLEAN DEFAULT false` | Employee list uploaded + validated |
| `prechecks_at` | `TIMESTAMPTZ` | When prechecks completed |
| `employee_data` | `JSONB` | Validated employee rows (after upload/edit) |
| `employee_total` | `NUMERIC(18,2)` | Sum of employee amounts |
| `total_employees` | `INT DEFAULT 0` | Count of employees |
| `invalid_msisdn_count` | `INT DEFAULT 0` | Bad phone numbers found |
| `names_cleaned_count` | `INT DEFAULT 0` | Names auto-corrected |
| `employee_file_name` | `TEXT` | Original uploaded filename |
| `reconciliation` | `JSONB` | Array of reconciliation check results |
| `bank_slip_filename` | `TEXT` | Original bank slip filename |
| `bank_slip_type` | `VARCHAR(50)` | MIME type of bank slip |
| `sent_to_checker` | `BOOLEAN DEFAULT false` | Legacy flag — sent to checker |
| `checker_name` | `TEXT` | Checker who reviewed |
| `checker_request` | `JSONB` | Checker request details (corpWallet, dmmWallet, etc.) |
| `files_prepared` | `BOOLEAN DEFAULT false` | CSV files generated |
| `mapping_in_progress` | `BOOLEAN DEFAULT false` | OTC group mapping active |
| `mapping_complete` | `BOOLEAN DEFAULT false` | OTC group mapping done |
| `disbursing` | `BOOLEAN DEFAULT false` | Disbursement in progress |
| `monitor_results` | `JSONB` | Disbursement monitoring results |
| `closed` | `BOOLEAN DEFAULT false` | Case closed and archived |
| `n8n_source` | `BOOLEAN DEFAULT false` | Created by n8n pipeline |

**Binh's fields to CHANGE:**
| Original | Change | Reason |
|----------|--------|--------|
| `id UUID` | Keep UUID BUT add `ticket_number VARCHAR(10)` | Dashboard displays TKT-001 |
| `required_approvals TEXT` | → `JSONB DEFAULT '[]'` | Currently JSON array, TEXT loses structure |
| `email_approvals TEXT` | → `JSONB DEFAULT '[]'` | Currently JSON array of {role, name} objects |
| `status` ENUM (6 values) | Expand to 12 values | Current system uses 12 statuses |

**Expanded status ENUM:**
```sql
CREATE TYPE ticket_status AS ENUM (
  'AWAITING_EMPLOYEE_LIST', 'ASKED_CLIENT', 'PENDING_FINANCE',
  'READY_FOR_CHECKER', 'SENT_TO_CHECKER', 'PREPARING_FILES',
  'WITH_CHECKER', 'GROUP_MAPPING', 'DISBURSING',
  'CLOSING', 'COMPLETED', 'REJECTED'
);
```

### 2.2 ticket_emails (Binh's — good as-is, minor additions)

**Add:**
| Field | Type | Why |
|-------|------|-----|
| `has_attachments` | `BOOLEAN DEFAULT false` | Dashboard displays attachment indicator |
| `attachment_names` | `JSONB DEFAULT '[]'` | List of attachment filenames |
| `attachment_count` | `INT DEFAULT 0` | Quick count for display |

### 2.3 ticket_attachments (Binh's — good as-is)

No changes needed. Clean design.

### 2.4 ticket_vision_results (Binh's — minor addition)

**Add:**
| Field | Type | Why |
|-------|------|-----|
| `amount_on_document` | `NUMERIC(18,2) DEFAULT 0` | Amount extracted from document by vision AI — used in cross-validation |
| `depositor_name` | `TEXT DEFAULT ''` | Extracted from bank slip |
| `remark` | `TEXT DEFAULT ''` | Extracted purpose/remark |
| `transaction_id` | `TEXT DEFAULT ''` | Extracted transaction reference |

**Note:** These duplicate some fields from tickets table. Decision: keep in BOTH places.
- `ticket_vision_results`: raw AI extraction output (immutable, audit trail)
- `tickets`: current working values (may be human-edited)

### 2.5 ticket_employee_extractions (Binh's — good as-is)

No changes needed. Clean design.

### 2.6 activity_log (existing — keep as-is)

Already working. No changes needed. Binh didn't include it but it's already live.

---

## 3. Migration SQL

### Phase A: Create New Tables (non-destructive)

```sql
-- Run these ALONGSIDE existing flat table (zero downtime)

-- Step 1: Drop Binh's ENUMs if they exist, recreate with full values
DROP TYPE IF EXISTS ticket_status CASCADE;
DROP TYPE IF EXISTS ticket_scenario CASCADE;
DROP TYPE IF EXISTS ticket_risk_level CASCADE;

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

-- Step 2: Create normalized tables
CREATE TABLE tickets_v2 (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_number            VARCHAR(10) UNIQUE NOT NULL,  -- TKT-001 display ID
  company                  VARCHAR(100) NOT NULL DEFAULT 'Unknown Company',
  type                     ticket_type NOT NULL DEFAULT 'SalaryToMA',
  currency                 VARCHAR(3) NOT NULL DEFAULT 'MMK',
  scenario                 ticket_scenario NOT NULL DEFAULT 'NORMAL',
  status                   ticket_status NOT NULL DEFAULT 'AWAITING_EMPLOYEE_LIST',
  risk_level               ticket_risk_level NOT NULL DEFAULT 'LOW',

  -- Amounts
  amount_requested         NUMERIC(18,2) NOT NULL DEFAULT 0,
  amount_on_bank_slip      NUMERIC(18,2) NOT NULL DEFAULT 0,
  amount_on_document       NUMERIC(18,2) NOT NULL DEFAULT 0,
  has_mismatch             BOOLEAN NOT NULL DEFAULT false,

  -- Approval
  approval_matrix_complete BOOLEAN NOT NULL DEFAULT false,
  required_approvals       JSONB DEFAULT '[]'::jsonb,
  email_approvals          JSONB DEFAULT '[]'::jsonb,

  -- Finance
  finance_status           VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  finance_approved_by      TEXT,
  finance_approved_at      TIMESTAMPTZ,
  finance_notes            TEXT,

  -- Employee processing
  prechecks_done           BOOLEAN NOT NULL DEFAULT false,
  prechecks_at             TIMESTAMPTZ,
  employee_data            JSONB DEFAULT '[]'::jsonb,
  employee_total           NUMERIC(18,2) DEFAULT 0,
  total_employees          INT DEFAULT 0,
  invalid_msisdn_count     INT DEFAULT 0,
  names_cleaned_count      INT DEFAULT 0,
  employee_file_name       TEXT,
  reconciliation           JSONB,

  -- Bank slip
  bank_slip_filename       TEXT,
  bank_slip_type           VARCHAR(50),
  remark                   TEXT DEFAULT '',
  transaction_id           TEXT DEFAULT '',
  depositor_name           TEXT DEFAULT '',

  -- Workflow state
  sent_to_checker          BOOLEAN NOT NULL DEFAULT false,
  checker_name             TEXT,
  checker_request          JSONB,
  files_prepared           BOOLEAN NOT NULL DEFAULT false,
  mapping_in_progress      BOOLEAN NOT NULL DEFAULT false,
  mapping_complete         BOOLEAN NOT NULL DEFAULT false,
  disbursing               BOOLEAN NOT NULL DEFAULT false,
  monitor_results          JSONB,
  closed                   BOOLEAN NOT NULL DEFAULT false,

  -- Source
  n8n_source               BOOLEAN NOT NULL DEFAULT false,

  -- Timestamps
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ticket_emails (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id        UUID NOT NULL REFERENCES tickets_v2(id) ON DELETE CASCADE,
  source_email_id  TEXT NOT NULL,
  from_email       VARCHAR(255) DEFAULT '',
  to_email         VARCHAR(255) DEFAULT '',
  cc_emails        TEXT DEFAULT '',
  reply_to         TEXT DEFAULT '',
  email_date       TIMESTAMPTZ,
  message_id       TEXT DEFAULT '',
  thread_id        TEXT DEFAULT '',
  original_subject TEXT DEFAULT '',
  body_preview     TEXT DEFAULT '',
  email_body_full  TEXT DEFAULT '',
  has_attachments  BOOLEAN NOT NULL DEFAULT false,
  attachment_names JSONB DEFAULT '[]'::jsonb,
  attachment_count INT DEFAULT 0,
  n8n_source       BOOLEAN NOT NULL DEFAULT true,
  n8n_parsed_at    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ticket_attachments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id   UUID NOT NULL REFERENCES tickets_v2(id) ON DELETE CASCADE,
  file_name   VARCHAR(255) NOT NULL,
  mime_type   VARCHAR(50),
  storage_url TEXT,
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

-- Step 3: Indexes
CREATE INDEX idx_ticket_emails_ticket_id ON ticket_emails(ticket_id);
CREATE INDEX idx_ticket_attachments_ticket_id ON ticket_attachments(ticket_id);
CREATE INDEX idx_ticket_vision_ticket_id ON ticket_vision_results(ticket_id);
CREATE INDEX idx_ticket_extraction_ticket_id ON ticket_employee_extractions(ticket_id);
CREATE INDEX idx_tickets_v2_status ON tickets_v2(status);
CREATE INDEX idx_tickets_v2_ticket_number ON tickets_v2(ticket_number);
CREATE INDEX idx_tickets_v2_created_at ON tickets_v2(created_at DESC);

-- Step 4: Auto-update timestamp trigger
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

-- Step 5: Auto-generate ticket_number
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
```

### Phase B: Bridge VIEW (flat shape for dashboard reads)

```sql
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

  -- Email (from ticket_emails — latest email)
  e.source_email_id, e.from_email, e.to_email, e.cc_emails,
  e.reply_to, e.email_date, e.message_id, e.thread_id,
  e.original_subject, e.body_preview, e.email_body_full,
  e.has_attachments, e.attachment_names, e.attachment_count,
  e.n8n_parsed_at,

  -- Attachment (from ticket_attachments — first attachment)
  a.storage_url AS attachment_url,
  a.mime_type AS attachment_mime_type,
  a.file_name AS attachment_file_name,

  -- Vision (from ticket_vision_results — latest)
  v.vision_parsed, v.vision_confidence, v.vision_status,
  v.document_type, v.document_signers,

  -- Employee extraction (from ticket_employee_extractions — latest)
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
```

### Phase C: Data Migration (existing 11 tickets)

```sql
-- Migrate existing flat tickets → normalized tables
-- Run ONCE after Phase A tables exist

-- 1. Insert core ticket data
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

-- 2. Insert email data (for n8n-sourced tickets)
INSERT INTO ticket_emails (ticket_id, source_email_id, from_email, to_email, cc_emails,
  reply_to, email_date, message_id, thread_id, original_subject,
  body_preview, email_body_full, has_attachments, attachment_names,
  attachment_count, n8n_source, n8n_parsed_at)
SELECT
  v2.id, old.source_email_id, old.from_email, old.to_email, old.cc_emails,
  old.reply_to, old.email_date::timestamptz, old.message_id, old.thread_id,
  old.original_subject, old.body_preview, old.email_body_full,
  COALESCE(old.has_attachments, false),
  COALESCE(old.attachment_names::jsonb, '[]'::jsonb),
  COALESCE(old.attachment_count, 0),
  COALESCE(old.n8n_source, false),
  old.n8n_parsed_at::timestamptz
FROM tickets old
JOIN tickets_v2 v2 ON v2.ticket_number = old.id
WHERE old.source_email_id IS NOT NULL;

-- 3. Insert attachments (for tickets with attachment_url)
INSERT INTO ticket_attachments (ticket_id, file_name, mime_type, storage_url)
SELECT
  v2.id,
  COALESCE(old.bank_slip_filename, 'attachment'),
  old.attachment_mime_type,
  old.attachment_url
FROM tickets old
JOIN tickets_v2 v2 ON v2.ticket_number = old.id
WHERE old.attachment_url IS NOT NULL AND old.attachment_url != '';

-- 4. Insert vision results (for tickets with vision data)
INSERT INTO ticket_vision_results (ticket_id, attachment_id,
  vision_parsed, vision_confidence, vision_status,
  document_type, document_signers,
  amount_on_document, depositor_name, remark, transaction_id)
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

-- 5. Insert employee extractions
INSERT INTO ticket_employee_extractions (ticket_id,
  extracted_employees, employee_count, total_amount,
  confidence, status, amount_mismatch)
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
```

---

## 4. Component Changes

### 4.1 Dashboard `loadState()` — MODERATE change

**Strategy:** Read from `tickets_flat` VIEW instead of `tickets` table.

```javascript
// BEFORE:
const {data} = await sb.from('tickets').select('*')

// AFTER:
const {data} = await sb.from('tickets_flat').select('*')
```

**Key change:** The VIEW returns UUID `id` + `ticket_number`. Dashboard currently uses `id` as `TKT-001`. After migration:
- `t.id` = UUID (for Supabase operations)
- `t.ticket_number` = `TKT-001` (for display)
- Need to update all display references from `t.id` to `t.ticket_number`
- Need to update all Supabase write operations to use UUID `t.id`

**Mapping layer needed:**
```javascript
// After loading from VIEW, map for backward compatibility
data.forEach(t => {
  t._uuid = t.id;              // Keep UUID for DB operations
  t.id = t.ticket_number;      // Dashboard keeps using TKT-xxx
});
```

### 4.2 Dashboard `saveState()` — MODERATE change

**Strategy:** Write to `tickets_v2` (core fields only). Child tables written by specific actions.

```javascript
// BEFORE: upsert entire flat object to 'tickets'
// AFTER: upsert core fields to 'tickets_v2' using UUID

const copy = {...t};
// Remove child table fields (they live in their own tables)
delete copy.from_email; delete copy.to_email; // → ticket_emails
delete copy.attachment_url;                    // → ticket_attachments
delete copy.vision_parsed;                     // → ticket_vision_results
delete copy.extracted_employees;               // → ticket_employee_extractions
// ... etc

// Use UUID for upsert
const uuid = copy._uuid;
delete copy._uuid;
delete copy.id;  // Don't send TKT-xxx to UUID column
delete copy.ticket_number; // Auto-generated, don't overwrite

sb.from('tickets_v2').upsert({id: uuid, ...copy}, {onConflict: 'id'})
```

### 4.3 Webhook (`api/webhook.js`) — MAJOR rewrite

**Strategy:** Insert across multiple tables in a transaction-like pattern.

```javascript
// 1. Insert core ticket → get UUID back
const {data: newTicket} = await supabase
  .from('tickets_v2')
  .insert({
    company, type, currency, scenario, status, risk_level,
    amount_requested, amount_on_bank_slip, has_mismatch,
    approval_matrix_complete, required_approvals, email_approvals,
    n8n_source: true
  })
  .select('id, ticket_number')
  .single();

const ticketId = newTicket.id;           // UUID
const ticketNumber = newTicket.ticket_number;  // TKT-012

// 2. Insert email
await supabase.from('ticket_emails').insert({
  ticket_id: ticketId,
  source_email_id, from_email, to_email, ...emailFields
});

// 3. Upload attachment → insert record
if (attachment_base64) {
  const filePath = `${ticketNumber}/attachment.${ext}`;
  await supabase.storage.from('attachments').upload(filePath, buffer);
  const {data: att} = await supabase.from('ticket_attachments')
    .insert({ticket_id: ticketId, file_name, mime_type, storage_url})
    .select('id').single();

  // 4. Insert vision results (linked to attachment)
  if (vision_parsed) {
    await supabase.from('ticket_vision_results').insert({
      ticket_id: ticketId, attachment_id: att.id,
      vision_parsed, vision_confidence, ...visionFields
    });
  }
}

// 5. Insert employee extraction
if (extracted_employees?.length > 0) {
  await supabase.from('ticket_employee_extractions').insert({
    ticket_id: ticketId, extracted_employees, employee_count, ...
  });
}

// 6. Activity log
await supabase.from('activity_log').insert({
  ticket_id: ticketNumber,  // Keep TKT-xxx for readability
  action: 'CREATE',
  message: `${ticketNumber} auto-created via n8n from ${company}`
});
```

### 4.4 Dashboard `createTicketFromN8n()` — MODERATE change

Same pattern as webhook but client-side. Insert to `tickets_v2` first, then child tables.

**OR** simpler: Let the webhook handle all Supabase writes. Dashboard just loads from VIEW.

### 4.5 Dashboard `generateTicketId()` — REMOVE

No longer needed. The `generate_ticket_number()` trigger handles this automatically at the database level. No more client-side ID collision risk.

### 4.6 localStorage — NO CHANGE (keep flat)

localStorage continues to store the flat ticket object for offline/speed. The VIEW provides the same flat shape, so localStorage and Supabase data are the same shape.

### 4.7 n8n Pipeline — NO CHANGE

Pipeline POSTs the same JSON to the webhook. Webhook handles the normalization. Pipeline doesn't need to know about the schema change.

### 4.8 `deriveStatus()` and `computeRisk()` — NO CHANGE

These read from the ticket object in memory. Since we map the VIEW data to the same flat shape, these functions work unchanged.

---

## 5. Implementation Order

### Step 1: Create Schema (Day 1 — ~30 min)
- [ ] Run Phase A SQL in Supabase SQL Editor (create tables, indexes, triggers)
- [ ] Run Phase B SQL (create VIEW)
- [ ] Verify VIEW returns correct shape
- **Risk:** Zero. New tables exist alongside old table. Nothing breaks.

### Step 2: Migrate Data (Day 1 — ~15 min)
- [ ] Run Phase C SQL (migrate 11 tickets)
- [ ] Verify all tickets appear in `tickets_flat` VIEW
- [ ] Verify ticket_numbers match old IDs (TKT-001 through TKT-011)
- **Risk:** Low. Old table untouched. If migration is wrong, drop new tables and retry.

### Step 3: Webhook Rewrite (Day 1-2 — ~2 hours)
- [ ] Rewrite `api/webhook.js` to insert across normalized tables
- [ ] Test with new email → verify TKT-012 appears in all tables
- [ ] Verify VIEW shows TKT-012 correctly
- [ ] Keep old webhook as `api/webhook-legacy.js` for rollback
- **Risk:** Medium. If webhook breaks, pipeline creates tickets but dashboard doesn't show them. Rollback: swap back to legacy webhook.

### Step 4: Dashboard Read Layer (Day 2 — ~1 hour)
- [ ] Change `loadState()` to read from `tickets_flat` VIEW
- [ ] Add ID mapping layer (`_uuid` + `ticket_number`)
- [ ] Test: all 12 tickets display correctly, all fields populated
- [ ] Test: sorting, filtering, status badges all work
- **Risk:** Medium. If VIEW data is wrong shape, dashboard breaks. Rollback: revert loadState to read from old `tickets` table.

### Step 5: Dashboard Write Layer (Day 2-3 — ~2 hours)
- [ ] Update `saveState()` to write to `tickets_v2` (core fields only)
- [ ] Update `updateTicket()` to write to `tickets_v2`
- [ ] Update specific actions (finance approval, checker review, etc.) to write to correct tables
- [ ] Test: full workflow end-to-end (create → finance → checker → disburse → close)
- **Risk:** High. Write operations across multiple tables. Test thoroughly.

### Step 6: Dashboard Ticket Creation (Day 3 — ~1 hour)
- [ ] Update `createTicketFromN8n()` to write to normalized tables
- [ ] Remove `generateTicketId()` (DB trigger handles it)
- [ ] Update manual ticket creation (mock emails) to write normalized
- [ ] Test: create ticket from mock email, verify in all tables
- **Risk:** Medium.

### Step 7: End-to-End Verification (Day 3 — ~1 hour)
- [ ] Send test email → pipeline → webhook → normalized tables → VIEW → dashboard
- [ ] Walk through full workflow: Steps 1-7
- [ ] Verify activity_log still works
- [ ] Verify localStorage fallback still works
- [ ] Verify both Vercel deployments (Pro + Hobby)
- **Risk:** Low if previous steps passed.

### Step 8: Cleanup (Day 4 — optional, post go-live)
- [ ] Rename `tickets` → `tickets_legacy`
- [ ] Rename `tickets_v2` → `tickets`
- [ ] Update VIEW to reference renamed table
- [ ] Remove `webhook-legacy.js`
- [ ] Remove legacy `n8n_ticket` URL parameter handling

---

## 6. Rollback Plan

At EVERY step, rollback is possible:

| Step | Rollback |
|------|----------|
| 1. Create tables | `DROP TABLE tickets_v2 CASCADE` |
| 2. Migrate data | Drop + recreate tables |
| 3. Webhook | Swap `webhook.js` ↔ `webhook-legacy.js` |
| 4. Read layer | Change `tickets_flat` back to `tickets` in loadState |
| 5. Write layer | Revert saveState to old upsert pattern |
| 6. Creation | Revert createTicketFromN8n |

**The old `tickets` table stays untouched until Step 8.** This means at any point before Step 8, we can revert everything by changing 1-2 lines in the dashboard code.

---

## 7. What This Unlocks

After refactoring:
- **Multiple emails per ticket** — corrections, follow-ups tracked separately
- **Multiple attachments** — bank slip + employee list + receipts
- **Vision audit trail** — every OCR attempt stored, not just the latest
- **Employee extraction history** — re-extractions don't overwrite
- **Proper financial types** — `NUMERIC(18,2)` not floating point
- **Type-safe ENUMs** — database rejects invalid status/scenario values
- **Auto-generated ticket IDs** — no more client-side collision risk
- **NextJS ready** — normalized schema maps directly to Prisma/Drizzle models
- **No more 70-column monster** — clean, maintainable, auditable

---

## 8. Timeline

| Day | Work | Duration |
|-----|------|----------|
| **Apr 11 (Fri)** | Steps 1-2: Schema + migration | ~45 min |
| **Apr 11 (Fri)** | Step 3: Webhook rewrite + test | ~2 hours |
| **Apr 14 (Mon)** | Steps 4-5: Dashboard read + write | ~3 hours |
| **Apr 14 (Mon)** | Step 6: Ticket creation | ~1 hour |
| **Apr 15 (Tue)** | Step 7: End-to-end verification | ~1 hour |
| **Apr 16-18** | Buffer for 3 go-live features | — |
| **Apr 19 (Sat)** | Go-live | — |
| **Post go-live** | Step 8: Cleanup | ~30 min |

**Total engineering time: ~8 hours across 3 days, with 3 buffer days before go-live.**
