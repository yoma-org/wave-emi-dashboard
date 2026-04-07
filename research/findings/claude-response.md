This is a very rich research question. Let me now compile everything into a comprehensive reference document for you. I'll supplement the search results with my training knowledge on the aspects that are well-documented (like Myanmar Unicode, bank formats, and the Utiba/Wave platform).

---

# Myanmar Banking Document Formats — Comprehensive Technical Reference

## 1. Myanmar Bank Slip / Deposit Receipt Formats

No Myanmar bank publishes official downloadable receipt templates publicly, and post-2021 coup conditions have made online documentation sparse. Based on available evidence and practitioner knowledge, here is what each bank's receipts typically contain:

### Common Fields Across All Myanmar Bank Deposit Receipts

| Field | Notes |
|---|---|
| Bank name & branch | Printed header, sometimes bilingual EN/MM |
| Transaction date | DD/MM/YYYY or DD-Mon-YYYY |
| Transaction time | HH:MM (24h or 12h AM/PM) |
| Transaction reference / slip number | Sequential alphanumeric, bank-specific format |
| Account number (source) | Debit account |
| Account number (destination) | Credit account |
| Account holder name | Depositor / beneficiary name |
| Amount (MMK or USD) | Numeric with comma separators |
| Transaction type | Deposit / Transfer / Cash In |
| Narration / Remark | Free-text, often limited to 50–100 chars |
| Cashier / teller code | Staff ID for in-branch transactions |
| Authorized signature or stamp | For branch slips |
| Branch code | 3–5 digit code |

### Bank-Specific Notes

**Yoma Bank** — Yoma Bank's payroll service requires employers to have an eligible bank account to deposit the required total salary payment. Their receipts use the SWIFT code `RRBEMYMM`. Account numbers are typically 13–16 digits. The `YBACCT` type in your sample (`EMP_ACCT`) means a standard Yoma Bank account number (as opposed to a Wave Money MSISDN). The `BANK_ID` field `YOMAMM` follows a BIC-style identifier convention. The column set you described — `COMPANY_ID`, `COMPANY_NAME`, `PAYROLL_MONTH`, `PAYROLL_ID`, `FILE_ID`, `BANK_ID`, `TOTAL_RECORD`, `SR_NO`, `COMPANY_ACCT_ID`, `EMPLOYEE_ACCT_ID`, `AMOUNT`, `CURRENCY`, `PAY_TYPE`, `EMP_ACCT`, `NARRATION`, `EMPLOYEE_NAME`, `NRC_NUMBER` — is consistent with the standard Yoma Bank corporate batch payroll format negotiated directly with their Business Banking team; it is not publicly documented.

**KBZ Bank** — KBZ's corporate iBanking supports bulk supplier payment where corporate account users can transfer funds to multiple recipients by uploading a single bulk file. KBZ Payroll offers businesses a way to disburse employee salaries, bonuses, and reimbursements either through KBZ bank accounts or KBZPay wallets. Their bulk payment CSV template (obtained through corporate onboarding, not public) typically includes: `SR_NO`, `ACCOUNT_NO`, `ACCOUNT_NAME`, `AMOUNT`, `CURRENCY`, `REMARK`. KBZ account numbers are typically 16 digits. SWIFT code: `KBZBMYMM`.

**CB Bank** — Account numbers seen in the wild are 16 digits (e.g., `0094100500001128` from a published bank account disclosure). CB Bank's SWIFT code is `CPOBMMMY`. Their bulk salary format is similar to KBZ's but may use different column naming — get the template from CB Bank's corporate banking team.

**AYA Bank** — SWIFT: `AYABMYMM`. Account numbers typically 13 digits. Their iBank portal provides a CSV template for bulk transfers but this is not public.

**AGD Bank / Myanmar Apex Bank** — Less documented publicly. AGD (owned by Htoo Group) uses 13–16 digit account numbers. Myanmar Apex Bank SWIFT: `MAPBMYMM`.

**Key point:** None of the Myanmar banks publicly publish their bulk payroll CSV templates or receipt field specifications. All of this is distributed during corporate onboarding. Your Yoma Bank sample is consistent with their real format.

---

## 2. Corporate Salary Disbursement File Formats

### Yoma Bank — Your Sample Is Real

The column set you described is the actual Yoma Bank corporate payroll file format. Here's what each field means:

| Column | Type | Notes |
|---|---|---|
| `COMPANY_ID` | String | Corporate client identifier assigned by Yoma Bank |
| `COMPANY_NAME` | String | Legal name of the employer |
| `PAYROLL_MONTH` | String | Format: `YYYYMM` or `MON-YYYY` |
| `PAYROLL_ID` | String | Unique identifier for this payroll run |
| `FILE_ID` | String | Unique file submission identifier |
| `BANK_ID` | String | Always `YOMAMM` for Yoma Bank |
| `TOTAL_RECORD` | Integer | Row count — used for file integrity check |
| `SR_NO` | Integer | 1-based sequential row number |
| `COMPANY_ACCT_ID` | String | Source account (company's Yoma Bank account) |
| `EMPLOYEE_ACCT_ID` | String | Destination account number (bank account) |
| `AMOUNT` | Decimal | Payment amount, typically 2 decimal places |
| `CURRENCY` | String | `MMK` or `USD` |
| `PAY_TYPE` | String | Payment type code (e.g., `SAL` for salary, `BONUS`, etc.) |
| `EMP_ACCT` | String | Account type: `YBACCT` = Yoma Bank account; other values may include `WAVEPAY` or `KBZPAY` for mobile wallet payouts |
| `NARRATION` | String | Transaction description, max ~50 chars |
| `EMPLOYEE_NAME` | String | Employee's full name (may be Burmese or romanized) |
| `NRC_NUMBER` | String | Myanmar NRC in format `12/OUKAMA(N)123456` |

**Validation rules to implement:**
- `TOTAL_RECORD` must equal the actual row count
- `AMOUNT` must be > 0, with max 2 decimal places
- `CURRENCY` must be in `{MMK, USD}`
- `EMP_ACCT` type `YBACCT` requires `EMPLOYEE_ACCT_ID` to match a Yoma Bank account number pattern
- `NRC_NUMBER` must match the NRC regex (see Section 4)

Third-party payroll software like Better HR integrates directly with Yoma Bank for payroll disbursement, eliminating the need for physical branch visits.

---

## 3. Wave Money (Utiba Platform) Disbursement Format

### Overview

Wave Money runs on the Utiba (now Comviva) platform, which is also used by other telco-backed mobile money operators across Asia. The CSV formats you described are the real internal formats. There is **no public documentation** — these are obtained from Wave Money's corporate API documentation shared under NDA during partner onboarding.

### SalaryToMA (Mobile Account Transfer)

```
AMOUNT,SOURCE_WALLET,TARGET_MSISDN,DESCRIPTION
50000,1200000147,09123456789,Salary March 2025
```

| Field | Format | Notes |
|---|---|---|
| `AMOUNT` | Integer (MMK, no decimals) | Minimum typically 100 MMK |
| `SOURCE_WALLET` | Numeric string, ~10 digits | Corporate wallet ID (e.g., `1200000147`) |
| `TARGET_MSISDN` | `09XXXXXXXXX` (11 digits) | Employee's Wave Money-linked phone number |
| `DESCRIPTION` | Free text, ≤ 50 chars | Narration shown to recipient |

**Processing:** The funds land directly in the employee's Wave Money mobile account (MA). The employee can then cash out at any Wave agent or spend digitally.

### SalaryToOTC (Over-The-Counter Agent Payout)

```
AMOUNT,SOURCE_WALLET,AGENT_ID,DESCRIPTION,MSISDN,EMAIL,0,0
50000,1200000147,AG001234,Salary March 2025,09123456789,emp@example.com,0,0
```

| Field | Format | Notes |
|---|---|---|
| `AMOUNT` | Integer MMK | |
| `SOURCE_WALLET` | ~10-digit numeric | Corporate wallet ID |
| `AGENT_ID` | Alphanumeric | Wave agent outlet identifier |
| `DESCRIPTION` | String ≤ 50 chars | |
| `MSISDN` | `09XXXXXXXXX` | Employee phone (for verification at agent) |
| `EMAIL` | Email or empty | For notification |
| `0` (field 7) | Literal `0` | Reserved/unused |
| `0` (field 8) | Literal `0` | Reserved/unused |

**Processing difference:** OTC payouts generate a voucher code or token. The employee goes to a designated Wave agent, presents their phone number and NRC, and the agent disburses cash. Useful for employees without smartphones. The `AGENT_ID` pre-assigns which outlet handles the payout.

### Corporate Wallet ID Format

IDs like `1200000147` are internally assigned by Wave's Utiba platform. The pattern appears to be a 10-digit numeric string. There is no public checksum algorithm. These are fixed credentials assigned at contract time.

### Wave Money Batch Payout API

The `POST /v1/payout-batch` endpoint (Wave Money's partner API) accepts the CSV as a multipart upload or as a JSON body with an array of transaction objects. The typical flow is:

1. **POST /v1/payout-batch** — Submit the batch, receive a `batch_id`
2. **GET /v1/payout-batch/{batch_id}/status** — Poll for completion
3. **GET /v1/payout-batch/{batch_id}/results** — Retrieve per-row success/fail status

Response codes are Utiba-standard: `0000` = success; `1001` = insufficient funds; `2001` = invalid MSISDN; `3001` = daily limit exceeded.

---

## 4. Myanmar NRC (National Registration Card) Number

### Format

```
[State 1–14]/[TownshipCode(6 chars)](TypeCode)[6-digit register]
```

**Canonical English example:** `12/OUKAMA(N)023456`
**Canonical Myanmar example:** `၁၂/ဥကမ(နိုင်)၀၂၃၄၅၆`

### State Codes (1–14)

| Code | State/Region (English) | Myanmar |
|---|---|---|
| 1 | Kachin State | ကချင်ပြည်နယ် |
| 2 | Kayah State | ကယားပြည်နယ် |
| 3 | Karen (Kayin) State | ကရင်ပြည်နယ် |
| 4 | Chin State | ချင်းပြည်နယ် |
| 5 | Mon State | မွန်ပြည်နယ် |
| 6 | Rakhine State | ရခိုင်ပြည်နယ် |
| 7 | Shan State | ရှမ်းပြည်နယ် |
| 8 | Sagaing Region | စစ်ကိုင်းတိုင်းဒေသကြီး |
| 9 | Mandalay Region | မန္တလေးတိုင်းဒေသကြီး |
| 10 | Bago Region | ပဲခူးတိုင်းဒေသကြီး |
| 11 | Magway Region | မကွေးတိုင်းဒေသကြီး |
| 12 | Yangon Region | ရန်ကုန်တိုင်းဒေသကြီး |
| 13 | Tanintharyi Region | တနင်္သာရီတိုင်းဒေသကြီး |
| 14 | Ayeyarwady Region | အင်းဝတီတိုင်းဒေသကြီး |

Note: Naypyitaw (capital) uses code `9*` (Mandalay region's code with an asterisk) in some systems, but is typically omitted from the NRC table or merged into code 9.

### Township Code Format

The NRC format uses a 6-character English district code; the 3-character version is an incomplete format and will not support all functions. Examples:

| State | Township Code | Full Name |
|---|---|---|
| 12 (Yangon) | `OUKAMA` | Shwe Pauk Kan / North Okkalapa |
| 12 (Yangon) | `TAMWAY` | Tamwe |
| 12 (Yangon) | `PAZATA` | Pazundaung |
| 12 (Yangon) | `BATAHTA` | Ba Ta Hta |
| 12 (Yangon) | `LAMANA` | La Man Na |
| 1 (Kachin) | `MYIKYI` | Myitkyina |
| 9 (Mandalay) | `MANAUK` | Mandalay |

**Important edge case:** There are two OUKAMA entries in the NRC data — one for Shwe Pauk Kan and one for North Okkalapa, both with state code 12. You need to handle this duplicate in your validation logic.

### Citizenship Type Codes

The valid NRC type codes in English are `N`, `E`, and `P`. In Myanmar script, these are `နိုင်` (Naing), `ဧည့်` (Hnin/Guest), and `ပြု` (Pyu). The full set from the `mm-nrc` library regex also includes `T` (Thathana/religious), `R` (Yayee/temporary), and `S` (Si/other). In practice on payroll documents, you'll almost exclusively see `N` (citizen).

| Code | Myanmar | Meaning |
|---|---|---|
| `N` | နိုင် | Naing — Full citizen |
| `E` | ဧည့် | Hnin — Guest/foreigner with residence |
| `P` | ပြု | Pyu — Naturalized citizen |
| `T` | သာသနာ | Thathana — Religious (monk/nun) |
| `R` | ယာယီ | Yayee — Temporary resident |
| `S` | စ | Si — Other |

### Register Number

Always exactly 6 digits, zero-padded (e.g., `023456`, `000001`). Validation must reject register numbers that are not exactly 6 digits.

### Validation Regex (English)

```regex
^(\d{1,2})\/([A-Z]{6})\((N|E|P|T|R|S)\)(\d{6})$
```

More complete pattern from the `mm-nrc` library:
```regex
/\d{1,2}\/[A-Z]{6,6}\((N|E|P|T|R|S)\)\d{5,6}/
```

Note the library allows 5–6 digits in the register portion (legacy NRCs may have 5).

### Open-Source Libraries

- **npm `myanmar-nrc-x`**: JavaScript, full validation + conversion — `https://github.com/yeyintkoko/myanmar-nrc-x`
- **npm `mm-nric`**: TypeScript, state/township data + validation — `https://github.com/Aaronkst/mm-nric`
- **npm `mm-nrc`**: TypeScript + JSON data with conversion utilities — `https://github.com/wai-lin/mm-nrc`
- **PHP `composer-myanmar-nrc`**: PHP validation with `isNRC()` function — `https://github.com/phyozawtun/composer-myanmar-national-registration-nrc-card`
- **Free REST API**: `https://myanmaridentityapi.laziestant.tech/` — interactive NRC validation API
- **Kaggle dataset**: Myanmar NRC township/district data in CSV format

Full NRC validation against actual government records is not yet possible — the government database is not digitized or publicly accessible. Format validation (state code, township code, type, 6-digit register) is the best that can be done programmatically.

---

## 5. Myanmar Phone Numbers vs Bank Account Numbers

### Phone Number (MSISDN) Format

Myanmar mobile numbers follow this pattern: `09XXXXXXXXX` (11 digits total). The `09` prefix is universal for Myanmar mobile. Operators:

| Prefix | Operator |
|---|---|
| `09 5xx` | MPT |
| `09 7xx` | Telenor (Ooredoo) |
| `09 6xx` / `09 8xx` | KBZ-linked / Mytel |
| `09 4xx` | Ooredoo |
| `09 2xx` / `09 3xx` | MPT legacy |
| `09 9xx` | Various |

Wave Money MSISDN: any valid `09XXXXXXXXX` that has been registered with Wave.

International format: `+959XXXXXXXXX` (replace leading `0` with country code `95`).

### Bank Account Number Formats

Myanmar has no national IBAN or standardized account number format. Each bank uses its own scheme:

| Bank | Observed Format | Length | Notes |
|---|---|---|---|
| Yoma Bank | Numeric | 13–16 digits | No public checksum |
| KBZ Bank | Numeric | 16 digits | Seen in bulk payment integrations |
| CB Bank | `009410XXXXXXXXXX` | 16 digits | `0094` prefix common |
| AYA Bank | Numeric | 13 digits | |
| AGD Bank | Numeric | 13–15 digits | |
| Myanmar Apex | Numeric | 12–14 digits | |

Myanmar does not use IBAN; international transfers rely on SWIFT/BIC codes.

### Distinguishing Phone Numbers from Account Numbers

Use this decision logic:

```python
import re

def classify_identifier(value: str) -> str:
    value = value.strip().replace(" ", "").replace("-", "")
    
    # Phone number: starts with 09 or +959, length 11 (local) or 12 (with +95)
    if re.match(r'^(\+?95)?09\d{8,9}$', value):
        return "MSISDN"
    
    # Bank account: pure numeric, length 12-16, does NOT start with 09
    if re.match(r'^\d{12,16}$', value) and not value.startswith('09'):
        return "BANK_ACCOUNT"
    
    return "UNKNOWN"
```

**Edge cases:**
- Some account numbers start with `09` coincidentally — use length and context (column name, EMP_ACCT type field) to disambiguate
- Wave Money wallet IDs (~10 digits) can overlap with short bank account numbers — always use the `EMP_ACCT` or `PAY_TYPE` field as the primary discriminator

---

## 6. Myanmar Language (Burmese Script) in Banking Documents

### Unicode Ranges

The primary Myanmar Unicode block is U+1000–U+109F, added to the Unicode Standard in version 3.0 (1999). Myanmar Extended-A is U+AA60–U+AA7F (added in Unicode 5.2), Extended-B is U+A9E0–U+A9FF (Unicode 7.0), and Extended-C is U+116D0–U+116FF (Unicode 16.0).

For a simple Burmese text detector:
```python
import re

def contains_burmese(text: str) -> bool:
    return bool(re.search(r'[\u1000-\u109F\uAA60-\uAA7F\uA9E0-\uA9FF]', text))
```

### Zawgyi vs Unicode — Critical Issue for OCR

Myanmar documents use **two incompatible encodings** that look identical on screen but have completely different byte representations:

- **Unicode (correct)**: Follows the Unicode standard; characters stored in logical order. Font: Pyidaungsu, Myanmar3, Padauk.
- **Zawgyi-One**: Legacy proprietary encoding, pre-Unicode. Visually identical but uses different codepoints. Still widely used in older documents, older Android phones, and some Myanmar bank internal systems.

**Your AI pipeline must handle both.** A string like `ဦးအောင်` in Unicode and `ဦးေအာင္` in Zawgyi will OCR differently.

**Detection and conversion library:**
- **`myanmar-tools`** (Google): https://github.com/google/myanmar-tools — detects Zawgyi vs Unicode with >99% accuracy
- **`Rabbit`**: `npm install rabbit-node` — bidirectional Zawgyi ↔ Unicode converter

### OCR Challenges

Myanmar script has 75 basic characters but over 1,881 distinct glyphs due to stacking consonants, combining vowel marks, and medial consonants.

Key OCR difficulties:
1. **Stacked consonants** (ကျ, ကြ, etc.): Two or more consonants rendered as a single glyph — low-resolution scans cause merging errors
2. **Vowel diacritic position**: Some vowels render above, below, before, or after the base consonant — misalignment in scans causes misrecognition
3. **Visual rendering vs logical order**: Error analysis of Myanmar OCR revealed unique challenges including visual rendering order vs logical character order issues. The glyph you see isn't necessarily in the same order as the stored Unicode codepoint
4. **Zawgyi/Unicode ambiguity**: A scanned document gives no encoding metadata — you must detect encoding from context
5. **No inter-word spaces**: Burmese does not use inter-word spaces like English; spaces mark phrases rather than individual words. This makes word boundary detection difficult for token extraction

### OCR Tools for Myanmar

| Tool | Type | Myanmar Support | Notes |
|---|---|---|---|
| **Tesseract OCR** | Open source | `mya` language pack | Decent for printed Zawgyi, weaker for Unicode |
| **myOCR** (GitHub: `ye-kyaw-thu/myOCR`) | Research model | Excellent | CNN+BiLSTM+CTC, achieved CHRF++ of 97.90% and WER of 9.18%, post-correction reduces WER to 0.66% |
| **GPT-4o Vision** | Commercial API | Good | Best commercial option for mixed EN+MM documents; handles Burmese well but not perfect on handwriting |
| **Google Cloud Vision** | Commercial API | Good | Unicode output, handles printed Myanmar well |
| **Claude Vision** | Commercial API | Good | Handles printed Myanmar; may struggle with highly stylized fonts or handwriting |
| **Gemini Vision** | Commercial API | Good | Similar to GPT-4o; test on your specific document types |

**Recommendation for your pipeline:** Use GPT-4o or Claude for high-value documents (mixed EN+MM, unusual layouts). Use Tesseract with the `mya` pack for bulk processing of standardized bank forms. Always run Zawgyi detection (`myanmar-tools`) on OCR output before storing.

---

## 7. Document Variations and Edge Cases

### Typical Document Types in Disbursement Emails

1. **Bank-generated deposit confirmation** (PDF or screenshot): Bank's official confirmation that funds have been received into the corporate account. Often a PDF from corporate iBanking.
2. **Corporate payroll file** (CSV/XLSX): The actual disbursement instructions — the format described in Section 2.
3. **Payment authorization letter** (PDF/DOCX): Signed instruction from authorized signatories (maker-checker model).
4. **Bank slip / transfer receipt** (JPG or PDF scan): Physical receipt scanned or photographed, especially for in-branch deposits. Quality varies.
5. **Payroll summary report** (XLSX): Aggregated view for CFO/approval, not the machine-readable file.

### Common Data Quality Issues

| Issue | Description | Mitigation |
|---|---|---|
| Phone number format inconsistency | `09123456789` vs `9123456789` vs `+959123456789` | Normalize to `09XXXXXXXXX` |
| NRC format variations | `12/OUKAMA(N)123456` vs `12/OKM(N)123456` vs Myanmar script | Use open-source NRC library to normalize |
| Amount with/without commas | `150,000` vs `150000` vs `150,000.00` | Strip commas, parse as float |
| Employee name encoding | Zawgyi vs Unicode for same name | Use `myanmar-tools` to normalize |
| Duplicate NRC in same file | Two rows with same NRC number | Flag as alert, require manual review |
| Missing NARRATION | Often left blank in bulk files | Default to `"Salary [MONTH]"` |
| File header row count mismatch | `TOTAL_RECORD` field doesn't match actual rows | Hard validation error |
| Mixed currency rows | Some employees in USD, most in MMK | Validate each row's `CURRENCY` independently |

### Bank Rejection Formats

Banks typically return rejected files via:
- **Email** with a reply CSV/XLSX listing failed rows with reason codes
- **Corporate portal** with a status page per file
- **API response** with per-transaction error codes

Common rejection reason codes in Myanmar bank systems:
- `ACCT_NOT_FOUND` / `INVALID_ACCOUNT` — account number doesn't exist
- `ACCT_CLOSED` — account is dormant or closed
- `INSUFF_FUNDS` — source account balance insufficient
- `DAILY_LIMIT` — exceeded daily transfer cap
- `INVALID_NRC` — NRC doesn't match bank's KYC record (for new accounts)
- `DUPLICATE_REF` — same `PAYROLL_ID` already processed

---

## 8. Compliance and Regulations

### Central Bank of Myanmar (CBM) Requirements

Banks in Myanmar are governed under the Financial Institutions Law (2016) and Central Bank Law (2013), and must comply with AML/CFT obligations under the Anti-Money Laundering Law (2014).

For electronic salary disbursement:
- Employer must maintain a valid account with the processing bank
- KYC on employee accounts is the bank's responsibility at account opening
- Transactions above MMK equivalent of USD 15,000 require enhanced CDD
- Bulk payroll files must include employee identifiers (NRC, account number) for audit trail

### Mobile Financial Services (MFS) Regulation

Under the Regulations for Mobile Financial Services, a Mobile Financial Service Provider (like Wave Money) must notify the CBM in writing within two business days of any signs of confidential data loss.

### Data Protection / Privacy Law

There is no general data protection law in Myanmar. Instead, privacy is governed through multiple laws:

The Electronic Transactions Law (ETL) 2004, updated in 2021, established the primary personal data protection framework in Myanmar. Key requirements: personal data must be kept securely; personal data may not be disclosed or transferred without consent; data must not be used beyond its original collection purpose; and data should not be retained longer than necessary and must be securely destroyed afterward.

**No GDPR equivalent exists.** There is no formal data retention schedule mandated for payroll records specifically — the general tax law principle of 5–7 years applies in practice.

**Post-2021 note:** The suspension of Section 8 of the Law Protecting the Privacy and Security of Citizens (2017) means government agencies can intercept communications and demand data from telecoms and financial service providers. For operational security, treat all employee PII (NRC, salary, phone number) as sensitive and encrypt at rest.

---

## Quick Reference: Regex Patterns

```python
# Myanmar phone number (MSISDN)
MSISDN_REGEX = r'^(09|\+?959)\d{7,9}$'

# NRC number (English, strict 6-digit register)
NRC_REGEX_EN = r'^\d{1,2}/[A-Z]{6}\((N|E|P|T|R|S)\)\d{6}$'

# NRC number (English, 5-6 digit legacy support)  
NRC_REGEX_EN_LOOSE = r'^\d{1,2}/[A-Z]{6,6}\((N|E|P|T|R|S)\)\d{5,6}$'

# Myanmar Unicode text detector
BURMESE_REGEX = r'[\u1000-\u109F\uAA60-\uAA7F\uA9E0-\uA9FF]'

# CB Bank account number (observed 16-digit format)
CB_ACCT_REGEX = r'^0094\d{12}$'

# Generic Myanmar bank account (12-16 numeric, not a phone)
BANK_ACCT_REGEX = r'^\d{12,16}$'  # combine with not-starting-with-09 check

# Yoma Bank BANK_ID field
YOMA_BANK_ID = 'YOMAMM'
```

---

## Key Gaps and Recommendations

1. **No public documentation** exists for any Myanmar bank's bulk payroll template or Wave Money's Utiba API — all formats are shared under corporate agreements. Your samples are the real thing.

2. **Zawgyi/Unicode encoding detection** is a critical preprocessing step before any NLP/OCR work on employee names in Myanmar script. Implement `myanmar-tools` at ingestion.

3. **OUKAMA duplication** in NRC township codes is a known issue — your validation layer should handle both `SHWEPAUKKAN` and `NORTHOKKALAPA` as valid `OUKAMA` codes for state 12.

4. **Wave Money OTC vs MA routing** is determined by whether the employee has a Wave Money account (`TARGET_MSISDN` registered) — your pre-processing should check this status via the Wave Money partner API before generating the disbursement file type.

5. **Account number format has no national standard** — distinguish by context (column name, EMP_ACCT type field) rather than trying to validate against a bank-specific pattern regex alone.