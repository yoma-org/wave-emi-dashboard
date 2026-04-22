---
name: KAN-47_v13_3_Implementation_Plan
aliases: ["KAN-47 v13.3 Implementation", "Multi-Attachment Implementation Plan"]
description: Comprehensive layer-by-layer implementation plan for KAN-47 (multi-attachment, all-or-nothing, side-by-side, human-in-loop). Covers n8n, Supabase, Vercel, dashboard, and webhook layers. Includes pre-flight checks, per-layer execution steps, per-layer smoke tests, rollback points, post-implementation verification matrix, and 17-item blind-spot checklist.
type: reference
topics: [kan47, implementation, n8n, supabase, vercel, dashboard, planning]
status: active
created: 2026-04-20
last_reviewed: 2026-04-20
---

# KAN-47 v13.3 Implementation Plan

> ## ⚠️ ARCHITECTURE CORRECTION — 2026-04-20 PM session
>
> **Discovered during Phase 0.3 pre-flight**: `tickets_v2` has NO `raw_payload` column. Schema is fully relational — multi-attachment support is ALREADY BUILT via `ticket_attachments` table + `ticket_vision_results.attachment_id` FK (see [sql/02_enhanced_schema.sql](../../sql/02_enhanced_schema.sql)). **Zero DB migration needed for v13.3.**
>
> ### Plan sections now obsolete (ignore while reading)
> - "ALTER TABLE to add schema_version column" (Layer A, Layer B) — SKIP, no schema change
> - "JSONB `raw_payload` absorbs new shape" — doesn't exist, ignore all references
> - "Deterministic `ticket_id` via sha1(message_id)" — REDUNDANT: existing webhook Step 0 check against `ticket_emails.message_id` already handles idempotency (5/5 Council convergence was technically right but missed that the pattern was already implemented)
> - Dispatch on `schema_version === 'v13.3'` — REPLACED by `COUNT(*) FROM ticket_attachments` (multi = count > 1)
>
> ### What still applies (no change)
> - Phase 1.5 Final Cutover (activation AFTER all layers live) — 4/5 Council consensus
> - Client-fail gate BEFORE system-fail gate — DeepSeek sharpest critique
> - All-or-nothing rejection with 3 triggers (password / unreadable / too-many)
> - smime / auto-attach pre-filter in Count Attachments
> - Storage path `{ticket_number}/{index}_{sanitized_filename}` — collision safety still true
> - Rollback drain protocol (wait for zero in-flight n8n execs before Vercel rollback)
> - 16-scenario test matrix
> - Gemini extraction schema validation (Qwen Q7)
> - n8n timeout verification in Phase 0.6
>
> ### Layer B is ALREADY IMPLEMENTED as of Apr 20 night
> Commit `9edba14` on `kan47-v13.3` branch ships the webhook change: unified per-attachment loop accepting both legacy `attachment_base64` single-shape and new `attachments: [...]` array-shape. Collision-safe storage paths. Per-attachment vision_results insert with correct `attachment_id` FK. Backward-compat preserved. Smoke test pending for Apr 21 morning.
>
> **Full discovery context**: see session log at `memory/project_kan47_implementation_log_apr20.md` CP-04 through CP-08.

---

> **Purpose**: depth that the mockup doesn't provide. This doc surfaces execution order, integration risk, logging/verification checkpoints, and the blind spots that only appear when you zoom in.
>
> **Companion docs**:
> - [KAN-47 Analysis](KAN-47_Handle_Email_5_Attachments_Analysis.md) — problem statement + options
> - [Mockup v3](../mockups/kan47_tabbed_ui_v3_mockup.html) — rendered end-state
> - [ADR-001..004](../../../decisions/) — architecture constraints we inherit

---

## Design principle (reminder)

**AI Assists, Human Decides.** Side-by-side over aggregation. All-or-nothing rejection for only 3 client-fail categories (password / unreadable / too-many). No `document_type` classification. No confidence-based rejection.

---

## Scope boundary

In-scope for v13.3:
- n8n Worker v2 → v13.3 (multi-attachment loop + classify outcome)
- Webhook payload schema update (`attachments[]`)
- Dashboard ticket detail: tabbed UI + multi-column side-by-side Summary + CSV source-picker
- Rejection templates 1-3 + combined

Out of scope (defer to v13.4 or later):
- Rejection rate-limit / abuse escalation
- Per-attachment re-extraction
- Myanmar-translated rejection templates
- Download-all-as-ZIP
- Graph API migration (blocked by Ryan regardless)

---

## Phase 0 — Pre-flight safeguards

Before touching code. Skipping these has cost us incidents before (see `memory/feedback_post_refactor_fk_audit.md`).

### 0.1 Git hygiene
- [ ] `git status` clean in `wave-emi-dashboard/` — commit or stash any WIP first
- [ ] Both remotes up to date: `git push origin main && git push yoma main`
- [ ] Current HEAD confirmed: `eb0b357` (v13.2 shipped state)
- [ ] Create a named tag for rollback anchor: `git tag v13.2-stable` and push to both remotes. If v13.3 goes sideways, `git checkout v13.2-stable -- <files>` is the escape hatch.

### 0.2 n8n state snapshot
- [ ] Export current Worker v2 workflow JSON from n8n UI — save as `pipelines/n8n-workflow-worker-v2-stable-eb0b357.json` (local backup only, don't commit)
- [ ] Note execution count baseline: current is `124/1000`. Expect +30-50 during testing.
- [ ] Confirm v12 rollback workflow is still in the n8n instance (inactive but present)
- [ ] Verify Outlook credential ID is stable (if DK re-auths, workflow breaks)

### 0.3 Supabase state snapshot
- [ ] Verify `worker_config` row still valid: `SELECT worker_url, LENGTH(webhook_secret) FROM worker_config;` — should be URL + 64-char secret
- [ ] Verify `on_email_queue_insert` trigger is enabled: `tgenabled='O'`
- [ ] Verify pg_cron job `worker-recovery-sweep` is active
- [ ] Confirm `tickets_v2` shape: `raw_payload` is JSONB (absorbs new shape automatically, **no schema migration needed**)
- [ ] Snapshot row counts (in case we need to detect dropped rows later):
  ```sql
  SELECT 'tickets_v2' AS t, COUNT(*) FROM tickets_v2
  UNION ALL SELECT 'email_queue', COUNT(*) FROM email_queue
  UNION ALL SELECT 'ticket_attachments', COUNT(*) FROM ticket_attachments
  UNION ALL SELECT 'activity_log', COUNT(*) FROM activity_log;
  ```
  Expected post-reset: 2 tickets (smoke tests TKT-001, TKT-002) + small activity log.

### 0.4 Vercel state
- [ ] Confirm both deploys are green: Pro (`project-ii0tm.vercel.app`) + Hobby (`wave-emi-dashboard.vercel.app`)
- [ ] Confirm preview branches work: push a no-op commit, see Vercel preview URL generated
- [ ] Confirm `api/webhook.js` is the only webhook endpoint (webhook-legacy already archived)

### 0.5 Gemini API budget
- [ ] Check Gemini API usage dashboard — current burn rate
- [ ] Gemini 3 Flash Preview rate limits: typically 1000 requests/day free tier, 60 RPM. 5 attachments × sequential = well within RPM. Daily cap is the worry.
- [ ] Stress-test plan: 6 scenarios × ~5 attachments avg = ~30 Gemini calls → 3% of daily budget. Fine.

### 0.6 n8n Cloud execution timeout verification ⚠️ Council Q5
- [ ] Look up actual timeout limit for current n8n Cloud trial plan (Qwen said 30s; DeepSeek said 60s)
- [ ] n8n UI → Settings → Workflows → Execution Timeout field OR test empirically with a sleep-loop Code node
- [ ] If 30s: retry budget is tight. Reduce Step 3 backoff to max 2 retries (1s+3s = 4s overhead per attachment). 5 attachments × 3s Gemini + 4s retry = 35s — still tight.
- [ ] If 60s: retry budget is comfortable. 5 attachments × 3s + 13s retry = 28s. Fine.
- [ ] Document actual limit in the workflow's description field for future reference

### 0.7 Test data pre-stage
This is often skipped and always bites back. **Before coding**:
- [ ] Collect or craft 6 test emails with attachment combos:
  1. Single attachment (regression — backward compat must hold)
  2. 2 attachments, all pass (NSK-like)
  3. 3 attachments mixed types (PDF + XLSX + PNG)
  4. 5 attachments (max boundary)
  5. 6 attachments (too-many reject)
  6. 3 attachments with 1 password-protected ZIP (password reject)
- [ ] Save test attachments as files in `wave-emi-dashboard/samples/kan47_test_fixtures/` (gitignored, DK local only if sensitive)
- [ ] Pre-write email drafts in Outlook so sending during test is one-click

### 0.8 Myanmar coordination
- [ ] Before v13.3 deploy: Teams message to Win + Wave Finance: *"We're shipping a small upgrade. Single-attachment tickets continue to work identically. New multi-attachment emails will now render with tabs. 15-min walkthrough when it's live."*
- [ ] Confirm they're NOT in the middle of a live disbursement when we switch
- [ ] Pick a low-traffic window for activation (Myanmar morning = our afternoon, typically quieter)

---

## Phase 1 — Layer-by-layer implementation

Order: Supabase (no change, just verify) → Webhook (forward-compatible) → n8n **build but keep INACTIVE** → Dashboard (UI) → **Phase 1.5 Final Cutover** (activate v13.3, deactivate v13.2 — this is the ONLY producer flip).

> **Round 1 Council correction (2026-04-20)**: Activation was originally inside Layer C Step 9 — 4 of 5 reviewers flagged this as creating a window where n8n emits new-shape payloads before Dashboard can render them. Activation is now a separate phase after ALL layers deploy. Receiver before producer.

Commit after each layer, smoke-test before proceeding.

### Layer A — Supabase

**Changes: none.** JSONB `raw_payload` absorbs the new shape without migration.

**Verification only**:
```sql
-- Confirm raw_payload can hold attachments[] array
INSERT INTO tickets_v2 (id, company, raw_payload)
VALUES ('TEST-JSONB', 'Test Co', '{"attachments":[{"name":"a.pdf"},{"name":"b.xlsx"}]}'::jsonb)
ON CONFLICT (id) DO NOTHING;

SELECT id, raw_payload->'attachments' FROM tickets_v2 WHERE id='TEST-JSONB';
DELETE FROM tickets_v2 WHERE id='TEST-JSONB';
```

**Commit**: none for this layer (no code changes).

### Layer B — Webhook (`api/webhook.js`)

Update the webhook to accept both legacy (single-payload) and new (`attachments[]`) shapes. Forward-compatible — deploy this first so n8n changes don't break on dashboard receiving end.

**Edit target**: `api/webhook.js`

**Change**: In the body parser, detect if `body.attachments` is an array and set schema_version marker:
```js
// Normalize payload shape
const isNewShape = Array.isArray(body.attachments);
const attachments = isNewShape
  ? body.attachments
  : [{ /* legacy single-attachment shape derived from top-level fields */ }];

const schema_version = isNewShape ? 'v13.3' : 'v13.2-legacy';
```

**Deterministic ticket_id** (idempotency per Council Q3): derive from `message_id`:
```js
const ticket_id = 'TKT-' + crypto.createHash('sha1')
  .update(body.message_id).digest('hex').slice(0, 12);
```

**Insert shape into tickets_v2** with ON CONFLICT for idempotency:
```sql
INSERT INTO tickets_v2 (id, company, raw_payload, schema_version, ...)
VALUES ($1, $2, $3, $4, ...)
ON CONFLICT (id) DO NOTHING;
```

- `raw_payload` = entire body (includes attachments[] + schema_version)
- `schema_version` column (NEW — add to tickets_v2 via ALTER): flag used by dashboard to dispatch render path
- Legacy top-level fields (company, amount, etc.) = copy from `attachments[0]` if no explicit top-level values

**Logging**: `console.log('[webhook] shape:', schema_version, 'ticket_id:', ticket_id, 'attachments:', attachments.length)`

**Smoke test after deploy**:
- [ ] POST a legacy-shape payload via curl → confirm ticket created, renders in dashboard single-view
- [ ] POST a new-shape payload with 2-item `attachments[]` via curl → confirm ticket created, `raw_payload` contains both items (dashboard not rendering multi yet — that's Layer D)

**Commit**: `fix(webhook): accept attachments[] payload with legacy fallback`

### Layer C — n8n Worker v2 → v13.3

Biggest risk layer. **Do NOT edit v13.2 in place**. Duplicate first.

**Step 1 — Duplicate workflow**
- [ ] In n8n UI: open Worker v2 → Settings → "Duplicate Workflow"
- [ ] Rename copy to: `EMI Worker v2 (KAN-47 v13.3) — Multi-Attachment + All-or-Nothing`
- [ ] Leave duplicate **INACTIVE**. v13.2 stays active during build.
- [ ] Export duplicate as JSON: `pipelines/n8n-workflow-worker-v3.json` — commit as a scaffolding baseline even before edits

**Step 2 — Add "Count Attachments" node (WITH pre-filter)**
- Insert after "Prepare for AI v3"
- Type: Code (JavaScript)
- **Pre-filter BEFORE counting** (Council Q6 — smime/auto-attach):
  ```js
  const SIGNATURE_MIMES = ['application/pkcs7-signature', 'application/x-pkcs7-signature', 'multipart/signed'];
  const MIN_SIZE = 5 * 1024;  // 5KB
  const effective = $json.attachments.filter(a =>
    !SIGNATURE_MIMES.includes(a.mime_type)
    && a.size_bytes >= MIN_SIZE
    && !a.is_inline  // content-disposition: inline
  );
  ```
- Purpose: reads filtered `effective` array, sets `$json.attachment_count = effective.length`, routes to reject-branch if > 5
- Exit: two outputs → "Is too many?" IF node → reject branch OR continue
- **Why**: Outlook auto-attaches smime.p7s; senders don't see these but our pipeline would classify as "unreadable" and false-reject. Filter removes them before they enter rejection logic.

**Step 3 — Convert single-extraction to loop (with schema validation + defer upload)**
- Replace the single Gemini call with a Code node that runs a JS for-loop:
  ```js
  const results = [];
  for (const att of $input.first().json.effective_attachments) {
    try {
      const extracted = await callGemini(att);  // inlined fetch to Gemini API
      // Council Q7 (Qwen) — validate schema even on HTTP 200
      if (!validateExtractionSchema(extracted)) {
        results.push({ filename: att.filename, outcome: 'system_fail', error: 'malformed_response' });
        continue;
      }
      const classified = classifyOutcome(extracted, att);
      // CRITICAL: do NOT upload to Supabase Storage here (Council Q5 — Claude)
      // Storage upload deferred to Step 7 only on happy path
      results.push({ filename: att.filename, raw_file_ref: att.tmp_ref, ...classified });
    } catch (err) {
      const isTransient = err.status === 429 || err.status >= 500 || err.name === 'TimeoutError';
      results.push({ filename: att.filename, outcome: isTransient ? 'system_fail' : 'client_fail', error: err.message });
    }
  }
  return { json: { ...$input.first().json, per_attachment_results: results } };
  ```
- **Why JS for-loop, not SplitInBatches**: keeps everything inside 1 n8n execution (trial-cap-safe)
- **Gemini retry with backoff**: 3 attempts on 429/5xx per attachment. **Phase 0 MUST verify n8n timeout (30s vs 60s)** — if 30s, reduce to 2 attempts with 1s+3s backoff only (Council Q5 — Qwen/DeepSeek)
- **Council Q5 (Claude) — defer storage upload**: do NOT upload files to Supabase Storage during extraction. Upload only after gates confirm happy path (Step 7). Prevents orphan files on rejection.
- **Council Q7 (Qwen) — validate extraction schema**: Gemini can return HTTP 200 with malformed JSON. Validate required fields present before classifying as "pass."

**Step 4 — Add "Gate: any CLIENT-fail?" IF node** ⚠️ **ORDER CRITICAL**
- Council Q7 (DeepSeek sharpest critique): this gate **MUST fire before** system-fail gate
- Condition: `{{ $json.per_attachment_results.some(r => ['password','unreadable'].includes(r.outcome)) }}`
- True → build combined rejection template → route to "Send Rejection Email" (extended)
- False → continue to system-fail gate
- **Why order matters**: If system-fail runs first, a password-protected file (permanent client error) gets masked when combined with a transient Gemini 429 — email retries indefinitely, client never learns about the password issue. Client errors are permanent; retrying won't help. Reject them FIRST.

**Step 5 — Add "Gate: any SYSTEM-fail?" IF node** (runs ONLY if no client-fail)
- Condition: `{{ $json.per_attachment_results.some(r => r.outcome === 'system_fail') }}`
- True → mark email_queue row as `pending_retry`, schedule sweeper to re-try (reuse ADR-002 pg_cron mechanism), stop execution
- False → continue to aggregate (happy path)

**Step 6 — Modify "Send Rejection Email" node**
- Extend subject/body to handle 3 templates + combined
- Switch logic based on `_skip_reason` field (reusing v12.2's pattern):
  - `too_many` → template 3
  - `combined` → build multi-issue message from `per_attachment_results`
  - `password` / `unreadable` / mixed → template 1/2 or combined

**Step 7 — Upload to Storage + Package Attachments Code node** (happy path only)
- Council Q5 (Claude): uploads happen HERE, not in Step 3. No orphan files on reject.
- Generate deterministic ticket_id (Council Q3 — 5/5 converged):
  ```js
  const ticket_id = 'TKT-' + crypto.createHash('sha1')
    .update($json.message_id).digest('hex').slice(0,12);
  ```
- Upload each attachment to Supabase Storage under `/{ticket_id}/{index}_{sanitized_filename}` (collision-safe per blind spot #6)
- Transform `per_attachment_results` into the webhook payload shape:
  ```js
  {
    ticket_id,  // deterministic from message_id
    message_id: $json.message_id,
    schema_version: 'v13.3',  // Council Q4 — dispatch flag
    company: $json.company,
    attachments: $json.per_attachment_results.map((r, i) => ({
      filename: r.filename,
      file_type: r.mime,
      extracted_data: r.parsed,
      confidence: r.confidence,
      storage_path: `/${ticket_id}/${i}_${sanitize(r.filename)}`
    }))
  }
  ```

**Step 8 — Webhook POST stays as-is** — Layer B already accepts this shape.

**Smoke test after each node addition (n8n's "Execute Node" feature)**:
- [ ] Count Attachments: paste mock input with 2 / 5 / 6 attachments → verify routing
- [ ] Loop: paste mock input with 2 attachments → verify both get processed, results array has 2 items
- [ ] System-fail gate: inject a simulated 429 → verify retry → verify escalation after 3 failures
- [ ] Client-fail gate: inject password outcome → verify rejection email with correct template
- [ ] Happy path: inject 2 clean attachments → verify webhook POST with `attachments[]` shape

**Step 9 — Export and commit v13.3 (still INACTIVE)**
- [ ] Only after all smoke tests green
- [ ] **Do NOT activate v13.3 yet** — activation is Phase 1.5 Final Cutover, after Layer D ships
- [ ] Re-export v13.3 JSON: `pipelines/n8n-workflow-worker-v3.json` (final state)
- [ ] Commit: `feat(n8n): v13.3 multi-attachment worker (inactive, awaiting cutover)`

### Layer D — Dashboard (`wave-emi-dashboard/index.html`)

Already the largest file in the repo (~2,800 lines). Add rendering functions without modifying `kan36RenderSideBySide()` (reused per-tab).

**Step 1 — Add `renderEmailPreview(ticket)`**
- Collapsible preview component (matches mockup v3 Section 2)
- ~60 lines of HTML string concat
- Shows From/To/Subject/Received/Attachments list + body

**Step 2 — Add `renderMultiColumnSBS(ticket)`**
- Takes ticket with `attachments[]`
- Builds table: Field / From Email / From Attachment 1 / ... / From Attachment N / Match
- Each row = a field (Total Amount, Pay Date, Requester, ...)
- Match column shows ✓ / ~ / — based on value presence
- ~150 lines

**Step 3 — Add `renderThreeWayMatchVisual(ticket)`**
- Amount cards grid — one per source (Email + each attachment)
- No PASS/FAIL assertion — just displays all amounts
- ~40 lines

**Step 4 — Add `renderAttachmentTabs(ticket)`**
- Tab strip: Summary + one tab per attachment
- Click handlers → swap tab-panel content
- State: `ticket._activeTab` (default: 'summary')
- ~80 lines

**Step 5 — Add `renderCSVSourcePicker(ticket)`**
- Modal dialog with radio-list of tabs that have `extracted_data.employees`
- Default: tab with most employees
- Disabled tabs: bank slips, signature pages, anything without beneficiary data
- Generate CSV from selected source using existing `generateEmployeeCSV()` (slightly modified)
- ~70 lines

**Step 6 — Modify `openTicketDetail(ticketId)`** ⚠️ **CRITICAL FIX from Council Q4**
- Dispatch based on **`t.schema_version === 'v13.3'`** (not `attachments.length > 0`)
- Council Q4 consensus (5/5 — sharpest articulation from Claude): `length > 0` breaks test #1 because Layer B wraps ALL payloads into `attachments[]`. Single-attachment tickets have `length === 1` → would route to tabs path → breaks regression
- Backup check: if `schema_version` missing, fall back to `(t.attachments?.length ?? 0) > 1`
- Multi-attachment path: tab strip + Summary default
- Legacy path: current single-view (unchanged)
- ~15 lines of conditional wrapping

**Step 7 — Modify `approveAndDownloadCSV(ticketId)`**
- If multi-attachment ticket: open CSV source-picker dialog first, then generate from selected tab
- If legacy ticket: current behavior (unchanged)
- ~15 lines modified

**Smoke test after each function added**:
- [ ] renderEmailPreview in isolation: paste a mock ticket in console, call `renderEmailPreview()`, inject result into a test div
- [ ] renderMultiColumnSBS: same pattern with a 2-attachment mock ticket
- [ ] Tab click: verify panels swap, state persists when reopening same ticket
- [ ] CSV source-picker: verify download generates correct CSV from selected tab
- [ ] **Regression check**: open an existing single-attachment ticket → legacy render still works (this is the #1 thing to break)

**Commit**: split into 2 for clean history:
- `feat(dashboard): add multi-attachment rendering functions (inactive, unused)`
- `feat(dashboard): wire multi-attachment path into openTicketDetail + approveAndDownloadCSV`

---

## Phase 1.5 — Final Cutover (producer flip)

**This is the single moment v13.3 goes live.** All 4 layers must be deployed and verified before this step. Council consensus (4/5): receiver before producer.

### Pre-flip checklist
- [ ] Layer A verified (no code changes)
- [ ] Layer B deployed to Vercel (both Pro + Hobby)
- [ ] Layer C workflow exists in n8n but is INACTIVE
- [ ] Layer D deployed to Vercel (both Pro + Hobby)
- [ ] Smoke test: inject a mock multi-attachment row directly into Supabase via SQL → open dashboard → verify tabs render correctly. This tests the full consumer path without n8n involvement.
- [ ] Smoke test: POST a mock new-shape payload to the live webhook via curl → verify ticket lands + renders
- [ ] Myanmar team not mid-disbursement (check with Vinh)

### Cutover steps
1. In n8n UI: toggle **v13.3 ON** first
2. Then toggle **v13.2 OFF**
3. Verify Outlook Spooler points at v13.3's webhook URL (if URLs differ)
4. Commit a cutover marker: `chore(n8n): activate v13.3 (receiver-first order verified)`
5. Tag the moment: `git tag v13.3-live && git push origin v13.3-live && git push yoma v13.3-live`

### Post-flip first-hour watch
- Monitor Supabase `email_queue` status transitions: expect normal mix
- Tail Vercel function logs for first 60 minutes
- Keep this terminal open:
  ```bash
  vercel logs wave-emi-dashboard --follow
  ```
- If ANY anomaly: execute rollback (see Phase 2 section)

---

## Phase 2 — During-implementation operational rules

### Commit cadence
- **Layer B**: 1 commit (webhook)
- **Layer C**: 1 commit per major node group (count + loop + gates + aggregate + rejection = 3-4 commits OK)
- **Layer D**: 2 commits (functions added, then wired up)
- **Do NOT batch all layers into one commit** — if something breaks, bisecting is painful

### Per-commit push protocol
After every commit:
```bash
git push origin main && git push yoma main
```
Both remotes must stay in sync — Vercel Pro deploys from yoma.

### Rollback points
Each commit is an independent rollback point. Typical rollback paths:

| Failure mode | Rollback |
|---|---|
| Webhook breaks existing tickets | Revert Layer B commit, redeploy Vercel |
| n8n v13.3 misfires | Deactivate v13.3, reactivate v13.2 in n8n UI (instant). **See drain protocol below before continuing.** |
| Dashboard multi-render breaks legacy | Revert Layer D commits, redeploy Vercel |
| Total disaster | `git checkout v13.2-stable -- wave-emi-dashboard/ pipelines/` → force redeploy (AFTER draining n8n) |

### Rollback drain protocol ⚠️ Council Q2 (Claude)

**Deactivating an n8n workflow only stops NEW triggers — in-flight executions run to completion.** If a v13.3 execution is mid-loop when you flip the switch, it will still POST `attachments[]` to the webhook ~30-45s later. If Vercel has already rolled back by then, that POST either 500s or creates a malformed ticket.

**Correct rollback order**:
1. Deactivate n8n v13.3 (no new triggers, but in-flight continues)
2. **Wait for zero active executions** — check n8n UI → Executions tab → filter: Status=Running. Wait until empty.
3. Reactivate v13.2
4. NOW roll back Vercel
5. Handle v13.3-era tickets (Council Q2 Gemini — "poison pills"): either delete from DB or add legacy render fallback that shows "Ticket requires v13.3 — please wait for redeploy"

Drain can take up to 60 seconds per in-flight email. Budget 2-3 minutes for complete rollback.

### Logging during execution
- **n8n**: enable execution logging on v13.3 during first 48h of live use (captures inputs/outputs of each node)
- **Vercel function logs**: tail via `vercel logs wave-emi-dashboard --follow` for first few hours
- **Supabase**: watch `email_queue` status transitions via SQL polling:
  ```sql
  SELECT status, COUNT(*) FROM email_queue GROUP BY status;
  -- expected mix: complete, rejected (new), pending, failed
  ```

### DO NOT
- ❌ Edit v13.2 workflow in n8n (even for minor fixes — clone first)
- ❌ Push `.env` or credentials (check `.gitignore` before pushing)
- ❌ Modify `kan36RenderSideBySide()` — it's a reused dependency
- ❌ Skip smoke tests to save time (we've been burned by this — see `memory/feedback_debugging_workflow.md`)

---

## Phase 3 — Post-implementation verification

### Test matrix (run all before declaring v13.3 live)

| # | Scenario | Expected |
|---|----------|----------|
| 1 | **Legacy single attachment** (regression) | Ticket created with legacy single-view, no tabs |
| 2 | 2 attachments, both pass (NSK-like) | Ticket created, tabs: Summary + 2 attachments |
| 3 | 3 attachments, mixed types (PDF+XLSX+PNG) | Ticket created, tabs: Summary + 3 attachments |
| 4 | 5 attachments (max) | Ticket created with 5 tabs + Summary |
| 5 | 6 attachments (too-many) | NO ticket. Rejection email sent. `email_queue.status=rejected` |
| 6 | 3 attachments, 1 password-protected | NO ticket. Rejection email lists the failed file. |
| 7 | 3 attachments, 1 corrupted (0-byte) | NO ticket. Rejection email lists the failed file. |
| 8 | 2 attachments, 1 password + 1 corrupted | NO ticket. Rejection email lists BOTH failed files (combined template). |
| 9 | Simulate Gemini 429 on attachment 2 of 3 | Silent retry 3x. If still failing, sys-admin escalation. Client sees nothing until resolved. |
| 10 | 2 attachments all pass, Summary tab: check multi-column SBS rendering matches mockup v3 Section 2 | All fields render, amount row highlighted where both attachments agree |
| 11 | CSV source-picker: 2 attachments, only 1 has employee data | Dialog opens with 2nd tab disabled, defaults to 1st |
| 12 | Approve path: single-attachment ticket from v13.2 era | Legacy CSV download works unchanged |
| 13 | **[Council Q7 Gemini]** 2 attachments with identical filename (e.g., `IMG_0001.jpg` twice from mobile) | Both render as distinct tabs. Storage path uses `{index}_{filename}` so no overwrite. |
| 14 | **[Council Q7 DeepSeek]** Mixed client+system fail: 1 password-protected + 1 simulated Gemini 429 | Rejection email sent for password issue (client-fail wins). NO infinite retry. |
| 15 | **[Council Q7 Claude]** Duplicate webhook POST: fire same payload via curl twice within 2 seconds | Exactly 1 row in `tickets_v2`, 0 duplicate activity_log entries, dashboard shows 1 ticket. |
| 16 | **[Council Q7 Qwen]** Gemini returns HTTP 200 with malformed/empty JSON (simulate via mock) | Classified as `system_fail`, NOT passed through. Retry triggered. |

### Backward-compat audit
- [ ] Open each pre-existing ticket (TKT-001, TKT-002) in dashboard → verify render unchanged
- [ ] Verify `email_queue` sweeper still processes single-attachment emails (spooler side unchanged)
- [ ] Verify no RLS/GRANT errors in Supabase logs
- [ ] Verify Outlook notification emails still send (worker notification path unchanged)

### Myanmar communication
- [ ] After all 12 tests pass: Teams message to Win + Wave Finance:
  *"v13.3 is live. Existing tickets look identical. New emails with 2+ attachments will show tabs. Everything else is the same. Here's a 2-min walkthrough video: [link]"*
- [ ] Pin the mockup v3 HTML as a reference they can screenshot
- [ ] First 48h: monitor `email_queue` for any unusual rejection rate

### Documentation updates
- [ ] Write ADR-005: "All-or-Nothing Multi-Attachment Processing" — MADR format, references Vinh conversation + design principle
- [ ] Update `CLAUDE_CONTEXT.md` resume pointer: v13.3 shipped
- [ ] Update `MEMORY.md` index: add `project_kan47_v13_3_shipped.md`
- [ ] Update `MOC_Wave_EMI_Architecture.md` pipeline diagram to show loop
- [ ] Archive mockups v1, v2 under `mockups/_archive/` with a README explaining v3 is canonical
- [ ] Update `wave-emi-dashboard/pipelines/README.md` if present (list current workflow names)

---

## Blind-spot checklist

Things the mockup does NOT show that bite during implementation. Addressed or flagged below.

| # | Blind spot | Status |
|---|------------|--------|
| 1 | **n8n credential re-link on workflow duplicate**: duplicating breaks Outlook OAuth binding. Re-attach credential after clone. | Addressed in Layer C Step 1 |
| 2 | **Execution budget spike during testing**: 6 test scenarios + overlap with real Myanmar emails could exceed 1000/mo. Current burn: 124/1000 (~12 days left = Apr 29). | Keep v13.2 as fallback; if exec count spikes, pause testing |
| 3 | **Gemini daily rate limit**: 5 attachments × 30 emails/day = 150 calls. Within free-tier budget. Flagged for monitoring. | Monitor during first 48h |
| 4 | **Outlook outbound rate-limit**: bursty rejection emails could be throttled/dropped. See `memory/known_issue_burst_notification_dropped_by_microsoft.md`. | Add 1s delay between consecutive rejections |
| 5 | **localStorage `emi_tickets` cache shape**: old cached tickets predate multi-attachment. Client-side render might break on stale cache. | Add a one-time migration: on dashboard load, if cached ticket has no `attachments` field but has legacy fields, wrap into `attachments: [legacy_as_item]` |
| 6 | **Supabase storage path collisions**: two attachments with same filename. | Use `/{ticket_id}/{index}_{sanitized_filename}` path convention |
| 7 | **Idempotency / duplicate webhook**: n8n retry could fire webhook twice. | **[Council Q3 5/5 consensus]** Derive ticket_id = `'TKT-' + sha1(message_id).slice(0,12)` in n8n. Webhook does `INSERT ... ON CONFLICT (id) DO NOTHING`. Native DB-level idempotency — no new column, no header plumbing. Tested via scenario #15. |
| 8 | **Existing test tickets render**: TKT-001 (AMOUNT_MISMATCH) + TKT-002 (NORMAL) are single-attachment. Must render unchanged post-deploy. | Test #1 in verification matrix |
| 9 | **Activity log cardinality**: per-attachment events = 5× log rows per ticket. `activity_log` view render performance check. | Monitor; add index on `(ticket_id, created_at)` if needed |
| 10 | **Myanmar UX change during live use**: team just learned single-attachment UI. Tabs = new mental model. | Pre-deploy Teams notice + 2-min walkthrough video |
| 11 | **PDF preview scoping**: existing `loadAttachmentPreview()` assumes one attachment. Needs per-tab awareness. | Modify to take `(ticketId, attachmentIndex)` instead of just `ticketId` |
| 12 | **CSV picker friction**: banker has to click extra dialog for single-source tickets. | If only 1 tab has employee data, skip dialog (auto-pick). Dialog only when ≥2 candidate tabs. |
| 13 | **n8n JSON diffing in git**: full workflow JSON is huge, diffs are unreadable. | Commit intermediate versions but document nodes-added in commit message |
| 14 | **Mobile responsiveness**: tab strip needs horizontal scroll on narrow screens. Existing `.tabstrip` CSS has `overflow-x:auto`. | Test at 360px width |
| 15 | **Vinh's samples delay**: Vinh said "gather samples later." We don't have real Pattern X / Pattern Y emails. | Test with synthetic emails for now; re-verify against Vinh's real samples when they arrive |
| 16 | **Rollback timing window**: n8n active-workflow switch is instant but Vercel redeploy takes 30-90s. If we rollback dashboard but not n8n, mismatch window. | Rollback order: n8n first (instant), Vercel second (slower). Never reverse. |
| 17 | **`raw_payload` JSONB size**: 5 attachments with extracted data could push `raw_payload` to 50-200KB per ticket. Supabase row limit is ~1MB. Fine but watch. | Monitor avg `raw_payload` size after 100 tickets |
| 18 | **[Council Q5 Claude] Orphaned Supabase Storage files on reject**: if files upload during the loop and the client-fail gate then rejects the email, uploaded files become orphans. Accumulates cost + path pollution. | **Fixed via Step 3 refactor**: uploads deferred to Step 7 (happy path only). No uploads on reject path. |
| 19 | **[Council Q5 Qwen/DeepSeek] n8n Cloud execution timeout**: trial may have 30s hard cap (Qwen) vs 60s (DeepSeek). 5 attachments × Gemini + backoff could exceed. Workflow dies mid-loop, leaves row stuck. | **Phase 0 verification**: confirm actual limit. If 30s, reduce to 2 retries with 1s+3s backoff. Recovery sweeper (ADR-002) catches stranded rows. |
| 20 | **[Council Q2 Gemini] Rollback poison-pill tickets**: v13.3-era tickets in DB become unrenderable by rolled-back legacy dashboard. | Rollback runbook addition (see Phase 2): either delete v13.3 tickets or add legacy fallback render that shows "Pending v13.3 dashboard". |
| 21 | **[Council Q7 Qwen] Gemini 200 OK with malformed JSON**: HTTP success but extraction payload missing required fields. Bypasses system_fail gate, crashes downstream. | **Fixed via Step 3**: `validateExtractionSchema(extracted)` after every Gemini call. Missing fields → classify as system_fail. Tested via scenario #16. |

---

## Dependencies & decisions you still need to make

Before I start Layer A (verification) → Layer B (code), confirm:

1. **Branch strategy**: Straight-to-main commits OK? Or do you want a `kan47-v13.3` branch + PR for reviewability?
2. **Vinh's sample wait**: Build with synthetic test data now, or pause Layer C until Vinh provides real multi-attachment samples (unknown timeline)?
3. **Deployment window**: Pick a low-Myanmar-traffic window for the n8n cutover. My default: Tuesday Apr 21 morning (our time) = Myanmar lunch/quiet. Confirm or pick another.
4. **Rejection email copy**: use my v3 templates as-is for first production use, or wait for Vinh's sign-off / Myanmar translation?

---

## Estimated total time

| Phase | Estimate | Notes |
|-------|----------|-------|
| Phase 0 pre-flight | 60 min | Now includes n8n timeout verification |
| Layer A verification | 10 min | No code changes |
| Layer B webhook | 45 min | Adds schema_version + deterministic ticket_id logic |
| Layer C n8n surgery | 3-4 hrs | Biggest risk layer. Gate order reversal + smime filter + defer upload + schema validation added post-Council |
| Layer D dashboard | 2-3 hrs | Dispatch on schema_version (not length) |
| Phase 1.5 cutover | 15 min | The moment v13.3 goes live |
| Phase 3 verification | 1.5-2 hrs | 16-scenario test matrix (was 12, +4 from Council) |
| Documentation updates | 45 min | ADR-005 + index pointers |
| **Total** | **8-11 hrs** | Spread across 2 sessions. Post-Council up from 7-10 due to scope tightening. |

---

## Changelog

- **2026-04-20 PM** — Initial version. Created alongside mockup v3 per DK's request for depth beyond the big picture.
- **2026-04-20 PM (v2 after AI Council round)** — Incorporated 10 fixes from 5-AI Council review (Gemini, DeepSeek, Qwen, Grok, Claude):
  1. Phase 1.5 Final Cutover extracted (activation flip no longer inside Layer C) — 4/5 converged
  2. Gate order reversed: client-fail first, system-fail second (DeepSeek sharpest critique)
  3. Dispatch fix: `schema_version === 'v13.3'` flag, not `length > 0` (5/5 converged)
  4. Deterministic ticket_id via sha1(message_id).slice(0,12) + ON CONFLICT (5/5 converged)
  5. smime/auto-attach pre-filter in Count Attachments node (3/5 converged)
  6. Storage uploads deferred until after gates pass (Claude — orphan prevention)
  7. Rollback drain protocol added (Claude — in-flight execution risk)
  8. Gemini extraction schema validation (Qwen — 200 OK with malformed JSON)
  9. Tests #13-#16 added (filename collision, mixed fail, webhook retry, malformed JSON)
  10. Phase 0.6 n8n timeout verification added (Qwen/DeepSeek — 30s vs 60s)
  - Rejected: Gemini Q5 "VPO vs departmental IDs" — confabulated, our CSV uses MSISDN
  - Overall Council confidence: 4 high + 1 medium = validated plan with targeted fixes
