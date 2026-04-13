# Apr 13 Hardening Completion Plan

**Date created:** April 13, 2026 (~11:45 AM)
**Context:** Schema refactoring + storage hardening landed this morning. This plan completes the remaining hardening tasks before Apr 19/20 go-live.
**Author:** DK + Claude
**Status:** APPROVED, awaiting execution

---

## Background

This morning we shipped:
- Schema refactoring (5 normalized tables + VIEW)
- Storage privacy + signed URLs + inline PDF preview
- RLS policies on 6 tables
- Backfilled 13 attachment URLs to paths

Outstanding from morning sprint:
- Pipeline v9 code shipped but NOT activated in n8n
- Webhook authentication code shipped but NO secret set on Vercel
- Pipeline still has confusing dual-trigger naming (Outlook + Webhook)
- Dashboard write paths (finance approve, employee upload, etc.) untested vs new schema
- No idempotency check (n8n retry could create duplicate tickets)

## Strategic Context

- **Apr 19 (Sat) demo / Apr 20 (Mon) soft go-live** — Rita's expectation
- **Fake data only** until enterprise infra ready (Vinh + Minh confirmed)
- **Tin's S3-compatible API setup** deferred to post Apr 20 (DK confirmed in Teams)
- **Dong (UI dev) starting** today but in another project meeting first

---

## Pending Tasks Summary

| # | Task | Code Status | Activation Status | Risk |
|---|------|-------------|------------------|------|
| 1 | Pipeline v9 (attachment count fix) | ✅ Code shipped | ❌ Not in n8n | LOW |
| 2 | Webhook authentication | ✅ Code shipped | ❌ No secret set | LOW |
| 3 | Pipeline naming clarity (Outlook vs Webhook) | ❌ Not done | N/A | ZERO |
| 4 | Write-path testing | N/A (testing only) | ❌ Not tested | DETECTS issues |
| 5 | Webhook idempotency | ❌ Not coded | ❌ Not deployed | LOW |

---

## Phase 1: Pipeline Cleanup (~15 min, ZERO risk)

**What:** Update v9 JSON to clearly name both trigger nodes + add documentation sticky note.

**Changes:**
- Outlook Trigger → "INTAKE: Outlook Mailbox (production)"
- Webhook Trigger → "INTAKE: Manual Test (POST JSON for testing)"
- Add sticky note explaining the two paths

**Risk:** ZERO — cosmetic only, doesn't change behavior
**Rollback:** Discard v9 changes, re-clone from v8

---

## Phase 2: Webhook Secret Activation (~30 min, LOW risk)

**Order matters. Follow EXACTLY this sequence to avoid downtime:**

### Step 2.1: Generate secret
- Generate random 32-char string (Claude will provide one)
- Save to password manager FIRST (1Password, Bitwarden, etc.)

### Step 2.2: Add secret to v9 in n8n (don't activate yet)
- Import v9 JSON to n8n Cloud
- Open Parse & Validate v3 node
- Replace `REPLACE_WITH_WEBHOOK_SECRET` with the secret
- Save workflow but DO NOT activate

### Step 2.3: Activate v9, deactivate v8
- In n8n: deactivate v8 first
- Activate v9
- Now v9 sends secret with every webhook call
- Webhook still ACCEPTS calls without secret (env var not set yet) — safe state

### Step 2.4: Verify v9 works WITHOUT secret enforcement
- Send test email to emoney@zeyalabs.ai
- Confirm new ticket created normally
- Confirm notification email arrives with clean URL

### Step 2.5: Add WEBHOOK_SECRET env var to Vercel Pro
- Vercel Dashboard (project-ii0tm) → Settings → Environment Variables
- Add `WEBHOOK_SECRET` = the secret from Step 2.1
- Apply to Production
- Trigger redeploy (or wait for next git push)

### Step 2.6: Verify enforcement
- Send another test email
- Should still work (v9 sends secret, webhook accepts)
- Verify a curl test WITHOUT secret returns 401:
  ```bash
  curl -X POST https://project-ii0tm.vercel.app/api/webhook \
    -H 'Content-Type: application/json' \
    -d '{"company":"hacker"}'
  # Expected: 401 Unauthorized
  ```

**Risk:** LOW. The order ensures no window where webhook rejects v9's calls.

**Rollback paths:**
- v9 broken? Reactivate v8 in n8n
- Webhook rejecting? Remove WEBHOOK_SECRET env var, redeploy
- Wrong secret? Update Vercel env var, n8n auto-uses new value on next call

---

## Phase 3: Write-Path Testing (~1 hr, DETECTS issues)

**What:** Verify dashboard write actions actually save to `tickets_v2` correctly.

**Test ticket:** Use TKT-019 (Yangon Harbor) — already has rich data, low-stakes for testing.

### Test cases (with SQL verification queries)

**Test 1: Finance Approval**
- Action: Click "Approve" button on Finance page for TKT-019
- Verify SQL:
  ```sql
  SELECT finance_status, finance_approved_by, finance_approved_at
  FROM tickets_v2 WHERE ticket_number = 'TKT-019';
  ```
- Expected: `finance_status = 'APPROVED'`, name + timestamp filled

**Test 2: Employee List Upload**
- Action: Upload sample CSV (use `samples/sample_employees.csv`)
- Verify SQL:
  ```sql
  SELECT prechecks_done, employee_data, total_employees, employee_total
  FROM tickets_v2 WHERE ticket_number = 'TKT-019';
  ```
- Expected: `prechecks_done = true`, `employee_data` populated as JSONB array

**Test 3: Sent to Checker**
- Action: After finance approval, click "Send to Checker"
- Verify SQL:
  ```sql
  SELECT sent_to_checker, files_prepared, status
  FROM tickets_v2 WHERE ticket_number = 'TKT-019';
  ```
- Expected: `sent_to_checker = true`, status reflects READY_FOR_CHECKER or similar

**Test 4: Checker Action**
- Action: As Checker role, approve the disbursement
- Verify SQL:
  ```sql
  SELECT checker_name, checker_request, disbursing
  FROM tickets_v2 WHERE ticket_number = 'TKT-019';
  ```

**Test 5: Group Mapping (OTC only)**
- Action: For an OTC ticket, perform group mapping
- Verify SQL:
  ```sql
  SELECT mapping_in_progress, mapping_complete
  FROM tickets_v2 WHERE ticket_number = 'TKT-XXX';
  ```

**Test 6: Closing**
- Action: Click "Close Case"
- Verify SQL:
  ```sql
  SELECT closed, monitor_results
  FROM tickets_v2 WHERE ticket_number = 'TKT-019';
  ```

**Test 7: Activity log entries**
- Verify each action created an entry:
  ```sql
  SELECT action, message, created_at FROM activity_log
  WHERE ticket_id = 'TKT-019' ORDER BY created_at DESC LIMIT 10;
  ```

**Risk:** Doesn't deploy anything. Read-only verification + actions on isolated test ticket.

**Rollback:** N/A (test only). If a write fails → bug found → fix and retest.

---

## Phase 4: Webhook Idempotency (~30 min, LOW risk)

**What:** Webhook checks if `message_id` already exists in `ticket_emails` before creating new ticket. If yes → return existing ticket_id without creating duplicate.

**Why:** If n8n retries a webhook call (network blip, transient error), we currently create duplicate tickets. Cheap insurance.

**Code change:** Add ~15 lines to `api/webhook.js` BEFORE the insert:

```javascript
// Idempotency check: if message_id already processed, return existing ticket
if (data.message_id) {
  const { data: existingEmail } = await supabase
    .from('ticket_emails')
    .select('ticket_id')
    .eq('message_id', data.message_id)
    .maybeSingle();

  if (existingEmail) {
    const { data: existingTicket } = await supabase
      .from('tickets_v2')
      .select('ticket_number')
      .eq('id', existingEmail.ticket_id)
      .single();

    return res.status(200).json({
      success: true,
      ticket_id: existingTicket.ticket_number,
      idempotent: true,
      message: `Already processed email ${data.message_id}`,
      dashboard_url: `https://project-ii0tm.vercel.app/?ticket=${existingTicket.ticket_number}`
    });
  }
}
```

**Risk:** LOW. Additive logic — if check fails (e.g., `message_id` is null), falls through to normal create flow.

**Rollback:** Revert the commit (~30 sec).

**Test:**
- Send a test email
- Have n8n manually re-execute the same email
- Should NOT create a second ticket
- Webhook response should include `idempotent: true`

---

## Total Time Estimate

| Phase | Time |
|-------|------|
| 1. Pipeline cleanup | 15 min |
| 2. Secret activation | 30 min |
| 3. Write-path testing | 60 min |
| 4. Idempotency | 30 min |
| **Total** | **~2hr 15min** |

If start ~11:45 AM, done by 2:00 PM with noon rest in between.

---

## Recovery Strategy (Per Phase)

| Phase | If It Breaks | Recovery Time |
|-------|--------------|---------------|
| 1 | Re-clone v8 → v9 | 1 min |
| 2 (v9 broken) | Reactivate v8 in n8n | 1 min |
| 2 (webhook broken) | Remove env var on Vercel | 2 min (redeploy) |
| 3 | Find bug, fix, retest | varies |
| 4 | Revert webhook commit | 2 min (redeploy) |

**Ultimate fallback:** Old `tickets` table is STILL untouched. Can switch `tickets_flat` → `tickets` in `loadState()` for ~5 min nuclear rollback.

---

## What We're NOT Doing Today

| Item | Why Defer | When |
|------|-----------|------|
| S3-compatible API migration | Tin's plan, post Apr 20 (DK confirmed) | Week of Apr 21-25 |
| Multi-attachment pipeline | Spec needed, ~2 hrs work | Post go-live |
| Multi-email threading | Complex, low priority | Post go-live |
| Drop old `tickets` table | Safety net until prod-verified | Post go-live + 1 week |
| NextJS migration | KAN-26 | Post go-live, with Dong |
| Gemini 3.0 upgrade | Tin mentioned for accuracy | Post go-live |
| UI/UX polish | Dong's domain | Once Dong is free |

---

## Decision Points (Captured)

DK approved this plan with the following decisions:
1. **Phase order:** 1 → 2 → 3 → 4 (cleanup, security, validation, insurance)
2. **Idempotency:** Include (defensive code worth 30 min)
3. **Write-path testing depth:** All 7 test cases (don't skip)
4. **Noon rest:** Take 1 hour at noon, no work tonight

---

## Long-Term Tracking

This plan completes the **stabilization sprint** that started Apr 12. Reference parent plan: `Plan_Stabilization_Hardening.md`.

**After Apr 13 completes:**
- Apr 14-18: Holiday week. Light touch only. Receive specs from Win/Thet/Rita.
- Apr 19: Final rehearsal day
- Apr 20: Soft go-live (fake data, real eyes)
- Apr 21+: Real client data. Switch to S3 API. Monitor closely.

---

## File Artifacts

- This plan: `docs/Plan_Apr13_Hardening_Completion.md`
- Parent plan: `docs/Plan_Stabilization_Hardening.md`
- Manual steps: `docs/Manual_Steps_Apr13.md`
- DB scripts: `db/02-10_*.sql` (numbered execution order)
- Pipeline: `pipelines/n8n-workflow-v9.json`
- Webhook: `api/webhook.js` (v2, normalized schema)
- Legacy webhook: `api/webhook-legacy.js` (kept as backup)
