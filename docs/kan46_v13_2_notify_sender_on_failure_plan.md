# KAN-46 v13.2 — Notify Sender on Extraction Failure

**Status:** PLANNED — ready to implement
**Target ship:** Saturday Apr 18, 2026
**Estimated time:** 2 hours (1h implementation + 30min test + 30min docs)
**Risk level:** LOW (additive change, rollback via git revert)

---

## 1. Executive summary

**Problem we're solving:**
Today, when Gemini fails to extract disbursement details from an email, the sender receives ZERO feedback. The row is silently marked `status='failed'` in `email_queue`, but the client has no way of knowing their submission failed. This causes:
- Clients assuming the email worked
- Anxiety when they don't receive a ticket confirmation
- Repeated submissions with the same broken attachment
- Support tickets to DK asking "did you get my email?"

**Fix:** Send a polite, actionable "we couldn't process" notification back to the sender when a diagnostic failure occurs, with a specific reason and next-step guidance.

**Why this is high-value:**
- Directly improves Myanmar stress-test experience
- Reduces DK's reactive support load
- Closes the feedback loop for non-technical senders
- Preserves all existing safety guarantees (loop guard, rollback, audit trail)

---

## 2. Architecture — before and after

### Before (v13.1.1, current)

```
AI Parse & Validate v3
       │
       ▼
[Is Diagnostic?]
       ├── true  ──► Mark Failed (Diagnostic) ──► Chain Next Job
       │                  (silent to client)
       │
       └── false ──► Send Outlook Notification ──► Mark Complete ──► Chain Next Job
```

### After (v13.2, proposed)

```
AI Parse & Validate v3
       │
       ▼
[Is Diagnostic?]
       ├── true  ──► [Should Notify Sender?] ─┬── true  ──► Send Failure Notification ──┐
       │                                      │                                          │
       │                                      └── false (skip) ─────────────────────────┤
       │                                                                                 │
       │                                                      ┌──────────────────────────┘
       │                                                      ▼
       │                                               Mark Failed (Diagnostic) ──► Chain Next Job
       │
       └── false ──► Send Outlook Notification ──► Mark Complete ──► Chain Next Job
```

### Key design choice: notification BEFORE marking failed

**Why:** if the notification send fails (e.g., Outlook throttle, network blip), we DON'T want to leave the row in limbo. By marking failed AFTER attempting notification, we guarantee the DB state reflects the processing attempt completing. Chain Next Job still fires regardless → queue keeps draining.

---

## 3. Node design

### New node 1: `should-notify-sender` (IF node)

**Purpose:** Decide whether to notify the sender. Skip notification if:
- Sender is `emoney@zeyalabs.ai` (self-send loop protection)
- Sender email is empty/missing
- Failure reason is infrastructure-related (API error, DB error) — don't blame the client

**Conditions (AND combined):**
```javascript
{{ $json._reason }} is one of ['not_disbursement_or_gemini_failed', 'empty_body', 'gemini_parse_error', 'schema_mismatch']
AND
{{ $('Claim & Reconstitute').first().json.from.emailAddress.address }} !== 'emoney@zeyalabs.ai'
AND
{{ $('Claim & Reconstitute').first().json.from.emailAddress.address }} !== ''
```

### New node 2: `send-failure-notification` (Microsoft Outlook Send)

**Purpose:** Email the sender with a polite, specific failure message.

**Node type:** `n8n-nodes-base.microsoftOutlook` (same as existing Send Outlook Notification)

**Parameters:**
- `resource`: message
- `operation`: send
- `toRecipients`: `={{ $('Claim & Reconstitute').first().json.from.emailAddress.address }}`
- `subject`: `=Re: {{ $('Claim & Reconstitute').first().json.subject || 'Your request' }} — Unable to process`
- `bodyContent`: see template below
- `bodyContentType`: `text` (keep it plain text for maximum deliverability — HTML triggers more spam filters)

**Body template (with expression interpolation):**
```
Dear Sender,

Thank you for contacting Wave Money E-Money Operations.

Our automated disbursement system received your email but was unable
to extract the required information for processing.

━━━━━━━━━━━━━━━━━━━━━━━━

ℹ  What happened

{{ $json._user_friendly_reason }}

━━━━━━━━━━━━━━━━━━━━━━━━

➡  What to do next

Please resubmit your request making sure to include:

  • A clear email body with:
    - Company name requesting disbursement
    - Total amount (with currency)
    - Number of employees (if applicable)
    - Sales HOD + Finance Manager approvals
    - Payroll period or payment date

  • If an attachment is required:
    - Use typed/printed documents when possible
    - For handwritten payroll lists, ensure the image is high-resolution
      and the writing is clearly legible
    - Accepted formats: PDF, XLSX, CSV, or clear photo (JPG/PNG)

━━━━━━━━━━━━━━━━━━━━━━━━

❓  Still having issues?

If this is the second time your request has failed, please reply to this
email or contact our operations team directly.

We apologize for any inconvenience.

━━━━━━━━━━━━━━━━━━━━━━━━

Wave Money | E-Money Operations
emoney@zeyalabs.ai

Internal reference: {{ $('Claim & Reconstitute').first().json._queue_message_id }}
```

**Retry on fail:** 2 tries, 2s base delay (same pattern as existing Send Outlook Notification)

### Modified node: `mark-failed-diagnostic` (Code)

**Add:** a step that computes `_user_friendly_reason` from `_reason` BEFORE returning, so downstream nodes can use it:

```javascript
// v13.2 addition: map internal reason to user-friendly text
const REASON_MAP = {
  'not_disbursement_or_gemini_failed': 'We could not identify the disbursement details in your email or attachment. This usually means the email body is missing key information or the attachment could not be read clearly.',
  'empty_body': 'Your email body was empty or too short for us to process.',
  'gemini_parse_error': 'We could not parse the structured data from your attachment. This often happens with complex handwriting or unusual document layouts.',
  'schema_mismatch': 'The information extracted from your email did not match the expected disbursement format.',
  'default': 'We encountered an issue processing your disbursement request.'
};
const userFriendlyReason = REASON_MAP[reason] || REASON_MAP['default'];

// existing Mark Failed logic continues as before...
return {
  json: {
    _worker_status: 'failed_diagnostic',
    message_id: messageId,
    reason,
    status,
    _user_friendly_reason: userFriendlyReason  // NEW
  }
};
```

Wait — reconsidering design: since `_user_friendly_reason` needs to be available to the `send-failure-notification` node (which runs BEFORE `mark-failed-diagnostic`), we should compute it EARLIER. Option: compute it in AI Parse & Validate v3 when it creates the `_diagnostic` object. Cleaner.

**Revised approach:** modify AI Parse & Validate v3's diagnostic branch to include `_user_friendly_reason`:

```javascript
// In AI Parse & Validate v3, diagnostic branch:
const REASON_MAP = { ... };  // same map as above
if (!parsed.is_disbursement) {
  return [{ json: {
    _diagnostic: true,
    _reason: 'not_disbursement_or_gemini_failed',
    _user_friendly_reason: REASON_MAP['not_disbursement_or_gemini_failed'],
    _gemini_status: geminiStatus,
    // ... existing fields
  }}];
}
```

This way, the field is available to both `Should Notify Sender?` and `Send Failure Notification`.

---

## 4. Connection rewiring

**Connections to modify:**

```javascript
// OLD:
"Is Diagnostic?": {
  main: [
    [{ node: 'Mark Failed (Diagnostic)', type: 'main', index: 0 }],  // true
    [{ node: 'Send Outlook Notification', type: 'main', index: 0 }]  // false
  ]
}

// NEW:
"Is Diagnostic?": {
  main: [
    [{ node: 'Should Notify Sender?', type: 'main', index: 0 }],  // true
    [{ node: 'Send Outlook Notification', type: 'main', index: 0 }]  // false
  ]
},
"Should Notify Sender?": {
  main: [
    [{ node: 'Send Failure Notification', type: 'main', index: 0 }],  // true
    [{ node: 'Mark Failed (Diagnostic)', type: 'main', index: 0 }]    // false
  ]
},
"Send Failure Notification": {
  main: [[{ node: 'Mark Failed (Diagnostic)', type: 'main', index: 0 }]]
}
```

Both paths of `Should Notify Sender?` converge back to Mark Failed (Diagnostic). Then Chain Next Job as before.

---

## 5. Implementation steps (single linear flow)

### Step 1 — Write the build script (~15 min)

Create `pipelines/_worker_v2_notify_failure.mjs` that:
1. Reads current Worker v2 JSON
2. Modifies AI Parse & Validate v3 to include `_user_friendly_reason` in diagnostic items
3. Adds `Should Notify Sender?` IF node
4. Adds `Send Failure Notification` Outlook node
5. Rewires connections
6. Updates sticky note to mention v13.2 feature
7. Writes back to worker-v2.json

### Step 2 — Run the build script (~2 min)

```bash
cd "g:/My Drive/Tech Jobs/Trustify/03_build/wave-emi-dashboard/pipelines"
node _worker_v2_notify_failure.mjs
```

Expected output: confirmation of 2 new nodes added + 3 connection rewires.

### Step 3 — Commit the build + JSON changes (~5 min)

Git commit message:
```
v13.2: Notify sender on extraction failure

Adds user-facing feedback loop when Gemini can't extract disbursement
details. Previous behavior: silent failure with status='failed' in DB.
New behavior: polite notification to sender with specific reason and
resubmission guidance, then mark failed.

New nodes in Worker v2:
- Should Notify Sender? (IF): skip notification if sender is emoney
  self-send, empty email, or failure is infrastructure-side (api_error)
- Send Failure Notification (Outlook): plain-text template with
  user-friendly reason map + next-step checklist
- AI Parse & Validate v3: now includes _user_friendly_reason in
  diagnostic items so downstream nodes can use it

Self-send loop protection preserved: notification skipped when
from_email = emoney@zeyalabs.ai. If client replies to our failure
notification, Spooler's existing loop guard still prevents cascades.
```

### Step 4 — Re-import Worker v2 in n8n UI (~15 min)

1. In n8n → Worker v2 workflow → Delete all nodes (or delete workflow + re-import)
2. Import updated `pipelines/n8n-workflow-worker-v2.json`
3. Re-paste secrets (same 5 places as before)
4. Attach Outlook credential to THREE send nodes now:
   - Send Outlook Notification (existing)
   - Send Rejection Email (existing)
   - **Send Failure Notification (new)**
5. Save workflow (but don't activate yet)

### Step 5 — Test (~30 min)

**Test A: Valid email** (regression check)
- Send normal ACME disbursement email
- Expect: ticket created + normal notification received (same as before)
- Verify `email_queue` row `status='completed'`

**Test B: Gemini-failure email** (the new feature)
- Send Wave email (handwritten 21-emp JPG — known to trigger diagnostic)
- Expect:
  - Worker execution shows: Claim → Gemini → Parse → Is Diagnostic [true] → Should Notify [true] → Send Failure Notification → Mark Failed → Chain Next Job
  - Your personal Outlook inbox receives a "Unable to process" email with:
    - Subject: `Re: [your test subject] — Unable to process`
    - Body: user-friendly reason + next steps
    - From: emoney@zeyalabs.ai
  - `email_queue` row `status='failed'` with error_message unchanged
  - **No self-send in emoney's inbox**

**Test C: Edge case — empty body email** (optional)
- Send email with empty body
- Expect: Skip Filter routes to Rejection branch (existing path, not our new one)
- No change in behavior — this is not a diagnostic failure

### Step 6 — Activate + monitor (~5 min)

1. Activate Worker v2
2. Wait 2 min with no test emails — verify no unexpected n8n execution burn
3. Run Test A + Test B
4. If all green, leave activated

### Step 7 — Update docs + memory (~10 min)

1. Append v13.2 entry to `docs/kan46_implementation_log.md`
2. Update `project_kan46_v13_1_1_shipped.md` → mark v13.2 notify-on-failure as shipped
3. Remove it from `project_v13_2_backlog.md` (or mark "✅ shipped")

---

## 6. Edge cases & safety

### Self-send loop protection
- Layer 1: `Should Notify Sender?` skips if `from === 'emoney@zeyalabs.ai'`
- Layer 2: Even if Layer 1 fails, Spooler's existing loop guard skips self-sends at the ingest stage
- Layer 3: `claim_notification` RPC exists (not currently called) as a future dedup gate

### Rate limiting
- No explicit rate limit in v13.2
- Microsoft Graph API has per-mailbox limits (~30 msgs/min) — plenty for our scale
- If spam scenarios emerge in production, add per-sender throttle in v13.3

### Failure reasons NOT triggering notification
- `api_error` → infrastructure issue on our side, not client's problem
- `spool_duplicate` → client already got notification on first send
- `rejection_email` → uses separate rejection path (existing)

### Subject filtering
- Template uses `Re: [original_subject]` to thread naturally in the sender's inbox
- Original subject may contain emojis/unicode — Microsoft handles this fine

### If the sender's email is malformed (e.g., `noreply@...`)
- Outlook node will error → retry → error again → Mark Failed still runs
- Queue state remains consistent (status='failed')

---

## 7. Rollback plan

**If v13.2 misbehaves in Myanmar testing:**

### Fast rollback (30 sec — no code changes)
In Worker v2 n8n UI:
1. Disable `Send Failure Notification` node (right-click → Deactivate)
2. Reconnect `Should Notify Sender?` [true] directly to Mark Failed (Diagnostic)

Effectively reverts to v13.1.1 silent-failure behavior.

### Full rollback (code)
```bash
git checkout a81e190 -- pipelines/n8n-workflow-worker-v2.json
```
Re-import in n8n UI.

### Nuclear rollback (to v12.4)
See existing `docs/kan46_v13_1_rollback_runbook.md`. Unchanged.

---

## 8. Success criteria

v13.2 ship is complete when:

- [ ] Build script runs clean, produces valid JSON
- [ ] Worker v2 imported to n8n with 17 nodes (was 15: +2 new)
- [ ] Test A passes (regression: normal email still works)
- [ ] Test B passes (failure case: sender receives actionable notification)
- [ ] `email_queue` row states unchanged from v13.1.1 behavior
- [ ] No self-send loop (emoney inbox stays clean of failure notifications)
- [ ] Git commit pushed to origin + yoma
- [ ] MEMORY.md resume pointer updated with "v13.2 notify-on-failure shipped"
- [ ] Implementation log appended

---

## 9. Post-v13.2 state

After shipping:
- Worker v2: 17 nodes, 14 connections
- v13.2 items remaining in backlog:
  - Tighten single-flight gate (still medium priority)
  - Dashboard All Tickets auto-refresh
  - Myanmar self-service doc
  - Others in `project_v13_2_backlog.md`
- Monday Myanmar testing benefits from: senders getting real-time feedback on failures → reduced anxiety, faster iteration on their end

---

## 10. Files that will change

| File | Change |
|------|--------|
| `pipelines/n8n-workflow-worker-v2.json` | +2 nodes, +3 connection changes, AI Parse node updated |
| `pipelines/_worker_v2_notify_failure.mjs` | NEW build script |
| `docs/kan46_implementation_log.md` | Append v13.2 section |
| `project_kan46_v13_1_1_shipped.md` (memory) | Mark v13.2 notify-on-failure as shipped |
| `project_v13_2_backlog.md` (memory) | Move "notify sender" to "✅ shipped" |

No changes to:
- SQL migration (schema unchanged)
- Spooler workflow
- Dashboard code
- v12.4 standby (rollback target)
