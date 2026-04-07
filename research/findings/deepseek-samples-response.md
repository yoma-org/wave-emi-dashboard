While direct public download links for official Yoma Bank templates are intentionally limited for security, I have gathered specific, actionable resources across each category. The most valuable assets are the technical integrations and the authoritative NRC dataset, which are crucial for automating extraction and validation.

### 🏦 Yoma Bank Specific Documents
Public-facing portals and app stores provide insights into the bank's data structure, but direct download links to official user manuals and bulk templates are not available online for security reasons. These resources must be obtained directly from the bank's relationship manager.

*   **User Manuals (General)**: While a direct link to a PDF manual is unavailable, Yoma Bank maintains a **FAQs** page for its digital banking services, which includes step-by-step guides for transactions. These pages can inform your understanding of the user flow and potential data fields[reference:0].
    *   **Link**: [FAQs | Yoma Bank](https://www.yomabank.com/faqs)
    *   **File Type**: HTML webpage.
    *   **Content**: Step-by-step guides for login, account management, and digital banking transactions.
    *   **Access**: Free.
    *   **Relevance**: MEDIUM – Provides insight into standard banking processes.

*   **User Guides (Mobile App)**: Official app store pages for the **Yoma Bank Next** app detail its features, such as "Own Account Transfer" and "Other Account Transfer"[reference:1]. While not a direct link to a document, this is the primary source of information for the bank's digital interface.
    *   **Link**: [Yoma Bank Next on the App Store](https://apps.apple.com/app/yoma-bank-next/id1617182227)
    *   **File Type**: App Store page.
    *   **Content**: Feature list of the mobile banking app, including "Other Account Transfer" for payments to over 50 other banks[reference:2].
    *   **Access**: Free.
    *   **Relevance**: MEDIUM – Good for understanding mobile transaction receipts.

*   **Account Opening Forms**: A corporate account opening requirements page is available, listing the necessary forms (e.g., Form E, Form 6, Form 26) and KYC documents.
    *   **Link**: [Business Account Compare | Yoma Bank](https://www.yomabank.com/en/business/account-compare)
    *   **File Type**: HTML webpage.
    *   **Content**: A list of required documents (Form E, Form 6, Form 26, NRC/passport of board members, etc.).
    *   **Access**: Free.
    *   **Relevance**: LOW – The document is not downloadable, but it provides a checklist of required information.

### 👨‍💼 Payroll Documents with Employee Tables
While a generic "Yoma Bank" payroll CSV is not public, payroll systems offer a valuable alternative. The `GlobalHR` employee setup page details the exact fields needed for salary processing, providing real-world context for your data model.

*   **Employee Setup Fields (GlobalHR)**: This page shows the exact fields required for setting up employees for payroll, including key identifiers like **Name, Myanmar Name, NRC No., and Phone**, and includes a screenshot of the system.
    *   **Link**: [Employee Setup - Global HR](https://www.globalhr.com.mm/employee-setup)
    *   **File Type**: HTML webpage.
    *   **Content**: A detailed guide with a screenshot showing the exact employee fields used in a Myanmar payroll system.
    *   **Access**: Free.
    *   **Relevance**: HIGH – Provides real-world field names and a screenshot of a data entry form for Myanmar payroll, which is ideal for training an AI on field labels and layouts.

### 🏧 Myanmar Bank Deposit Slip / Receipt Images
Direct images of deposit slips are not typically published online. However, mobile banking interfaces can provide a reliable proxy for receipts.

*   **Yoma Bank Next App Interface**: The official app page for Yoma Bank Next lists features like "View transaction history" and "Other Account Transfer"[reference:3].
    *   **Link**: [Yoma Bank Next on the App Store](https://apps.apple.com/app/yoma-bank-next/id1617182227)
    *   **File Type**: App Store page.
    *   **Content**: Feature list of the mobile banking app, including "View transaction history".
    *   **Access**: Free.
    *   **Relevance**: MEDIUM – The app interface is the primary source for the layout of digital receipts and transaction confirmations.

### 📱 Wave Money Corporate Disbursement
Wave Money provides official API documentation for its B2B and B2C payout services. The GitHub repository is a crucial technical resource for integration.

*   **GitHub Repository**: This repository contains documentation for the **Pay with Wave Payment Gateway**, which includes essential information for merchant technical integration. It is a vital source for understanding the API structure.
    *   **Link**: [wave-payment GitHub Repository](https://github.com/Darkshadow2019/wave-payment)
    *   **File Type**: GitHub Repository (Markdown).
    *   **Content**: "Pay with Wave Payment Gateway Documentation" for online merchants, covering technical integration details.
    *   **Access**: Free.
    *   **Relevance**: HIGH – Direct technical documentation for integrating Wave Money payments, which is invaluable for your automation system.

*   **Official Wave API Documentation**: Wave's official B2B Payout API documentation provides a programmatic way to send money from your business to another business.
    *   **Link**: [Wave B2B Payout API Documentation](https://docs.wave.com/b2b-payouts)
    *   **File Type**: Official API documentation webpage.
    *   **Content**: REST API details for sending money to clients and checking wallet balances.
    *   **Access**: Free (requires a Wave Business account for API keys).
    *   **Relevance**: HIGH – Official technical documentation for the exact API you need.

### 🆔 Myanmar NRC Data
This is the most fruitful category, with a complete, downloadable dataset available. This dataset is a perfect resource for populating your test database with realistic NRC numbers and validating your extraction logic.

*   **Complete NRC Format Dataset (GitHub)**: This repository contains the authoritative, cleaned, and standardized data for Myanmar NRC formats. It is the best single source for validation rules, township codes, and state codes.
    *   **Link**: [myanmar-nrc-format-dataset](https://github.com/chuuhtetnaing/myanmar-nrc-format-dataset)
    *   **File Type**: GitHub Repository (CSV).
    *   **Content**: A CSV file with complete mapping of state codes, township codes, and NRC format rules. This is the **dataset you need**.
    *   **Access**: Free.
    *   **Relevance**: HIGHEST – Directly provides the structured data you need for NRC validation and testing.

*   **Flutter Package (mm_nrc)**: This package provides an input form for Myanmar NRC numbers, which can help you understand how NRCs are broken down into components for user input.
    *   **Link**: [mm_nrc Flutter package](https://pub.dev/packages/mm_nrc)
    *   **File Type**: Flutter package page.
    *   **Content**: Code examples for splitting NRC numbers (e.g., `12/LAMANA(N)123456` into state, township, type, and number).
    *   **Access**: Free.
    *   **Relevance**: HIGH – The code examples provide a ready-made regex pattern for parsing NRCs, which you can adapt for your system.

### 🔍 How to Find More Documents
*   **NRC Data**: The `myanmar-nrc-format-dataset` on GitHub is the primary resource. The `mm_nrc` Flutter package and `laravel-myanmar-nrc` provide ready-made code for parsing and validation[reference:4][reference:5].
*   **Payroll Data**: Focus on screenshots and documentation from HR and payroll software like GlobalHR, as these provide the most realistic and accessible data models for your AI to learn from.
*   **Corporate Banking**: Official Yoma Bank resources are often behind login portals. Reaching out to a Yoma Bank relationship manager is the most direct way to obtain their official user manuals, bulk payment templates, and API documentation.

If you have any questions as you work through these resources, feel free to ask.