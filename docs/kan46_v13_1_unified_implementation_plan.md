---
name: kan46_v13_1_unified_implementation_plan
aliases: ["KAN-46 v13.1 Unified Implementation Plan", "v13.1 Zero-Waste Plan"]
description: Detailed implementation plan for KAN-46 v13.1 unified zero-waste architecture (Database trigger + pg_cron + inner-loop drain). Now shipped; kept as reference for approach rationale.
type: reference
topics: [kan-46, v13-1, implementation, plan, shipped]
status: shipped
created: 2026-04-17
last_reviewed: 2026-04-19
---

# KAN-46 v13.1 — Unified Zero-Waste Implementation Plan

**Status:** READY TO IMPLEMENT
**Target ship:** Apr 18-19, 2026 (weekend before Myanmar testing Apr 20)
**Estimated time:** 3.5 hours (Phase 1: 2.5h + Phase 2: 1h)
**Risk level:** LOW (rollback <30 sec, v12.4 stays as hot standby)

---

## 0. Inheritance — what this plan builds on

### Shipped and kept unchanged
- **v12.4 EMI pipeline** (hot standby, rollback target) — commit `f77dc65`
- **Supabase schema v1** — `email_queue` table + 4 RPCs + 2 views + RLS + GRANTs (`sql/kan46_schema_v1.sql`)
- **Spooler v1** — Outlook Trigger + Supabase POST (`pipelines/n8n-workflow-spooler-v1.json`)
- **Dashboard Pipeline Queue card** — 5-sec client-side polling, live on `project-ii0tm.vercel.app`
- **v13.0 git commit** `e62b3e9`

### What gets replaced in v13.1
- **Worker v1** (30s Cron trigger) → **Worker v2** (Webhook trigger + inner-loop + Gemini retry)

### What gets added in v13.1
- **Database trigger** with single-flight gate on `email_queue` INSERT
- **pg_cron recovery sweeper** (conditional, every 5 min)
- **email_processing_audit view** for Myanmar self-service verification
- **Rollback runbook** doc

### Carried forward from prior sessions
- Hard-won bugs already fixed in v13.0 (stay fixed in v13.1):
  - n8n Webhook typeVersion 2 body wrapping (STEP 0 unwrap in Spooler)
  - `process.env` blocked in sandbox (Date.now() + random for worker IDs)
  - Supabase Legacy API keys (JWT service_role/anon)
- Known issues NOT addressed in v13.1 (scoped out):
  - v12 document_signers regression (deferred to v12.2 patch)
  - OTC vs MA spec tension (product decision pending)
  - Graph API migration (needs Ryan, v14 territory)

---

## 1. Why this plan exists (decision history)

### The problem
v13.0 Worker used Cron "every 30 seconds" → 2,880 n8n executions/day idle burn → blows 1,000/month trial cap in ~7 hours.

### Constraints that shaped the solution
1. **n8n Cloud trial cap**: 1,000 exec/month, 902 remaining as of Apr 17, 13 days to go
2. **Myanmar stress test reality**: week-long gradual testing (not single demo), Apr 20 - May 1+
3. **Rollback mandate**: must stay <30 sec, v12.4 preserved
4. **Horizon**: carries to AWS self-host (v14, 3-6 months) without rework
5. **Observability**: dashboard Pipeline Queue strip must keep working

### How we got here
- AI Council Round 4 (Apr 17 midday): consensus on Spooler+Worker+Queue pattern → shipped as v13.0
- Empirical cap burn discovery (Apr 17 afternoon): v13.0 unsustainable
- AI Council Round 6 (Apr 17 evening): 7/7 unanimous on v13.1 unified zero-waste design
- Best-of-breed synthesis: Claude's single-flight gate + Gemini's inner-loop + GPT/DeepSeek/Qwen operational insights

See: [kan46_round6_optimization_prompt.md](kan46_round6_optimization_prompt.md) for the Council prompt and memory file `feedback_ai_council_round6_best_of_breed.md` for methodology.

---

## 2. Architecture (v13.1 unified)

```
┌───────────────────────────┐
│ Outlook emoney@zeyalabs.ai│
└─────────────┬─────────────┘
              │ poll every 1 min (FREE if no new data)
              ▼
┌─────────────────────────────────────────┐
│ n8n Spooler v1 (UNCHANGED)              │
│ • Extract metadata + base64 attachments │
│ • Retry 3x on Supabase POST failure     │
└─────────────┬───────────────────────────┘
              │ POST /rest/v1/email_queue
              ▼
┌─────────────────────────────────────────┐
│ Supabase email_queue (UNCHANGED schema) │
│ • UNIQUE(message_id) dedup              │
│ • status: pending → processing → done   │
└─────────────┬───────────────────────────┘
              │ AFTER INSERT FOR EACH STATEMENT
              ▼
┌─────────────────────────────────────────┐
│ Database Trigger (NEW in v13.1)         │
│ • Single-flight gate: only fire if no  │
│   row currently in status='processing'  │
│ • Uses pg_net.http_post (async)         │
└─────────────┬───────────────────────────┘
              │ POST webhook
              ▼
┌─────────────────────────────────────────┐
│ n8n Worker v2 (NEW in v13.1)            │
│ • Webhook Trigger (not Cron)            │
│ • Inner-loop: claim → process → repeat  │
│   until claim returns empty             │
│ • Gemini retry 3x w/ exponential backoff│
│ • Drains entire queue in 1 execution    │
└─────────────────────────────────────────┘

              ┌─────────────────────────────────────────┐
              │ pg_cron recovery sweeper (NEW in v13.1) │
              │ • Every 5 min                           │
              │ • Fires webhook ONLY if pending >2 min  │
              │   OR processing row locked >5 min       │
              │ • Safety net for pg_net delivery fails  │
              └──────────────┬──────────────────────────┘
                             │ conditional POST
                             ▼
                     (same Worker webhook)
```

### Key patterns (with references to memory)
- [feedback_single_flight_trigger_gate.md](../memory/feedback_single_flight_trigger_gate.md) — why trigger-level gate
- [feedback_n8n_inner_loop_drain_pattern.md](../memory/feedback_n8n_inner_loop_drain_pattern.md) — why inner-loop
- [feedback_concurrency_relocation_trap.md](../memory/feedback_concurrency_relocation_trap.md) — the problem this solves
- [known_issue_pg_net_no_retry.md](../memory/known_issue_pg_net_no_retry.md) — why we need the sweeper
- [reference_supabase_pg_cron_pg_net.md](../memory/reference_supabase_pg_cron_pg_net.md) — extension usage

---

## 3. Execution count projection

| Source | Daily | 13 days |
|--------|-------|---------|
| Spooler (Outlook polls, batches when busy) | 10-15 | 150-200 |
| Worker (inner-loop drains bursts in 1 exec) | 3-8 | 50-100 |
| pg_cron recovery (conditional, rarely fires) | 0-1 | 5-15 |
| Debug/testing buffer | 5 | 65 |
| **TOTAL** | **~20-30** | **~270-380** |

**Budget: 902. Usage: ~380. Buffer: 522 (58%).**

### Burst load simulation (what Myanmar will try)
- **25 emails in 60 sec** → Spooler batches into 1-3 polls → 1 Worker exec drains all 25 → ~2-4 exec total
- Compare v13.0 naïve design: 25 parallel Worker execs → Gemini 429 cascade

---

## 4. PHASE 1 — Must-ship for Monday (~2.5 hours)

### P1.1 — Write SQL migration (~30 min)

**File:** `sql/kan46_v13_1_triggers.sql` (NEW)

**Contents:**
```sql
-- v13.1 zero-waste migration
-- Run ONCE via Supabase SQL Editor
-- Rollback: see sql/kan46_v13_1_rollback.sql

-- ===== 1. Enable extensions (idempotent) =====
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ===== 2. Webhook notification function with single-flight gate =====
CREATE OR REPLACE FUNCTION notify_worker_on_queue_insert()
RETURNS TRIGGER AS $$
DECLARE
  worker_url TEXT := 'https://tts-test.app.n8n.cloud/webhook/worker-v2';  -- TODO: update path
  webhook_secret TEXT := 'REPLACE_WITH_WEBHOOK_SECRET';
BEGIN
  -- Single-flight gate: skip if a Worker is already processing
  IF EXISTS(
    SELECT 1 FROM email_queue
    WHERE status = 'processing'
      AND locked_at > NOW() - INTERVAL '5 minutes'
  ) THEN
    RAISE NOTICE 'Worker already active; skipping webhook fire';
    RETURN NEW;
  END IF;

  -- Fire async webhook
  PERFORM net.http_post(
    url := worker_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Webhook-Secret', webhook_secret
    ),
    body := jsonb_build_object('trigger', 'insert', 'fired_at', NOW())
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===== 3. The trigger itself =====
DROP TRIGGER IF EXISTS on_email_queue_insert ON email_queue;
CREATE TRIGGER on_email_queue_insert
AFTER INSERT ON email_queue
FOR EACH STATEMENT  -- One fire per INSERT, even with multi-row
EXECUTE FUNCTION notify_worker_on_queue_insert();

-- ===== 4. pg_cron recovery sweeper =====
-- Removes any existing schedule before recreating
SELECT cron.unschedule('worker-recovery-sweep')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'worker-recovery-sweep');

SELECT cron.schedule(
  'worker-recovery-sweep',
  '*/5 * * * *',  -- every 5 minutes
  $sweeper$
  DO $block$
  DECLARE
    worker_url TEXT := 'https://tts-test.app.n8n.cloud/webhook/worker-v2';
    webhook_secret TEXT := 'REPLACE_WITH_WEBHOOK_SECRET';
    needs_wake BOOLEAN;
  BEGIN
    SELECT EXISTS(
      SELECT 1 FROM email_queue
      WHERE (status = 'pending' AND created_at < NOW() - INTERVAL '2 minutes')
         OR (status = 'processing' AND locked_at < NOW() - INTERVAL '5 minutes')
    ) INTO needs_wake;

    IF needs_wake THEN
      PERFORM net.http_post(
        url := worker_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'X-Webhook-Secret', webhook_secret
        ),
        body := jsonb_build_object('trigger', 'recovery_sweep', 'fired_at', NOW())
      );
    END IF;
  END
  $block$;
  $sweeper$
);

-- ===== 5. Myanmar self-service audit view =====
CREATE OR REPLACE VIEW email_processing_audit AS
SELECT
  message_id,
  from_address,
  subject,
  received_at,
  status,
  completed_at,
  EXTRACT(EPOCH FROM (completed_at - received_at))::INT AS total_seconds,
  error_message,
  notification_sent
FROM email_queue
WHERE received_at > NOW() - INTERVAL '7 days'
ORDER BY received_at DESC;

GRANT SELECT ON email_processing_audit TO anon;

-- ===== 6. Verification queries (run after migration) =====
-- Check trigger exists: SELECT * FROM pg_trigger WHERE tgname = 'on_email_queue_insert';
-- Check cron job: SELECT * FROM cron.job WHERE jobname = 'worker-recovery-sweep';
-- Check recent webhook calls: SELECT * FROM net._http_response ORDER BY created DESC LIMIT 5;
-- Check view: SELECT COUNT(*) FROM email_processing_audit;
```

**Tasks:**
- [ ] Replace `REPLACE_WITH_WEBHOOK_SECRET` with actual value
- [ ] Decide final webhook path (`worker-v2` vs `worker-trigger` — keep current path if unchanged)
- [ ] Run in Supabase SQL Editor
- [ ] Run verification queries to confirm

### P1.2 — Modify Worker v1 → v2 (~1 hour)

**File:** `pipelines/n8n-workflow-worker-v1.json` → `pipelines/n8n-workflow-worker-v2.json` (NEW)

**Changes:**
1. **Remove** the Cron "every 30 seconds" trigger node
2. **Keep** the existing Webhook Trigger (if present in v1) OR add new Webhook Trigger with path `/worker-v2`
3. **Wrap** the main flow (Claim & Reconstitute → Prepare → Skip Filter → Gemini → Parse → Send Notification → Mark Complete) in an inner-loop pattern:
   - At the end of Mark Complete, add a Code node: "Check for more work"
   - Returns `{ has_more: true, ...original_data }` if `SELECT COUNT(*) FROM email_queue WHERE status='pending' > 0`
   - Returns `{ has_more: false }` otherwise
   - Routes back to "Claim & Reconstitute" IF has_more=true
4. **Enable Retry On Fail** on the Gemini Extract node:
   - Max Tries: 3
   - Wait Between Tries: 2000ms
5. **Rename** workflow to `EMI Worker v2 (KAN-46 v13.1) — Webhook + Inner-Loop + Gemini Retry`

**Tasks:**
- [ ] Duplicate Worker v1 JSON → `worker-v2.json`
- [ ] Edit Cron trigger out, ensure Webhook trigger path matches SQL
- [ ] Add "Check for more work" Code node
- [ ] Wire loop-back connection
- [ ] Set Gemini Retry settings
- [ ] Import to n8n Cloud (don't activate yet)
- [ ] Paste secrets (service_role × 3, Gemini, webhook_secret)
- [ ] Attach Outlook credential to 2 send-message nodes

### P1.3 — End-to-end test (~45 min)

**Pre-test safety checks:**
- [ ] v12.4 is still ACTIVE in n8n
- [ ] Spooler v1 is INACTIVE
- [ ] Worker v2 is INACTIVE
- [ ] SQL migration has been run
- [ ] Dashboard loads, shows correct queue counts

**Swap sequence (atomic):**
1. [ ] Supabase SQL: run the migration file
2. [ ] Verify trigger and cron job exist (verification queries)
3. [ ] n8n: deactivate v12.4
4. [ ] n8n: activate Spooler v1
5. [ ] n8n: activate Worker v2

**Test 1 — Single email**
- [ ] Send 1 ACME test email to emoney@zeyalabs.ai
- [ ] Watch dashboard: Pending → Processing → Completed within 60 sec
- [ ] Verify: 1 new ticket, notification email delivered
- [ ] Check Supabase `net._http_response` — should show 200 response from webhook
- [ ] Check n8n executions: exactly 1 Spooler + 1 Worker run

**Test 2 — Burst of 5 emails (serialization proof)**
- [ ] Send 5 distinct test emails within 30 seconds
- [ ] Watch dashboard: Pending spikes to 5, drops to 0 one-by-one
- [ ] Verify: 5 new tickets (one per email)
- [ ] Check n8n executions: 1-2 Spooler runs + **1-2 Worker runs** (not 5!) — proves inner-loop + single-flight working
- [ ] No duplicate tickets
- [ ] No 429 errors

**If test fails:**
- Execute Step on Code nodes to isolate
- Check `net._http_response` for webhook delivery failures
- Check `email_queue_stuck` view
- If unrecoverable: execute rollback (see Phase 2 runbook)

---

## 5. PHASE 2 — Nice-to-have (~1 hour)

### P2.1 — Spooler multi-row INSERT batching (~30 min, optional)

**Goal:** When Outlook polling returns multiple emails in one poll, INSERT them as one multi-row statement instead of N separate statements.

**Benefit:** With `FOR EACH STATEMENT` trigger, 5 emails in one poll = 1 webhook fire instead of 5.

**File:** `pipelines/n8n-workflow-spooler-v1.json` → Spool to Supabase Queue Code node

**Change:** Modify Code node to collect ALL items from input, batch into one POST payload.

**Defer if:** short on time — the single-flight gate in trigger already prevents fan-out. This is pure optimization.

### P2.2 — Rollback runbook document (~30 min)

**File:** `docs/kan46_v13_1_rollback_runbook.md` (NEW)

**Contents (template):**

```markdown
# KAN-46 v13.1 Rollback Runbook
Target time: <30 seconds

## When to roll back
- Worker executions failing repeatedly
- Queue depth growing without drain
- Myanmar testing blocked
- Any critical production error

## Steps (execute in order)

### 1. Disable Database trigger (Supabase SQL Editor)
```sql
ALTER TABLE email_queue DISABLE TRIGGER on_email_queue_insert;
SELECT cron.unschedule('worker-recovery-sweep');
```

### 2. Deactivate v13.1 workflows in n8n UI
- Workflow list → Spooler v1 → toggle OFF
- Workflow list → Worker v2 → toggle OFF

### 3. Activate v12.4 fallback in n8n UI
- Workflow list → EMI Email Intake Pipeline v12.4 → toggle ON

### 4. Verify rollback
- Send 1 test email
- Should appear in dashboard normally (via v12.4's direct path)

## Known state after rollback
- Any pending emails in `email_queue` remain pending until next Worker activation
- v12.4 picks up Outlook emails directly on next 1-min poll
- No data loss: Outlook doesn't delete emails when v12.4 reads them

## Re-activation
When ready to retry v13.1:
```sql
ALTER TABLE email_queue ENABLE TRIGGER on_email_queue_insert;
-- Re-run the pg_cron schedule from kan46_v13_1_triggers.sql
```
Then n8n: deactivate v12.4, activate Spooler + Worker v2.

## Decision log
Record ANY rollback here:
- Date:
- Trigger:
- Root cause:
- Fix plan:
```

**Tasks:**
- [ ] Create the runbook file
- [ ] Test rollback once (dry run)

---

## 6. Success criteria

### Phase 1 complete when
- [ ] SQL migration applied, verified
- [ ] Worker v2 imported to n8n, configured
- [ ] Test 1 passes (single email end-to-end)
- [ ] Test 2 passes (5-email burst with 1-2 Worker executions)
- [ ] Dashboard shows live queue state accurately
- [ ] No errors in n8n execution log
- [ ] No errors in Supabase logs
- [ ] `net._http_response` shows 200 status codes

### Phase 2 complete when
- [ ] Spooler batching implemented (or deferred with note)
- [ ] Rollback runbook written + dry-run tested

### Overall done when
- [ ] Git commit `v13.1: KAN-46 zero-waste — Database Webhook + pg_cron + inner-loop` pushed to origin + yoma
- [ ] Vercel deploys auto (no changes needed unless dashboard tweaks)
- [ ] MEMORY.md resume pointer updated with v13.1 live state
- [ ] Implementation log (`docs/kan46_implementation_log.md`) appended

---

## 7. Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| pg_net webhook delivery silently fails | Low | High | pg_cron recovery sweeper catches within 5 min |
| n8n webhook URL changes | Low | High | Supabase `config` table for URL (defer to v13.2 if short on time) |
| Gemini 429 cascade during burst | Medium | Medium | Retry-on-Fail + inner-loop serialization prevents cascade |
| Worker times out on large queue drain | Low | Medium | Break loop after N iterations, rely on recovery sweeper to resume |
| Trigger fires but webhook path wrong | Medium | High | Test Phase 1 thoroughly before Monday |
| Myanmar sends edge cases v13.1 doesn't handle | Medium | Low | That's the POINT of stress testing; iterate |
| n8n trial expires mid-testing | HIGH (~May 1) | High | Decision by Apr 25 (see `project_n8n_trial_expiration_may1.md`) |

---

## 8. Post-deploy monitoring (Mon Apr 20 onwards)

### Daily checks
- Execution count in n8n dashboard (target: <30/day)
- `SELECT COUNT(*) FROM email_queue WHERE status = 'failed';`
- `SELECT * FROM email_queue_stuck;` — should be empty
- `SELECT * FROM net._http_response WHERE status_code >= 400 ORDER BY created DESC LIMIT 5;`

### Escalate if
- Daily exec count > 50 (unexpected)
- Failed count > 0 (investigate error_message)
- Stuck rows persist > 30 min
- Dashboard reports errors for > 10 min

---

## 9. What this plan does NOT do (scope discipline)

- **Does NOT migrate to Graph API** (needs Ryan's tenant admin consent; v14 territory)
- **Does NOT fix v12 document_signers regression** (separate v12.2 patch)
- **Does NOT implement advisory locks** (inner-loop is sufficient for v13.1; add in v13.2 if testing shows issues)
- **Does NOT add Edge Function bridge** (pg_net + sweeper is sufficient for MVP)
- **Does NOT upgrade n8n plan** (separate Apr 25 decision)
- **Does NOT address OTC vs MA spec tension** (product decision)

---

## 10. Reference trail

### Session history
1. v9 shipped Apr 13 — foundation
2. v11 through v12.4 — feature development
3. v13.0 shipped Apr 17 afternoon — Round 4 Council consensus, queue architecture
4. v13.0 partial failure — Cron cap burn
5. Round 6 Council Apr 17 evening — unified design
6. v13.1 this plan — ship Apr 18-19

### Critical memory files
- [project_kan46_v13_1_unified_architecture.md](../../../../Users/xaosp/.claude/projects/g--My-Drive-Tech-Jobs-Trustify-03-build/memory/project_kan46_v13_1_unified_architecture.md)
- [feedback_ai_council_round6_best_of_breed.md](../../../../Users/xaosp/.claude/projects/g--My-Drive-Tech-Jobs-Trustify-03-build/memory/feedback_ai_council_round6_best_of_breed.md)
- [feedback_single_flight_trigger_gate.md](../../../../Users/xaosp/.claude/projects/g--My-Drive-Tech-Jobs-Trustify-03-build/memory/feedback_single_flight_trigger_gate.md)
- [feedback_n8n_inner_loop_drain_pattern.md](../../../../Users/xaosp/.claude/projects/g--My-Drive-Tech-Jobs-Trustify-03-build/memory/feedback_n8n_inner_loop_drain_pattern.md)
- [feedback_concurrency_relocation_trap.md](../../../../Users/xaosp/.claude/projects/g--My-Drive-Tech-Jobs-Trustify-03-build/memory/feedback_concurrency_relocation_trap.md)
- [feedback_gemini_429_retry_backoff.md](../../../../Users/xaosp/.claude/projects/g--My-Drive-Tech-Jobs-Trustify-03-build/memory/feedback_gemini_429_retry_backoff.md)
- [known_issue_pg_net_no_retry.md](../../../../Users/xaosp/.claude/projects/g--My-Drive-Tech-Jobs-Trustify-03-build/memory/known_issue_pg_net_no_retry.md)
- [known_issue_n8n_trial_cap_survival.md](../../../../Users/xaosp/.claude/projects/g--My-Drive-Tech-Jobs-Trustify-03-build/memory/known_issue_n8n_trial_cap_survival.md)
- [reference_supabase_pg_cron_pg_net.md](../../../../Users/xaosp/.claude/projects/g--My-Drive-Tech-Jobs-Trustify-03-build/memory/reference_supabase_pg_cron_pg_net.md)
- [reference_n8n_execution_counting_rules.md](../../../../Users/xaosp/.claude/projects/g--My-Drive-Tech-Jobs-Trustify-03-build/memory/reference_n8n_execution_counting_rules.md)

### Docs
- [kan46_round6_optimization_prompt.md](kan46_round6_optimization_prompt.md) — Council prompt
- [kan46_final_architecture_decision.md](kan46_final_architecture_decision.md) — Round 4 rationale
- [kan46_round5_graph_api_critique_prompt.md](kan46_round5_graph_api_critique_prompt.md) — Round 5
- [kan46_implementation_log.md](kan46_implementation_log.md) — session log (will append v13.1 phases)

### Code artifacts (existing, unchanged)
- [sql/kan46_schema_v1.sql](../sql/kan46_schema_v1.sql)
- [sql/kan46_verify_v1.sql](../sql/kan46_verify_v1.sql)
- [pipelines/n8n-workflow-spooler-v1.json](../pipelines/n8n-workflow-spooler-v1.json)
- [pipelines/n8n-workflow-worker-v1.json](../pipelines/n8n-workflow-worker-v1.json) (becomes reference only)
- [pipelines/n8n-workflow-v12.json](../pipelines/n8n-workflow-v12.json) (hot standby)
