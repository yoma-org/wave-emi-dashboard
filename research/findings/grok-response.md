**1. Myanmar Bank Slip / Deposit Receipt Formats**

Typical bank deposit slips (or deposit receipts/cash deposit vouchers) in Myanmar are printed forms issued at bank counters or branches. They are often in English (with some Myanmar script for customer details), include the bank's logo/header, and feature fields for manual or printed entry. Handwritten versions are common for over-the-counter deposits, while printed/typed ones appear for corporate or ATM-related slips. Official public templates or high-resolution sample PDFs are scarce on bank websites (they prioritize internal use or customer portals), but examples appear on forums like Scribd or in regulatory filings.

Common fields across **Yoma Bank**, **KBZ Bank**, **CB Bank**, **AYA Bank**, **AGD Bank**, and **Myanmar Apex Bank** (based on observed receipts/statements and standard Myanmar banking practice):
- **Bank name/logo and branch** (e.g., "Yoma Bank – Yangon Branch" or code).
- **Date** (DD/MM/YYYY or Myanmar calendar equivalent).
- **Depositor/Payer name** (full name, often in English + NRC reference).
- **Account number** (of the recipient/credit account).
- **Amount** (in figures and words; MMK or foreign currency; e.g., "Ks. 1,000,000" / "One Million Kyats").
- **Transaction ID / Receipt No.** (unique slip or voucher number, e.g., starting with branch code).
- **Narration/Remark/Memo** (purpose, e.g., "Salary deposit – Employee XYZ").
- **Depositor signature/stamp** (or teller verification).
- **Currency** (MMK primary; USD/EUR possible at some banks).
- **Source of funds** (sometimes: cash/cheque/transfer).

**Bank-specific notes** (from public samples and statements):
- **Yoma Bank**: Slips often reference "YOMA" branding. Fields include depositor name, account no., amount, date, narration. Corporate deposits may link to payroll IDs.
- **KBZ Bank (Kanbawza)**: Receipt vouchers (e.g., "RECEIPT VOUCHER") show "Received from", Memo, Amount (e.g., "Ks45,213,500"), No. (e.g., C2311039), and copy markings. Statements list "By Cash – Deposit", narration, branch.
- **CB Bank (Co-operative)**: Similar voucher-style; focus on account details and signatures. Less public samples, but aligns with cooperative banking norms.
- **AYA Bank**: Passbook-linked or slip formats emphasize account holder details and branch.
- **AGD Bank / Myanmar Apex Bank**: Standard fields; Apex statements show account no., date, description (e.g., "By Cash").

No official downloadable PDF templates were found on bank sites (they are provided in-branch). Scribd hosts scanned examples (e.g., KBZ payment receipts). Images of actual slips are rare publicly due to privacy; typical visuals show a simple A5/A4 form with table layout, bank watermark, and teller stamp.

**2. Corporate Salary Disbursement File Formats**

Myanmar banks require bulk payroll files (usually CSV/Excel) uploaded via internet banking portals for salary processing. Formats are bank-specific but share core fields for direct credits.

**Yoma Bank**:
- Your sample (COMPANY_ID, COMPANY_NAME, PAYROLL_MONTH, PAYROLL_ID, FILE_ID, BANK_ID (YOMAMM), TOTAL_RECORD, SR_NO, COMPANY_ACCT_ID, EMPLOYEE_ACCT_ID, AMOUNT, CURRENCY, PAY_TYPE, EMP_ACCT (YBACCT), NARRATION, EMPLOYEE_NAME, NRC_NUMBER) matches the standard corporate payroll upload format used by Yoma for salary bulk processing.
- **YBACCT** = Yoma Bank Account (internal code for account type in their system; other possible types might include external banks or wallets).
- This is **not publicly documented** on Yoma's site but is the expected format for corporate clients via their corporate internet banking. BANK_ID "YOMAMM" identifies Yoma as the receiving bank. It supports NRC for compliance/KYC.
- Documentation is provided to corporate clients via relationship managers or portal guides (not public).

**KBZ Bank**:
- Bulk payment via iBanking uses a specific Excel/CSV template (convert to CSV after deleting header row).
- Required columns (exact from KBZ Bulk Payment user manual):
  1. Customer ID (debit account owner ID)
  2. Debit Account (17-digit KBZ account)
  3. Debit A/C Branch (branch code)
  4. A/C Currency (e.g., MMK)
  5. Amount
  6. Txn Currency
  7. Date (ddmmyyyy)
  8. Payment Type ("A" for account transfer)
  9. Credit A/C (beneficiary account)
  10. Credit A/C Branch
  11. Email (optional)
  12. Remitter Narrative
  13. Beneficiary Narrative
- Downloadable template via KBZ iBanking portal (not public link). Supports salary disbursement as direct credit.

**CB Bank and others (AYA, AGD, Apex)**:
- Similar CSV/Excel bulk formats via their corporate portals (direct credit for payroll).
- No public downloadable templates found; provided to clients. Columns typically mirror KBZ (debit/credit accounts, amount, narration, date, beneficiary details). Some integrate with CBM-NET ACH for interbank.

All banks align with **CBM-NET ACH** for bulk (see section 8).

**3. Wave Money (Utiba Platform) Disbursement Format**

Wave Money (powered by Telenor/Yoma historically, now independent) uses the **Utiba platform** for legacy corporate bulk disbursements (CSV-based). Modern corporate users increasingly use the **Wave Payout API** (JSON-based).

- **SalaryToMA** (Mobile Account direct transfer): `AMOUNT, SOURCE_WALLET, TARGET_MSISDN, DESCRIPTION` → Direct credit to Wave user wallet (MSISDN = 09xxxxxxxxx).
- **SalaryToOTC** (Over-the-counter agent payout): `AMOUNT, SOURCE_WALLET, AGENT_ID, DESCRIPTION, MSISDN, EMAIL, 0, 0` → Routes to agent for cash pickup; extra fields for agent verification.
- **Official documentation**: Not fully public for legacy Utiba CSVs (corporate clients receive specs via Wave Business Portal). Modern API (docs.wave.com/payout) uses **POST /v1/payout-batch** (JSON array of payouts; no CSV upload). Parameters: mobile (E.164), receive_amount, currency, payment_reason, etc. Batch ID returned for polling status.
- **Corporate wallet ID format**: Numeric, e.g., 1200000147 (prefix often 12xxxx for corporate/business wallets).
- **Batch payout API**: `POST /v1/payout-batch` (async; JSON body with payouts array). Supports verification (`POST /v1/verify_recipient/`). Reversals possible within 3 days.
- **Differences**: SalaryToMA = instant wallet credit (for registered Wave users). SalaryToOTC = agent-mediated cash (for non-users or remote areas); higher fees, requires agent ID/MSISDN.

Utiba CSVs are legacy; API is current standard.

**4. Myanmar NRC (National Registration Card) Number**

Format: `[State 1-14]/[District/Township code]([Citizenship type])[6 digits]`  
Example: `12/YANGON(N)123456` or `12/OUKAMA(N)123456` (or full "NAING").

- **State codes (1-14)**: 1=Kachin, 2=Kayah, 3=Kayin, 4=Chin, 5=Sagaing, 6=Tanintharyi, 7=Bago, 8=Magway, 9=Mandalay, 10=Mon, 11=Rakhine, 12=Yangon, 13=Shan, 14=Ayeyarwady. (Standard mapping; full Burmese equivalents available in datasets.)
- **District/Township codes**: 3-6 character English (e.g., YANGON, OUKAMA, BAHANA, OKM, TAMWAY). Full lists in public datasets (e.g., Hugging Face myanmar-nrc-format-dataset) with ~300+ townships linked to states.
- **Citizenship types**: 
  - N / NAING = Citizen (full Myanmar citizen).
  - AC = Associate Citizen.
  - NC = Naturalized Citizen.
  - Others (V=Visitor/Temporary?, M=Mon? or specific ethnic, C= possibly Citizen variant) are less common; N is predominant for pink CSC cards.
- **Register number**: Always 6 digits.
- **Validation libraries/regex**: 
  - GitHub myanmar-nrc-x: Supports patterns like `[State]/[District]([NAING/N])[6 digits]`. Handles Unicode Burmese too.
  - Odoo module and Hugging Face datasets provide full lookup tables + validation.
  - Regex example: `^\d{1,2}/[A-Z]{3,6}\([A-Z]+\)\d{6}$` (English); extended for Burmese script.

**5. Myanmar Phone Number (MSISDN) vs Bank Account Number**

- **Wave Money**: MSISDN (09xxxxxxxxx – 11 digits, starts with 09).
- **Bank accounts**:
  - KBZ: 17 digits (saving/current).
  - Yoma/CB/others: Typically 10-17 digits (bank-specific; Yoma uses EMP_ACCT codes like YBACCT).
  - No universal check digit/standard (varies by bank; CBM does not enforce one format).
- **Distinction in system**: Regex/length + prefix: Phone = ^09\d{9}$; Bank = longer or non-09 start. Cross-check against bank BINs or NRC linkage. CBM-NET uses account number precedence over name.

**6. Myanmar Language (Burmese Script) in Banking Documents**

- **Unicode**: Primary Myanmar block U+1000–U+109F (consonants, vowels, tones, digits); extensions U+AA60–U+AA7F (more characters).
- **OCR challenges**: Abugida script with stacking (consonant clusters), medial/vowel diacritics, tone marks, font variations, poor scan quality, mixed English/Myanmar, handwriting variability.
- **Best AI models**: GPT-4o, Claude 3.5/Opus, Gemini 1.5 handle Burmese text extraction well (multilingual vision). Claude often strongest on complex scripts.
- **Open-source**: Tesseract OCR (with Myanmar training data); myOCR pipeline; custom HMM/neural nets (research papers show 90%+ on printed, lower on handwritten).
- **Handwritten vs typed**: Typed = clean, consistent glyphs. Handwritten = cursive, variable stroke thickness, overlapping; requires binarization/Otsu, segmentation. Datasets like BHDD exist for digits.

**7. Document Variations and Edge Cases**

- **Typical attachments**: Bank deposit slips (printed/handwritten/mixed), payroll CSVs/Excels, payment instructions, NRC scans, salary advice letters.
- **Printed vs handwritten**: Mix common; handwritten annotations frequent on slips.
- **Languages**: English primary on forms; Myanmar script for names/narration; mixed in real docs.
- **Data quality issues**: Wrong MSISDN format, missing NRC/amount, duplicates, OCR errors in Burmese names, invalid account lengths, currency mismatches, future-dated errors.
- **Rejected files**: Banks return error CSV/Excel with codes (e.g., "Invalid Account", "Insufficient Funds", "Closed Account"). Re-process after correction; CBM-NET returns unapplied payments within 4 hours.

**8. Compliance and Regulations**

- **CBM requirements**: Bulk salary via **CBM-NET ACH** (direct credits; max 3B MMK/transaction; 24/7 processing, DTNS settlement). Use CBM-NET FTS for interbank. Participants (banks/MFSPs) need agreements, 99.7% uptime, 2FA security.
- **Data retention**: Minimum 5 years for ACH/FTS records and business docs.
- **Privacy**: No full GDPR equivalent. Governed by Financial Institutions Law, CBM directives, and draft Personal Data Protection Law. Banks must maintain confidentiality; employee salary data is sensitive (KYC/NRC linkage required). CBM oversees financial data.

**Recommendations for your system**:
- Use OCR (GPT-4o + Tesseract fallback) with Myanmar Unicode support.
- Validate NRC via open-source libraries.
- Map bank-specific formats dynamically.
- Integrate Wave API for modern payouts; fallback to Utiba CSV for legacy.
- Test against CBM-NET rules for compliance.

Sources include official CBM PDFs, bank portals, GitHub repos, Wave docs, and public samples (2024–2026 data). For production, contact banks directly for latest templates. Let me know if you need code snippets (e.g., NRC regex validator) or further deep dives!