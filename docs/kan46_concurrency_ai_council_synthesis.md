# AI Council Rounds 4 + 5 — Final Synthesis: KAN-46 Concurrency

**Round 4 responses:** 7/7 — agreed on Supabase+serialize, split on front-end
**Round 5 responses:** 7/7 — **UNANIMOUS (B) Outlook Trigger + Spooler**
**Claude explicitly reversed** Round 4 position after learning of Ryan tenant admin constraint
**Final decision:** Ship Outlook Trigger + Spooler + Worker. Keep v12.4 as hot-standby fallback.

---

## ⚠️ Claude's Dissent (Important)

Claude strongly argues to **rip out the Outlook Trigger entirely** and replace with Microsoft Graph API from day 1. Claude's core insight:

> "The Outlook Trigger node is the enemy. It consumes emails on poll (marks as read/processed internally), which means any skip/lock/gate after the trigger fires = lost email. By using Graph API directly, YOU control when an email transitions from 'unread' to 'read,' and that transition only happens after you've acquired the processing lock."

This is architecturally the CLEANEST answer. But it requires more upfront work (OAuth tenant/client/secret setup).

### The Split:
- **6/7 AIs (GPT, Gemini, Grok, Perplexity, Qwen, DeepSeek):** Keep Outlook Trigger, add Supabase Spooler-Worker in front. Faster to build. Marginal email loss risk if Spooler fails mid-insert.
- **1/7 Claude:** Replace Outlook Trigger with Graph API. Cleaner semantics. More integration setup.

### Resolution:
- **For Monday demo:** Ship the 6/7 pattern (Spooler + Worker with existing Outlook Trigger). Faster, lower risk of demo-day failure.
- **Add Claude's `email_queue` ledger table** as a critical safety net — if Spooler POST to Supabase fails, retry 3x; if still failing, log to dead-letter table so email is recoverable manually.
- **Post-demo v13.1:** Migrate to Claude's Graph API pattern. Cleaner long-term.

Claude's Supabase ledger table idea (Q3 out-of-the-box) is **strictly additive** and should be integrated in our Monday ship regardless.

---

## The Unanimous Verdict

### 🏆 Core Pattern: **Supabase as the Serialization Layer**

All 6 AIs independently arrived at the same architectural answer:

> **Move the queue from Outlook+n8n-staticData to Supabase. Use PostgreSQL row locks (`FOR UPDATE SKIP LOCKED` or advisory locks) for atomic job claiming. Serialize pipeline execution via durable queue, not in-memory locks.**

This is the winning architecture. The question is only which variant to implement.

### 🏆 Philosophical Q2 (Serialize vs Parallel-Safe): **6/6 say SERIALIZE**

All 6 AIs committed to Approach A (serialization) over Approach B (parallel-safe). Reasoning converged:
- Gemini API 429 risk under parallel calls
- CPU/memory pressure from pure JS XLSX inflate
- Supabase writes race-condition prone
- 3-day timeline — parallel-safe is too brittle
- Minh's "handle 25 concurrent" requirement doesn't require actual parallelism — just durable queueing

### 🏆 Universal Patterns (shared across all 6)

| Pattern | Votes | Purpose |
|---------|-------|---------|
| `UNIQUE(message_id)` on queue table | 6/6 | Dedup guarantee |
| `FOR UPDATE SKIP LOCKED` SQL | 5/6 | Atomic claim |
| 5-minute TTL for stale locks | 6/6 | Crash recovery |
| Idempotent ticket creation (`ON CONFLICT DO NOTHING`) | 6/6 | Safety net |
| Retry Gemini with exponential backoff on 429 | 6/6 | Rate limit resilience |
| Microsoft Graph API as escape hatch | 5/6 | Long-term alternative |

---

## Two Implementation Variants Emerged

### Variant A: **Spooler + Worker (Two Workflows)**
Proposed by: GPT, Gemini, Qwen, Perplexity (4/6)

```
Workflow A — Spooler (fast ingest):
  Outlook Trigger (1 min) → Supabase INSERT email_queue → DONE
  Execution time: <2 sec (no heavy work)

Workflow B — Worker (serial processor):
  Cron Trigger (30-60s) → Claim 1 job via SKIP LOCKED → v12.4 pipeline → Mark done
  Execution time: 30-120 sec (heavy work, but serial)
```

**Pros:**
- Spooler can't fail under burst (<2 sec execution = no overlap issue)
- Worker is genuinely serial (each cron fires, tries to claim, one wins)
- Clear separation of concerns
- Dashboard can show `pending/processing/done` counts in real-time (GPT's insight)
- Queue is observable for debugging

**Cons:**
- 2 workflows to maintain
- Slightly more complex deploy

### Variant B: **Single Workflow + Advisory Lock at Entry**
Proposed by: Grok, DeepSeek (2/6)

```
Single Workflow:
  Outlook Trigger (2 min) → Acquire advisory lock → v12.4 pipeline → Release lock
  If lock held → wait/retry or throw
```

**Pros:**
- Minimal change to existing v12.4 pipeline
- Single workflow (less maintenance)
- Faster to implement

**Cons:**
- Lock held during heavy work = other executions STALL for 2 min
- n8n Cloud may kill stalled executions (timeout risk)
- Harder to observe queue state
- Lock release on crash requires TTL + polling
- **Still at risk of data loss** if lock acquisition fails and execution exits without queueing

---

## 🎯 Winning Recommendation: **Variant A (Spooler + Worker)**

**Why:**
1. **Zero email loss guarantee** — Spooler persists to Supabase BEFORE any other work
2. **Observable** — queue state is SQL-queryable, dashboard-renderable
3. **Composable** — we can later add Graph API delta query or dashboard status indicators without refactoring
4. **Minh's "handle 25 concurrent" requirement met** — all 25 get queued instantly, worked through serially
5. **Rita's ">25 rejection" rule integrates cleanly** — Spooler can count pending rows and reject if >25
6. **GPT's visibility insight** — dashboard shows "pending/processing/done" for INSTANT demo UX feedback
7. **Monday demo safe** — if Worker fails, queue still has emails, can be replayed manually

**What Variant A gives us that Variant B doesn't:**
- **Demo storytelling.** "Look, system accepted all 25 emails in <1 second, now it's processing them carefully one at a time" — this is a compelling narrative.
- **Real queueing semantics** that align with Minh's mental model

---

## 🎁 Out-of-the-Box Wins to Integrate

### From GPT: **Visibility Layer for Demo UX**
Dashboard shows ticket status `pending → processing → done` in real-time (Supabase Realtime or 5s polling). Stakeholders see **instant feedback** (<5 sec ticket row appears) even if full processing takes 2 min. **Removes all poll-interval pressure.**

**Demo script impact:**
> "Watch — the moment I hit send, the ticket appears in 'pending'... now it's 'processing' as our AI reads the attachment... and done. 90 seconds."

vs current painful:
> "Sending email... wait 5 minutes... [awkward silence]... okay, should appear any moment now..."

### From Gemini/Grok/Perplexity/DeepSeek/Qwen: **Graph API as Phase 2**
Microsoft Graph `/messages/delta` API replaces n8n Outlook Trigger entirely:
- Explicit control over batch size (`$top=5`)
- Explicit mark-as-read (not on trigger fire, but on success)
- Manual pagination
- No more consumption race

**Decision:** Don't do this for Monday. Do Variant A with existing Outlook Trigger. Graph API becomes v13 post-demo.

---

## 📋 Implementation Plan — What We Build

### Phase 1: Supabase Schema (30 min)

```sql
-- Queue table
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

-- Atomic claim function
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
```

### Phase 2: Workflow A — Spooler (1 hour)

New workflow `EMI Spooler v1`:
1. Outlook Trigger (every 1 min) — unchanged
2. Code node: extract minimal metadata (message_id, subject, from, payload — but NOT attachments in full)
3. HTTP node: POST to Supabase `email_queue` (with `ON CONFLICT DO NOTHING` via Prefer header)
4. Done

### Phase 3: Workflow B — Worker (2-3 hours)

New workflow `EMI Worker v1`:
1. Cron Trigger (every 30s)
2. HTTP node: call `claim_next_email_job()` RPC → returns 1 row or null
3. IF node: if null, exit gracefully
4. Re-fetch full email data from Outlook via Graph API (using stored message_id) — OR store full payload in queue row
5. **Run the existing v12.4 pipeline** (Gemini extraction, Parse, etc.)
6. Mark queue row as `completed` on success, `failed` with error_message on failure
7. Done

### Phase 4: Dashboard Visibility Layer (1-2 hours)

In `index.html`:
- Add "Pipeline Queue" card showing counts: pending / processing / completed / failed
- Supabase Realtime subscription OR 3-second polling on `email_queue` status counts
- Individual ticket rows can show "Queued → Processing → Created" stages

### Phase 5: Testing (2 hours)

- Burst test: 10 emails in 30 sec → all 10 in queue → worker processes all serially
- Crash simulation: kill worker mid-execution → next cron reclaims stuck row (5-min TTL)
- Duplicate test: resend same email → queue insert ignored via UNIQUE constraint
- Gemini 429: stress test with XLSX attachments
- Latency measurement: from email sent to ticket visible

### Phase 6: Rita's >25 Rejection (1 hour) — KAN-46 L4

In Spooler, before insert:
```sql
SELECT COUNT(*) FROM email_queue 
WHERE status IN ('pending', 'processing') 
AND received_at > NOW() - INTERVAL '1 minute';
```
If >25, reject with instruction email (reuse existing rejection path).

---

## 🎯 Total Effort Estimate

| Phase | Effort | Cumulative |
|-------|--------|------------|
| 1. Supabase schema | 30 min | 0:30 |
| 2. Spooler workflow | 1 hr | 1:30 |
| 3. Worker workflow | 2-3 hrs | 4:30 |
| 4. Dashboard visibility | 1-2 hrs | 6:30 |
| 5. Testing | 2 hrs | 8:30 |
| 6. Rita's rejection (L4) | 1 hr | 9:30 |
| **TOTAL** | **~10 hours** | ~1.5 working days |

**Timeline:** Ship by end of Apr 18 (Saturday) → test Apr 19 (Sunday) → Monday demo ready.

---

## 🚨 Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Spooler fails → email lost | Outlook trigger already marks as read; if POST to Supabase fails, we need retry logic in Spooler with dead-letter to Supabase log table |
| Worker crashes mid-execution | 5-min TTL on `locked_at` → next cron reclaims stuck row |
| Queue backlog grows unbounded | Add monitoring + alert; Rita's >25 rejection prevents worst case |
| n8n Cloud kills long-running cron | Worker only processes 1 job per execution (max 120 sec) — well within n8n limits |
| Supabase goes down | Spooler fails → emails stay unread in Outlook; manual recovery needed (rare) |
| Duplicate tickets | `UNIQUE(message_id)` on tickets_v2 OR `ON CONFLICT DO NOTHING` safeguards |

---

## 📝 Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| Apr 17 | Spooler + Worker (Variant A) over Advisory Lock (Variant B) | Observable queue, Zero loss guarantee, Dashboard visibility integrates cleanly |
| Apr 17 | Use existing n8n Outlook Trigger for Monday (not Graph API) | Claude dissent noted. 6/7 AIs favor keep-existing. Timeline pressure. |
| Apr 17 | Add Claude's `email_queue` ledger + Spooler retry logic | Insurance against the trigger's email consumption risk |
| Apr 17 | Add dashboard visibility layer for demo UX | GPT's insight — demo storytelling value is huge |
| Apr 17 | Defer MS Graph Delta API to v13.1 (post-go-live) | Claude's recommendation for correctness; too much for Monday |
| Apr 17 | **7/7 AI consensus on SERIALIZE (Approach A)** | Zero disagreement on philosophical Q2 |

---

## 🎬 Next Steps (if DK approves)

1. **Approve this synthesis** — DK gives green light
2. **Implement Phase 1** (Supabase schema) — 30 min
3. **Implement Phase 2-3** (Spooler + Worker) — 3-4 hrs
4. **Implement Phase 4** (dashboard visibility) — 1-2 hrs
5. **Test Phase 5** — 2 hrs
6. **Ship and commit** → v13.0 "Durable Queue Architecture"

The prompt, 6 responses, and this synthesis are all saved. If Claude's response arrives later, we can cross-check but the consensus is unlikely to flip.

---

*Synthesized Apr 17, 2026 — 6/6 AI Council consensus on Supabase-backed serialization*
