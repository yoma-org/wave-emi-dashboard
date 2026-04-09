# Backend + Database Plan (KAN-26)

**Date:** April 9, 2026 (Updated: Apr 9 evening)
**Jira:** KAN-26 — [eMoney] Add Backend and DB
**Go-live:** Wednesday April 15 (board meeting April 16)
**Interim stack:** Vercel Pro + Supabase Pro (Zaya Labs account, Tin's org)

### Team

| Person | Role | Status |
|--------|------|--------|
| **DK** | DB integration + pipeline | Active — executing DB plan tonight |
| **Binh Le Quang** | Backend support + NextJS review | Onboarding — reading codebase guide |
| **Tin** | Supabase Pro admin + infra | On call — owns Supabase project |
| **Huy** | Infrastructure guide | Supporting Tin on infra decisions |
| **Dong** | Frontend (NextJS React) | Out of office — joins later |

### Detailed Plans (Split for Parallel Execution)

| Document | Purpose | Who |
|----------|---------|-----|
| **`Plan_DB_Implementation.md`** | Step-by-step DB execution plan (tonight) | DK |
| **`Guide_Codebase_Onboarding_Binh.md`** | Business flow + code architecture + migration vision | Binh |
| **This file** | Master plan + long-term roadmap | Everyone |

---

## Strategic Decision: Don't Rewrite, Extend

The current dashboard (index.html, 2,700 lines) works. Rita said "basically done." Rewriting to NextJS in 4 days with Dong out of office is too risky.

**Short-term (Apr 9-15):** DK wires Supabase into index.html. Binh studies codebase + reviews migration plan.
**Mid-term (Apr 16-18):** DK + Binh plan NextJS migration together. Dong joins for frontend.
**Long-term (Apr 21+):** NextJS app on AWS infra (Huy + Tin set up).

---

## Short-Term Plan: Supabase Integration (Apr 10-14)

### Phase 1: Supabase Setup (2 hours — Apr 10 morning)

**1.1 Create Supabase Project**
- Organization: Already created (tindangtt's Org visible in browser tab)
- Project name: `wave-emoney`
- Region: Southeast Asia (Singapore)
- Database password: [Tin to set]

**1.2 Create Tables (SQL)**

```sql
-- ============================================
-- TICKETS: Master disbursement records
-- ============================================
CREATE TABLE tickets (
  -- Identity
  id TEXT PRIMARY KEY,  -- TKT-001 format
  source_email_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Client & Type
  company TEXT NOT NULL DEFAULT 'Unknown Company',
  type TEXT NOT NULL DEFAULT 'SalaryToMA',  -- SalaryToMA | SalaryToOTC
  currency TEXT DEFAULT 'MMK',
  scenario TEXT DEFAULT 'NORMAL',  -- NORMAL | AMOUNT_MISMATCH | MISSING_APPROVAL

  -- Amounts
  amount_requested NUMERIC DEFAULT 0,
  amount_on_bank_slip NUMERIC DEFAULT 0,
  amount_on_document NUMERIC DEFAULT 0,
  employee_total NUMERIC,
  employee_total_extracted NUMERIC DEFAULT 0,
  has_mismatch BOOLEAN DEFAULT FALSE,
  employee_amount_mismatch BOOLEAN DEFAULT FALSE,

  -- Approval Matrix
  required_approvals JSONB DEFAULT '["Sales HOD", "Finance Manager"]',
  email_approvals JSONB DEFAULT '[]',
  approval_matrix_complete BOOLEAN DEFAULT FALSE,

  -- Status & Risk (derived but cached)
  status TEXT DEFAULT 'AWAITING_EMPLOYEE_LIST',
  risk_level TEXT DEFAULT 'LOW',

  -- Track A: Pre-checks
  prechecks_done BOOLEAN DEFAULT FALSE,
  prechecks_at TIMESTAMPTZ,
  employee_file_name TEXT,
  employee_data JSONB,  -- Array of employee records
  total_employees INT DEFAULT 0,
  invalid_msisdn_count INT DEFAULT 0,
  names_cleaned_count INT DEFAULT 0,
  reconciliation JSONB,  -- Array of reconciliation checks

  -- Bank Slip
  bank_slip_filename TEXT,
  bank_slip_type TEXT,

  -- Track B: Finance
  finance_status TEXT DEFAULT 'PENDING',
  finance_approved_by TEXT,
  finance_approved_at TIMESTAMPTZ,
  finance_notes TEXT,

  -- E-Money Processing (Steps 4-7)
  sent_to_checker BOOLEAN DEFAULT FALSE,
  checker_name TEXT,
  files_prepared BOOLEAN DEFAULT FALSE,
  mapping_in_progress BOOLEAN DEFAULT FALSE,
  mapping_complete BOOLEAN DEFAULT FALSE,
  disbursing BOOLEAN DEFAULT FALSE,
  monitor_results JSONB,
  closed BOOLEAN DEFAULT FALSE,
  checker_request JSONB,

  -- Pipeline Source
  n8n_source BOOLEAN DEFAULT FALSE,
  n8n_parsed_at TIMESTAMPTZ,

  -- Email Metadata
  from_email TEXT,
  to_email TEXT,
  cc_emails TEXT,
  reply_to TEXT,
  email_date TIMESTAMPTZ,
  message_id TEXT,
  thread_id TEXT,
  original_subject TEXT,
  body_preview TEXT,
  email_body_full TEXT,

  -- Attachments
  has_attachments BOOLEAN DEFAULT FALSE,
  attachment_names JSONB DEFAULT '[]',
  attachment_count INT DEFAULT 0,

  -- Vision AI
  vision_parsed BOOLEAN DEFAULT FALSE,
  vision_confidence NUMERIC DEFAULT 0,
  vision_status TEXT DEFAULT 'none',
  document_type TEXT,
  document_signers JSONB DEFAULT '[]',

  -- Finance Document Fields
  depositor_name TEXT,
  remark TEXT,
  transaction_id TEXT,

  -- Pre-extracted Employees (from AI pipeline)
  extracted_employees JSONB DEFAULT '[]',
  extracted_employee_count INT DEFAULT 0,
  employee_extraction_confidence NUMERIC DEFAULT 0,
  employee_extraction_status TEXT DEFAULT 'none'
);

-- Index for common queries
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_company ON tickets(company);
CREATE INDEX idx_tickets_created ON tickets(created_at DESC);
CREATE INDEX idx_tickets_scenario ON tickets(scenario);

-- ============================================
-- ACTIVITY_LOG: Audit trail
-- ============================================
CREATE TABLE activity_log (
  id SERIAL PRIMARY KEY,
  ticket_id TEXT REFERENCES tickets(id),
  action TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_ticket ON activity_log(ticket_id);
CREATE INDEX idx_activity_time ON activity_log(created_at DESC);

-- ============================================
-- AUTO-UPDATE updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

**1.3 Supabase Row Level Security (RLS)**

For now, disable RLS (internal tool, no public access):
```sql
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON tickets FOR ALL USING (true);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON activity_log FOR ALL USING (true);
```

**1.4 Generate Supabase API Keys**
- Project URL: `https://[project-ref].supabase.co`
- Anon key: for client-side reads
- Service role key: for n8n webhook writes (server-side only)

---

### Phase 2: Dashboard Integration (4-6 hours — Apr 10-11)

**2.1 Add Supabase Client to index.html**

Add to `<head>`:
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

Initialize:
```javascript
const SUPABASE_URL = 'https://[project-ref].supabase.co';
const SUPABASE_ANON_KEY = '[anon-key]';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

**2.2 Replace localStorage Functions (6 functions to change)**

| Current Function | What It Does | Change |
|---|---|---|
| `saveState()` | Writes `state.tickets` to localStorage | Add: upsert to Supabase |
| `loadState()` | Reads from localStorage on page load | Add: fetch from Supabase, fallback to localStorage |
| `updateTicket(tid, updates)` | Merges updates into ticket | Add: Supabase update |
| `logActivity(message)` | Pushes to activity log array | Add: Supabase insert |
| `createTicketFromN8n(data)` | Creates ticket from pipeline | Add: Supabase insert |
| `generateTicketId()` | TKT-001 incrementing | Change: Query max ID from Supabase |

**2.3 Dual-Write Strategy (Safe Migration)**

During transition, write to BOTH localStorage AND Supabase:
```javascript
// Existing: saveState() — keep this
localStorage.setItem('emi_tickets', JSON.stringify(state.tickets));

// New: also write to Supabase
async function syncToSupabase(ticket) {
  await supabase.from('tickets').upsert(ticket, { onConflict: 'id' });
}
```

This means: if Supabase fails, localStorage still works. Zero downtime risk.

**2.4 Webhook Update (api/webhook.js)**

Update Vercel serverless function to also write to Supabase:
```javascript
// After creating ticket from n8n data, also persist to Supabase
const { error } = await supabase.from('tickets').insert(ticket);
```

---

### Phase 3: n8n Pipeline → Supabase Direct (2 hours — Apr 11)

Instead of the current flow (n8n → Vercel webhook → dashboard URL with base64), add direct Supabase write:

**Option A: n8n HTTP Request node → Supabase REST API**
```
POST https://[project-ref].supabase.co/rest/v1/tickets
Headers:
  apikey: [service-role-key]
  Authorization: Bearer [service-role-key]
  Content-Type: application/json
Body: ticket JSON
```

**Option B: Keep current webhook, add Supabase write in api/webhook.js**

Recommend Option B — less pipeline changes, webhook handles the persistence.

---

### Phase 4: Go-Live Readiness (Apr 14)

- [ ] All tickets persist across page refreshes (Supabase, not just localStorage)
- [ ] Multiple users see same tickets (shared database)
- [ ] Activity log persists (not just last 20 entries)
- [ ] Webhook writes to Supabase
- [ ] Test with Win's team — multiple browsers, same data

---

## Long-Term Plan: NextJS Migration (Apr 16+)

### When Dong Returns + AWS Infra Ready

**Phase 5: NextJS App (Week 3 — Apr 14-18)**

| Component | Who | What |
|---|---|---|
| NextJS scaffold | Dong + DK | `create-next-app`, pages matching current 9 views |
| React components | Dong | Migrate HTML → React components |
| API routes | DK | `/api/tickets`, `/api/activity`, `/api/webhook` |
| Supabase integration | DK | Server-side Supabase client in API routes |
| Auth | DK + Tin | Supabase Auth or NextAuth.js, role-based access |

**Phase 6: Proper Backend (Week 3-4)**

| Feature | Description |
|---|---|
| Role-based access | Intake/Maker, Finance, E-Money, Manager/Observer (Minh's request) |
| Proper auth | Login page, session management, role assignment |
| File storage | Supabase Storage for bank slips, employee lists, generated CSVs |
| Ticket ID from DB | Sequential IDs from database, not localStorage counter |
| Real-time updates | Supabase Realtime — tickets update live across all connected browsers |

**Phase 7: AWS Migration (Week 4+)**

| Component | From | To |
|---|---|---|
| Hosting | Vercel Pro | AWS ECS Fargate / App Runner |
| Database | Supabase Pro | AWS RDS PostgreSQL |
| File Storage | Supabase Storage | AWS S3 |
| AI Pipeline | n8n Cloud | Self-hosted n8n on AWS |
| AI Models | Groq + Gemini (consumer) | AWS Bedrock (Claude/Nova) or Vertex AI (Gemini) |

**Phase 8: Production Features (Month 2)**

| Feature | Source | Priority |
|---|---|---|
| Batch/unbatch | Rita, Apr 9 standup | P1 — go-live requirement |
| Audit confirmation form | Rita, Apr 9 standup | P1 — go-live requirement |
| Finance exemption list | Thet Hnin Wai, Apr 8 demo | P1 — go-live requirement |
| "Asked Client" → resubmission linking | Minh, Apr 8 | P2 — needs DB for old↔new ticket reference |
| E-Money Movement Form | Thet Hnin Wai, Apr 8 demo | P2 — awaiting template |
| OTC/POI validation rules | Nyan San Kim, Apr 8 demo | P2 — awaiting rules |
| SharePoint integration | Rita Phase 6 workflow | P3 — reporting phase |
| Liferay polling | Rita Phase 6 workflow | P3 — monitoring phase |
| Reversals | Rita Phase 7-9 workflow | P4 — production-only |

---

## Immediate Next Steps (Tonight / Tomorrow Morning)

| # | Action | Who | When |
|---|--------|-----|------|
| 1 | Confirm Supabase project exists (Tin's org) | DK | Tonight |
| 2 | Run SQL schema in Supabase SQL editor | DK | Tonight / Apr 10 AM |
| 3 | Get Supabase URL + anon key + service role key | DK | After step 2 |
| 4 | Add `supabase-js` CDN to index.html | DK | Apr 10 |
| 5 | Implement dual-write (localStorage + Supabase) | DK | Apr 10-11 |
| 6 | Update api/webhook.js with Supabase write | DK | Apr 11 |
| 7 | Test: multiple browsers see same tickets | DK | Apr 11 |
| 8 | Sync with Tin on Vercel Pro deployment | DK + Tin | Apr 11 |

---

## Schema Summary

| Table | Fields | Purpose |
|-------|--------|---------|
| `tickets` | ~70 fields | All disbursement request data |
| `activity_log` | 5 fields | Audit trail |
| Future: `employees` | 9 fields | Denormalized from tickets.employee_data |
| Future: `users` | Auth fields | Role-based access control |
| Future: `clients` | Email + bypass rules | Finance exemption list |
