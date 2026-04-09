# DB Implementation Plan — Execute Tonight

**Date:** April 9, 2026
**Who:** DK (solo — Tin on call for Supabase admin)
**Goal:** Tickets persist in Supabase. Multiple users see same data. Go-live ready.
**Time estimate:** 3-4 hours

---

## Pre-requisites

- [x] Supabase Pro project exists (Tin's org: tindangtt)
- [ ] Supabase project URL
- [ ] Supabase anon key
- [ ] Supabase service role key (for webhook)

**Get these from:** Supabase Dashboard → Settings → API

---

## Step 1: Create Tables (10 min)

Go to Supabase Dashboard → SQL Editor → New Query → paste and run:

```sql
-- ============================================
-- TICKETS: Master disbursement records
-- ============================================
CREATE TABLE IF NOT EXISTS tickets (
  -- Identity
  id TEXT PRIMARY KEY,
  source_email_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Client & Type
  company TEXT NOT NULL DEFAULT 'Unknown Company',
  type TEXT NOT NULL DEFAULT 'SalaryToMA',
  currency TEXT DEFAULT 'MMK',
  scenario TEXT DEFAULT 'NORMAL',

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

  -- Status & Risk
  status TEXT DEFAULT 'AWAITING_EMPLOYEE_LIST',
  risk_level TEXT DEFAULT 'LOW',

  -- Track A: Pre-checks
  prechecks_done BOOLEAN DEFAULT FALSE,
  prechecks_at TIMESTAMPTZ,
  employee_file_name TEXT,
  employee_data JSONB,
  total_employees INT DEFAULT 0,
  invalid_msisdn_count INT DEFAULT 0,
  names_cleaned_count INT DEFAULT 0,
  reconciliation JSONB,

  -- Bank Slip
  bank_slip_filename TEXT,
  bank_slip_type TEXT,

  -- Track B: Finance
  finance_status TEXT DEFAULT 'PENDING',
  finance_approved_by TEXT,
  finance_approved_at TIMESTAMPTZ,
  finance_notes TEXT,

  -- E-Money Processing
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

  -- Finance Document
  depositor_name TEXT,
  remark TEXT,
  transaction_id TEXT,

  -- Pre-extracted Employees
  extracted_employees JSONB DEFAULT '[]',
  extracted_employee_count INT DEFAULT 0,
  employee_extraction_confidence NUMERIC DEFAULT 0,
  employee_extraction_status TEXT DEFAULT 'none'
);

CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_company ON tickets(company);
CREATE INDEX IF NOT EXISTS idx_tickets_created ON tickets(created_at DESC);

-- ============================================
-- ACTIVITY_LOG: Audit trail
-- ============================================
CREATE TABLE IF NOT EXISTS activity_log (
  id SERIAL PRIMARY KEY,
  ticket_id TEXT REFERENCES tickets(id),
  action TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_ticket ON activity_log(ticket_id);
CREATE INDEX IF NOT EXISTS idx_activity_time ON activity_log(created_at DESC);

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

DROP TRIGGER IF EXISTS tickets_updated_at ON tickets;
CREATE TRIGGER tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- RLS: Allow all (internal tool)
-- ============================================
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON tickets;
CREATE POLICY "Allow all" ON tickets FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON activity_log;
CREATE POLICY "Allow all" ON activity_log FOR ALL USING (true) WITH CHECK (true);
```

**Verify:** Go to Table Editor → should see `tickets` and `activity_log` tables.

---

## Step 2: Add Supabase to index.html (15 min)

### 2.1 Add CDN script (line 8, after SheetJS)

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

### 2.2 Add Supabase client initialization

Find this section (around line 600-610):
```javascript
// ─── STATE ──────────────────────────────
```

Add BEFORE state declaration:
```javascript
// ─── SUPABASE CLIENT ────────────────────
const SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
let sb = null;
try { sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); } catch(e) { console.warn('Supabase not available, using localStorage only'); }
```

---

## Step 3: Modify 6 Functions (2-3 hours)

### 3.1 saveState() — Add Supabase sync

**Current (line 644):**
```javascript
function saveState(){
  try{
    const ticketsClean = {};
    for(const [k,t] of Object.entries(state.tickets)){
      const copy = {...t};
      delete copy.bank_slip_dataurl;
      ticketsClean[k] = copy;
    }
    localStorage.setItem(LS_TICKETS, JSON.stringify(ticketsClean));
    localStorage.setItem(LS_ACTIVITY, JSON.stringify(state.activityLog));
    localStorage.setItem(LS_PARSED, JSON.stringify([...state.parsedEmails]));
    localStorage.setItem(LS_ROLE, state.currentRole);
  } catch(e){ /* non-blocking */ }
}
```

**New:**
```javascript
function saveState(){
  try{
    const ticketsClean = {};
    for(const [k,t] of Object.entries(state.tickets)){
      const copy = {...t};
      delete copy.bank_slip_dataurl;
      ticketsClean[k] = copy;
    }
    localStorage.setItem(LS_TICKETS, JSON.stringify(ticketsClean));
    localStorage.setItem(LS_ACTIVITY, JSON.stringify(state.activityLog));
    localStorage.setItem(LS_PARSED, JSON.stringify([...state.parsedEmails]));
    localStorage.setItem(LS_ROLE, state.currentRole);
  } catch(e){ /* non-blocking */ }

  // Supabase sync (non-blocking)
  if(sb){
    for(const [k,t] of Object.entries(state.tickets)){
      const copy = {...t};
      delete copy.bank_slip_dataurl;
      sb.from('tickets').upsert(copy, {onConflict:'id'}).then(({error})=>{
        if(error) console.warn('Supabase sync error:', error.message);
      });
    }
  }
}
```

### 3.2 loadState() — Load from Supabase first, fallback to localStorage

**New:**
```javascript
async function loadState(){
  // Try Supabase first
  if(sb){
    try{
      const {data, error} = await sb.from('tickets').select('*').order('created_at',{ascending:false});
      if(!error && data && data.length > 0){
        state.tickets = {};
        data.forEach(t => { state.tickets[t.id] = t; });
        console.log('Loaded', data.length, 'tickets from Supabase');
      }
      const {data:logs, error:logErr} = await sb.from('activity_log').select('*').order('created_at',{ascending:false}).limit(50);
      if(!logErr && logs){
        state.activityLog = logs.map(l => ({time: new Date(l.created_at).toLocaleTimeString('en-US',{hour12:false}), message: l.message}));
      }
    } catch(e){ console.warn('Supabase load failed, using localStorage'); }
  }

  // Fallback / merge from localStorage
  try{
    if(Object.keys(state.tickets).length === 0){
      const t = localStorage.getItem(LS_TICKETS);
      if(t) state.tickets = JSON.parse(t);
    }
    if(state.activityLog.length === 0){
      const a = localStorage.getItem(LS_ACTIVITY);
      if(a) state.activityLog = JSON.parse(a);
    }
    const p = localStorage.getItem(LS_PARSED);
    if(p) state.parsedEmails = new Set(JSON.parse(p));
    const r = localStorage.getItem(LS_ROLE);
    if(r) state.currentRole = r;
  } catch(e){ /* non-blocking */ }
}
```

**IMPORTANT:** Since loadState is now async, the initialization call needs to change. Find where `loadState()` is called on page load and change to:
```javascript
loadState().then(() => {
  showPage('dashboard');
});
```

### 3.3 updateTicket() — Add Supabase update

**New:**
```javascript
function updateTicket(id, updates){
  const t = state.tickets[id];
  Object.assign(t, updates);
  t.status = deriveStatus(t);
  t.risk_level = computeRisk(t);
  state.tickets[id] = t;
  saveState();

  // Supabase direct update (non-blocking)
  if(sb){
    const copy = {...t};
    delete copy.bank_slip_dataurl;
    sb.from('tickets').upsert(copy, {onConflict:'id'}).then(({error})=>{
      if(error) console.warn('Supabase update error:', error.message);
    });
  }
}
```

### 3.4 logActivity() — Add Supabase insert

**New:**
```javascript
function logActivity(msg){
  const now = new Date();
  const time = [now.getHours(),now.getMinutes(),now.getSeconds()].map(n=>String(n).padStart(2,'0')).join(':');
  state.activityLog.unshift({time, message:msg});
  if(state.activityLog.length > 50) state.activityLog.length = 50;
  saveState();

  // Supabase activity log (non-blocking)
  if(sb){
    const ticketMatch = msg.match(/TKT-\d+/);
    sb.from('activity_log').insert({
      ticket_id: ticketMatch ? ticketMatch[0] : null,
      action: msg.includes('created') ? 'CREATE' : msg.includes('approved') ? 'APPROVE' : msg.includes('rejected') ? 'REJECT' : 'UPDATE',
      message: msg
    }).then(({error})=>{
      if(error) console.warn('Supabase log error:', error.message);
    });
  }
}
```

### 3.5 generateTicketId() — Query Supabase for max ID

**New:**
```javascript
function generateTicketId(){
  // Use local state for immediate ID (Supabase is async)
  const existing = Object.keys(state.tickets).filter(k=>k.startsWith('TKT-'));
  const nums = existing.map(k => parseInt(k.replace('TKT-','')) || 0);
  const maxNum = nums.length > 0 ? Math.max(...nums) : 0;
  return 'TKT-'+String(maxNum+1).padStart(3,'0');
}
```

### 3.6 createTicketFromN8n() — No change needed

This function calls `saveState()` at the end, which now includes Supabase sync. The dual-write happens automatically.

---

## Step 4: Update Webhook (30 min)

**File:** `api/webhook.js`

Add Supabase server-side write so pipeline data persists even if no browser is open:

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://YOUR_PROJECT_REF.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'YOUR_SERVICE_ROLE_KEY'
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const data = req.body;
  if (!data || !data.company) {
    return res.status(400).json({ error: 'Missing required field: company' });
  }

  // Generate ticket ID (query Supabase for max)
  let ticketId = 'TKT-001';
  try {
    const { data: latest } = await supabase
      .from('tickets')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1);
    if (latest && latest.length > 0) {
      const num = parseInt(latest[0].id.replace('TKT-', '')) || 0;
      ticketId = 'TKT-' + String(num + 1).padStart(3, '0');
    }
  } catch (e) { /* fallback to TKT-001 */ }

  // Build ticket object
  const ticket = {
    id: ticketId,
    source_email_id: 'N8N-' + Date.now(),
    company: data.company || 'Unknown Company',
    type: data.type || 'SalaryToMA',
    currency: data.currency || 'MMK',
    amount_requested: data.amount_requested || data.amount || 0,
    amount_on_bank_slip: data.amount_on_bank_slip || data.amount_requested || 0,
    scenario: data.scenario || 'NORMAL',
    approval_matrix_complete: data.matrix_complete || false,
    required_approvals: data.required_approvals || ['Sales HOD', 'Finance Manager'],
    email_approvals: data.approvals || [],
    n8n_source: true,
    n8n_parsed_at: data.parsed_at || new Date().toISOString(),
    from_email: data.from_email || '',
    to_email: data.to_email || '',
    original_subject: data.original_subject || '',
    body_preview: data.body_preview || '',
    email_body_full: data.email_body_full || '',
    has_attachments: data.has_attachments || false,
    attachment_names: data.attachment_names || [],
    attachment_count: data.attachment_count || 0,
    vision_parsed: data.vision_parsed || false,
    vision_confidence: data.vision_confidence || 0,
    vision_status: data.vision_status || 'none',
    amount_on_document: data.amount_on_document || 0,
    document_type: data.document_type || '',
    extracted_employees: data.extracted_employees || [],
    extracted_employee_count: data.extracted_employee_count || 0,
    employee_extraction_confidence: data.employee_extraction_confidence || 0,
    employee_total_extracted: data.employee_total_extracted || 0,
    has_mismatch: data.amount_mismatch || false,
    depositor_name: data.depositor_name || '',
    remark: data.remark || '',
    transaction_id: data.transaction_id || '',
  };

  // Persist to Supabase
  const { error } = await supabase.from('tickets').upsert(ticket, { onConflict: 'id' });
  if (error) {
    console.error('Supabase insert error:', error);
  }

  // Also log activity
  await supabase.from('activity_log').insert({
    ticket_id: ticketId,
    action: 'CREATE',
    message: `${ticketId} auto-created via n8n from ${data.company || 'email'}`
  });

  // Generate dashboard URL (short — ticket is in DB now)
  const url = `https://wave-emi-dashboard.vercel.app/?ticket=${ticketId}`;

  // ALSO keep base64 URL for backward compatibility
  const encoded = Buffer.from(JSON.stringify(ticket)).toString('base64');
  const legacyUrl = `https://wave-emi-dashboard.vercel.app/?n8n_ticket=${encoded}`;

  return res.status(200).json({
    success: true,
    ticket_id: ticketId,
    dashboard_url: url,
    legacy_dashboard_url: legacyUrl,
    company: ticket.company,
    amount: ticket.amount_requested,
  });
}
```

**Vercel env vars to set:**
- `SUPABASE_URL` = your project URL
- `SUPABASE_SERVICE_KEY` = service role key (NOT anon key)

---

## Step 5: Add URL Parameter Handler (15 min)

Add support for short `?ticket=TKT-006` URLs. Find where `n8n_ticket` is handled on page load and add:

```javascript
// Handle short ticket URL (?ticket=TKT-006)
const ticketParam = new URLSearchParams(window.location.search).get('ticket');
if(ticketParam && sb){
  sb.from('tickets').select('*').eq('id', ticketParam).single().then(({data, error}) => {
    if(!error && data){
      state.tickets[data.id] = data;
      saveState();
      showPage('dashboard');
      setTimeout(() => openTicketDetail(data.id), 500);
    }
  });
}
```

---

## Step 6: Test Checklist

| # | Test | How | Expected |
|---|------|-----|----------|
| 1 | Tables exist | Supabase Table Editor | tickets + activity_log visible |
| 2 | Manual insert | SQL Editor: `INSERT INTO tickets (id, company) VALUES ('TEST-001', 'Test Co');` | Row appears |
| 3 | Dashboard loads from Supabase | Open dashboard, check console for "Loaded X tickets from Supabase" | Tickets appear |
| 4 | Create ticket → appears in Supabase | Send test email → check Supabase Table Editor | New row in tickets table |
| 5 | Two browsers same data | Open dashboard in Chrome + Edge | Same tickets in both |
| 6 | Activity log persists | Create ticket → refresh → check Activity Log | Entries still there |
| 7 | Webhook writes to Supabase | Send email → check Supabase directly | Row created by webhook |
| 8 | Short URL works | Open `?ticket=TKT-006` | Ticket modal opens |

---

## Rollback Plan

If anything breaks: remove the Supabase code, everything falls back to localStorage. The dual-write strategy means localStorage is always up to date.

```javascript
// Emergency: disable Supabase
const sb = null; // Comment out createClient line
```
