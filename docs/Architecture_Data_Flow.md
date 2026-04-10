# Architecture & Data Flow — Wave EMI Dashboard

**For:** Binh, Tin, DK, backend team
**Updated:** April 10, 2026
**Verified against:** actual codebase (index.html, api/webhook.js, n8n-workflow-v6.json)

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT                                    │
│  Sends email to: emoney@zeyalabs.ai                              │
│  With: company name, amount, approvers, attachment (optional)    │
└─────────────────────────┬───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   n8n PIPELINE v6 (10 nodes)                     │
│  Host: tts-test.app.n8n.cloud                                    │
│                                                                  │
│  Outlook Trigger (polls every 1 min)                             │
│       ↓                                                          │
│  Prepare for AI v3 (extract body, from, subject, attachment)     │
│       ↓                                                          │
│  Groq AI Extract (llama-3.3-70b → company, amount, approvers)   │
│       ↓                                                          │
│  Vision Process (Groq for images, Gemini 2.5 Flash for PDFs)     │
│       ↓                                                          │
│  Employee Extract (names, phone numbers, amounts from document)  │
│       ↓                                                          │
│  Parse & Validate (authority matrix, cross-validation, scenario) │
│       ├──→ POST to Vercel webhook (ticket data + attachment)     │
│       └──→ Route → Send Outlook Notification (email to sender)   │
└─────────────────────────┬───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│               VERCEL WEBHOOK (api/webhook.js)                    │
│  URL: https://project-ii0tm.vercel.app/api/webhook               │
│                                                                  │
│  1. Receive ticket JSON + attachment_base64 from pipeline        │
│  2. Generate ticket ID (query Supabase for max ID)               │
│  3. Compute scenario, status, risk_level                         │
│  4. If attachment: upload to Supabase Storage                    │
│     → bucket: "attachments"                                      │
│     → path: "TKT-XXX/attachment.{jpg|png|pdf}"                   │
│     → get back public URL                                        │
│  5. Upsert ticket to Supabase PostgreSQL                         │
│  6. Insert activity_log entry                                    │
│  7. Return { ticket_id, dashboard_url, supabase_persisted }      │
└─────────────────────────┬───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE (PostgreSQL)                          │
│  Project: dicluyfkfqlqjwqikznl                                   │
│  Region: Southeast Asia (Singapore)                              │
│                                                                  │
│  Tables:                                                         │
│    tickets (~70 columns) — all disbursement request data         │
│    activity_log (5 columns) — audit trail                        │
│                                                                  │
│  Storage:                                                        │
│    bucket "attachments" — original documents (public, 10MB max)  │
│    → TKT-001/attachment.jpg                                      │
│    → TKT-005/attachment.jpg                                      │
└─────────────────────────┬───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                  DASHBOARD (index.html)                           │
│  URL: https://project-ii0tm.vercel.app                           │
│                                                                  │
│  On page load:                                                   │
│    loadState() → Supabase SELECT * FROM tickets                  │
│                → fallback to localStorage if Supabase fails      │
│                                                                  │
│  On any action (approve, upload, etc):                           │
│    saveState() → localStorage (immediate)                        │
│                → Supabase upsert (async, non-blocking)           │
│                                                                  │
│  Dual-write: both always in sync                                 │
│  Rollback: set sb = null → localStorage only                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Two Data Paths (Write)

### Path 1: Pipeline → Webhook → Supabase (Server-Side)

When an email arrives, the pipeline processes it and POSTs to our webhook.
The webhook writes directly to Supabase **server-side** — no browser needed.

```
n8n Parse & Validate node:
  → helpers.httpRequest({
      method: 'POST',
      url: 'https://project-ii0tm.vercel.app/api/webhook',
      body: r.json   // ticket data + attachment_base64
    })

api/webhook.js:
  → supabase.from('tickets').upsert(ticket)
  → supabase.storage.from('attachments').upload(filePath, buffer)
  → supabase.from('activity_log').insert({...})
```

**Source:** `api/webhook.js` (lines 1-120)

### Path 2: Dashboard → Supabase (Client-Side)

When a user takes action on the dashboard (approve, upload, etc), the change
is written to both localStorage AND Supabase.

```
User clicks "Approve" → updateTicket(id, {finance_status:'APPROVED'})
  → Object.assign(ticket, updates)
  → deriveStatus(ticket)     // recalculate status
  → computeRisk(ticket)      // recalculate risk
  → localStorage.setItem()   // immediate
  → sb.from('tickets').upsert(ticket)  // async, non-blocking
```

**Source:** `index.html` (lines 734-748)

---

## Data Read Path

### On Page Load

```
initState()              // line 820
  → loadState()          // line 678 (async)
    → sb.from('tickets')
        .select('*')
        .order('created_at', {ascending: false})
    → if Supabase returns data: use it
    → if empty or error: fallback to localStorage
  → if no tickets at all: seedDemoTickets()
  → renderDashboard()
```

**Source:** `index.html` (lines 678-709, 820-822)

---

## Database Schema

### tickets table (~70 columns)

```sql
-- Identity
id TEXT PRIMARY KEY                    -- TKT-001 format
source_email_id TEXT                   -- N8N-1712345678
created_at TIMESTAMPTZ DEFAULT NOW()   -- UTC timestamp
updated_at TIMESTAMPTZ DEFAULT NOW()   -- auto-updated by trigger

-- Client & Transaction
company TEXT                           -- "Kyaw Trading Co."
type TEXT                              -- "SalaryToMA" | "SalaryToOTC"
currency TEXT DEFAULT 'MMK'
scenario TEXT                          -- "NORMAL" | "AMOUNT_MISMATCH" | "MISSING_APPROVAL"

-- Amounts
amount_requested NUMERIC               -- from email (e.g., 245600)
amount_on_bank_slip NUMERIC            -- from uploaded bank slip
amount_on_document NUMERIC             -- from Vision AI extraction
employee_total NUMERIC                 -- sum of employee amounts
has_mismatch BOOLEAN                   -- email ≠ document amount

-- Approvals (JSONB)
required_approvals JSONB               -- ["Sales HOD", "Finance Manager"]
email_approvals JSONB                  -- [{name, role, status}, ...]
approval_matrix_complete BOOLEAN       -- all required approvals found?

-- Status (derived by deriveStatus())
status TEXT                            -- see State Machine below
risk_level TEXT                        -- HIGH | MEDIUM | LOW

-- Email Metadata
from_email TEXT                        -- sender address
original_subject TEXT                  -- email subject line
email_body_full TEXT                   -- full email body (capped 2000 chars)

-- Vision AI
vision_parsed BOOLEAN                  -- AI analyzed document?
vision_confidence NUMERIC              -- 0.0 to 1.0
extracted_employees JSONB              -- [{name, account_or_phone, amount}, ...]

-- Attachment (Supabase Storage)
attachment_url TEXT                     -- public URL to file in Storage
attachment_mime_type TEXT               -- image/jpeg, image/png, application/pdf

-- Processing (Steps 4-7)
prechecks_done BOOLEAN
finance_status TEXT                     -- PENDING | APPROVED | REJECTED
sent_to_checker BOOLEAN
files_prepared BOOLEAN
closed BOOLEAN
```

### activity_log table

```sql
id SERIAL PRIMARY KEY
ticket_id TEXT REFERENCES tickets(id)   -- FK to tickets
action TEXT                             -- CREATE | APPROVE | REJECT | UPDATE
message TEXT                            -- human-readable description
created_at TIMESTAMPTZ DEFAULT NOW()
```

### Storage bucket: "attachments"

```
Config:
  - Public: Yes (dashboard displays via URL)
  - Max file size: 10MB
  - Allowed types: image/jpeg, image/png, application/pdf

Structure:
  attachments/
    TKT-001/attachment.jpg
    TKT-005/attachment.jpg
    TKT-008/attachment.pdf
```

---

## Ticket State Machine

```
AWAITING_EMPLOYEE_LIST          ← initial state (no employee list uploaded)
  ↓ employee list uploaded + submitted
ASKED_CLIENT                    ← if amount mismatch detected
  ↓ client resubmits or override
PENDING_FINANCE                 ← waiting for finance approval
  ├→ REJECTED                   ← terminal (finance rejected)
  └→ READY_FOR_CHECKER          ← finance approved
       ↓
     SENT_TO_CHECKER → WITH_CHECKER → PREPARING_FILES
       ↓
     GROUP_MAPPING (OTC only)
       ↓
     DISBURSING → CLOSING → COMPLETED
```

**Computed by:** `deriveStatus(ticket)` — `index.html` line 613

**Risk levels:**
- HIGH: has_mismatch OR missing approvals
- MEDIUM: invalid phone numbers found
- LOW: everything clean

**Computed by:** `computeRisk(ticket)` — `index.html` line 631

---

## Authentication & Security

### Current (Development)

| Component | Auth Method | Key Type |
|---|---|---|
| Dashboard → Supabase | Anon key (public, client-side) | JWT in index.html |
| Webhook → Supabase | Service role key (secret, server-side) | Env var on Vercel |
| Pipeline → Webhook | No auth (open endpoint) | CORS allows * |
| User roles | Dropdown selector (no enforcement) | localStorage |

### Future (Production)

| Component | Improvement |
|---|---|
| Dashboard | Supabase Auth (login page, session management) |
| Webhook | API key or JWT verification |
| Roles | RLS policies per role (Intake can't approve, Finance can't export) |
| Storage | Private bucket + signed URLs (not public) |

---

## Key Files Reference

| File | Location | What to Review |
|---|---|---|
| `api/webhook.js` | Server-side | Supabase write + Storage upload (~120 lines) |
| `index.html` lines 458-470 | Client-side | Supabase client init |
| `index.html` lines 653-748 | Client-side | saveState, loadState, updateTicket, logActivity |
| `index.html` lines 613-635 | Client-side | deriveStatus, computeRisk (state machine) |
| `index.html` lines 2495-2540 | Client-side | createTicketFromN8n (field mapping) |
| `pipelines/n8n-workflow-v6.json` | Pipeline | Parse & Validate node (webhook POST) |
| `package.json` | Dependencies | @supabase/supabase-js |

---

## Optimization Opportunities for Binh

| Area | Current State | Improvement | Priority |
|---|---|---|---|
| Ticket ID | Queries DB for max ID each time | Use PostgreSQL SERIAL or sequence | Medium |
| Dual-write | localStorage + Supabase always | Drop localStorage, Supabase only | Low (after stable) |
| Employee data | JSONB array inside tickets table | Separate `employees` table with FK | Medium |
| Activity log | Simple text messages | Structured: action_type enum, user_id, before/after JSON | Medium |
| Auth | No auth, role = dropdown | Supabase Auth + RLS per role | High (production) |
| Real-time | Manual page refresh to see new tickets | Supabase Realtime subscriptions | High (UX) |
| Webhook security | Open POST endpoint | API key validation or JWT | High (production) |
| Batch insert | Loop upsert per ticket in saveState | Single upsert with array | Low |

---

## Environment Variables

### Vercel (project-ii0tm)

| Key | Where Used | Purpose |
|---|---|---|
| `SUPABASE_URL` | api/webhook.js | Server-side Supabase connection |
| `SUPABASE_SERVICE_KEY` | api/webhook.js | Full DB + Storage access (secret) |

### Dashboard (index.html — client-side, public)

| Key | Hardcoded In | Purpose |
|---|---|---|
| `SUPABASE_URL` | Line 464 | Client-side read/write |
| `SUPABASE_ANON_KEY` | Line 465 | Public key, limited by RLS |
