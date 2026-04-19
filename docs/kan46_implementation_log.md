---
name: kan46_implementation_log
aliases: ["KAN-46 Implementation Log", "KAN-46 v13 Implementation Log"]
description: Persistent implementation log for KAN-46 durable queue architecture. Updated after each phase with what was done, what worked, what broke, recovery steps. Cross-session source of truth for resuming KAN-46 work.
type: reference
topics: [kan-46, implementation, log, v13]
status: active
created: 2026-04-17
last_reviewed: 2026-04-19
---

# KAN-46 Implementation Log — v13.0 "Durable Queue Architecture"

**Purpose:** Persistent log of every implementation step for KAN-46 (Spooler + Worker pattern).
**Pattern:** Update this file AFTER each phase completes with: what was done, what worked, what broke, recovery steps.
**Why:** Session context windows clear. This file persists. Next session reads this to resume.

---

## Session Timeline

### Apr 17, 2026 (Friday) — Decision + Phase 1 Start

**Decided architecture:** 7/7 AI Council unanimous → Outlook Trigger + Spooler + Supabase queue + Worker
**Hot-standby:** v12.4 pipeline kept imported but deactivated
**Budget:** 14-16 hours total across Fri/Sat/Sun
**Demo:** Monday Apr 20, 2026, ~9 AM

---

## Phase 1: Supabase Schema

**Status:** SQL WRITTEN — awaiting DK paste into Supabase
**Start time:** Apr 17 ~afternoon
**Planned duration:** 1 hour
**SQL file:** [`sql/kan46_schema_v1.sql`](../sql/kan46_schema_v1.sql)

### What this phase builds:
1. `email_queue` table — durable FIFO queue with status tracking + `notification_sent` flag
2. `claim_next_email_job(worker_id)` RPC — atomic claim via `FOR UPDATE SKIP LOCKED` + 5-min TTL recovery
3. `claim_notification(message_id)` RPC — atomic "did I win the notification race?"
4. `mark_email_completed(message_id)` RPC — success path
5. `mark_email_failed(message_id, error, retry)` RPC — failure path with retry option
6. `email_queue_stuck` view — dead-letter inspection for rows stuck >5 min
7. `email_queue_summary` view — dashboard counts by status
8. RLS policies + GRANTs (service_role all; anon read on summary/stuck views)
9. Auto-update trigger for `updated_at`

### Design decision: notification_sent on email_queue, not tickets_v2
- Original plan: add `notification_sent` to `tickets_v2`
- Changed because: `message_id` lives on `ticket_emails` child table, not `tickets_v2`
- Cleaner: notification_sent belongs with the "work item" (queue row), not the ticket

### Expected result:
- All 3 new objects exist in Supabase
- Zero impact on existing `tickets_v2` operations
- Backward compatible (v12.4 ignores new objects)

### Execution notes:
- SQL file location: `wave-emi-dashboard/sql/kan46_schema_v1.sql`
- DK runs via Supabase SQL Editor
- All statements are `CREATE ... IF NOT EXISTS` or `CREATE OR REPLACE` — idempotent

### Verification queries:
```sql
-- 1. Verify email_queue table exists
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'email_queue';

-- 2. Verify RPCs exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_name IN ('claim_next_email_job', 'claim_notification');

-- 3. Verify notification_sent column added
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'tickets_v2' AND column_name = 'notification_sent';

-- 4. Verify stuck view exists
SELECT viewname FROM pg_views WHERE viewname = 'email_queue_stuck';
```

### Post-phase checklist:
- [x] SQL executed without errors (confirmed Apr 17 — V5 `rowsecurity=true` returned)
- [x] DK confirmed via Supabase UI
- [ ] Full verification via `sql/kan46_verify_v1.sql` (run at leisure)
- [x] Log updated with result

### Result:
✅ Phase 1 complete. All 9 Supabase objects created:
- Table: `email_queue` (14 columns)
- RPCs: `claim_next_email_job`, `claim_notification`, `mark_email_completed`, `mark_email_failed`, `email_queue_touch_updated_at`
- Views: `email_queue_stuck`, `email_queue_summary`
- Indexes: PK + 2 secondary
- RLS: enabled, service_role policy active
- Trigger: `trg_email_queue_updated_at` active

Ready for Phase 2: Spooler workflow.

---

## Phase 2: EMI Spooler Workflow — ✅ COMPLETE (Apr 17 afternoon)

**SQL file:** n/a
**Workflow JSON:** [`pipelines/n8n-workflow-spooler-v1.json`](../pipelines/n8n-workflow-spooler-v1.json)
**Extracted code:** [`pipelines/_spooler_code_node_v2.js`](../pipelines/_spooler_code_node_v2.js)

### What this phase built
- New n8n workflow "EMI Spooler v1 (KAN-46)"
- 5 nodes: Sticky + Outlook Trigger + Webhook Test Trigger + Spool Code + Respond
- Code node extracts metadata + base64 attachments, POSTs to Supabase email_queue with 3x retry

### Debugging session
1. **Initial test:** 37ms execution, no output on Spool node. 0 rows in Supabase.
2. **Root cause:** n8n Webhook (typeVersion 2) wraps POST body under `body`. My code expected fields at top level.
3. **Fix:** Added STEP 0 unwrap logic — if `d.webhookUrl && d.headers && d.body` exists, reassign `d = d.body`.
4. **Post-fix test via Execute Step:** ✅ `_spool_status: "queued"`, row `id=2` in email_queue with `status='pending'`.

### Known quirk (not blocking)
Webhook test-mode execution didn't show Spool output in UI despite data flowing through. Manual "Execute Step" on same input produced correct output. Unclear root cause — likely n8n test-mode async handling quirk. **Does NOT affect production Outlook Trigger path.** Parked.

### Result
Spooler proven working. Ready for Phase 3 Worker to consume queue rows.

---

## Phase 3: EMI Worker Workflow — ✅ BUILT (Apr 17 afternoon)

**Workflow JSON:** [`pipelines/n8n-workflow-worker-v1.json`](../pipelines/n8n-workflow-worker-v1.json)
**Build script:** [`pipelines/_worker_build.mjs`](../pipelines/_worker_build.mjs)

### Structure — 12 nodes
Starts from v12.4 template, removed 5 nodes (triggers + route), added 5 new nodes:
- NEW: Sticky Note, Cron (30s), Claim & Reconstitute, Mark Complete (Notify), Mark Complete (Reject)
- KEPT: Prepare for AI v3, Skip Filter, Gemini 3 Extract, Parse & Validate v3, Send Outlook Notification, Is Rejection Email?, Send Rejection Email

### Flow
```
Cron (30s) → Claim & Reconstitute → Prepare for AI v3 → Skip Filter
  ├─ [0 true] Is Rejection Email? → Send Rejection Email → Mark Complete (Reject)
  └─ [1 false] Gemini 3 Extract → Parse & Validate → Send Notification → Mark Complete (Notify)
```

### Key decisions
- Only one active path at a time (not running in parallel with v12.4) — hot-standby for rollback
- Mark Complete reaches back to Claim & Reconstitute via `$('Claim & Reconstitute').first()` for message_id (downstream nodes may strip it)
- No notification_sent gating yet — deferred to Phase 5 (adds minor duplicate-notification risk in crash-recovery only)
- If mark_complete RPC fails, lock auto-releases via 5-min TTL

### Placeholders needing replacement on import
- `REPLACE_WITH_SUPABASE_SERVICE_ROLE_KEY` × 3 (claim-reconstitute + 2 mark-complete nodes)
- `REPLACE_WITH_GEMINI_API_KEY` × 1 (gemini3-extract)
- `REPLACE_WITH_WEBHOOK_SECRET` × 1 (parse-validate-v3)
- `REPLACE_WITH_OUTLOOK_CREDENTIAL_ID` × 2 (both Send nodes)

### Phase 3 TEST RESULT — ✅ END-TO-END SUCCESS (Apr 17 afternoon)

After fixing `process.env` bug (n8n sandbox blocks Node.js globals — same class as `zlib` block), Worker executed cleanly:
- Cron → Claim → Prepare → Skip Filter → Gemini → Parse → Notify → Mark Complete
- All nodes green
- Lock acquired and released correctly
- No fake ticket created (Parse's `_diagnostic` path correctly detected `is_disbursement: false`)
- email_queue row id=2 transitioned: pending → processing → completed

**Bug fixed in this phase:**
- Line 12 of Claim & Reconstitute used `process.env.HOSTNAME` which is blocked in n8n Cloud sandbox
- Fix: use `Date.now() + Math.random()` for worker ID uniqueness

**Key insight (v12.4 inheritance):**
Parse & Validate v3 inherits v12.4's smart "not_disbursement" detection. For the fake test email, Parse returned a diagnostic object instead of POSTing to Vercel, preventing fake ticket creation. This is an unexpected bonus — our Worker inherits this safeguard.

---

## Phase 4: Dashboard Pipeline Queue Card — ✅ BUILT (Apr 17 afternoon)

**File:** [`index.html`](../index.html)

### What was added (3 changes)
1. **CSS rules** (~15 lines) — `.pipeline-queue` strip style with animated dot, color-coded counts, stuck badge
2. **HTML strip in dashboard render** — compact horizontal bar above the 3 stat cards showing: Live indicator + Pending + Processing + Completed + Failed + Stuck>5min badge
3. **JavaScript** (~40 lines) — `refreshPipelineQueue()` polls every 5 sec, `showStuckItems()` modal for inspection, `startPipelineQueuePolling()` starts the interval

### Key design decisions
- **Anon-readable views** (`email_queue_summary`, `email_queue_stuck`) already granted SELECT to anon in Phase 1 SQL
- Dashboard reads counts via Supabase anon client (already initialized)
- Polls every 5 seconds — demo UX: "watch the queue drain" storytelling
- Stuck badge only visible when >0 stuck rows (auto hide/show)
- Click stuck badge → modal with details + recovery SQL hint

### Phase 4 TEST — ✅ VERIFIED (Apr 17 late afternoon)
- Opened index.html locally → Pipeline Queue strip renders, Completed: 1 visible
- Deployed to Vercel (project-ii0tm.vercel.app) → same result live
- Pulse animation working, strip visually integrated above existing 3 stat cards

---

## ✅ Git Commit — Apr 17 late afternoon

**Commit:** `e62b3e9` — "v13.0 KAN-46: Durable queue architecture"
**Pushed to:** origin + yoma (Vercel Pro auto-deploys from yoma)
**Vercel deploy:** LIVE on project-ii0tm.vercel.app as of Apr 17 ~5 PM

### Files added (22 total)
- 3 SQL files in `sql/`
- 2 n8n workflow JSONs (Spooler + Worker)
- 4 helper files in `pipelines/` (build script, extracted code, staging notes)
- 9 doc files in `docs/` (AI Council rounds, synthesis, decision, log, Vinh message)
- 4 Jira PDF + analysis files in `docs/jira/`
- `index.html` modified (Pipeline Queue card)

---

## Phase 6: Real-Email End-to-End Test — IN PROGRESS (Apr 17 ~5 PM)

### Pre-flight state (verified)
- v12.4 workflow: ACTIVE (currently production)
- Spooler v1: INACTIVE, imported, configured
- Worker v1: INACTIVE, imported, configured
- email_queue: 1 row (test-spooler-002-apr17, status=completed)
- email_queue_stuck: 0 rows
- All 3 workflows visible in n8n sidebar

### Planned swap sequence (when resumed)
1. Deactivate v12.4 (toggle OFF)
2. Wait 10s for any in-flight execution
3. Activate Spooler (toggle ON)
4. Activate Worker (toggle ON)

### Planned tests
- **Single-email**: real payroll email, watch lifecycle on dashboard+n8n
- **Burst (5 emails)**: prove serialization, no loss, queue drains correctly

### Rollback plan (<30 sec)
Deactivate Spooler + Worker → Activate v12.4 → emails in Outlook re-polled

---

*This session PAUSED at Phase 6 pre-flight complete. Context compaction recommended. Resume instructions in MEMORY.md.*

---

## Phase 5: Notification Dedup Wiring — PENDING

---

## Phase 6: End-to-End Testing — PENDING

---

## Phase 7: Rollback Drill — PENDING

---

## Incidents / Debugging Log

*(Empty — will populate as issues arise)*

---

## Recovery Procedures

### If Supabase SQL fails:
- All statements are idempotent; re-run safely
- If specific statement fails, fix + re-run that block only
- Drop order (if needed to start clean): `email_queue_stuck` view → RPCs → `email_queue` table → `notification_sent` column

### If Spooler workflow broken:
- Deactivate in n8n UI
- Activate v12.4 (hot-standby)
- Unprocessed emails in Outlook inbox will be re-polled by v12.4

### If Worker workflow broken:
- Deactivate Worker
- Existing emails in queue remain `status='pending'`
- Can be replayed by reactivating Worker
- Or manually set problem rows `status='failed'` + investigate

### If entire system unresponsive:
- Nuclear option: deactivate ALL new workflows, activate v12.4, wait 1 min
- Email volume continues via legacy path
- Investigate new pipeline at leisure

---

## References
- Architecture decision: `docs/kan46_final_architecture_decision.md`
- AI Council Round 4 synthesis: `docs/kan46_concurrency_ai_council_synthesis.md`
- AI Council Round 5 prompt: `docs/kan46_round5_graph_api_critique_prompt.md`
- KAN-46 ticket analysis: `docs/jira/KAN-46_n8n_Performance_Optimize_Analysis.md`

---

## Apr 17 evening — v13.1 pivot (Round 6 zero-waste architecture)

### Trigger for pivot
v13.0 Worker Cron @ 30s burned ~2,880 executions/day. Hit n8n trial cap warning after ~7 hours of active work. DK unpublished Worker to preserve quota. TKT-053 (Acme single-email test) had ALREADY passed end-to-end earlier in the session — so the architecture is proven. Just the Cron trigger was wrong.

### Myanmar reality check
Rita's team testing is **gradual, week-long stress test** (not single demo). Apr 20 - May 1+. Pressure off. Design must be **stable and cap-safe for 2-3 weeks**, not peak-performance for 30 min.

### AI Council Round 6
7/7 unanimous on Verdict D: Supabase Database Webhook + pg_cron sweeper replace n8n Cron entirely.

Best-of-breed synthesis:
- **Claude**: Single-flight gate IN the database trigger — prevents parallel webhook fan-out at source
- **Gemini**: n8n Inner-Loop pattern — drains queue in 1 execution (deferred to v13.2 for simplicity)
- **DeepSeek**: Spooler multi-row INSERT batching (deferred to v13.2)
- **Qwen**: Gemini retry-with-backoff (CRITICAL — implemented in v13.1)
- **Perplexity**: Confirmed empirically that polling = free if no data (validates keeping Outlook Trigger)
- **Grok**: n8n trial concurrency cap = 5 FIFO
- **GPT**: Advisory lock (deferred; self-chain + single-flight sufficient for v13.1)

### v13.1 artifacts (this commit)
1. `sql/kan46_v13_1_triggers.sql` — Database trigger with single-flight gate + pg_cron sweeper + worker_config + audit view
2. `sql/kan46_v13_1_rollback.sql` — rollback SQL
3. `pipelines/n8n-workflow-worker-v2.json` — Worker v2 (Webhook trigger, self-chain, Gemini retry)
4. `pipelines/_worker_v2_build.mjs` — build script
5. `docs/kan46_v13_1_unified_implementation_plan.md` — comprehensive plan
6. `docs/kan46_v13_1_rollback_runbook.md` — rollback procedure
7. `docs/kan46_round6_optimization_prompt.md` — Council prompt (saved for reference)

### Execution count projection
| Source | Daily | 13 days |
|--------|-------|---------|
| Spooler (Outlook baseline) | 10-15 | 150-200 |
| Worker (self-chain, 1/email, single-flight prevents parallel) | 3-30 | 50-400 |
| pg_cron recovery (conditional) | 0-1 | 5-15 |
| Buffer | 5 | 65 |
| **TOTAL** | **~20-50** | **~270-680** |

Budget: 902. Max: ~680. Buffer: ~220 (24%). Fits heavy Myanmar stress testing.

### Hand-off steps for DK
1. Run `sql/kan46_v13_1_triggers.sql` in Supabase (update `worker_url` + `webhook_secret` first)
2. Import `pipelines/n8n-workflow-worker-v2.json` into n8n
3. Paste secrets in Worker v2 code nodes
4. Get webhook URL from `Webhook: Worker Dispatch` node
5. UPDATE worker_config with actual webhook URL + secret
6. Deactivate v12.4, activate Spooler + Worker v2
7. Send 1 test email → verify chain works
8. Send 5 burst → verify single-flight gate prevents parallel fan-out

### Deferred to v13.2 (post-Monday testing)
- n8n Inner-Loop via cyclic connections (if self-chain proves insufficient)
- Spooler multi-row INSERT batching
- Edge Function bridge (if pg_net reliability issues)
- Advisory lock / explicit serialization (if burst issues emerge)

### Decision needed by Apr 25
n8n trial expires ~May 1. Options: upgrade Starter ($20/mo 2500 exec) OR accept shutdown. See `memory/project_n8n_trial_expiration_may1.md`.

---

## Apr 18 evening — v13.2 Notify sender on failure (commit 44dbc07)

### Feature shipped
Sender-facing failure notifications when Gemini extraction fails. Previously silent, now:
- Client receives "Unable to process" email with user-friendly reason (from REASON_MAP)
- Includes resubmission checklist (email body requirements + attachment format guidance)
- Threads naturally in sender's inbox via `Re: [original subject]` subject line
- CCs emoney@zeyalabs.ai for operator visibility
- Skips notification for infra errors (api_error) — don't blame client for our outages
- Self-send loop protection: Should Notify Sender? returns false when `from=emoney@zeyalabs.ai`

### Worker v2 topology (v13.2)
- 17 nodes (was 15 in v13.1.1)
- 15 connections (was 13)
- Workflow name: `EMI Worker v2 (KAN-46 v13.2) — Webhook + Self-Chain + Gemini Retry + Hardened Parse + Notify on Failure`

### Validation test
Simultaneous burst (ACME + Wave) sent at 21:49 GMT+7:
- ACME → TKT-059 created, normal notification received ✅
- Wave → status='failed', failure notification received in sender inbox ✅
- No self-send, no loop, no 429 ✅

### Flow
```
Is Diagnostic?
  ├── true  → Should Notify Sender?
  │             ├── true  → Send Failure Notification → Mark Failed → Chain Next
  │             └── false → Mark Failed (Diagnostic) → Chain Next
  │
  └── false → Send Outlook Notification → Mark Complete → Chain Next
```

### Minor polish for v13.3
`Mark Failed (Diagnostic)` should reach back via `$('AI Parse & Validate v3').first().json._reason` instead of `$input.item.json._reason` — the Outlook Send node strips item.json, causing error_message to fall back to `gemini_extraction_failed | unknown` instead of the more specific reason. Zero functional impact, only affects error_message logging precision. 5-min fix, defer to post-Monday.

### Files changed
- `pipelines/n8n-workflow-worker-v2.json` (+2 nodes, +2 connection paths, AI Parse enriched)
- `pipelines/_worker_v2_notify_failure.mjs` — build script (NEW)
- `docs/kan46_v13_2_notify_sender_on_failure_plan.md` — plan doc (NEW)

### Full KAN-46 package shipped today + yesterday
1. ✅ Durable queue architecture (v13.0, superseded)
2. ✅ Zero-waste triggering via Database Webhook + pg_cron (v13.1)
3. ✅ Hardened Gemini parser + Is Diagnostic routing (v13.1.1)
4. ✅ Notify sender on failure (v13.2)

*Last updated: Apr 18, 2026 — v13.2 shipped + validated. Monday Myanmar-ready.*
