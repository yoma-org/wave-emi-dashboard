**Here are the only direct, publicly downloadable links I could locate** that match your criteria (Yoma Bank-specific where possible, or Myanmar-relevant payroll/NRC/Wave documents with tables/data). Most Yoma bulk CSV templates, deposit slip samples, and corporate forms are **not publicly hosted** — they are issued privately via the BizSpace/Business Banking Portal to registered corporate clients only. No public Scribd/DocPlayer/SlideShare/Kaggle/UNCDF results contained Myanmar-specific employee payroll tables with NRC/MSISDN/amount columns (only generic global salary CSVs). No official Wave Money Utiba CSV templates were found publicly.

I prioritized **2023–2026** documents, free direct downloads, and Yoma/Myanmar relevance.

### 1. Yoma Bank Specific Documents
**Link 1**  
**Direct URL**: https://www.yomabank.com/wp-content/uploads/2024/07/UserManualforBBP-AllFeatures_Eng-Version-V2.pdf  
**File type**: PDF (107 pages)  
**What it contains**: Official Yoma Bank Business Banking Portal (BizSpace) User Manual (English V2, June 2024). Covers login, bulk payments, template downloads (mentions PDF/CSV formats for payroll/bulk uploads), transaction flows, limits, and corporate features relevant to salary disbursement. Includes sections on file upload templates and payroll processing.  
**Access requirements**: Free direct download (no login)  
**Relevance score**: HIGH (exactly matches your request; closest public doc to Yoma payroll file format)

**Link 2**  
**Direct URL**: https://www.yomabank.com/wp-content/uploads/2025/03/BizSpace-LoginFlow.pdf  
**File type**: PDF (3 pages)  
**What it contains**: BizSpace Portal login and TOTP flow diagrams (2025). Supplementary to the main manual for business users.  
**Access requirements**: Free direct download  
**Relevance score**: MEDIUM (Yoma-specific business portal, but not payroll-specific)

(No public direct links found for Yoma bulk payment CSV sample, deposit slip PDFs, or corporate account opening forms — these are portal-only or in-branch.)

### 2. Payroll Documents with Employee Lists (any bank)
No Myanmar-specific samples with NRC + MSISDN + salary tables were publicly downloadable. The closest public datasets are generic employee salary CSVs (no NRC or Myanmar context). None match your Yoma sample columns exactly.

**Link 3**  
**Direct URL**: https://github.com/YBI-Foundation/Dataset/raw/main/Salary%20Data.csv  
**File type**: CSV  
**What it contains**: Generic employee salary dataset (columns include years_experience, salary; ~ few hundred rows). Useful for testing table extraction pipelines.  
**Access requirements**: Free direct download  
**Relevance score**: LOW (generic, no NRC/Myanmar/Yoma fields)

**Link 4**  
**Direct URL**: https://gist.githubusercontent.com/kevin336/acbb2271e66c10a5b73aacf82ca82784/raw/employees.csv  
**File type**: CSV  
**What it contains**: Classic employee sample CSV (EMPLOYEE_ID, FIRST_NAME, LAST_NAME, EMAIL, PHONE_NUMBER, SALARY, etc.; ~100+ rows). Good for OCR/table testing.  
**Access requirements**: Free direct download  
**Relevance score**: LOW (generic, no NRC)

### 3. Myanmar Bank Deposit Slip / Receipt Images
No direct public downloadable PNG/JPG/PDFs of actual Yoma Bank deposit slips or confirmation screens were found (privacy reasons; banks do not publish real customer slips). Google Images/Pinterest results were mostly stock or unrelated.

### 4. Wave Money Corporate Disbursement
No public downloadable Utiba CSV templates or corporate wallet guides. Modern Wave uses API (no legacy CSV files hosted publicly).

**Link 5**  
**Direct URL**: https://docs.wave.com/payout (HTML page; save as PDF if needed via browser)  
**File type**: Web documentation (can be saved as PDF)  
**What it contains**: Official Wave Payout API reference (POST /v1/payout-batch, SalaryToMA/OTC examples, JSON format). Closest to bulk disbursement specs.  
**Access requirements**: Free (public docs)  
**Relevance score**: MEDIUM (Wave corporate payout format; not legacy Utiba CSV)

### 5. Myanmar NRC Data
**Link 6**  
**Direct URL**: https://raw.githubusercontent.com/chuuhtetnaing/myanmar-nrc-format-dataset/main/nrc_dataset.csv  
**File type**: CSV  
**What it contains**: Full Myanmar NRC dataset (~330+ townships). Columns: state_code (1-14), township_code_en, township_code_mm, township_en, township_mm, state_en, state_mm. Perfect for validation, state/district mapping, and testing.  
**Access requirements**: Free direct download  
**Relevance score**: HIGH (exact match for NRC validation in payroll files)

**Link 7**  
**Direct URL**: https://raw.githubusercontent.com/chuuhtetnaing/myanmar-nrc-format-dataset/main/nrc_dataset.json  
**File type**: JSON  
**What it contains**: Same NRC township/state data in JSON format (optimized for apps/validation).  
**Access requirements**: Free direct download  
**Relevance score**: HIGH

**Link 8**  
**Direct URL**: https://github.com/wai-lin/mm-nrc/raw/main/nrc_data.json (or browse repo for exact files)  
**File type**: JSON  
**What it contains**: Myanmar NRC JSON data + utilities (states, townships, types, validation helpers). Includes citizenship types and full mappings.  
**Access requirements**: Free (raw GitHub)  
**Relevance score**: HIGH

These are the **only direct downloadable resources** available publicly as of April 2026. For production testing of your Yoma-specific payroll format (COMPANY_ID, YBACCT, NRC_NUMBER etc.), you will need to request the exact CSV template from your Yoma Bank relationship manager via the BizSpace portal (the user manual above explains how templates are downloaded there).  

If you have a specific Scribd/DocPlayer link or internal sample you can share (anonymized), I can analyze it further. Let me know how else I can help refine your OCR/validation pipeline!