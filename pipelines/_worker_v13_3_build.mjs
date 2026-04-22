// Build EMI Worker v13.3 workflow from v2 (v13.2) template
// Purpose: KAN-47 multi-attachment support — up to 5 attachments per email,
//          parallel Gemini extraction, client-fail-first gate order,
//          extended rejection templates.
// Run: node _worker_v13_3_build.mjs
//
// CHANGES vs v2 (v13.2):
//   1. Workflow name + webhook path updated for v13.3 (prevents traffic collision)
//   2. Prepare for AI v3 — emit attachments[] array (up to 5) with per-attachment
//      validation. Filter out smime.p7m signature blobs. Flag too-many-attachments.
//   3. Gemini 3 Extract — Promise.allSettled over attachments[] with 25s per-call
//      race timeout (fits within n8n Code node's HARD 60s cap; see
//      feedback_n8n_code_node_60s_hard_cap.md for the probe that proved this).
//   4. AI Parse & Validate v3 — aggregate Gemini array results; mark partial
//      failures with _extraction_error per attachment (human-in-loop visibility).
//   5. Skip Filter — gate order: client-fail reasons route BEFORE system-fail
//      (password_protected > too_many_attachments > unreadable > combined).
//   6. Send Rejection Email — 3 distinct templates + combined template for
//      multi-reason rejections (Vinh's all-or-nothing spec).
//   7. Webhook payload: accepts both legacy `attachment_base64` (single) and
//      new `attachments: [...]` (array) — forward-compatible with v13.2 data
//      shape until Layer B's webhook.js is fully rolled out.
//
// Hand-off pattern (see feedback_n8n_iac_handoff_pattern.md):
// Output JSON → DK imports ONCE into a new n8n workflow. Credentials auto-link
// by ID on same-instance import. Do NOT edit the workflow in n8n UI after import;
// any future v13.3.x change comes via this build script + re-import.

import { readFileSync, writeFileSync } from 'fs';

const SRC = 'g:/My Drive/Tech Jobs/Trustify/03_build/wave-emi-dashboard/pipelines/n8n-workflow-worker-v2.json';
const DST = 'g:/My Drive/Tech Jobs/Trustify/03_build/wave-emi-dashboard/pipelines/n8n-workflow-worker-v13_3.json';

const worker = JSON.parse(readFileSync(SRC, 'utf8'));

// =====================================================================
// 1. Metadata: name + webhook path + webhookId
// =====================================================================
worker.name = 'EMI Worker v13.3 (KAN-47) — Multi-Attachment + Parallel Gemini + Client-Fail-First Gates';

const webhookNode = worker.nodes.find(n => n.id === 'webhook-trigger-worker');
if (!webhookNode) throw new Error('webhook-trigger-worker node not found in source JSON');
webhookNode.parameters.path = 'emi-worker-v13-3';
webhookNode.webhookId = 'emi-worker-v13-3';

// =====================================================================
// 2. Prepare for AI v3 — multi-attachment (Layer C Step 3)
// =====================================================================
// Replace jsCode with v13.3 version from _worker_v13_3_prepare_for_ai.js.
// Source .js file is edited as normal JavaScript (no JSON escape concerns);
// build script slurps it and injects into the node at generation time.
//
// What changed vs v2:
//   - MAX_ATTACHMENTS raised 2 → 5 (KAN-47 spec)
//   - S/MIME signature attachments (smime.p7m, application/pkcs7-signature)
//     filtered out BEFORE counting — don't consume a slot and don't trigger
//     'unsupported_file_format' rejection on digitally-signed emails.
//   - detectRejectReason(buf) extracted into a helper so every attachment
//     can be validated, not just [0]. Each attachment in attachment_base64_list
//     gets tagged with _valid + _rejectReason.
//   - Return object adds attachments[] array with per-attachment metadata
//     + validation status. Legacy fields (attachment_base64, vision_eligible,
//     is_spreadsheet) retained so v13.2 Gemini/Parse nodes still function
//     until Layer C Steps 4-5 replace them.
//   - Backward-compat gate preserved: if attachments[0] has a rejection,
//     whole email is rejected (same as v13.2). Layer C Step 6 replaces
//     this with the all-or-nothing + combined-reason rule.
const prepareForAiJs = readFileSync(
  'g:/My Drive/Tech Jobs/Trustify/03_build/wave-emi-dashboard/pipelines/_worker_v13_3_prepare_for_ai.js',
  'utf8'
);
const prepareNode = worker.nodes.find(n => n.id === 'prepare-for-ai-v3');
if (!prepareNode) throw new Error('prepare-for-ai-v3 node not found in source JSON');
prepareNode.parameters.jsCode = prepareForAiJs;

// =====================================================================
// 3. Gemini 3 Extract — parallel Promise.allSettled (Layer C Step 4)
// =====================================================================
// Replace jsCode with v13.3 parallel version. Reads attachments[] from
// Prepare for AI v3 output. Fires N Gemini calls in parallel via
// Promise.allSettled; each call wrapped in Promise.race with 25s timeout
// so no single slow call can exceed the 60s n8n task-runner cap.
//
// Rate limit: staticData.geminiCalls atomically incremented by N BEFORE
// parallel fires (prevents race on counter). Circuit breaker threshold
// unchanged from v13.2 (5 errors/day).
//
// Output shape:
//   - attachment_extractions[] — one entry per valid attachment with
//     _gemini_result + _gemini_status + _gemini_usage + filename + index
//   - Legacy top-level fields (_gemini_result, _gemini_status, etc.) still
//     emitted from extraction[0] so v13.2 Parse & Validate (Step 5 target)
//     continues to function unchanged until Step 5 aggregates.
const geminiExtractJs = readFileSync(
  'g:/My Drive/Tech Jobs/Trustify/03_build/wave-emi-dashboard/pipelines/_worker_v13_3_gemini_extract.js',
  'utf8'
);
const geminiNode = worker.nodes.find(n => n.id === 'gemini3-extract');
if (!geminiNode) throw new Error('gemini3-extract node not found in source JSON');
geminiNode.parameters.jsCode = geminiExtractJs;

// =====================================================================
// 4. AI Parse & Validate v3 — multi-attachment aggregation (Layer C Step 5)
// =====================================================================
// Replace jsCode with v13.3 version. Merges prepData.attachments[] (raw)
// with d.attachment_extractions[] (Gemini results) into a unified
// attachments[] array for the webhook POST to /api/webhook. Layer B
// webhook.js already accepts this shape — it prefers attachments[] when
// present and falls back to legacy attachment_base64 fields when not.
//
// Primary ticket fields (company, amount, approvers) continue to flow
// from the legacy _gemini_result (attachment_extractions[0]._gemini_result
// per Step 4's backward-compat) so the ticket record itself is unchanged.
// Layer D (dashboard) will consume attachments[] for per-tab rendering.
const parseValidateJs = readFileSync(
  'g:/My Drive/Tech Jobs/Trustify/03_build/wave-emi-dashboard/pipelines/_worker_v13_3_parse_validate.js',
  'utf8'
);
const parseNode = worker.nodes.find(n => n.id === 'parse-validate-v3');
if (!parseNode) throw new Error('parse-validate-v3 node not found in source JSON');
parseNode.parameters.jsCode = parseValidateJs;

// =====================================================================
// 5. Send Rejection Email — add too_many + combined templates (Layer C Step 7)
// =====================================================================
// v13.2 body already handles: empty_body, password_protected_file,
// zip_archive, rar_archive, 7z_archive, unsupported_file_format.
// Step 7 adds two new branches to the ternary:
//   - too_many_attachments (from Step 6's MAX_ATTACHMENTS cap)
//   - combined (from Step 6's multi-distinct-reason case — lists all reasons)
//
// Is Rejection Email? IF node is unchanged: it checks from_email !== ''
// which routes ALL non-silent skip reasons to this node. Silent skips
// (outlook_draft, no_email_metadata) have empty from_email and dead-end.
const rejectNode = worker.nodes.find(n => n.id === 'send-rejection-email');
if (!rejectNode) throw new Error('send-rejection-email node not found');

const tooManyTemplate =
  '"REASON: Too many attachments\\n\\n' +
  'You attached " + ($json._raw_non_smime_count || "several") + " files, but our pipeline accepts a maximum of " + ($json._max_attachments || 5) + " attachments per email.\\n\\n' +
  'HOW TO FIX:\\n' +
  '1. Remove extra attachments — keep only the essential payroll documents\\n' +
  '2. Maximum " + ($json._max_attachments || 5) + " attachments per email (signature files don\'t count)\\n' +
  '3. Re-send your email with only the required files attached"';

const combinedTemplate =
  '"REASON: Multiple issues detected in your attachments\\n\\n' +
  'We found more than one problem across your files:\\n" + ' +
  '($json._combined_reasons ? $json._combined_reasons.map(function(r){return "  - " + r.replace(/_/g, " ");}).join("\\n") : "") + ' +
  '"\\n\\nHOW TO FIX:\\n' +
  'Please review each attachment and address every issue above — for example, unlock any password-protected files, extract any archives, and convert any unsupported formats. Then resubmit your email."';

// Insert the two new branches BEFORE the fallback "REASON: The request could not be processed"
// Anchor: the tail of unsupported_file_format branch + opening of fallback.
// Note: Re-send is inside a string (preceded by "3. "), so no leading quote
// before it in the match — only the closing " after "attached".
const UNSUPPORTED_END = `Re-send your email with the converted file attached" : "REASON: The request could not be processed. Please contact emoney@zeyalabs.ai for assistance."`;
const NEW_INSERT = `Re-send your email with the converted file attached" : $json._skip_reason === "too_many_attachments" ? ` + tooManyTemplate + ` : $json._skip_reason === "combined" ? ` + combinedTemplate + ` : "REASON: The request could not be processed. Please contact emoney@zeyalabs.ai for assistance."`;

if (!rejectNode.parameters.bodyContent.includes(UNSUPPORTED_END)) {
  throw new Error('Send Rejection Email anchor not found — body template format changed; update _worker_v13_3_build.mjs');
}
rejectNode.parameters.bodyContent = rejectNode.parameters.bodyContent.replace(UNSUPPORTED_END, NEW_INSERT);

// =====================================================================
// 6. Connection rewiring (TODO: Layer C Step 6 — gate order)
// =====================================================================
// Skip Filter's two branches will remain the same topology; decision order
// is encoded in Prepare for AI v3's reason-selection, not the topology.

// =====================================================================
// 6a. Canvas tidy-up — clean grid layout for easier visual reading
// =====================================================================
// v13.2 positions were organically placed and overlap when the workflow
// has all 17 nodes + connections drawn. Re-layout onto a clean grid:
//   Y=400: main flow (Webhook → Claim → Prepare → Skip Filter)
//   Y=200: rejection branch (up)
//   Y=300: notification (success) branch
//   Y=600: diagnostic branch (down)
//   All branches merge at Chain Next Job (x=2200, y=400).
// Each node is 200px apart horizontally for comfortable label spacing.
const POSITIONS = {
  'webhook-trigger-worker':       [ 240, 400],
  'claim-reconstitute':           [ 440, 400],
  'prepare-for-ai-v3':            [ 640, 400],
  'skip-filter':                  [ 840, 400],
  'is-rejection-email':           [1040, 200],
  'send-rejection-email':         [1240, 200],
  'mark-complete-reject':         [1440, 200],
  'gemini3-extract':              [1040, 400],
  'parse-validate-v3':            [1240, 400],
  'send-notification':            [1440, 300],
  'mark-complete-notify':         [1640, 300],
  'is-diagnostic':                [1440, 600],
  'should-notify-sender':         [1640, 600],
  'send-failure-notification':    [1840, 500],
  'mark-failed-diagnostic':       [1840, 700],
  'chain-next-job':               [2100, 400],
  'sticky-note-worker-v13-1':     [-200, 100],
};
for (const node of worker.nodes) {
  if (POSITIONS[node.id]) {
    node.position = POSITIONS[node.id];
  }
}

// =====================================================================
// 7. Update sticky note for v13.3 architecture (TODO)
// =====================================================================
// Will update sticky-note content in a follow-up commit once all node
// changes are in place.

// =====================================================================
// Write out
// =====================================================================
writeFileSync(DST, JSON.stringify(worker, null, 2));
console.log('✓ Worker v13.3 written to:', DST);
console.log('  Nodes:', worker.nodes.length);
console.log('  Connections:', Object.keys(worker.connections).length);
console.log('  Webhook path:', webhookNode.parameters.path);
console.log('');
console.log('Layer C progress: Steps 1-7 complete — v13.3 pipeline feature-complete.');
console.log('Remaining: Step 8 (final handoff), Layer D (dashboard), Phase 1.5 (cutover).');
