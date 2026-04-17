# KAN-46 — n8n Performance Optimize: Deep Analysis

**Ticket:** [KAN-46](https://yoma-bank.atlassian.net/si/jira.issueviews:issue-html/KAN-46/KAN-46.html) — [eMoney] n8n Performance Optimize
**Status:** IN PROGRESS — analysis phase (Vinh updated Apr 17)
**Assignee:** DK · **Reporter:** Vinh Nguyen · **Priority:** High
**Created:** Apr 16, 2026 · **Last refined:** Apr 17 (stakeholder meeting discussion)

---

## Verbatim Requirement

> Pipeline need to handle payroll email one by one, first come first serve, not proceed everything at the same time, this will reduce the risk of killing our pipeline due to too many request are being proceed

---

## Business Context (Apr 17 stakeholder meeting — Minh + Vinh + DK)

**Real-world scenario Vinh worried about:** 25 clients firing payroll emails **simultaneously** to `emoney@zeyalabs.ai`.

**Stakeholder positions:**
- **Minh's position:** Even with 25 concurrent emails, pipeline MUST handle them successfully. Outlook acts as a queue natively; n8n should preserve that guarantee.
- **Rita's allowance:** Pragmatically OK to reject if email has >5 attachments (becomes KAN-47) OR if >25 emails fire simultaneously. Reduces system stress acceptably.
- **DK's real-world observation:** In practice, when >1 email fires rapid-fire, n8n often only completes 1 successfully — others are half-done or fail silently. This is the lived experience that motivates the ticket.

**Alignment:** Minh's position and Rita's allowance are NOT in conflict — ship both. Rita's rejection = defense at boundary. Minh's optimization = robustness inside the boundary.

---

## Conceptual Disambiguation (important — stakeholders sometimes conflate these)

| Concept | What it actually is | Fixes what |
|---------|---------------------|------------|
| **One-at-a-time (concurrency = 1)** | Only one execution of the workflow runs at any moment | Resource contention, Gemini rate limits, race conditions |
| **FIFO** | Process items in arrival order | Audit trail integrity, preserves client priority |
| **Queuing** | Buffering mechanism for waiting items; enables the above | Implementation layer |
| **Batching / Filtering** | Cap how many items a single execution processes (e.g., max 25 per poll) | Execution timeout on huge inboxes — ORTHOGONAL to concurrency |
| **Rejection filter** | Drop oversized requests at the gate (>5 attachments, >25-burst) | Defense at boundary |
| **Rate limiting** | Artificial delays between items (e.g., 2s gap) | Gemini quota safety |

**Key insight:** FIFO + one-at-a-time + queuing are three aspects of the SAME solution. Batching is a DIFFERENT solution to a DIFFERENT problem (execution timeout, not concurrency).

---

## Root Cause Analysis of "n8n crashes on >1 rapid email"

DK's observed failure pattern is **NOT a queue problem** — it's concurrency + resource contention:

1. Poll 1 fires with email A → execution A starts
2. Poll 2 fires ~10 sec later with email B → **second execution B starts in parallel** (default n8n behavior)
3. Both executions call Gemini simultaneously → rate limit hit (429 error) → one fails
4. Both executions run pure JS inflateRaw for XLSX → memory spike on n8n Cloud's constrained container
5. One execution crashes or returns partial result; notification bounce only fires from surviving execution

**Fix: concurrency = 1 eliminates this root cause.** No batching needed to fix this specific symptom.

---

## Why this matters (expanded)

1. **Gemini API rate limits** — concurrent calls may hit quota (RPM/TPM limits)
2. **n8n Cloud execution limits** — trial/starter plans have execution concurrency caps
3. **Pipeline reliability** — one bad email shouldn't cascade-fail other executions
4. **Resource contention** — pure JS inflateRaw for XLSX + Gemini calls = CPU + memory per execution
5. **Webhook ordering** — dashboard should receive tickets in arrival order for audit trail
6. **Half-completed tickets** — observed today: only 1 of N rapid-fire emails produces full notification + ticket

---

## Current Behavior (v12.4 — confirmed Apr 17)

- **Outlook Trigger** polls `emoney@zeyalabs.ai` at **Every Minute** (confirmed via UI screenshot)
- Each poll can return **multiple emails** if several arrived between polls
- Our `Prepare for AI v3` uses `mode: "runOnceForEachItem"` — each email is a separate invocation within one execution
- If poll 1 is still executing when poll 2 fires, n8n **starts a second execution in parallel**
- Pipeline per-email execution time: 30-120 sec (simple 20-30 sec, XLSX+Gemini vision 90-120 sec)
- **Math:** 1-min poll + 60-120 sec execution = **guaranteed parallel executions whenever >1 email arrives**
- **This IS the root cause of DK's observed "only 1 of N emails succeeds" pattern**

---

## Confirmed n8n Cloud Constraints (Apr 17 UI investigation)

**NOT AVAILABLE on our n8n Cloud trial plan:**
- ❌ Workflow Settings UI has NO "Execute only one instance at a time" toggle
- ❌ Outlook Trigger node has NO "Limit" option (can't cap emails per poll)
- ❌ Outlook Trigger node has NO "Mark as Read" UI option exposed
- ❌ `maxExecutionConcurrency` workflow JSON setting is not documented for Cloud (untested but likely stripped)
- ❌ Enterprise Queue Mode not available on trial

**AVAILABLE workflow settings (from screenshot):**
- Execution Logic (v1 recommended — already set)
- Error Workflow
- Timezone
- Save executions (failed/successful/manual/progress)
- Timeout Workflow (toggle — off by default)
- Estimated time saved

**AVAILABLE Outlook Trigger filters (from screenshot):**
- Filter Query (server-side Microsoft Graph filter expression)
- Has Attachments
- Folders to Exclude
- Folders to Include
- Read Status
- Sender

**Critical finding:** `Read Status` filter is available. If we can configure "only poll unread" + "mark as read AFTER processing succeeds", we could achieve at-least-once delivery semantics even with skip-based locking. Needs investigation.

---

## Data Loss Risk — StaticData Lock Ruled Out

**Why staticData lock with skip pattern doesn't work:**

When n8n's Outlook Trigger fires, it **consumes** the emails it fetches. If we then SKIP them via a concurrency lock, **those emails are permanently lost** — next poll won't re-fetch because Outlook already marked them processed.

This rules out Option 3 (staticData lock with skip) from the original analysis **unless** we pair it with a retry queue persisted somewhere (Supabase staticData, Supabase table, etc.).

---

## Solution Options

### Option 1: n8n Execution Settings (simplest)

n8n workflows have a setting: **"Execute only one instance at a time"** (also called "Singleton mode" or concurrency limit).

- **Where:** Workflow Settings → Execution → "Execute only one instance at a time"
- **Effect:** If execution A is running when trigger fires again, execution B waits in queue
- **Pros:** Zero code changes. Built-in n8n feature. FIFO guaranteed.
- **Cons:** May not be available on all n8n Cloud plans. Need to verify.

**Effort: 5 minutes** (toggle a setting)

### Option 2: n8n Concurrency Control (workflow-level)

n8n v1.x+ has `settings.executionOrder` and concurrency configurations:
```json
{
  "settings": {
    "executionOrder": "v1",
    "maxExecutionConcurrency": 1
  }
}
```

- **Pros:** Declarative, in the workflow JSON
- **Cons:** `maxExecutionConcurrency` may only be available in n8n self-hosted or enterprise

**Effort: 10 minutes** (add to workflow JSON + re-import)

### Option 3: Application-level queue with staticData

Use `$getWorkflowStaticData('global')` as a distributed lock:
```javascript
const state = $getWorkflowStaticData('global');
if (state.processing) {
  // Another execution is running — re-queue or skip
  return []; // skip this batch, next poll will pick them up
}
state.processing = true;
// ... process emails ...
state.processing = false;
```

- **Pros:** Works on any n8n plan. Custom control.
- **Cons:** Race condition between check-and-set (not atomic). If execution crashes, lock is stuck (needs TTL). More complex. Fragile.

**Effort: 1-2 hours** (implement + test + handle edge cases)

### Option 4: Rate limiting at Prepare node level

Add deliberate delays between items:
```javascript
// Process items one at a time with delay
for (const item of items) {
  await processItem(item);
  await new Promise(r => setTimeout(r, 2000)); // 2s gap between items
}
```

- **Pros:** Simple. Reduces API burst.
- **Cons:** Doesn't prevent concurrent executions. Only helps within-execution rate limiting. Increases total execution time (may hit n8n timeout).

**Effort: 30 minutes**

### Option 5: External queue (overkill for now)

Use an external queue (SQS, Redis, Supabase queue) — pipeline writes to queue, separate worker processes one at a time.

- **Pros:** Production-grade. Retry, dead-letter, monitoring.
- **Cons:** Massive over-engineering for current volume. New infrastructure. Cost.

**Effort: Days** — not appropriate for current phase.

---

## Recommended Layered Architecture (Apr 17 refined)

Instead of picking ONE option, ship multiple layers of defense. Each layer solves a distinct problem. Start with L1 (biggest impact, lowest effort), add L3+L4 for robustness, defer L5+L6.

| Layer | What | Solves | Effort | Priority |
|-------|------|--------|--------|----------|
| **L1** | Execution concurrency = 1 (Option 1 or 2) | Root cause of crashes — parallel executions | 5-30 min | **MUST SHIP** — 80% of the fix |
| **L2** | FIFO ordering (inherited from L1 + Outlook native order) | Audit trail integrity | Free (inherited) | **MUST SHIP** |
| **L3** | Batch cap: max 25 emails per Outlook trigger poll | Single-execution timeout on huge inboxes | 15 min | **SHOULD SHIP** |
| **L4** | Rejection filter at entry: >5 attachments (KAN-47) + >25 burst (Rita's rule) | Explicit defense boundary | 30 min | **SHOULD SHIP** (pairs with KAN-47) |
| **L5** | Rate limiting between items (2s gap before Gemini call) | Gemini quota safety on consecutive calls | 15 min | **NICE-TO-HAVE** (add if monitoring shows need) |
| **L6** | Separate lightweight pipeline for heavy files (XLSX/PDF > 1MB) | Route-based load balancing | 4-8 hrs | **DEFER POST-GO-LIVE** — not needed yet |

### Execution order: L1 → L3 → L4 → (ship) → monitor → L5/L6 if needed

### Phase 1 (immediate, today): Ship L1 + L2 + L3

1. Check if "Execute only one instance at a time" is available on our n8n Cloud plan (L1)
2. If yes → toggle it on. Done.
3. If no → try adding `maxExecutionConcurrency: 1` to workflow JSON (Option 2)
4. If neither works on Cloud → fall back to staticData lock (Option 3)
5. In Outlook trigger: set `limit: 25` or equivalent (L3)

### Phase 2 (pair with KAN-47 work): L4

Add entry-level rejection for >25 emails in 1 minute window (burst detection via staticData timestamps) and >5 attachments (via KAN-47's attachment count logic).

### Phase 3 (post go-live monitoring): L5/L6 if needed

- Track execution times and concurrency in n8n execution log
- If Gemini 429 errors appear → add L5 rate limiting
- If volume grows beyond ~50 emails/day with heavy XLSX → consider L6 split

---

## Open Questions (refined after Apr 17 discussion)

1. ~~**Expected volume:**~~ → **Answered.** Stakeholders worry about 25 concurrent burst. Normal volume likely 5-15/day but must handle bursts.

2. **Acceptable latency during burst:** If 25 emails arrive and process one-at-a-time at ~20 sec each, that's 8 min total for the last email. Is this OK for business? → **Need Vinh/Rita confirmation.**

3. **Burst detection window:** Rita's "25 emails fired simultaneously" — what time window counts as "simultaneously"? 1 minute? 5 minutes? 1 hour? → **Need Vinh clarification.**

4. **Rejection during burst:** If email #26 arrives during a burst, do we:
   - (a) Reject immediately with "system busy, try again in X minutes" email?
   - (b) Queue it anyway and process eventually?
   - → **Need Vinh clarification.**

5. **Failure handling:** If one email in the queue fails processing, should the queue continue with the next? Or halt and alert? → Assume continue (default).

6. **Priority emails:** Are all payroll emails equal priority? Or should some companies/amounts get priority processing? → Assume FIFO, all equal (simplest).

---

## Effort Estimate

| Approach | Estimate | Confidence |
|----------|----------|------------|
| Option 1 (n8n setting) | 5-10 min | High if available on Cloud plan |
| Option 2 (JSON config) | 10-30 min | Medium — plan-dependent |
| Option 3 (staticData lock) | 1-2 hrs | Fallback — more fragile |
| Option 4 (rate limit) | 30 min | Supplemental only |
| Testing | 1-2 hrs | Send 3-5 emails rapidly, verify FIFO |
| **Total (expected)** | **30 min - 2 hrs** | Depends on which option works |

**Difficulty: LOW-MEDIUM** — if n8n's built-in concurrency control works, this is a config change. If not, the staticData lock pattern adds moderate complexity.

---

## Relationship to KAN-47 (was KAN-28 #4)

KAN-46 should ship BEFORE KAN-47. Reason: multi-attachment processing increases per-execution time (multiple Gemini calls per email). Without concurrency control, two multi-attachment emails arriving simultaneously could:
- Hit Gemini rate limits (10+ concurrent calls)
- Exceed n8n Cloud execution memory
- Produce race conditions in webhook/dashboard

**Recommended order: KAN-46 first → KAN-47 second.** KAN-47's L4 rejection filter (>5 attachments) pairs naturally with KAN-46's L4 burst rejection (>25 emails).

---

## Dependencies

- Verify n8n Cloud plan's concurrency features (Phase 1 discovery)
- Vinh's answer on acceptable burst-processing latency + rejection window
- Test with rapid-fire email submissions (5-25 emails in 1 minute)

---

## Progress Tracker

### Phase 1 — L1 (concurrency = 1)
- [ ] Open n8n Cloud → v12 workflow → Settings → check "Execute only one instance at a time" availability
- [ ] If available: toggle ON, save, export JSON
- [ ] If not: try `maxExecutionConcurrency: 1` in workflow JSON → re-import
- [ ] If neither: implement staticData lock with TTL (fallback)
- [ ] Commit v12.5 JSON with concurrency config

### Phase 2 — L3 (batch cap)
- [ ] Outlook trigger: set max emails per poll to 25
- [ ] Verify n8n processes 25 items sequentially within one execution (runOnceForAllItems)
- [ ] Commit

### Phase 3 — L4 (rejection filter)
- [ ] Implement >25 email burst detection (staticData timestamp queue, 1-min sliding window)
- [ ] Reject email #26 with rejection email template: "system busy, try again in N minutes"
- [ ] Coordinate with KAN-47's >5 attachment rejection (shared rejection path)
- [ ] Commit

### Testing
- [ ] Test: send 3 emails within 10 seconds, verify FIFO sequential processing (no parallel)
- [ ] Test: send email while another is processing, verify queuing behavior
- [ ] Test: send 25 emails in 1 minute, verify all process (may take 5-10 min)
- [ ] Test: send 26th email during 25-burst, verify rejection with instruction email
- [ ] Test: one email fails in queue, verify next email still processes
- [ ] Monitor execution logs for 24 hours

### Delivery
- [ ] Committed + pushed (both remotes)
- [ ] n8n v12.5 re-imported + activated
- [ ] Vinh + Minh notified via Teams with test results

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| Apr 17 | Ship layered defense, not one-option | Minh wants robustness, Rita allows rejection — layers accommodate both |
| Apr 17 | Defer L6 (separate pipeline) | Adds maintenance cost; not justified until monitoring shows need |
| Apr 17 | KAN-46 ships before KAN-47 | KAN-47's multi-attachment Gemini calls depend on concurrency control being in place |
| Apr 17 | **StaticData lock RULED OUT** | Skipping = email loss (Outlook marks consumed on trigger fire) |
| Apr 17 | **AI Council Round 4 initiated** | Paralysis in choosing between Path A/B/C. Need external perspectives on out-of-the-box solutions before committing. Council prompt: `docs/kan46_concurrency_ai_council_prompt.md` |

---

## Open Paths (pending AI Council Round 4)

**Path A — Pragmatic compromise:** Change poll to 3 min + idempotency guard. Ship today.
- ✅ Low risk, fast to implement
- ❌ Demo UX suffers (3 min wait during live demo)

**Path B — Parallel-safe pipeline (Minh's ask):** Accept parallel executions, harden pipeline.
- ✅ No latency hit, technically correct
- ✅ Idempotency on ticket creation via message_id
- ✅ Gemini retry with exponential backoff
- ❌ ~1 day of careful surgery, risk to v12.4 stability

**Path C — Supabase queue:** Vercel/n8n writes to queue table, separate worker processes FIFO.
- ✅ Correct long-term solution
- ❌ Multi-day, risky for Monday demo

**Path D (council may suggest):** Alternative architectures using Microsoft Graph delta queries, Supabase Realtime, Vercel Edge, etc.

---

*Last updated: Apr 17, 2026 — AI Council Round 4 phase*
