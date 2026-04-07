# AI Council Research Prompt — Myanmar Banking & Payroll Documents

> Copy this entire prompt and paste it into: Gemini, ChatGPT, Grok, DeepSeek, Perplexity, Qwen
> Save each response to `research/findings/` with the AI name as filename
> Example: `findings/gemini_response.md`, `findings/chatgpt_response.md`

---

## The Prompt

```
I'm building an AI-powered salary disbursement automation system for Wave Money in Myanmar. The system reads documents (bank slips, payment instructions, payroll files) attached to emails and extracts structured data for processing.

I need your help researching Myanmar banking document formats. Please be as specific and detailed as possible — include actual field names, column headers, file formats, and validation rules. Cite sources where possible.

### 1. Myanmar Bank Slip / Deposit Receipt Formats

What does a typical bank deposit slip look like from these Myanmar banks?
- Yoma Bank
- KBZ Bank (Kanbawza)
- CB Bank (Co-operative Bank)
- AYA Bank
- AGD Bank
- Myanmar Apex Bank

For each bank: What fields appear on their deposit receipts? (depositor name, amount, date, transaction ID, remark/narration, branch, account number, etc.)

Are there images, templates, or sample PDFs available online?

### 2. Corporate Salary Disbursement File Formats

When a company sends a bulk payroll file to a Myanmar bank for salary processing, what format does each bank require?

Specifically for Yoma Bank:
- We have a real sample with these columns: COMPANY_ID, COMPANY_NAME, PAYROLL_MONTH, PAYROLL_ID, FILE_ID, BANK_ID (YOMAMM), TOTAL_RECORD, SR_NO, COMPANY_ACCT_ID, EMPLOYEE_ACCT_ID, AMOUNT, CURRENCY, PAY_TYPE, EMP_ACCT (YBACCT), NARRATION, EMPLOYEE_NAME, NRC_NUMBER
- Is this a standard Yoma Bank format? Where is this documented?
- What does YBACCT mean as an EMP_ACCT type? Are there other types?
- What other banks use similar formats?

For KBZ Bank and CB Bank:
- What are their bulk payment CSV/Excel column requirements?
- Do they have downloadable templates?

### 3. Wave Money (Utiba Platform) Disbursement Format

Wave Money uses the Utiba platform for e-money disbursement. Their corporate salary disbursement involves these CSV files:
- SalaryToMA (mobile account direct transfer): AMOUNT, SOURCE_WALLET, TARGET_MSISDN, DESCRIPTION
- SalaryToOTC (over-the-counter agent payout): AMOUNT, SOURCE_WALLET, AGENT_ID, DESCRIPTION, MSISDN, EMAIL, 0, 0

Questions:
- Is there official documentation for these Utiba CSV formats?
- What is the Wave Money corporate wallet ID format? (we see IDs like 1200000147)
- How does Wave Money's batch payout API work? (POST /v1/payout-batch)
- What are the differences between SalaryToMA and SalaryToOTC processing?

### 4. Myanmar NRC (National Registration Card) Number

Format appears to be: [State 1-14]/[District code]([Citizenship type])[6 digits]
Example: 12/YANGON(N)123456

Questions:
- What are ALL valid state codes (1-14) and their names?
- What are the valid district codes for each state? (6-character codes like OUKAMA, TAMWAY, etc.)
- What are the citizenship type codes? (C, AC, NC, V, M, N — what does each mean?)
- Is the register number always 6 digits?
- Are there any known NRC validation libraries or regex patterns?

### 5. Myanmar Phone Number (MSISDN) vs Bank Account Number

Wave Money accounts use phone numbers (MSISDN: 09xxxxxxxxx).
Traditional bank accounts use different formats.

Questions:
- What is the standard bank account number format for Yoma Bank, KBZ Bank, CB Bank?
- How many digits? Is there a check digit?
- How can a system distinguish between a phone number and a bank account number?
- Are there any Myanmar banking standards for account number formats?

### 6. Myanmar Language (Burmese Script) in Banking Documents

Real payroll documents may contain Myanmar script (Burmese):
- Employee names in Burmese
- Handwritten annotations in Myanmar language
- Mixed English + Myanmar text

Questions:
- What Unicode range does Myanmar/Burmese use? (U+1000 to U+109F?)
- What are the common OCR challenges with Myanmar script?
- Which AI vision models handle Myanmar text best? (GPT-4o, Gemini, Claude?)
- Are there open-source Myanmar OCR tools or models?
- What does handwritten Myanmar text look like vs typed?

### 7. Document Variations and Edge Cases

In real-world Myanmar salary disbursement:
- What types of documents are typically attached to disbursement request emails?
- Are bank slips always printed/typed, or sometimes handwritten?
- Do different banks use different languages (English, Myanmar, or mixed)?
- What are common data quality issues? (wrong phone format, missing fields, duplicate entries, etc.)
- How do banks typically handle rejected payment files? (what error messages, what format?)

### 8. Compliance and Regulations

- What are Myanmar Central Bank requirements for electronic salary disbursement?
- Are there data retention requirements for payroll documents?
- What privacy regulations apply to employee salary data in Myanmar?
- Does Myanmar have any equivalent to GDPR or data protection laws for financial data?

Please provide as much specific detail as possible — field names, formats, regex patterns, URLs to documentation, sample data structures. If you can find actual CSV templates or document images, please describe them in detail.
```

---

## How to Use This Prompt

1. **Copy the entire prompt** between the ``` markers above
2. **Paste into each AI tool** (one at a time or in parallel)
3. **Save each response** as a markdown file in `research/findings/`:
   - `gemini_response.md`
   - `chatgpt_response.md`
   - `grok_response.md`
   - `deepseek_response.md`
   - `perplexity_response.md`
   - `qwen_response.md`
4. **After collecting all responses**, bring them back for analysis and synthesis

## What We're Looking For

| Priority | What | Why |
|----------|------|-----|
| **Critical** | Yoma Bank payment instruction field definitions | We have a real sample but no documentation |
| **Critical** | Bank account number format (vs MSISDN) | System needs dual-mode validation |
| **High** | NRC number validation rules | Real sample has NRC_NUMBER field |
| **High** | Other bank CSV templates (KBZ, CB) | System will need to handle multiple banks |
| **Medium** | Myanmar script OCR capabilities | Production will need Myanmar language support |
| **Medium** | Compliance requirements | Needed for production deployment |
| **Low** | Wave Money API documentation | Already have working Utiba format |
