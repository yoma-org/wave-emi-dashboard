Building an automated disbursement pipeline for Myanmar’s financial ecosystem presents unique data extraction and validation challenges, especially due to legacy systems, dual encodings, and unstructured physical documents. 

Here is a detailed breakdown of the formats, validation rules, and constraints for Myanmar banking and mobile money systems.

### 1. Myanmar Bank Slip / Deposit Receipt Formats

While exact layouts vary by bank and change frequently, most over-the-counter (OTC) deposit slips and digital transaction receipts from Yoma, KBZ, CB, AYA, and MAB share a highly standardized set of data points. Physical slips are typically multi-part carbon copies.

**Standard Extracted Fields:**
| Field | Description / Format |
| :--- | :--- |
| **Transaction Date/Time** | Usually `DD/MM/YYYY HH:MM:SS`. |
| **Transaction ID / UTR** | Unique Reference Number (often 12–16 alphanumeric characters). |
| **Sender/Depositor Name** | Free text (often mixed English/Burmese). |
| **Sender/Depositor ID** | Typically an NRC number or Passport. |
| **Beneficiary Name** | Free text. Matches the account holder name. |
| **Beneficiary Account No.** | 13 to 17 numeric digits. |
| **Amount** | Written in both numerical format (e.g., `1,000,000.00`) and spelled out in text (English or Burmese). |
| **Branch Code/Name** | e.g., "Kamayut Branch" or a 3-4 digit branch ID. |
| **Remark / Narration** | Free text for the payment purpose (e.g., "Salary for March"). |

**Availability:** Public templates are rarely published due to security policies. You will mostly encounter PDF exports generated from corporate portals (like KBZ iBanking or Yoma Business Banking Portal) or photos of stamped physical slips. 

### 2. Corporate Salary Disbursement File Formats

Banks in Myanmar do not share a universal standard for bulk payroll; each uses its own proprietary CSV or Excel template uploaded via their respective corporate portals.

**Yoma Bank:**
The sample you provided (`COMPANY_ID`, `COMPANY_NAME`, `PAYROLL_MONTH`... etc.) is the exact standard batch CSV format for the Yoma Business Banking Portal. 
* **Documentation:** This format is documented in Yoma's internal BBP (Business Banking Portal) user manuals provided directly to corporate clients upon onboarding. It is not publicly indexed.
* **EMP_ACCT Types:** * `YBACCT`: Yoma Bank Account (internal transfer).
    * `OTHER` / `CBMNET`: Other bank accounts routed via the CBM-Net (Central Bank of Myanmar) clearing system.
    * `WAVE`: Transfer to a Wave Money wallet.

**KBZ Bank & CB Bank:**
They typically utilize an Excel (`.xlsx`) or `.csv` upload format on their iBanking platforms. Typical required columns include:
* `No.` (Sequence)
* `Debit Account Number`
* `Beneficiary Name`
* `Beneficiary Bank` (if cross-banking)
* `Beneficiary Account Number`
* `Amount`
* `NRC Number`
* `Narration` / `Remarks`

### 3. Wave Money (Utiba Platform) Disbursement Format

Wave Money operates on the Utiba platform (now part of Amdocs Mobile Financial Services). 

* **Documentation:** The Utiba API and CSV specifications are strictly provided under NDA to business partners via the Wave Business Portal. 
* **API Mechanics:** Batch payouts via `POST /v1/payout-batch` require an API key and often IP whitelisting. The system validates the `TARGET_MSISDN` against registered KYC data before disbursing.
* **Wallet IDs:** Wave Corporate Wallet IDs typically use a 10-digit numerical format (e.g., `1200000147`).
* **SalaryToMA vs. SalaryToOTC:**
    * **SalaryToMA (Mobile Account):** Funds are transferred directly into the user's registered Wave Money digital wallet. The recipient is identified primarily by `TARGET_MSISDN` (their phone number).
    * **SalaryToOTC (Over-The-Counter):** Funds are staged for cash withdrawal. The recipient receives an SMS code and must present their physical NRC and phone number (`MSISDN`) at a physical Wave Agent (`AGENT_ID`) to cash out. The extra `0, 0` trailing fields in your CSV are typically legacy padding or fee-handling flags in the Utiba parser.

### 4. Myanmar NRC (National Registration Card) Number

The standard format is: `[State Code]/[Township Code]([Type])[6 Digits]`
*Example:* `12/YANGON(N)123456` or `၁၂/ပဘတ(နိုင်)၁၂၃၄၅၆`

* **State Codes (1-14):**
    1 (Kachin), 2 (Kayah), 3 (Kayin), 4 (Chin), 5 (Sagaing), 6 (Tanintharyi), 7 (Bago), 8 (Magway), 9 (Mandalay), 10 (Mon), 11 (Rakhine), 12 (Yangon), 13 (Shan), 14 (Ayeyarwady).
* **District/Township Codes:** A 6-letter abbreviation (e.g., `TAMWAY` for Tamwe, `OUKAMA` for Okkalapa).
* **Citizenship Types:**
    * `C` or `N` (Naing/နိုင်): Full Citizen
    * `AC` or `E` (Ae/ဧည့်): Associate Citizen
    * `NC` or `P` (Pyu/ပြု): Naturalized Citizen
    * `V` or `T` (Tha/သ): Temporary/Nationalized (Rare)
    * `M`: Sometimes used to denote Myanmar nationality in passport contexts, though less common on the internal NRC string.
* **Register Number:** Standardized to 6 digits, though older legacy cards sometimes contain 5 digits.
* **Validation Regex:** * English: `^(1[0-4]|[1-9])\/[A-Z]{6}\([N,AC,NC,V,M,C,E,P,T]\)\d{5,6}$`
    * Burmese script requires Unicode matching for the specific characters (e.g., နိုင်).

### 5. MSISDN vs. Bank Account Number

Systems commonly distinguish between the two based on length and prefix.

**Myanmar MSISDN (Phone Numbers):**
* **Format:** Always begins with `09` (domestic) or `+959` (international).
* **Length:** 9 to 11 digits total (e.g., `09-123456789`).
* **Regex:** `^(09|\+?959)[2-9]\d{6,8}$`

**Bank Account Numbers:**
* **Yoma Bank:** 16 digits.
* **KBZ Bank:** 17 digits for new accounts (e.g., `99930299920192931`); 13 digits for legacy accounts.
* **CB Bank:** 16 digits.
* **Check Digits:** Banks use internal Modulus checks, but algorithms are proprietary. An AI system should distinguish them by checking for the `09` prefix (Phone) vs. a 13-17 length numeric string lacking the `09` prefix (Bank Account).

### 6. Myanmar Language (Burmese Script) in OCR

* **Unicode Range:** `U+1000` to `U+109F`.
* **The Zawgyi vs. Unicode Challenge:** This is the hardest part of Myanmar OCR. Zawgyi is an ad-hoc, non-standard encoding that was dominant until 2019. Legacy systems and older documents still use it. Zawgyi glyphs overlap with the Unicode range but render completely different characters, breaking standard text extraction. 
* **OCR Specifics:** Burmese script has no spaces between words (only between phrases), utilizes heavy consonant stacking, and relies on complex diacritics placed above, below, and around base characters.
* **AI Vision Models:** * **Google Cloud Vision API:** Currently the industry leader for raw Burmese OCR.
    * **GPT-4o & Gemini:** Excellent at translating and extracting structured data from modern Unicode Burmese, but can hallucinate slightly when reading messy handwritten script or Zawgyi.
    * **Open Source:** Tesseract has a `mya` (Myanmar) language pack, but it struggles significantly with complex bounding boxes around stacked consonants.

### 7. Document Variations and Edge Cases

When parsing real-world emails for salary disbursement, expect the following edge cases:
* **Mixed Numerals:** Employees will submit NRCs and account numbers using Burmese numerals (၁၂၃၄၅၆) instead of Arabic numerals (123456). Your extraction layer must map `၁, ၂, ၃, ၄, ၅, ၆, ၇, ၈, ၉, ၀` to `1-9, 0`.
* **Physical Slips:** Often crumpled, stamped over crucial text, or feature handwritten annotations for the "Remark" field.
* **Data Quality:** Missing zeros in phone numbers (e.g., `912345678` instead of `0912345678`) and mismatched branch codes are the leading causes of batch payout rejections.
* **Rejections:** When a batch fails, banks usually return the uploaded CSV with an appended column at the end (e.g., `ERROR_CODE` or `REASON`), containing strings like "Invalid Account" or "MSISDN Unregistered".

### 8. Compliance and Regulations

* **Central Bank of Myanmar (CBM):** Governs Mobile Financial Services (MFS) via regulations like the *Mobile Financial Services Regulation*. It dictates strict KYC (Know Your Customer) rules, which is why bulk payouts require exact NRC and name matches.
* **Data Protection:** Myanmar does not have a comprehensive equivalent to the GDPR. However, the *Law Protecting the Privacy and Security of Citizens (2017)* and the *Electronic Transactions Law* dictate basic standards for electronic data interception and retention.
* **Retention:** Financial institutions and their corporate partners are generally required to retain transaction and payroll records for a minimum of 5 years to comply with local Anti-Money Laundering (AML) and Countering the Financing of Terrorism (CFT) guidelines.