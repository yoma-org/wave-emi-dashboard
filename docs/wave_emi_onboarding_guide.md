---
name: wave_emi_onboarding_guide
aliases: ["Wave EMI Onboarding Guide", "Codebase Onboarding Guide"]
description: Codebase onboarding guide for new developers joining Wave EMI Dashboard work. Originally written for Binh Le Quang (backend support), generalizable to any new team member.
type: reference
topics: [wave-emi, onboarding, developer-guide]
status: active
created: 2026-04-09
last_reviewed: 2026-04-19
---

# Codebase Onboarding Guide — Wave EMI Dashboard

**For:** Binh Le Quang (Backend Support)
**From:** DK (Khanh Nguyen Duy)
**Date:** April 9, 2026
**Repo:** https://github.com/DKNguyenTrustify/Wave-eMoney

---

## 1. What Is This App?

Wave Money is an **Electronic Money Issuer (EMI)** in Myanmar — like a mobile wallet for salary disbursement. Companies pay employee salaries through Wave Money.

**The problem:** Wave Money's E-Money operations team manually processes 100+ salary disbursement requests per month. Each request involves parsing emails, verifying amounts, checking approvals, generating CSV files for their banking system (Utiba), and tracking the disbursement.

**Our app automates this:** Email comes in → AI reads it → extracts company, amount, approvers, employee list → creates a ticket → ops team reviews and processes through a 7-step workflow.

---

## 2. Business Flow (7 Steps)

```
Client sends email with payroll request + bank slip / employee list
        │
        ▼
┌─────────────────────────────────────────────┐
│ Step 1: INTAKE (Intake/Maker role)          │
│ - AI parses email automatically             │
│ - Extracts: company, amount, type, approvers│
│ - Vision AI reads bank slip / payroll image  │
│ - Creates ticket on dashboard               │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│ Step 2: UPLOAD (Intake/Maker role)          │
│ - Upload employee list (CSV/Excel)          │
│ - System validates: names, phone numbers    │
│ - Myanmar phone format: 09XXXXXXXXX         │
│ - Reconciles amounts (email vs slip vs list)│
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│ Step 3: FINANCE APPROVAL (Finance role)     │
│ - Finance team reviews the request          │
│ - Checks authority matrix (Sales HOD +      │
│   Finance Manager must both approve)        │
│ - Approve or Reject                         │
│ - Some clients skip this step (exemption)   │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│ Step 4: PREPARE FILES (E-Money role)        │
│ - Generate 7 Utiba-compatible CSV files     │
│ - Two types: MA (Mobile Account) or         │
│   OTC (Over-The-Counter cash pickup)        │
│ - OTC employees get 2 rows each             │
│   (1,000,000 + 400,000 MMK split)           │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│ Step 5: CHECKER REVIEW (E-Money role)       │
│ - Second person reviews generated files     │
│ - Approve / Reject / Flag exceptions        │
│ - Banking compliance: Maker-Checker pattern │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│ Step 5b: GROUP MAPPING (OTC only)           │
│ - Map employees to Wave Money agent groups  │
│ - Generate MapAgent / UnmapAgent CSV files  │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│ Step 6: MONITORING (E-Money role)           │
│ - Track disbursement progress               │
│ - Each employee: pending → success / failed │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│ Step 7: CLOSE (E-Money role)                │
│ - Download result file from Utiba           │
│ - Attach bank slip to SharePoint            │
│ - Update disbursement tracker               │
│ - Send confirmation email to client         │
│ - Archive to date-structured Share Drive    │
└─────────────────────────────────────────────┘
```

---

## 3. Three User Roles

| Role | Who | What They Do | Pages |
|------|-----|-------------|-------|
| **Intake / Maker** | Person who receives client emails | Parse emails, upload employee list, submit for finance | Dashboard, Ticket List |
| **Finance** | Finance team reviewer | Review requests, approve/reject with authority check | Dashboard, Finance Approval |
| **E-Money** | Operations team (Win's team in Myanmar) | Generate CSV files, checker review, monitor disbursement, close case | Dashboard, E-Money Review + 5 sub-pages |

Switch roles via dropdown in the top-right nav bar.

---

## 4. Current Architecture

```
┌─────────────────────────────────────────────────────┐
│  CLIENT EMAIL                                        │
│  (sends to emoney@zeyalabs.ai)                      │
└─────────────────────┬───────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────┐
│  n8n Cloud Pipeline (v6 — 10 nodes)                  │
│                                                      │
│  Outlook Trigger → Prepare → Groq AI → Vision AI →   │
│  Employee Extract → Parse & Validate → Route →        │
│  Notification Email + Webhook to Vercel              │
│                                                      │
│  AI Models:                                          │
│  - Groq llama-3.3-70b (text extraction)              │
│  - Groq llama-4-scout (image OCR)                    │
│  - Gemini 2.5 Flash (PDF OCR)                        │
└─────────────────────┬───────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────┐
│  Vercel (hosting)                                    │
│                                                      │
│  api/webhook.js  ← receives ticket data from n8n    │
│  index.html      ← single-file dashboard app        │
│  vercel.json     ← routing config                   │
│                                                      │
│  Dashboard: wave-emi-dashboard.vercel.app            │
└─────────────────────┬───────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────┐
│  Browser (localStorage)  ← CURRENT data storage      │
│  Supabase (PostgreSQL)   ← ADDING NOW                │
└─────────────────────────────────────────────────────┘
```

**Key point:** The entire app is ONE HTML file (2,700 lines). No framework, no build step, no npm. All CSS + HTML + JavaScript in `index.html`.

---

## 5. Key Files to Read

| File | What It Is | Priority |
|------|-----------|----------|
| **`index.html`** | The entire app — 2,700 lines, vanilla JS | Read sections, not all at once |
| **`api/webhook.js`** | Vercel serverless endpoint — receives data from n8n | Short, 26 lines |
| **`pipelines/n8n-workflow-v6.json`** | n8n automation pipeline (10 nodes) | Skim the structure |
| **`docs/Plan_Backend_DB_KAN26.md`** | Full backend + DB migration plan | Read for context |
| **`docs/Plan_DB_Implementation.md`** | Tonight's DB execution plan | Read for what's changing |
| **`APP_WALKTHROUGH.md`** | Detailed feature walkthrough | Good overview |
| **`Rita Doc/Rita_Workflow_Reference.md`** | The full 9-phase business workflow | Understand the scope |

---

## 6. index.html — Code Structure Map

The file is organized in sections marked with comment banners:

```
Line     Section                              What It Does
─────────────────────────────────────────────────────────────
1-9      HTML head, CDN imports               SheetJS, Supabase (adding)
10-500   CSS styles                           All styling, CSS variables
500-610  State declaration                    state.tickets, state.activityLog
610-700  Core functions                       deriveStatus, computeRisk, saveState,
                                              loadState, generateTicketId, updateTicket,
                                              logActivity
700-790  Mock data                            3 demo email scenarios
790-845  Status/Risk badge helpers            statusBadgeHtml, riskBadgeHtml
845-945  Navigation + routing                 showPage(), switchRole()
945-1045 PAGE: Dashboard                      renderDashboard() — stat cards, ticket table
1045-1560 PAGE: Incoming Emails (Ticket List) renderEmails() — email cards, ticket creation,
                                              employee upload, prechecks
1560-1695 PAGE: Finance Approval              renderFinance() — approve/reject workflow
1695-2400 PAGE: E-Money (5 sub-pages)         Steps 4-7: CSV generation, checker,
                                              mapping, monitoring, close
2400-2500 n8n Integration                     createTicketFromN8n(), webhook handler,
                                              URL parameter parsing
2500-2700 Ticket Detail Modal                 openTicketDetail() — AI analysis display,
                                              employee table, mismatch detection,
                                              collapsible sections
2700+    Page load / initialization           loadState(), showPage(), role setup
```

### Key Functions to Understand

| Function | Line | What It Does |
|----------|------|-------------|
| `deriveStatus(t)` | 611 | State machine: determines ticket status from all boolean flags |
| `computeRisk(t)` | 627 | HIGH/MEDIUM/LOW based on mismatch + missing approvals + invalid phones |
| `saveState()` | 644 | Writes everything to localStorage (and soon Supabase) |
| `loadState()` | 660 | Reads from localStorage (and soon Supabase first) |
| `createTicketFromN8n(data)` | 2419 | Creates ticket from pipeline data — maps 50+ fields |
| `openTicketDetail(id)` | 2552 | Renders the full ticket modal with all sections |
| `handleSubmitPrechecks(emailId)` | 1490 | Validates employee list, calculates reconciliation |
| `generateUtibaFiles(tid)` | 1820 | Creates 7 CSV files for banking system |

---

## 7. Data Model (Ticket Object — ~70 fields)

A ticket flows through this lifecycle:

```
AWAITING_EMPLOYEE_LIST → PENDING_FINANCE → READY_FOR_CHECKER →
  SENT_TO_CHECKER → WITH_CHECKER → PREPARING_FILES →
  GROUP_MAPPING → DISBURSING → CLOSING → COMPLETED

Special statuses:
  ASKED_CLIENT (amount mismatch, waiting for client correction)
  REJECTED (finance rejected, terminal)
```

Key field groups:
- **Identity:** id (TKT-001), company, type (MA/OTC), currency (MMK)
- **Amounts:** amount_requested, amount_on_bank_slip, amount_on_document, employee_total
- **Approvals:** email_approvals (JSON array), approval_matrix_complete (boolean)
- **AI Pipeline:** vision_parsed, vision_confidence, extracted_employees, scenario
- **Email:** from_email, original_subject, email_body_full, attachments
- **Processing:** prechecks_done, finance_status, sent_to_checker, files_prepared, closed

Full schema: see `docs/Plan_DB_Implementation.md` → Step 1

---

## 8. Migration Vision: index.html → NextJS

### Why NextJS?

| Current (index.html) | Target (NextJS) |
|---|---|
| 2,700 lines in one file | Separated into pages + components |
| All rendering in vanilla JS | React components with state management |
| No server-side logic | API routes for Supabase, auth, file handling |
| No auth, no roles enforcement | NextAuth.js or Supabase Auth |
| localStorage only | Supabase PostgreSQL |
| No real-time updates | Supabase Realtime subscriptions |
| Static hosting on Vercel | Same Vercel but with serverless API |

### Proposed NextJS Structure

```
wave-emoney-app/
├── app/                          (Next.js App Router)
│   ├── layout.tsx                (Root layout — nav bar, role selector)
│   ├── page.tsx                  (Dashboard — stat cards, ticket table)
│   ├── tickets/
│   │   └── page.tsx              (Ticket List — email cards, intake)
│   ├── finance/
│   │   └── page.tsx              (Finance Approval)
│   ├── emoney/
│   │   ├── page.tsx              (E-Money queue)
│   │   ├── prepare/page.tsx      (Step 4: CSV generation)
│   │   ├── checker/page.tsx      (Step 5: Checker review)
│   │   ├── mapping/page.tsx      (Step 5b: Group mapping)
│   │   ├── monitoring/page.tsx   (Step 6: Disbursement monitoring)
│   │   └── close/page.tsx        (Step 7: Close case)
│   └── api/
│       ├── webhook/route.ts      (n8n webhook endpoint)
│       ├── tickets/route.ts      (CRUD for tickets)
│       └── activity/route.ts     (Activity log)
│
├── components/
│   ├── TicketTable.tsx           (Reusable ticket list)
│   ├── TicketModal.tsx           (Ticket detail popup)
│   ├── AmountCheck.tsx           (3-way reconciliation)
│   ├── EmployeeTable.tsx         (Employee list display)
│   ├── StatusBadge.tsx           (Status/risk badges)
│   ├── CSVGenerator.tsx          (Utiba file generation)
│   └── RoleSelector.tsx          (Role switcher)
│
├── lib/
│   ├── supabase.ts               (Supabase client)
│   ├── types.ts                  (TypeScript interfaces for Ticket, Employee, etc.)
│   └── utils.ts                  (deriveStatus, computeRisk, reconcileAmounts)
│
├── public/                       (Static assets)
└── package.json
```

### How Current Pages Map to NextJS

| Current (showPage) | NextJS Route | Component |
|---|---|---|
| `dashboard` | `/` | Dashboard page |
| `emails` | `/tickets` | Ticket List page |
| `finance` | `/finance` | Finance Approval page |
| `emoney` | `/emoney` | E-Money queue page |
| `emoney-prepare` | `/emoney/prepare` | CSV Generation page |
| `emoney-checker` | `/emoney/checker` | Checker Review page |
| `emoney-mapping` | `/emoney/mapping` | Group Mapping page |
| `emoney-monitoring` | `/emoney/monitoring` | Monitoring page |
| `emoney-close` | `/emoney/close` | Close Case page |

### Migration Strategy (NOT a rewrite from scratch)

1. **Extract logic first** — Move `deriveStatus`, `computeRisk`, `reconcileAmounts`, `generateUtibaFiles` into `lib/utils.ts`. These are pure functions, no UI dependency.

2. **Extract types** — Define TypeScript interfaces for Ticket, Employee, ActivityLog based on the schema in `Plan_DB_Implementation.md`.

3. **Build pages one at a time** — Start with Dashboard (simplest), then Ticket List (most complex), then Finance, then E-Money sub-pages.

4. **Keep index.html running** — Until NextJS is fully tested, the original app stays live. Switch over when ready.

---

## 9. How to Run Locally

**Current app (no build needed):**
```
Open wave-emi-dashboard/index.html in any browser
```

**Vercel deployment:**
```
Push to main branch → auto-deploys to wave-emi-dashboard.vercel.app
```

**Reset all data:**
```
Press Ctrl+Shift+R on the dashboard (clears localStorage)
```

---

## 10. Questions for Binh to Think About

1. Look at `deriveStatus()` (line 611) — it's a state machine with 12 states. Does this logic make sense? Would you structure it differently?

2. Look at `createTicketFromN8n()` (line 2419) — it maps 50+ fields from pipeline to ticket. How would you handle this in a NextJS API route?

3. The CSV generation logic (`generateUtibaFiles`, line 1820) is complex — 7 different file formats. Should this stay client-side or move to a server-side API route?

4. The app uses no framework (vanilla JS, DOM manipulation). What's your preferred approach for the React migration — component-by-component, or page-by-page?

5. Auth/roles: currently just a dropdown selector (anyone can switch roles). For production, we need real auth. Supabase Auth or NextAuth.js — preference?

---

## Dashboard Demo

**Live:** https://wave-emi-dashboard.vercel.app

Test with different roles:
- **Intake / Maker:** See all tickets, create new ones, upload employee lists
- **Finance:** Approve/reject tickets with authority matrix check
- **E-Money:** Process approved tickets through Steps 4-7
