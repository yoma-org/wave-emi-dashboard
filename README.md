# Wave EMI Dashboard

Internal operations tool for Wave Money's corporate salary disbursement pipeline in Myanmar. Automates the end-to-end workflow from email intake to Utiba CSV generation, with AI-powered document parsing, vision OCR, and authority matrix validation.

## Handover docs (Wave DevOps — start here)

- [`HANDOVER_APP.md`](HANDOVER_APP.md) — App + pipeline spec (DK, Trustify)
- [`HANDOVER_INFRA.md`](HANDOVER_INFRA.md) — AWS infrastructure spec (Huy, Trustify) *[pending]*

## Live Demo

**Dashboard:** [wave-emi-dashboard.vercel.app](https://wave-emi-dashboard.vercel.app)

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  n8n Cloud Pipeline (v5.1 — 10 nodes)                                │
│                                                                      │
│  Gmail Trigger ──→┐                                                  │
│                   ├→ Prepare → Groq Text → Vision → Employee → Parse │
│  Webhook Trigger →┘            Extract    Process   Extract  Validate│
│                                             │                  │     │
│                              Groq (images) ─┘                  │     │
│                              Gemini (PDFs) ─┘                  │     │
│                                                    ├→ Respond        │
│                                                    └→ Notify         │
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
| Frontend | Single HTML file, vanilla JS, CSS variables (~2,700 lines) |
| AI (text) | Groq API — `llama-3.3-70b-versatile` |
| AI (vision) | Groq API — `llama-4-scout-17b-16e-instruct` (images) |
| AI (PDF) | Google Gemini API — `gemini-2.5-flash` (native PDF support) |
| Automation | n8n Cloud (workflow JSON configs) |
| Hosting | Vercel (static + serverless) |
| Data | localStorage (browser-side persistence) |
| File parsing | SheetJS/XLSX (CDN), PDF.js (CDN, lazy-loaded) |

## Pipeline Versions

| Version | Nodes | Status | Key Feature |
|---------|-------|--------|-------------|
| **v5.1** | 10 | **Active** | Full email body passthrough + circuit breaker fix |
| v5 | 10 | Deactivated | Dual vision (Groq images + Gemini PDF) |
| v4 | 10 | Deactivated | Groq vision only |
| v3 | 9 | Untouched | Safety fallback (NEVER modified) |
| v2 | 8 | Archived | Text extraction only |
| v1 | — | Archived | Original prototype |

**Active pipeline (v5.1)** features:
- Dual AI vision: Groq for images, Gemini 2.5 Flash for PDFs
- Full email body passthrough (capped 2,000 chars)
- Circuit breaker: 5-error threshold with daily reset
- Myanmar handwriting OCR validated (100% name transliteration on real data)
- Cross-validation: email amount vs document amount vs employee total (3-way check)
- Rate limiting: 100 text calls/day, 20 vision calls/day

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
- **Mismatch detection** — 3-way amount check (email vs slip vs employees), red badges, "Return for Correction" flow
- **Collapsible modal** — Amount Verification visible, AI details collapsed
- **PDF support** — Client-side PDF.js for manual upload, Gemini native for pipeline

## Project Structure

```
wave-emi-dashboard/
├── index.html                  ← Dashboard app (single-file, ~2,700 lines)
├── vercel.json                 ← Vercel routing config
├── README.md
├── api/
│   └── webhook.js              ← Vercel serverless endpoint for n8n
│
├── pipelines/                  ← n8n workflow JSON files (v1-v5.1)
│   ├── n8n-workflow-v5.1.json  (active — dual vision + email body)
│   ├── n8n-workflow-v5.json    (backup — dual vision)
│   ├── n8n-workflow-v4.json    (backup — Groq vision only)
│   ├── n8n-workflow-v3.json    (safety fallback — NEVER modified)
│   ├── n8n-workflow-v2.json    (archived — text only)
│   └── n8n-workflow-v1.json    (archived — original)
│
├── diagrams/                   ← Workflow diagrams
│   ├── Pipeline_Current_v5.1.mmd          (current state — Mermaid)
│   ├── Pipeline_Next_Phase.mmd            (future features — Mermaid)
│   ├── workflow_current_v51_deepseek.html  (presentation-ready HTML)
│   ├── workflow_current_v51_chatgpt.png    (shared with team)
│   ├── EMI_Sequence_Diagram.mmd
│   ├── EMI_System_Workflow.mmd
│   └── n8n_Pipeline_Diagram.mmd
│
├── samples/                    ← Test data
├── research/                   ← OCR samples, AI council reviews
├── docs/                       ← Documentation, meeting analyses, plans
│   └── Rita Doc/               ← Workflow reference from Rita
│
├── _meetings/                  ← Meeting recordings + transcripts (.gitignored)
└── _archive/                   ← Superseded versions
```

## Setup

### Dashboard (Vercel)

Auto-deploys from `main` branch. No build step — static HTML file.

### n8n Pipeline

1. Import `pipelines/n8n-workflow-v5.1.json` into [n8n Cloud](https://n8n.cloud)
2. Set credentials:
   - **Gmail OAuth2** — for Gmail Trigger + Send Gmail Notification nodes
   - **Groq API Key** — in Groq AI Extract, Vision Process, Employee Extract nodes
   - **Gemini API Key** — in Vision Process + Employee Extract nodes (PDF path)
3. Activate the workflow

### Local Development

Open `index.html` in any browser. Data persists in localStorage.

**Reset:** Press `Ctrl+Shift+R` to clear all data and reload.

## Security Notes

- No real employee data (MSISDNs, salaries) sent to cloud APIs — file parsing is client-side only
- API keys stored as n8n Cloud credentials, not in source code
- Workflow JSON files use placeholder keys
- Vision rate limiting prevents API abuse (daily caps + circuit breaker)
- Production will require PCI-compliant hosting (Vercel is demo only)
