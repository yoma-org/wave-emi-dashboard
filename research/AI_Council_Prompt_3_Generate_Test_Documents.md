# AI Council Prompt #3 — Generate Test Payroll Documents

> Send to: ChatGPT, Gemini, Grok (any AI with image/document generation)
> Goal: Get downloadable sample payroll documents with employee tables to test our AI extraction pipeline

---

## The Prompt

```
I need you to help me create REALISTIC sample payroll and bank payment documents for testing an AI document extraction system. These are for a Myanmar banking salary disbursement project.

I need MULTIPLE documents in DIFFERENT formats and layouts. For each document, please generate the content as a clean, structured table that I can paste into a spreadsheet and export as an image/PDF.

### Document Set 1: Yoma Bank Payroll Instruction (10 employees)

Create a document that looks like a corporate payroll instruction to Yoma Bank with:

**Header:**
- COMPANY_NAME: Myanmar Golden Star Trading Co., Ltd
- PAYROLL_MONTH: 04/2026
- BANK_ID: YOMAMM
- TOTAL_RECORD: 10

**Employee table with columns:**
SR_NO | EMPLOYEE_NAME | EMPLOYEE_ACCT_ID | AMOUNT | CURRENCY | PAY_TYPE | NARRATION

**Requirements:**
- Use realistic Myanmar names (mix of U, Daw, Ko, Ma prefixes)
- Account numbers: 14-digit Yoma Bank format (start with 0014 or 0055)
- Amounts: vary between 150,000 and 800,000 MMK
- PAY_TYPE: all "SALARY"
- NARRATION: "Myanmar Golden Star_Salary_APR'26"
- Include a TOTAL row at bottom
- Currency: all MMK

### Document Set 2: Wave Money Payroll (15 employees, phone-based)

Create a payroll document for Wave Money mobile wallet disbursement with:

**Header:**
- Company: Shwe Taung Development Co., Ltd
- Period: March 2026
- Type: SalaryToMA (Mobile Account)
- Corporate Wallet: 1200000289

**Employee table with columns:**
No. | Employee Name | Phone Number (MSISDN) | Salary Amount (MMK)

**Requirements:**
- Use realistic Myanmar names (some with prefixes like U, Daw, Ko, Ma, some without)
- Phone numbers: Myanmar format 09xxxxxxxxx (11 digits, mix of 097x, 098x, 094x prefixes)
- Include 2-3 INTENTIONAL errors for testing:
  - One phone number with only 9 digits (too short)
  - One phone number starting with 08 (wrong prefix)
  - One employee with amount = 0
- Amounts: vary between 200,000 and 1,500,000 MMK
- Include TOTAL row

### Document Set 3: KBZ Bank Salary Transfer (8 employees)

Create a KBZ Bank format payroll with:

**Header:**
- Company: Mingalar Cement Industries Ltd
- Account: 0301-2134-5678-01 (KBZ format)
- Date: 2026-04-01
- Reference: KBZ-SAL-202604-001

**Employee table with columns:**
No. | Beneficiary Name | Account Number | Amount (MMK) | NRC Number | Remark

**Requirements:**
- Myanmar names (some English, some with Myanmar titles)
- KBZ account numbers: 16-17 digits
- NRC numbers in format: [1-14]/[TOWNSHIP]([N/E/P])[6 digits]
  Examples: 12/TAMANA(N)234567, 7/PATHEI(N)456789
- Amounts: vary 300,000 - 2,000,000 MMK
- Include TOTAL row

### Document Set 4: Simple Client Payment Request (12 employees)

Create an informal-looking payment request (as if a client typed it in Excel and printed to PDF):

**Header:**
To: Wave Money Operations Team
From: Pacific Star Garment Factory
Subject: April 2026 Salary Disbursement
Date: April 5, 2026

Dear Sir/Madam,
Please process the following salary payments for our employees:

**Simple table:**
Name | Phone | Amount

**Requirements:**
- Myanmar names, some with English names mixed in
- Phone numbers: 09xxxxxxxxx format
- Include 1 employee with phone starting with +959 (international format)
- Include 1 employee with phone formatted as "09 78-123-4567" (with spaces and dashes)
- Amounts in round numbers (200,000, 350,000, etc.)
- Include total at bottom
- Sign off: "Authorized by: U Aung Min, Managing Director"

### Document Set 5: Bank Deposit Slip / Transfer Receipt

Create a bank deposit receipt that looks like a Yoma Bank transfer confirmation:

**Fields:**
- Bank: Yoma Bank Limited
- Branch: Yangon Main Branch (001)
- Date: 2026-04-03
- Transaction ID: YOMA-TXN-20260403-87654
- Depositor: Pacific Star Garment Factory
- Depositor Account: 0014-2234-5678-9012
- Amount: 8,500,000 MMK
- Amount in Words: Eight Million Five Hundred Thousand Myanmar Kyats
- Purpose: Corporate Salary Disbursement April 2026
- Remark: SAL-APR26-PACIFIC-STAR
- Verified by: Ma Hnin Wai (Teller ID: T-0452)
- Signature: _______________

### Output Format

For EACH document:
1. Give me the COMPLETE content as a formatted table (markdown or plain text)
2. Make it look as realistic as possible — like a real corporate document
3. Include all Myanmar naming conventions (U, Daw, Ko, Ma, Dr., Mg, Saw, Nang prefixes)
4. Use realistic Myanmar phone numbers and bank account numbers
5. If you can generate an IMAGE of the document, please do so
6. If not, format it clearly enough that I can paste into Excel/Google Sheets and screenshot it

I need these documents to be VARIED in layout — different column orders, different headers, different formatting — because I'm testing whether my AI extraction can handle any format, not just one template.
```

---

## After Getting Responses

1. Paste each table into Google Sheets or Excel
2. Format to look like a real document (add borders, header styling, company logo placeholder)
3. Export as PNG at high resolution (1200px+ width)
4. Save to `research/real_samples/test_documents/`:
   - `payroll_yoma_golden_star_10emp.png`
   - `payroll_wave_shwe_taung_15emp.png`
   - `payroll_kbz_mingalar_8emp.png`
   - `payment_request_pacific_star_12emp.png`
   - `deposit_slip_yoma_pacific_star.png`

## Why These 5 Specific Documents

| Document | Tests | Variation |
|----------|-------|-----------|
| Yoma Bank Payroll (10 emp) | Bank account extraction, not MSISDN | Matches PyiGyiKhin.pdf format |
| Wave Money Payroll (15 emp) | MSISDN extraction + intentional errors | Tests error detection |
| KBZ Bank Salary (8 emp) | Different bank, NRC numbers | Multi-bank support |
| Simple Client Request (12 emp) | Messy format, informal layout | Real-world client emails |
| Deposit Slip | Bank slip vision extraction | Finance's 5 required fields |
