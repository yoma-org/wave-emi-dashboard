---
name: aws_architecture_primer
aliases: ["AWS Architecture Primer", "Wave EMI AWS Learning Guide", "AWS for Data Engineers — eMoney Edition"]
description: Self-contained learning guide for engineers new to AWS serverless architecture, built around the Wave eMoney handover. Explains CloudFront, S3, API Gateway, Lambda, RDS, IAM, Secrets Manager, and Bedrock in plain language with a consistent restaurant analogy. Designed to be paste-ready into NotebookLM or similar study tools.
type: reference
topics: [aws, architecture, learning, primer, serverless, wave-emi, teaching]
status: active
created: 2026-04-22
last_reviewed: 2026-04-22
---

# AWS Architecture Primer — eMoney Edition

*A self-contained learning guide to understanding how the Wave eMoney pipeline runs on AWS. Written for engineers who know web basics (HTTP, databases, APIs) but are new to AWS specifics.*

---

## What you'll learn

After reading this, you should be able to answer:

- What does each AWS service do, in plain English?
- Why is the eMoney system split into three separate "stacks"?
- What happens in AWS when a user clicks a button on the dashboard?
- What happens in AWS when a client sends a salary-disbursement email?
- Where does each piece of data live (files, records, secrets, config)?
- What's the "landlord / operator" handover model and why did we choose it?

---

## 1. The problem — what eMoney actually does

Wave Money is a mobile financial services company in Myanmar. They handle corporate salary disbursements: a company emails Wave a list of employees + amounts + attachments (bank slips, payroll PDFs), and Wave's operations team processes payments.

Manually, that's slow and error-prone. The eMoney system automates it:

1. Corporate clients email a salary request (with attachments) to a monitored mailbox.
2. An AI pipeline reads the email, extracts structured data (amounts, employee list, currency, bank slip totals).
3. A dashboard shows each request as a "ticket" for Finance + E-Money operators to review, approve, and release.
4. Approved tickets produce Utiba payment CSV files that get uploaded to Wave's payment system.

The architecture has four jobs:

- **Serve a dashboard** (the web app Wave operators use)
- **Handle API calls** (when the dashboard needs to read/write data)
- **Process emails in the background** (the worker that watches the inbox, runs AI, creates tickets)
- **Store everything** (tickets, attachments, audit logs)

---

## 2. The cast — each AWS service in plain language

### S3 (Simple Storage Service)

A place to put files. Like Dropbox but for applications.

- You upload files, get a URL back, other code can read the file from that URL.
- Used in eMoney for: dashboard HTML/CSS/JS files, email attachments (PDFs, Excel, images).
- Cost model: you pay for storage + bandwidth. Cheap.

### CloudFront

AWS's CDN (content delivery network). A global network of cache servers.

- When a user in Myanmar asks for a file from S3 (which lives in Singapore), CloudFront has a copy cached in a server close to Myanmar.
- The user gets the file fast because of the proximity.
- Used in eMoney for: serving the dashboard HTML/JS/CSS to users' browsers with low latency.

### Lambda

"Run this function when something calls it. Don't make me manage a server."

- You upload a function (e.g., our `api/webhook.js`). AWS runs it when an HTTP request (or other trigger) fires.
- You pay per invocation, per millisecond of execution. Zero cost when idle.
- Scales automatically — if 1000 requests hit at the same time, AWS spins up 1000 Lambda executions in parallel.
- Used in eMoney for: the API endpoints (`/api/webhook`, `/api/extract-employees`).

### API Gateway

"Catches HTTP requests from the internet and routes them to Lambdas."

- You configure routes: `POST /api/webhook` → invoke Lambda X. `POST /api/foo` → invoke Lambda Y.
- Handles rate limiting, authentication (optional), request validation.
- Used in eMoney for: exposing Lambda functions as real URLs the dashboard's JavaScript can call.

### RDS (Relational Database Service)

Managed Postgres (or MySQL, SQL Server, etc.). AWS runs the database server; you just use it.

- Same Postgres you'd run yourself. AWS handles backups, patching, failover.
- You pay for the instance (per-hour) + storage.
- Used in eMoney for: the main database — tickets, email queue, attachments metadata, activity log.

### Secrets Manager

"A safe place to put sensitive strings (DB passwords, API keys, webhook secrets)."

- Your code asks Secrets Manager for a secret by name; Secrets Manager returns the value.
- Only identities (IAM roles) with explicit permission can read each secret.
- Rotation support built-in.
- Used in eMoney for: DB credentials, webhook HMAC secret, external API keys.

### IAM (Identity and Access Management)

"The permission system." Every AWS action is gated by an IAM policy.

- You define "roles" (like "eMoney Lambda Role") with a list of permissions ("this role can read from S3 bucket X, invoke Bedrock model Y").
- Then you attach the role to a resource (e.g., "this Lambda function runs AS this role").
- Used in eMoney for: giving each piece exactly the access it needs, no more.

### Bedrock

AWS's hosted AI model service. Click a button, get an API endpoint for Claude / Mistral / Titan / etc.

- You call Bedrock from your code using standard AWS SDK. Model weights live in AWS, not in your account.
- Pay per token.
- Used in eMoney for: replacing our current Google Gemini (consumer API) with Claude Opus 4.7 running inside Wave's AWS account for data residency.

### EC2 (Elastic Compute Cloud)

A rented virtual server. Old-school "here's a Linux box, run whatever you want on it."

- You pick a size (CPU + RAM), install software, pay per hour.
- Used in eMoney for: hosting the n8n worker process (because n8n isn't serverless — it's a persistent app that polls email).

### n8n (not AWS — open-source tool)

A workflow automation platform. Lets you build pipelines visually: "when an email arrives, extract these fields, call this API, save to database."

- Think of it as Zapier / Power Automate, but open-source and self-hostable.
- Runs as a Node.js app on EC2 in our architecture.
- Used in eMoney for: the email polling + AI extraction + ticket creation pipeline.

---

## 3. The restaurant analogy (unified mental model)

All the AWS pieces map to a restaurant:

| AWS service | Restaurant role | What they do |
|---|---|---|
| S3 | Pantry | Stores files and ingredients |
| CloudFront | Lobby / Greeter | Shows menu to each customer fast, uses local copies |
| Lambda | Short-order cook | Cooks a dish on demand, goes idle between orders |
| API Gateway | Order counter | Takes customer orders, tells the right cook |
| RDS | Inventory book | Master record of everything: orders, inventory, customer data |
| Secrets Manager | Safe in the back office | Keeps keys to the pantry and the cash register |
| IAM | Employee ID badges | Defines what each employee can access |
| Bedrock | Special-ingredient supplier | Delivers exotic ingredients (AI responses) on demand |
| EC2 | Kitchen space | Physical space where staff (n8n) works |
| n8n | Kitchen staff | Does background prep work (reads emails, processes food) |

When a customer (user) arrives:
1. They walk into the **lobby** (CloudFront) and see the menu (dashboard HTML from S3)
2. When they want to order something, they go to the **order counter** (API Gateway)
3. The counter relays the order to the right **cook** (Lambda)
4. The cook may check the **inventory book** (RDS) or call the **ingredient supplier** (Bedrock)
5. The meal comes back to the customer

Meanwhile, **kitchen staff** (n8n) works in the background on a different set of tasks (processing emails), using the same **inventory book** (RDS) and **ingredient supplier** (Bedrock).

---

## 4. The three stacks — why the system is split into three

Real AWS architectures often have multiple "stacks" — logical groupings of services that work together. eMoney has three:

### Stack 1 — Static stack (serves the dashboard)

Pieces: **CloudFront + S3**

What it does: serves the dashboard HTML, CSS, JavaScript, and any other static assets to the user's browser.

Why it's grouped: S3 holds the files, CloudFront caches and delivers them. They work together to give fast global access to static content. Once configured, you barely touch them — you push new files to S3, invalidate CloudFront's cache, and new code is live.

### Stack 2 — API stack (serves the dashboard's backend)

Pieces: **API Gateway + Lambda**

What it does: handles HTTP requests from the dashboard's JavaScript. When the dashboard wants to "save ticket" or "approve", it POSTs to an API Gateway URL, which invokes a Lambda, which reads/writes RDS and responds.

Why it's grouped: API Gateway is the public entry point; Lambda is the code. API Gateway without Lambda = a switchboard with nothing to route to. Lambda without API Gateway = a function that nothing can call (over HTTP).

### Stack 3 — Worker stack (processes emails)

Pieces: **n8n (on EC2) + RDS**

What it does: every minute, n8n polls the monitored Outlook inbox for new emails. When one arrives, it runs the AI extraction pipeline, then POSTs the result to the API Lambda (which creates the ticket record). n8n also directly reads and writes the `email_queue` table in RDS to track which emails are being processed.

Why it's grouped: n8n is the executor of the pipeline; RDS is where state lives. They go together because n8n constantly reads/writes the queue.

### Why this separation matters

Each stack can:

- Be deployed, scaled, and debugged independently
- Have its own IAM role (tighter permissions)
- Go down without taking the others with it (the worker can fail without breaking the dashboard)

This is the **serverless separation-of-concerns** pattern. Old-style apps jam everything into one big server. Modern AWS apps split at logical boundaries.

---

## 5. What happens when a user clicks "approve ticket" (request flow)

Here's the step-by-step of a single user interaction:

```
Step 1: Browser loads the dashboard
  User types URL → DNS resolves → browser hits CloudFront →
  CloudFront serves cached index.html from S3 → browser renders
  the dashboard

Step 2: Dashboard JS runs in the browser, shows ticket list
  The JavaScript (now running in the user's browser) makes a
  GET call to API Gateway to fetch the tickets.

Step 3: API Gateway routes the call to Lambda
  API Gateway sees "GET /api/tickets" → invokes the Lambda
  function configured for that route → passes the request.

Step 4: Lambda queries RDS
  Lambda opens a connection to RDS Postgres (using credentials
  fetched from Secrets Manager), runs the SELECT, gets the rows.

Step 5: Lambda returns JSON
  Lambda serializes the result to JSON, returns to API Gateway,
  which returns it to the browser.

Step 6: Browser updates the UI
  JavaScript receives the JSON, updates the DOM, user sees
  the ticket list.

Step 7: User clicks "approve ticket"
  Dashboard JS makes a POST /api/approve-ticket call →
  API Gateway → Lambda → Lambda writes to RDS → returns
  success → UI updates.
```

Total time: usually under 300ms if Lambda is warm, ~1-2s if it's cold-starting.

**Key insight**: the user never directly touches Lambda, RDS, or S3 beyond the first HTML load. Everything flows through the two entry points: CloudFront (for static) and API Gateway (for dynamic).

---

## 6. What happens when a salary email arrives (worker flow)

This runs in parallel with user activity, driven by n8n:

```
Step 1: n8n polls Outlook
  Every ~60 seconds, n8n makes a Microsoft Graph API call:
  "Any new emails in the monitored inbox?"

Step 2: New email found → insert into email_queue
  n8n writes a row to RDS: email_queue table, status='pending',
  with the email metadata + attachments.

Step 3: n8n's Worker workflow picks up the pending row
  A separate n8n workflow (the Worker) SELECTs for pending rows,
  claims one (SKIP LOCKED to avoid duplicates), marks it
  'processing'.

Step 4: Worker extracts data via AI
  Worker sends the email body + attachment images to Bedrock
  (Claude Opus 4.7). Bedrock returns structured JSON:
  { company, amount, currency, employees[], ... }.

Step 5: Worker POSTs the result to the Webhook Lambda
  n8n's HTTP Request node calls POST /api/webhook with the
  extracted data. It includes an X-Webhook-Secret header for auth.

Step 6: Webhook Lambda verifies + writes
  Lambda checks the secret → writes the ticket record to RDS
  (across tickets_v2, ticket_emails, ticket_attachments,
  ticket_vision_results tables) → returns 200.

Step 7: Worker marks email_queue row 'completed'
  n8n updates the email_queue row to status='completed'.

Step 8: Optional — send notification email
  n8n sends a "ticket received" email back to the sender.
```

**Key insight**: the Worker uses BOTH direct RDS access (for the email_queue state machine) AND the Webhook Lambda (for creating the ticket record). This isn't redundancy — the queue is n8n's internal workspace; the ticket is the public record that the dashboard shows.

---

## 7. Where everything lives (the data map)

| Thing | Lives in | Read/write by |
|---|---|---|
| Dashboard HTML/JS/CSS | S3 bucket | User browser (via CloudFront) |
| Email attachments (PDFs, images) | S3 bucket | Webhook Lambda writes; dashboard reads via presigned URL |
| Ticket records | RDS (tickets_v2, ticket_emails, etc.) | Lambda + n8n |
| Email queue state | RDS (email_queue) | n8n primarily; Lambda on webhook arrival |
| Activity audit log | RDS (activity_log) | Lambda |
| DB credentials | Secrets Manager | Lambda + n8n (both via IAM) |
| Webhook HMAC secret | Secrets Manager | Lambda (verifies) + n8n (signs) |
| Outlook OAuth tokens | n8n's internal credential store | n8n only |
| Bedrock API access | IAM role | n8n (invokes) + Lambda (if needed later) |
| Lambda code | Deployed from GitHub via GitHub Actions | CI/CD |
| n8n workflow definitions | n8n's internal workflow store | n8n (imported from repo) |

Every piece of data has exactly one home + a clear read/write boundary. When something is wrong, you know where to look.

---

## 8. The handover model — landlord / operator

eMoney's unusual aspect: Wave is taking over HOSTING but NOT OPERATION.

### Traditional handover (what we're NOT doing)

Trustify would give Wave a runbook: "here are the 40 steps to set up AWS, deploy the app, configure n8n, connect Outlook, test end-to-end." Wave runs it themselves.

Problems:
- Wave's team has to learn our stack deeply
- Every future change = we ask Wave to do a 5-step update, they schedule it for next week, we iterate slowly
- Wave owns operational responsibility for an app they didn't build

### The landlord / operator model (what we ARE doing)

Wave provisions the AWS infrastructure (RDS, S3, EC2, IAM roles) — that's their lane. Then Wave gives Trustify direct access (an IAM user or cross-account role with specific permissions). Trustify installs the app, configures n8n, deploys new versions, fixes bugs — all directly on Wave's AWS using the access granted.

Advantages:
- **Data sovereignty**: the data never leaves Wave's AWS account. Wave owns the audit trail, can revoke access any time, handles breach liability.
- **Operational velocity**: Trustify pushes new code → GitHub Actions deploys directly to Wave's Lambda. No coordination delay.
- **Clean boundaries**: Wave's devops team manages infra (their specialty); Trustify's engineers manage the app (our specialty). Nobody has to learn the other side deeply.

This is the pattern for "hosted handover" where the client wants the data residency but doesn't want the operational burden.

---

## 9. Security basics

Four layers of security in eMoney:

### Layer 1 — IAM (identity)

Every AWS call is authenticated as some identity (user or role) and authorized by IAM policy. Example: the Lambda function's execution role has permissions like `rds:Connect, bedrock:InvokeModel, s3:PutObject, secretsmanager:GetSecretValue`. Everything else is denied.

### Layer 2 — Secrets Manager (secrets)

Secrets never live in code. Our Lambda doesn't have `DB_PASSWORD=abc123` hardcoded. Instead: Lambda calls `secretsmanager:GetSecretValue` at runtime → gets the password → uses it. If the password rotates, only Secrets Manager changes; Lambda code doesn't.

### Layer 3 — HTTP auth (between services)

The Webhook Lambda accepts POSTs from n8n. How does it know the POST is actually from n8n (not an attacker)? The `X-Webhook-Secret` header. n8n signs with a shared HMAC secret; Lambda verifies. If the header's missing or wrong → 401 Unauthorized.

### Layer 4 — Network (optional, VPC)

In a hardened setup, Lambda + n8n + RDS all live inside a VPC (virtual private cloud). External access is only through CloudFront and API Gateway — the RDS database has no public IP at all. This is Wave's call for their deployment.

### One gap we currently have

`/api/extract-employees` has NO auth today. Anyone with the URL can call it. We're safe on Vercel via obscurity, but this must be closed when porting to AWS (predictable public URL = public quota burner).

---

## 10. CI/CD — how code gets deployed

When Trustify pushes a code change to GitHub, how does it end up running on Wave's AWS?

```
1. Developer pushes commit to `main` branch on GitHub
2. GitHub Actions workflow triggers (defined in .github/workflows/*.yml)
3. GitHub Actions assumes an AWS OIDC role (short-lived credential)
4. GitHub Actions packages the Lambda function + uploads to S3 + updates Lambda config
5. Lambda is now running the new code on the next invocation
6. For dashboard changes: GitHub Actions syncs new files to S3 bucket,
   issues a CloudFront invalidation to clear the cache
7. Done — user sees new dashboard / API behavior
```

Key concept: **OIDC (OpenID Connect)**. Instead of storing an AWS access key in GitHub (which would be a long-lived secret on a third-party system), GitHub Actions gets a short-lived credential per run. No long-lived keys ever leave Wave's AWS account. Safer.

n8n workflows and schema migrations don't auto-deploy — they're manual. Schema migrations especially: running DDL against prod automatically is a recipe for 3am pages.

---

## 11. Glossary

| Term | Meaning |
|---|---|
| **Serverless** | AWS manages the servers; you just provide code + config. Lambda + API Gateway + S3 are all serverless. |
| **Cold start** | The first Lambda invocation after idle — takes extra time (500ms-2s) to warm up. Subsequent calls are fast. |
| **VPC** | Virtual Private Cloud — a private network inside AWS where your services can talk without exposing to the internet. |
| **IAM role** | A named bundle of permissions that a resource "runs as". Lambdas have execution roles. |
| **CloudWatch** | AWS's logging + metrics service. Every Lambda writes logs here; n8n can too. |
| **SSM Session Manager** | SSH-replacement. Lets you log into an EC2 instance without opening port 22, by authenticating via IAM instead. |
| **ECS (Fargate)** | "Run a Docker container without managing servers." An alternative to EC2 for running n8n. |
| **OIDC** | OpenID Connect — a federation protocol that lets GitHub Actions get short-lived AWS credentials without storing long-lived keys. |
| **HMAC** | Hash-based Message Authentication Code. The technique behind our `X-Webhook-Secret` header — proves the sender knows the shared secret. |
| **CDN** | Content Delivery Network. CloudFront is one. Caches content close to users for speed. |
| **DDL** | Data Definition Language. SQL that changes schema (CREATE TABLE, ALTER TABLE). Different from DML (data changes). |
| **Managed service** | AWS runs the underlying infrastructure; you use the service. RDS is managed Postgres; Lambda is managed compute. |

---

## 12. The five questions Huy asked — and what to learn from each

### Q1: "Lambda or Amplify?"

**Learning**: AWS services live at different altitudes. Lambda is a building block; Amplify is a framework that uses Lambda underneath. Don't offer them as peer choices — they're not.

### Q2: "Dashboard → API Gateway — why?"

**Learning**: Arrows in architecture diagrams are ambiguous. Always clarify: deploy flow (one-time) vs request flow (every click). For user-facing apps, request flows dominate the mental model.

### Q3: "What groups together?"

**Learning**: AWS infra designers think in stacks. A "stack" = services that must work together and can be deployed/scaled as a unit. For eMoney: static stack, API stack, worker stack. RDS is shared across stacks (the shared data layer).

### Q4: "Env vars — all for Lambda?"

**Learning**: Config lives with whoever uses it. Lambda and n8n each have their own runtime; each has its own env vars. Shared secrets (DB creds) go in Secrets Manager once and are fetched by both.

### Q5: "API design pattern / routes?"

**Learning**: API Gateway is a switchboard. It needs a phone book: which URL routes to which Lambda, which methods are accepted, whether auth is required. This is the contract between frontend and backend.

---

## 13. Learn more

- **AWS docs**: https://docs.aws.amazon.com/ — authoritative reference.
- **AWS Free Tier**: https://aws.amazon.com/free/ — let you spin up everything described here for $0/month if you stay under limits.
- **n8n docs**: https://docs.n8n.io/ — workflow tool.
- **Postgres docs**: https://www.postgresql.org/docs/ — the DB we use on RDS.
- **HANDOVER_APP.md** (in this repo) — the actual handover spec for Wave.
- **HANDOVER_INFRA.md** (Huy's, pending) — the AWS provisioning detail.

---

*End of primer. For the specific eMoney handover artifact, see [HANDOVER_APP.md](../HANDOVER_APP.md) at the repo root.*
