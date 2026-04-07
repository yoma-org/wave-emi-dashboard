# AI Council Research — Synthesis & Key Findings

**Date:** April 7, 2026
**Sources:** 7 AI responses (Gemini, ChatGPT, DeepSeek, Grok, Perplexity, Qwen, Claude) + Yoma Bank BBP Manual (downloaded)

---

## Critical Discovery: Yoma Bank BBP Manual (Pages 65-68)

Downloaded the actual Yoma Bank Business Banking Portal User Manual (107 pages, v2, July 2024). Section 10 covers **Bulk Payment** — this is THE ground truth.

### Yoma Bank Bulk Payment Template — 4 columns:

| Column | Description | From manual |
|--------|-------------|-------------|
| Receiver Name | Employee/beneficiary name | "Please enter the receiver's name" |
| Receiver Account Number | Bank account or wallet | "Please enter the receiver's account number" |
| Amount | Transfer amount | "Enter the amount to transfer" |
| Currency | MMK or USD | "Choose the currency type" |

**This is simpler than PyiGyiKhin.pdf** (which has 10+ columns). Two possible explanations:
1. PyiGyiKhin is a **payroll portal variant** (via CSSP - Customer Self-Service Payroll Portal) with extra metadata
2. The BBP template is the **minimum** — payroll adds company/batch/NRC fields on top

### Operational rules from the manual:
- File format: Excel (downloadable template from portal)
- Max file size: 5 MB
- Validation on upload — shows "Validation Reason" for each error
- **Cannot proceed until ALL errors are corrected** (matches our pre-check approach)
- Maker-Checker workflow: maker uploads → checker approves/rejects (matches Rita's Phase 3)
- 19 predefined "Purpose of Transaction" types
- If purpose type 10-19 → must provide Remark text
- Transaction record sent via email after completion

---

## Cross-AI Consensus — What ALL 7 AIs Agree On

### 1. Bank Slip Fields (Finance validation)
All AIs confirm these are standard across Myanmar banks:
- Depositor/Sender Name
- Amount (numeric + words)
- Transaction Date/Time
- Transaction ID / Reference Number
- Narration / Remark / Memo
- Branch Code/Name
- Currency (MMK primary)

### 2. NRC Format — Confirmed
```
[State 1-14]/[Township 6 chars]([Citizenship Type])[6 digits]
Example: 12/OUKAMA(N)123456
```
- **State codes 1-14** — disagreement on mapping (use `mm-nrc` npm package as authority)
- **Citizenship types:** N(Citizen), E/AC(Associate), P/NC(Naturalized), T(Religious), R(Temporary)
- **Township codes:** 330+ 6-character codes, bilingual EN/MM
- **Regex:** `^\d{1,2}\/[A-Z]{6}\([A-Z]{1,2}\)\d{6}$`

### 3. MSISDN Format — Confirmed
- `09XXXXXXXXX` — 11 digits total (NOT 10 as Perplexity incorrectly states)
- International: `+959XXXXXXXXX`
- Operators: MPT(092/094/095), Telenor(097), Ooredoo(098/099), Mytel(096), MecTel(093)

### 4. Account Identification Modes
| EMP_ACCT Type | Account Format | Validation |
|---|---|---|
| `YBACCT` | Yoma Bank account (14 digits) | Numeric, length check |
| `YBMOBILE` / Wave | Phone MSISDN (09xxxxxxxxx) | Phone format validation |
| `YBOTHER` / CBM-NET | External bank account (10-17 digits) | Numeric only |

### 5. Myanmar OCR — Honest Assessment
| Input Type | Best Model | Accuracy | Production-Ready? |
|---|---|---|---|
| Typed English | GPT-4o / Gemini | 90%+ | Yes |
| Typed Myanmar Unicode | GPT-4o | 85-90% | With review |
| Typed Myanmar Zawgyi | Needs conversion first | — | Need `myanmar-tools` detection |
| Handwritten Myanmar | GPT-4o | 50-60% | No — manual entry fallback |

### 6. No Public Bank Templates Available
All 7 AIs confirm: Myanmar banks do NOT publish bulk payment templates publicly. Templates are distributed via:
- Corporate banking portal login (Yoma BBP, KBZ iBanking)
- Relationship manager during onboarding
- Internal bank documentation

---

## Contradictions Resolved

| Issue | Resolution |
|---|---|
| MSISDN 10 vs 11 digits | **11 digits** — Perplexity was wrong |
| Yoma SWIFT `YOMAMMMYXXX` vs `RRBEMYMM` | Both valid — RRBEMYMM is the old name before rebranding |
| NRC state codes 5-14 mapping | Use `mm-nrc` npm package (428 townships, community-maintained) |
| Yoma account length | Real sample: 14 digits. Range: 10-16 depending on account type |

---

## Downloaded Files

| File | Size | Source | Content |
|------|------|--------|---------|
| `Yoma_Bank_BBP_User_Manual_v2.pdf` | 22 MB | yomabank.com | 107-page BBP manual — Bulk Payment section pages 65-68 |
| `IFC_Myanmar_Mobile_Money_Report.pdf` | 1.5 MB | World Bank | Myanmar mobile money landscape report |
| `PyiGyiKhin.pdf` | 132 KB | Win (real sample) | Yoma Bank payment instruction — 1 employee row |
| `myanmar_nrc_data.json` | 101 KB | GitHub | 352+ NRC township codes with EN/MM names |

---

## What This Means for Phase 3

### For tomorrow's demo (safe, no changes needed):
The Phase 3 plan already covers what's needed. The Yoma BBP manual confirms our approach: upload file → validate → flag errors → maker submits → checker approves.

### For production (Phase 3.1+):
1. **Two template modes:**
   - **BBP mode** (4 columns): Receiver Name, Account Number, Amount, Currency
   - **Payroll mode** (10+ columns): Full PyiGyiKhin format with COMPANY_ID, NRC, etc.
   - Auto-detect based on column count/headers

2. **Validation Reason column** — match Yoma BBP's error display format. Their portal shows validation errors per row with a "Validation Reason" column. Our system should mimic this.

3. **19 Purpose Types** — Yoma has 19 predefined transaction purposes. We should support this dropdown for the "Remark" field.

4. **Zawgyi detection** — older documents may use Zawgyi encoding. Use Google's `myanmar-tools` library to detect and convert before processing.

---

## Still Missing (for AI Council Prompt #2)

1. Actual Yoma Bank bulk payment Excel template (inside BBP portal — need Win to download)
2. Real bank slip images from Myanmar banks
3. Real payroll documents with 10+ employee rows
4. KBZ/CB Bank bulk payment templates (behind portal login)
5. Wave Money Utiba CSV template (partner access only)
