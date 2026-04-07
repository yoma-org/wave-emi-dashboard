Below is a detailed breakdown of Myanmar banking formats, designed for building an AI-driven salary disbursement system. While public documentation is often limited, this guide combines the most reliable available sources and practical insights.

---

## 1. Myanmar Bank Slip / Deposit Receipt Formats

The deposit slips for Myanmar banks share a standard core of fields, with some minor variations. The standard fields are:

*   **Deposit slip/Transaction Receipt**: Date and time, Sender/Depositor Name, Sender/Depositor Account Number, Receiver/Beneficiary Name, Receiver/Beneficiary Account Number, Transaction Amount (MMK/Foreign Currency), Transaction Reference/ID, Branch Code/Location, and Remarks/Narration.

A key practice to be aware of is that **KBZ Bank explicitly allows customized deposit slips** for corporate customers, meaning the format of a business client’s deposit slip may differ from the standard retail version[reference:0].

**Note on Public Information:** High-resolution images or sample PDFs of these slips are not publicly available in official bank documentation. However, many banks display sample forms for specific services (like fixed deposits), which can serve as a useful reference for the type of fields and language used[reference:1].

---

## 2. Corporate Salary Disbursement File Formats

### Yoma Bank Format

The format you provided is indeed a **Yoma Bank bulk payment file**. The key field is `EMP_ACCT (YBACCT)`, which stands for **"Yoma Bank Account"** and indicates the employee's Yoma bank account number. The presence of `BANK_ID (YOMAMM)` confirms this is for Yoma Bank payroll processing.

Other banks likely use similar CSV formats, as `COMPANY_ID`, `EMPLOYEE_ACCT_ID`, `AMOUNT`, and `NARRATION` are standard fields. The specific `EMP_ACCT` field, however, appears unique to Yoma Bank.

**Documentation**: No official public API documentation for this format exists. The most reliable source for confirming the field definitions is the bank relationship manager.

### KBZ Bank Format

KBZ Bank’s payroll service is documented, and they support bulk payments to both KBZ bank accounts and KBZPay mobile wallets[reference:2][reference:3]. The processing results can be downloaded as CSV or Excel files, and the service is integrated with major HR systems like Better HR[reference:4].

### CB Bank Format

CB Bank supports bulk payments through its Business iBanking platform[reference:5]. They also offer a Viber chatbot for managing these services[reference:6]. The exact CSV column requirements are not public.

**Availability of Templates**: These are internal and not publicly accessible online. To obtain one, you must contact the bank's corporate customer service department.

---

## 3. Wave Money (Utiba Platform) Disbursement Format

### Corporate Wallet ID Format

The corporate wallet ID you provided (`1200000147`) appears to be a **10-digit numeric identifier** (`^[0-9]{10}$`). This is consistent with how many digital wallet platforms generate unique IDs.

### Batch Payout API

Wave Money provides a `POST /v1/payout-batch` API endpoint for sending money to multiple recipients[reference:7].

*   **Authentication**: API keys are used for authentication and are bound to a single business wallet[reference:8].
*   **Request Signing**: You can enable request signing to verify the integrity of your requests. This involves generating an HMAC-SHA256 signature and including it in a `Wave-Signature` header[reference:9].
*   **Processing**: Payouts are queued and processed asynchronously. A callback notification is triggered for each payout in the batch to report its status[reference:10].

### SalaryToMA vs. SalaryToOTC

*   **SalaryToMA (Mobile Account Direct Transfer)**: This is used for transferring money directly to a recipient's Wave wallet. The key identifier is `TARGET_MSISDN` (the recipient's phone number).
*   **SalaryToOTC (Over-the-Counter)**: This is for payouts that will be collected in cash from a Wave agent. The key fields are `AGENT_ID` (the designated agent) and the recipient's contact info (`MSISDN`).

### Official Documentation

Comprehensive API documentation is available at [docs.wave.com](https://docs.wave.com), covering authentication, the Payout API, batch processing, and webhooks for status updates[reference:11].

---

## 4. Myanmar NRC (National Registration Card) Number

### Format and Validation

The NRC follows this format: `[State/Division]/[Township Code]([Citizenship Type])[6-digit Number]`.

*   **Example**: `12/BAHANA(N)123456`[reference:12].
*   **Regex Pattern**: A practical regex pattern for validation is: `^\d{1,2}/[A-Z]{6}\([A-Z]{1,3}\)\d{6}$`[reference:13].

### State Codes (1-14)

The first part of the NRC is a 1- or 2-digit code representing the state or region[reference:14].

*   1 — Kachin State
*   2 — Kayah State
*   3 — Kayin State
*   4 — Chin State
*   5 — Sagaing Region
*   6 — Tanintharyi Region
*   7 — Bago Region
*   8 — Magway Region
*   9 — Mandalay Region
*   10 — Mon State
*   11 — Rakhine State
*   12 — Yangon Region[reference:15]
*   13 — Shan State
*   14 — Ayeyarwady Region

### Township/District Codes

These are 6-character codes. Examples include `BAHANA` (Botahtaung Township in Yangon) or `OUKAMA`[reference:16][reference:17]. For a complete and reliable dataset, use the `myanmar-nrc-format-dataset` on GitHub, which contains all townships mapped to their respective states[reference:18].

### Citizenship Type Codes

The code in parentheses indicates the holder's citizenship status under the 1982 Citizenship Law.

*   **N (Naing) / C**: Full Citizen[reference:19]
*   **AC**: Associate Citizen[reference:20]
*   **NC**: Naturalized Citizen[reference:21]
*   Other codes like **V, M, or FRC** exist for non-citizens holding a Foreign Registration Card (FRC), though they are less common for salary disbursement.

### Register Number

This is consistently **6 digits** (`^[0-9]{6}$`).

**NRC Validation Libraries**: Several open-source libraries can assist with validation and parsing, including `myanmar-nrc-format-dataset` (Python/CSV)[reference:22], `myanmar-nrc-x` (JavaScript)[reference:23], and `laravel-myanmar-nrc` (PHP)[reference:24].

---

## 5. Myanmar Phone Number (MSISDN) vs Bank Account Number

### Phone Number (MSISDN) Format

The local format begins with `09` followed by 7 to 9 digits, totaling 9 to 11 digits overall: `^09[0-9]{7,9}$`[reference:25]. The international format is `+95 9XXXXXXXXX`[reference:26].

### Bank Account Number Formats

*   **Yoma Bank**: The length is not publicly specified, but the standard format is numeric.
*   **KBZ Bank**: Savings/Current account numbers are **17 digits** long[reference:27]. The ATM card number is 16 digits.
*   **CB Bank**: Reports indicate account numbers can be **12** or **16 digits** long[reference:28][reference:29].
*   **AYA Bank**: The length is not publicly specified.

### Distinguishing Between Phone and Account Numbers

To distinguish between the two, you can use the following logic:
1.  **Check the prefix**: If it starts with `09` and the total length is 9-11 digits, it is almost certainly a phone number (MSISDN).
2.  **Check the length**: If it is 17 digits, it is very likely a KBZ bank account number.
3.  **Use context**: If the document is a payroll file with a `BANK_ID` column, any number in the `EMPLOYEE_ACCT_ID` column should be treated as a bank account number.
4.  **Validate with known patterns**: Implement a scoring system that checks the string against known regex patterns for phone numbers, KBZ accounts, and general numeric sequences.

### Myanmar Banking Standards

There is no publicly available, single standard for account number formats across all banks in Myanmar.

---

## 6. Myanmar Language (Burmese Script) in Banking Documents

### Unicode Range

Burmese script occupies the Unicode block `U+1000` to `U+109F`[reference:30]. The Myanmar government officially mandated the use of Unicode (specifically the Myanmar3 or Myanmar Unicode system) for all digital systems in 2019.

### OCR Challenges

OCR for Burmese script is notoriously difficult. The primary challenges include:
*   **Complex diacritics**: The script has numerous vowel and tone diacritics that appear above, below, and beside consonants, which are easy for OCR engines to misplace or miss entirely[reference:31].
*   **Circular characters**: The many circular and looping shapes can be confused with one another by standard OCR models[reference:32].
*   **Lack of training data**: There is a significant lack of high-quality, large-scale training datasets, resulting in poor performance from generic OCR models[reference:33].

### AI Vision Models for Burmese OCR

State-of-the-art OCR systems do not perform well on Burmese script[reference:34]. The most effective approach would be to fine-tune a specialized model (like a CNN+RNN+CTC architecture) using a custom dataset of Myanmar financial documents.

### Open-Source Tools

*   **Tesseract OCR**: The default Burmese model has limited accuracy, but you can train a custom model with your own data.
*   **EasyOCR**: May provide some support, but performance is not guaranteed.
*   **MyOCR (University of Computer Studies, Yangon)**: There is research on an OCR system specifically for Myanmar printed documents ("OCRMPD")[reference:35], but it is not publicly available as a ready-to-use tool.

**Tip**: For critical fields like NRC numbers and amounts, you might get better results by isolating numeric values (e.g., with OpenCV) and using a dedicated digit recognition model trained on Myanmar-style numerals (`၀၁၂၃၄၅၆၇၈၉`).

### Handwritten vs. Typed Text

*   **Typed (Printed)**: Clean, uniform characters that are easier for an OCR engine to recognize.
*   **Handwritten**: Highly variable. Cursive or semi-cursive Myanmar script presents a significant challenge. In this scenario, a human-in-the-loop (HITL) system for validation or manual data entry is likely necessary.

---

## 7. Document Variations and Edge Cases

### Common Document Types in Disbursement Requests

*   **Bank Slips/Transaction Receipts**: Scanned images or PDFs of deposit slips or fund transfer confirmations.
*   **Payment Instructions**: Often Excel or CSV files, sometimes with `xlsx` or `xls` formats.
*   **Payroll Files**: Standard Excel or CSV exports from an HR or payroll system.
*   **Salary Sheets/Invoices**: PDF files containing a detailed breakdown for a single month's payroll.

### Data Quality Issues

*   **Phone numbers**: Missing the `09` prefix, or having inconsistent spacing (e.g., `9 12345678`).
*   **Account numbers**: Spaces, hyphens, or parentheses in the number string.
*   **Amounts**: Missing commas or periods, incorrect decimal separators, or confusion between MMK and USD.
*   **Names**: Inconsistent capitalization, inclusion of honorifics, or partial names.
*   **Duplicate entries**: The same transaction appearing more than once in a file.
*   **Missing fields**: Cells in a CSV file that are unexpectedly empty.

### Rejected Payment File Handling

There is no single standard for error messages across banks. However, common practices include:
*   **File-level rejection**: The bank portal will reject the entire upload with a message like "Invalid file format" or "CSV column mismatch"[reference:36].
*   **Line-level rejection**: The portal may accept the file but flag specific rows for issues such as "Invalid account number" or "Insufficient balance"[reference:37].

---

## 8. Compliance and Regulations

### Central Bank of Myanmar (CBM) Regulations for Salary Disbursement

The CBM has actively pushed for digital payroll adoption. A 2024 directive mandated the expansion of digital salary payments for civil servants[reference:38]. All companies, regardless of size, must comply with **Anti-Money Laundering (AML)** regulations and **Customer Due Diligence (CDD)** requirements when processing large volumes of payments, as per the Anti-Money Laundering Law (2014)[reference:39].

### Data Retention and Privacy Regulations

There is **no single, comprehensive data protection law in Myanmar**. Instead, the legal framework is a patchwork of sector-specific regulations[reference:40].

*   **Electronic Transactions Law (2004, amended 2021)**: This is currently the primary law governing personal data protection[reference:41].
*   **Financial Institutions Law (2016)**: Mandates the protection of customer information held by banks[reference:42].
*   **Cybersecurity Law (2023)**: Imposes new security controls and data breach notification requirements on financial services[reference:43].
*   **Regulations for Mobile Financial Services (2016)**: Requires MFS providers to notify the CBM within two business days of any confidential data loss[reference:44].

In practice, the best approach is to follow international best practices for data protection: implement data minimization, ensure storage security, maintain a clear data retention and disposal policy, and obtain user consent before processing their personal data.

---

I hope this detailed breakdown provides a solid foundation for building your AI-powered system. Let me know if you need me to dig deeper into any of these areas.