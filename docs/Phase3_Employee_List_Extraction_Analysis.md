# Employee List Extraction from Payroll Documents — Deep Analysis

**Context:** Rita and team want the AI to extract full employee lists (names, MSISDNs, amounts) from payroll document images — not just the summary. They've agreed to enterprise OpenAI for production. DK needs to test if Groq free tier can handle this for tomorrow's demo.

---

## The Gap: What We Do Now vs What They Want

| | Current (bank slip summary) | New (employee list extraction) |
|---|---|---|
| **Input** | Bank slip image | Payroll document image |
| **Output** | 1 company, 1 amount, 1-2 signers (~5 fields) | 20-100+ rows of name + MSISDN + amount |
| **Data points** | ~5-10 | **~200-1,000+** |
| **Error tolerance** | Amount off by a few? System flags it. | One wrong MSISDN digit = **money to wrong person** |
| **Token output** | ~100 tokens | ~500-2,500 tokens |
| **Difficulty** | Read a header/summary | **OCR a dense table with small numbers** |

This is not an incremental upgrade. It's a fundamentally harder task.

---

## The MSISDN Accuracy Problem (the real risk)

This is the thing that keeps me up at night about this feature:

```
Correct:  09781234567  → Daw Thin Thin gets her salary
Wrong:    09781234576  → Some stranger gets Daw Thin Thin's salary
```

One digit. That's all it takes. Vision models reading 10-11 digit numbers from images have error rates that matter at this scale:

| Accuracy per digit | 10-digit MSISDN accuracy | 20 employees: how many wrong? |
|---|---|---|
| 99.9% (excellent) | 99.0% per MSISDN | ~0.2 errors (acceptable) |
| 99.5% (good) | 95.1% per MSISDN | ~1 error (risky) |
| 99.0% (decent) | 90.4% per MSISDN | ~2 errors (dangerous) |
| 98.0% (mediocre) | 81.7% per MSISDN | ~4 errors (unacceptable) |

**For financial disbursement, you need >99.9% per-digit accuracy. Most vision models are at 98-99%.**

This is why the current app has employee list upload as a **file** (CSV/Excel), not as an image. Structured data from a file is 100% accurate. OCR from an image is never 100%.

---

## Can Groq Free Tier Handle It?

### Token limits
- llama-4-scout output: up to 8,192 tokens on free tier
- 20 employees in JSON: ~500 tokens — fits
- 50 employees: ~1,250 tokens — fits
- 100 employees: ~2,500 tokens — fits but large
- **Token limit is NOT the blocker**

### Vision quality for tables
- llama-4-scout DocVQA: 94.4% — strong for documents
- But DocVQA measures "answer a question about a document," not "OCR every cell in a table"
- Table OCR is a different, harder benchmark
- Dense tables with small numbers push the limits of any vision model

### What we can test RIGHT NOW

Send a payroll image to Groq with this prompt:
```
Extract the complete employee list from this payroll document.
Return JSON array:
[{"name": "", "msisdn": "", "amount": 0}]
Extract EVERY row. Be precise with phone numbers — each digit matters.
```

If the response is >90% accurate on a clean, high-res image: **demo-worthy.**
If it's <90%: show as "POC tested, production needs enterprise model + validation."

---

## What a Test Looks Like

### Step 1: Create a mock payroll image

We need a clear, high-resolution payroll document with ~15-20 employees. The image should have:
- Header (company name, period, total amount)
- Table with columns: Employee Name | MSISDN | Amount (MMK)
- Myanmar-style names and MSISDN format (09xxxxxxxxx)
- Clear font, good contrast (not a photo of a printout — that's harder)

### Step 2: Test with Groq API

```bash
curl https://api.groq.com/openai/v1/chat/completions \
  -H "Authorization: Bearer YOUR_KEY" \
  -d '{
    "model": "meta-llama/llama-4-scout-17b-16e-instruct",
    "messages": [{
      "role": "user",
      "content": [
        {"type": "text", "text": "Extract ALL employees from this payroll..."},
        {"type": "image_url", "image_url": {"url": "data:image/png;base64,..."}}
      ]
    }],
    "response_format": {"type": "json_object"},
    "temperature": 0.1,
    "max_tokens": 4000
  }'
```

### Step 3: Compare with ground truth

For each employee: name match? MSISDN exact match? Amount exact match?

---

## The Integration Path (if it works)

### Option A: Separate pipeline step (recommended)

```
Email arrives with payroll attachment
  → Text AI: extract summary (company, amount, approvers)    ← existing
  → Vision AI: extract bank slip summary (amount, signers)    ← existing
  → Vision AI: extract employee list from payroll document    ← NEW
  → Dashboard: show extracted list for human review
  → Human: confirms/corrects → proceeds to CSV generation
```

The employee list extraction would be a **second vision call** with a different prompt. The extracted list feeds into the existing employee data structure in the dashboard.

### Option B: Dashboard upload feature (safer)

Add an "Upload Payroll Image" button on the Incoming Emails page. User uploads the payroll document image. Client-side JavaScript calls Groq API directly (or via Vercel API proxy). Shows extracted list for review. User confirms and proceeds.

This keeps the extraction separate from the automated pipeline — the human is always in the loop.

### For tomorrow's demo: Option B is safer

- No pipeline changes needed
- No n8n re-import
- Just a new button + API call on the dashboard
- Human reviews the extracted list before proceeding
- Shows the concept without the automation risk

---

## Effort Estimate

| Approach | Effort | Risk | Demo impact |
|----------|--------|------|------------|
| **Quick test** (curl to Groq, show JSON result) | 30 min | Zero | Medium — shows it's possible |
| **Dashboard button** (upload image → extract → show table) | 2-3 hours | Low | High — interactive demo |
| **Full pipeline integration** (n8n auto-extract from email attachment) | 4-6 hours | Medium | Highest — but risky for tomorrow |

---

## My Honest Recommendation

### For tomorrow's demo:

**Do the quick test FIRST (30 min).** Create a mock payroll image, send to Groq, see what comes back. Measure accuracy. This tells us if the technology works before we invest in integration.

If accuracy is good (>90%):
→ Build the dashboard upload button (Option B, 2-3 hours)
→ Demo: "Upload a payroll image, AI extracts the employee list, human reviews and confirms"

If accuracy is poor (<90%):
→ Show the raw API response as a slide/screenshot
→ Say: "We've tested the technology. With enterprise OpenAI (GPT-4o), accuracy will be higher. The architecture is ready — we just need the right model."

### For production:

1. **Enterprise OpenAI GPT-4o** has the best vision OCR for dense tables — significantly better than llama-4-scout for tabular data
2. **Always require human review** of extracted employee lists before processing — never auto-disburse from OCR
3. **Validation layer:** MSISDN format check, amount range check, duplicate detection, row count vs total amount reconciliation
4. **The extraction replaces manual data entry, not human judgment** — the human still clicks "Confirm" after reviewing the extracted list

### The demo narrative:

> "Currently, the maker manually reads the payroll document and types employee data into the system. Our AI reads the document and extracts the list automatically — the maker just reviews and confirms. This reduces a 30-minute manual task to a 2-minute review."

---

## Key Risk to Flag in the Meeting

**Do NOT position this as "AI replaces the human for employee list processing."**

Position it as: **"AI does the data entry. Human does the review."**

This is critical because:
1. Minh's rule: no auto-processing of sensitive employee data
2. Rita's Phase 3 (Maker-Checker): the Checker reviews exceptions, not every row — but someone still reviews
3. Regulatory: financial disbursement requires a named human taking deliberate action
4. One wrong MSISDN = money to wrong person = liability

The AI is the **fast, tireless assistant** that reads the document and fills in the form. The human is the **accountable reviewer** who confirms before processing.
