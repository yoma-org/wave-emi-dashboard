# AI Council Synthesis — Phase 3.1 Plan Review

**Date:** April 7, 2026
**Respondents:** 6 AIs (Claude, GPT, Gemini, Grok, DeepSeek, Perplexity)
**Reviewed by:** Claude (final decision-maker)
**Input:** `docs/ImplementationPlan_Phase3.1.md`

---

## Overall Verdict

**The plan is safe to deploy.** All 6 councils validate the core architecture. No showstopper risks. Adjustments below improve safety and demo quality.

| AI | Overall Rating | Key Contribution |
|---|---|---|
| **Claude** | "Solid but over-scoped" | Detailed execution order fix, Myanmar accuracy table, best fake payroll prompt |
| **GPT** | Same as Claude session | Confirmed safety, reorder PDF safety earlier |
| **Gemini** | "Solid, hidden Vercel trap" | **Caught 4.5MB payload limit** — use JPEG not PNG. OCR ≠ translation methodology flaw |
| **Grok** | "Excellent, deploy with confidence" | Most optimistic. Best image gen prompt. Realistic time estimate (7-8 hrs). MIME type edge case (octet-stream) |
| **DeepSeek** | "Overly ambitious for 1 person" | **Don't collapse AI Analysis** — it's core value. pdfjs-dist server-side will fail. 2-3 day sprint estimate |
| **Perplexity** | "Well-structured, moderate risk" | n8n community node exists (n8n-nodes-pdfconvert). Groq-ocr converts PDF. Claude 3.5 best for multilingual |

---

## Consensus Matrix (6/6 AIs Agree)

These are confirmed truths. No debate.

| Point | Consensus | Plan Action |
|-------|-----------|-------------|
| Groq will struggle on Myanmar handwriting | 10-30% accuracy (most AIs), Grok says 35-65% | Expect partial/failure. Prepare narrative. |
| n8n Cloud cannot convert PDF | No canvas/sharp/poppler in sandbox | **Drop Layer 3b entirely.** Layer 3a (detect + flag) only. |
| Client-side PDF.js via CDN = correct | Universal agreement | Proceed as planned |
| Label cleanup is correct and necessary | Universal | Proceed |
| "Return to Client" needs better banking term | 5 of 6 suggest alternatives | Use **"Return for Correction"** |
| Culture Survey methodology is smart | Universal validation | Proceed |
| P4 = cut first if behind | Universal | Don't attempt unless everything else done |
| Zawgyi vs Unicode = real production risk | 5 of 6 flag | Note for demo, not a tonight fix |
| Groq Vision does NOT accept PDF | Universal | Image conversion is mandatory |

---

## Key Disagreements & Rulings

### 1. Collapse AI Pipeline Analysis by Default?

| AI | Position |
|---|---|
| Claude, GPT, Gemini, Grok, Perplexity | **Yes, collapse** — technical details overwhelm non-tech users |
| **DeepSeek** | **No** — "This is the core value. Users need to see it to trust it." |

**My ruling:** DeepSeek makes a valid point. The compromise:
- **Keep Amount Verification visible** (the trust signal — "AMOUNT VERIFIED" or "AMOUNT MISMATCH")
- **Collapse** the detailed AI cards (model names, confidence bars, email headers)
- User sees the result immediately, detail is one click away
- This satisfies both Minh's "collapse detail" request AND DeepSeek's "show core value" concern

### 2. Execution Order: P0 vs P1 First?

| AI | Position |
|---|---|
| Claude, GPT, DeepSeek, Perplexity | P0 (handwriting) first |
| **Gemini** | **P1 (Culture Survey) first** — "secure the win, don't get bogged down fabricating images" |
| **Grok** | P0 first but "images already exist" |

**My ruling:** Grok is right — DK already has the Grok-generated handwriting images. P0 is now just "send email + document results" (30 min). But Gemini's concern is valid in general. **Do P0 and P1 in parallel**: send the handwriting email, and while waiting for pipeline (~30 sec), start preparing the Culture Survey test.

### 3. Scoring: Character-Level vs Semantic Match?

| AI | Position |
|---|---|
| Claude (session), GPT | Character-level primary, semantic secondary |
| **Gemini** | **Critical insight:** "conflates OCR capability with translation capability" |
| DeepSeek | Character Error Rate (CER) as primary |
| Grok | Semantic match as headline, character-level as appendix |
| Perplexity | Semantic + CER |

**My ruling:** Gemini identified a real methodology flaw. The fix:
- Prompt the AI to output **both** raw Myanmar text AND English translation
- **Headline metric:** Semantic match on translation (X of 47 correctly interpreted)
- **Technical metric:** Character-level comparison on raw Myanmar extraction (if time allows)
- For the demo, semantic match is what Rita and Myanmar ops understand

### 4. Time Estimate

| AI | Estimate |
|---|---|
| Claude (session) | 8-10 hours |
| GPT | Implicit agreement with Claude |
| Gemini | "8-9 hours highly optimistic" |
| **Grok** | **7-8 hours realistic** |
| **DeepSeek** | "2-3 day sprint for one person" |
| Perplexity | Not specified |

**My ruling:** DeepSeek doesn't account for AI-assisted coding. Grok does. With Claude Max doing the UI/UX coding, **6-7 hours actual** is realistic. DK was right about compression. But build in buffer — if anything takes >1.5x timebox, skip it.

### 5. "Return to Client" Terminology

| AI | Suggestion |
|---|---|
| Claude (session) | "Return for Correction" (best balance) |
| Gemini | "Return for Correction" / "Reject - RFI" / "Query with Sender" |
| **Grok** | **"Return to Requester"** — cleanest for Maker-Checker |
| DeepSeek | "Reject (Return to Client)" |

**My ruling:** Use **"Return for Correction"** — it's the most professional and multiple AIs converged on it. "Requester" (Grok) is also good but "Correction" implies the client needs to fix something, which is the actual intent.

---

## Unique Insights (Not in Original Plan)

### From Gemini: Vercel 4.5MB Payload Trap

**Critical catch.** When rendering PDF to canvas and exporting as base64 PNG, the file can exceed Vercel's 4.5MB body limit. Fix: use `canvas.toDataURL('image/jpeg', 0.8)` instead of PNG. JPEG compression keeps it under 3MB while maintaining OCR quality.

**Action:** Implement in P2 Layer 2 code.

### From Gemini: OCR ≠ Translation Methodology

**Important.** The AI might read Myanmar perfectly but translate differently than the CSV. This would create false "failures." Fix: ask AI for raw Myanmar text + translation separately.

**Action:** Update Culture Survey test prompt.

### From Grok: MIME Type Edge Case

Gmail sometimes sends attachments as `application/octet-stream` instead of `application/pdf`. The pipeline MIME detection must check both, plus filename extension.

**Action:** In Layer 3a, check `attachment_mime.includes('pdf') || attachment_filename.endsWith('.pdf')`.

### From Grok: Client-Side Resize Before API

After PDF→PNG conversion, add a resize step (max 2000px width) to keep base64 size manageable.

**Action:** Add canvas resize in P2 Layer 2.

### From DeepSeek: Don't Collapse Core Value

The AI Pipeline Analysis section IS the product demo. Hiding it makes the modal look empty. Keep the result visible, collapse only the technical details.

**Action:** Adjusted collapsible strategy (see ruling #1).

### From DeepSeek: pdfjs-dist Server-Side Will Fail

Confirmed that `pdfjs-dist` in Node.js serverless expects browser globals (`DOMMatrix`, `ImageData`). Will crash. Our client-side approach avoids this entirely.

**Action:** Already planned correctly. No change needed.

### From Perplexity: n8n Community Node Exists

`n8n-nodes-pdfconvert` (pdf2pic + GraphicsMagick) handles PDF-to-image in n8n. Could be useful for Phase 4 but too risky for overnight.

**Action:** Note for Phase 4, not tonight.

### From Claude (Session): Myanmar Accuracy Expectations

| Model | Printed Myanmar | Handwriting Myanmar |
|---|---|---|
| Llama-4-scout (Groq) | 50-70% | **10-30%** |
| GPT-4o | 70-85% | 30-50% |
| Gemini Flash | 75-90% | **40-60% (best)** |
| Claude 3.5 Sonnet | 80-90% | 35-55% |

Grok was more optimistic: Groq printed 75-85%, handwriting 35-65%. Truth likely in the middle.

**Key:** Gemini is consistently rated best for Myanmar. This supports Win's recommendation and creates useful data for the Enterprise AI comparison doc (Phase 4).

---

## Final Adjusted Plan

Based on council synthesis, here are all changes to the Phase 3.1 plan:

| # | Change | Source | Risk Impact |
|---|--------|--------|-------------|
| 1 | **Drop n8n PDF conversion (Layer 3b) entirely** | All 6 AIs | Eliminates highest-risk item |
| 2 | **Use JPEG (0.8 quality) not PNG for PDF canvas export** | Gemini | Prevents Vercel 4.5MB payload failure |
| 3 | **Add client-side resize (max 2000px width) before API** | Grok | Prevents large base64 issues |
| 4 | **"Return to Client" → "Return for Correction"** | Claude, Gemini, GPT, Grok | Correct banking terminology |
| 5 | **Culture Survey: ask for raw Myanmar text + English translation** | Gemini | Separates OCR accuracy from translation accuracy |
| 6 | **Keep Amount Verification visible, collapse AI detail cards only** | DeepSeek compromise | Shows core value while reducing overwhelm |
| 7 | **PDF.js: add try/catch + "Upload as image" fallback** | Claude (session), Grok | CDN failure protection |
| 8 | **Pipeline MIME check: include octet-stream + filename extension** | Grok | Edge case coverage |
| 9 | **Semantic match as demo headline, CER as technical appendix** | Gemini, Grok, DeepSeek | Better accuracy reporting |
| 10 | **PDF.js CDN: add loading indicator + manual fallback button** | Grok | Slow Myanmar connections |

---

## What The Councils Validated (No Changes Needed)

- Label cleanup (all terms correct)
- Tab rename "Incoming Emails" → "Ticket List" (all approve)
- Collapsible toggle CSS/JS pattern (all approve — just isolate class names)
- Client-side PDF.js architecture (universal approval)
- Pipeline Layer 3a: MIME detection + flag (universal approval)
- "All three outcomes are demoable" framing for handwriting OCR
- Checkpoint deployment strategy
- Stop rule (>1.5x timebox → skip)
- Fallback: revert to Phase 3 if everything breaks

---

## Demo Script Suggestions (Best From Councils)

### For Rita (10:00 AM)

From Gemini:
> "We stress-tested the current consumer-grade open-source AI with Myanmar handwriting. As expected, it struggled. This is exactly why Rita was right to suggest an enterprise AI assessment. Consumer tools handle English and printed text fine, but for the complex, localized reality of Wave Money's operations, we need to unlock enterprise models like Claude or Vertex."

### For Myanmar Ops (10:30 AM)

From Gemini:
> "Normally, your team would have to read the email, open the attachment, and type this into a spreadsheet. The system has already drafted it for you. You just have to check the amounts and click approve."

From Grok:
> "Consumer AI can already read some Myanmar handwriting — but not perfectly. This is exactly why we're moving to enterprise-grade AI. The gap we're seeing today is the business case for the investment."

---

## Council Reliability Assessment

| AI | Accuracy | Depth | Actionable? | Notes |
|---|---|---|---|---|
| **Claude** | High | Very deep | Very actionable | Best on execution order and Myanmar accuracy table |
| **GPT** | High | Deep | Very actionable | Same session as Claude, similar quality |
| **Gemini** | High | Deep | **Most actionable** | Caught Vercel payload trap + OCR/translation methodology flaw — 2 unique critical insights |
| **Grok** | High | Deep | Very actionable | Best image gen prompt, most realistic time estimate, MIME edge case, "deploy with confidence" verdict |
| **DeepSeek** | Medium-High | Medium | Partially actionable | "Don't collapse core value" is the best contrarian insight. Time estimate too pessimistic. |
| **Perplexity** | Medium | Brief | Somewhat actionable | n8n community node info useful for Phase 4. Otherwise summarized others' points. |

**Best council members this round:** Gemini (critical catches), Grok (most practical), Claude (deepest analysis).
