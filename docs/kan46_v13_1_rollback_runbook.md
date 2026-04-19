---
name: kan46_v13_1_rollback_runbook
aliases: ["KAN-46 v13.1 Rollback Runbook", "v13.1 Rollback"]
description: Step-by-step runbook for rolling back KAN-46 v13.1 (or v13.2) back to v12.4 in under 30 seconds. Zero data loss (Outlook does not delete emails). Critical emergency reference.
type: reference
topics: [kan-46, v13-1, v13-2, rollback, runbook, incident-response]
status: active
created: 2026-04-17
last_reviewed: 2026-04-19
---

# KAN-46 v13.1 Rollback Runbook

**Target rollback time:** <30 seconds
**Rollback destination:** v12.4 (hot standby, preserved)
**Data loss risk:** NONE — Outlook does not delete emails when v12.4 re-reads them

---

## When to roll back

Trigger rollback if ANY of these occur:
- Worker v2 executions failing repeatedly (n8n execution log shows red)
- Queue depth growing without drain (Pending count climbs, no Processing activity)
- Myanmar testing blocked by broken tickets
- Gemini 429 errors cascading despite retry-on-fail
- Supabase `net._http_response` shows consistent 4xx/5xx failures
- Unexpected behavior after `sql/kan46_v13_1_triggers.sql` migration
- Any critical production error lasting >10 minutes

---

## Rollback steps (execute in order)

### Step 1 — Disable the Database Webhook trigger (Supabase SQL Editor)

Open: https://app.supabase.com/project/dicluyfkfqlqjwqikznl/sql

Run:
```sql
-- Disable the webhook fire on INSERT (keeps function in case we want to re-enable)
ALTER TABLE email_queue DISABLE TRIGGER on_email_queue_insert;

-- Unschedule the recovery sweeper
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'worker-recovery-sweep') THEN
    PERFORM cron.unschedule('worker-recovery-sweep');
  END IF;
END $$;
```

Verify:
```sql
SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'on_email_queue_insert';
-- Expected: tgenabled = 'D' (disabled)

SELECT jobname FROM cron.job WHERE jobname = 'worker-recovery-sweep';
-- Expected: 0 rows
```

### Step 2 — Deactivate v13.1 workflows in n8n UI

Open: https://dknguyen01trustify.app.n8n.cloud

1. Workflow list → **EMI Spooler v1 (KAN-46) — Outlook → Supabase Queue** → toggle **OFF**
2. Workflow list → **EMI Worker v2 (KAN-46 v13.1) — Webhook + Self-Chain + Gemini Retry** → toggle **OFF**

### Step 3 — Activate v12.4 fallback in n8n UI

1. Workflow list → **EMI Email Intake Pipeline v12.4 (CSV/XLSX Support)** → toggle **ON**

### Step 4 — Verify rollback

**Send 1 test email** to `emoney@zeyalabs.ai` with a simple subject like "v13.1 rollback verify".

**Expected behavior (v12.4 path):**
- Within 60 seconds (Outlook polls every 1 min), ticket appears on dashboard
- Ticket shows normal extraction (Gemini Vision, company info, etc.)
- Notification email delivered to sender

**Checks:**
- [ ] Dashboard loads normally
- [ ] No new rows accumulating in `email_queue` table (v12.4 doesn't use it)
- [ ] New ticket created in `tickets_v2` table
- [ ] Notification email received

**Total rollback time target:** <30 seconds (Steps 1-3); verification adds ~60 sec

---

## What happens to in-flight email_queue rows during rollback?

### Rows with `status = 'pending'`
These are emails captured by Spooler but not yet processed. After rollback:
- **They stay in the queue** (no Worker to process them)
- **v12.4 does NOT read `email_queue`** — it reads Outlook directly
- If the original emails are still unread in Outlook, v12.4 will process them normally

**Potential duplicate risk:** if Spooler already processed an email and marked Outlook message as read, v12.4 won't see it. Those emails are "trapped" in `email_queue` until you either:
- Re-enable v13.1 later to drain them
- Manually re-post them to `emoney@zeyalabs.ai` (low effort)

### Rows with `status = 'processing'`
Mid-processing when Worker died. Same fate as above: trapped until v13.1 re-enabled or manual intervention.

### Rows with `status = 'completed'`
These created tickets successfully via v13.1. No action needed.

### Rows with `status = 'failed'`
These errored during v13.1 processing. Inspect `error_message` field. Safe to ignore during rollback; investigate after system is stable.

---

## Re-activation (when ready to retry v13.1)

### Step 1 — Fix the root cause
Don't re-activate blindly. Investigate why rollback was needed:
- Check Supabase `net._http_response` for failed webhook deliveries
- Check n8n execution logs for error details
- Check `email_queue` for stuck rows with error messages
- Review Gemini API status / quota

### Step 2 — Re-enable the trigger and sweeper

```sql
-- Re-enable the trigger
ALTER TABLE email_queue ENABLE TRIGGER on_email_queue_insert;

-- Re-schedule the sweeper (copy the pg_cron schedule block from kan46_v13_1_triggers.sql)
-- (The sweeper job must be re-created; unschedule does not preserve it.)
```

Re-run section 5 of `sql/kan46_v13_1_triggers.sql` to restore the pg_cron schedule.

### Step 3 — Reactivate workflows in n8n
1. Deactivate v12.4
2. Activate Spooler v1
3. Activate Worker v2
4. Verify with 1 test email

### Step 4 — Drain any trapped rows
If there were pending rows trapped during the rollback window:
```sql
-- Fire the worker webhook manually to trigger a drain cycle
SELECT net.http_post(
  url := (SELECT worker_url FROM worker_config WHERE id = 1),
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'X-Webhook-Secret', (SELECT webhook_secret FROM worker_config WHERE id = 1)
  ),
  body := '{"trigger":"manual_drain"}'::jsonb
);
```

---

## Decision log

Record every rollback event here for future learning:

| Date | Trigger reason | Root cause | Fix applied | Re-enabled at |
|------|---------------|------------|-------------|---------------|
| (template row) | (e.g. "Worker 429 cascade") | (e.g. "Gemini quota") | (e.g. "Added backoff") | (date/time) |

---

## Known rollback pitfalls

1. **Don't skip Step 1 (disable trigger)** — if you only deactivate n8n workflows, new INSERTs will still fire webhooks that fail loudly.
2. **Don't delete the trigger function** — just DISABLE the trigger. Deleting means re-activation requires re-running the full migration SQL.
3. **Don't unschedule pg_cron and forget to re-schedule later** — `cron.unschedule()` is permanent until re-scheduled.
4. **Don't ignore trapped rows** — they represent lost/delayed processing. Plan to drain them.

---

## Related documents
- [kan46_v13_1_unified_implementation_plan.md](kan46_v13_1_unified_implementation_plan.md)
- [sql/kan46_v13_1_triggers.sql](../sql/kan46_v13_1_triggers.sql)
- [sql/kan46_v13_1_rollback.sql](../sql/kan46_v13_1_rollback.sql)
- [project_kan46_v13_1_unified_architecture.md](../../../Users/xaosp/.claude/projects/g--My-Drive-Tech-Jobs-Trustify-03-build/memory/project_kan46_v13_1_unified_architecture.md)
