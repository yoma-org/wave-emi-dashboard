# eMoney Handover — AWS Infrastructure

**Audience**: Wave infrastructure / DevOps team (AWS provisioning side)
**From**: Huy Nguyen Duc — Trustify Technology (contracted through Zeyalabs)
**Companion doc**: [HANDOVER_APP.md](HANDOVER_APP.md) (DK Nguyen — app stack & pipeline operations)
**Diagram source**: `emoney.drawio.png` (repo root)

---

## Overview

The eMoney system runs on **three independent stacks** inside a single AWS VPC. Each stack can be provisioned, scaled, and debugged independently.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  AWS VPC                                                                 │
│                                                                          │
│  Stack 1 — Dashboard      Stack 2 — n8n Worker        Stack 3 — Events  │
│  ALB → VPC Endpoint       ALB → EC2 (Docker/EFS)      SQS → Lambda      │
│       → S3 bucket              → RDS PostgreSQL        → RDS PostgreSQL  │
│                                                                          │
│  Supporting: IAM roles · Secrets Manager · AWS Bedrock                  │
└─────────────────────────────────────────────────────────────────────────┘
```

**Landlord / operator model**: Wave provisions all infrastructure below. Trustify installs and operates the app layer on top. Wave keeps data sovereignty; Trustify keeps deployment velocity.

---

## Stack 1 — Dashboard (ALB + VPC Endpoint + S3)

**What it does**: serves the static `index.html` dashboard to Finance and E-Money operators.

### Architecture

```
User (browser)
    │  HTTPS 443
    ▼
Application Load Balancer (ALB)
    │  internal routing rule: Host = dashboard domain
    ▼
VPC Endpoint (Gateway type — S3)
    │  private traffic, never leaves AWS backbone
    ▼
S3 Bucket (static website assets)
    └── index.html  (dashboard app, single-file ~5MB)
    └── (any future CSS/JS assets)
```

### AWS resources to provision

| Resource | Type | Notes |
|---|---|---|
| **ALB** | Application Load Balancer — **internal** (`scheme=internal`) | Shared with Stack 2 (n8n UI). Not internet-facing. Reachable only from Wave corporate network / VPN. |
| **ALB Listener** | HTTPS 443 | Requires an ACM certificate for your domain. |
| **ALB Target Group** | (points to VPC Endpoint) | Forward rule: host = `dashboard.<your-domain>` |
| **VPC Endpoint** | Gateway endpoint — `com.amazonaws.<region>.s3` | Allows EC2/Lambda inside VPC to reach S3 without traversing the internet. Also keeps dashboard traffic private. |
| **S3 Bucket** | Standard | Name: e.g., `wave-emoney-dashboard`. Block all public access. Serve via ALB/VPC Endpoint only. |
| **S3 Bucket Policy** | Allow `s3:GetObject` from VPC Endpoint principal only | Ensures no direct public access. |

### How Trustify deploys

1. GitHub Actions pushes `index.html` (and any assets) to the S3 bucket via `s3 sync`.
2. No CloudFront cache invalidation needed — ALB fetches directly from S3 on each request (or you can add CloudFront in front of the ALB later for global latency).

### IAM permissions Trustify needs

```json
{
  "Effect": "Allow",
  "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:ListBucket"],
  "Resource": [
    "arn:aws:s3:::wave-emoney-dashboard",
    "arn:aws:s3:::wave-emoney-dashboard/*"
  ]
}
```

---

## Stack 2 — n8n Worker UI (EC2 + Docker + EFS + RDS)

**What it does**: runs the n8n automation platform (self-hosted). n8n polls Outlook for new salary-disbursement emails, runs AI extraction, and dispatches tickets. Also provides a browser UI for operators to inspect and manage workflows.

### Architecture

```
User (browser — Trustify operator only, not Wave end-users)
    │  HTTPS 443
    ▼
Application Load Balancer (ALB)
    │  listener rule: host = n8n.<your-domain>
    ▼
EC2 Instance — "n8n worker"
    │  (inside Auto Scaling group, min=1 max=1 for now)
    │  runs Docker / docker-compose
    │  n8n container listens on port 5678
    │  EFS mount at /home/ec2-user/n8n-data (config persistence)
    │
    ├──→ Amazon EFS (Elastic File System)
    │        stores n8n config, credentials, workflow definitions
    │        survives EC2 instance replacement
    │
    └──→ Amazon RDS — PostgreSQL (single instance)
             n8n uses this as its internal database
             (workflow execution history, credential store, queue state)
```

### Why EFS

n8n stores its configuration (credentials, workflow state, encryption keys) on disk. If EC2 is replaced (e.g., stopped + restarted with a new instance), data on the instance volume is lost. EFS is a network filesystem that multiple EC2 instances can mount — in practice, it means n8n config survives any instance lifecycle event.

### EC2 setup (what Trustify installs)

The EC2 instance runs n8n via `docker-compose`. The compose file lives in the repo at `infra/docker-compose.n8n.yml` (Trustify will provide).

```yaml
# simplified structure — Trustify provides the full file
version: "3.8"
services:
  n8n:
    image: n8nio/n8n:latest
    ports:
      - "5678:5678"
    environment:
      - DB_TYPE=postgresdb
      - DB_POSTGRESDB_HOST=${RDS_HOST}
      - DB_POSTGRESDB_PORT=5432
      - DB_POSTGRESDB_DATABASE=n8n
      - DB_POSTGRESDB_USER=${RDS_USER}
      - DB_POSTGRESDB_PASSWORD=${RDS_PASSWORD}
      - N8N_ENCRYPTION_KEY=${N8N_ENCRYPTION_KEY}
      - WEBHOOK_URL=https://n8n.<your-domain>/
    volumes:
      - /mnt/efs/n8n-data:/home/node/.n8n   # EFS mount
    restart: unless-stopped
```

Secrets (`RDS_PASSWORD`, `N8N_ENCRYPTION_KEY`) are fetched from **Secrets Manager** at startup via a startup script — they are never hardcoded.

### AWS resources to provision

| Resource | Type | Notes |
|---|---|---|
| **EC2 instance** | `t3.medium` recommended (n8n is memory-hungry) | Amazon Linux 2023 or Ubuntu 22.04. Install Docker + Docker Compose at launch. |
| **Auto Scaling group** | Min=1, Max=1 (single instance) | Ensures EC2 auto-recovers if it fails. Not for horizontal scaling — n8n is stateful. |
| **EFS File System** | Standard | One file system. Mount target in the same AZ as EC2. |
| **EFS Mount Target** | In the EC2 subnet | Security group: allow NFS (2049) from EC2 security group. |
| **ALB Target Group** | HTTP on port 5678 | Health check: `GET /healthz` → 200. |
| **ALB Listener Rule** | host = `n8n.<your-domain>` | Routes to EC2 Target Group. |
| **RDS PostgreSQL** | Single instance (`db.t3.micro` or `db.t3.small`) | PostgreSQL 15+. Database name: `n8n`. Enable automated backups (7-day retention). |
| **Security groups** | EC2 → RDS (5432), ALB → EC2 (5678), EC2 → EFS (2049) | No port 22 open — use SSM Session Manager instead. |

### RDS — single instance notes

This is **not** a Multi-AZ deployment. Single instance is sufficient for the eMoney workload (n8n is the only writer; ticket data lives in a separate database on the same or different RDS instance — see §3.1 below).

Use **IAM database authentication** or store the master password in Secrets Manager. Trustify will create a dedicated `n8n` database user with minimal privileges:

```sql
CREATE DATABASE n8n;
CREATE USER n8n_app WITH PASSWORD '<from-secrets-manager>';
GRANT ALL PRIVILEGES ON DATABASE n8n TO n8n_app;
```

### SSH access (no port 22)

Use **SSM Session Manager** for shell access. No bastion host, no port 22 open. EC2 instance profile must have `AmazonSSMManagedInstanceCore` policy attached.

```bash
# Trustify connects with:
aws ssm start-session --target <instance-id>
```

### IAM permissions Trustify needs (for EC2 instance profile)

```json
{
  "Effect": "Allow",
  "Action": [
    "secretsmanager:GetSecretValue"
  ],
  "Resource": "arn:aws:secretsmanager:<region>:<account>:secret:wave-emoney/*"
},
{
  "Effect": "Allow",
  "Action": [
    "bedrock:InvokeModel",
    "bedrock:InvokeModelWithResponseStream"
  ],
  "Resource": "arn:aws:bedrock:<region>::foundation-model/anthropic.claude-opus-4-7*"
},
{
  "Effect": "Allow",
  "Action": [
    "sqs:SendMessage",
    "sqs:GetQueueUrl"
  ],
  "Resource": "arn:aws:sqs:<region>:<account>:wave-emoney-webhook"
}
```

---

## Stack 3 — Event Bridge (n8n EC2 → SQS → Lambda webhook)

**What it does**: decouples n8n's extraction pipeline from the Lambda that persists tickets to RDS. n8n sends a message to SQS after processing an email; SQS triggers the Lambda; Lambda writes the ticket record.

### Architecture

```
EC2 n8n Worker
    │  AWS SDK SQS SendMessage (IAM-signed, over VPC Endpoint)
    ▼
Amazon SQS — "wave-emoney-webhook" queue
    │  (standard queue, visibility timeout = 300s)
    │  Lambda trigger (batch size = 1)
    ▼
Lambda — webhook handler  (api/webhook.js)
    │  verifies X-Webhook-Secret header
    │  parses ticket JSON from SQS message body
    ▼
Amazon RDS — PostgreSQL (same instance as Stack 2, or separate)
    writes: tickets_v2, ticket_emails, ticket_attachments,
            ticket_vision_results, email_queue (status update),
            activity_log
```

### Why SQS (not direct Lambda invoke)

| Concern | Direct invoke | SQS-buffered |
|---|---|---|
| Lambda cold-start blocks n8n | Yes — n8n waits | No — n8n returns immediately after SendMessage |
| Lambda error loses ticket | Yes | No — message stays in queue, retried 3× |
| n8n timeout risk (15-min Outlook processing) | High if chained | Low — queues are independent |
| Dead-letter visibility | None | DLQ catches failed messages after 3 retries |

### AWS resources to provision

| Resource | Type | Notes |
|---|---|---|
| **SQS Queue** | Standard queue | Name: `wave-emoney-webhook`. Visibility timeout: 300s. Message retention: 4 days. |
| **SQS Dead-Letter Queue** | Standard queue | Name: `wave-emoney-webhook-dlq`. maxReceiveCount: 3. |
| **SQS Redrive policy** | Point main queue at DLQ | After 3 failed Lambda invocations, message lands in DLQ for manual inspection. |
| **Lambda function** | `webhook` | Runtime: Node.js 20.x. Handler: `api/webhook.handler`. Memory: 512 MB. Timeout: 60s. |
| **Lambda event source mapping** | SQS → Lambda | Batch size: 1. Bisect on error: true. |
| **Lambda execution role** | IAM role | See permissions below. |
| **VPC Endpoint — SQS** | Interface endpoint — `com.amazonaws.<region>.sqs` | Allows EC2 to reach SQS without NAT Gateway. |

### Lambda IAM execution role

```json
{
  "Effect": "Allow",
  "Action": [
    "sqs:ReceiveMessage",
    "sqs:DeleteMessage",
    "sqs:GetQueueAttributes"
  ],
  "Resource": "arn:aws:sqs:<region>:<account>:wave-emoney-webhook"
},
{
  "Effect": "Allow",
  "Action": ["secretsmanager:GetSecretValue"],
  "Resource": "arn:aws:secretsmanager:<region>:<account>:secret:wave-emoney/*"
},
{
  "Effect": "Allow",
  "Action": ["rds-db:connect"],
  "Resource": "arn:aws:rds-db:<region>:<account>:dbuser:<rds-resource-id>/lambda_app"
},
{
  "Effect": "Allow",
  "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
  "Resource": "arn:aws:logs:*:*:*"
}
```

### SQS message format (what n8n sends)

```json
{
  "ticket": {
    "company": "Kyaw Trading Co.",
    "type": "SalaryToMA",
    "currency": "MMK",
    "amount_requested": 245600,
    "from_email": "sender@example.com",
    "original_subject": "Salary disbursement April",
    "extracted_employees": [...],
    "email_approvals": [...],
    "attachment_base64": "<optional — omit for large files, use S3 reference instead>"
  },
  "source_email_id": "N8N-1712345678",
  "webhook_secret": "<HMAC-SHA256 of body — verified by Lambda>"
}
```

---

## 3.1 — RDS: one instance or two?

Both Stack 2 (n8n internal DB) and Stack 3 (ticket data) need PostgreSQL. You have two options:

| Option | Setup | Trade-off |
|---|---|---|
| **Single RDS instance, two databases** | One `db.t3.small`. Database `n8n` for Stack 2. Database `emi` for Stack 3. | Simpler, cheaper. Both stacks go down together if RDS fails. |
| **Two RDS instances** | One `db.t3.micro` for n8n. One `db.t3.small` for emi (more data). | Isolated failure domains. Higher cost (+$15–30/mo). |

**Recommendation for initial deployment**: single instance with two databases. Migrate to two instances if Wave wants stronger isolation post-stabilization.

---

## 4 — Supporting services

### IAM

Every stack has its own IAM role with least-privilege permissions:

| Role name (suggested) | Attached to | Key permissions |
|---|---|---|
| `wave-emoney-ec2-role` | EC2 instance profile (Stack 2) | Bedrock invoke, SQS SendMessage, Secrets Manager read, SSM Session Manager |
| `wave-emoney-lambda-role` | Lambda execution role (Stack 3) | SQS consume, RDS connect, Secrets Manager read, CloudWatch logs |
| `wave-emoney-cicd-role` | GitHub Actions OIDC | S3 sync (dashboard bucket), Lambda update-function-code |
| `wave-emoney-trustify-ops` | Trustify operator access | SSM Session Manager on EC2, CloudWatch logs read, RDS describe |

### Secrets Manager

Store all runtime secrets here. Suggested secret names:

| Secret name | Contents | Read by |
|---|---|---|
| `wave-emoney/rds-credentials` | `{ "host": "...", "port": 5432, "username": "...", "password": "..." }` | EC2 startup script, Lambda |
| `wave-emoney/n8n-config` | `{ "encryption_key": "...", "webhook_url": "..." }` | EC2 startup script |
| `wave-emoney/webhook-secret` | `{ "hmac_secret": "..." }` | n8n (signs), Lambda (verifies) |
| `wave-emoney/bedrock-config` | `{ "model_id": "anthropic.claude-opus-4-7", "region": "..." }` | EC2 n8n Worker |
| `wave-emoney/outlook-credentials` | OAuth tokens for monitored mailbox | n8n credential store (managed via n8n UI — not stored in Secrets Manager directly) |

### AWS Bedrock

n8n calls Bedrock from EC2 (Stack 2) to extract structured data from email attachments.

- **Model**: `anthropic.claude-opus-4-7` (Claude Opus 4.7)
- **Region**: must match EC2 region (Bedrock is regional)
- **Access**: Wave must request Bedrock model access for the Claude Opus 4.7 model in the AWS console (Bedrock → Model access → Enable). This is a one-time manual step.
- **VPC Endpoint** (optional but recommended): `com.amazonaws.<region>.bedrock-runtime` — keeps Bedrock traffic inside the VPC.

---

## 5 — Network summary (security groups)

### Access model — internal only

**ALB type: internal** (not internet-facing). The dashboard and n8n UI are operator tools — only Wave internal staff and Trustify engineers need access. No public exposure.

Users reach the ALB via one of these options (Wave decides):

| Option | How | When to use |
|---|---|---|
| **Corporate network / office CIDR** | ALB SG allows 443 from Wave office IP range(s) | All operators work from office |
| **AWS Client VPN** | VPN endpoint in the VPC; users connect VPN first | Mix of office + remote operators |
| **Site-to-site VPN** | Wave on-prem network peered to VPC | Wave already has on-prem infra |

**Wave must specify their access method before ALB is provisioned** — this determines subnets and security group rules.

### Security group rules

```
Wave corporate network / VPN
    │ 443 (HTTPS) — restricted to Wave IP range or VPN CIDR only
    ▼
[ALB] — internal, scheme=internal
    Security group:
      inbound:  443 from <Wave-CIDR or VPN-client-CIDR>  ← NOT 0.0.0.0/0
      outbound: 5678 to EC2 security group (n8n UI)
                (S3 traffic goes via VPC Endpoint, not through ALB targets)
    │
    ├─ rule: host = dashboard.<domain> → S3 via VPC Endpoint
    └─ rule: host = n8n.<domain>       → EC2 port 5678

[EC2 n8n] — private subnet, no public IP
    Security group:
      inbound:  5678 from ALB security group only
      outbound: 5432 to RDS security group
                2049 to EFS security group
                443  to SQS VPC Endpoint
                443  to Bedrock VPC Endpoint
                443  to Secrets Manager VPC Endpoint
                443  to S3 VPC Endpoint

[RDS] — private subnet, no public IP
    Security group:
      inbound:  5432 from EC2 security group
                5432 from Lambda security group (if Lambda in VPC)

[EFS] — private subnet
    Security group:
      inbound:  2049 (NFS) from EC2 security group only

[Lambda] — (no inbound — triggered by SQS)
    Security group (if Lambda in VPC):
      outbound: 5432 to RDS security group
                443  to Secrets Manager VPC Endpoint
```

No port 22 anywhere. No public IP on EC2, RDS, or EFS. ALB is internal — not reachable from the public internet.

---

## 6 — Checklist for Wave to provision

### VPC & Networking
- [ ] VPC with at least 2 private subnets (different AZs for RDS Multi-AZ if needed later)
- [ ] **No public subnet needed** — ALB is internal-only
- [ ] Confirm access method with Wave: corporate CIDR / Client VPN / Site-to-site VPN
- [ ] Route tables configured (private subnets route via VPC Endpoints, not IGW)

### VPC Endpoints (keeps traffic private, avoids NAT Gateway costs)
- [ ] S3 Gateway endpoint
- [ ] SQS Interface endpoint
- [ ] Secrets Manager Interface endpoint
- [ ] Bedrock Runtime Interface endpoint (optional but recommended)
- [ ] SSM Interface endpoints (3 needed: `ssm`, `ssmmessages`, `ec2messages`)

### Stack 1 — Dashboard
- [ ] S3 bucket created, public access blocked, bucket policy restricts to VPC Endpoint
- [ ] ACM certificate issued for `dashboard.<your-domain>`
- [ ] ALB created with HTTPS listener
- [ ] ALB listener rule: host = `dashboard.<your-domain>` → forward to S3 (via VPC Endpoint)

### Stack 2 — n8n EC2
- [ ] EFS file system created, mount target in EC2 subnet
- [ ] RDS PostgreSQL single instance created, `n8n` and `emi` databases created
- [ ] EC2 instance launched (Amazon Linux 2023, `t3.medium`)
  - [ ] EC2 instance profile with `wave-emoney-ec2-role`
  - [ ] `AmazonSSMManagedInstanceCore` policy on instance profile
  - [ ] EFS mounted at `/mnt/efs/n8n-data` (via `/etc/fstab`)
  - [ ] Docker + Docker Compose installed
- [ ] Auto Scaling group wrapping EC2 (min=1, max=1, health check type=EC2)
- [ ] ALB target group: HTTP 5678, health check `GET /healthz`
- [ ] ALB listener rule: host = `n8n.<your-domain>` → EC2 target group
- [ ] ACM certificate for `n8n.<your-domain>`

### Stack 3 — SQS + Lambda
- [ ] SQS standard queue `wave-emoney-webhook` (visibility 300s)
- [ ] SQS DLQ `wave-emoney-webhook-dlq` with redrive policy (maxReceiveCount=3)
- [ ] Lambda function `wave-emoney-webhook` created (Node.js 20.x, 512 MB, 60s timeout)
- [ ] Lambda event source mapping: SQS → Lambda (batch size 1)
- [ ] Lambda execution role `wave-emoney-lambda-role` with permissions above

### IAM & Secrets
- [ ] All roles created (see §4 IAM table)
- [ ] OIDC provider for GitHub Actions added to the AWS account
- [ ] GitHub Actions role `wave-emoney-cicd-role` with trust policy for the Trustify repo
- [ ] All secrets created in Secrets Manager (see §4 Secrets Manager table)
- [ ] Bedrock model access enabled for `anthropic.claude-opus-4-7`

### Handoff to Trustify
- [ ] Share RDS endpoint + master credentials → Trustify rotates after first login
- [ ] Share n8n URL (`https://n8n.<your-domain>`) + initial admin password
- [ ] Share S3 bucket names (dashboard + attachments if separate)
- [ ] Share SQS queue URLs
- [ ] Share Secrets Manager secret ARNs (so Trustify can reference by ARN in code)
- [ ] Confirm GitHub repo (yoma-org/wave-emi-dashboard) added to OIDC trust policy

---

## 7 — Cost estimate (ap-southeast-1, monthly)

| Resource | Size | Est. cost/mo |
|---|---|---|
| ALB | 1 ALB, low traffic | ~$18 |
| EC2 (n8n) | `t3.medium`, on-demand | ~$30 |
| EFS | <5 GB (n8n config) | ~$2 |
| RDS PostgreSQL | `db.t3.small`, single-AZ | ~$28 |
| SQS | <1M messages | ~$0 (free tier) |
| Lambda | <1M invocations | ~$0 (free tier) |
| Secrets Manager | 5 secrets | ~$2.50 |
| VPC Endpoints (interface) | 4 endpoints × $7.50 | ~$30 |
| S3 (dashboard assets + attachments) | <10 GB | ~$2 |
| Bedrock (Claude Opus 4.7) | Usage-based | ~$20–100 depending on email volume |
| **Total (excluding Bedrock)** | | **~$112/mo** |

Reduce cost: use `t3.small` for EC2 if n8n workload is light (single Outlook mailbox, <100 emails/day). Swap on-demand EC2 to Reserved Instance (1-year) for ~40% savings after stabilization.

---

*For app stack configuration (n8n workflow import, schema migrations, Lambda deployment), see [HANDOVER_APP.md](HANDOVER_APP.md).*
