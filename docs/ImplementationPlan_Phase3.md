# Phase 3: AI Document Extraction — Implementation Plan

**Version:** v5 (April 7, 2026) — pipeline-integrated, research-validated, safety-reviewed, pre-flight fixes applied
**Status:** PLAN — ready for execution (awaiting DK signal)
**Demo:** Tuesday April 7, 2026 (Rita in-person)
**Time budget:** ~5 hours
**Risk tolerance:** Low — clone-before-modify, fallback at every step
**Safety principle:** v3 pipeline UNTOUCHED. v4 is a new clone. Pre-test before demo.

---

## 0. What Rita Actually Wants (from transcript)

> "When that email comes in and you are doing this pre-check, this pre-check needs to include the detailed cleaning up of the Excel. Like it needs to **generate an Excel that is clean.**"
>
> "That's right. Because you have to **generate the Excel spreadsheet that's going to go into the system eventually anyway. You should just do it now**, right?"
>
> "It should be generating that Excel. It should be doing the pre-check... for right now, you can just kind of like pretend that pre-check is done."

**Translation:** The system should extract the employee list from the email attachment AUTOMATICALLY — not require a separate manual upload. The pre-check (validate phones, strip titles, verify totals) happens upfront when the email arrives. Rita said "pretend" is OK for now, but the team expects to see it working tomorrow.

---

## 1. Architecture: Pipeline-Integrated Extraction

### Current v3 Pipeline (9 nodes)

```
Gmail → Prepare → Groq Text → Vision Summary → Parse & Validate → Route → Respond/Notify
                                     ↑
                              (extracts bank slip SUMMARY only)
```

### New v4 Pipeline (11 nodes — 2 new)

```
Gmail → Prepare → Groq Text → Vision Summary → [NEW] Employee Extract → Parse & Validate v4 → Route → Respond/Notify
                                                       ↑
                                         (2nd Vision call — different prompt)
                                         (extracts employee TABLE from same attachment)
                                         (output: employees[] array)
```

**Why separate nodes (not one combined call):**
- **Failure isolation:** If employee extraction fails → summary still works → ticket still created
- **Prompt focus:** Two simple prompts > one mega-prompt. Higher accuracy.
- **Cross-validation:** Can compare sum(employee amounts) vs summary total_amount
- **Debugging:** Each node shows its own output in n8n execution log

**Rate limit impact:** 2 vision calls per email instead of 1. Groq free tier = 20 vision/day → 10 emails max. Fine for demo. Enterprise API removes this limit.

### Three Tracks

| Track | What | Where | Effort |
|-------|------|-------|--------|
| **A: Bank Slip Enhancement** | Add 3 Finance fields to vision summary | Pipeline v4 | 45 min |
| **B: Employee List Extraction** | New pipeline node + dashboard auto-populate | Pipeline v4 + index.html | 2.5 hrs |
| **C: Manual Upload Fallback** | Keep existing CSV/XLSX upload + add image upload option | index.html + API | 1 hr |

Track C ensures the system works even when the pipeline extraction fails or when documents arrive outside of email (USB, WhatsApp, etc.).

---

## 2. Track A — Bank Slip Enhancement (Pipeline v4)

### A0: Clone v3 → v4 (2 min)

```bash
cp pipelines/n8n-workflow-v3.json pipelines/n8n-workflow-v4.json
```

Rename workflow inside JSON: `"name": "EMI Email Intake Pipeline v4 (Finance Fields + Employee Extract)"`

**v3 is NEVER edited. It stays as production fallback.**

### A1: Update Vision Summary Prompt (10 min)

**File:** `pipelines/n8n-workflow-v4.json` → Vision Process node

Add `depositor_name`, `remark`, `transaction_id` to the extraction prompt. Keep all existing fields.

### A2: Carry 3 New Fields Through Pipeline (10 min)

**File:** `pipelines/n8n-workflow-v4.json` → AI Parse & Validate v4

Add to `ticket` object:
```javascript
ticket.depositor_name = visionResult.depositor_name || '';
ticket.remark = visionResult.remark || '';
ticket.transaction_id = visionResult.transaction_id || visionResult.reference_number || '';
```

Add same 3 fields to `results` output.

### A3: Store + Display New Fields in Dashboard (15 min)

**File:** `index.html`

- `createTicketFromN8n()`: add `depositor_name`, `remark`, `transaction_id`
- `renderAIPipelineSection()`: show 3 new fields in Vision AI card
- `openTicketDetail()`: show in Email Source section

**Track A total: ~40 min**

---

## 3. Track B — Employee List Extraction in Pipeline

This is the core new feature. A second Vision AI call in the n8n pipeline extracts the employee table from the same attachment.

### B1: Create "Employee List Extract" Node in v4 (45 min)

**File:** `pipelines/n8n-workflow-v4.json` — NEW Code node

**Node config:**
```json
{
  "id": "employee-extract",
  "name": "Employee List Extract",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [1000, 400]
}
```

**Mode:** Run Once for Each Item

**Code logic:**
1. Get attachment base64 from `$('Prepare for AI v3').first().json`
2. Check if `vision_eligible` — if no attachment, pass through with empty employees
3. Check rate limit (increment `staticData.visionCalls` — shares with Vision Summary)
4. Call Groq Vision API with employee-specific prompt
5. Parse response → output `_employee_list` array
6. Pass through ALL existing fields from previous node (Vision Process output)

**Prompt** (Minh's template-driven — extract only what the bank needs):
```
Extract the employee/payroll list from this document.
Return JSON only:
{
  "employees": [{"name": "Full Name as written", "account_or_phone": "phone number or account number exactly as shown", "amount": 0}],
  "total_amount": 0,
  "employee_count": 0,
  "confidence": 0.0
}
Rules:
- Extract EVERY employee row from the table
- account_or_phone: copy the exact digits (phone, MSISDN, bank account, any identifier)
- amount: numeric only, no commas or currency symbols
- If no employee table found, return empty employees array with confidence 0
```

**Key implementation detail:** The node must pass through ALL fields from the previous node's output (`$input.item.json`) and ADD `_employee_result` to it. This preserves the text extraction + vision summary data.

```javascript
// Employee List Extract — n8n Code Node
const item = $input.item;
const d = item.json;

// Get attachment from Prepare node
const prepData = $('Prepare for AI v3').first().json;
const attachment = prepData.attachment_base64;

if (!attachment || !prepData.vision_eligible) {
  // No attachment → pass through with empty employees
  return [{ json: { ...d, _employee_result: null, _employee_status: 'no_attachment' } }];
}

// Rate limit check (shares counter with Vision Process)
const staticData = $getWorkflowStaticData('global');
if ((staticData.visionCalls || 0) >= 20) {
  return [{ json: { ...d, _employee_result: null, _employee_status: 'rate_limited' } }];
}
staticData.visionCalls = (staticData.visionCalls || 0) + 1;

const prompt = `Extract the employee/payroll list from this document. Return JSON only: {"employees":[{"name":"","account_or_phone":"","amount":0}],"total_amount":0,"employee_count":0,"confidence":0.0}. Rules: Extract EVERY row. account_or_phone: exact digits. amount: numeric only. If no table found, return empty array with confidence 0.`;

try {
  // Use helpers.httpRequest — same proven pattern as Vision Process node
  const resp = await helpers.httpRequest({
    method: 'POST',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    headers: {
      'Authorization': 'Bearer REPLACE_WITH_GROQ_API_KEY',
      'Content-Type': 'application/json'
    },
    body: {
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: 'data:' + attachment.mimeType + ';base64,' + attachment.base64 } }
        ]
      }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 4000
    },
    json: true  // auto-serializes body, auto-parses response
  });

  // Parse vision response (same pattern as Vision Process)
  let parsed = { employees: [], confidence: 0 };
  if (resp.choices && resp.choices[0]) {
    const content = resp.choices[0].message.content || '';
    try { parsed = JSON.parse(content); } catch(e) { /* keep empty default */ }
  }

  return [{ json: { ...d, _employee_result: parsed, _employee_status: 'success' } }];

} catch(e) {
  return [{ json: { ...d, _employee_result: null, _employee_status: 'api_error' } }];
}
```

**Note:** This uses `helpers.httpRequest()` — the same proven pattern as the Vision Process node. NOT `fetch()` (uncertain in n8n sandbox) or `this.helpers.httpRequest` (fails in Task Runner). The Groq API key is hardcoded (same pattern as existing Vision Process node — replaced during n8n import).

### B2: Wire New Node into Pipeline (10 min)

**File:** `pipelines/n8n-workflow-v4.json` → connections section

Change the connection chain:
```
BEFORE: Vision Process → AI Parse & Validate v3
AFTER:  Vision Process → Employee List Extract → AI Parse & Validate v4
```

Update the `connections` object:
```json
"Vision Process": {
  "main": [
    [{ "node": "Employee List Extract", "type": "main", "index": 0 }]
  ]
},
"Employee List Extract": {
  "main": [
    [{ "node": "AI Parse & Validate v3", "type": "main", "index": 0 }]
  ]
}
```

### B3: Include Employee Data in Ticket Payload (15 min)

**File:** `pipelines/n8n-workflow-v4.json` → AI Parse & Validate v4 code

After the existing vision merge section, add:
```javascript
// === v4: Employee list merge ===
const employeeResult = d._employee_result || null;
const employeeStatus = d._employee_status || 'none';

if (employeeResult && employeeResult.employees && employeeResult.employees.length > 0) {
  ticket.extracted_employees = employeeResult.employees;
  ticket.extracted_employee_count = employeeResult.employee_count || employeeResult.employees.length;
  ticket.employee_extraction_confidence = employeeResult.confidence || 0;
  ticket.employee_extraction_status = 'success';

  // Cross-validation: sum of employee amounts vs email amount
  const empTotal = employeeResult.employees.reduce((s, e) => s + (e.amount || 0), 0);
  ticket.employee_total_extracted = empTotal;
  if (ticket.amount_requested > 0 && empTotal > 0) {
    const diff = Math.abs(empTotal - ticket.amount_requested);
    ticket.employee_amount_mismatch = diff > (ticket.amount_requested * 0.01);
  }
} else {
  ticket.extracted_employees = [];
  ticket.extracted_employee_count = 0;
  ticket.employee_extraction_confidence = 0;
  ticket.employee_extraction_status = employeeStatus;
}
```

Add to `results` output:
```javascript
extracted_employees: ticket.extracted_employees,
extracted_employee_count: ticket.extracted_employee_count,
employee_extraction_confidence: ticket.employee_extraction_confidence,
employee_extraction_status: ticket.employee_extraction_status,
employee_total_extracted: ticket.employee_total_extracted || 0,
employee_amount_mismatch: ticket.employee_amount_mismatch || false,
```

### B4: Dashboard — Store Extracted Employees (10 min)

**File:** `index.html` → `createTicketFromN8n()`

Add after vision fields:
```javascript
// v4: Pre-extracted employee list from pipeline
extracted_employees: data.extracted_employees || [],
extracted_employee_count: data.extracted_employee_count || 0,
employee_extraction_confidence: data.employee_extraction_confidence || 0,
employee_extraction_status: data.employee_extraction_status || 'none',
employee_total_extracted: data.employee_total_extracted || 0,
employee_amount_mismatch: data.employee_amount_mismatch || false,
```

### B5: Dashboard — Auto-Populate Employee Table (45 min)

**File:** `index.html` → `renderEmails()` section for n8n tickets

When an n8n ticket has `extracted_employees.length > 0`, auto-process and display the employee table INSTEAD of showing the upload zone.

In the Incoming Emails page, after the n8n ticket card, modify the employee upload section:

```javascript
// After ticket is parsed and has extracted employees...
if(existingTicket && !existingTicket.prechecks_done){
  if(existingTicket.extracted_employees && existingTicket.extracted_employees.length > 0
     && !pendingEmployeeData[eid]){
    // AUTO-PROCESS extracted employees through existing validation
    const headers = ['Name', 'MSISDN', 'Amount'];
    const rows = existingTicket.extracted_employees.map(e => ({
      'Name': e.name || '',
      'MSISDN': e.account_or_phone || e.msisdn || e.phone || '',
      'Amount': e.amount || 0
    }));
    pendingEmployeeData[eid] = processEmployeeList(rows, headers);
  }

  if(pendingEmployeeData[eid]){
    // Show pre-populated employee table with AI badge
    const processed = pendingEmployeeData[eid];
    const invalidCount = processed.filter(r => !r.MSISDN_Valid).length;
    const cleanedCount = processed.filter(r => r.Name_Changed).length;
    const conf = existingTicket.employee_extraction_confidence
      ? (existingTicket.employee_extraction_confidence * 100).toFixed(0) : null;

    html += `<div style="margin-top:16px">`;

    // AI extraction badge (if from pipeline)
    if(conf){
      html += `<div style="margin-bottom:8px">
        <span class="badge badge-purple">AI Pre-Extracted from Email</span>
        <span style="color:var(--muted);font-size:12px;margin-left:6px">
          Confidence: ${conf}% · ${processed.length} employees · Review before submitting
        </span></div>`;
    }

    // Summary + table + reconciliation (same as CSV upload)
    html += `<strong>📊 ${processed.length} records · ${invalidCount} invalid phone/account · ${cleanedCount} names cleaned</strong>`;
    html += '<div style="max-height:300px;overflow-y:auto;margin-top:8px"><table class="csv-table">...'; // same preview code
    // ... (reuse exact same preview table rendering as handleEmployeeUpload lines 1250-1266)

    html += `</div>`;

    // Still show upload zone below for override
    html += `<div style="margin-top:12px;font-size:12px;color:var(--muted)">
      Or upload a different file to override:</div>`;
  }

  // Upload zone (always shown — manual override path)
  html += `<div style="margin-top:8px"><strong>Step 2 — Upload Employee List</strong>
    <div class="upload-zone" ...>
      <input type="file" accept=".csv,.xlsx,.png,.jpg,.jpeg" .../>
    </div></div>`;
}
```

**Key behavior:**
- If pipeline extracted employees → table auto-populated, submit button enabled
- User can OVERRIDE by uploading a different file (CSV, XLSX, or image)
- If pipeline didn't extract → normal upload zone shown (no change from current behavior)

### B6: Cross-Validation Display (10 min)

**File:** `index.html`

If `employee_amount_mismatch` is true, show a warning in the ticket detail modal and the employee preview:

```
⚠️ Employee total (4,460,000 MMK) differs from email amount (4,800,000 MMK)
   Difference: 340,000 MMK (7.1%)
```

This reuses the existing `cross-validation-box` CSS class from the bank slip mismatch display.

---

## 4. Track C — Manual Upload Fallback + Image Upload

This keeps the existing CSV/XLSX upload working AND adds image upload as an alternative input. This is the safety net for when pipeline extraction fails or for documents received outside of email.

### C1: Create Vercel API Proxy (25 min)

**File:** `api/extract-employees.js` (NEW) — same as previous plan v3, with size check + JSON parse safety.

### C2: Expand Upload Zone + Image Routing (15 min)

**File:** `index.html`

- Change accept to include images: `.csv,.xlsx,.png,.jpg,.jpeg`
- Add `handlePayrollImageExtraction()` function (calls Vercel API)
- Add `fileToBase64()` helper
- Add 3 MB file size check

### C3: Copy Demo Images (5 min)

```bash
cp research/real_samples/grok_generated/grok_informal_payment_request_12emp.jpg samples/payroll_demo_12emp.jpg
cp research/real_samples/grok_generated/grok_wave_money_salary_21emp.jpg samples/payroll_demo_wave_21emp.jpg
```

**Track C total: ~45 min**

---

## 5. Build Sequence

```
Track A (pipeline v4 — bank slip)          Track B (pipeline v4 — employee extract)
──────────────────────────────             ──────────────────────────────────
A0: Clone v3 → v4 (2 min)                 B1: Create Employee Extract node (45 min)
A1: Update vision prompt (10 min)          B2: Wire into pipeline connections (10 min)
A2: Carry 3 fields in Parse (10 min)       B3: Include employees in ticket payload (15 min)
                                           B4: Dashboard store extracted employees (10 min)

Track C (dashboard — manual fallback)      Track A+B continued (dashboard display)
──────────────────────────────             ──────────────────────────────────
C1: Create Vercel API endpoint (25 min)    A3: Display 3 bank slip fields (15 min)
C2: Image routing + extraction fn (15 min) B5: Auto-populate employee table (45 min)
C3: Copy demo images (5 min)               B6: Cross-validation display (10 min)

─── MERGE ───────────────────────────────────────────────────────
Git commit + push (5 min)
Set Vercel env GROQ_API_KEY (5 min)
Pre-test: Groq Vision via curl on demo image (10 min)
Import v4 to n8n Cloud — v3 stays as fallback (15 min)
End-to-end testing (30 min)
```

**Total: ~5 hours** (including testing + buffer)

---

## 6. Pipeline Node Map (v4 — 11 nodes)

```
[Webhook Trigger]──→┐
                     ├→[Prepare for AI v3]→[Groq AI Extract]→[Vision Process]→[Employee List Extract]→[AI Parse & Validate v4]→[Route]→[Respond]
[Gmail Trigger]────→┘                                              ↑                    ↑                       ↑                          └→[Notify]
                                                              Extracts bank        Extracts employee       Merges text + vision
                                                              slip SUMMARY         TABLE (2nd vision call)  + employees into ticket
```

| Node | Position | Type | New? |
|------|----------|------|:----:|
| Webhook Trigger | [250, 300] | Webhook | No |
| Gmail Trigger | [250, 520] | Gmail | No |
| Prepare for AI v3 | [520, 400] | Code | No |
| Groq AI Extract | [780, 400] | HTTP Request | No |
| Vision Process | [920, 400] | Code | No |
| **Employee List Extract** | **[1000, 400]** | **Code** | **YES** |
| AI Parse & Validate v4 | [1100, 400] | Code | Modified |
| Route by Source | [1360, 400] | IF | No |
| Respond with Dashboard URL | [1620, 300] | Respond | No |
| Send Gmail Notification | [1620, 520] | Gmail | No |

---

## 7. Files Modified

| File | Track | Action | Risk |
|------|-------|--------|------|
| `pipelines/n8n-workflow-v3.json` | — | **UNTOUCHED** — production fallback | N/A |
| `pipelines/n8n-workflow-v4.json` | A+B | **CREATE** (clone of v3) + add Employee Extract node + modify Parse & Validate + update vision prompt + update connections | Low — new file |
| `index.html` | A+B+C | Store 3 bank slip fields + 6 employee fields in `createTicketFromN8n()`. Display bank slip fields in Vision card. Auto-populate employee table from pipeline data. Add `handlePayrollImageExtraction()` + `fileToBase64()`. Image routing. File size check. | Low — all additive |
| `api/extract-employees.js` | C | **CREATE** — Vercel serverless (fallback for manual upload) | Zero — new file |
| `samples/payroll_demo_12emp.jpg` | C | **COPY** from grok_generated | Zero |
| `samples/payroll_demo_wave_21emp.jpg` | C | **COPY** from grok_generated | Zero |

---

## 7b. Browser Compatibility & URL Size

### Edge Chromium — CONFIRMED COMPATIBLE

| Browser | URL Limit | 12 employees (3,114 chars) | 20 employees (3,934 chars) | 50 employees (~7,500 chars) |
|---------|:-:|:-:|:-:|:-:|
| **Edge Chromium (current)** | 8,192 | OK | OK | OK |
| Chrome | 8,192 | OK | OK | OK |
| Firefox | 65,536 | OK | OK | OK |
| Safari | 80,000 | OK | OK | OK |
| Old IE/Edge Legacy | 2,083 | FAIL | FAIL | FAIL |

**DK demos on Edge Chromium or Chrome — both handle our URL sizes comfortably.** Old Edge Legacy (EdgeHTML) died in 2021 — not a concern.

**URL size awareness:** With 12 employees the URL is 3,114 chars (38% of Chrome/Edge limit). Even 50 employees (~7,500 chars) fits. The URL size problem only matters for 100+ employee batches — which is a Phase 4b concern (Vercel API storage replaces URL-based transfer).

### API Rate Limit Strategy

Current plan uses **Groq for all 3 AI calls** (text + vision summary + employee extraction). With 20 vision calls/day free tier → 10 emails max. Fine for demo.

**For production (Phase 3.2):** Split across providers for higher throughput:

| Task | Demo (now) | Production (Phase 3.2) |
|------|-----------|----------------------|
| Text extraction | Groq llama-3.3-70b | Gemini Flash (free, fast) |
| Vision summary | Groq llama-4-scout | Groq or Gemini Flash |
| Employee extraction | Groq llama-4-scout | Enterprise OpenAI GPT-4o (best table OCR) |

DK has API keys for: Gemini Pro, Claude Max, GPT, Groq. The pipeline architecture supports any provider per node — just change URL + model name. **No architectural change needed — just API key swap per node.**

---

## 8. Demo Script (Tuesday — Rita in-person)

### Part 1: Sequence Diagram (2 min)
Walk Rita through the numbered steps in mermaid.live.

### Part 2: Live Email — The Full Flow (5 min) **THE WOW**

> "Watch this. I'm sending an email with a payroll document attached. Let's see what happens."

Send email with `payroll_demo_12emp.jpg` attached. Wait ~30 sec.

> "The ticket just appeared. Let me click on it."

Click the ticket. Point to the AI Pipeline section:
> "The AI read BOTH the email and the attachment. Left card — what the email says. Right card — what the bank slip shows. Including the depositor name, remark, and transaction ID that your Finance team needs."

Now go to Incoming Emails page:
> "Look — the employee list is already extracted and validated. The AI read 12 employees from the payroll image. Our system automatically stripped the name titles, validated every phone number, and checked that the amounts add up."

Point to the red rows:
> "See these? Two phone numbers are invalid. The system caught them BEFORE Finance even sees this ticket. Sales can go back to the client now."

Point to reconciliation:
> "Three-way match: email amount vs bank slip vs employee total. All automated."

> "**No human typed any of this. The email came in, the AI did the data entry, and the validation caught the errors. The user just reviews and submits.**"

### Part 3: Manual Override (1 min)
> "What if the AI got it wrong, or the client sends a different file later? The user can still upload a CSV, Excel, or even another image to override. The system accepts any format."

### Part 4: Bank Slip Without Employee List (1 min)
Show the Golden Dragon ticket (no attachment):
> "When there's no attachment, the system still works. Text extraction from the email body handles everything. The employee list upload becomes a manual step."

### Key Messages

**To Rita:** "This is exactly what you described — when the email comes in, the pre-check happens automatically. Clean Excel, validated phones, amounts add up. No human in the loop for data entry."

**On accuracy:** "This is free-tier AI. With the enterprise API that Win is setting up, accuracy will be even higher. But the architecture is ready now."

**On errors caught:** "Errors being caught IS the feature. It proves the system works."

---

## 9. Fallback Strategy

### If pipeline employee extraction works well (>80% correct):
Full demo narrative — "email arrives, everything automatic."

### If pipeline employee extraction partially works (50-80%):
Still good — "AI extracted 9 of 12 employees. Validation caught the issues. User can upload a corrected file to override."

### If pipeline employee extraction fails completely:
Deactivate v4 → reactivate v3. Switch to manual upload demo:
> "Let me show the upload path instead." Upload `payroll_demo_12emp.jpg` manually via the dashboard.

### If n8n import fails:
Existing Phase 2 demo still works (v3 active). Employee extraction shown via manual upload only (Track C).

**Every failure path has a working demo.**

---

## 10. Error Handling

| Scenario | Pipeline behavior | Dashboard display |
|----------|------------------|-------------------|
| Attachment has employee table | Extract + validate + show pre-populated | Purple badge + employee table + reconciliation |
| Attachment is bank slip only (no table) | `_employee_status: 'no_table'` | Normal upload zone shown |
| No attachment | `_employee_status: 'no_attachment'` | Normal upload zone shown |
| Vision API rate limited | `_employee_status: 'rate_limited'` | Normal upload zone + note "API limit reached" |
| Vision API error | `_employee_status: 'api_error'` | Normal upload zone + note "Extraction unavailable" |
| User uploads override file | Replaces pipeline data | New file's data replaces pre-populated table |

Every path degrades gracefully. The user is never stuck.

---

## 11. Long-Term Alignment

### What we're building NOW vs LATER

| Phase | What | Effort | Blocked by |
|-------|------|--------|-----------|
| **Phase 3 (now)** | Pipeline employee extraction + bank slip fields + manual fallback | 5 hrs | Nothing |
| **Phase 3.1** | Test with Win's real samples + PyiGyiKhin format | 2 hrs | Win's sample data |
| **Phase 3.2** | Switch to enterprise OpenAI/Gemini | 2 hrs | Win's API accounts |
| **Phase 3.3** | Myanmar language + handwriting OCR | 4-8 hrs | Real Myanmar samples |
| **Phase 3.4** | Dual-mode validation (MSISDN vs bank account) + NRC | 3 hrs | Phase 3.1 |
| **Phase 4a** | Split index.html into modules | 2-3 hrs | Standalone refactor |
| **Phase 4b** | Vercel API storage, replace URL-based transfer | 4-6 hrs | Architecture decision |

### File Splitting — Deferred to Phase 4a

**Current:** 2,396 lines. After Phase 3: ~2,550 lines. Pain threshold: ~4,000-5,000.
Not splitting now. See Phase 4a for the plan.

### Minh's Template-Driven Architecture

```
Bank slip:     depositor_name, amount, remark, txn_date, transaction_id
Employee list: name, account_or_phone, amount
```

Adding a field = adding a line to the prompt + a line to the display. Architecture scales.

---

## 12. Verification Checklist

### Safety
- [ ] `n8n-workflow-v3.json` is UNTOUCHED (diff confirms zero changes)
- [ ] `n8n-workflow-v4.json` exists as a separate file
- [ ] v3 is deactivated in n8n Cloud but NOT deleted
- [ ] Pre-test: Groq Vision curl test returns valid employee JSON

### Track A: Bank Slip (v4 pipeline)
- [ ] v4 vision prompt includes `depositor_name`, `remark`, `transaction_id`
- [ ] v4 Parse & Validate carries 3 new fields to ticket + results
- [ ] `createTicketFromN8n()` stores 3 new fields
- [ ] Vision AI card shows Depositor, Remark, Txn ID

### Track B: Pipeline Employee Extraction
- [ ] Employee List Extract node exists in v4 with correct code
- [ ] Node is wired: Vision Process → Employee Extract → Parse & Validate v4
- [ ] Parse & Validate v4 merges employee data into ticket payload
- [ ] Cross-validation: sum(employee amounts) vs email amount
- [ ] `createTicketFromN8n()` stores extracted_employees + confidence + status
- [ ] Dashboard auto-populates employee table from pipeline data (no manual upload needed)
- [ ] Auto-populated table shows AI confidence badge (purple)
- [ ] MSISDN validation runs on extracted data (green/red indicators)
- [ ] Name cleaning strips Myanmar prefixes
- [ ] Reconciliation shows 3-way comparison
- [ ] Submit button works with pre-populated data
- [ ] Employee amount mismatch flagged if totals differ

### Track C: Manual Upload Fallback
- [ ] `/api/extract-employees.js` deployed on Vercel
- [ ] `GROQ_API_KEY` set in Vercel environment variables
- [ ] Upload zone accepts images alongside CSV/XLSX
- [ ] Manual upload OVERRIDES pipeline-extracted data
- [ ] Image upload shows purple spinner
- [ ] 3 MB file size check (client + server side)
- [ ] Empty/error shows fallback message with CSV suggestion

### Regression
- [ ] CSV/XLSX upload still works exactly as before
- [ ] Existing n8n tickets (v3) display correctly
- [ ] n8n tickets WITHOUT attachments work normally (no employee table, upload zone shown)
- [ ] Privacy toggle blurs sensitive data
- [ ] Ctrl+Shift+R reset still works
- [ ] All Phase 2 features intact

### Demo readiness
- [ ] Demo images in `samples/` folder
- [ ] Sequence diagram renders in mermaid.live
- [ ] Pre-test confirms AI extraction quality
- [ ] Demo script rehearsed: email → auto-extract → validation → override option
- [ ] Rollback path: know how to reactivate v3
