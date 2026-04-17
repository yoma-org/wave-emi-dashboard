# KAN-46 Final Architecture Decision

**Date:** Apr 17, 2026
**Decision authority:** DK + 7 AI Council consensus (Round 4 + Round 5)
**Status:** APPROVED — pending DK final go-ahead
**Demo date:** Monday Apr 20, 2026

---

## TL;DR — The Architecture

```
ACTIVE (primary path):
  Outlook Trigger (1 min)
    → Spooler Workflow: extract metadata, INSERT to Supabase email_queue
    → Cron Trigger (30-60s)
    → Worker Workflow: claim_next_email_job() RPC
    → Run v12.4 processing (Gemini, Parse, notify)
    → UPDATE email_queue.status = 'completed'

STANDBY (hot-standby for rollback):
  v12.4 pipeline — imported to n8n, DEACTIVATED
  Can be reactivated in <5 seconds if primary path fails

OBSERVABILITY:
  Dashboard "Pipeline Queue" card: pending/processing/completed/failed counts
  Dead-letter view: rows stuck in processing >5 min (Claude's suggestion)

DEDUP & SAFETY:
  UNIQUE(message_id) on email_queue + tickets_v2
  notification_sent BOOLEAN on tickets_v2 (atomic compare-and-set)
  5-min TTL on locked_at (auto-recovery from crashes)
```

**Key decision:** NOT running both paths in parallel. One active, one standby.

---

## Why This Architecture (7/7 AI Council Unanimous)

### All 7 AIs agreed on:
- Supabase as serialization layer (PostgreSQL row locks)
- `FOR UPDATE SKIP LOCKED` atomic claim
- Keep Outlook Trigger, add Spooler in front
- Zero email loss guarantee via durable queue
- `UNIQUE(message_id)` for dedup
- Idempotent ticket creation

### Key insights from specific AIs:

**GPT:** Visibility layer (pending→processing→done on dashboard) for instant demo UX feedback
**Gemini:** HTTP Request nodes in n8n are "notoriously slow" vs native nodes — don't replace Outlook Trigger
**Perplexity:** Delta query > simple `$filter` IF we ever go Graph API (v13.1 blueprint)
**Grok:** Multi-user shared mailbox breaks "unread = unprocessed" invariant — real production risk
**Qwen:** Data throughput limit (150 MB/min) is the real Graph constraint, not request count
**Qwen:** `notification_sent` BOOLEAN flag prevents duplicate notifications in any hybrid scenario
**DeepSeek:** Client credentials flow ALSO requires admin consent — no path around Ryan for Graph API
**Claude:** Dead-letter inspection view in Supabase for rows stuck in processing state (better than parallel ingestion)

### Claude's Round 5 reversal added critical nuance:
- Admitted Round 4 was factually wrong (OAuth credentials claim)
- Opposed parallel ingestion: race conditions + double debugging surface
- Recommended single active path + manual recovery surface
- Preserved Round 4 insight: Outlook Trigger's consume-on-poll IS a risk, Spooler solves it

---

## Schema Changes (Supabase — Phase 1)

```sql
-- ═══ QUEUE TABLE ═══
CREATE TABLE IF NOT EXISTS email_queue (
  id BIGSERIAL PRIMARY KEY,
  message_id TEXT UNIQUE NOT NULL,
  from_address TEXT,
  subject TEXT,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER DEFAULT 0,
  payload JSONB NOT NULL,
  error_message TEXT,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_email_queue_status_created ON email_queue(status, received_at);

-- ═══ ATOMIC CLAIM RPC ═══
CREATE OR REPLACE FUNCTION claim_next_email_job()
RETURNS email_queue AS $$
DECLARE
  claimed_row email_queue;
BEGIN
  UPDATE email_queue
  SET status = 'processing',
      locked_at = NOW(),
      attempts = attempts + 1,
      updated_at = NOW()
  WHERE id = (
    SELECT id FROM email_queue
    WHERE status = 'pending'
       OR (status = 'processing' AND locked_at < NOW() - INTERVAL '5 minutes')
    ORDER BY received_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING * INTO claimed_row;
  RETURN claimed_row;
END;
$$ LANGUAGE plpgsql;

-- ═══ NOTIFICATION DEDUP (Qwen's insight) ═══
ALTER TABLE tickets_v2 
ADD COLUMN IF NOT EXISTS notification_sent BOOLEAN DEFAULT false;

CREATE OR REPLACE FUNCTION claim_notification(p_message_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  claimed BOOLEAN;
BEGIN
  UPDATE tickets_v2 
  SET notification_sent = true 
  WHERE message_id = p_message_id AND notification_sent = false;
  GET DIAGNOSTICS claimed = ROW_COUNT;
  RETURN claimed > 0;
END;
$$ LANGUAGE plpgsql;

-- ═══ DEAD LETTER VIEW (Claude's insight) ═══
CREATE OR REPLACE VIEW email_queue_stuck AS
SELECT 
  id, message_id, from_address, subject, 
  status, attempts, locked_at, error_message,
  EXTRACT(EPOCH FROM (NOW() - locked_at))/60 AS stuck_minutes
FROM email_queue
WHERE status = 'processing' 
  AND locked_at < NOW() - INTERVAL '5 minutes'
ORDER BY locked_at ASC;
```

---

## n8n Workflows to Build

### Workflow 1: "EMI Spooler v1"
**Purpose:** Fast ingest, < 2 sec execution

```
Outlook Trigger (every 1 min)
  ↓
Code Node: extract metadata
  ↓
HTTP Request Node: POST to Supabase email_queue
  (with Prefer: resolution=ignore-duplicates)
  ↓
IF Error: retry 3x with 2s delay
  ↓
DONE
```

**Why fast:** Outlook Trigger consumes the email once it fires. Spooler's job is ONLY to persist to Supabase before this execution times out. No heavy work here.

### Workflow 2: "EMI Worker v1"
**Purpose:** Serial processing, one email at a time

```
Cron Trigger (every 30 seconds)
  ↓
HTTP Request Node: POST to /rpc/claim_next_email_job
  ↓
IF response empty → EXIT (queue empty or lock held)
  ↓
Code Node: extract email data from claimed row
  ↓
[RUN ENTIRE v12.4 PROCESSING PIPELINE]
  (Gemini extract, Parse & Validate, webhook to Vercel)
  ↓
IF notification needed → Call claim_notification(message_id) RPC
  IF true → Send notification email
  IF false → Skip (already sent)
  ↓
HTTP Request: UPDATE email_queue SET status = 'completed'
  (or 'failed' with error_message on error)
  ↓
DONE
```

### Workflow 3 (No change): v12.4 pipeline
- Leave imported, DEACTIVATED by default
- Hot-standby — reactivate in n8n UI if primary fails
- Its Outlook Trigger would immediately start picking up emails

---

## Dashboard Changes (index.html)

### "Pipeline Queue" card
```
┌─────────────────────────────────────┐
│ Pipeline Queue                       │
│                                      │
│   Pending: 3   Processing: 1        │
│   Completed: 12                     │
│   Failed: 0 (stuck: 0)              │
│                                      │
│   [View Stuck Items] (if stuck > 0) │
└─────────────────────────────────────┘
```

- Supabase REST API query every 5 sec for status counts
- "View Stuck Items" button opens modal showing `email_queue_stuck` view
- Demo storytelling: "watch the queue drain" narrative

### Ticket status indicators
- Each ticket shows `queued → processing → completed` stages
- Helps Minh/Rita understand pipeline transparency

---

## Rollback Plan (DK's Priority Concern — Addressed)

### During demo — what if new pipeline fails?

**Scenario 1: Spooler silently not inserting rows**
- **Detection:** Dashboard Pipeline Queue card shows 0 pending + no completed growth
- **Action:** Deactivate Spooler workflow (1 click), activate v12.4 (1 click)
- **Total time:** ~30 seconds
- **State risk:** Emails already consumed by Spooler's Outlook Trigger are lost (marked read but not queued). Mitigate with Spooler retry logic (3x with 2s delay + log to dead-letter).

**Scenario 2: Worker stuck / not processing queue**
- **Detection:** Dashboard shows pending growing, processing stuck
- **Action:** Check stuck items view, manually deactivate Worker, activate v12.4
- **Recovery:** Emails in queue table can be manually replayed by re-setting status='pending'

**Scenario 3: Supabase issues**
- **Detection:** Supabase REST calls fail
- **Action:** Activate v12.4 (it doesn't depend on queue table)
- **Recovery:** Once Supabase healthy, check for unprocessed rows, replay if needed

**Scenario 4: Everything works but wrong data extracted**
- **Same as existing v12.4 behavior** — no change in extraction logic
- **Action:** Check Gemini prompt, dashboard raw data

### Pre-demo rehearsal checklist
- [ ] Sunday: send 5 test emails in rapid succession
- [ ] Verify all 5 appear in email_queue
- [ ] Verify worker processes all 5 sequentially
- [ ] Verify dashboard shows live status
- [ ] Verify deactivate Spooler + activate v12.4 takes <30 sec
- [ ] Verify stuck item view works (deliberately kill worker mid-process)

---

## Implementation Timeline (14-16 hour budget)

| Phase | Hours | Cumulative | Who |
|-------|-------|------------|-----|
| P1: Supabase schema + RPCs + view | 1 hr | 1:00 | Claude writes SQL, DK runs in Supabase |
| P2: Spooler workflow | 1.5 hr | 2:30 | Claude writes JSON, DK imports to n8n |
| P3: Worker workflow | 3 hr | 5:30 | Claude writes JSON (adapts v12.4), DK imports |
| P4: Dashboard Pipeline Queue card | 2 hr | 7:30 | Claude edits index.html, DK reviews |
| P5: Notification dedup wiring | 1 hr | 8:30 | Claude updates Worker to use claim_notification |
| P6: End-to-end testing (5 email burst) | 2 hr | 10:30 | DK sends test emails, Claude analyzes results |
| P7: Rollback drill | 30 min | 11:00 | DK practices deactivate/reactivate |
| P8: Rita's >25 rejection (L4) — OPTIONAL | 1 hr | 12:00 | Only if time permits |
| P9: Buffer / polish | 2-4 hr | 14-16:00 | Bug fixes, commit, MEMORY update |

**Saturday Apr 18:** Phases 1-6 (10.5 hrs)
**Sunday Apr 19:** Phase 7 rehearsal + polish + rest
**Monday Apr 20:** Demo at 9 AM (buffer available)

---

## What We're NOT Doing (Explicit Scope Cuts)

- ❌ **Graph API front-end** — deferred to v13.1 (when DK controls AWS tenant post-migration)
- ❌ **Running both paths in parallel** — Claude's objection accepted: too much complexity
- ❌ **Microsoft Graph webhooks/subscriptions** — post-demo evolution
- ❌ **Delta query** — simple polling is sufficient at our scale
- ❌ **n8n Queue Mode** — requires self-hosting on AWS, post-demo
- ❌ **Rita's >25 email rejection (L4)** — OPTIONAL, ship only if time
- ❌ **Rate limiting between items (L5)** — not needed when serial
- ❌ **Separate pipeline for heavy files (L6)** — unnecessary

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| Apr 17 | Spooler + Worker pattern | 7/7 AI Council unanimous (after Round 5) |
| Apr 17 | Keep v12.4 as hot-standby (NOT running parallel) | Claude's objection to race conditions valid |
| Apr 17 | Ship `notification_sent` dedup flag | Qwen's insight — prevents demo-day embarrassment |
| Apr 17 | Add dead-letter view for stuck rows | Claude's safety net idea |
| Apr 17 | Dashboard "Pipeline Queue" card | GPT's visibility-layer insight for demo storytelling |
| Apr 17 | Graph API deferred to v13.1 | Ryan tenant admin dependency deal-breaker |
| Apr 17 | NOT running both paths in parallel | 6/7 said yes, 1/7 (Claude) objected; Claude's argument stronger for 14-hr budget |

---

## Post-Demo Roadmap (v13.1 and beyond)

### v13.1 — Graph API migration (2-3 weeks post-demo)
- Get Ryan's approval for Azure AD app registration
- Replace Outlook Trigger with Microsoft Graph `/messages/delta` query
- Use Perplexity's Round 5 delta code snippet as starting point
- Explicit mark-as-read ONLY after successful processing
- Eliminates Outlook Trigger consume-on-poll risk

### v14 — AWS self-hosted (3-6 months)
- Migrate n8n to self-hosted on AWS
- Enable Queue Mode natively (our manual Spooler becomes redundant or observable layer)
- Microsoft Graph webhook subscriptions (push-based, near-zero latency)
- Supabase queue stays as observability layer

---

## References

- Round 4 prompt: `docs/kan46_concurrency_ai_council_prompt.md`
- Round 4 synthesis: `docs/kan46_concurrency_ai_council_synthesis.md`
- Round 5 prompt: `docs/kan46_round5_graph_api_critique_prompt.md`
- KAN-46 analysis: `docs/jira/KAN-46_n8n_Performance_Optimize_Analysis.md`
- Current pipeline: `pipelines/n8n-workflow-v12.json` (v12.4)

---

*Final architecture approved Apr 17, 2026 after 2 rounds of AI Council deliberation. All 7 AIs converged on same pattern despite initial disagreement. Claude's Round 5 position reversal is a model of intellectual honesty worth preserving for future decisions.*
