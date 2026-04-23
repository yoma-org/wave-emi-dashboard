# eMoney Handover — App & Pipeline

**Audience**: Wave infrastructure / DevOps team
**From**: DK Nguyen — Trustify Technology (contracted through Zeyalabs)
**Repo**: [github.com/yoma-org/wave-emi-dashboard](https://github.com/yoma-org/wave-emi-dashboard) (branch `kan47-v13.3` until merged to `main`)
**Companion doc**: [HANDOVER_INFRA.md](HANDOVER_INFRA.md) (Huy Nguyen Duc — AWS infra spec, pending)

---

## 1. How this handover works

**Wave = landlord. Trustify = operator.**

- Wave provisions AWS infrastructure (VPC, ALB, EC2, RDS, S3, SQS, IAM) — details in Huy's [HANDOVER_INFRA.md](HANDOVER_INFRA.md).
- Wave grants Trustify operational access credentials (one IAM user or cross-account role).
- Trustify installs, configures, deploys, and runs the app stack on top.
- When we ship new features or fix bugs, we push directly — **no per-change tickets to Wave**.

Why this model: it eliminates round-trip coordination delay. Wave keeps data sovereignty (everything lives in your AWS account, you own the audit trail, you can revoke access any time). Trustify keeps operational velocity.

---

## 2. What we need from you (Wave)

### AWS access

One IAM user (or cross-account role) for the Trustify team with these permissions on the eMoney resources:

- `rds:DescribeDBInstances` + Postgres connect (via IAM auth or master creds in Secrets Manager)
- `s3:GetObject` / `s3:PutObject` / `s3:ListBucket` on the eMoney attachments bucket
- `secretsmanager:GetSecretValue` on the eMoney secret(s)
- `bedrock:InvokeModel` on the Claude model ARN (see §5)
- `sqs:SendMessage` / `sqs:ReceiveMessage` / `sqs:DeleteMessage` on the eMoney SQS queues
- `lambda:InvokeFunction` on the webhook Lambda (so n8n can call it directly via AWS SDK)
- `ssm:StartSession` on the n8n EC2 instance (so we can SSH via Session Manager without opening port 22)
- `cloudwatch:GetLogs` / `logs:FilterLogEvents` on the relevant log groups (for our own debugging)

### Endpoint + credential handoff

- **n8n instance URL** (once Huy's infra is up): `https://n8n.<your-domain>` + initial admin credentials
- **RDS endpoint**: hostname + port + initial DB user/password (we'll rotate after first login)
- **S3 bucket name** (attachments) + **S3 static bucket name** (dashboard assets)
- **SQS queue URLs** (email-notify queue + webhook queue)
- **Secrets Manager secret names** where we should store our secrets (webhook secrets, Bedrock config if needed)

### Microsoft 365 info (3 questions — see §4)

### Ops

- **GitHub handles** for anyone on your side who wants read access to the repo (we'll add them to [yoma-org/wave-emi-dashboard](https://github.com/yoma-org/wave-emi-dashboard))

---

## 3. What we operate (on top of your AWS)

| Component | Source | How it's deployed |
|---|---|---|
| **Dashboard** (static HTML + assets) | [index.html](index.html) in the repo | We push via GitHub Actions → S3 static bucket (ALB serves it per [HANDOVER_INFRA.md](HANDOVER_INFRA.md)) |
| **Webhook Lambda** ([api/webhook.js](api/webhook.js)) | [`api/`](api) in the repo | We push via GitHub Actions → AWS Lambda. Triggered by SQS messages from n8n Worker. |
| **n8n workflows** (Spooler + Worker) | [`pipelines/`](pipelines) in the repo | We import + configure via your n8n UI directly on the EC2 |
| **Schema + migrations** | [sql/complete/emi_dashboard_schema_aws.sql](sql/complete/emi_dashboard_schema_aws.sql) + future migration files | We run manually via our RDS access (never auto-deployed) |
| **LLM integration** | [pipelines/_worker_v13_3_gemini_extract.js](pipelines/_worker_v13_3_gemini_extract.js) — prompt templates | We wire in Bedrock via the IAM you grant us |
| **Outlook credential** | n8n credential UI | We configure after §4 answers land |

You never need to touch the app stack. If something breaks, we'll debug using the logs + access you've given us, fix the code, push, redeploy. You get observability (CloudWatch logs) but the operational work is ours.

### 3.1 Service contracts (for routing + IAM scoping)

**One Lambda in AWS v1**: `webhook` (persistence handler). Invoked by SQS messages, not by the browser.

| Service | Who calls it | How | Purpose |
|---|---|---|---|
| **Lambda webhook** ([api/webhook.js](api/webhook.js)) | n8n Worker (server-to-server) | AWS SDK `Invoke` (IAM-signed) OR SQS-triggered | Persists extracted tickets to RDS. Verifies `X-Webhook-Secret` header for defense-in-depth when called directly. |
| **SQS: email-notify queue** | pg_trigger on `email_queue` INSERT (via Lambda) OR n8n Spooler directly (via AWS SDK) | `SendMessage` | Replaces pg_net — schedules email-processing work durably |
| **SQS: webhook queue** | n8n Worker after extraction | `SendMessage` | Decouples Worker from Lambda persist; Lambda consumes this queue |
| **Bedrock** | n8n Worker (direct, from EC2) | AWS SDK via VPC Endpoint | Extracts ticket + employees from email attachments |

**What the browser calls** (via ALB):
- `GET /` → S3 static dashboard (`index.html`)
- Browser ticket CRUD → **see §7.5 Open architectural question — browser-to-RDS access**

**Expected behaviour**:
- Non-POST on webhook → 405 `{"error":"POST only"}`
- Webhook missing/invalid `X-Webhook-Secret` → 401
- Webhook missing required fields (`company`) → 400
- Idempotency: webhook dedupes by `message_id` — safe to retry the same SQS message
- CORS: webhook is internal (SQS + n8n SDK only); CORS no longer relevant in AWS v1

**Request bodies**:
- Lambda webhook (SQS message body OR direct invoke payload) JSON: `{ company, message_id, from_address, subject, extracted_fields, attachments[], ... }` — full payload defined by n8n worker's final node output. Idempotency via `message_id`.

### 3.1.1 Attachment preview flow (two S3 buckets, one attachment path)

Two S3 buckets exist in the design:

| Bucket | Role | How browser accesses |
|---|---|---|
| **Static dashboard bucket** | Serves `index.html` + CSS/JS | ALB → VPC Endpoint → S3 (public-ish within Wave's network via ALB) |
| **Attachments bucket** | Stores PDF/XLSX/image binaries extracted from emails | Browser requests presigned URL from backend → fetches bytes directly from S3 via that URL |

**Attachment preview flow** (maps from current Supabase Storage `sb.storage.from('attachments').createSignedUrl(...)` pattern at [index.html:1224](index.html)):

1. User clicks "view attachment" in dashboard
2. Browser calls backend (n8n HTTP-trigger workflow OR Lambda) with the S3 object key, e.g., `tickets/TKT-042/attachments/bank_slip.pdf`
3. Backend uses AWS SDK to generate an S3 presigned URL (TTL ~1 hour, IAM-scoped to the attachments bucket only)
4. Browser uses the presigned URL directly with `PDF.js` (for PDFs) or `<img src>` (for images) — bandwidth bypasses the backend
5. URL expires after TTL; user clicks again to regenerate if needed

**Why this pattern**:
- Browser never holds long-lived AWS credentials
- Attachments bucket stays private (no public-access policy)
- Backend gates access via IAM + app-level auth
- Short TTL limits the blast radius of URL leakage

**Security requirements for the attachments bucket** (reinforcing §8):
- Bucket policy: no public access, encryption at rest (SSE-S3 or SSE-KMS)
- CORS: allow `GET` from the dashboard ALB domain only
- Server-side encryption required (attachments contain PII: employee lists, bank account numbers, signatures)
- Presigned URLs should be `GET`-only, never `PUT` in the browser path (uploads go through backend)

### 3.2 Deferred scope (not in AWS v1)

**Lambda `extract-employee`** — browser-upload employee roster → Bedrock OCR. Currently served from Vercel (`api/extract-employees.js`) but **deferred** from AWS v1 for three reasons:
1. The main n8n email pipeline already extracts employee rows from attachments (see `_worker_v13_3_gemini_extract.js` responseSchema — `employees[]` is in the schema). Main flow covers ~90% of use cases.
2. The Vercel endpoint is a pre-AWS workaround; porting it to AWS without redesign adds routing + payload-limit complexity (1 MB Lambda payload cap, presigned-S3 upload pattern needed, auth gap to close).
3. Wave team has not exercised this path in demos; feature is low-signal.

**Re-add plan when needed**: easiest path is an **n8n workflow with HTTP trigger** (browser POSTs to an n8n webhook endpoint, n8n calls Bedrock via the existing Worker credentials, returns JSON). Cost: ~1–2 hours to add. No AWS-native complexity needed unless we later want scale-to-zero.

**Return-to-Client n8n webhook** (current Vercel: `index.html:3250` calls `https://tts-test.app.n8n.cloud/webhook/return-to-client` directly). In AWS v1, this becomes a call to n8n on the Wave-hosted EC2 (internal URL, same `n8n.<your-domain>/webhook/return-to-client` path).

---

## 4. Microsoft 365 / Outlook — three questions

Separate track from the AWS side (different admin on your team, likely). Three answers unblock the Outlook credential work:

1. **Which mailbox does production monitor?**
   - Current (our demo): `emoney@zeyalabs.ai` — if you want to keep this through transition, fine
   - Production: almost certainly a Wave-domain mailbox (e.g., `emoney@wave-mm.com` or similar)
   - Either works; just tell us which path
2. **Which Microsoft 365 tenant hosts that mailbox?**
3. **Who's your tenant admin?** Specifically: the person authorized to register Azure AD apps and grant admin consent.

Once answered: we'll run the **credential-overwrites pattern** (Appendix A) — one Azure app registered once by your admin, then all n8n Outlook credentials flow through it with click-through OAuth. No per-developer friction.

---

## 5. CI/CD — how we'll deploy (our setup, on your AWS)

We handle this ourselves using **GitHub Actions + AWS OIDC**. You grant us an OIDC role once; we configure the Actions workflow on our side. No long-lived access keys leave your account.

| Target | Trigger | Safety |
|---|---|---|
| Dashboard static (S3 via ALB per HANDOVER_INFRA.md) | Every commit to `main` → auto-deploy | Low risk — pure frontend, instantly revertable |
| Lambda webhook | Every commit to `main` → auto-deploy | Low risk — stateless, versioned, SQS-triggered |
| n8n workflows | **Manual** — we import via n8n UI when ready | n8n Community has no native git-sync; we prefer direct control anyway |
| Schema migrations | **Manual with review** — never auto | Auto-running DDL against prod is a recipe for outage |

You don't configure anything for this beyond the OIDC role. We'll send the exact trust-policy JSON in the first sync.

---

## 6. Environment variables + credentials

Split between Lambda and n8n. Shared secrets (DB connection + webhook HMAC) live once in Secrets Manager; both sides fetch the same entry.

### Lambda webhook (Lambda function config + Secrets Manager)

| Var | Purpose | Source |
|---|---|---|
| `DB_HOST` + `DB_PORT` + `DB_NAME` | Postgres connection | Env var |
| `DB_USER` + `DB_PASSWORD` (or IAM auth token) | DB auth | Secrets Manager |
| `WEBHOOK_SECRET` | HMAC verifier for direct n8n invocations | Secrets Manager |
| `S3_BUCKET_NAME` | Attachments bucket name | Env var |
| `S3_REGION` + `AWS_REGION` | Region config | Env var |

**Lambda execution role** must have `secretsmanager:GetSecretValue`, `rds-db:connect` (if IAM auth), `sqs:ReceiveMessage` + `sqs:DeleteMessage` on the webhook queue, and `s3:GetObject` on attachments bucket.

### n8n (EC2 env + n8n credential UI)

| Config | Purpose | Source |
|---|---|---|
| `DB_HOST` + `DB_PORT` + `DB_NAME` + `DB_USER` + `DB_PASSWORD` | n8n reads/writes email_queue + ticket_vision_results | EC2 env vars (from Secrets Manager) |
| `WEBHOOK_SECRET` | HMAC signer for n8n → Lambda direct invocations (defense-in-depth) | EC2 env var |
| `EMAIL_NOTIFY_QUEUE_URL` + `WEBHOOK_QUEUE_URL` | SQS queue targets for send | EC2 env var |
| `BEDROCK_REGION` + `BEDROCK_MODEL_ID` | LLM extraction target (e.g., `anthropic.claude-opus-4-7-v1`) | EC2 env var |
| `CREDENTIALS_OVERWRITE_DATA` | Microsoft OAuth app override (see Appendix A) | EC2 env var |
| Microsoft Outlook credential | Mailbox polling + Send Email | n8n credential UI |
| AWS Bedrock credential | Invoke model | n8n credential UI (cleanest: instance IAM role on EC2 — no static creds) |

**EC2 instance role** (for n8n) must have `bedrock:InvokeModel` on the target model ARN, `sqs:SendMessage` + `sqs:ReceiveMessage` on both queues, `secretsmanager:GetSecretValue` on the eMoney secret, and optional `lambda:InvokeFunction` on webhook Lambda (if using direct-invoke path instead of SQS).

### Shared secrets

`WEBHOOK_SECRET` is shared between Lambda and n8n — both read the same Secrets Manager entry. RDS credentials are also shared but we recommend separate DB users per component (n8n user vs Lambda user) for audit clarity.

### Why Bedrock lives on n8n, not Lambda

Lambda webhook only persists pre-extracted tickets; it doesn't call the LLM. All extraction happens inside the n8n Worker pipeline (email + attachments → Bedrock → structured ticket), so Bedrock config lives with n8n, not Lambda.

---

## 7. Open questions for the first sync

### 7.1 Preferred AWS region
Singapore (`ap-southeast-1`) is closest to Myanmar; any constraint we don't know about?

### 7.2 n8n hosting
Confirmed EC2 + EFS + Auto Scaling group per Huy's 2026-04-22 diagram. ECS Fargate alternative if Wave prefers (we have no strong preference).

### 7.3 Dashboard serving path
Huy's design: **ALB → VPC Endpoint → S3 static bucket** (no CloudFront, no nginx). S3 static-website-hosting feature serves `index.html` + assets. ALB listener rules handle root-path → `index.html` defaulting. Internal-only vs internet-facing ALB is Wave's call (VPN / Direct Connect vs public + WAF). Full spec in [HANDOVER_INFRA.md](HANDOVER_INFRA.md).

### 7.4 Main-branch ownership long-term
Does [yoma-org/wave-emi-dashboard](https://github.com/yoma-org/wave-emi-dashboard) stay as the source of truth, or will Wave fork when Trustify winds down involvement? Affects how we shape CI/CD permanence.

### 7.5 Browser-to-RDS CRUD access pattern — **open architectural question**

The dashboard currently (on Vercel + Supabase) does all ticket CRUD by talking to **Supabase directly** from the browser via `supabase-js`. When RDS replaces Supabase in AWS, the browser cannot talk to RDS directly (RDS is TCP-only, VPC-internal). Three options:

- **Option A — Add Lambda CRUD endpoints** (`/api/tickets`, `/api/tickets/:id`, `/api/approve`, etc.) behind ALB. Browser switches from `supabase-js` to `fetch()`. Cleanest; ~1–2 weeks of app-side work; fully decouples browser from DB.
- **Option B — Amazon RDS Data API** (HTTPS to RDS with IAM-signed requests). Browser needs temporary IAM creds (via Cognito or similar). Less code to write but more complex auth flow.
- **Option C — Keep Supabase for browser-side CRUD, RDS for server-side only** (n8n Worker + Lambda webhook). Dual-DB situation; ugly but fastest to cutover. Supabase becomes a read-through bridge; RDS is canonical for new writes.

Recommend **Option A** long-term. For initial Wave demo + soft cutover, **Option C** is defensible (Trustify continues operating Supabase; Wave's data sovereignty applies to RDS + server-side). Need to discuss.

### 7.6 Transition timeline
How long does Trustify keep shipping features / fixing bugs? ~8–12 weeks of active development is our assumption.

---

## 8. Security posture — explicit requirements

Wave's security team will review this. These are the non-negotiables we're asking Wave's infra team to honor when provisioning, and that we're committing to follow on the app side.

### 8.1 IAM — least privilege only

- **No wildcard resources**. Every IAM policy must scope to specific ARNs (Lambda functions, SQS queues, Secrets Manager entries, S3 buckets, Bedrock model ARNs).
- **No `*` actions** on services handling PII (`secretsmanager`, `rds`, `s3` for attachments). Specify exact actions (`GetSecretValue`, `rds-db:connect`, `GetObject`).
- Each component (Lambda, EC2 n8n, operator user) gets its own role. No role sharing.
- Trustify's operator IAM user has read-only scope on observability (`cloudwatch`, `logs`), limited write on code-deploy targets (Lambda, S3 static bucket). No direct prod DB write access; we write via the Lambda + n8n pipelines.

### 8.2 Network posture

- **RDS**: VPC-internal only, no public subnet, security group allows ingress only from Lambda + n8n EC2 security groups.
- **SQS**: no public access, IAM-gated only.
- **Lambda webhook**: no function URL, not exposed via API Gateway, not internet-reachable. Only SQS triggers or n8n direct invoke reach it.
- **n8n EC2**: no SSH on port 22 — all access via SSM Session Manager.
- **Bedrock**: called via VPC Endpoint (PrivateLink), not public internet.
- **S3**: attachment bucket private (no public-access grant); dashboard static bucket accessible only via ALB → VPC Endpoint path.
- **ALB**: internal-only recommended (VPN / Direct Connect) unless Wave's team explicitly approves public with WAF.

### 8.3 Secrets management

- **All secrets in Secrets Manager**. No plaintext secrets in env vars (env vars carry pointer names only, e.g., `SECRETS_ARN_WEBHOOK`).
- **No secrets in CloudWatch logs**. Lambda + n8n log levels must mask `WEBHOOK_SECRET`, `DB_PASSWORD`, Bedrock API keys (if used).
- **Rotation**: Wave's side rotates DB credentials + webhook secret quarterly; we consume via Secrets Manager so rotation is transparent.

### 8.4 Data handling + PII

- **Payroll employee data** (name, MSISDN, amount per person) is sensitive.
- Stored at rest in RDS (encrypted by default) + in attachment S3 (enable SSE-S3 or SSE-KMS).
- In transit: all paths TLS (ALB → internal targets, Lambda → RDS, n8n → Bedrock).
- CloudWatch logging: **do not log** full employee lists or raw attachment bodies. Log only metadata (count, confidence, error type).
- Email attachments retained in S3 for `<retention-period>` (TBD with Wave compliance team).

### 8.5 Audit

- All AWS API calls captured in CloudTrail (Wave-level config; we expect this on).
- App-level audit: ticket state transitions captured in RDS (existing `tickets_v2` schema includes timestamps + actor).
- Failed logins / unauthorized webhook calls logged in CloudWatch with alert thresholds TBD.

> **Note for Wave's DevSecOps reviewer**: we've listed these explicitly because Rita flagged that Yoma's infra team may not default to these patterns. If any of these conflict with Yoma conventions, tell us and we'll reconcile before go-live — not after.

---

## 9. What we changed recently (context for reviewers)

The architecture has iterated over the last 48 hours — relevant if Wave reviewers have seen earlier drafts:

- **Apr 22 PM**: CloudFront removed from design (Huy). Replaced by ALB → VPC Endpoint → S3 direct. Simpler, VPC-only, PCI-friendly.
- **Apr 23 AM**: API Gateway removed. n8n invokes Lambda via AWS SDK direct; browser traffic flows ALB → Lambda (or S3 for static). One less service.
- **Apr 23 AM**: SQS adopted as the email-processing notification layer. Replaces pg_net (not available on RDS managed Postgres without extensions) + pg_cron sweeper. Visibility timeout + DLQ provide retry semantics.
- **Apr 23 AM**: Lambda `extract-employee` deferred from v1 — see §3.2.
- **Apr 23 AM (meeting)**: Rita confirmed full Wave-hosted AWS posture; no Trustify-side AWS account for eMoney.

---

## Appendix A — Outlook OAuth: three paths

We researched the options. Option 3 is our recommendation.

| Option | Who registers the Azure app | End-user UX | Fits Wave? |
|---|---|---|---|
| 1. n8n Cloud (paid SaaS) | n8n (their tenant) | One-click "Connect my account" | ❌ Data residency, can't audit in your tenant |
| 2. Self-hosted, per-user | Each developer, each credential | Paste tenant + client + secret per credential | ❌ Doesn't scale |
| 3. **Self-hosted + credential overwrites** | Your Microsoft admin registers ONE app, once | One-click "Connect my account" (same UX as Cloud) | ✅ **Recommended** |

### Option 3 setup

1. **Your Microsoft admin** registers a single Azure AD multi-tenant app in your Entra tenant:
   - Redirect URI: `https://<your-n8n-host>/rest/oauth2-credential/callback` (exact match, no trailing slash)
   - Delegated scopes: `openid profile offline_access Mail.ReadWrite Mail.Send` (add `Mail.ReadWrite.Shared` + `Mail.Send.Shared` if the target mailbox is shared)
   - Grant admin consent once
2. **Your AWS admin** sets the `CREDENTIALS_OVERWRITE_DATA` env var on the n8n instance with the client ID + secret (spec: [n8n docs](https://docs.n8n.io/hosting/configuration/configuration-examples/microsoft-oauth-credential-overwrites/))
3. When we (Trustify) create the Outlook credential in n8n, we see only "Connect my account" — no tenant/client/secret fields. All OAuth flows run through your app, audit trail lives in your tenant.

`offline_access` is mandatory — without it the refresh token isn't issued and the credential breaks after ~1 hour.

---

## Appendix B — Production quirks worth knowing

Things we learned operating this in production that will eventually come up:

1. **SQL files for handoff must be ASCII-only.** Decorative Unicode in comments (box-drawings, em-dashes) breaks DBeaver on Windows even though strict Postgres accepts it. Our schema file is ASCII as of commit `b080869`. Apply the rule to any SQL we hand you afterward.
2. **n8n Code node has a hard 60-second execution budget** per invocation. We use `Promise.allSettled` for parallel LLM calls to stay under. Don't serialize multi-attachment processing.
3. **Pipeline executions routinely run 15–25 seconds.** Budget SQS visibility timeout ≥ 60s so in-flight messages don't redeliver mid-processing. Lambda timeout for webhook consumer ≥ 30s.
4. **Microsoft Graph may truncate attachment lists** on emails with 5+ files where total size exceeds ~3MB per attachment. Our "too-many-attachments" rejection gate assumes this; monitor and tune if your volumes differ.
5. **Bedrock regional availability** — Claude Opus / Sonnet model IDs vary by region. Singapore and Sydney currently support `anthropic.claude-opus-4-7-*`; we'll confirm the exact model ARN with your AWS admin during provisioning.

---

## Next step

~30-minute sync with your team:
- Live demo of the current system (10 min)
- Walk through §2 asks together (15 min)
- Align on timeline + deliverables (5 min)

**Contact**: DK Nguyen, Huy Nguyen Duc, Vinh Nguyen Quang — via the shared Teams channel (`Yoma Bank – Infrastructure` or whichever you prefer).

---

**Repo**: [https://github.com/yoma-org/wave-emi-dashboard](https://github.com/yoma-org/wave-emi-dashboard)
