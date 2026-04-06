# Meeting Analysis — April 6, 2026

## Sources
1. **Yoma Bank Daily Standup** — Rita, Vinh, Win, Tracy, Tin, DK (Teams call, ~22 min)
2. **Minh Post-Review** — Minh Ngo + DK + Dung (post-meeting debrief, audio)
3. **Teams Chat** — Dung, Tracy, Tin, DK (text thread, same day)

---

## Key Decisions & Direction

### 1. Employee List Extraction is MANDATORY (Rita)

Rita made clear: the pre-check must include detailed employee list processing, not just email summary extraction. This is Phase 1 of her workflow — the system should:

- Extract employee list from client's payroll document (CSV, Excel, PDF, or image)
- Strip name titles/prefixes (U, Daw, Ko, etc.)
- Validate phone numbers (correct format, correct digit count, both sender + receiver)
- Verify amounts total up to the requested disbursement amount
- Flag errors BEFORE finance approval — so Sales can go back to client

**Rita's words:** "This is not optional. The pre-check needs to include the detailed cleaning up of the Excel."

### 2. Minh's Architectural Direction: Template-Driven Extraction

**Core principle:** Don't extract everything from the document. Define what fields the bank payment system needs, then find and extract ONLY those fields from whatever the client sends.

**Two-step approach:**
1. Define required output fields (what the bank needs: employee name, MSISDN, amount, employee ID)
2. Scan the client's input file, locate matching columns, extract only those values

**Key quote:** "The bank's required fields are what you can update. The client's request format — you don't care."

**The real worry:** Myanmar language. English extraction is solved. Myanmar handwritten script is the hard problem. Build with English first, adapt when real samples arrive.

**Practical advice:** "Just assume the fields for now. Don't wait for sample data."

### 3. AI Provider Strategy (Rita + Tracy)

| Provider | Status | Notes |
|----------|--------|-------|
| **Claude/Anthropic** | Blocked in Myanmar | Fine for internal dev (Trustify servers in VN). Can't be used in-country by client |
| **OpenAI** | Approved (enterprise) | Win tasked to set up Zaya Labs account. Enterprise grade required |
| **Gemini** | Preferred for OCR (Tracy) | "Flash model handles this. Cheaper." Tin agrees |
| **AWS Bedrock** | Rita mentioned | "Safe hands — all in the AWS ecosystem." For hardened production |
| **Groq** | Current (demo) | Free tier, fine for demo. Not enterprise grade |

**Action items:**
- Win: Set up OpenAI enterprise + Claude API + Google/Gemini accounts (centrally owned by Zaya Labs)
- Team: Evaluate Bedrock for production deployment
- Demo: Continue with Groq free tier (clean/mock data only)

### 4. Finance Requirements — 3 Key Fields

Finance team needs these extracted and validated:
1. **Phone number** — validate BOTH sender + receiver MSISDNs. Phone number = bank account in Wave Money
2. **Amount** — cross-validate email vs document (already built — AMOUNT_MISMATCH detection)
3. **DateTime** — payment period/date for reconciliation

### 5. Demo Strategy

**Rita's acceptance:** "For right now, you can pretend that pre-check is done. But these steps need to be included."

**Rita's request:** Publish the demo to Myanmar teams ASAP — "They'll catch more things as we're working on it."

**Dung (CTO):** Show sequence diagram tomorrow to validate flow against Rita's expectations. Use numbered steps for precise communication.

**Tuesday in-person demo:** Rita will be present. Show sequence diagram + live email demo. Clean data only (~10 rows).

### 6. Myanmar Language Challenge

- Real payroll documents will have handwritten Myanmar script
- This is the hardest OCR challenge — "expect handwriting in Myanmar language"
- Current demo uses English (proven to work)
- Myanmar support requires: real sample data + enterprise vision API + possibly specialized OCR model
- **Blocker:** Need real sample data from Win/Myanmar teams

---

## Action Items

| # | Owner | Action | Priority | Status |
|---|-------|--------|----------|--------|
| 1 | Win | Push for real sample data from Myanmar teams | Critical | Pending |
| 2 | Win | Set up OpenAI + Claude + Google enterprise accounts | High | Pending |
| 3 | DK | Show sequence diagram to Rita Tuesday (in-person) | High | Ready (mmd created) |
| 4 | DK | Demo live email pipeline to Rita Tuesday | High | Ready (tested) |
| 5 | DK | Build employee list extraction POC with assumed fields | Medium | Phase 3 |
| 6 | Tracy/Tin | Benchmark Gemini vs OpenAI for OCR when samples arrive | Medium | Blocked on #1 |
| 7 | Team | Evaluate AWS Bedrock for production | Low | Future |

---

## Phase 3 Architecture (from Minh's direction)

```
INPUT (any format)          FIELD CONFIG              OUTPUT (clean template)
├── CSV                     ├── employee_name         ├── Name (cleaned, no titles)
├── Excel                   ├── msisdn                ├── MSISDN (validated format)
├── PDF                     ├── amount                ├── Amount (number, verified)
├── PNG/photo        →      ├── employee_id    →      ├── Employee ID
└── handwritten doc         └── (configurable)        └── (bank-ready CSV)
```

The field list is configurable. The extraction logic stays the same — only "what to look for" changes. This is Minh's key insight: build a targeted field extractor, not a generic OCR system.
