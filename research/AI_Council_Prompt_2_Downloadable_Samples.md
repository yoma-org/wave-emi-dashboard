# AI Council Prompt #2 — Downloadable Yoma Bank Sample Data

> Copy and paste into: Gemini, ChatGPT, Grok, DeepSeek, Perplexity, Qwen
> Save responses to `research/findings/` with filename: `{ai_name}_samples_response.md`

---

## The Prompt

```
I'm building a salary disbursement automation system specifically for Yoma Bank in Myanmar (SWIFT: YOMAMMMYXXX, BANK_ID: YOMAMM). I need to find DOWNLOADABLE sample documents to test my AI extraction pipeline.

I already have one real sample: a Yoma Bank payment instruction file with columns like COMPANY_ID, COMPANY_NAME, PAYROLL_MONTH, PAYROLL_ID, FILE_ID, BANK_ID, TOTAL_RECORD, SR_NO, COMPANY_ACCT_ID, EMPLOYEE_ACCT_ID, AMOUNT, CURRENCY, PAY_TYPE, EMP_ACCT (YBACCT), NARRATION, EMPLOYEE_NAME, NRC_NUMBER.

### What I Need — DOWNLOADABLE LINKS ONLY

Please search the internet and provide DIRECT DOWNLOAD LINKS (not just descriptions) for:

#### 1. Yoma Bank Specific Documents
- Yoma Bank Business Banking Portal User Manual (PDF) — I've heard there's one at yomabank.com
- Yoma Bank bulk payment CSV template or sample file
- Yoma Bank deposit slip images or receipt formats
- Yoma Bank corporate account opening forms (to understand field requirements)
- Any Yoma Bank operational document showing their payroll file format

#### 2. Payroll Documents with Employee Lists (any bank)
I specifically need documents that contain a TABLE of employees with columns like:
- Employee Name
- Phone Number / MSISDN / Account Number
- Salary Amount
- NRC Number (Myanmar National ID)

These could be:
- Sample payroll spreadsheets (Excel/CSV) with 10-50 employee rows
- PDF payroll reports showing employee tables
- Corporate salary disbursement request forms with employee lists
- Bulk payment instruction files (any Myanmar bank)

Please search on:
- Scribd (scribd.com) — search "Myanmar payroll", "Yoma Bank payment", "salary disbursement Myanmar"
- SlideShare — search "Myanmar payroll template"
- DocPlayer — search "Yoma Bank bulk payment"
- GitHub — search "myanmar payroll sample data"
- Kaggle — search "Myanmar salary data"
- World Bank / IFC — search "Myanmar mobile money", "Myanmar digital payments"
- UNCDF (UN Capital Development Fund) — they have Myanmar financial inclusion reports
- Google Scholar — search "Wave Money corporate disbursement"

#### 3. Myanmar Bank Deposit Slip / Receipt Images
I need actual IMAGES (PNG/JPG/PDF) of:
- Yoma Bank deposit receipts
- Yoma Bank mobile banking transfer screenshots
- Yoma Bank payment confirmation screens
- Any Myanmar bank deposit slip with: depositor name, amount, date, transaction ID, remark

Search on:
- Google Images: "Yoma Bank deposit slip", "Yoma Bank receipt", "Yoma Bank transfer confirmation"
- Google Images: "KBZ bank deposit receipt Myanmar", "CB Bank payment slip"
- Pinterest/Behance: "Myanmar bank receipt design"
- App store screenshots: Yoma Bank Next app, Wave Money app

#### 4. Wave Money Corporate Disbursement
- Wave Money partner documentation (partners.wavemoney.com.mm)
- Wave Money Utiba bulk upload file format or template
- Wave Money corporate wallet configuration guide
- Pay with Wave integration documentation (github.com/DigitalMoneyMyanmar)

#### 5. Myanmar NRC Data
- Complete township code list (all 330+ townships, state-to-township mapping)
- NRC validation dataset (HuggingFace, Kaggle, or GitHub)
- Sample NRC numbers for testing (anonymized/fake)

### Format Requirements

For EACH link you provide, please include:
1. **Direct URL** (must be clickable — not just "search on Google for...")
2. **File type** (PDF, XLSX, CSV, PNG, JPG, JSON, etc.)
3. **What it contains** (brief description)
4. **Access requirements** (free download? login needed? paid?)
5. **Relevance score** (HIGH / MEDIUM / LOW for our Yoma Bank payroll automation project)

I prefer:
- Direct download links over "search for X on Y"
- Free resources over paid ones
- Yoma Bank specific over generic Myanmar banking
- Documents with actual employee data tables over summary-only documents
- Recent documents (2023-2026) over older ones

If a resource requires registration/login, still include the link but note the requirement.
```

---

## What to do with responses

1. Save each response to `research/findings/{ai_name}_samples_response.md`
2. Test each downloadable link — does it actually work?
3. Download working files to `research/real_samples/` with descriptive names
4. Report back which links worked and what data we got

## Priority downloads (if found)

| Priority | What | Why |
|----------|------|-----|
| **Critical** | Yoma Bank BBP User Manual PDF | Documents the exact CSV column specs |
| **Critical** | Any payroll doc with 10+ employee rows (name + phone + amount) | Test AI extraction accuracy |
| **High** | Yoma Bank deposit slip image | Test bank slip vision extraction |
| **High** | NRC township dataset (JSON/CSV) | Build NRC validation |
| **Medium** | Wave Money partner docs | Understand Utiba format officially |
| **Low** | Generic payroll templates | We already have our own sample CSV |
