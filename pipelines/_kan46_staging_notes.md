# KAN-46 Surgery Staging Notes

**Status:** STAGING — not yet applied. Awaiting Phase 1 discovery result from DK.
**Created:** Apr 17, 2026

---

## Decision Tree

```
DK checks n8n UI
    ├─ Found "Execute only one instance at a time" toggle
    │   → OPTION A: toggle ON in UI, save, export JSON, commit
    │
    ├─ Found only `executionOrder` in JSON settings, no concurrency toggle
    │   → OPTION B: JSON surgery — add concurrency settings (may or may not work on Cloud)
    │
    └─ No concurrency feature visible anywhere
        → OPTION C: staticData lock pattern (code-level fallback)
```

---

## OPTION A — UI Toggle (preferred)

Steps if the toggle exists:
1. Toggle "Execute only one instance at a time" → ON
2. Save workflow settings
3. File → Export workflow → save to `pipelines/n8n-workflow-v12.5.json`
4. Commit with message: `"KAN-46 v12.5: enable single-instance execution (concurrency=1)"`

No surgery script needed. Verify the exported JSON settings block to confirm the toggle persisted.

---

## OPTION B — JSON Surgery (fallback)

Current settings block in `n8n-workflow-v12.json`:
```json
"settings": {
  "executionOrder": "v1"
}
```

Target settings block for KAN-46:
```json
"settings": {
  "executionOrder": "v1",
  "executionTimeout": 300,
  "saveExecutionProgress": true,
  "saveDataSuccessExecution": "all",
  "saveDataErrorExecution": "all"
}
```

Note: n8n does NOT have a documented `maxExecutionConcurrency` workflow-level setting on Cloud. This option may be a dead-end; if UI toggle missing, proceed directly to Option C.

**Verification only** — re-import to n8n and check if the setting sticks. If n8n strips unknown keys, we move to Option C.

---

## OPTION C — StaticData Lock Pattern (guaranteed fallback)

Code change in `Prepare for AI v3` node — add at the TOP of jsCode (right after `const item = $input.item;`):

```javascript
// ═══ KAN-46 L1: concurrency=1 via staticData lock ═══
// Purpose: prevent overlapping executions when Outlook trigger fires rapidly.
// Pattern: check-and-set lock with 5-min TTL for crash recovery.
const concState = $getWorkflowStaticData('global');
const concNow = Date.now();
const LOCK_TTL_MS = 300000; // 5 min — safety release if execution crashes

if (concState.pipeline_locked_at && (concNow - concState.pipeline_locked_at) > LOCK_TTL_MS) {
  console.log('[KAN-46] Stale lock released (crashed execution?). Previous holder:', new Date(concState.pipeline_locked_at).toISOString());
  concState.pipeline_processing = false;
  concState.pipeline_locked_at = null;
}

if (concState.pipeline_processing) {
  // Another execution holds the lock. Skip this item — next Outlook poll will pick it up.
  return { json: { _skip: true, _skip_reason: 'concurrency_deferred', original_subject: item.json.subject || '', from_email: '' } };
}

concState.pipeline_processing = true;
concState.pipeline_locked_at = concNow;
// ═══ END KAN-46 L1 ═══
```

Code change in `AI Parse & Validate v3` node — add at the END of jsCode (before the return statement):

```javascript
// ═══ KAN-46 L1: release concurrency lock ═══
const concState2 = $getWorkflowStaticData('global');
concState2.pipeline_processing = false;
concState2.pipeline_locked_at = null;
// ═══ END KAN-46 L1 ═══
```

**Critical:** must also add lock release on ERROR paths. Options:
1. Add a "lock release on error" node between Prepare and downstream nodes using n8n's error workflow feature
2. Accept that crashed executions have 5-min TTL before auto-release (simpler, ships today)

**Recommendation:** ship with TTL-only first. Add explicit error handling in Phase 3 hardening.

---

## Related Surgery (L3 — batch cap, regardless of which Option wins)

Outlook Trigger node currently has:
```json
"parameters": {
  "simple": false,
  "output": "raw",
  "filters": {},
  "options": {
    "downloadAttachments": true
  }
}
```

Need to check n8n's Outlook Trigger for a `limit` or `maxEmails` parameter. In the UI:
- Open Outlook Trigger node → Options → look for "Limit" field
- Set to 25

If no UI option, use n8n's expression: poll returns all, but we can filter in Prepare node with index check.

---

## Risk Assessment

| Option | Risk | Effort |
|--------|------|--------|
| A (UI toggle) | Very low — native feature | 5 min |
| B (JSON settings) | Medium — may be ignored by n8n | 10 min |
| C (staticData lock) | Medium — needs TTL + error handling | 1-2 hrs |

**My recommendation:** if A is available, ship it today. If not, ship C with conservative 5-min TTL. Skip B.

---

## Next Step

Waiting on DK's Phase 1 discovery result. Once confirmed:
- If A → immediate ship
- If C → write real surgery script, test, commit
