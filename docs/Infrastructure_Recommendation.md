# Infrastructure Recommendation — Wave EMI Dashboard

**Prepared by:** DK Nguyen (Data Engineer, Trustify Technology)
**Date:** April 9, 2026
**Context:** Rita's directive (Apr 8): "Figure out the infrastructure first, then we go with any LLM."
**Scope:** PCI-compliant hosting for production EMI salary disbursement system (Myanmar)

---

## Executive Summary

| Platform | Recommendation | Key Reason |
|----------|---------------|------------|
| **AWS** | **Primary — Recommended** | Yoma Bank already on AWS. PCI-DSS L1. Rita prefers. Huy specializes. |
| **GCP** | Strong alternative for AI layer | Gemini 2.5 Flash proven for Myanmar OCR. Trustify's data team runs on GCP. |
| **Azure** | Viable but no advantage | PCI-compliant. No Myanmar OCR proof. No team familiarity. |
| **Alibaba** | Not recommended | Geopolitical risk for UK entity. No Myanmar financial customers. |

**Recommended approach:** AWS for infrastructure (hosting, DB, security) + call Gemini externally for Myanmar OCR if Bedrock models can't match accuracy. Tracy confirmed: "even if AWS doesn't support Gemini, we can still call Gemini externally."

---

## 1. Why This Decision Matters

Our current system runs on:
- **Vercel** (free tier) — NOT PCI-compliant, Rita explicitly flagged this
- **n8n Cloud** — managed automation, no data residency control
- **Groq + Gemini consumer APIs** — free tier, no enterprise SLA, no audit logs
- **localStorage** — no database, no persistence

For production with real Myanmar employee data (MSISDNs, salaries, bank accounts), we need:
- PCI-DSS Level 1 certified infrastructure
- Data residency in APAC (Singapore closest to Myanmar)
- Enterprise AI with audit logging
- Persistent database (PostgreSQL)
- VPC network isolation

---

## 2. Platform Comparison

### 2.1 AWS (Amazon Web Services)

**Why AWS leads:**
- **Yoma Bank (Wave Money's parent) is migrating to AWS** via Renova Cloud (confirmed)
- AWS has a dedicated [Myanmar Financial Services Compliance Center](https://aws.amazon.com/financial-services/security-compliance/compliance-center/mm/)
- Rita prefers AWS (Tracy: "Rita only knows AWS, so she prefers it")
- Huy specializes in AWS infrastructure
- "We run on the same cloud as your bank" kills compliance objections

**AWS Bedrock — AI Models Available (Singapore region):**

| Model | Input/MTok | Output/MTok | Vision | PDF Native | Best For |
|-------|-----------|------------|--------|-----------|----------|
| Claude Haiku 4.5 | $1.00 | $5.00 | Yes | Yes | Email text extraction (cheap, fast) |
| Claude Sonnet 4.6 | $3.00 | $15.00 | Yes | Yes | Vision OCR, bank slips, handwriting |
| Claude Opus 4.6 | $5.00 | $25.00 | Yes | Yes | Complex analysis (overkill for OCR) |
| Nova Pro | $0.80 | $3.20 | Yes | Via image | Budget vision + text |
| Nova Lite | $0.06 | $0.24 | Yes | Via image | Ultra-budget simple extraction |
| Llama 3.2 (90B) | $2.00 | $2.00 | Yes | No | Open-source alternative |
| DeepSeek V3.2 | $0.62 | $1.85 | No | No | Text-only tasks |

**15+ providers, 30+ models on Bedrock.** No Gemini (Google's model) — this is the main limitation.

**AWS Infrastructure Services:**

| Service | Purpose | Monthly Cost (our scale) |
|---------|---------|------------------------|
| ECS Fargate (0.5 vCPU, 1GB) | NextJS app hosting | ~$22 |
| RDS PostgreSQL (db.t4g.small) | Database (2 vCPU, 2GB, 10GB SSD) | ~$33 |
| S3 Standard (5GB) | File storage (PDFs, CSVs, images) | ~$0.15 |
| SES (500 emails/mo) | Email sending | ~$0.50 |
| Bedrock AI (1,500 calls/mo) | Text + Vision extraction | $5-25 |
| WAF (1 ACL + 5 rules) | Web application firewall | ~$10 |
| KMS (2 keys) | Encryption | ~$2 |
| ACM | SSL certificates | Free |
| Shield Standard | DDoS protection | Free |
| **Total** | | **$75-95/month** |

**AWS Compliance:**
- PCI-DSS Level 1 Service Provider (assessed twice yearly)
- SOC 1/2/3 — 185 services in scope (Bedrock, ECS, RDS, S3 all covered)
- Singapore region (ap-southeast-1): 3 availability zones, full service availability
- No Myanmar data residency laws — Singapore is the standard choice

**AWS Myanmar OCR Limitation:**
- Amazon Textract: Does NOT support Myanmar/Burmese (English-only for handwriting)
- Amazon Comprehend: No Myanmar support
- Amazon Rekognition: Latin scripts only
- **LLM vision is the only option** — Claude Sonnet 4.6 on Bedrock, or call Gemini externally
- Myanmar OCR accuracy on Bedrock Claude: **NOT YET TESTED** (vs Gemini 2.5 Flash: proven 100% name transliteration)

---

### 2.2 GCP (Google Cloud Platform)

**Why GCP is the strongest AI option:**
- **Gemini 2.5 Flash proven on Myanmar handwriting** — Win's test: 100% name transliteration, 100% amounts
- Trustify's data team already runs on GCP (BigQuery, Pub/Sub, Airflow)
- Native PDF support in Gemini (no conversion needed)
- Migration from consumer Gemini API to Vertex AI = config change only (same SDK)

**Vertex AI — Gemini Models:**

| Model | Input/MTok | Output/MTok | Vision | PDF Native |
|-------|-----------|------------|--------|-----------|
| Gemini 2.5 Flash | $0.30 | $2.50 | Yes | Yes |
| Gemini 2.5 Flash Lite | $0.10 | $0.40 | Yes | Yes |
| Gemini 2.5 Pro | $1.25 | $10.00 | Yes | Yes |

**Gemini 2.5 Flash is 3-10x cheaper than Claude Sonnet for equivalent tasks.**

**Vertex AI vs Consumer Gemini API:**

| Feature | Consumer API (current) | Vertex AI (enterprise) |
|---------|----------------------|----------------------|
| Auth | API key | IAM service accounts |
| SLA | None | Enterprise SLA |
| Data residency | No control | Choose region (Singapore) |
| Compliance | Consumer-grade | PCI-DSS, SOC 1/2/3, ISO 27001 |
| Logging | None | Cloud Audit Logs |
| Migration effort | — | Config change only (same SDK) |

**GCP Infrastructure:**

| Service | Purpose | Monthly Cost |
|---------|---------|-------------|
| Cloud Run | NextJS hosting | ~$5-15 (generous free tier) |
| Cloud SQL PostgreSQL | Database | ~$30-50 |
| Cloud Storage | File storage | ~$1-3 |
| Vertex AI (Gemini 2.5 Flash) | AI processing | ~$5-15 |
| **Total** | | **$45-85/month** |

**GCP Compliance:**
- PCI-DSS Level 1 Service Provider
- Singapore region (asia-southeast1): 3 zones, full service availability
- VPC Service Controls for data isolation

**GCP Limitation:**
- No specific Myanmar financial services positioning (AWS has dedicated Myanmar compliance page)
- Wave Money / Yoma Bank ecosystem is AWS-oriented, not GCP

---

### 2.3 Azure (Microsoft)

**Azure Strengths:**
- Yoma Bank uses Azure alongside AWS (confirmed — Azure DDoS Protection, some workloads)
- PCI-DSS Level 1 certified
- Azure OpenAI Service for GPT-4o models
- Singapore data center available

**Azure OpenAI Models:**

| Model | Input/MTok | Output/MTok | Vision | PDF Native |
|-------|-----------|------------|--------|-----------|
| GPT-4o (Global) | $2.50 | $10.00 | Yes | No |
| GPT-4o-mini (Global) | $0.15 | $0.60 | Yes | No |
| GPT-4.1 | ~$2.00 | ~$8.00 | Yes | No |

**Azure Infrastructure:**

| Service | Purpose | Monthly Cost |
|---------|---------|-------------|
| App Service (B1) | NextJS hosting | ~$13-55 |
| Azure DB PostgreSQL (Burstable B1ms) | Database | ~$15-25 |
| Blob Storage | File storage | ~$1-2 |
| Azure OpenAI (GPT-4o-mini) | AI processing | ~$3-10 |
| **Total** | | **$35-95/month** |

**Azure Limitations:**
- **Myanmar handwriting OCR: NOT PROVEN.** Azure AI Document Intelligence does not list Myanmar/Burmese as supported
- Does not natively support Gemini — would need external API call (defeating single-cloud compliance)
- No team familiarity at Trustify
- 15-40% cost overhead when factoring support plans + network

---

### 2.4 Alibaba Cloud

**Alibaba Strengths:**
- 20-30% cheaper than AWS for comparable compute in APAC
- PCI-DSS Level 1 certified
- Singapore region with good APAC coverage (9 APAC regions)
- Qwen-OCR dedicated document OCR model

**Alibaba Infrastructure:**

| Service | Purpose | Monthly Cost |
|---------|---------|-------------|
| ECS (2 vCPU, 4GB) | NextJS hosting | ~$20-35 |
| ApsaraDB PostgreSQL | Database | ~$35-60 |
| OSS | File storage | ~$1-2 |
| Model Studio (Qwen) | AI processing | ~$5-20 |
| **Total** | | **$65-130/month** |

**Alibaba — NOT RECOMMENDED. Critical risks:**

1. **Geopolitical:** US national security probe into Alibaba Cloud. Trustify is UK-incorporated (UK National Security and Investment Act applies). A UK fintech routing Myanmar financial data through Chinese-owned infrastructure is indefensible to compliance teams.

2. **No Myanmar financial customers:** AWS has Yoma Bank. Alibaba has zero confirmed Myanmar bank customers.

3. **Myanmar OCR unproven:** Qwen-OCR lists 32 languages — Myanmar NOT confirmed in supported list.

4. **Alibaba cancelled cloud spinoff (2023)** citing US chip sanctions — strategic direction uncertain.

5. **Narrative overhead:** Every conversation with Wave Money compliance requires explaining "why Chinese cloud?" AWS requires no such defense.

---

## 3. Head-to-Head Comparison

### 3.1 Myanmar Handwriting OCR (The Deciding Factor)

| Platform | Myanmar OCR Capability | Evidence |
|----------|----------------------|----------|
| **GCP (Gemini 2.5 Flash)** | **PROVEN** — 100% name transliteration | Win's handwriting test, TKT-014, Apr 8 |
| **AWS (Claude Sonnet on Bedrock)** | Likely capable, **NOT YET TESTED** | Claude is multilingual, but no Myanmar-specific test |
| **AWS (Nova Pro)** | Unknown for Myanmar | No test data |
| **Azure (GPT-4o)** | Weak — Myanmar not in supported languages | Azure Document Intelligence skips Burmese |
| **Alibaba (Qwen-OCR)** | Unknown — Myanmar not in 32 supported languages | No evidence |

**Action needed:** Test Claude Sonnet 4.6 on Bedrock with Win's handwriting sample. If Claude matches Gemini's 100% accuracy, AWS-only is viable. If not, hybrid approach (AWS infra + Gemini API for OCR).

### 3.2 Migration Effort from Current System

| Component | To AWS | To GCP | To Azure |
|-----------|--------|--------|----------|
| NextJS app (Vercel → hosting) | ECS Fargate — containerize | Cloud Run — containerize | App Service — straightforward |
| Database (localStorage → PostgreSQL) | RDS — standard setup | Cloud SQL — standard setup | Azure DB — standard setup |
| AI pipeline (Groq+Gemini → enterprise) | **Rewrite prompts** for Claude/Nova | **Config change only** (same Gemini SDK) | **Rewrite prompts** for GPT-4o |
| n8n (Cloud → self-hosted) | Docker on EC2/ECS | Docker on Compute Engine | Docker on VM |
| Estimated effort | 2-3 days | **1 day** | 2-3 days |

**GCP has the simplest migration** because we already use Gemini. AWS requires rewriting AI prompts but is otherwise standard.

### 3.3 Cost Comparison (500 emails/month)

| Component | AWS | GCP | Azure | Alibaba |
|-----------|-----|-----|-------|---------|
| App hosting | $22 | $5-15 | $13-55 | $20-35 |
| PostgreSQL | $33 | $30-50 | $15-25 | $35-60 |
| File storage | $0.15 | $1-3 | $1-2 | $1-2 |
| AI calls | $5-25 | $5-15 | $3-10 | $5-20 |
| Security (WAF, KMS) | $12 | $5-10 | $5-10 | $5-10 |
| **Monthly total** | **$75-95** | **$45-85** | **$35-95** | **$65-130** |
| **Annual total** | **$900-1,140** | **$540-1,020** | **$420-1,140** | **$780-1,560** |

**GCP is cheapest.** AWS is ~$30-40/month more. At this scale ($30-40/mo difference), cost is NOT the deciding factor.

### 3.4 Compliance & Client Alignment

| Factor | AWS | GCP | Azure | Alibaba |
|--------|-----|-----|-------|---------|
| PCI-DSS Level 1 | Yes | Yes | Yes | Yes |
| SOC 2 Type II | Yes (185 services) | Yes | Yes | Yes |
| Myanmar compliance page | **Yes (dedicated)** | No | No | No |
| Yoma Bank uses it | **Yes (confirmed)** | No evidence | Yes (partial) | No |
| Wave Money alignment | **Strong** (Amdocs likely on AWS) | Neutral | Partial | Negative |
| Rita's preference | **Preferred** | Neutral | Neutral | Risk |
| Trustify team familiarity | Huy (infra specialist) | **Data team (DK, Tin)** | None | None |

---

## 4. Recommended Architecture

### Option A: AWS-Only (Simplest, Rita's Preference)

```
Client Email → AWS SES / Outlook
                    ↓
         n8n (self-hosted on ECS)
                    ↓
         Bedrock Claude Sonnet 4.6
         (text extract + vision OCR)
                    ↓
         NextJS App (ECS Fargate)
         + RDS PostgreSQL
         + S3 File Storage
                    ↓
         Dashboard (CloudFront CDN)
```

**Cost:** ~$75-95/month
**Pros:** Single cloud, simple compliance story, Rita approved
**Cons:** Myanmar OCR unproven on Claude (needs testing), higher AI cost than Gemini
**Risk mitigation:** Test Claude on Win's handwriting sample before committing

### Option B: AWS + Gemini Hybrid (Best Myanmar OCR)

```
Client Email → AWS SES / Outlook
                    ↓
         n8n (self-hosted on ECS)
                    ↓
     ┌──────────────┴──────────────┐
     ↓                              ↓
  Bedrock Claude Haiku          Vertex AI Gemini 2.5 Flash
  (email text extraction)       (vision OCR — Myanmar proven)
     └──────────────┬──────────────┘
                    ↓
         NextJS App (ECS Fargate)
         + RDS PostgreSQL + S3
                    ↓
         Dashboard (CloudFront CDN)
```

**Cost:** ~$80-100/month (small Vertex AI addition)
**Pros:** Proven Myanmar OCR, cheap Gemini pricing, AWS for everything else
**Cons:** Two cloud providers = more complexity, dual compliance story
**Tracy's validation:** "Even if AWS doesn't support Gemini, we can still call Gemini externally"

---

## 5. Recommended Next Steps

| Step | Action | Owner | When |
|------|--------|-------|------|
| 1 | **Test Claude Sonnet 4.6 on Win's handwriting** | DK | When Bedrock access available |
| 2 | **Huy sets up AWS account** (Singapore region, VPC, basic security) | Huy | This week |
| 3 | **Decide Option A vs B** based on Claude OCR test results | Team + Rita | After Step 1 |
| 4 | **Migrate NextJS to ECS Fargate** | DK + Dong | Week 3 (after Dong joins) |
| 5 | **Set up RDS PostgreSQL** | DK | Week 3 |
| 6 | **Self-host n8n on AWS** | DK/Huy | Week 3-4 |
| 7 | **Migrate AI pipeline to Bedrock** (or hybrid) | DK | Week 4 |
| 8 | **Decommission Vercel + n8n Cloud** | DK | After migration verified |

**Critical dependency:** Infrastructure (Steps 1-3) must be decided before backend + database work (KAN-26). As DK told Tracy: "Có infras mới làm được backend với database."

---

## 6. Sources

### AWS
- [AWS Bedrock Pricing](https://aws.amazon.com/bedrock/pricing/)
- [AWS Myanmar Financial Compliance Center](https://aws.amazon.com/financial-services/security-compliance/compliance-center/mm/)
- [PCI DSS v4.0 on AWS Whitepaper](https://d1.awsstatic.com/whitepapers/compliance/pci-dss-compliance-on-aws-v4-102023.pdf)
- [Bedrock Models by Region](https://docs.aws.amazon.com/bedrock/latest/userguide/models-regions.html)
- [Yoma Bank → AWS Migration (Renova Cloud)](https://renovacloud.com/success-stories/yoma-transformation-to-aws-cloud/?lang=en)

### GCP
- [Vertex AI Pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing)
- [Gemini Developer API vs Vertex AI](https://ai.google.dev/gemini-api/docs/migrate-to-cloud)
- [PCI DSS Compliance on GCP](https://cloud.google.com/architecture/pci-dss-compliance-in-gcp)
- [Cloud Run NextJS Quickstart](https://docs.cloud.google.com/run/docs/quickstarts/frameworks/deploy-nextjs-service)

### Azure
- [Azure OpenAI Pricing](https://azure.microsoft.com/en-us/pricing/details/azure-openai/)
- [Azure PCI DSS Compliance](https://learn.microsoft.com/en-us/azure/compliance/offerings/offering-pci-dss)
- [Azure Document Intelligence Language Support](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/language-support/ocr)

### Alibaba
- [Alibaba Cloud PCI-DSS](https://www.alibabacloud.com/en/trust-center/pci-dss)
- [US National Security Probe into Alibaba Cloud](https://www.datacenterdynamics.com/en/news/report-us-opens-national-security-probe-into-alibaba-cloud/)

### Context
- [Wave Money + Amdocs](https://www.fintechfutures.com/digital-wealth-management/myanmar-s-wave-money-taps-amdocs-for-digital-financial-services-platform/)
- [Vietnam Cloud Market ($3.5B, 13.7% CAGR)](https://www.psmarketresearch.com/market-analysis/vietnam-cloud-computing-market-report)
- [n8n Self-Hosting Guide](https://northflank.com/blog/how-to-self-host-n8n-setup-architecture-and-pricing-guide)
