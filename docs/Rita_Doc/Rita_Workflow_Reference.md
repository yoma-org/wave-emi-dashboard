# Rita's EMI Disbursement AI Process Map — Reference

> Source: `Disbursement AI Process Map - Emoney Ops Commented.docx`
> This is a plain-text summary so we don't need to re-read the .docx each time.

---

## Overview

Rita's document describes the **complete Wave Money corporate salary disbursement workflow** in Myanmar, broken into **9 phases**. For each phase she explains:
- What the **Maker currently does manually**
- What an **AI agent should do** to automate or assist
- What **must stay human**

The core thesis: AI handles parsing, validation, file generation, and reporting. Humans handle Utiba uploads (no API), checker approvals (control point), and reversal sign-offs (policy requirement).

---

## Phase 1 — Request Intake (fully automatable)

**Current (manual):** Maker reads emails, re-reads approval forms, checks bank slips against forms, verifies Sales HOD + Finance HOD approvals are present.

**AI agent should:**
- Parse incoming email + attachments
- Extract: amount, client name, MSISDN list, approval metadata
- OCR the bank slip and confirm amount matches the form
- Validate that required approvers have signed off
- Flag anomalies before any human touches it

**Result:** Maker's first action becomes reviewing a structured, validated summary — not reading raw emails.

---

## Phase 2 + 5 — File Preparation (~80% effort reduction)

**Current (manual):** Maker manually builds File 1 (DMM Wallet -> Disbursement Ledger) and File 2 (Disbursement Ledger -> Corporate Wallet) in Excel, then converts to CSV. Same for SalaryToMA and SalaryToOTC files.

**AI agent should:**
- Take the approved MSISDN list + amounts from the parsed intake
- Auto-generate correctly formatted CSV files for each transaction type
- Handle description conventions (~Redisbursement, ~MSISDN Change)

**Result:** Maker reviews the generated files and uploads — that's it.

---

## Phase 3 — Maker-Checker Validation (AI-assisted)

**Current (manual):** Checker downloads CSV from Utiba/Liferay, manually cross-references every field against the original approval form, checks approvals, validates amounts.

**AI agent should:**
- Run the same validation programmatically — source account, target, amount, description, approval match
- Present Checker with a pass/fail summary with highlighted discrepancies

**Result:** Checker reviews exceptions, not every row. The actual approval click in Utiba stays human (no API, and this is the right control point to keep).

---

## Phase 4 — Wave Account Group Mapping (fully automatable)

**Current (manual):** Maker logs into Power BI, searches each MSISDN, checks the `Latest_Group_Map` column, prepares unmap + map bulk files based on the Corporate Agreement Database.

**AI agent should:**
- Query the BI report API with the MSISDN list
- Retrieve group status
- Cross-reference the Corporate Agreement Database for correct group assignment
- Generate the unmap + map files
- Exception flags (Agent category, KYC Level 3, Level_1) trigger a human review prompt rather than auto-processing

---

## Phase 6 — Reporting & Tracker Updates (fully automatable)

**Current (manual):** Maker checks status via Bulk Upload ID in Utiba, takes screenshots, generates report in Liferay, manually types tracker entry in SharePoint, writes internal and external emails.

**AI agent should:**
- Poll Liferay for the bulk report by ID
- Parse pass/fail status
- Generate the formatted transaction report
- Draft internal and external emails in the correct format (with password-protection instruction for OTC reports)
- Write the tracker entry to SharePoint
- Archive to the date-structured Share Drive folder

**Result:** Maker reviews and sends — not composes.

---

## Phase 7 — Reversal Identification (fully automatable)

**Current (manual):** Maker downloads SFTP report, does Excel VLOOKUP reconciliation against the tracker, identifies 30+ day pending transactions, emails the Sales team, waits for Sales Manager approval.

**AI agent should:**
- Scheduled task (e.g. every Wednesday) downloads the SFTP file
- Run reconciliation against the tracker automatically
- Generate the pending transaction report
- Route it to the Corporate Sales Team with the approval request
- After approval is received, generate the reversal CSV ready for upload

---

## Phase 8 — Reimbursement (AI-assisted, highest risk)

This is the highest-risk process because it involves correcting failed or successful transactions.

**AI agent should:**
- Validate the TID against the tracker to confirm failure status
- Generate the re-disbursement file with the correct description tagging
- Flag the MSISDN Change variant for mandatory Sales Manager approval before file generation

**Result:** Human reviews the AI's validation output before upload.

---

## Phase 9 — Block/Unblock (AI-assisted for bulk, manual for <50)

The SOP already makes this distinction:
- **Bulk (50+ TIDs):** Utiba bulk upload — AI generates the filtered MSISDN list and bulk file
- **Individual (<50):** Manual portal — stays as-is

---

## Three Things That Must Stay Human

1. **Utiba/Liferay file uploads** — No API exists. AI prepares a validated, ready-to-upload file and tells the human exactly where to go and what to click. Reduces this to a mechanical action, not a judgment call.

2. **Final Checker approval click** — This is THE control point. A named human takes a deliberate action in the system. What changes is that the Checker arrives with AI pre-validation complete, so they review exceptions rather than re-doing the Maker's work.

3. **Reversal approvals and MSISDN Change reimbursements** — Both require Sales Manager sign-off by policy. AI routes the request and generates the file ready to go pending that approval.

---

## Alignment with Our App + n8n Pipeline

| Phase | Rita's Rating | Our Coverage | Notes |
|-------|--------------|--------------|-------|
| 1: Request Intake | Fully automatable | **75%** | n8n + Gemini AI parses email. Missing: bank slip OCR, MSISDN extraction from email |
| 2+5: File Preparation | 80% reduction | **90%** | Full CSV generation with real Utiba format. Missing: ~Redisbursement/~MSISDN Change description tags |
| 3: Maker-Checker | AI-assisted | **60%** | Summary-level checker review. Missing: row-level AI cross-validation |
| 4: Group Mapping | Fully automatable | **40%** | Manual group config + CSV generation. Missing: Power BI API, Corporate Agreement DB lookup |
| 6: Reporting | Fully automatable | **30%** | Simulated monitoring + manual checklist. Missing: Liferay polling, SharePoint write, auto-archiving |
| 7: Reversals | Fully automatable | **0%** | Not built — requires SFTP access + live tracker |
| 8: Reimbursement | AI-assisted | **0%** | Not built — requires TID validation against live tracker |
| 9: Block/Unblock | AI-assisted bulk | **0%** | Not built — operational edge case |

**Key takeaway:** Our demo covers the **core happy path (Phases 1-3)** well. Phases 4-6 are partially covered. Phases 7-9 are production-only features that need live system access.
