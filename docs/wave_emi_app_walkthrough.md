---
name: wave_emi_app_walkthrough
aliases: ["Wave EMI App Walkthrough", "Complete App Walkthrough"]
description: End-to-end walkthrough of the Wave EMI Dashboard — what the app does, the 3 roles, the 7-step disbursement workflow, CSV formats, and business logic. Primary reference for new developers or stakeholders.
type: reference
topics: [wave-emi, app, walkthrough, onboarding]
status: active
created: 2026-04-10
last_reviewed: 2026-04-19
---

# Wave EMI Pipeline — Complete App Walkthrough

## What This App Does

This is an **internal operations tool** for Wave Money's corporate salary disbursement pipeline in Myanmar. When a corporate client (like Myanmar Brewery or Capital Taiyo) wants to pay their employees via Wave Money, the request goes through a multi-step approval pipeline before money moves.

**This app handles Steps 1-3 (upstream):**
1. **Intake** — receive and parse the client's email request
2. **Pre-checks** — validate employee phone numbers, clean names, reconcile amounts
3. **Finance Approval** — verify authority matrix, approve or reject

**Then it bridges to Steps 4-7 (downstream):** the E-Money checker app at `dknguyentrustify.github.io/Wave-eMoney/`

---

## The Three Roles

The app has role-based access. Switch roles using the dropdown in the top-right nav bar.

| Role | What They Do | Pages They Access |
|------|-------------|-------------------|
| **Intake / Maker** | Receive emails, parse requests, upload employee lists, submit for approval | Dashboard + Incoming Emails |
| **Finance** | Review pre-check results, verify authority matrix, approve or reject | Dashboard + Finance Approval |
| **E-Money** | Export approved tickets, send to checker team | Dashboard + E-Money Review |

**Why roles?** In Wave Money's real operations, separation of duties is required. The person who creates a request (Maker) cannot be the person who approves it (Finance). This prevents fraud.

> Note: In this demo version, role switching is client-side (anyone can switch). Production would use JWT/OAuth with server-side enforcement.

---

## Page-by-Page Walkthrough

### 1. Dashboard (All Roles)

**URL:** `https://wave-emi-dashboard.vercel.app/`

This is the command center. Everyone sees it regardless of role.

#### What You See:

**5 Metric Cards (top row):**
- **New Emails** — unprocessed emails waiting to be parsed (from mock data)
- **Pending** — tickets awaiting employee list upload OR finance approval
- **Ready for Checker** — tickets that passed both Track A (pre-checks) and Track B (finance). Ready to hand off to the E-Money team
- **Mismatches** — tickets where email amount != bank slip amount. These need extra scrutiny
- **High Risk** — tickets flagged HIGH risk (missing approvals, invalid phone numbers, or amount mismatches)

**All Tickets Table:**
- Shows every ticket in the system
- Columns: ID, Company, Type (MA/OTC), Amount, Track A status, Track B status, Overall Status, Risk Level
- Tickets with an orange **n8n** badge were auto-created by the n8n automation pipeline
- Tickets without the badge were created manually from the Incoming Emails page

**Activity Log:**
- Timestamped record of every action taken in the system
- Shows: ticket creation, pre-check completion, finance approvals/rejections, checker handoffs

#### Why This Page Matters:
The Operations Manager (or your boss) opens this page to see the full pipeline at a glance. "How many requests are pending? Any mismatches? Any high-risk items?" — all answered in 2 seconds.

---

### 2. Incoming Emails (Intake / Maker Role Only)

**How to access:** Switch role to "Intake / Maker" → click "Incoming Emails" in nav

This page shows client emails requesting salary disbursements. In the demo, there are 3 mock emails plus any tickets auto-created by n8n.

#### Section: n8n Automated Intake (top, if present)

If n8n has created tickets, you'll see an orange-bordered card showing:
- Number of auto-created tickets
- Company, amount, and status for each

**Why this matters:** This shows the boss that n8n is working — emails are being parsed automatically without manual intervention.

#### Section: n8n Webhook Configuration (collapsible)

Click "n8n Webhook Configuration" to expand. Shows the technical webhook URL and JSON schema. This is for developers/admin — not for daily users.

#### Section: Mock Email Cards (3 emails)

Each card represents a client email with:

**Email 1: Myanmar Brewery Ltd (NORMAL scenario)**
- 4,800,000 MMK, SalaryToMA
- Both Sales HOD and Finance Manager approved
- Authority matrix: 2/2 present
- This is a clean request — should sail through

**Email 2: Thiri Dar Co. Ltd (AMOUNT MISMATCH scenario)**
- Email says 3,200,000 MMK but bank slip says 3,500,000 MMK
- The approvers are "Sales Manager" and "Finance Officer" (not HOD/Manager — authority matrix will flag this)
- This tests the system's ability to catch discrepancies

**Email 3: Mega Steel Industries (MISSING APPROVAL scenario)**
- 11,500,000 MMK, SalaryToOTC (over-the-counter)
- Only Sales Manager approved — no Finance sign-off
- Authority matrix: 1/2 (Finance Manager missing)
- This tests the system's ability to flag incomplete approvals

#### How to Process an Email (Step by Step):

**Step 1: Parse the email**
1. Click **"Parse & Create Ticket"** button on any email card
2. The system extracts: company, amount, type, approvals
3. A ticket is created (e.g., TKT-003)
4. The email card turns green with "Parsed -> TKT-003"
5. Toast notification confirms ticket creation

**Step 2: Upload employee list**
1. After parsing, an upload zone appears: "Drop or click to upload employee list"
2. Upload `sample_employees.csv` (or any .csv/.xlsx with Name, MSISDN, Amount columns)
3. The system automatically:
   - **Validates phone numbers (MSISDN):** Must start with 09, 10-11 digits. Normalizes +959/959 prefixes
   - **Cleans names:** Strips Myanmar honorific prefixes (U, Daw, Ko, Ma, Mr., Mrs., Dr., etc.)
   - **Counts records:** Shows total employees, invalid MSISDNs, names cleaned
4. A preview table appears showing each employee with validation status
5. **Three-way amount reconciliation** runs automatically:
   - Check 1: Email amount vs Bank slip amount
   - Check 2: Employee list total vs Requested amount
   - Check 3: All three sources agreement

**Why phone validation matters:** Wave Money mobile wallets are tied to Myanmar phone numbers. An invalid MSISDN means money can't reach that employee. Catching this BEFORE sending to the checker prevents failed disbursements.

**Why name cleaning matters:** Myanmar names have honorific prefixes (U = Mr., Daw = Mrs., Ko = young man, Ma = young woman). The Wave Money system needs clean names without prefixes for matching. The app strips these automatically.

**Step 3: Upload bank slip (optional)**
1. An upload zone appears for bank slip: PNG, JPEG, or PDF
2. Image files show an inline preview
3. PDF files show the filename
4. This is used by Finance to verify the fund transfer visually

**Step 4: Save & Submit**
1. Click **"Save & Submit for Finance Approval"** (enabled after employee upload)
2. The ticket's pre-checks are marked as DONE
3. Status changes from AWAITING_EMPLOYEE_LIST to PENDING_FINANCE
4. Toast confirms submission
5. The ticket now appears on the Finance Approval page

---

### 3. Finance Approval (Finance Role Only)

**How to access:** Switch role to "Finance" → click "Finance Approval" in nav

This page shows tickets that have completed pre-checks and are waiting for Finance sign-off.

#### What You See for Each Ticket:

1. **Header:** Ticket ID, Company, Type badge, Risk level badge
2. **Requested Amount:** The total amount to be disbursed
3. **Authority Matrix Table:**
   - Required roles (Sales HOD, Finance Manager)
   - Who was found in the email
   - Present/Missing status
   - This is the KEY compliance check — without proper authorization, money should not move

4. **Pre-check Results:** Employee count, invalid MSISDNs, names cleaned
5. **Amount Reconciliation:** All three checks with pass/warn/fail icons
6. **Bank Slip:** Image preview (if uploaded) or filename reference
7. **Conditional Warnings:**
   - Yellow alert for amount mismatches
   - Red alert for missing Finance approval in original email
   - Yellow alert for incomplete authority matrix

#### How to Approve or Reject:

**To Approve:**
1. Enter your name in "Approved by" field (required)
2. Optionally add notes
3. Click **"Approve"**
4. Ticket status changes to READY_FOR_CHECKER
5. Both Track A (pre-checks) and Track B (finance) are now complete

**To Reject:**
1. Click **"Reject"**
2. Ticket status changes to REJECTED
3. Ticket exits the pipeline (cannot be recovered in this version)

**Why Finance approval matters:** This is the compliance gate. Finance verifies:
- Are the right people authorizing this disbursement?
- Do the amounts match across email, bank slip, and employee list?
- Is the bank slip legitimate?
- Any red flags?

---

### 4. E-Money Review (E-Money Role Only)

**How to access:** Switch role to "E-Money" → click "E-Money Review" in nav

This page shows tickets that Finance has approved and are ready for the E-Money checker team.

#### Two Sections:

**Ready for Checker:**
- Tickets with status READY_FOR_CHECKER
- Shows pre-check status, finance approval, reconciliation summary
- Expandable employee list (click "Show Cleaned Employee List" to see all rows)

**Already Sent:**
- Tickets marked as sent to the checker team
- Simple confirmation cards

#### Three Action Buttons:

1. **"Open in Checker Dashboard"**
   - Opens the downstream E-Money checker app in a new tab
   - URL: `dknguyentrustify.github.io/Wave-eMoney/`
   - This is where the actual Wave Money disbursement files are generated (CSV files for the Utiba system)

2. **"Export Ticket Data (JSON)"**
   - Downloads the complete ticket as a JSON file
   - Contains: all employee data, reconciliation checks, approval history
   - This is the data bridge between the upstream pipeline (this app) and the downstream checker

3. **"Mark as Sent to Checker"**
   - Flags the ticket as SENT_TO_CHECKER
   - Moves it to the "Already Sent" section
   - This is an audit trail action — confirms the E-Money team has handed off the data

---

## The Two Parallel Tracks (Key Concept)

The pipeline has two tracks that run in parallel:

```
                    ┌── Track A: Pre-checks ──────────┐
Email parsed ──────┤                                    ├── BOTH done? → READY_FOR_CHECKER
                    └── Track B: Finance Approval ────┘
```

**Track A (Pre-checks):**
- Upload employee list → validate MSISDNs → clean names → reconcile amounts
- Done by: Intake / Maker role
- Result: prechecks_done = true

**Track B (Finance Approval):**
- Review authority matrix → check amounts → approve or reject
- Done by: Finance role
- Result: finance_status = APPROVED

**A ticket is READY_FOR_CHECKER only when BOTH tracks are complete.** This is why the dashboard shows both Track A and Track B columns — you can see at a glance which track is blocking.

---

## Status State Machine

```
AWAITING_EMPLOYEE_LIST  →  email parsed, but no employee data yet
        │
        ▼ (employee list uploaded + submitted)
PENDING_FINANCE         →  pre-checks done, waiting for Finance
        │
        ├─── Approved ──→  READY_FOR_CHECKER  →  SENT_TO_CHECKER
        │
        └─── Rejected ──→  REJECTED (terminal)
```

---

## Risk Level Logic

| Risk Level | Condition |
|-----------|-----------|
| **HIGH** | Amount mismatch OR authority matrix incomplete OR invalid MSISDNs > 0 |
| **MEDIUM** | Names cleaned count > 0 (data required transformation) |
| **LOW** | Everything clean — amounts match, all approvals present, no invalid phones |

---

## n8n Automation Flow

The n8n pipeline automates the email intake step. Instead of manually clicking "Parse & Create Ticket," n8n does it automatically:

```
Client sends email
    → n8n detects it (Outlook trigger, every 2 min)
    → n8n filters by keywords (Salary, EMI, Disbursement, OTC)
    → n8n extracts: company, amount, type, approvers
    → n8n checks authority matrix
    → n8n generates a dashboard URL with encoded ticket data
    → n8n sends notification to Intake team with the link
    → Clicking the link auto-creates the ticket in the dashboard
    → Normal workflow continues (employee upload → finance → checker)
```

**What n8n DOES automate:** Email detection, parsing, initial authority check, ticket creation
**What n8n DOES NOT automate:** Employee list upload, bank slip upload, finance approval, checker handoff — these still require human judgment

---

## Demo Script (For Presenting to Your Boss)

### Setup (before the meeting):
1. Open two browser tabs:
   - Tab 1: n8n dashboard (`tts-test.app.n8n.cloud`)
   - Tab 2: Wave EMI Dashboard (`wave-emi-dashboard.vercel.app`)
2. Clear the demo data: press **Ctrl+Shift+R** on the dashboard to reset

### The Presentation Flow:

**"Let me show you how the automated EMI pipeline works."**

**Step 1 (1 min): Show the n8n pipeline**
- "This is our n8n automation workflow. It monitors our inbox for disbursement requests."
- "When an email arrives with keywords like 'Salary' or 'EMI', it automatically parses the company name, amount, type, and who approved it."
- "It checks the authority matrix — are the right people's approvals in the email?"
- "Then it generates a link that auto-creates a ticket in our dashboard."

**Step 2 (1 min): Trigger the automation**
- Either: send a test email (if Outlook trigger is connected)
- Or: run the curl command to trigger the webhook
- Show the n8n nodes lighting up green
- "The email was parsed in under a second. Let's see the result."

**Step 3 (1 min): Show the dashboard**
- Open the dashboard URL from n8n's output
- "The ticket appeared automatically — no manual data entry. Look at the n8n badge."
- "It detected that Finance Manager approval is missing — flagged as HIGH risk."
- Point to the Activity Log: "Every action is logged with timestamps."

**Step 4 (2 min): Walk through the manual workflow**
- Switch to Incoming Emails page
- Parse one of the mock emails (Myanmar Brewery — the clean one)
- Upload `sample_employees.csv`
- "Watch — phone numbers are validated, names are cleaned, amounts are reconciled."
- Click "Save & Submit for Finance Approval"

**Step 5 (1 min): Finance approval**
- Switch role to Finance
- Go to Finance Approval page
- "Finance sees the authority matrix, all the pre-checks, the reconciliation results."
- Approve the ticket
- "Now it's ready for the E-Money team."

**Step 6 (30 sec): E-Money handoff**
- Switch role to E-Money
- "The E-Money team can export the ticket data and open it in the checker dashboard."
- Click "Open in Checker Dashboard" to show the downstream app

**Closing (30 sec):**
- "This replaces manual Excel scrubbing, email forwarding, and phone number validation."
- "n8n handles the trigger layer. The dashboard handles the workflow. The checker app handles the disbursement."
- "All three work together as one pipeline."

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **Ctrl+Shift+R** | Reset demo — clears all data and reloads with seed tickets |

---

## Technical Notes

- **Data persistence:** localStorage (survives page refresh, cleared on Ctrl+Shift+R)
- **No backend:** 100% client-side JavaScript, hosted as static site on Vercel
- **No real auth:** Role switching is client-side only (demo mode)
- **Employee file parsing:** Uses SheetJS (xlsx.js) for CSV/XLSX — no server needed
- **Bank slip images:** Stored in runtime memory only (not persisted to localStorage to prevent bloat)
