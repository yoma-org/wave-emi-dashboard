Finding real, unredacted corporate payroll files and proprietary banking API documentation on the open web is challenging due to financial data privacy regulations and non-disclosure agreements. However, there are several publicly accessible, official resources and datasets that are perfect for stress-testing an automated data extraction pipeline.

Here are the direct download links to the most relevant assets available.

### 1\. Yoma Bank Specific Documents

While internal BBP (Business Banking Portal) CSV templates are kept behind client logins, Yoma Bank’s official enterprise forms and portal manuals provide the exact field nomenclature your system will need to extract.

**BizSpace Portal Login & Verification Flow**

  * **URL:** [https://www.yomabank.com/wp-content/uploads/2025/03/BizSpace-LoginFlow.pdf](https://www.yomabank.com/wp-content/uploads/2025/03/BizSpace-LoginFlow.pdf)
  * **File Type:** PDF
  * **What it contains:** Step-by-step screenshots of the new BizSpace corporate portal, showing the UI for business logins, TOTP verification, and company selection.
  * **Access:** Free / Public
  * **Relevance Score:** **HIGH** (Provides the exact UI terminology and layout for Yoma's current corporate portal).

**BizSpace Transaction & Bulk Payment Flow**

  * **URL:** [https://www.yomabank.com/wp-content/uploads/2025/03/BizSpace-TransactionFlow.pdf](https://www.yomabank.com/wp-content/uploads/2025/03/BizSpace-TransactionFlow.pdf)
  * **File Type:** PDF
  * **What it contains:** Screenshots of the transaction authorization process, including the "Bulk Payment" and "Schedule Payment & Approvals" screens.
  * **Access:** Free / Public
  * **Relevance Score:** **HIGH** (Crucial for understanding the approval flow for bulk disbursement files).

**Digital Service Request Form (Enterprise)**

  * **URL:** [https://www.yomabank.com/wp-content/uploads/2024/10/digital-service-request-form\_F-16-v2.0\_032022.pdf](https://www.yomabank.com/wp-content/uploads/2024/10/digital-service-request-form_F-16-v2.0_032022.pdf)
  * **File Type:** PDF
  * **What it contains:** The official form used to open a Yoma corporate account. It shows how Yoma explicitly maps fields like "National ID / Passport No" (နိုင်ငံသားစိစစ်ရေးကတ်ပြားအမှတ်) alongside English and Burmese text.
  * **Access:** Free / Public
  * **Relevance Score:** **MEDIUM** (Great for training OCR models on Yoma's bilingual table headers).

**Foreign Currency Remittance Application**

  * **URL:** [https://www.yomabank.com/wp-content/uploads/2023/06/Remittance\_Application-Form-Fillable.pdf](https://www.yomabank.com/wp-content/uploads/2023/06/Remittance_Application-Form-Fillable.pdf)
  * **File Type:** PDF
  * **What it contains:** A highly structured bank form detailing sender/beneficiary account numbers, SWIFT codes, and amounts.
  * **Access:** Free / Public
  * **Relevance Score:** **MEDIUM** (Useful for testing document parsing logic on structured grid layouts).

-----

### 2\. Myanmar NRC (National Registration Card) Data

To validate the `NRC_NUMBER` column in your payroll files, you need a complete mapping of Myanmar's state and township codes.

**Myanmar Townships & States Mapping**

  * **URL:** [https://github.com/yathit/myanmar-township/blob/master/myanmar-townships.json](https://github.com/yathit/myanmar-township/blob/master/myanmar-townships.json)
  * **File Type:** JSON
  * **What it contains:** A structured dictionary mapping all 14 Myanmar regions/states to their respective townships (e.g., `Yangon` -\> `Tamwe`).
  * **Access:** Free / Open Source (GitHub)
  * **Relevance Score:** **HIGH** (Essential for building an automated validation script to flag typos in the NRC district code).

**Myanmar NRC Validation Dataset & Scripts**

  * **URL:** [https://github.com/chuuhtetnaing/myanmar-nrc-format-dataset](https://www.google.com/search?q=https://github.com/chuuhtetnaing/myanmar-nrc-format-dataset)
  * **File Type:** Jupyter Notebook / Python scripts
  * **What it contains:** Code and datasets specifically designed for handling, formatting, and validating Myanmar National Registration Cards.
  * **Access:** Free / Open Source (GitHub)
  * **Relevance Score:** **HIGH** (Provides ready-made Python logic for handling the complex regex required for NRC extraction).

-----

### 3\. Payroll Documents and Corporate Disbursement Files

Real corporate payroll files containing functional MSISDNs, names, and NRCs are not hosted on public platforms like Scribd or SlideShare due to Myanmar's data protection frameworks.

Rather than searching for leaked data, the standard engineering approach for an extraction pipeline is to generate synthetic test data. You can easily write a Python script using libraries like `Faker` alongside the `myanmar-townships.json` file above to generate thousands of mock records matching the exact Yoma BBP schema you provided (`COMPANY_ID`, `EMPLOYEE_ACCT_ID`, `NRC_NUMBER`, etc.).

-----

### 4\. Wave Money & Utiba Platform

**Wave Money Corporate Documentation**

  * **Why there are no direct links:** Wave Money relies on the Utiba mobile financial services platform (owned by Amdocs). The specific CSV payload structures for `SalaryToMA` and `SalaryToOTC`, as well as the API endpoints (`POST /v1/payout-batch`), are strictly confidential. They are only distributed via PDF to registered integration partners through the authenticated Wave Business Portal.
  * **Alternative approach:** The headers you identified in your prompt are accurate to the Utiba standard. To test your pipeline without the official docs, you can create a test suite that explicitly validates the `TARGET_MSISDN` against standard Myanmar telecom regex (`^(09|\+?959)[2-9]\d{6,8}$`) and ensures the `AMOUNT` is an integer (Utiba often rejects floats with trailing decimals).

-----

### 5\. Bank Deposit Slips

High-resolution, unredacted physical deposit slips are rarely indexed by Google Images because they are usually shared privately via messaging apps (Viber/Telegram) between corporate finance teams and bank branch managers.

To test your vision model's OCR capabilities on mixed English/Burmese text and handwriting, I recommend using the **Digital Service Request Form** provided in section 1. You can print it, fill it out by hand, stamp it, and photograph it under different lighting conditions. This will yield a much more accurate test set for your specific pipeline than generic web images.

-----

Would you like to explore setting up a Python script to automatically generate synthetic CSV payroll files that perfectly match that Yoma Bank schema, complete with valid randomized NRC formats?