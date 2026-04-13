# KAN-30 + KAN-31 — Implementation Plan (Tonight, Apr 13 2026)

**Target:** Ship both tickets EOD tonight. Vinh's expectation + Apr 20 go-live bar.
**Total duration:** ~4 hours across 5 blocks (0–4).
**Guiding principle:** Every step is reversible. Every block ends with a memory checkpoint so any crash is recoverable.

---

## Requirements Coverage Matrix — Vinh's Exact Asks

### KAN-30 (Email notification) — 4 requirements
| # | Vinh's ask | Covered in | Line-item |
|---|-----------|------------|-----------|
| 1 | Type of payment: salarytoMA or salarytoOTC | Block 3 | 3.4 |
| 2 | Fix attachment count (currently shows 0) | Block 3 | 3.3 |
| 3 | Expanded Verification Status checklist: Company / Payment type / Amount / Date time / Approval / Attachment / Employee List | Block 3 | 3.5 |
| 4 | Display ticket ID in email | Block 3 | 3.6 |

### KAN-31 (Dashboard) — 8 requirements
| # | Vinh's ask | Covered in | Line-item |
|---|-----------|------------|-----------|
| 1 | Rename "Wave EMI Pipeline" → "Wave eMoney" | Block 1 | 1.1 |
| 2 | Hide tabs except Dashboard | Block 2 | 2.4 |
| 3 | Rename "Wave EMI Pipeline Dashboard" → "eMoney Dashboard" | Block 1 | 1.2 |
| 4 | Remove "Unified command center - Step 1-7" subtitle | Block 1 | 1.3 |
| 5 | Reduce 5 cards → 3 (All emails / Mismatch / Ready for Finance) | Block 2 | 2.1 |
| 6 | Clickable cards → filter ticket list below | Block 2 | 2.2 |
| 7 | Search bar next to "All Tickets" (ticket ID search) | Block 2 | 2.3 |
| 8 | Remove 3 quick-filter panels below cards | Block 1 | 1.4 |

✅ **Coverage check: 12/12 Vinh requirements mapped to explicit implementation steps.**

---

## Lessons Applied (from memory, don't repeat past mistakes)

- **`feedback_schema_migration_lessons.md`** — Clone-as-fallback pattern: new pipeline = new version (v9→v10), never in-place edits
- **`feedback_debugging_workflow.md`** — Pause-think-plan before each block. Commit after each.
- **`feedback_save_everything.md`** — Checkpoint memory after every block.
- **`feedback_debugging_patterns.md`** — Test with real emails end-to-end, not just node-by-node
- **`feedback_ui_speed.md`** — DK trusts UI coding speed; don't over-engineer renames.
- **`feedback_post_refactor_fk_audit.md`** — Not applicable here (no schema changes), but keep awareness
- **`feedback_supabase_insert_error_check.md`** — Not applicable here (no new inserts)

---

## 📊 Reconnaissance Findings (COMPLETED before Block 0 — concrete facts, not assumptions)

### Git state verified
- `origin` → `github.com/DKNguyenTrustify/Wave-eMoney.git` (configured ✅)
- `yoma` → `github.com/yoma-org/wave-emi-dashboard.git` (configured ✅)
- Current branch: `main`, clean, up to date
- Last commit SHA (session rollback point): **`bb62a22`** — "Phase 4: webhook idempotency check via message_id"
- Untracked: `docs/jira/` directory (our analysis + plan + PDFs) — needs `git add` in Block 1

### `index.html` — exact line locations found

| Item | Line(s) | What's there |
|------|---------|--------------|
| `<title>` tag | 6 | `Wave EMI Pipeline — Intake & Approval Dashboard` |
| Header logo | 381 | `<div class="nav-logo"><span>W</span> Wave EMI Pipeline</div>` |
| Nav tabs (desktop) | 383–386 | 4 buttons: Dashboard / Ticket List / Finance Approval / E-Money Review |
| Role badge + switcher | 388–398 | `role-badge` span, hidden `role-select` dropdown |
| Mobile menu tabs | 406–409 | Same 4 buttons in mobile nav |
| Dashboard page render | 1130+ | `renderDashboard()` function (inferred) builds HTML string |
| Section title (Dashboard h2) | 1140 | `🌊 Wave EMI Pipeline Dashboard` |
| Section subtitle | 1141 | `Unified command center — Steps 1–7: Intake → Approval → Disbursement → Close` |
| 5-card row | 1142–1148 | Container class `summary-row-5` |
| Quick-filter conditional row | 1149 | Single long line with `visionProcessed / mismatches / highRisk` alerts |
| "All Tickets" card header | 1155 | `<div class="card-title">All Tickets</div>` |

### Existing fields for new 3-card calculations (no invention needed)

- **All emails** → `allTickets().length` (function already exists)
- **Mismatch** → `allTickets().filter(t => t.has_mismatch || t.scenario === 'AMOUNT_MISMATCH').length`
- **Ready for Finance** → `allTickets().filter(t => t.status === 'PENDING_FINANCE' || t.status === 'AWAITING_EMPLOYEE_LIST').length`

### Existing state object usage (confirmed)
- No existing `activeFilter` variable → **zero collision risk** adding new filter state
- State object pattern: `state.currentRole`, `state.parsedEmails` (Set), `state.activityLog` — will add `state.activeFilter` using same pattern
- State persisted via `saveState()` → `localStorage` key `emi_tickets`

### Pipeline v9 — exact field + location map

**Send Outlook Notification node:** line 184 of `pipelines/n8n-workflow-v9.json` (single long string)

**Parse & Validate v3 node** (line 121) already outputs these fields we need for KAN-30:
- `attachment_count` (computed from `attachment_names.length` in Prepare node)
- `attachment_names` (array of filenames)
- `extracted_employee_count` (from Employee List Extract node)
- `employee_extraction_status` (`'success'` / `'no_attachment'` / `'rate_limited'` / etc.)
- `matrix_complete` (boolean — Sales HOD + Finance Manager both found)
- `scenario` (`'NORMAL'` / `'MISSING_APPROVAL'` / `'AMOUNT_MISMATCH'`)
- `company`, `amount`, `email_date`, `ticket_id`

**KAN-30 #2 attachment bug — ROOT CAUSE confirmed:**
Current template (line 184): `{{ $json.has_attachments ? $json.attachment_count + ' file(s)' : 'None' }}`
- Bug: Outlook returns `hasAttachments: true` even when n8n hasn't downloaded binaries (size/permission restrictions)
- Flag says true but `attachment_count === 0` → shows "0 file(s)"
- **Fix (Option B — thorough):** In Prepare for AI v3 Code node, after binary loop: `has_attachments = attachment_names.length > 0;` → flag and count always in sync
- **Bonus in template:** also render `attachment_names.join(', ')` so Ops see filenames

### KAN-30 #1 payment type — literal mapping of Vinh's rule
```javascript
const paymentType = extracted_employee_count > 0 ? 'salarytoMA' : 'salarytoOTC';
```
(All variables already exist in Parse & Validate output.)

### KAN-30 #3 — all 7 verification fields have source data

| Vinh's check | Source field | Pass condition |
|---|---|---|
| Company name | `company` | `company && company !== 'Unknown Company'` |
| Payment type | `paymentType` (derived) | always set |
| Amount | `amount` | `> 0` |
| Date time | `email_date` | non-empty string |
| Approval | `matrix_complete` | `=== true` |
| Attachment | `attachment_count` | `> 0` |
| Employee List | `extracted_employee_count` | `> 0` |

---

## 🟢 Block 0 — Pre-Flight Safety Snapshot (5 min)

**Goal:** Establish a known-good baseline so we can rollback cleanly if anything goes sideways.

### Steps
1. Verify git state clean, on main branch, up to date with origin + yoma
2. Record the current HEAD commit SHA (our rollback point)
3. Verify pipeline v9 is active in n8n Cloud (our pipeline fallback)
4. Save checkpoint memory

### Commands
```bash
cd "g:/My Drive/Tech Jobs/Trustify/03_build/wave-emi-dashboard"
git status                    # must be clean
git log --oneline -1          # record SHA as ROLLBACK_POINT
git branch --show-current     # should be main
```

### Rollback if Block 0 fails
- If git has uncommitted changes: stash them (`git stash push -m "pre-kan30-31"`) before proceeding
- If not on main: `git checkout main && git pull`

### Checkpoint
Write: `memory/checkpoint_00_preflight.md`
- Baseline SHA (rollback point for entire session)
- Git clean confirmation
- v9 active confirmation
- "Safe to proceed to Block 1"

---

## 🟢 Block 1 — Text Renames + Removes (30 min, ZERO risk)

**Vinh items covered:** KAN-31 #1, #3, #4, #8
**Files touched:** `index.html` only
**Risk:** Zero — pure text/HTML edit/removal
**Also in this commit:** track `docs/jira/` (analysis + plan + PDFs) — currently untracked

### 1.0 (Bonus) Update `<title>` tag
- **Line 6:** `<title>Wave EMI Pipeline — Intake & Approval Dashboard</title>`
- Change to: `<title>Wave eMoney — Dashboard</title>`
- Browser tab shows cleaner name

### 1.1 Rename header logo: "Wave EMI Pipeline" → "Wave eMoney"
- **Line 381:** `<div class="nav-logo"><span>W</span> Wave EMI Pipeline</div>`
- Change to: `<div class="nav-logo"><span>W</span> Wave eMoney</div>`
- Preserves the `<span>W</span>` icon styling

### 1.2 Rename page title: "Wave EMI Pipeline Dashboard" → "eMoney Dashboard"
- **Line 1140:** `<div class="section-title">🌊 Wave EMI Pipeline Dashboard</div>`
- Change to: `<div class="section-title">🌊 eMoney Dashboard</div>`
- Wave emoji kept for brand

### 1.3 Remove subtitle: "Unified command center - Steps 1-7: ..."
- **Line 1141:** `<div class="section-sub">Unified command center — Steps 1–7: Intake → Approval → Disbursement → Close</div>`
- Delete entire line (drops the `section-sub` div completely)

### 1.4 Remove 3 quick-filter panels (KAN-31 #8)
- **Line 1149:** (single long line) — the `${mismatches>0||highRisk>0||visionProcessed>0?...}` conditional block
- Delete entire conditional template expression
- JS variables `mismatches`, `highRisk`, `visionProcessed` (declared lines 1135–1137) may become unused — check and remove if no other references
  - `has_mismatch` is still needed for new "Mismatch" card → keep the `mismatches` variable calculation
  - `highRisk` and `visionProcessed` → check usage; likely safe to remove if only used here

### Verification
- Open `index.html` in browser (local file or deployed)
- Browser tab: "Wave eMoney — Dashboard" ✅
- Top nav logo: "Wave eMoney" (no "EMI Pipeline") ✅
- Dashboard page h2: "🌊 eMoney Dashboard" ✅
- Subtitle row gone ✅
- Row with "X ticket(s) with Vision AI / X mismatch(es) / X high-risk" is GONE ✅
- Console shows no JS errors ✅
- Tabs (Ticket List / Finance Approval / E-Money Review) still visible and clickable — we're NOT hiding them until Block 2

### Rollback if Block 1 breaks anything
```bash
git checkout index.html       # revert all changes in this file
# Untracked docs/jira/ is preserved (not touched by checkout)
```

Or granular via git diff inspection:
```bash
git diff HEAD index.html      # see exactly what we changed
# Edit back specific problem lines
```

### Commit (includes tracking docs/jira/ for first time)
```bash
git add docs/jira/            # NEW: adds analysis + plan + PDFs
git add index.html
git commit -m "KAN-31: text renames + remove quick-filter panels (items #1,3,4,8) + track jira docs"
git push origin main
git push yoma main
```

### Checkpoint
Write: `memory/checkpoint_01_block1.md`
- SHA of commit just pushed
- Which 5 items completed (1.0 title tag + 1.1 logo + 1.2 page title + 1.3 subtitle + 1.4 quick-filter row)
- Verification result
- Vercel deployment URLs to sanity-check (both Pro + Hobby)
- "Safe to proceed to Block 2"

---

## 🟡 Block 2 — Dashboard Structural Changes (1.5 hrs, LOW risk)

**Vinh items covered:** KAN-31 #2, #5, #6, #7
**Files touched:** `index.html` only (three regions: state block ~line 518, nav block ~lines 380–410, dashboard render block ~lines 1130–1150)
**Risk:** Low — isolated scope, no existing `activeFilter` collision

### 2.1 Reduce 5 stat cards → 3 (KAN-31 #5)

**Location:** `index.html` lines 1142–1148 (container `<div class="summary-row-5">`)

**Rename container class:** `summary-row-5` → `summary-row-3` (update CSS grid columns accordingly; search for `summary-row-5` definition in `<style>` and duplicate with 3-column grid)

**Replace all 5 cards with 3:**

```javascript
// Above the template (near line 1130) — replace current variables:
const allEmails = allTickets().length;
const mismatches = allTickets().filter(t => t.has_mismatch || t.scenario === 'AMOUNT_MISMATCH').length;
const readyForFinance = allTickets().filter(t => t.status === 'PENDING_FINANCE' || t.status === 'AWAITING_EMPLOYEE_LIST').length;

// Replace summary-row-5 block with:
<div class="summary-row-3">
  <div class="stat-card accent ${state.activeFilter==='all'?'active-filter':''}" onclick="setCardFilter('all')">
    <div class="stat-label">All Emails</div>
    <div class="stat-value">${allEmails}</div>
    <div class="stat-sub">total tickets</div>
  </div>
  <div class="stat-card ${mismatches>0?'warn':''} ${state.activeFilter==='mismatch'?'active-filter':''}" onclick="setCardFilter('mismatch')">
    <div class="stat-label">Mismatch</div>
    <div class="stat-value">${mismatches}</div>
    <div class="stat-sub">need review</div>
  </div>
  <div class="stat-card ${readyForFinance>0?'ok':'blue'} ${state.activeFilter==='finance'?'active-filter':''}" onclick="setCardFilter('finance')">
    <div class="stat-label">Ready for Finance</div>
    <div class="stat-value">${readyForFinance}</div>
    <div class="stat-sub">awaiting approval</div>
  </div>
</div>
```

**Remove now-unused variable declarations** (lines 1130–1137): `newEmails`, `pending`, `ready`, `inProg`, `completed`, `highRisk`, `visionProcessed` (unless still referenced elsewhere — grep first).

### 2.2 Clickable cards as filters (KAN-31 #6)

**State extension** (near line 518 where `currentRole: 'Intake / Maker'` is defined):
```javascript
// Add to state object:
activeFilter: 'all',  // 'all' | 'mismatch' | 'finance'
searchQuery: '',      // for 2.3
```

**New global function** (add near other global functions, e.g. near `showPage`):
```javascript
function setCardFilter(filter) {
  // Toggle off if clicking same filter
  state.activeFilter = (state.activeFilter === filter) ? 'all' : filter;
  saveState();
  renderDashboard();  // re-render to apply filter + visual highlight
}
```

**Filter the ticket list** (in the rendering loop ~line 1160): wrap `tickets.forEach(t => {...})` with a filtered array:
```javascript
const filteredTickets = tickets.filter(t => {
  // Card filter
  if (state.activeFilter === 'mismatch' && !(t.has_mismatch || t.scenario === 'AMOUNT_MISMATCH')) return false;
  if (state.activeFilter === 'finance' && !(t.status === 'PENDING_FINANCE' || t.status === 'AWAITING_EMPLOYEE_LIST')) return false;
  // Search filter (from 2.3)
  if (state.searchQuery && !t.id.toLowerCase().includes(state.searchQuery.toLowerCase())) return false;
  return true;
});
filteredTickets.forEach(t => { ... });
```

**CSS for active card** (add to `<style>`):
```css
.stat-card.active-filter { box-shadow: 0 0 0 3px var(--blue); transform: translateY(-2px); }
```

### 2.3 Ticket ID search bar (KAN-31 #7)

**Location:** line 1155 — `<div class="card-header"><div class="card-title">All Tickets</div></div>`

**Change to:**
```javascript
<div class="card-header" style="display:flex;justify-content:space-between;align-items:center;gap:12px">
  <div class="card-title">All Tickets</div>
  <input type="text" id="ticket-search" placeholder="🔍 Search ticket ID..."
         value="${state.searchQuery || ''}"
         oninput="handleSearchInput(this.value)"
         style="padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;width:220px" />
</div>
```

**New global function:**
```javascript
function handleSearchInput(value) {
  state.searchQuery = value;
  saveState();
  renderDashboard();
  // Restore focus to search input after re-render
  setTimeout(() => {
    const el = document.getElementById('ticket-search');
    if (el) { el.focus(); el.setSelectionRange(value.length, value.length); }
  }, 0);
}
```

**Search scope:** ticket ID only (matches Vinh's spec literally). Uses `t.id` which is the ticket_number like `TKT-020`.

### 2.4 Hide tabs except Dashboard (KAN-31 #2)

**Approach:** CSS-hide via body class + `Ctrl+Shift+D` dev toggle (preserves internal testing)

**Update `<body>` tag:** add default class
```html
<body class="emoney-view">
```

**Add CSS** in `<style>` block:
```css
/* eMoney simplified view — hides tabs except Dashboard */
body.emoney-view #nav-emails,
body.emoney-view #nav-finance,
body.emoney-view #nav-emoney,
body.emoney-view .role-badge,
body.emoney-view #role-select { display: none !important; }

/* Mobile menu tabs — hide via nth-child since they don't have IDs */
body.emoney-view .mobile-menu .nav-btn:not(:first-child) { display: none !important; }
```

Note on mobile-menu: lines 405–410 don't have IDs on the buttons, so using `:not(:first-child)` to keep only the Dashboard button visible.

**Dev toggle** (global function, add near other `window` listeners):
```javascript
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key.toUpperCase() === 'D') {
    e.preventDefault();
    document.body.classList.toggle('emoney-view');
    showToast(document.body.classList.contains('emoney-view') ? 'eMoney view (clean)' : 'Dev view (all tabs)', 'info');
  }
});
```

Confirm `showToast` already exists in the codebase (it does — used at line 1472, 1508, etc).

### Verification (manual browser test — 12 checks)
1. Dashboard has exactly 3 cards: "All Emails", "Mismatch", "Ready for Finance" ✅
2. Click "Mismatch" card → table filters to only mismatch tickets + card highlighted ✅
3. Click "Mismatch" again → all tickets show again + highlight removed ✅
4. Click "Ready for Finance" → shows only PENDING_FINANCE/AWAITING_EMPLOYEE_LIST tickets ✅
5. Type "TKT-020" in search → only that ticket shows ✅
6. Clear search → all tickets return ✅
7. Combine: click "Mismatch" + type "TKT-0" → mismatch tickets with "TKT-0" prefix shown ✅
8. Top nav: only "Dashboard" button visible. Other tabs hidden. ✅
9. Role badge + switcher: hidden ✅
10. Press `Ctrl+Shift+D` → toast "Dev view (all tabs)" + all tabs/role reappear ✅
11. Press `Ctrl+Shift+D` again → toast "eMoney view (clean)" + tabs hidden ✅
12. Refresh page → search query + active filter persisted via localStorage ✅

### Rollback if Block 2 breaks
```bash
git checkout index.html       # revert Block 2 changes
# Block 1 commit stays safe (already pushed)
```

Granular:
```bash
git diff HEAD index.html      # inspect changes
# Edit back specific problem regions
```

### Commit
```bash
git add index.html
git commit -m "KAN-31: 3-card clickable filter + ticket search + CSS-hidden tabs with Ctrl+Shift+D dev toggle (items #2,5,6,7)"
git push origin main
git push yoma main
```

### Checkpoint
Write: `memory/checkpoint_02_block2.md`
- SHA of commit just pushed
- 4 items completed
- Verification results (12 manual tests — record pass/fail per line)
- Vercel URLs to verify post-deploy: `project-ii0tm.vercel.app` + `wave-emi-dashboard.vercel.app`
- Known-good state of state object fields: `activeFilter`, `searchQuery`
- "Safe to proceed to Block 3"

---

## 🟡 Block 3 — Pipeline v10 for KAN-30 (1.5 hrs, LOW risk)

**Vinh items covered:** KAN-30 #1, #2, #3, #4
**Files touched:** New file `pipelines/n8n-workflow-v10.json`
**Risk:** Low — v9 stays active in n8n until v10 tested + explicitly activated
**Rollback:** Reactivate v9 in n8n UI (instant, zero data loss)

### 3.1 Clone v9 → v10
```bash
cd "g:/My Drive/Tech Jobs/Trustify/03_build/wave-emi-dashboard"
cp pipelines/n8n-workflow-v9.json pipelines/n8n-workflow-v10.json
```

Update workflow title (line 2): `"name": "EMI Email Intake Pipeline v10 (KAN-30 Email UX Enhancement)"`

### 3.2 Target nodes in v10 JSON
- **Line 62:** "Prepare for AI v3" — will add `has_attachments` sync fix (3.3)
- **Line 121:** "AI Parse & Validate v3" — will add `payment_type` + expanded verification fields (3.4, 3.5)
- **Line 184:** "Send Outlook Notification" — will rewrite `bodyContent` template (3.5, 3.6)

### 3.3 Fix attachment count bug (KAN-30 #2) — Option B (thorough)

**Root cause:** `has_attachments = d.hasAttachments || false` trusts Outlook's flag. Outlook sets it `true` even when n8n doesn't download binaries. Template condition `$json.has_attachments` is true but `attachment_count = 0`.

**Fix in Prepare for AI v3 node** — after the binary loop, sync flag with real count.

Locate in the `jsCode` of "Prepare for AI v3" (line 62 of v9 JSON) this section:
```javascript
if (item.binary) {
  // ... loop that pushes to attachment_names ...
}
```

**Add immediately after the `if (item.binary)` block:**
```javascript
// v10/KAN-30 #2: sync has_attachments with real count (Outlook flag can lie)
has_attachments = attachment_names.length > 0;
```

**No change needed to notification template condition** — it now works correctly because the flag reflects reality. Bonus: also render filenames for Ops.

### 3.4 Payment type classification (KAN-30 #1)

**Add in AI Parse & Validate v3 node** (line 121) — compute new field on each ticket.

In the `results.push({ json: {...} })` block, add this field (use existing `ticket.extracted_employee_count` which is already populated):

```javascript
// v10/KAN-30 #1: payment type classification per Vinh's rule
payment_type: ticket.extracted_employee_count > 0 ? 'salarytoMA' : 'salarytoOTC',
```

**Rule verified against Vinh's spec:**
- "If pipeline detect email have employee list = salarytoMA" → `extracted_employee_count > 0`
- "If pipeline detect no employee list = salarytoOTC" → else branch

### 3.5 Expanded Verification Status checklist (KAN-30 #3)

**Add 7 verification fields in AI Parse & Validate v3** (same `results.push` block as 3.4):

```javascript
// v10/KAN-30 #3: expanded 7-item verification checklist
verification: {
  company_name: !!(parsed.company && parsed.company !== 'Unknown Company'),
  payment_type: true,  // always computed above
  amount: (parsed.amount || 0) > 0,
  date_time: !!email_date,
  approval: matrixComplete,
  attachment: (attachment_count || 0) > 0,
  employee_list: (ticket.extracted_employee_count || 0) > 0
},
```

**Rewrite notification template** (Send Outlook Notification, line 184) — replace existing Verification Status section:

```
🔍  Verification Status

{{ $json.verification.company_name ? '✅' : '⚠️' }} Company name: {{ $json.company }}
{{ $json.verification.payment_type ? '✅' : '⚠️' }} Payment type: {{ $json.payment_type }}
{{ $json.verification.amount ? '✅' : '⚠️' }} Amount: {{ $json.amount ? Number($json.amount).toLocaleString() : '0' }} MMK
{{ $json.verification.date_time ? '✅' : '⚠️' }} Date time: {{ $json.email_date || 'Not provided' }}
{{ $json.verification.approval ? '✅' : '⚠️' }} Approval: {{ $json.matrix_complete ? 'Sales HOD + Finance Manager found' : 'Missing required approvals' }}
{{ $json.verification.attachment ? '✅' : '⚠️' }} Attachment: {{ $json.attachment_count > 0 ? $json.attachment_count + ' file(s): ' + ($json.attachment_names || []).join(', ') : 'None detected' }}
{{ $json.verification.employee_list ? '✅' : '⚠️' }} Employee list: {{ $json.extracted_employee_count > 0 ? $json.extracted_employee_count + ' employees extracted' : 'None detected (defaults to salarytoOTC)' }}
```

This also implicitly fixes #2 (attachment count — now uses `$json.attachment_count > 0` directly) AND displays filenames as bonus.

Remove the old lines:
```
{{ $json.matrix_complete ? '✅ Approval check: Complete...' : '⚠️ Approval check: Incomplete...' }}
{{ $json.scenario === 'AMOUNT_MISMATCH' ? '❌ Amount check: Mismatch...' : '✅ Amount check: Passed' }}
```

### 3.6 Ticket ID in email (KAN-30 #4)

**In Send Outlook Notification template** (line 184), current top reads:
```
✉️ Disbursement Request Received
━━━━━━━━━━━━━━━━━━━━━
Your disbursement request has been received and processed.
```

**Change to:**
```
✉️ Disbursement Request Received

🎫 Ticket ID: {{ $json.ticket_id || 'Pending assignment' }}

━━━━━━━━━━━━━━━━━━━━━
Your disbursement request has been received and processed.
```

Note: `$json.ticket_id` is already populated by the webhook response merge in Parse & Validate (see v9 line 121 — `webhookResp.ticket_id`).

Also update the Summary section — change `Type:` line to use our new `payment_type`:
```
📄  Type:        {{ $json.payment_type === 'salarytoOTC' ? 'SalaryToOTC (no employee list)' : 'SalaryToMA (with employee list)' }}
```

And the `Attachments:` line:
```
👥  Attachments: {{ $json.attachment_count > 0 ? $json.attachment_count + ' file(s)' : 'None' }}
```

### 3.7 Import + test v10 (NOT activate yet)
1. n8n Cloud → Workflows → Import from file → `pipelines/n8n-workflow-v10.json`
2. Replace API key placeholders (Groq + Gemini + Webhook Secret + Outlook OAuth) — same values as v9
3. **DO NOT activate yet** — keep v9 as primary
4. Run manual execution with test payload via INTAKE webhook:
   ```bash
   curl -X POST https://tts-test.app.n8n.cloud/webhook/emi-intake \
     -H "Content-Type: application/json" \
     -d '{"body":{"subject":"Test KAN-30","from":"test@example.com","content":"Disbursement request for Test Company 1,000,000 MMK, approved by Sales HOD (Name1) and Finance Manager (Name2)"}}'
   ```
5. Verify notification email arrives with:
   - Ticket ID at top ✅
   - Payment type: salarytoOTC (no employee list in test) ✅
   - 7-row verification checklist ✅
   - Attachment: "None" (no attachments in test) ✅
6. Check new dashboard entry in Supabase — `payment_type` column populated (NOTE: if column doesn't exist yet in tickets_v2, webhook might fail; see §3.7a below)

### 3.7a Webhook compatibility check
**Important:** The webhook (`api/webhook.js`) currently persists known fields to Supabase. Our new `payment_type` and `verification` fields may be:
- **Silently dropped** (if webhook ignores unknown fields) — OK, no impact
- **Cause insert error** (if Supabase Row-Level Security rejects unknown columns) — NEEDS schema migration

**Pre-test:** Before importing v10, grep `api/webhook.js` for how it handles fields — does it cherry-pick known columns or spread-insert?

If spread-insert: add schema migration to add `payment_type TEXT` column first (safe addition). If cherry-pick: no schema change needed (extra fields ignored).

This is a **pre-Block-3 micro-task** (5 min of code reading) — see Verification section below.

### 3.8 Switch active workflow (only after 3.7 passes)
1. In n8n UI: Activate v10
2. Deactivate v9 (keep as fallback — **do NOT delete**)
3. Send one real email to `emoney@zeyalabs.ai` → verify v10 notification received
4. Check dashboard — new ticket appears with `payment_type` (if schema updated)

### 3.9 Cleanup test tickets (learned from TKT-021)
After test emails, identify test tickets by subject/sender and mark or delete:
```sql
-- In Supabase SQL editor, find test tickets from tonight:
SELECT ticket_number, company, created_at FROM tickets_v2
WHERE created_at > '2026-04-13 17:00:00' AND (from_email LIKE '%test%' OR original_subject LIKE '%Test KAN-30%');

-- Review then DELETE if confirmed test junk:
-- DELETE FROM tickets_v2 WHERE ticket_number IN ('TKT-0XX', ...);
```

### Rollback if Block 3 breaks
1. **Notification looks bad or pipeline errors:** In n8n UI → deactivate v10, reactivate v9. Instant rollback.
2. **Supabase rejects inserts from v10:** Same — reactivate v9. Investigate schema mismatch offline.
3. **JSON file corrupted:**
   ```bash
   git checkout pipelines/n8n-workflow-v10.json  # but file is new, just delete if needed
   rm pipelines/n8n-workflow-v10.json
   ```

**Critical:** v9 stays available in n8n Cloud the entire time. Customer-facing impact from any Block 3 issue = **zero** as long as v9 remains activatable.

### Commit
```bash
git add pipelines/n8n-workflow-v10.json
git commit -m "KAN-30: pipeline v10 — payment type + 7-item verification + ticket ID + attachment count fix (items #1,2,3,4)"
git push origin main
git push yoma main
```

### Checkpoint
Write: `memory/checkpoint_03_block3.md`
- SHA of commit
- 4 KAN-30 items completed
- v10 test result (manual webhook + real email)
- v10 active / v9 deactivated (fallback available) confirmed
- Test ticket cleanup status
- "Safe to proceed to Block 4"

---

## 🟢 Block 4 — Delivery + Jira Updates (15 min)

**Goal:** Close the loop cleanly with Vinh.

### 4.1 Update progress table in analysis doc
Edit `KAN-30_KAN-31_Analysis.md` §8 — mark all 12 items ✅ with commit SHAs + date.

### 4.2 Update Jira tickets
- KAN-30 → comment with commit SHA + test email screenshot + move to Done
- KAN-31 → comment with commit SHA + before/after dashboard screenshots + move to Done

### 4.3 Message to Vinh
Brief Teams/Slack message:
> "Hi Vinh, KAN-30 and KAN-31 are done and deployed. Pipeline v10 is live (v9 kept as fallback). Dashboard shipped with all 8 UX items. Screenshots + commit SHAs in Jira comments. Let me know if anything needs adjustment."

### 4.4 Final checkpoint
Write: `memory/checkpoint_04_done.md`
- All 12 items shipped
- Final commit SHAs
- Jira tickets closed
- Vinh notified
- System status green

### 4.5 Update MEMORY.md
- Move KAN-30/31 from "ACTIVE" to "DONE" status
- Update RESUME HERE section

---

## 🔴 Global Rollback Plan (if everything goes sideways)

If mid-block a catastrophic issue happens and we can't untangle:

```bash
# 1. Revert working tree to pre-session state
git reset --hard <ROLLBACK_POINT_SHA>  # from Block 0 checkpoint

# 2. Force push (ONLY if already pushed bad commits)
# WARNING: Only if absolutely necessary and no one else pulled
git push origin main --force-with-lease
git push yoma main --force-with-lease

# 3. n8n: reactivate v9, deactivate v10
# (via n8n Cloud UI)

# 4. Verify dashboard still works on Vercel
# 5. Verify v9 still processes emails
```

**Trigger conditions for global rollback:**
- Dashboard completely broken (JS errors prevent render)
- v10 pipeline corrupting data
- Supabase writes failing after deploy
- Any security regression

**Not-quite-global rollback (preferred when possible):**
- Single-block rollback via `git revert <block-commit-sha>` (creates new revert commit, preserves history)

---

## 📋 Checkpoint Memory File Template

Every checkpoint file follows this structure (so recovery is mechanical):

```markdown
---
name: Checkpoint N — Block Name
description: Implementation checkpoint after Block N completion
type: project
---

## Status: ✅ Block N Complete

**Date/Time:** 2026-04-13 HH:MM
**Commit SHA:** abc1234
**Branch:** main
**Git state:** clean, pushed to origin + yoma

## What was done in this block
- Item 1
- Item 2

## Verification result
- Test 1: pass
- Test 2: pass

## Next step
Proceed to Block N+1 ("<name>") — see `KAN-30_KAN-31_Implementation_Plan.md`

## Rollback command if Block N+1 needs to undo this
```

## 🧭 Navigation

- Analysis: `KAN-30_KAN-31_Analysis.md` — requirements, priority, judgment
- **This file: `KAN-30_KAN-31_Implementation_Plan.md`** — step-by-step execution
- Checkpoints: `~/.claude/projects/.../memory/checkpoint_0{N}_*.md`
- Source PDFs: `KAN-30_eMoney_Email_Notification_Enhancement.pdf`, `KAN-31_eMoney_Dashboard_UX_Enhancement.pdf`

---

## ⏱️ Timeline (realistic)

| Block | Start | End | Duration |
|-------|-------|-----|----------|
| 0 | T+0:00 | T+0:05 | 5 min |
| 1 | T+0:05 | T+0:35 | 30 min |
| 2 | T+0:35 | T+2:05 | 1h 30m |
| 3 | T+2:05 | T+3:35 | 1h 30m |
| 4 | T+3:35 | T+3:50 | 15 min |
| **Total** | | | **~3h 50m** |

Buffer: 30–60 min for unexpected issues (browser testing, n8n import quirks, etc.) → **4–4.5 hrs total**.
