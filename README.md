# Wave EMI Dashboard

Internal operations tool for Wave Money's corporate salary disbursement pipeline in Myanmar. Automates the end-to-end workflow from email intake to Utiba CSV generation, with AI-powered document parsing and authority matrix validation.

## Live Demo

**Dashboard:** [wave-emi-dashboard.vercel.app](https://wave-emi-dashboard.vercel.app)

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  n8n Cloud Pipeline                                                  │
│                                                                      │
│  Gmail Trigger ──→┐                                                  │
│                   ├→ Prepare for AI → Groq AI → Parse & Validate     │
│  Webhook Trigger →┘                    │              │               │
│                              (v3: Vision Process)     │               │
│                                                       ├→ Respond      │
│                                                       └→ Notify       │
└──────────────────────────────────────────────────────────────────────┘
        │                                        │
        ▼                                        ▼
┌──────────────────┐                   ┌──────────────────┐
│  Vercel Webhook  │                   │  Gmail Notify    │
│  /api/webhook.js │                   │  (branded email) │
└──────────────────┘                   └──────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Dashboard (index.html — single-file vanilla JS app)                 │
│                                                                      │
│  Intake → Finance Approval → E-Money Processing → CSV Gen → Close    │
│  (9 pages, 3 roles, 7-step workflow)                                 │
└──────────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | Single HTML file, vanilla JS, CSS variables |
| AI (text) | Groq API — `llama-3.3-70b-versatile` |
| AI (vision) | Groq API — `llama-4-scout-17b-16e-instruct` (v3) |
| Automation | n8n Cloud (workflow JSON configs) |
| Hosting | Vercel (static + serverless) |
| Data | localStorage (browser-side persistence) |
| File parsing | SheetJS/XLSX (CDN) |

## Pipeline Versions

### v2 — Text Extraction (Production)

8-node pipeline. Parses email text with Groq LLM, validates authority matrix, routes to webhook response or email notification.

**File:** `pipelines/n8n-workflow-v2.json`

### v3 — Vision + Rate Limiting

9-node pipeline. Adds:
- **Attachment download** — Gmail Trigger extracts binary attachments
- **Vision AI** — Conditional Groq Vision API call on image attachments (bank slips, payment docs)
- **Cross-validation** — Compares document amount vs email amount (1% tolerance)
- **Rate limiting** — 100 text calls/day, 20 vision calls/day, circuit breaker on 3 consecutive errors
- **Graceful degradation** — Every failure path produces a valid text-only ticket

**File:** `pipelines/n8n-workflow-v3.json`

### v1 — Original (Archived)

First iteration with basic structure. **File:** `pipelines/n8n-workflow-v1.json`

## Dashboard Features

### Workflow Steps

| Step | Role | Description |
|------|------|-------------|
| 1 | Intake | Parse email or webhook — create disbursement ticket |
| 2 | Intake | Upload employee list (CSV/Excel) + bank slip |
| 3 | Finance | Review ticket, approve/reject with authority matrix check |
| 4 | E-Money | Generate 7 Utiba CSV files (MA + OTC formats) |
| 5 | E-Money | Checker review — approve, reject, or flag exceptions |
| 5b | E-Money | Group mapping for OTC disbursements |
| 6 | E-Money | Live disbursement monitoring |
| 7 | E-Money | Closing checklist + archive |

### Key Business Logic

- **Authority matrix** — Requires Sales HOD + Finance Manager approvals
- **Finance exemption** — MEB, YESC, MESC, SSB clients skip finance approval
- **OTC split** — Each OTC employee generates 2 rows (1,000,000 + 400,000 MMK)
- **MSISDN validation** — Myanmar mobile format `09xxxxxxxxx`
- **AI keyword filter** — Non-disbursement emails are silently dropped
- **Vision cross-validation** (v3) — Amount mismatch detection between email text and bank slip document

## Project Structure

```
wave-emi-dashboard/
├── index.html                  ← Dashboard app (single-file, ~2,400 lines)
├── vercel.json                 ← Vercel routing config
├── README.md
├── api/
│   └── webhook.js              ← Vercel serverless endpoint for n8n
│
├── pipelines/                  ← n8n workflow JSON files
│   ├── n8n-workflow-v3.json    (active — vision + rate limiting)
│   ├── n8n-workflow-v2.json    (backup — text extraction only)
│   └── n8n-workflow-v1.json    (original archived)
│
├── diagrams/                   ← Mermaid sequence & system diagrams
│   ├── EMI_Sequence_Diagram.mmd
│   ├── EMI_System_Workflow.mmd
│   └── n8n_Pipeline_Diagram.mmd
│
├── samples/                    ← Test data, bank slips, demo scripts
│   ├── bank_slip_acme_innovations.png
│   ├── bank_slip_gintar_solutions.png
│   ├── sample_employees.csv
│   └── demo_email_*.md + DEMO_SCRIPT_*.md
│
└── docs/                       ← Documentation, analysis, plans
    ├── APP_WALKTHROUGH.md
    ├── Phase2_Execution_Log.md
    ├── Meeting_Analysis_2026-04-06.md
    ├── Phase3_*.md (analysis files)
    └── Rita_Doc/ (workflow reference)
```

## Setup

### Dashboard (Vercel)

The dashboard auto-deploys from this repo's `main` branch. No build step required — it's a static HTML file.

### n8n Pipeline

1. Import the desired workflow JSON into [n8n Cloud](https://n8n.cloud)
2. Set credentials:
   - **Gmail OAuth2** — for Gmail Trigger + Send Gmail Notification nodes
   - **Groq API Key** — replace `REPLACE_WITH_GROQ_API_KEY` in the Groq AI Extract node header (and Vision Process node for v3)
3. Activate the workflow

### Local Development

Open `index.html` in any browser. Data persists in localStorage.

**Reset:** Press `Ctrl+Shift+R` to clear all data and reload.

## CSV Output Formats

The E-Money processing step generates 7 Utiba-compatible CSV files:

| File | Format | Use |
|------|--------|-----|
| DMM→Disbursement Ledger | `SOURCE,TARGET,AMOUNT,DESCRIPTION` | Ledger transfer |
| Disbursement→Corporate | `SOURCE,TARGET,AMOUNT,DESCRIPTION` | Corporate transfer |
| FeeDisbursement | `SOURCE,TARGET,AMOUNT,DESCRIPTION` | Fee transfer |
| SalaryToMA | `AMOUNT,SOURCE_WALLET,TARGET_MSISDN,DESCRIPTION` | Mobile account salary |
| SalaryToOTC | `AMOUNT,SOURCE_WALLET,AGENT_ID,DESCRIPTION,MSISDN,EMAIL,0,0` | OTC salary (2 rows/employee) |
| MapAgent | `MSISDN,GROUP NAME` | OTC group mapping |
| UnmapAgent | `MSISDN,GROUP NAME` | OTC group unmapping |

## Security Notes

- No real employee data (MSISDNs, salaries) is sent to cloud APIs — file parsing is client-side only
- API keys are stored as n8n Cloud credentials, not in source code
- Workflow JSON files use `REPLACE_WITH_GROQ_API_KEY` placeholder
- Vision rate limiting prevents API abuse (daily caps + circuit breaker)
