---
name: wave_emi_aws_handover_kickoff
aliases: ["Wave EMI AWS Handover Kickoff", "eMoney AWS Kickoff Packet"]
description: SUPERSEDED draft. Reframed after Apr 22 discussions with Vinh + Huy: the handover model changed from "Wave runs eMoney themselves with our runbook" to "Wave hosts infra, Trustify operates on top with granted access" (landlord/operator pattern). See the replacement HANDOVER_APP.md at repo root.
type: reference
topics: [wave-emi, aws, handover, kickoff, runbook, pipeline, superseded]
status: superseded
created: 2026-04-22
last_reviewed: 2026-04-22
superseded_by: HANDOVER_APP.md
---

> **SUPERSEDED** (2026-04-22 same day). This draft was written before the landlord/operator model was clarified in the Huy + Vinh chats. Kept in git history for context; do not use for handoff. See [`HANDOVER_APP.md`](../HANDOVER_APP.md) at repo root for the shipped version.

# eMoney Pipeline — AWS Handover Kickoff

**For**: Wave infrastructure team
**From**: Trustify Technology — DK Nguyen, Huy Nguyen Duc (infra)
**Status**: Draft v0.1 — pending internal review (Vinh + Huy) before Wave share
**Version history**: v0.1 (2026-04-22) initial kickoff

---

## 1. Purpose of this document

You are receiving this because Wave has agreed to self-host the eMoney email-automation pipeline on your own AWS infrastructure. Trustify will transition from operator to **advisor / observer**.

This document is a **kickoff packet**, not a launch runbook:

- ✅ What it gives you: shared context, architecture at 10,000 ft, the artifacts we're handing over, the info we need from you to write detailed setup steps, and a proposed first-sync agenda.
- ❌ What it does NOT give you: "do X in your AWS account" step-by-step. We'll write those *after* our first joint sync, when we know which AWS account / region / VPC / n8n choice / IAM conventions your team already uses.

**Why this order**: writing detailed AWS steps against an unknown environment would be guesswork. One hour together first saves a week of wrong assumptions.

---

## 2. What eMoney does (10,000 ft)

eMoney is an email-driven automation pipeline for corporate salary disbursement in Myanmar. Operators at Wave receive salary-disbursement request emails from enterprise customers; the pipeline ingests each email, uses AI to extract structured data (amount, currency, employee list, bank slip totals), and produces a ticket on a dashboard where Finance + E-Money operators review, approve, and generate Utiba CSV files for payment.

### High-level components

```
┌─────────────────┐     ┌──────────────┐     ┌────────────────┐
│  Corporate      │ ──▶ │  Monitored   │ ──▶ │  n8n workflow  │
│  customer email │     │  mailbox     │     │  (Worker)      │
└─────────────────┘     │  (Outlook)   │     └────────┬───────┘
                        └──────────────┘              │
                                                      ▼
  ┌──────────────┐     ┌────────────────┐     ┌──────────────┐
  │  Dashboard   │ ◀── │  Postgres DB   │ ◀── │  AWS Bedrock │
  │  (web app)   │     │  + S3 storage  │     │  Claude Opus │
  └──────────────┘     └────────────────┘     └──────────────┘
```

Full detailed flow: [wave_emi_architecture_data_flow.md](wave_emi_architecture_data_flow.md) in our handoff package.

### Data surface

- **Tickets**: one per incoming email, state-machine-tracked through Finance review → E-Money generation → disbursement monitoring → close
- **Attachments**: PDFs (payroll docs), Excel/CSV (employee lists), images (bank slips) — stored in object storage, referenced by URL
- **Extracted fields per attachment**: amount, currency, payment date, employee counts, signers, etc. (JSONB for flexibility)

### Volume expectations (current production signal)

- ~5-20 emails/day in steady state (seasonal peaks during salary cycle)
- Average 1-4 attachments per email
- Payloads: 2-50 MB per email (dominated by attachments)

---

## 3. What we're handing over

| Artifact | Location | Notes |
|---|---|---|
| **Dashboard source** | `github.com/yoma-org/wave-emi-dashboard` (branch: `main` + `kan47-v13.3`) | Single-file vanilla JS; no build step |
| **Serverless API** | `api/webhook.js` + `api/extract-employees.js` inside the repo | Intake endpoint + client-side helper |
| **AWS-portable schema SQL** | `sql/complete/emi_dashboard_schema_aws.sql` in the repo | Single-file DDL, Postgres 13+, `gen_random_uuid()` built-in, validated via pglite |
| **n8n workflow JSON** | To be exported from our current production instance before handoff (TBD filename) | ~17 nodes: Outlook trigger → AI extract → validate → persist → notify |
| **Worker Code-node scripts** | `pipelines/_worker_v13_3_*.js` | Pre-for-AI, Gemini-extract, parse-validate (Gemini will be swapped to Bedrock — see §7) |
| **Architecture doc** | [wave_emi_architecture_data_flow.md](wave_emi_architecture_data_flow.md) | Detailed data-flow + state machine |
| **Testing guide** | [wave_emi_testing_guide_outlook_pipeline.md](wave_emi_testing_guide_outlook_pipeline.md) | 3 canonical smoke tests |
| **End-user guide** | [wave_emi_user_handover_guide.md](wave_emi_user_handover_guide.md) | For Finance + E-Money operators, not infra |

GitHub repo access: we'll grant read/clone rights to whoever you nominate once we have your GitHub handles.

---

## 4. What we need from Wave

To plan the detailed setup steps, please confirm or answer before our first sync:

### AWS environment

- [ ] **Account ID + region** where eMoney will live (Singapore closest to Myanmar preferred)
- [ ] **VPC layout**: shared VPC or dedicated? Public subnet for webhook endpoint required.
- [ ] **IAM convention**: service-account role we'll use? Or a naming prefix?
- [ ] **Bedrock access**: is Claude Opus 4.7 already enabled in the chosen region? (`anthropic.claude-opus-4-7-v1` model ID)
- [ ] **Secrets Manager vs Parameter Store**: which does your team prefer?
- [ ] **Existing Postgres RDS** to reuse, or provision fresh? (~`db.t3.small` for testing, scale as needed)
- [ ] **S3 bucket**: existing shared bucket or dedicated for eMoney?

### n8n hosting

- [ ] **n8n Community Edition self-hosted on your AWS (EC2 or ECS)** is our recommendation — see §6 for the three-path analysis. Please confirm this is acceptable or flag a platform constraint we don't know about.
- [ ] If self-hosting: **Docker or native Node** process? Either works; Docker is our current testing pattern.

### Microsoft 365 / Outlook

(Separate track from AWS — different admin on Wave's side likely)
- [ ] **Tenant**: same as the one emoney mailbox currently lives in, or different?
- [ ] **Target mailbox**: which Outlook mailbox will eMoney monitor in production?
- [ ] **Admin contact**: who on Wave is the Microsoft 365 global admin?

### Operational

- [ ] **Deploy process**: CI/CD (GitHub Actions? CodePipeline?) or manual?
- [ ] **Runtime hosting** for dashboard: CloudFront+S3? Amplify? ECS?
- [ ] **Logging + alerts**: CloudWatch, or external (Datadog/New Relic)?

**Answers drive the detailed chapters** — we cannot write Chapter 5 (n8n) without the Cloud-vs-Community answer, we cannot write Chapter 6 (Outlook) without the tenant info, etc.

---

## 5. Proposed first-sync agenda (~60 min)

1. **Introductions** (5 min) — Trustify side: DK (dashboard + pipeline), Huy (AWS infra), Vinh (tech lead). Wave side: whoever you nominate.
2. **Demo of current production** (10 min) — DK shares the live dashboard + walks through a real ticket end-to-end so your team sees what's being handed over.
3. **Q&A on architecture** (10 min) — your team's chance to challenge / request changes before we lock chapters.
4. **Walk through §4 checklist together** (20 min) — fill in the asks live. Anything unknown becomes a side action with an owner + date.
5. **Agree deliverable format** (5 min) — markdown in the repo? Confluence? Notion? PDF? Who reviews?
6. **Next-sync date** (5 min) — weekly or biweekly until Wave's environment is up.
7. **Parking lot** (5 min) — everything else.

---

## 6. Chapter map (full runbook, post-sync)

Chapter stubs below — **each gets filled in after §4 answers come back**. Do not treat the current content as the final spec.

### Chapter 1 — Overview + prereqs
*Covered by this kickoff doc. Will be refined based on §4 answers.*

### Chapter 2 — AWS infra bring-up (owner: Huy, Trustify)
*Pending §4 answers on region / VPC / IAM / Postgres / S3 preferences. Will cover: RDS provisioning, S3 bucket + policies, IAM roles for app + Bedrock, Secrets Manager entries, VPC + security groups, networking to n8n.*

### Chapter 3 — Database schema deploy
Single step:
1. Clone the repo, navigate to `sql/complete/emi_dashboard_schema_aws.sql`
2. Run top-to-bottom on the target RDS instance (use `psql`, pgAdmin, or your preferred client — **note**: if using DBeaver on Windows, confirm your client handles the file cleanly; we had a UTF-8 portability issue in an earlier version, now resolved as of commit `b080869`)
3. Uncomment the `-- VERIFICATION` block at the bottom, run the 7 checks, paste output for us to review

**No schema changes expected from Wave side**. If you need column additions later, coordinate with Trustify first — the dashboard has hard-coded column expectations.

### Chapter 4 — Application code deployment

**What to deploy**:
- Static dashboard: `index.html` + related assets → CloudFront + S3 (or equivalent)
- API endpoints: `api/webhook.js` + `api/extract-employees.js` → Lambda + API Gateway (or Amplify, or ECS)

**Env vars to configure** (names as they appear today on Vercel; rename freely on your side):

| Current name | Purpose | New-env equivalent |
|---|---|---|
| `SUPABASE_URL` | DB connection | `DB_HOST` / `DB_URL` (your choice) |
| `SUPABASE_SERVICE_ROLE_KEY` | DB auth | `DB_CONNECTION_SECRET_ARN` (Secrets Manager ref) |
| `WEBHOOK_SECRET` | Shared with n8n for HMAC | Keep name, regenerate value on your side |
| (new) `BEDROCK_REGION` | Bedrock invoke region | Matches your chosen region |
| (new) `BEDROCK_MODEL_ID` | Claude Opus 4.7 model ARN | `anthropic.claude-opus-4-7-v1` or regional equivalent |
| (new) `S3_BUCKET_NAME` | Attachments bucket | Your chosen bucket |

**Deploy safety flag** (learned the hard way): when testing from a feature branch, verify external webhook callers are pointing to the preview URL, not the production URL. Our old Vercel pattern bit us once — see our internal lesson on this.

### Chapter 5 — n8n pipeline setup

**Recommended path**: n8n Community Edition self-hosted on AWS EC2 (or ECS Fargate), with the credential-overwrites pattern for Microsoft Outlook (see §6).

**Setup steps (draft — to be confirmed with §4 answers)**:

1. Provision EC2 instance (or ECS task). Minimum specs for our traffic: t3.small with 20 GB EBS. Docker image `n8nio/n8n` latest; run behind an HTTPS reverse proxy (nginx or ALB) — n8n needs HTTPS for OAuth2 callbacks.
2. Set environment variables:
   - `N8N_HOST` = your n8n domain (e.g., `n8n.wave.internal`)
   - `N8N_PROTOCOL=https`
   - `WEBHOOK_URL=https://<n8n-host>/`
   - Postgres config: point at the RDS instance from Chapter 2
   - Credential overwrite vars for Microsoft OAuth2 (see §6)
3. Import `n8n-workflow-worker-v13-3.json` (we'll export from current prod before handoff — TBD exact filename)
4. Attach credentials:
   - **Microsoft Outlook** — once step §6 is complete, users click "Connect my account"
   - **Postgres** — connection string + secret from AWS Secrets Manager
   - **AWS Bedrock** — IAM role attached to the EC2/ECS task (preferred over static keys)
5. Wire webhook URL in the dashboard's `api/webhook.js` to call `<n8n-host>/webhook/<path>` on queue inserts
6. Activate workflow

**Why not n8n Cloud**: the paid SaaS ($20/mo Starter) has a 2,500-execution cap and hosts in EU. For Wave's data-residency + PCI requirements, the OAuth app needs to live in your own Microsoft tenant (audit trail, conditional access, DLP). n8n Cloud ships with their own pre-registered OAuth app, which is easier but not acceptable for a regulated financial-services workload.

### Chapter 6 — Outlook / Microsoft Graph credential

There are **three paths** to Outlook OAuth on n8n — we've researched all three and recommend option 3:

| Option | Who registers the Azure app | End-user experience | Admin friction | Fits Wave? |
|---|---|---|---|---|
| 1. n8n Cloud | n8n (their tenant) | One click "Connect my account" | None | ❌ data residency + compliance |
| 2. Self-hosted, per-user | Each developer registers their own | Paste client ID / secret / tenant ID per credential | High — every new dev re-registers | ❌ not scalable |
| 3. **Self-hosted, credential overwrites** | Wave Microsoft admin registers ONE app, once | One click "Connect my account" (same as Cloud) | One-time admin setup | ✅ **RECOMMENDED** |

**How option 3 works** (per n8n's [Microsoft OAuth Credential Overwrites](https://docs.n8n.io/hosting/configuration/configuration-examples/microsoft-oauth-credential-overwrites/) docs):

1. Your Microsoft 365 admin registers ONE Azure AD multi-tenant app in Wave's Entra tenant
   - Redirect URI: `https://<your-n8n-host>/rest/oauth2-credential/callback` (exact match, no trailing slash)
   - Scopes: `openid profile offline_access Mail.ReadWrite Mail.Send` (add `Mail.ReadWrite.Shared + Mail.Send.Shared` if the target mailbox is shared)
   - Grant admin consent once
2. Your AWS admin sets `CREDENTIALS_OVERWRITE_DATA` env var on the n8n instance with the client ID + secret
3. Developers creating Outlook credentials in n8n thereafter see only a "Connect my account" button — no tenant/client fields exposed
4. All OAuth flows happen against Wave's own Entra app → Wave owns the audit trail + conditional access + DLP policies

**Owner on your side**: Microsoft 365 tenant admin (likely a different person from the AWS owner). **Important**: the same admin access is needed for the broader Microsoft Graph API migration we have pending, so **bundle both asks into a single meeting with the admin** rather than two separate requests.

**Critical detail**: `offline_access` scope is **mandatory** — without it the refresh token isn't issued and the credential breaks after ~1 hour.

We're keeping Microsoft admin work as a **separate track** from the AWS handover so the two conversations can proceed in parallel — but option 3 requires BOTH sides (Microsoft admin + AWS admin) to each do one small task once.

### Chapter 7 — LLM: Gemini → Claude Opus 4.7 via AWS Bedrock
**Switch rationale**: production LLM for OCR + field extraction moves from Google Gemini (consumer API, current) to AWS Bedrock Claude Opus 4.7. Reasons: stays inside your AWS account (no external API egress, better data residency), integrates cleanly with your IAM, audit trail via CloudTrail.

**Cost note to flag**: Claude Opus is more expensive per token than Gemini 3 Flash (Trustify's estimate: ~2-3× depending on scenario). Worth validating against real eMoney traffic patterns before committing — we can provide the last 30 days of token counts.

**Prompt contract is preserved** — we ship the same prompt templates in `pipelines/_worker_v13_3_gemini_extract.js`; only the client SDK call changes (Anthropic SDK → AWS SDK `bedrock-runtime:InvokeModel`).

**Required IAM**: `bedrock:InvokeModel` on the specific model ARN.

### Chapter 8 — Smoke test + sign-off

Run these three tests after each deploy milestone. Each test should complete end-to-end within 2 minutes.

1. **Happy-path**: send an email from a personal Microsoft account to the monitored mailbox with one PDF payroll attachment and body text containing company name, amount, currency, payment date. Expect: ticket `TKT-NNN` appears in the dashboard within 60 seconds with extracted fields populated; email notification sent back to sender on success.

2. **Multi-attachment**: send an email with 4 attachments (PDF + XLSX + PNG + JPEG). Expect: 4 rows in the `ticket_attachments` table, dashboard shows tabbed per-attachment view with independent extractions (this validates our KAN-47 multi-attachment feature).

3. **Rejection path**: send an email with subject only and empty body. Expect: NO ticket created; automated rejection email sent back to sender explaining the required format.

**Sign-off checklist**: all three tests pass on two consecutive days, Wave ops lead confirms, Trustify switches to observer mode.

**Testing anti-patterns** (learned the hard way):
- Don't send test emails **from the monitored mailbox to itself** — the Outlook trigger picks up the self-sent copy and the workflow stalls. Always use an external account as sender.
- For end-to-end tests, verify you're hitting the production deploy URL (not a preview branch deploy) if you're using Vercel-style branch deployments.

---

## 7. Ownership matrix (proposed — confirm in first sync)

| Area | Trustify | Wave |
|---|---|---|
| Schema design (future changes) | Lead | Review |
| AWS infra day-to-day | Advise only | **Own** |
| Microsoft 365 / Outlook admin | Advise only | **Own** |
| Dashboard features + bug fixes | **Own** (transition period) | Receive |
| n8n workflow changes | **Own** (transition period) | Receive |
| Bedrock prompt tuning | **Own** (shared in transition) | Joint |
| Incident response | Advisory | **Own** |

"Transition period" = ~8-12 weeks after production cutover, after which Trustify is pure-advisory.

---

## 8. Assumptions we are making (please correct)

These are inferences on our side — any of them could be wrong. Please confirm or push back in the first sync:

1. **Wave has AWS familiarity in-house** — we assume you have someone comfortable with RDS + IAM + Lambda or equivalent. If not, Huy can pair on setup.
2. **Wave wants to self-host n8n long-term** — we assume the Cloud-vs-Community decision is yours, not a constraint imposed by your platform team.
3. **Microsoft 365 tenant is stable** — we assume the Outlook mailbox we'll monitor stays on the same tenant long-term.
4. **Myanmar data residency** — we assume Singapore region is acceptable; if Myanmar-specific residency is required, that's a harder constraint that affects Bedrock availability.
5. **Dashboard deployment pattern** — we assume CloudFront+S3 is OK for the static site; if you prefer Amplify or ECS, easy change.
6. **Transition timeline** — we assume ~8-12 weeks to full production cutover. Faster is possible if your team has bandwidth.

---

## 9. Contact

**Trustify side**:
- **DK Nguyen** — dashboard, pipeline, this document — ping via the shared Teams channel
- **Huy Nguyen Duc** — AWS infrastructure lead — ping via the shared Teams channel
- **Vinh Nguyen Quang** — tech lead / escalation — ping via the shared Teams channel

**Wave side**: please nominate an AWS-infra lead, a Microsoft-admin lead, and a project contact so we know who to route questions to.

---

## Appendix — Known quirks worth flagging early

Things we learned operating this in production that you'll hit eventually:

1. **SQL files for handoff should be pure ASCII** — our schema file originally had decorative Unicode (box-drawings) in comments; it validated clean in strict Postgres but broke DBeaver on Windows. Resolved in commit `b080869`. Apply the same rule to anything else you receive from us.
2. **n8n Code-node has a hard 60-second execution budget** per invocation — we use `Promise.allSettled` for parallel Gemini/Bedrock calls to stay under. Don't serialize multi-attachment processing.
3. **pg_net HTTP response timeout** defaults to 5 seconds — our workflow runs 15-25 seconds; the `timed_out=true` flag in `_http_response` is NOT a failure signal for us. If you port the pg_net + pg_cron scheduling pattern, budget accordingly.
4. **Graph API attachment truncation** — Microsoft Graph sometimes truncates attachment lists on emails with 5+ attachments if total size exceeds ~3 MB per file. Our "too-many-attachments" rejection gate assumes this; if Wave volumes differ, tune the threshold.

---

*End of kickoff packet. Real runbook chapters (Ch 2, 5, 6 full detail) come after the first joint sync.*
