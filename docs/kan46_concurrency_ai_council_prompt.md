# AI Council Round 4 — n8n Pipeline Concurrency & Performance

**Paste this entire block to each AI (Claude, GPT-5, Gemini 3, Grok, DeepSeek, and optionally Qwen/Perplexity).**

**Purpose:** Get 5-6 independent perspectives on how to solve a concurrency problem in n8n Cloud with real constraints, realistic budget, and a live demo in 3 days. We've been stuck in analysis paralysis and need out-of-the-box thinking.

---

# AI Council Round 4 Prompt

You are a senior platform engineer advising on a pipeline-concurrency problem for Wave Money's EMI (Electronic Money Issuer) salary disbursement automation in Myanmar. We've used you 3 times before for this project (v12 architecture, CSV/XLSX parsing, pure JS DEFLATE) and value your out-of-the-box thinking — not just standard answers.

---

## THE PROJECT (quick recap)

- **Wave Money EMI Pipeline** — automates processing of salary disbursement emails from Myanmar corporate clients
- **Stack:** n8n Cloud (trial plan) + Supabase (Pro) + Vercel (Pro) + Gemini 3 Flash API + Microsoft Outlook mailbox (`emoney@zeyalabs.ai`)
- **Pipeline v12.4 live** — handles images, PDFs, XLSX (pure JS parse), CSV, body-only emails, rejects ZIP/password-protected
- **Team:** DK (solo builder with AI tools) + Minh (CTO/co-founder, Netherlands background) + Vinh (PM) + Rita (product)
- **Live demo:** Monday Apr 20, 2026 (3 days from now)
- **Status:** feature-complete; this is the final hardening task before demo

---

## THE CURRENT PROBLEM (KAN-46)

**Observation (DK's lived experience over past 2 weeks):** When multiple payroll emails fire to the controlled mailbox rapidly (>1 email within ~30 seconds), the n8n pipeline often completes only 1 email successfully. Others are half-done, return no notification email, or fail silently. No error surface — just missing tickets.

**Root cause we've identified:**
- Outlook Trigger polls **every 1 minute** (current setting)
- Pipeline execution per email takes 30-120 seconds (varies: simple body-only ~20 sec, XLSX+Gemini vision ~90-120 sec)
- Therefore: **poll 2 fires while poll 1 is still executing → parallel executions of the same workflow**
- Both parallel executions hit:
  - Gemini API concurrently (rate limit 429 errors possible)
  - Same Supabase webhook concurrently (race conditions)
  - n8n Cloud container CPU/memory pressure (pure JS XLSX inflate is CPU-heavy)
  - Shared `$getWorkflowStaticData` state (non-atomic reads/writes)

**Stakeholder requirements:**
- **Minh:** Even if 25 clients fire emails simultaneously, the pipeline MUST handle all of them successfully. Outlook acts as a queue natively; n8n should preserve that guarantee.
- **Vinh (PM):** Process one by one, first come first serve. "Reduce risk of killing our pipeline due to too many requests being processed."
- **Rita:** Pragmatic allowance — OK to reject if single email has >5 attachments (becomes a separate ticket KAN-47) OR if >25 emails fire simultaneously. Reduces system stress acceptably.
- **DK:** Agrees with Minh on robustness, but acknowledges Rita's rejection rule as pragmatic defense. Must work for Monday demo.

---

## CONFIRMED CONSTRAINTS (what we CANNOT do)

We've investigated these already. Do NOT recommend any of these — they don't work:

1. **`require('zlib')`, `DecompressionStream`, `node:zlib`** — all blocked in n8n Cloud Task Runner sandbox (empirically tested)
2. **Any `require()` of npm packages** — blocked
3. **n8n Workflow Settings UI** — there is NO "Execute only one instance at a time" toggle visible on our n8n Cloud trial plan (we have screenshots)
4. **Outlook Trigger UI** — there is NO "Limit" or "Max emails per poll" field exposed on the current trigger node (we have screenshots)
5. **n8n Enterprise "Queue Mode"** — not available on Cloud trial
6. **Self-hosting** — out of scope; we must stay on n8n Cloud for demo
7. **External queue (SQS, Redis, RabbitMQ)** — out of budget for 3-day timeline; Trustify is a startup, no extra infra spend before demo

## WHAT WE CAN DO (available tools)

- Modify n8n workflow JSON directly and re-import
- Add Code nodes with custom JavaScript (sandboxed — Buffer, Uint8Array, TextDecoder, `helpers.httpRequest()`, `$getWorkflowStaticData()` available)
- Use Supabase PostgreSQL as a coordination mechanism (row locks, advisory locks, etc.)
- Use Vercel serverless functions (already running `api/webhook.js`)
- Change Outlook Trigger poll interval (options: Every Minute / Every 5 Minutes / Every Hour / custom cron)
- Use Microsoft Graph API directly (if native n8n Outlook node is too limiting)
- Add Wait nodes, IF nodes, Merge nodes
- Use Webhooks (n8n has a Webhook Trigger node we already use for manual testing)

---

## WHAT WE'VE TRIED / RULED OUT

1. **n8n UI concurrency toggle** — doesn't exist on our plan
2. **JSON `maxExecutionConcurrency` setting** — n8n likely strips unknown workflow settings; unverified but not documented for Cloud
3. **StaticData lock with skip-on-busy** — RULED OUT because Outlook Trigger marks emails as consumed when trigger fires. Skipping via lock = permanent email loss. Bad.
4. **Increasing poll interval to 5 min** — solves concurrency but hurts demo UX (5 min wait in front of stakeholders is painful)
5. **Run the existing pipeline synchronously** — Code nodes already run sequentially within ONE execution; the issue is BETWEEN executions.

---

## THE SHAPE OF A GOOD ANSWER

We want 1-2 of these perspectives, not all:

1. **A specific workable pattern** — concrete steps we can implement on n8n Cloud in 3 days
2. **Critique of our current thinking** — what's our blind spot? Are we solving the right problem?
3. **Out-of-the-box solutions** — creative approaches using Supabase, Vercel, Microsoft Graph API, or other tools we have
4. **Trade-off analysis** — which path has lowest risk for Monday demo vs which is most correct long-term

We value: creativity, specificity, and honesty about trade-offs. Vague "consider X, Y, Z" answers aren't useful — commit to a recommendation.

---

## QUESTIONS — answer the ones you have strongest opinion on

### Q1: FOR MONDAY DEMO (primary)

Given the constraints (3 days, n8n Cloud trial, no new infra, must demo live), what's your CONCRETE recommended architecture for handling 1-25 concurrent incoming emails without:
- Losing any email
- Creating duplicate tickets
- Making demo UX painful (>2 min detection latency)
- Crashing on parallel Gemini calls

Rank your approach against: reliability, demo UX, code complexity, risk of breaking v12.4 features.

### Q2: MAKE PIPELINE PARALLEL-SAFE vs PREVENT PARALLEL?

Philosophical-architectural question. Two approaches:
- **Approach A:** Force sequential execution (mutex/lock/queue). Serialize everything.
- **Approach B:** Accept parallel executions. Make each execution idempotent and safe to race (e.g., `ON CONFLICT DO NOTHING` on message_id, retry with backoff on 429, memory-isolated variables).

Which is more appropriate for this specific stack (n8n Cloud + Supabase + Gemini)? Why?

### Q3: OUT-OF-THE-BOX SOLUTIONS

What's a creative use of our existing tools (Supabase, Vercel, Microsoft Graph) that we're probably missing? Examples of the kind of creativity we want:
- "Use Supabase Realtime channels as a distributed semaphore"
- "Use Microsoft Graph API's delta query to track unprocessed emails independent of n8n's consumption"
- "Write a Vercel Edge Function that acts as the queue, n8n polls it via HTTP with exclusive-claim semantics"

Give us at least ONE idea we probably haven't thought of.

### Q4: POLL INTERVAL TRADE-OFF

For demo UX, we want near-instant processing (target: <60 sec from email sent → ticket visible).
For concurrency safety, we want poll interval >> execution time.

Our pipeline takes 30-120 sec per email. What's the optimal poll interval given these tensions? Is there a pattern to ADAPT the interval based on workflow state (e.g., "poll fast when queue is empty, poll slow when processing")? Any n8n-native trick for this?

### Q5: OUTLOOK TRIGGER LIMITATION

The n8n Outlook Trigger node doesn't expose "Limit" or mark-as-read options in the UI. Is there:
- A workflow JSON-level parameter we can manually inject?
- An alternative approach using Microsoft Graph API HTTP Request node with custom polling logic and explicit "mark as read" control?
- Concrete example code?

### Q6: WHAT TO TEST / MEASURE

If we ship any of your proposed solutions, what specific measurements should we take to VERIFY it actually works? What failure modes should we deliberately test?

---

## REPLY FORMAT

Structure your response as:
1. **Your top-line recommendation** (1-2 sentences — commit to it, don't hedge)
2. **Concrete architecture/code** (the actual implementation, paste-ready where possible)
3. **Why this beats our current options** (specific comparison to 5-min-poll OR staticData-lock OR parallel-safe-pipeline)
4. **Risks & failure modes** (what breaks this, what to test)
5. **Any out-of-the-box insight we're missing** (even if it's not your top recommendation)

Length: aim for 1-2 pages. Terse specificity > vague generality.

---

## CONTEXT FILES (for reference)

Our prior AI Council rounds you successfully helped on:
- Round 1: CSV/XLSX architecture → unanimous "Hybrid C" (deterministic parse + AI column mapping)
- Round 2: Dashboard UX alignment for CSV/XLSX tickets
- Round 3: Pure JS DEFLATE inflateRaw (Claude's implementation chosen, shipped)

Current working pipeline spec in `pipelines/n8n-workflow-v12.json` — 12 nodes, v12.4 "CSV/XLSX Support", all KAN-28 #1-#3 resolved.

Thank you. DK and Minh will review all responses and synthesize the winning approach.
