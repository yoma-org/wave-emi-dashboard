# Demo Guide — Tuesday April 7, 2026 (Rita In-Person)

**Duration:** ~15 min demo + 10 min discussion
**Presenter:** DK
**Audience:** Rita (client), Win (Myanmar ops), Trustify team

---

## Pre-Demo Setup (5 min before)

1. **Ctrl+Shift+R** on dashboard to clear old data
2. Open 3 browser tabs:
   - Tab 1: `mermaid.live` with sequence diagram pasted
   - Tab 2: `wave-emi-dashboard.vercel.app` (empty, fresh)
   - Tab 3: Gmail (compose window ready with Pacific Star email + attachment)
3. Have `samples/payroll_demo_12emp.jpg` on desktop (manual upload fallback)

---

## Demo Flow

### Part 1: Sequence Diagram (2 min)

Switch to mermaid.live tab. Show the numbered flow.

> "Before I show the live system, let me walk you through the end-to-end flow. Each step is numbered so we can reference them precisely."

Walk through:
- Steps 1-3: Email arrives → AI extracts text + reads attachment
- Step 4: Employee list extracted automatically
- Step 5: Validation (phones, names, amounts)
- Step 6-7: Finance approval → file generation

> "Rita, does this match the flow you described? Any steps we should adjust?"

**Wait for Rita's feedback.** Note any corrections.

---

### Part 2: Live Email — Pacific Star (5 min) — THE MAIN DEMO

Switch to Gmail tab.

> "Now let me show this working live. I'm sending an email right now — a salary disbursement request from Pacific Star Garment Factory with a payroll document attached."

**Send the email.** Switch to dashboard tab.

> "Let's wait about 30 seconds for the AI pipeline to process..."

**Refresh dashboard after ~30 sec.** Click the ticket.

**Show the AI Pipeline Analysis cards:**
> "The AI read the email AND the attachment. Left card — what the text AI extracted from the email body: company name, amount, type, approvers. Right card — what the vision AI read from the attached document: document type, amount, signer, depositor name, remark."

**Point to the green CROSS-VALIDATION PASSED box:**
> "The system cross-validated — the email says 4,850,000 and the document shows 4,850,000. Amounts match."

**Point to Finance fields (depositor, remark, transaction ID):**
> "These are the fields your Finance team told us they need — depositor name, remark, transaction ID. Extracted automatically."

**Switch to Incoming Emails page. Show the n8n ticket card:**
> "Now look at the employee list. The AI read 12 employees from the payroll image — names, phone numbers, amounts. All extracted automatically. No human typed any of this."

**Point to the employee table:**
> "Our system automatically cleaned the Myanmar name prefixes — 'U Aung Min' becomes 'Aung Min', 'Daw Mya Mya' becomes 'Mya Mya'. Every phone number is validated. Green means valid format, red means needs correction."

**Point to the Amount Reconciliation:**
> "Three-way match — email amount vs document amount vs employee total. If anything doesn't add up, the system flags it here. Sales can go back to the client before Finance ever sees it."

**Key line:**
> "AI does the data entry. Human does the review. That's the principle."

---

### Part 3: Amount Mismatch Demo — ACME (3 min) — OPTIONAL BUT POWERFUL

If time allows and the audience is engaged:

> "Let me show you what happens when there IS a problem."

Show the ACME ticket (already in the dashboard from earlier test). Click it.

> "This one — the email says 25 million MMK, but the document shows 24,500. The system caught a 99.9% discrepancy and flagged it as AMOUNT MISMATCH. The badge turns yellow, the risk level goes to HIGH."

**Point to the yellow AMOUNT MISMATCH box:**
> "Without this system, a human would have to open the bank slip, manually compare the numbers, and hope they don't miss it. Our AI does it in seconds."

---

### Part 4: No-Attachment Scenario (1 min)

> "What about emails without attachments? The text AI still parses everything — company, amount, approvers. The employee list becomes a manual upload step. The system handles both scenarios."

---

### Part 5: Manual Override (30 sec)

> "If the AI got something wrong, or the client sends a corrected file later, the user can still upload a CSV, Excel, or even another image to override. The system accepts any format."

---

## Discussion Points (10 min after demo)

### 1. Ask Rita: Flow Validation

> "Rita, does this match the pre-check flow you described? Are there steps we're missing?"

Note her feedback for Phase 3.1.

### 2. Ask Rita/Win: Sample Data

> "To improve accuracy, we need real sample documents from the Myanmar team — actual bank slips, payroll files, even handwritten ones. Can Win prioritize getting these to us?"

### 3. AI Provider Decision (Vinh's item #1)

> "For production, we need to switch from our free-tier AI to enterprise. Rita mentioned three options: OpenAI, AWS Bedrock, and Gemini. Based on our testing:"

| Provider | Best for | Cost | OCR Quality |
|----------|---------|------|-------------|
| **OpenAI GPT-4o** | Best table/document OCR | Medium ($) | Highest accuracy |
| **Gemini Flash** | Good OCR, cheapest | Low ($) | Good, Tracy prefers this |
| **AWS Bedrock** | Enterprise security + multiple models | Higher ($$) | Access to Claude + others |

> "Our recommendation: start with **Gemini Flash** for cost efficiency. If accuracy isn't sufficient on real Myanmar documents, upgrade to **GPT-4o**. AWS Bedrock is the right choice when you need enterprise-grade security compliance."

> "Rita, which would you like us to test first? Once Win sets up the accounts, switching is a configuration change — not a rebuild."

### 4. Dashboard Simplification (Vinh's item #2)

> "Vinh mentioned making the dashboard simpler for non-tech users. We agree — the current detail modal has a lot of information. We can simplify the view so clicking a ticket shows just the essential info: employee list, validation status, and the approve/reject action. The technical AI details can be collapsed or hidden."

### 5. Database Migration (Vinh's item #3)

> "Currently the app uses browser storage for the demo. For production with multiple users, we'll need a proper database. Supabase is our recommendation — free tier, real-time, works with our Vercel hosting. This is a Phase 4 task."

### 6. Myanmar Language

> "We're building with English first. Myanmar script — especially handwriting — is a harder challenge. We need real samples from the Myanmar team to calibrate. The architecture doesn't change, only the AI model and prompts."

---

## What to Promise for Next Demo

| Deliverable | Timeline | Depends on |
|-------------|----------|-----------|
| Test with real Myanmar bank slips (Win's samples) | 2-3 days after receiving samples | Win providing data |
| AI provider comparison (Gemini vs GPT-4o on real data) | 2-3 days after API keys setup | Win setting up accounts |
| Simplified dashboard view for non-tech users | Next demo | Vinh's feedback |
| Database migration (Supabase) | 1 week | Architecture decision |

**DO NOT promise:**
- Myanmar handwriting OCR (too hard, no timeline)
- 100% extraction accuracy (set expectation: "AI assists, human reviews")
- Production deployment timeline (depends on real data testing + API setup)

---

## Blockers to Raise

| Blocker | Owner | Impact |
|---------|-------|--------|
| **No real sample data** from Myanmar team | Win | Can't test with real documents |
| **No enterprise API keys** (OpenAI/Gemini/Claude) | Win | Stuck on free-tier Groq |
| **Groq blocked in Myanmar** | — | Can't use current setup in production |
| **No real bank slip images** from Yoma/KBZ | Win / Myanmar Finance | Can't validate bank slip extraction accuracy |

---

## Fallback Plan

**If pipeline fails during demo:**
Deactivate v4 → reactivate v3. Show Phase 2 features (proven). Explain: "Employee extraction is ready, just needs the enterprise API key."

**If employee extraction is empty:**
Upload `payroll_demo_12emp.jpg` manually via the upload zone. Same result, different path.

**If nothing works:**
Show screenshots from last night's successful tests. "The system works — here's the proof from our testing. We need the enterprise API for the live demo environment."
