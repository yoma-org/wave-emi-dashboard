# Phase 3.1: Myanmar Handwriting OCR + PDF Support + UX Quick Wins

**Date:** April 7, 2026 (evening) — FINAL VERSION (post AI council review)
**Status:** READY FOR EXECUTION
**Deploy by:** ~8 AM April 8, 2026
**AI Council Review:** 6 AIs reviewed, synthesis at `research/ai_council_phase3.1/AI_Council_Synthesis_Phase3.1.md`
**Two demos tomorrow:**
- **10:00 AM — Rita + team:** Myanmar OCR capability + UX progress + enterprise AI framing
- **10:30 AM — Myanmar ops (non-technical):** First time seeing system. Showcase + feedback.
**Predecessor:** Phase 3 (AI Document Extraction — completed Apr 7, demo successful)
**Larger scope plan:** `docs/ImplementationPlan_Phase4.md`

---

## Context

Phase 3 demo went well (Apr 7). DK presented to Rita (online) + Win + team. Pipeline extracted employees from payroll image live. Rita: "show it to those guys" (Myanmar ops).

**Feedback driving this sprint:**
- **Rita:** Don't be technical. Enterprise AI assessment. No real data on consumer AI. Offered Claude API key.
- **Minh (CEO):** Remove jargon. Collapsible sections. Mismatch flow wrong (bank shouldn't fix client's error). Tab names confusing. Two-level OCR validation with Culture Survey.
- **Vinh (PM):** Dashboard and Incoming Emails overlap. Employee table should be in ticket modal.
- **Win:** PDF attachment errors. Gemini preferred for Myanmar handwriting.

**AI Council consensus (6/6 agree):**
- Groq will struggle on Myanmar handwriting (10-65% accuracy range)
- n8n Cloud cannot convert PDF — don't attempt
- Client-side PDF.js via CDN = correct architecture
- All label changes correct
- Use "Return for Correction" not "Return to Client"
- Culture Survey OCR methodology is smart
- P4 (structural UX) = cut first if behind

---

## Priority Order

| Priority | What | Why |
|----------|------|-----|
| **P0** | Myanmar handwriting OCR test | Core demo value — prove pipeline handles Myanmar text |
| **P1** | Culture Survey OCR validation | Minh's strategy — real Myanmar text with built-in answer key |
| **P2** | PDF attachment support (client-side) | Win's blocker — DK committed to fixing |
| **P3** | UI/UX cleanup (labels, badges, collapsible, tab rename, banners) | Fast execution — polished for non-tech Myanmar ops |
| **P4** | Structural UX (employee modal, mismatch flow) | Only if time allows — skip first |

---

## P0: Myanmar Handwriting OCR Test

### Goal

Test existing pipeline with Myanmar handwriting attachment. Document results.

### Test Images (Ready — Grok-generated)

DK has 3 usable Grok-generated handwriting images. Save to `research/real_samples/grok_generated/`:

| Image | Filename | Employees | MSISDNs | Recommended Use |
|-------|----------|-----------|---------|-----------------|
| Pacific Star (bilingual, 13 emp) | `grok_handwriting_pacific_star_13emp.jpg` | 13 | Valid 09xxx format | **PRIMARY DEMO** — realistic, valid data, matches existing test |
| Full Myanmar (14 emp) | `grok_handwriting_myanmar_full_14emp.jpg` | 14 | Valid 09xxx format | **IMPRESSIVE TEST** — all-Myanmar proves deeper capability |
| Shwe Taung (21 emp) | `grok_handwriting_shwe_taung_21emp.jpg` | 21 | Garbled (P/R prefixes) | **TEST ONLY** — shows system catches bad data |

### Test Procedure

1. Save primary image (Pacific Star handwriting) to desktop
2. Compose email: "Salary disbursement request from Pacific Star Garment Factory — March 2026 payroll" + attach image
3. Send to pipeline Gmail inbox
4. Wait ~30 sec for pipeline processing
5. Check dashboard:
   - Does ticket appear? (Text extraction from email body)
   - Does vision AI extract data from handwriting? (Document Analysis card)
   - Does employee extraction work? (Employee table auto-populated)
   - What accuracy? (How many names/phones/amounts correct)
6. Screenshot results + note accuracy assessment

### All Three Outcomes Are Demoable

| Outcome | Accuracy | Demo Narrative |
|---------|----------|---------------|
| **SUCCESS** | >70% | "Our pipeline reads Myanmar handwriting. Here are the extracted employees." |
| **PARTIAL** | 30-70% | "Consumer AI reads some Myanmar — names partly correct, amounts readable. Enterprise AI will improve this significantly." |
| **FAILURE** | <30% | "We stress-tested consumer AI on Myanmar handwriting. As expected, it struggled. This is exactly why Rita was right to suggest enterprise AI." |

**There is no failure scenario.** All outcomes advance the project.

### Fallback

If Grok images are unavailable: use Culture Survey PDF (P1) as Myanmar text demo instead.

---

## P1: Culture Survey OCR Validation

### Goal

Quantify Myanmar OCR accuracy using bilingual document with built-in English answer key.

### Test Data (Ready)

| File | Location | Status |
|------|----------|--------|
| `YFS_Culture_Survey_Bilingual_Mar2026.pdf` | `research/real_samples/culture_survey_bilingual/` | 278 KB, Myanmar Unicode confirmed |
| `YFS_Culture_Survey_Bilingual_Mar2026_UTF8.csv` | Same folder | 52 rows, 5,089 Myanmar chars, full answer key |

**Safety:** Culture survey = HR engagement questions, NOT financial data. Safe for consumer AI.

### Test Procedure

**Important methodology fix (from Gemini):** OCR accuracy and translation accuracy are different. Ask the AI for BOTH raw Myanmar text AND English translation.

1. Convert 1-2 pages of PDF to PNG screenshots (since pipeline doesn't handle PDF yet, or use P2 if done first)
2. Upload screenshots via dashboard manual upload, OR test via direct Groq API call
3. **Prompt:** "Read this document. For each numbered statement: (a) Extract the Myanmar text exactly as written, (b) Provide the English translation."
4. Compare:
   - **Semantic match** (headline metric): Does the AI's English output match the CSV's English text in meaning? Score: X of 47 correctly interpreted = Y%
   - **Character-level** (technical metric, if time): Compare raw Myanmar extraction against UTF-8 CSV
5. Document results

### Scoring

| Metric | For | Method |
|--------|-----|--------|
| **Semantic match** | Demo headline | "AI correctly interpreted 38 of 47 Myanmar statements = 81%" |
| **Character Error Rate** | Technical appendix | Compare extracted Myanmar chars vs known CSV chars |

Do NOT use exact string match — AI will rephrase naturally, creating false "failures."

### Fallback

If PDF/image not processable through pipeline: test via direct Groq API call outside the pipeline. The test is about AI accuracy, not pipeline format support.

---

## P2: PDF Attachment Support

### Problem

Win's team sends PDF attachments → pipeline errors. Groq Vision API does NOT accept PDF (confirmed by all 6 AI council members). Only image formats (PNG, JPEG).

### Technical Reality

**Current pipeline (`n8n-workflow-v4.json`, Prepare node line ~46):**
The Prepare node already extracts PDF binary with `mime === 'application/pdf'`, but then the Vision Process node sends it to Groq as-is → Groq rejects it.

**Three layers — safe execution order:**

### Layer 1: Dashboard Upload Zone (5 min, zero risk)

Add `.pdf` to employee list upload `accept` attribute.

**2 locations in `index.html`:**

| Line | Current | New |
|------|---------|-----|
| ~1121 | `accept=".csv,.xlsx,.png,.jpg,.jpeg"` | `accept=".csv,.xlsx,.png,.jpg,.jpeg,.pdf"` |
| ~1193 | `accept=".csv,.xlsx,.png,.jpg,.jpeg"` | `accept=".csv,.xlsx,.png,.jpg,.jpeg,.pdf"` |

Update hint text (~1124, ~1196): `"CSV, Excel, or Document (PNG/JPG/PDF)"`

### Layer 2: Client-Side PDF-to-Image (1-2 hours, low risk)

**Architecture (validated by all 6 AIs):** Use PDF.js in the BROWSER (not server-side). Load from CDN. Render page 1 to canvas. Export as JPEG. Send to existing API unchanged.

**Implementation in `handleEmployeeUpload()` function (~line 1342):**

```javascript
function handleEmployeeUpload(input, emailId, ticketId){
  const file = input.files[0];
  if(!file) return;
  // v4: Route images to AI extraction
  if(file.type.startsWith('image/')){
    handlePayrollImageExtraction(file, emailId, ticketId);
    return;
  }
  // NEW: Route PDFs to conversion → then AI extraction
  if(file.type === 'application/pdf' || file.name.endsWith('.pdf')){
    handlePdfConversion(file, emailId, ticketId);
    return;
  }
  // ... existing CSV/XLSX handling continues
}
```

**New function `handlePdfConversion()`:**

```javascript
async function handlePdfConversion(file, emailId, ticketId){
  var previewEl = document.getElementById('emp-preview-'+emailId);
  if(!previewEl) return;
  previewEl.innerHTML = '<div style="text-align:center;padding:20px"><div class="spinner"></div><div style="margin-top:8px;color:var(--blue);font-weight:600">Converting PDF...</div></div>';
  
  try {
    // Lazy-load PDF.js from CDN (only when needed)
    if(!window.pdfjsLib){
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs';
      script.type = 'module';
      // Alternative: use legacy build for broader compatibility
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.type = 'text/javascript';
      document.head.appendChild(script);
      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
        setTimeout(reject, 10000); // 10s timeout
      });
      pdfjsLib.GlobalWorkerOptions.workerSrc = 
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    
    // Read PDF file
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
    const page = await pdf.getPage(1); // First page only
    
    // Render to canvas (2.0x scale for OCR quality)
    const scale = 2.0;
    const viewport = page.getViewport({scale: scale});
    const canvas = document.createElement('canvas');
    
    // COUNCIL FIX (Grok): Cap width at 2000px to control base64 size
    const maxWidth = 2000;
    const actualScale = viewport.width > maxWidth ? (maxWidth / viewport.width) * scale : scale;
    const finalViewport = page.getViewport({scale: actualScale});
    
    canvas.width = finalViewport.width;
    canvas.height = finalViewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({canvasContext: ctx, viewport: finalViewport}).promise;
    
    // COUNCIL FIX (Gemini): Use JPEG not PNG to stay under Vercel 4.5MB limit
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const base64 = dataUrl.split(',')[1];
    
    // Create a fake File-like object for existing handlePayrollImageExtraction
    const blob = await (await fetch(dataUrl)).blob();
    const imageFile = new File([blob], file.name.replace('.pdf','.jpg'), {type:'image/jpeg'});
    
    // Route to existing image extraction — no API changes needed
    handlePayrollImageExtraction(imageFile, emailId, ticketId);
    
  } catch(err){
    // COUNCIL FIX (Claude/Grok): Fallback if PDF.js fails
    previewEl.innerHTML = '<div class="alert alert-warn" style="margin-top:8px">PDF conversion failed. Please save as PNG/JPG and upload the image instead.<br><span style="font-size:12px">Error: '+(err.message||'PDF.js could not load')+'</span></div>';
  }
}
```

**Key safety measures (from council):**
- Lazy-load PDF.js only when user uploads a PDF (no upfront load cost)
- 10-second CDN timeout with fallback message
- Cap canvas width at 2000px (Grok: controls base64 size)
- JPEG at 0.85 quality, not PNG (Gemini: stays under Vercel 4.5MB payload limit)
- try/catch with user-friendly fallback: "save as image and re-upload"
- Routes to EXISTING `handlePayrollImageExtraction()` — no API changes

### Layer 3a: Pipeline PDF Detection (30 min, zero risk)

**Problem in current pipeline:** The Prepare node already extracts PDF binary (`mime === 'application/pdf'`), but the Vision Process node sends the raw PDF to Groq → Groq rejects.

**Fix:** In the Vision Process node, check MIME type before calling Groq. If PDF → skip vision, flag for manual upload.

**In `n8n-workflow-v4.json`, Vision Process node code:**

Add at the top of the Vision Process code:
```javascript
const attachment = items[0].json.attachment_base64;
if (attachment && attachment.mimeType === 'application/pdf') {
  // PDF cannot be processed by Groq Vision — flag for manual dashboard upload
  return {
    json: {
      ...items[0].json,
      _vision_result: JSON.stringify({
        doc_type: 'PDF (requires conversion)',
        confidence: 0,
        total_amount: 0,
        error: 'PDF detected — please upload via dashboard for conversion'
      }),
      _vision_status: 'pdf_skipped'
    }
  };
}
```

**COUNCIL FIX (Grok):** Also check for `application/octet-stream` + filename extension:
```javascript
const isPdf = attachment && (
  attachment.mimeType === 'application/pdf' || 
  attachment.mimeType === 'application/octet-stream' && 
    (attachment.filename || '').toLowerCase().endsWith('.pdf')
);
```

**What this achieves:** Pipeline no longer crashes on PDF emails. Ticket is still created (text extraction works). Vision shows "PDF detected — upload via dashboard." Employee extraction skipped but user can manually upload the PDF through the dashboard (which now has Layer 2 conversion).

### Layer 3b: n8n PDF-to-Image Conversion — DROPPED

**All 6 AI council members agreed:** n8n Cloud sandbox lacks canvas/image rendering libraries. Do NOT attempt PDF conversion in n8n tonight. Enterprise AI (Claude/Gemini) handles PDF natively — proper fix comes in Phase 4.

---

## P3: UI/UX Quick Wins

All changes in `index.html` only. Zero pipeline risk. Each change is independent — revert individually if any breaks.

### P3a: Language & Label Cleanup

**Exact changes with line numbers:**

| Line | Current | New | Notes |
|------|---------|-----|-------|
| ~391 | `<span class="nav-tag n8n-tag"...>n8n</span>` | `<span class="nav-tag n8n-tag"...>Auto</span>` | Or remove entirely |
| ~376 | `>Incoming Emails</button>` | `>Ticket List</button>` | Main nav |
| ~399 | `>Incoming Emails</button>` | `>Ticket List</button>` | Mobile nav |
| ~1052 | `🤖 Automated Intake (n8n)` | `Email Processing` | Section header |
| ~1137 | `n8n Webhook Configuration` | `System Configuration` | Collapsible config |
| ~2400 | `AI Pipeline Analysis` | `AI Analysis` | Section title |
| ~2405 | `Text Extraction<br><span...>Groq llama-3.3-70b</span>` | `Email Analysis` (remove subtitle span) | Card title |
| ~2411 | `Document Vision<br><span...>Groq llama-4-scout</span>` | `Document Analysis` (remove subtitle span) | Card title |
| ~2430 | Same pattern (no-vision case) | Same cleanup | No-vision card |
| ~2426 | `CROSS-VALIDATION PASSED` | `AMOUNT VERIFIED` | Match box text |
| ~1311, ~1377 | `<th>MSISDN</th>` | `<th>Phone Number</th>` | Table headers |
| ~1124, ~1196 | `CSV, XLSX, or Payroll Image (PNG/JPG)` | `CSV, Excel, or Document (PNG/JPG/PDF)` | Upload hints |
| ~1302 | `Groq Vision AI analyzing document` | `AI analyzing document` | Loading spinner text |
| Dashboard empty state | `Head over to Incoming Emails` | `Head over to Ticket List` | Search for exact string |
| ~2459 | `n8n</span>` badge in modal | `Auto</span>` or remove | Modal header badge |

**Also search for any remaining "n8n" in user-facing strings (not variable names/IDs).**

### P3b: Color-Coded Badges

**At ~line 1086** in `renderEmails()` n8n ticket card section:

Current:
```javascript
<span style="color:var(--success);font-size:12px;font-weight:600">Parsed &rarr; ${t.id}</span>
```

New:
```javascript
const badgeColor = t.scenario === 'AMOUNT_MISMATCH' ? 'var(--danger)' : 
                   t.scenario === 'MISSING_APPROVAL' ? 'var(--warn)' : 'var(--success)';
const badgeLabel = t.scenario === 'AMOUNT_MISMATCH' ? 'Flagged' : 'Parsed';
// Use: <span style="color:${badgeColor};font-size:12px;font-weight:600">${badgeLabel} &rarr; ${t.id}</span>
```

### P3c: Collapsible Sections in Ticket Detail Modal

**In `openTicketDetail()` function (~line 2446):**

**CSS to add (in `<style>` section):**
```css
.section-collapsible .section-content { display:none; }
.section-collapsible.open .section-content { display:block; }
.section-toggle { 
  cursor:pointer; color:var(--blue); font-weight:600; 
  padding:10px 0; border-bottom:1px solid #e2e8f0; 
  user-select:none; 
}
.section-toggle::before { content:'▶ '; font-size:11px; }
.section-collapsible.open .section-toggle::before { content:'▼ '; }
```

**What to collapse/keep visible:**

| Section | Default | Wrap With |
|---------|---------|-----------|
| Amount Verification (cross-validation box) | **VISIBLE** | No wrapper — keep as-is |
| Header (company, amount, badges) | **VISIBLE** | No wrapper — keep as-is |
| AI Analysis (text + vision cards) | **Collapsed** | `section-collapsible` → toggle: "View AI Analysis" |
| Email Source (from, to, body) | **Collapsed** | `section-collapsible` → toggle: "View Email Details" |
| Authority Matrix | **Collapsed** | `section-collapsible` → toggle: "View Approval Status" |
| Processing Status | **Collapsed** | `section-collapsible` → toggle: "View Processing Status" |

**COUNCIL COMPROMISE (DeepSeek):** Amount Verification stays visible because it IS the core value signal. Users see "AMOUNT VERIFIED" or "AMOUNT MISMATCH" immediately. Technical AI details (model names, confidence bars) are one click away.

**Reorder modal sections to put Amount Verification FIRST after header:**
1. Header (company, ID, badges)
2. **Amount Verification** (visible — the trust signal)
3. AI Analysis (collapsed)
4. Email Source (collapsed)
5. Authority Matrix (collapsed)
6. Processing Status (collapsed)

### P3d: Finance/E-Money Info Banners

**Finance Approval page** (in `renderFinance()` or equivalent):
```html
<div style="background:#f0f9ff;border-left:4px solid var(--blue);padding:12px 16px;margin-bottom:16px;border-radius:4px;font-size:13px">
  Finance reviews and approves disbursement requests before funds are released.
</div>
```

**E-Money Review page** (in `renderEmoney()` or equivalent):
```html
<div style="background:#f0f9ff;border-left:4px solid var(--blue);padding:12px 16px;margin-bottom:16px;border-radius:4px;font-size:13px">
  E-Money team processes approved disbursements through the Wave Money system.
</div>
```

---

## P4: Structural UX (Only If Time Allows)

**Cut first if behind schedule (universal council recommendation).**

### P4a: Employee Table in Ticket Detail Modal

In `openTicketDetail()`, after Amount Verification section, add collapsible employee table if `t.extracted_employees` or `t.employee_data` exists. Reuse rendering logic from `renderEmails()` n8n card (~line 1319-1332). Show first 5 rows, "Show all X employees" toggle for rest.

### P4b: Mismatch Flow — Return for Correction

When `t.scenario === 'AMOUNT_MISMATCH'`, show:
1. Red alert banner (always visible in modal header area)
2. Primary action: **"Return for Correction"** → pre-drafted email template
3. Secondary (collapsed): "Override & Continue" → requires reason text

**Terminology: "Return for Correction"** (council consensus — Claude, Gemini, GPT, Grok all converge).

---

## Execution Order (Time-Boxed with Checkpoints)

| # | Task | Time Box | Checkpoint |
|---|------|----------|-----------|
| 1 | **DK: Save Grok handwriting images** to designated folder | 5 min | Images in `grok_generated/` |
| 2 | **P0: Send handwriting email** through pipeline | 30 min | Results documented (screenshot + accuracy) |
| 3 | **P1: Culture Survey OCR test** (convert PDF pages to PNG, test) | 45 min | Accuracy % calculated |
| 4 | **P3a: Label cleanup** (all string replacements) | 30 min | No jargon visible in UI |
| 5 | **P3b: Badge colors** (conditional logic) | 15 min | ACME shows red "Flagged" |
| 6 | **P2 Layer 1: Upload zone** adds `.pdf` | 5 min | PDF selectable in upload |
| — | **CHECKPOINT 1: git commit + push to Vercel** | 5 min | **Safe state: labels clean, badges colored, PDF selectable** |
| 7 | **P2 Layer 2: PDF.js client-side** conversion | 1.5 hours | Manual PDF upload → extraction works |
| 8 | **P3c: Collapsible sections** in modal | 45 min | Sections collapse/expand, Amount Verification visible |
| — | **CHECKPOINT 2: git commit + push to Vercel** | 5 min | **Safe state: PDF works, modal polished** |
| 9 | **P2 Layer 3a: Pipeline PDF detection** | 30 min | Pipeline doesn't crash on PDF emails |
| 10 | **P3d: Info banners** | 10 min | Finance/E-Money have context |
| — | **CHECKPOINT 3: git commit + push to Vercel** | 5 min | **Safe state: all P2+P3 complete** |
| 11 | **P4a: Employee table in modal** (if time) | 1.5 hours | Dashboard click → employees visible |
| 12 | **P4b: Mismatch flow** (if time) | 1 hour | "Return for Correction" action |
| — | **FINAL: git commit + push to Vercel** | 5 min | **Everything deployed** |
| 13 | **Full test:** Ctrl+Shift+R + fresh Pacific Star email | 15 min | End-to-end verified |

**Total: ~7-8 hours** (with Claude Max compression: ~5-6 actual)

**Stop rule:** If any step takes >1.5x its time box, skip it and move to the next checkpoint. We always have a deployable state.

---

## Demo Strategy

### Meeting 1: Rita + Team (10:00 AM)

**Goal:** Show Myanmar OCR capability + UX progress. Frame enterprise AI conversation.

**Flow (15 min):**

1. **(3 min) Myanmar OCR results:**
   - Show the handwriting test image → show what pipeline extracted
   - If success: "Our pipeline reads Myanmar handwriting on consumer AI"
   - If failure: Use Gemini's script: "We stress-tested consumer-grade AI with Myanmar handwriting. As expected, it struggled. This is exactly why Rita was right to suggest enterprise AI. Consumer tools handle English and printed text fine, but for Wave Money's operations, we need enterprise models like Claude or Gemini."

2. **(2 min) Culture Survey validation:**
   - "We validated Myanmar text accuracy using Wave's own bilingual Culture Survey"
   - Show accuracy %: "X of 47 statements correctly interpreted"
   - Frame: this establishes baseline for comparing AI providers

3. **(1 min) PDF support:**
   - "Win's team reported PDF errors. Fixed — system now converts PDF to image automatically."
   - Quick demo: upload a PDF → shows extraction

4. **(3 min) UX cleanup:**
   - "We simplified the dashboard. No technical jargon. Details collapse by default."
   - Quick walkthrough of cleaned labels, collapsible sections

5. **(5 min) Live demo:**
   - Send Pacific Star email → watch extraction
   - Click ticket → show Amount Verification (visible), expand AI Analysis (collapsed)

**Ask Rita:**
- Claude API key status
- Enterprise AI assessment: any specific requirements?
- Feedback on UX direction

**DO NOT show:** n8n pipeline, model names, technical architecture

### Meeting 2: Myanmar Ops Team (10:30 AM)

**Goal:** First impressions. Let them interact. Gather feedback.

**Flow (15-20 min):**

1. **(2 min) Context:**
   - Use Gemini's framing: "Normally, your team would have to read the email, open the attachment, and type this into a spreadsheet. The system has already drafted it for you. You just check the amounts and click approve."

2. **(5 min) Live email:**
   - Send test email → ticket appears automatically
   - "No one typed any of this. The system read the email and the attachment."

3. **(5 min) Click through:**
   - Open ticket → Amount Verification visible
   - Expand AI Analysis (if they want detail)
   - Show employee table

4. **(3 min) Approval flow:**
   - Finance approval → E-Money processing → CSV generation

5. **(5+ min) Questions:**
   - Let them explore
   - Note every confusion point and question

**Key line:** "The system reads the email and attachment automatically. You review and approve."

**Avoid:** API, webhook, base64, model names, n8n, dev tools. Use Grok's framing: frame the AI as an "assistant doing data entry."

### Fallback (Both Meetings)

If overnight changes break anything:
- `git revert` the breaking commit OR re-push last working commit
- Demo with current Phase 3 version — it works perfectly
- Frame: "Core extraction pipeline is production-ready. UX upgrades are in progress."

---

## Files to Modify

| File | What Changes | Priority | Risk |
|------|-------------|----------|------|
| `index.html` | P3 (labels, badges, collapsible, banners) + P2 Layer 1+2 (upload accept, PDF.js) + P4 (if time) | P2-P4 | Low — UI only |
| `pipelines/n8n-workflow-v4.json` | P2 Layer 3a: PDF MIME detection in Vision Process node | P2 | Low — detection + skip only |
| **NO changes to:** | `api/extract-employees.js`, `api/webhook.js`, `n8n-workflow-v3.json` | — | — |

---

## Verification Checklist

### P0: Myanmar Handwriting
- [ ] Handwriting image sent through pipeline
- [ ] Results documented (screenshot + accuracy notes)
- [ ] Demo narrative prepared for actual outcome

### P1: Culture Survey OCR
- [ ] Culture Survey pages tested (PNG screenshots or PDF if P2 ready)
- [ ] AI output compared against CSV answer key
- [ ] Semantic accuracy % calculated
- [ ] Results documented

### P2: PDF Support
- [ ] Upload zone accepts `.pdf` (Layer 1)
- [ ] Client-side PDF→JPEG conversion works (Layer 2)
- [ ] PDF.js CDN loads successfully with timeout fallback
- [ ] Canvas capped at 2000px width (Grok fix)
- [ ] JPEG output at 0.85 quality (Gemini fix)
- [ ] Manual PDF upload → employee extraction works
- [ ] Pipeline doesn't crash on PDF email attachment (Layer 3a)
- [ ] MIME check covers `application/octet-stream` + filename extension (Grok fix)
- [ ] **Existing image flow still works** (regression — CRITICAL)

### P3: UI/UX
- [ ] No "n8n", "Groq", "llama", "MSISDN" in default UI view
- [ ] "Incoming Emails" → "Ticket List" in nav
- [ ] ACME mismatch shows red "Flagged → TKT-xxx"
- [ ] Modal sections collapsible (AI Analysis, Email, Authority — collapsed by default)
- [ ] Amount Verification visible by default in modal
- [ ] Finance and E-Money tabs have info banners

### P4: Structural (if completed)
- [ ] Employee table in ticket detail modal
- [ ] Mismatch shows "Return for Correction" action

### Regression (CRITICAL)
- [ ] Pacific Star email: full pipeline works end-to-end
- [ ] ACME mismatch: correctly detected
- [ ] CSV upload: still works
- [ ] Image upload (PNG/JPG): still works
- [ ] Finance approval flow: works
- [ ] E-Money flow + CSV generation: works
- [ ] Ctrl+Shift+R reset: works

---

## Phase Map

```
Phase 1: Basic Dashboard + CSV Generation .............. DONE
Phase 2: UI/UX Enhancement + AI Pipeline Showcase ...... DONE
Phase 3: AI Document Extraction (employee list) ........ DONE (Apr 7 demo)
Phase 3.1: Myanmar OCR + PDF + UX Quick Wins .......... THIS PLAN (overnight Apr 7-8)
Phase 4: Enterprise AI + Advanced UX + OCR Validation .. NEXT (Apr 8-12)
Phase 5: Production Readiness (auth, DB, Wave email) ... FUTURE
Phase 6+: Reversals, Block/Unblock, Full Rita Phases ... FUTURE
```
