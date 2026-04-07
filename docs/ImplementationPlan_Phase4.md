# Implementation Plan — Phase 4: UX Overhaul + Enterprise AI Readiness + Myanmar OCR Validation

**Date:** April 7, 2026 (updated April 7 evening)
**Status:** PLANNING — execution after Phase 3.1 overnight sprint
**Scope:** PDF support (Win blocker), Enterprise AI comparison (Rita directive), Myanmar OCR validation framework (Minh strategy), role system (Minh suggestion), plus any Phase 3.1 items deferred from overnight
**Sources:** Post-demo client meeting Apr 7, internal standup (Minh feedback), Teams chat, Rita directives, DK-Minh post-meeting conversation
**Predecessor:** Phase 3.1 (UX Quick Wins — overnight Apr 7-8)

---

## Context

Phase 3 delivered a working AI pipeline: email → extract summary + bank slip + employee list → validate → display. The demo worked live in the client meeting. Rita said "show it to those guys" (Myanmar ops). Now four streams of feedback converge:

1. **Rita (client):** Enterprise AI security, comparison assessment, no real data on consumer AI, spin up Bedrock
2. **Minh (CEO, internal):** Dashboard UX is too technical for Myanmar bank users. Fix flow logic (mismatch → don't ask Maker to fix client's error). Role system needed. Collapsible sections. Also: two-level Myanmar OCR validation strategy using bilingual Culture Survey data.
3. **Vinh (PM):** Dashboard and Incoming Emails tabs overlap. Why switch tabs to see employee list?
4. **Win (Myanmar ops):** PDF attachment errors. Gemini preferred for Myanmar handwriting.

---

## What This Phase Is NOT

- NOT a rebuild. The pipeline works. The E-Money workflow works. The CSV generation works.
- NOT production deployment. Still demo/testing phase.
- NOT the enterprise AI migration itself. That's Phase 4 (blocked on Bedrock credentials).

**This phase = polish the front-end + fix the PDF gap + prepare the AI comparison doc + build the Myanmar OCR validation framework.**

---

## Work Streams

| Stream | Focus | Type |
|--------|-------|------|
| **A** | UX Overhaul (Minh + Vinh Feedback) | Code (index.html) |
| **B** | PDF Attachment Support (Win Blocker) | Code (pipeline + API) |
| **C** | Enterprise AI Platform Comparison (Rita Directive) | Research document |
| **D** | Myanmar OCR Validation Framework (Minh Strategy) | Test framework + data |

---

## Stream A: UX Overhaul

### A1. Merge Dashboard + Incoming Emails Into One Flow

**Problem (Vinh):** User sees ticket on Dashboard, but must switch to Incoming Emails tab to see employee list. Why?

**Problem (Minh):** Too much back-and-forth. Flow should be directive — linear, not switching tabs.

**Current state:**
| Feature | Dashboard | Incoming Emails |
|---------|-----------|----------------|
| Ticket list | Yes (table) | Yes (cards) |
| AI badges | Yes | Yes |
| Ticket detail modal | Yes (click row) | No |
| Employee table | **No** | Yes |
| Upload zone | **No** | Yes |
| Submit button | **No** | Yes |
| Summary stats | Yes | No |

**Solution: Enhance the ticket detail modal to include everything.**

When user clicks any ticket (from Dashboard or anywhere), the modal shows:
1. AI Pipeline Analysis (already there)
2. Cross-validation / Amount Verification result (already there)
3. **Employee table** (move from Incoming Emails into modal)
4. **Upload zone** (move from Incoming Emails into modal — collapsed by default)
5. **Submit action** (move from Incoming Emails into modal)

**Tab renaming (Minh's point):**
| Current | New | Reason |
|---------|-----|--------|
| "Incoming Emails" | "Ticket List" | Minh: "this tab literally shows all the tickets" |
| "🤖 Automated Intake (n8n)" | "Email Processing" or remove entirely | Minh: users don't know what n8n is |

**What happens to "Incoming Emails" tab:**
- Rename to "Ticket List"
- It becomes the detailed ticket workspace — shows ALL tickets (not just n8n ones), with richer cards
- Dashboard remains the command center with stats + summary table
- The overlap reduces because the primary action path is: Dashboard → click ticket → modal with everything → submit

**Effort:** 3-4 hours
**Risk:** Low — moving existing HTML/JS into the modal, not creating new logic
**Files:** `index.html` only

---

### A2. Mismatch Flow Logic (Minh's Insight)

**Problem:** When the system detects AMOUNT_MISMATCH between email request and bank slip, the current flow still shows "Step 2: Upload Employee List" to the Intake/Maker. Minh's point: **why should the bank's Maker fix the client's error?**

**Correct behavior:** If mismatch detected → system should flag it back to the client (or at minimum, show a clear "Return to Client" action instead of "Upload Employee List").

**Current flow:**
```
Email arrives → AI detects mismatch → Status: AWAITING_EMPLOYEE_LIST → Maker uploads list → Submit to Finance
```

**Corrected flow:**
```
Email arrives → AI detects mismatch → Status: FLAGGED_MISMATCH → Show "Return to Client" action
                                    → User can choose: "Return to Client" (draft email) OR "Override & Continue" (with reason)
```

**Implementation:**
1. New status: `FLAGGED_MISMATCH` (or reuse `AMOUNT_MISMATCH` scenario with different behavior)
2. When `has_mismatch: true`, ticket detail modal shows:
   - Red alert: "Amount Mismatch Detected — Email: X vs Document: Y (Z% difference)"
   - Primary action: "Return to Client" → opens pre-drafted response email template
   - Secondary action (collapsed): "Override & Continue" → requires reason text → then allows normal flow
3. "Parsed → TKT-004" badge turns **red** when mismatch (Minh's specific feedback)

**Business logic validation:** This aligns with real banking operations. When a client's payment request doesn't match their bank slip, the bank returns it to the client for correction — the bank's Maker should NOT be manually fixing the client's numbers. This is both a compliance and operational correctness improvement.

**Effort:** 2-3 hours
**Risk:** Low — UI behavior change, no pipeline change
**Files:** `index.html` only

---

### A3. Color Coding & Badge Cleanup (Minh's Feedback)

**Problem:** "Parsed → TKT-004" shows as green even when ticket has mismatch. Confusing.

**Fix:**
| Scenario | Current Badge | New Badge |
|----------|--------------|-----------|
| Normal (no issues) | Green "Parsed → TKT-004" | Green "Parsed → TKT-004" (no change) |
| Amount Mismatch | Green "Parsed → TKT-004" | **Red** "Flagged → TKT-004" |
| Missing Approval | Green "Parsed → TKT-004" | **Amber** "Parsed → TKT-004 (Missing Approval)" |

**Effort:** 30 min
**Risk:** Zero — CSS class change
**Files:** `index.html` only

---

### A4. Collapsible Sections (Minh's Feedback)

**Problem:** Too much detail visible at once. Non-technical users are overwhelmed.

**Minh's direction:** "Has very much details, but collapsed into sections which are able to expand with button."

**What to collapse by default:**

| Section | Default State | Expand Label |
|---------|--------------|-------------|
| AI Pipeline Analysis (text + vision cards) | **Collapsed** | "View AI Analysis" |
| Email Source (from, to, body) | **Collapsed** | "View Email Details" |
| Authority Matrix | **Collapsed** | "View Approval Status" |
| Employee Table (when > 5 rows) | **Show first 5, collapse rest** | "Show all X employees" |
| Cross-Validation / Amount Verification | **Visible** (this is the key decision info) | — |
| Amount + Company + Status | **Visible** (header info) | — |

**Principle:** Show the decision-relevant info (amount, match/mismatch, status) immediately. Technical details (AI model names, confidence %, email headers) are one click away but hidden by default.

**Effort:** 1-2 hours
**Risk:** Zero — CSS + JS toggle, no logic change
**Files:** `index.html` only

---

### A5. Language & Label Cleanup (Minh's Feedback)

**Problem:** Technical/developer terms visible to end users. Users don't know or care what n8n, Groq, MSISDN, or llama-4-scout means.

| Current Text | New Text | Reason |
|---|---|---|
| "🤖 Automated Intake (n8n)" | "Email Processing" | Users don't know n8n |
| "Incoming Emails" (tab) | "Ticket List" | It shows tickets, not emails |
| "Text Extraction (Groq llama-3.3-70b)" | "Email Analysis" | No model names in user-facing UI |
| "Document Vision (Groq llama-4-scout)" | "Document Analysis" | No model names in user-facing UI |
| "Cross-Validation" | "Amount Verification" | Simpler, business-facing term |
| "MSISDN" (in tables) | "Phone Number" | MSISDN is telco jargon |
| "Reconciliation" | "Amount Check" | Simpler |
| "n8n" badge (orange pulse) | "Auto" or remove | Users don't care about n8n |
| "vision_confidence" percentage | Hide unless expanded | Technical detail |
| "AI Pre-Extracted from Email" | "Auto-Extracted" | Simpler |
| "Groq", "llama-3.3-70b", "llama-4-scout" | Remove from user-facing UI | Keep in expanded/dev sections only |

**Note:** Model names and technical details can still appear in the **collapsed** AI Analysis section (A4) for technical users who expand it. They just shouldn't be the first thing a Myanmar bank operator sees.

**Effort:** 1 hour
**Risk:** Zero — string replacements
**Files:** `index.html` only

---

### A6. Role System Enhancement (Minh's Suggestion)

**Current state:** 3 roles (Intake/Maker, Finance, E-Money) with client-side cycling.

**Minh's suggestion:** Simplify to 2 roles for demo: Admin/Manager (see everything) and Regular User (see only some parts).

**Honest assessment — banking compliance perspective:**

In real banking systems, role separation is a **regulatory requirement**:
- **Maker-Checker principle:** The person who creates a transaction (Maker) CANNOT approve it (Checker). This is a fundamental banking control.
- **Segregation of duties:** Finance approval must be separate from E-Money processing. One person cannot both approve and execute.
- **Audit trail:** Regulators require knowing WHO did WHAT at each step.

An "Admin sees everything AND can do everything" role would violate the Maker-Checker principle — if someone can both create tickets AND approve them, there's no control.

**Recommended compromise:**

| Role | Can See | Can Do | For Demo |
|------|---------|--------|----------|
| **Manager** (Minh's "Admin") | All pages, all tickets, full detail | **View only** — cannot approve or process | Rita, Win, managers |
| **Intake / Maker** | Dashboard, Ticket List | Parse emails, upload, submit to Finance | Sales team |
| **Finance** | Dashboard, Finance Approval | Approve/reject tickets | Finance team |
| **E-Money** | Dashboard, E-Money pages | Process approved tickets | E-Money ops team |

**The "Manager" role is a read-only observer** — can see everything but cannot perform actions. This is standard in banking systems (supervisory access / audit access).

For the demo:
- Default to Manager role (everyone can see everything)
- Show role-switching as a feature: "In production, each user only sees their own workflow"
- This satisfies Minh's "Admin sees everything" request while maintaining banking compliance

**Effort:** 2-3 hours (add Manager role + read-only logic)
**Risk:** Low — adding a role, not changing existing ones
**Files:** `index.html` only

---

### A7. Finance & E-Money Tab Clarification

**Problem (Minh):** "What is the role of Finance Approval and E-Money Review tabs?"

DK didn't explain this well in the internal meeting. Here's what each does and why:

**Finance Approval:**
- Shows only `PENDING_FINANCE` tickets
- Finance Manager reviews: amount, authority matrix (are required approvers present?), risk level
- Action: Approve or Reject
- **Why it exists:** Segregation of duties. Intake creates the ticket; Finance independently validates it has proper authorization before money moves. This is a compliance requirement.

**E-Money Review (+ 5 sub-pages):**
- Shows only `READY_FOR_CHECKER` and in-progress tickets
- E-Money operator processes the approved disbursement through Utiba (Wave's transaction system)
- 5-step sequential workflow: Prepare CSV files → Checker review → Group mapping (OTC only) → Monitor transactions → Close case
- **Why it exists:** This IS the actual money movement workflow. Each step has a specific purpose in the Utiba system.

**For the demo:** These tabs should be shown but with clearer labeling. The UX should make it obvious that this is a **linear workflow**, not random tabs to explore.

**Action:** Add a brief info banner at the top of each restricted page explaining its purpose in plain language. Example:
- Finance tab: "Finance reviews and approves disbursement requests before funds are released."
- E-Money tab: "E-Money team processes approved disbursements through the Wave Money system."

**Effort:** 30 min
**Risk:** Zero
**Files:** `index.html` only

---

### Stream A Summary

| Task | Effort | Priority | Risk |
|------|--------|----------|------|
| A5: Language/label cleanup | 1 hour | HIGH | Zero |
| A3: Color-coded badges (red for mismatch) | 30 min | HIGH | Zero |
| A4: Collapsible sections | 1-2 hours | HIGH | Zero |
| A1: Merge employee table into ticket modal | 3-4 hours | HIGH | Low |
| A2: Mismatch flow logic (return to client) | 2-3 hours | HIGH | Low |
| A7: Finance/E-Money tab info banners | 30 min | LOW | Zero |
| A6: Role system (add Manager/observer) | 2-3 hours | MEDIUM | Low |
| **Total** | **~11-14 hours** | | |

**Execution order:** A5 → A3 → A4 → A1 → A2 → A7 → A6

Rationale: Start with quick, zero-risk string/CSS changes (A5, A3, A4) to show immediate progress. Then do the structural changes (A1, A2). Role system (A6) last because it needs the most thought.

---

## Stream B: PDF Attachment Support

### Problem

Win's team attaches PDF files to emails → pipeline errors. Our vision nodes only accept image formats (PNG, JPG, JPEG). PDF is not an image.

**From Teams chat (Win):** "bên Win test bả nói em là attach PDF vô báo lỗi á chị"
**DK committed:** "Để em kiểm tra lại pdf, có thể là api call không nhận pdf. Chỉnh lại prompt."

### Technical Analysis

**Two places need PDF support:**

1. **n8n Pipeline (email attachments)** — when Gmail receives an email with a PDF attached, the pipeline needs to handle it
2. **Vercel API (`api/extract-employees.js`)** — when user manually uploads a PDF via the dashboard

**The challenge:** Vision AI APIs (Groq, Claude, Gemini, etc.) accept images, not PDFs. We need to convert PDF → image before sending to vision.

### Option A: PDF-to-Image in n8n Pipeline

**How n8n handles email attachments:**
- Gmail Trigger node receives attachments as binary data
- Currently, the pipeline takes the attachment binary, base64-encodes it, and sends to Groq Vision as `data:image/png;base64,...`
- For PDF: need to render PDF page(s) to PNG first

**n8n approach:**
- Use n8n's built-in binary operations or a Code node to convert PDF → PNG
- Libraries available in n8n Cloud sandbox: limited. May need to use an external service.
- **Alternative:** Use the LLM's native PDF support if available:
  - Claude 3.5 Sonnet: supports PDF natively (via Bedrock or direct API)
  - Gemini: supports PDF natively
  - Groq (current): does NOT support PDF
  - This is another argument for switching to enterprise AI sooner

**Simplest approach for now (Groq):**
1. In the n8n Vision Process node, detect if attachment is PDF (check MIME type or filename extension)
2. If PDF: use a free PDF-to-image API service, or use `pdf.js` in a Code node to render page 1 to PNG
3. Then send the PNG to Groq Vision as before

**Note:** Once we move to Claude or Gemini (which support PDF natively), this conversion step becomes unnecessary. So this is a temporary fix for Groq.

### Option B: PDF-to-Image in Vercel API

For `api/extract-employees.js` (manual upload):
1. Accept PDF uploads (add `application/pdf` to allowed types)
2. Use `pdfjs-dist` (Mozilla's PDF.js for Node.js) to render page 1 to PNG
3. Send the PNG to Groq Vision as before

**Alternative:** Use `pdf-parse` to extract text directly from typed PDFs (skip vision entirely for digital PDFs). Handwritten/scanned PDFs still need vision.

### Recommended Approach

**Phase 3.1 (now, Groq):** Implement PDF-to-image conversion as a temporary bridge.
- n8n: detect MIME type, convert PDF → PNG in Code node (if sandbox allows)
- Vercel: add `pdfjs-dist` dependency, convert before API call
- Dashboard: add `.pdf` to upload zone accepted file types

**Phase 4 (enterprise AI):** Claude and Gemini both support PDF natively. Remove the conversion code.

### Important Caveat

PDF-to-image conversion in n8n Cloud's sandboxed Code node is uncertain. The sandbox may not have canvas/image rendering libraries. If this doesn't work in n8n Cloud, the fallback is:

1. **Skip PDF in pipeline for now** — tell Win's team to convert PDF to PNG before sending (manual workaround)
2. **Support PDF in manual upload only** (Vercel has more library support)
3. **Wait for enterprise AI** (Claude/Gemini handle PDF natively)

This is honest: PDF support on Groq free tier in n8n Cloud is a workaround, not a solution. The real fix is enterprise AI.

**Effort:** 3-4 hours (including testing)
**Risk:** Medium — PDF rendering in serverless environments can be tricky
**Files:** `pipelines/n8n-workflow-v4.json`, `api/extract-employees.js`, `index.html` (upload zone accept types)

---

## Stream C: Enterprise AI Platform Comparison

### Deliverable

A formal comparison document that Rita can review with the incoming chief architect. This is not just a table — Rita explicitly asked for "pros and cons, cost analysis."

### Document: `docs/Enterprise_AI_Platform_Comparison.md`

**Platforms to assess:**

| # | Platform | Why Include |
|---|----------|-------------|
| 1 | **AWS Bedrock** | Rita's preference, Zaya procurement path |
| 2 | **Google Vertex AI** | Win's Gemini preference, Myanmar handwriting |
| 3 | **Microsoft Azure AI** | Enterprise standard, Azure AD integration |
| 4 | **Alibaba Cloud AI** | Rita mentioned, Myanmar market proximity |
| 5 | **Direct Enterprise APIs** | OpenAI, Claude, Gemini enterprise tiers (baseline) |

**Evaluation dimensions:**

1. **Security & Compliance**
   - SOC 2 Type II certification
   - Data residency options (APAC)
   - Financial services audit readiness
   - Data handling: is user data used for training? (consumer vs enterprise)
   - Encryption at rest and in transit

2. **Model Availability**
   - Text extraction models available
   - Vision/OCR models available
   - Myanmar language support (critical)
   - Handwriting recognition capability

3. **Myanmar Handwriting OCR** (the killer requirement)
   - Which models handle Myanmar script?
   - Handwriting vs typed accuracy
   - Need real test data to validate — Stream D provides the test framework
   - Win's claim: "Gemini is more adapted on the handwriting feature"

4. **Cost Analysis**
   - Per-token pricing (input/output)
   - Vision API pricing (per image)
   - Monthly minimums / commitments
   - Estimated monthly cost for our volume (~100-500 emails/month, each with 1-2 image attachments)

5. **Integration Effort**
   - API format compatibility with our pipeline
   - Auth mechanism (Bearer token vs SigV4 vs OAuth)
   - n8n integration options (native node vs HTTP Request)
   - SDK availability for Vercel serverless
   - PDF native support (critical — eliminates Stream B workaround)

6. **Procurement**
   - Can be purchased through Zaya? (Rita's requirement)
   - Payment methods (credit card vs invoice vs enterprise agreement)
   - Setup time estimate

7. **Region & Latency**
   - Available regions (APAC important for Myanmar)
   - Latency from Myanmar
   - Any country-specific restrictions (Groq is blocked in Myanmar)

### The Gemini-Bedrock Tension

This is the key strategic decision the document must address honestly:

- **Win says Gemini** is best for Myanmar handwriting
- **Rita says Bedrock** is the platform she trusts
- **Fact: Gemini is NOT on Bedrock** (confirmed in Teams chat: "à mà Bedrock ko có model Gemini nha mn")

**Resolution framework:**
1. Test Claude 3.5 Sonnet (on Bedrock) vs Gemini Flash (on Vertex AI) on identical Myanmar samples
2. Use Stream D's bilingual Culture Survey as the test data set — built-in answer key
3. If Claude accuracy is "good enough" (>85%) → Bedrock only (simpler architecture)
4. If Gemini significantly outperforms → need multi-cloud or Vertex AI only
5. Let data decide, not assumptions

**DK's role:** Prepare the test methodology (Stream D) and sample set. When API keys arrive, run the comparison. Include actual accuracy numbers in the comparison doc.

### Effort
- Research + writing: 4-6 hours
- Testing (when API keys available): 2-3 hours per platform
- **Total deliverable:** 1-2 days

### Output
- `docs/Enterprise_AI_Platform_Comparison.md` — formal comparison document
- Test results appendix (when data available from Stream D)

---

## Stream D: Myanmar OCR Validation Framework (Minh's Strategy)

### Origin

Post-meeting conversation between DK and Minh. Minh proposed a two-level validation approach to rigorously test Myanmar OCR accuracy before committing to an AI provider.

### Level 1: Automated Cross-Validation (Bilingual Culture Survey)

**Concept:** Yoma/Wave's Culture Survey has bilingual questions — each question exists in both English and Myanmar. This creates a natural "answer key" for OCR validation.

**How it works:**
1. Feed the Myanmar text (from the PDF) through the AI pipeline
2. AI extracts/reads the Myanmar text
3. Compare AI's interpretation against the known English text on the same form
4. If they match → AI correctly read and understood the Myanmar script
5. Calculate accuracy: "AI got X out of 47 questions correctly" = Y% accuracy

**Test data available:**

| File | Location | Status |
|------|----------|--------|
| `YFS_Culture_Survey_Bilingual_Mar2026.pdf` | `research/real_samples/culture_survey_bilingual/` | **Ready** — 278 KB, Myanmar Unicode confirmed present |
| `YFS_Culture_Survey_Bilingual_Mar2026.csv` | `research/real_samples/culture_survey_bilingual/` | **Degraded** — Myanmar characters lost during CSV export (shows as `???`). Use PDF only for OCR testing. CSV useful as English-side reference/answer key. |

**Data structure (47 statements + 2 open questions + 3 demographics):**

| Category | Questions | Type |
|----------|-----------|------|
| Camaraderie | Q1-Q8 (8 statements) | Bilingual (EN + MM) |
| Credibility | Q9-Q17 (9 statements) | Bilingual (EN + MM) |
| Fairness | Q18-Q25 (8 statements) | Bilingual (EN + MM) |
| Pride | Q26-Q35 (10 statements) | Bilingual (EN + MM) |
| Respect | Q36-Q46 (11 statements) | Bilingual (EN + MM) |
| Uncategorized | Q47 (1 statement) | Bilingual (EN + MM) |
| Open-ended | 2 questions | Bilingual (EN + MM) |
| Demographics | 3 questions (org, tenure, role) | Bilingual (EN + MM) |

**Why this data is safe for consumer AI:**
- Culture survey questions are NOT financial data
- No bank accounts, salaries, MSISDNs, or employee PII
- This is a company engagement survey — the questions are generic HR content
- Rita's consumer-AI concern does not apply to this data

**Why this is powerful:**
- **Built-in answer key** — no human judgment needed to verify accuracy
- **Real Myanmar text** — written by actual Myanmar speakers, not fabricated by Grok
- **Quantifiable** — "94% accuracy on printed Myanmar text" is a concrete metric
- **Reusable** — run the same test on every AI provider (Groq → Claude → Gemini) for apples-to-apples comparison
- **Feeds directly into Stream C** — the Enterprise AI Comparison doc can include actual accuracy numbers, not just documentation claims

**Honest limitations:**
- Culture survey text is **printed/typed**, not handwritten. Tests OCR on clean text, not messy handwriting.
- Survey language is **formal, structured**. Real bank slips have informal shorthand, abbreviations, numbers mixed with text.
- Still extremely valuable as a **baseline**. If AI can't read printed Myanmar, handwriting is hopeless.

### Level 2: Human Validation (Win as Domain Expert)

**Concept:** Win (Myanmar ops) uses the actual demo system to test with real/realistic Myanmar handwriting and validates the extraction results using her domain expertise.

**How it works:**
1. DK builds handwriting OCR capability (using fabricated handwriting data — safe for consumer AI)
2. Win tests the system with handwritten Myanmar documents
3. Win validates: Did the AI extract correctly? Is the meaning preserved? Are names/numbers right?
4. Win reports accuracy issues → DK tunes prompts

**Why Win is the right validator:**
- She reads Myanmar natively
- She knows the banking terminology and document formats
- She knows what "ugly handwriting" looks like in real Myanmar bank operations
- She's already using the system (just not the latest version)

**Sequencing:**
```
Level 1 (Now — no blockers)              Level 2 (After handwriting upgrade)
Culture Survey PDF → Pipeline →           Win tests with handwriting samples →
Compare AI output vs English text →       Win validates extraction accuracy →
Accuracy score per AI provider →          Win reports errors →
Feed into Stream C comparison doc         DK tunes prompts based on Win's feedback
```

**Blockers for Level 2:**
- Fabricated handwriting samples need to be created first (DK + Grok)
- Enterprise AI may be needed for better handwriting OCR (blocked on credentials)
- Win needs to access the latest version of the dashboard

### Implementation Tasks

| # | Task | Effort | Blocker | Level |
|---|------|--------|---------|-------|
| D1 | Build OCR accuracy test prompt — "Read Myanmar text, provide English translation, compare against known answer" | 1-2 hours | None | 1 |
| D2 | Run Culture Survey PDF through Groq pipeline, record results | 1 hour | None | 1 |
| D3 | Run Culture Survey PDF through Claude (when Rita's API key arrives) | 1 hour | Claude API key | 1 |
| D4 | Run Culture Survey PDF through Gemini (when available) | 1 hour | Gemini API key | 1 |
| D5 | Compile accuracy comparison table (Groq vs Claude vs Gemini on same data) | 1 hour | D2 + D3/D4 | 1 |
| D6 | Create fabricated Myanmar handwriting test data (Grok) | 1-2 hours | None | 2 prep |
| D7 | Win tests system with handwriting samples, provides feedback | Win's time | D6 + system upgrade | 2 |
| D8 | DK tunes prompts based on Win's feedback | 1-2 hours | D7 | 2 |

**Total effort (DK):** ~6-8 hours across both levels
**Output:** Accuracy data that makes Stream C's comparison doc evidence-based, not speculation-based

---

## Execution Schedule

### Day 1 (April 8): Quick Wins + Validation Baseline

| Time | Task | Stream |
|------|------|--------|
| Morning | A5: Language/label cleanup | A |
| Morning | A3: Color-coded badges (red for mismatch) | A |
| Midday | A4: Collapsible sections in modal | A |
| Afternoon | A7: Finance/E-Money info banners | A |
| Afternoon | D1: Build OCR accuracy test prompt | D |
| Afternoon | D2: Run Culture Survey PDF through Groq | D |
| **Result** | Dashboard looks less technical + first OCR baseline data | |

### Day 2 (April 9): Structural UX

| Time | Task | Stream |
|------|------|--------|
| Morning | A1: Merge employee table + upload + submit into ticket modal | A |
| Afternoon | A2: Mismatch flow logic (return to client action) | A |
| **Result** | Linear flow works: click ticket → see everything → act | |

### Day 3 (April 10): PDF + Research

| Time | Task | Stream |
|------|------|--------|
| Morning | B: PDF support investigation + implementation (Vercel API first) | B |
| Afternoon | C: Enterprise AI comparison (start research + writing) | C |
| Afternoon | D6: Create fabricated Myanmar handwriting samples | D |
| **Result** | PDF upload works (at least manual), comparison doc started, test data created | |

### Day 4 (April 11): Finish + Polish

| Time | Task | Stream |
|------|------|--------|
| Morning | C: Complete Enterprise AI comparison document (include D2 baseline data) | C |
| Afternoon | A6: Role system (Manager/observer role) | A |
| Evening | Final testing, push to Vercel | All |
| **Result** | All deliverables ready for next demo/review | |

### Buffer

- Day 5 (April 12): Internal meeting transcript review (refine Minh's points), any fixes from testing, D3/D4 if Claude/Gemini API keys arrive

---

## Dependencies & Blockers

| Dependency | Status | Impact | Workaround |
|------------|--------|--------|------------|
| Rita's Claude API key | Waiting (Vinh) | Blocks D3 (Claude OCR test) | Groq baseline (D2) still provides value |
| Bedrock account setup | Waiting (Vinh + Zaya procurement) | Blocks Phase 4 integration | Not needed for Phase 3.1 |
| Win's real Myanmar samples | Waiting (Win) | Blocks Level 2 validation (D7) | Level 1 with Culture Survey provides baseline |
| Internal meeting transcript | DK will provide | May refine Minh's feedback details | Plan already incorporates DK's summary |
| PDF rendering in n8n Cloud sandbox | Unknown | May need to defer pipeline PDF to Phase 4 | Vercel API + manual workaround |
| Culture Survey PDF Myanmar rendering | Confirmed (Myanmar Unicode present) | None — ready to use | — |

---

## What This Phase Delivers

| Deliverable | For Whom | Value |
|-------------|----------|-------|
| Simplified dashboard UX | Minh, Rita, Win, Myanmar ops | Non-technical users can navigate without confusion |
| Mismatch flow (return to client) | Rita, Myanmar Finance | Correct business logic — bank doesn't fix client's errors |
| Collapsible detail sections | All users | Progressive disclosure — simple by default, detailed on demand |
| User-friendly language | All users | No n8n, Groq, MSISDN, llama references in UI |
| Color-coded ticket badges | All users | Red = problem, green = good, amber = warning — instant understanding |
| PDF upload support | Win's team | Unblocks their testing with PDF attachments |
| Enterprise AI comparison | Rita, chief architect | Informed platform decision with cost analysis |
| Manager/observer role | Rita, Win (demo) | Can view everything without breaking Maker-Checker principle |
| OCR accuracy baseline | Rita, chief architect | Evidence-based AI provider comparison, not speculation |
| Myanmar validation framework | Minh, DK, Win | Reusable test methodology for any future AI provider switch |

---

## What This Phase Does NOT Do

| Not Included | Why | When |
|--------------|-----|------|
| Enterprise AI integration (Bedrock/Vertex) | Blocked on credentials | Phase 4 |
| Real Myanmar handwriting testing with enterprise AI | Blocked on samples + enterprise AI | Phase 4 |
| Supabase database migration | Needs architecture decision | Phase 4 |
| File splitting (index.html → modules) | Not urgent (file at ~2,540 lines, threshold ~4,000) | Phase 4 |
| Internal Wave email integration | Needs Alex CIO coordination | Phase 5 (production) |
| Production authentication | Needs Supabase + proper auth | Phase 5 |
| Reversals, Block/Unblock (Rita Phases 7-9) | Production-only features | Phase 6+ |

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Minh's feedback changes after transcript review | Medium | Low | DK will share transcript; plan can be adjusted quickly since Day 1 is zero-risk changes |
| PDF rendering fails in n8n Cloud sandbox | Medium | Medium | Fall back to manual convert + Vercel API only. Enterprise AI (Phase 4) handles PDF natively. |
| Rita's comparison expectations are higher than what we can deliver without API keys | Low | Medium | Include Stream D baseline data. Clearly state: "Full test results pending API access." |
| Employee table in modal makes modal too long | Low | Low | Make it collapsible (A4), show first 5 rows with expand button |
| Role system breaks existing demo flow | Low | Low | Default to Manager role, keep existing 3 roles working |
| Culture Survey PDF Myanmar text not extractable by current pipeline | Medium | Low | This IS the test — if Groq can't read it, that's a valid data point for the comparison doc |
| CSV Myanmar data is corrupted (shows as ???) | **Resolved** — UTF-8 re-export has all 5,089 Myanmar chars intact | None | UTF-8 CSV is now the full bilingual answer key for automated comparison. Original CSV kept as English-only backup. |

---

## Alignment with Long-Term Direction

| Direction | This Phase | Future |
|-----------|-----------|--------|
| **Rita: Enterprise AI security** | Comparison doc prepares the decision. OCR baseline provides evidence. | Phase 4: integrate Bedrock/Vertex |
| **Rita: Non-technical demos** | UX cleanup, no jargon, collapsible detail | Ongoing standard |
| **Rita: "Don't be technical"** | Remove n8n, Groq, model names from UI | Ongoing standard |
| **Minh: User-centric design** | Collapsible sections, linear flow, plain language | Phase 5: proper UX design with real user testing |
| **Minh: Correct business logic** | Mismatch → return to client, not fix for them | Aligns with Rita's 9-phase workflow |
| **Minh: Two-level validation** | Culture Survey baseline + Win human validation framework | Reusable for every AI provider switch |
| **Win: Myanmar compatibility** | PDF support, Gemini included in comparison, Culture Survey OCR test | Phase 4: enterprise AI with Myanmar OCR |
| **Vinh: Dashboard simplification** | Ticket modal has everything, less tab-switching | Phase 5: potential single-page design |
| **DK: Career positioning** | Produces client-facing comparison doc with real data, shows business + technical skill | High-visibility deliverable for Rita and incoming chief architect |

---

## Files to Modify

| File | Changes | Stream | Risk |
|------|---------|--------|------|
| `index.html` | All UX changes (A1-A7) | A | Low — UI only |
| `api/extract-employees.js` | PDF upload support | B | Medium |
| `pipelines/n8n-workflow-v4.json` | PDF handling in vision nodes (if feasible) | B | Medium |
| `docs/Enterprise_AI_Platform_Comparison.md` | NEW — comparison document | C | Zero |
| `research/real_samples/culture_survey_bilingual/` | Test data + results | D | Zero |

**v3 pipeline untouched.** Always.

---

## Test Data Inventory

| File | Location | Purpose | Myanmar Unicode? |
|------|----------|---------|-----------------|
| `YFS_Culture_Survey_Bilingual_Mar2026.pdf` | `research/real_samples/culture_survey_bilingual/` | Level 1 OCR validation — primary test source (vision AI reads this) | **Yes** (confirmed) |
| `YFS_Culture_Survey_Bilingual_Mar2026_UTF8.csv` | `research/real_samples/culture_survey_bilingual/` | **Full answer key** — 52 rows, 5,089 Myanmar chars, both EN + MM text intact. Use for automated comparison. | **Yes** (UTF-8 BOM, verified) |
| `YFS_Culture_Survey_Bilingual_Mar2026.csv` | `research/real_samples/culture_survey_bilingual/` | Degraded export (Myanmar chars → `???`). English-only reference. | No (corrupted) |
| `payroll_demo_12emp.jpg` | `samples/` | Demo image — Pacific Star, 12 employees | N/A (English) |
| `PyiGyiKhin.pdf` | `research/real_samples/` | Real Myanmar bank document | Yes |
| Fabricated handwriting samples | `research/real_samples/` (to be created) | Level 2 validation — handwriting OCR test | TBD |

---

## Phase Map (Where We Are)

```
Phase 1: Basic Dashboard + CSV Generation .............. DONE
Phase 2: UI/UX Enhancement + AI Pipeline Showcase ...... DONE
Phase 3: AI Document Extraction (employee list) ........ DONE (Apr 7 demo)
Phase 3.1: UX Quick Wins (overnight Apr 7-8) ........... See ImplementationPlan_Phase3.1.md
Phase 4: UX + Enterprise AI + Myanmar OCR .............. THIS PLAN (Apr 8-12)
Phase 5: Production Readiness (auth, DB, Wave email) ... FUTURE
Phase 6+: Reversals, Block/Unblock, Full Rita Phases ... FUTURE
```
