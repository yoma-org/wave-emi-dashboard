# Phase 2 — Post-Deploy Walkthrough

**Date:** April 4, 2026
**Dashboard:** https://wave-emi-dashboard.vercel.app
**n8n Cloud:** https://tts-test.app.n8n.cloud
**GitHub push:** Done (Vercel auto-deploys in ~60 seconds)

---

## Part 1: Rebuild n8n Pipeline (15-20 min)

The `n8n-workflow-v3.json` was updated (added `original_subject` to the ticket payload). You need to re-import it to n8n Cloud.

### Step 1: Download the updated JSON

- Go to GitHub repo > `n8n-workflow-v3.json` > Download (or use your local file at `wave-emi-dashboard/n8n-workflow-v3.json`)

### Step 2: Delete old v3 in n8n Cloud

1. Open https://tts-test.app.n8n.cloud
2. Find the workflow **"EMI Email Intake Pipeline v3 (Vision + Rate Limiting)"**
3. Click the 3-dot menu > **Delete**
4. Confirm deletion

### Step 3: Import the updated v3

1. **Add Workflow** > **Import from file** > select `n8n-workflow-v3.json`
2. Verify you see **9 nodes** on the canvas:

| # | Node Name | Type |
|---|-----------|------|
| 1 | Webhook Trigger | Webhook |
| 2 | Gmail Trigger | Gmail Trigger |
| 3 | Prepare for AI v3 | Code |
| 4 | Groq AI Extract | HTTP Request |
| 5 | Vision Process | Code |
| 6 | AI Parse & Validate v3 | Code |
| 7 | Route by Source | IF |
| 8 | Respond with Dashboard URL | Respond to Webhook |
| 9 | Send Gmail Notification | Gmail |

### Step 4: Set credentials (2 types, 4 places)

**Gmail OAuth2 (2 nodes):**
1. **Gmail Trigger** > Parameters > Credential > select your Gmail OAuth2
2. **Send Gmail Notification** > Parameters > Credential > select your Gmail OAuth2

**Groq API Key (2 places):**

Your Groq key: get from https://console.groq.com/keys

1. **Groq AI Extract** (HTTP Request node) > Headers > Authorization
   - Replace `REPLACE_WITH_GROQ_API_KEY` so the full value reads:
   ```
   Bearer <YOUR_GROQ_KEY_HERE>
   ```
   Keep the `Bearer ` prefix (with space)!

2. **Vision Process** (Code node) > find `REPLACE_WITH_GROQ_API_KEY` in the code (~line 43)
   - Replace so the line reads:
   ```javascript
   'Authorization': 'Bearer <YOUR_GROQ_KEY_HERE>',
   ```

### Step 5: Verify settings

**Gmail Trigger settings:**
- Parameters > Options > **Download Attachments** = ON
- **Simplify** = OFF
- If Download Attachments toggle is missing, upgrade node to v1.3 (click version at bottom of Settings tab)

**Code node modes (should be correct from import, but double-check):**
- **Prepare for AI v3** > Mode: **Run Once for Each Item**
- **Vision Process** > Mode: **Run Once for Each Item**

**Quick sanity check:** Click into each Code node, Ctrl+F for `this.` — should find **zero** matches.

### Step 6: Save and Activate

1. **Save** the workflow
2. Toggle **Active** (top right)
3. Keep v2 pipeline **deactivated** (both trigger on the same Gmail)

---

## Part 2: Send Test Email (5 min)

### Test A: Email WITH attachment (vision pipeline)

Use the Gmail Trigger's **Fetch Test Event** to load a recent email with a PNG attachment, then click **Test Workflow**.

**Check each node output:**

| Node | Key Field | Expected |
|------|-----------|----------|
| Gmail Trigger | `attachment_0` | Binary data present |
| Prepare for AI v3 | `vision_eligible` | `true` |
| Prepare for AI v3 | `original_subject` | The email subject line |
| Groq AI Extract | `choices[0].message.content` | JSON with company, amount |
| Vision Process | `_vision_status` | `"success"` |
| AI Parse & Validate v3 | `dashboard_url` | Long URL with base64 |

**Open the `dashboard_url` in browser.** The ticket should appear on the dashboard. Click the ticket ID to verify:
- Modal opens with AI Pipeline Analysis section
- Text AI card (blue) shows company, amount, type, approvers
- Vision AI card (purple) shows document type, amount, confidence
- Cross-validation box shows match or mismatch

### Test B: Email WITHOUT attachment (v2 compatibility)

Send a new email to the pipeline mailbox with NO attachment:

**Subject:** `Salary Disbursement - Golden Dragon Ltd`

**Body:**
```
Please process salary disbursement for Golden Dragon Ltd.
Amount: 15,000,000 MMK (SalaryToMA)

Approved by:
- U Aung Myint, Sales HOD — Approved
- Daw Su Su Lwin, Finance Manager — Approved
```

**Expected:**
- `vision_eligible: false`
- `_vision_status: "none"`
- Dashboard ticket shows text AI card only
- Vision AI card shows "Not processed (No attachment)"

### Debugging Common Issues

| Symptom | Fix |
|---------|-----|
| `_vision_status: "api_error"` | Wrong Groq API key in Vision Process code |
| `_vision_status: "none"` when attachment exists | Check `vision_eligible` in Prepare node; check Gmail Trigger Download Attachments |
| `this.getWorkflowStaticData is not a function` | Code still has old `this.` syntax — re-import JSON |
| `getBinaryDataBuffer` error | n8n Cloud version must be >= 1.114.0 |
| No `attachment_0` in Gmail Trigger | Download Attachments not ON (Parameters > Options) |
| `original_subject` empty in dashboard | Re-import the JSON (this update added it to the ticket payload) |
| Ticket appears but modal is broken | Hard refresh (Ctrl+F5) the dashboard — browser may have cached old JS |

---

## Part 3: Visual QA Checklist (10 min)

Open https://wave-emi-dashboard.vercel.app and walk through each item.

### Dashboard Page
- [ ] Ticket table rows have hover highlight + cursor pointer
- [ ] Click any ticket ID (blue link) > modal opens
- [ ] Modal header shows: ticket ID + subject (or company name for old tickets)
- [ ] Badges row: type (MA/OTC), risk level, scenario, n8n badge, vision badge
- [ ] AI Pipeline section: two cards side-by-side (blue text AI, purple vision AI)
- [ ] For vision tickets: confidence bar fills, cross-validation box shows match/mismatch
- [ ] For non-vision tickets: vision card shows "Not processed" (faded)
- [ ] Email Source section: from, to, date, subject, body preview (italic quote)
- [ ] Authority Matrix table: required roles, found names, status
- [ ] Processing Status: Track A, Track B, current status badge
- [ ] Amount summary: requested vs bank slip
- [ ] Click X button or click outside modal > modal closes
- [ ] Press Escape > modal closes
- [ ] Activity log: ticket IDs are blue clickable links > open modal

### Incoming Emails Page (switch to Intake/Maker role)
- [ ] n8n tickets show as rich cards (not one-line summaries)
- [ ] Each card shows: subject, from/date, type+scenario badges, vision badge
- [ ] Two-column amount display (requested vs document)
- [ ] Body preview text (italic)
- [ ] "View Details" button > opens ticket detail modal
- [ ] Clicking the card itself also opens the modal
- [ ] Mock email cards still render correctly (unchanged)

### Finance Approval Page (switch to Finance role)
- [ ] AI Pipeline Analysis section appears for n8n-sourced tickets
- [ ] Side-by-side text vs vision comparison (same style as modal)
- [ ] Cross-validation result (match/mismatch box)
- [ ] Email metadata bar still shows from/to/date
- [ ] Authority matrix, pre-checks, approve/reject form all intact

### Privacy Toggle
- [ ] Click "Private" button in nav bar > body text, emails, names blur
- [ ] Company names, amounts, ticket IDs remain visible
- [ ] Click "Visible" button > prompt asks for PIN
- [ ] Enter wrong PIN > nothing happens (stays blurred)
- [ ] Enter "1234" > content reveals, button changes back to "Private"

### General
- [ ] Ctrl+Shift+R > resets all data (clears localStorage)
- [ ] After reset, dashboard shows "No tickets yet" empty state
- [ ] DEMO badge still opens demo modal
- [ ] n8n badge still pulses
- [ ] Mobile responsive: resize browser < 700px, modal scrollable, cards stack

---

## Part 4: Rollback (if something goes wrong)

**Dashboard rollback:**
- Vercel auto-deploys from GitHub. To rollback, go to Vercel dashboard > Deployments > find previous deployment > Promote.

**n8n rollback:**
- Deactivate v3, reactivate v2. They are independent workflows.
- v2 JSON is still in the repo: `n8n-workflow-v2.json`

**Privacy PIN:**
- Default PIN: `1234`
- This is cosmetic demo polish, not security

---

## Files in Repo (after cleanup)

```
wave-emi-dashboard/
├── index.html                    ← Main app (2,356 lines)
├── n8n-workflow-v3.json          ← Active pipeline (9 nodes, vision)
├── n8n-workflow-v2.json          ← Backup pipeline (8 nodes, text-only)
├── n8n-workflow.json             ← Original v1 backup
├── ImplementationPlan_Phase2.md  ← Phase 2 plan (marked IMPLEMENTED)
├── Phase2_Execution_Log.md       ← Detailed build log
├── Phase2_Walkthrough.md         ← THIS FILE
├── APP_WALKTHROUGH.md            ← Original app walkthrough
├── README.md
├── api/webhook.js                ← Vercel serverless endpoint
├── vercel.json
├── sample_employees.csv
├── samples/
├── Rita Doc/
├── EMI_System_Workflow.mmd
└── n8n_Pipeline_Diagram.mmd
```

**Archived (outside repo, at `03_build/_archive/`):**
```
_archive/
├── phase1_plans/
│   ├── ImplementationPlan_V1.md
│   ├── ImplementationPlan_V2.md
│   ├── ImplementationPlan_V3.md
│   └── V3_DEPLOYMENT_GUIDE.md
├── phase1_demo/
│   ├── MONDAY_DEMO_PLAN.md
│   └── Monday_Showcase_Flow.mmd
└── old_apps/
    ├── emi-dashboard-streamlit/
    └── wave-corp-disbursement-v3/
```
