---
name: wave_emi_testing_guide_outlook_pipeline
aliases: ["Wave EMI Testing Guide (Outlook)", "Outlook Pipeline Testing Guide"]
description: Testing guide for Wave EMI Outlook pipeline - how to verify emails flow from emoney@zeyalabs.ai through n8n to dashboard. Note - written for v6 pipeline; portions still apply to current v13.2 but some steps need update.
type: reference
topics: [wave-emi, testing, outlook, n8n, qa]
status: active
created: 2026-04-10
last_reviewed: 2026-04-19
---

# Testing Guide — EMI Pipeline v6 (Outlook)

**For:** Vinh, Win, Binh, team members
**Updated:** April 10, 2026
**Control Mailbox:** emoney@zeyalabs.ai

---

## Important: Which URL to Use

| Environment | URL | Use For |
|---|---|---|
| **Production (Vercel Pro)** | **https://project-ii0tm.vercel.app** | Daily use, testing, demos |
| Legacy (Vercel Hobby) | https://wave-emi-dashboard.vercel.app | Old link, still works but use Pro |
| **GitHub Repo (Team)** | **https://github.com/yoma-org/wave-emi-dashboard** | Code, docs, pipelines |
| GitHub Repo (DK personal) | https://github.com/DKNguyenTrustify/Wave-eMoney | Same code, DK's backup |
| Supabase (Database) | https://supabase.com/dashboard/project/dicluyfkfqlqjwqikznl | DB admin (Tin, DK) |

**Always use the Vercel Pro URL** (`project-ii0tm.vercel.app`) for testing and demos.

---

## How to Test

Send an email to **emoney@zeyalabs.ai** with the following format.

### Test 1: Normal Disbursement (MA)

**Subject:**
```
Disbursement Request - MA Payroll - 1,200,000 MMK
```

**Body:**
```
Hi Team,

Please process the following salary disbursement.

Company: Shwe Taung Construction
Total Disbursement Amount: 1,200,000 MMK
Payment Type: SalaryToMA
Number of Employees: 5

Approved by:
- Sales HOD: U Min Thein
- Finance Manager: Daw Khin Mar

Thank you,
Corporate Sales Team
```

**Attach:** None needed (text-only email test)

**Expected result:**
- Ticket created on dashboard with status NORMAL
- Both approvers found (Sales HOD + Finance Manager)
- Notification email sent back to sender

---

### Test 2: OTC Disbursement with Attachment

**Subject:**
```
Disbursement Request - OTC Payroll - 245,600 MMK
```

**Body:**
```
Hi Team,

Please process the following salary disbursement via OTC transfer.

Company: Kyaw Trading Co.
Total Disbursement Amount: 245,600 MMK
Payment Type: SalaryToOTC
Number of Employees: 4

Approved by:
- Sales HOD: U Kyaw Min
- Finance Manager: Daw Aye Aye

Please find the attached payroll instruction with employee details.

Thank you,
Corporate Sales Team
```

**Attach one of these sample files:**
- `research/real_samples/win_handwriting_otc_payroll_4emp.jpg` — Win's real Myanmar handwriting (recommended)
- `samples/grok_payroll_acme_innovations_3emp_USD.pdf` — PDF payroll test
- `samples/bank_slip_acme_innovations.png` — Bank slip image

**Expected result:**
- Vision AI processes the attachment (85%+ confidence)
- Employee names + phone numbers + amounts extracted
- 3-way amount check (email vs document vs employee total)
- If amounts don't match: AMOUNT_MISMATCH scenario with warning

---

### Test 3: Missing Approvals

**Subject:**
```
Disbursement Request - MA Payroll - 500,000 MMK
```

**Body:**
```
Hi Team,

Please process the following salary disbursement.

Company: Golden Star Trading
Total Disbursement Amount: 500,000 MMK
Payment Type: SalaryToMA
Number of Employees: 3

Thank you,
Corporate Sales Team
```

**Attach:** None needed (tests approval detection without attachment)

**Expected result:**
- MISSING_APPROVAL scenario (no approvers in email)
- HIGH risk level
- Notification email includes warning about missing approvals

---

## What to Check After Each Test

| Check | Where to Look |
|-------|--------------|
| Pipeline executed | n8n Cloud → Executions tab → should show "Succeeded" |
| Ticket created | https://project-ii0tm.vercel.app → Dashboard tab |
| Company name correct | Ticket modal → AI Analysis → Company field |
| Approvers found | Ticket modal → Approval Status section |
| Amount correct | Ticket modal → Amount Requested |
| Scenario correct | Ticket badges (NORMAL / MISSING_APPROVAL / AMOUNT_MISMATCH) |
| Notification received | Check sender's inbox for "EMI Pipeline:" email |
| Attachment processed | Ticket modal → Vision badge with confidence % |

---

## Dashboard URL

**https://project-ii0tm.vercel.app**

To reset dashboard data: Press **Ctrl+Shift+R**

---

## Notes

- Pipeline polls emoney@zeyalabs.ai every 1 minute
- Non-disbursement emails are silently dropped (no ticket, no notification)
- Internal Yoma/Wave emails are filtered unless subject contains "disbursement", "payroll", or "salary"
- Notification emails sent FROM emoney@zeyalabs.ai back to the original sender
- All data persisted in Supabase PostgreSQL (shared across all browsers)
- Attachments stored in Supabase Storage (viewable in ticket modal — click "Original Attachment")

---

## Contact

Questions or issues → DK (Khanh Nguyen Duy)
- Teams: Khanh Nguyen Duy
- Email: khanhnguyen@zeyalabs.ai
