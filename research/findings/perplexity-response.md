Yoma Bank's Business Banking Portal supports bulk payments for salary disbursement, but specific CSV column details like COMPANY_ID or YBACCT are not publicly documented in their user manual. Typical Myanmar bank deposit slips include fields such as account number, credit amount, reference, depositor name, date, teller, value date, and bank stamp, though bank-specific samples for Yoma, KBZ, CB, AYA, AGD, or Apex are scarce online. [scribd](https://www.scribd.com/document/831830466/bank-payment)

## Bank Slip Formats
Deposit slips from Myanmar banks generally feature standard fields without publicly available bank-specific PDFs or images. Common elements include:
- Account No.
- Credit Amount
- Reference/Narration
- Depositor Name
- Transaction Ref/Teller
- Value Date
- Branch
- Bank's stamp and signature (required for validity). [pdffiller](https://www.pdffiller.com/en/micro-catalog/banking/18226-bank-deposit-receipt-template.htm)

No templates found for listed banks; generic ones emphasize machine-readable formats for OCR processing.

## Payroll File Formats
Yoma Bank's portal includes a Bulk Payment section (Section 10 in manual), likely handling salary files via upload, but exact CSV/Excel specs like your sample (COMPANY_ID, EMPLOYEE_ACCT_ID as YBACCT) are not detailed publicly—YBACCT may denote Yoma Bank Account type, with others possible per internal docs. KBZ and CB lack downloadable templates online; generic bulk formats use columns like Ref (employee no.), Name, Amount, Account No., Branch Code (text, ≤16 chars, no headers). [payaccsys](https://www.payaccsys.com/csvpay.html)

| Bank | Known Format | Template Availability |
|------|--------------|-----------------------|
| Yoma | Bulk upload supported; custom fields probable  | No public CSV |
| KBZ/CB | Likely CSV: Employee ID, Name, Amount, Acct, Branch  [payaccsys](https://www.payaccsys.com/csvpay.html) | None found |

## Wave Money Formats
Wave Money's Utiba-like platform uses POST /v1/payout-batch for async batch payouts (poll for status: processing/complete), with JSON payloads per payout: currency, receive_amount, name, mobile (+95 prefix for Myanmar), optional national_id, payment_reason. No exact CSV docs for SalaryToMA (direct to MSISDN) or SalaryToOTC (agent), but API mirrors: TARGET_MSISDN/mobile vs AGENT_ID; wallet IDs like 1200000147 are business-specific. Differences: MA to mobile wallets (synchronous possible via /v1/payout), OTC via agents (batch, includes EMAIL/MSISDN). [yomabank](https://www.yomabank.com/wp-content/uploads/2024/07/UserManualforBBP-AllFeatures_Eng-Version-V2.pdf)

## NRC Number Format
Myanmar NRC: [State 1-14]/[District/Township]([Type])[6 digits], e.g., 12/YANGON(N)123456—always 6-digit register. States: 1-14 configurable (e.g., 12=Yangon); districts like TAMANA, OUKAMA, TAMWAY (6 chars); types: C=Citizen, presumed AC=Associate, NC=Naturalized, V=Visitor?, M/Military?, N=? Regex: ^(\d{1,2})/( [A-Z]{6} )(\([ACNCVMN]\))(\d{6})$. [apps.odoo](https://apps.odoo.com/apps/modules/19.0/noi_myanmar_nrc_format)

## Account vs MSISDN
Wave MSISDN: 09xxxxxxxxx (10 digits, +959). Bank accounts: 8-12 digits typical, no universal standard/check digit; Yoma/KBZ/CB use numeric, often branch-prefixed (e.g., SWIFT YOMAMMMY implies structured). Distinguish: regex ^09\d{9}$ for phone vs ^\d{8,12}$ for acct; length/phone prefix. [wise](https://wise.com/gb/swift-codes/YOMAMMMYXXX)

## Burmese Script Handling
Myanmar Unicode: U+1000–U+109F (Myanmar block); stacked consonants/medials challenge OCR (ligatures, vowel positioning). Best models: GPT-4o/Gemini (multilingual vision); open-source: Myanmar OCR tools for printed/handwritten (degraded manuscripts via transfer learning). Handwritten: cursive, variable stroke order vs typed (uniform fonts). [scribd](https://www.scribd.com/document/967137306/Myanmar-OCR)

## Document Edge Cases
Emails attach slips (printed, rarely handwritten), payroll CSVs/Excel (mixed Eng/Burmese names), instructions—issues: invalid MSISDN (no 09), missing NRC, dups, script errors. Banks reject via portal (e.g., Yoma approvals: pending/rejected). Languages: English primary, Burmese names/handwriting common. [payaccsys](https://www.payaccsys.com/csvpay.html)

## Compliance Rules
Central Bank of Myanmar (CBM) mandates registration/docs for payments; no specific salary e-disbursement rules found, but KYC tiers (e.g., ID for limits). Retention/privacy: Myanmar Data Protection Law (2023 draft equiv. GDPR) applies to financial data; retain payroll per CBM notifications (e.g., source-of-funds). [assets.kpmg](https://assets.kpmg.com/content/dam/kpmg/mm/pdf/2021/02/cbm-notification-No1-2021.pdf)