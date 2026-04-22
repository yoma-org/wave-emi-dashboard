# eMoney Handover — App & Pipeline

**Audience**: Wave infrastructure / DevOps team
**From**: DK Nguyen — Trustify Technology (contracted through Zeyalabs)
**Repo**: [github.com/yoma-org/wave-emi-dashboard](https://github.com/yoma-org/wave-emi-dashboard) (branch `kan47-v13.3` until merged to `main`)
**Companion doc**: [HANDOVER_INFRA.md](HANDOVER_INFRA.md) (Huy Nguyen Duc — AWS infra spec, pending)

---

## 1. How this handover works

**Wave = landlord. Trustify = operator.**

- Wave provisions AWS infrastructure (EC2, RDS, S3, IAM) — details in Huy's [HANDOVER_INFRA.md](HANDOVER_INFRA.md).
- Wave grants Trustify operational access credentials.
- Trustify installs, configures, deploys, and runs the app stack on top.
- When we ship new features or fix bugs, we push directly — **no per-change tickets to Wave**.

Why this model: it eliminates round-trip coordination delay. Wave keeps data sovereignty (everything lives in your AWS account, you own the audit trail, you can revoke access any time). Trustify keeps operational velocity.

---

## 2. What we need from you (Wave)

To start operating:

### AWS access

One IAM user (or cross-account role) for the Trustify team with these permissions on the eMoney resources:

- `rds:DescribeDBInstances` + Postgres connect (via IAM auth or master creds in Secrets Manager)
- `s3:GetObject` / `s3:PutObject` / `s3:ListBucket` on the eMoney attachments bucket
- `secretsmanager:GetSecretValue` on the eMoney secret(s)
- `bedrock:InvokeModel` on the Claude model ARN (see §5)
- `ssm:StartSession` on the n8n EC2 instance (so we can SSH via Session Manager without opening port 22)
- `cloudwatch:GetLogs` / `logs:FilterLogEvents` on the relevant log groups (for our own debugging)

### Endpoint + credential handoff

- **n8n instance URL** (once Huy's infra is up): `https://n8n.<your-domain>` + initial admin credentials
- **RDS endpoint**: hostname + port + initial DB user/password (we'll rotate after first login)
- **S3 bucket name**
- **Secrets Manager secret names** where we should store our secrets (webhook secrets, Bedrock config if needed)

### Microsoft 365 info (3 questions — see §4)

### Ops

- **GitHub handles** for anyone on your side who wants read access to the repo (we'll add them to [yoma-org/wave-emi-dashboard](https://github.com/yoma-org/wave-emi-dashboard))

---

## 3. What we operate (on top of your AWS)

| Component | Source | How it's deployed |
|---|---|---|
| **Dashboard** (static HTML + assets) | [index.html](index.html) in the repo | We push via GitHub Actions → S3 + CloudFront invalidate |
| **API** ([api/webhook.js](api/webhook.js), [api/extract-employees.js](api/extract-employees.js)) | [`api/`](api) in the repo | We push via GitHub Actions → AWS Lambda + API Gateway |
| **n8n workflow** | [`pipelines/`](pipelines) in the repo | We import + configure via your n8n UI directly |
| **Schema + migrations** | [sql/complete/emi_dashboard_schema_aws.sql](sql/complete/emi_dashboard_schema_aws.sql) + future migration files | We run manually via our RDS access (never auto-deployed) |
| **LLM integration** | [pipelines/_worker_v13_3_gemini_extract.js](pipelines/_worker_v13_3_gemini_extract.js) — prompt templates | We wire in Bedrock via the IAM you grant us |
| **Outlook credential** | n8n credential UI | We configure after §4 answers land |

You never need to touch the app stack. If something breaks, we'll debug using the logs + access you've given us, fix the code, push, redeploy. You get observability (CloudWatch logs) but the operational work is ours.

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
| Dashboard static (S3 + CloudFront) | Every commit to `main` → auto-deploy | Low risk — pure frontend, instantly revertable |
| API Lambda | Every commit to `main` → auto-deploy | Low risk — stateless, versioned |
| n8n workflows | **Manual** — we import via n8n UI when ready | n8n Community has no native git-sync; we prefer direct control anyway |
| Schema migrations | **Manual with review** — never auto | Auto-running DDL against prod is a recipe for outage |

You don't configure anything for this beyond the OIDC role. We'll send the exact trust-policy JSON in the first sync.

---

## 6. Environment variables

The app expects the following at runtime. Names are what we use in Vercel today; rename freely on your side. Secrets go in Secrets Manager; non-secret config as Lambda env vars.

| Var | Purpose | Source |
|---|---|---|
| `DB_URL` | Postgres connection string | Secrets Manager |
| `DB_SERVICE_ROLE_KEY` | DB auth if using a per-service user | Secrets Manager |
| `WEBHOOK_SECRET` | HMAC shared with n8n | Secrets Manager — regenerate on your side, share to n8n + API |
| `BEDROCK_REGION` | Bedrock invoke region | Env var (matches your chosen region) |
| `BEDROCK_MODEL_ID` | Claude Opus 4.7 model ID | Env var — `anthropic.claude-opus-4-7-v1` or your regional equivalent |
| `S3_BUCKET_NAME` | Attachments bucket | Env var |
| `S3_REGION` | Bucket region | Env var |

---

## 7. Open questions for the first sync

1. **Preferred AWS region** — Singapore is closest to Myanmar; any constraint we don't know about?
2. **n8n hosting preference** — EC2 vs ECS Fargate for the Community edition host? Either works.
3. **Dashboard hosting** — CloudFront + S3 vs Amplify vs ECS? No strong preference on our side.
4. **Main-branch ownership long-term** — does [yoma-org/wave-emi-dashboard](https://github.com/yoma-org/wave-emi-dashboard) stay as the source of truth, or will Wave fork when Trustify winds down involvement? Affects how we shape the CI/CD permanence.
5. **Transition timeline** — how long does Trustify keep shipping features / fixing bugs? ~8-12 weeks of active development is our assumption.

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
3. **Pipeline executions routinely run 15–25 seconds.** If you layer HTTP-triggered scheduling in front (e.g., pg_net or API Gateway), budget for ≥30s response timeouts. Short timeouts report "timed out" even when the workflow completes successfully downstream.
4. **Microsoft Graph may truncate attachment lists** on emails with 5+ files where total size exceeds ~3MB per attachment. Our "too-many-attachments" rejection gate assumes this; monitor and tune if your volumes differ.

---

## Next step

~30-minute sync with your team:
- Live demo of the current system (10 min)
- Walk through §2 asks together (15 min)
- Align on timeline + deliverables (5 min)

**Contact**: DK Nguyen, Huy Nguyen Duc, Vinh Nguyen Quang — via the shared Teams channel (`Yoma Bank – Infrastructure` or whichever you prefer).

---

**Repo**: [https://github.com/yoma-org/wave-emi-dashboard](https://github.com/yoma-org/wave-emi-dashboard)
