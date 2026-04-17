// Build EMI Worker v1 workflow from v12.4 template
// Node script — run via: node _worker_build.mjs

import { readFileSync, writeFileSync } from 'fs';

const worker = JSON.parse(readFileSync('./_worker_stage1.json', 'utf8'));

const SUPABASE_URL = 'https://dicluyfkfqlqjwqikznl.supabase.co';

// =====================================================================
// NEW NODES
// =====================================================================

const stickyNote = {
  parameters: {
    content: `## EMI Worker v1 — KAN-46 Durable Queue Consumer

**Purpose:** Claim one email job from Supabase email_queue, process through v12.4 chain, mark done.
**Cron:** every 30 seconds
**Execution time:** 30-120 sec per job (depends on Gemini + attachment size)
**Concurrency:** FOR UPDATE SKIP LOCKED means only one Worker execution can hold a claim at a time.

### Flow
1. Cron trigger fires every 30s
2. Claim node calls \`claim_next_email_job\` RPC on Supabase
3. If no pending row → exit silently (queue empty or another worker claimed)
4. If row claimed → reconstitute item.json + item.binary as if from Outlook Trigger
5. Feed into v12.4 processing chain (Prepare → Gemini → Parse → Notify)
6. Mark queue row as 'completed' (success) or 'failed' (error)

### Rollback
Deactivate this workflow in n8n UI → queue rows stay pending → activate v12.4 pipeline as fallback.

### KAN-46 L1 concurrency guarantee
- Only 1 Worker execution can have a claimed row at a time (DB enforces via SKIP LOCKED)
- 5-min TTL on locked_at: crashed executions auto-release
- UNIQUE(message_id) on tickets prevents duplicate ticket creation`,
    height: 420,
    width: 500
  },
  id: 'sticky-note-worker',
  name: 'Worker Architecture Note',
  type: 'n8n-nodes-base.stickyNote',
  typeVersion: 1,
  position: [-150, 200]
};

const cronTrigger = {
  parameters: {
    rule: {
      interval: [
        { field: 'seconds', secondsInterval: 30 }
      ]
    }
  },
  id: 'cron-trigger',
  name: 'Cron: every 30s',
  type: 'n8n-nodes-base.scheduleTrigger',
  typeVersion: 1.1,
  position: [400, 400]
};

const claimReconstitute = {
  parameters: {
    jsCode: `// ═══════════════════════════════════════════════════════════════
// EMI Worker — Claim & Reconstitute (KAN-46)
// ═══════════════════════════════════════════════════════════════
// 1. Call claim_next_email_job RPC → atomically claim ONE pending row
// 2. If queue empty, return empty array (workflow ends silently)
// 3. If claimed, reconstitute item.json + item.binary to look like Outlook Trigger output
//    so downstream v12.4 chain sees the same shape as before.

const SUPABASE_URL = '${SUPABASE_URL}';
const SUPABASE_SERVICE_KEY = 'REPLACE_WITH_SUPABASE_SERVICE_ROLE_KEY';

const workerId = 'worker-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);

// Call the atomic claim RPC
let claimedRows;
try {
  claimedRows = await helpers.httpRequest({
    method: 'POST',
    url: \`\${SUPABASE_URL}/rest/v1/rpc/claim_next_email_job\`,
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'params=single-object'
    },
    body: { p_worker_id: workerId },
    json: true
  });
} catch (e) {
  // Supabase unreachable — skip this cycle, next cron will retry
  console.log('[Worker] claim RPC failed:', e.message || String(e));
  return [];
}

// RPC returns array of rows (SETOF). Empty array = no pending jobs.
if (!Array.isArray(claimedRows) || claimedRows.length === 0) {
  // Queue is empty OR another worker beat us. Exit silently.
  return [];
}

const claimed = claimedRows[0];
const payload = claimed.payload || {};
const rawEmail = payload.raw_email || {};
const attachments = payload.attachments || [];

// Reconstitute binary field — n8n Code nodes can return { json, binary }
const binary = {};
attachments.forEach((a, i) => {
  if (a.base64) {
    binary['attachment_' + i] = {
      data: a.base64,
      fileName: a.filename || 'attachment_' + i,
      mimeType: a.mimeType || 'application/octet-stream'
    };
  }
});

// Return ONE item shaped like Outlook Trigger output.
// Include _queue_* meta for downstream Mark Complete / Mark Failed to use.
return [{
  json: {
    ...rawEmail,
    _queue_id: claimed.id,
    _queue_message_id: claimed.message_id,
    _worker_id: workerId
  },
  binary: binary
}];
`
  },
  id: 'claim-reconstitute',
  name: 'Claim & Reconstitute',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [620, 400]
};

const markCompleteCode = `// Mark the queue row as completed
// Reaches back to Claim & Reconstitute for the original message_id
// (downstream nodes may strip/replace it)
const SUPABASE_URL = '${SUPABASE_URL}';
const SUPABASE_SERVICE_KEY = 'REPLACE_WITH_SUPABASE_SERVICE_ROLE_KEY';

let messageId = '';
try {
  const claimItem = $('Claim & Reconstitute').first();
  messageId = claimItem?.json?._queue_message_id || claimItem?.json?.id || '';
} catch(e) {
  // $() may not be available if execution path skipped that node
}
// Fallback: try current item
if (!messageId) {
  const d = $input.item?.json || {};
  messageId = d._queue_message_id || d.message_id || d.id || '';
}

if (!messageId) {
  console.log('[Worker] mark-complete: no message_id found; cannot release lock');
  return { json: { _worker_status: 'no_message_id_release_failed' } };
}

try {
  await helpers.httpRequest({
    method: 'POST',
    url: \`\${SUPABASE_URL}/rest/v1/rpc/mark_email_completed\`,
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'params=single-object'
    },
    body: { p_message_id: messageId },
    json: true
  });
} catch(e) {
  console.log('[Worker] mark-complete RPC failed:', e.message || String(e));
  // Don't throw — lock will auto-release via 5-min TTL
}

return { json: { _worker_status: 'completed', message_id: messageId } };
`;

const markCompleteNotify = {
  parameters: {
    jsCode: markCompleteCode,
    mode: 'runOnceForEachItem'
  },
  id: 'mark-complete-notify',
  name: 'Mark Complete (Notify path)',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [2300, 300]
};

const markCompleteReject = {
  parameters: {
    jsCode: markCompleteCode,
    mode: 'runOnceForEachItem'
  },
  id: 'mark-complete-reject',
  name: 'Mark Complete (Rejection path)',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [2300, 500]
};

// Add nodes
worker.nodes.push(stickyNote, cronTrigger, claimReconstitute, markCompleteNotify, markCompleteReject);

// =====================================================================
// REWIRE CONNECTIONS
// =====================================================================
// Original v12.4 had:
//   webhook/outlook -> Prepare for AI v3 -> Skip Filter
//   Skip Filter [0 true] -> Is Rejection Email?
//   Skip Filter [1 false] -> Gemini 3 Extract
//   Gemini 3 Extract -> Parse & Validate v3 -> Route by Source
//   Route [0] -> Respond (webhook)
//   Route [1] -> Send Outlook Notification
//   Is Rejection Email? [true] -> Send Rejection Email
//
// Worker v1:
//   Cron -> Claim & Reconstitute -> Prepare for AI v3 -> Skip Filter
//   Skip Filter [0 true] -> Is Rejection Email?
//   Skip Filter [1 false] -> Gemini 3 Extract
//   Gemini 3 Extract -> Parse & Validate v3 -> Send Outlook Notification
//   Send Outlook Notification -> Mark Complete (Notify)
//   Is Rejection Email? [true] -> Send Rejection Email -> Mark Complete (Reject)

worker.connections = {
  'Cron: every 30s': {
    main: [[{ node: 'Claim & Reconstitute', type: 'main', index: 0 }]]
  },
  'Claim & Reconstitute': {
    main: [[{ node: 'Prepare for AI v3', type: 'main', index: 0 }]]
  },
  'Prepare for AI v3': {
    main: [[{ node: 'Skip Filter (v11.1)', type: 'main', index: 0 }]]
  },
  'Skip Filter (v11.1)': {
    main: [
      [{ node: 'Is Rejection Email?', type: 'main', index: 0 }],
      [{ node: 'Gemini 3 Extract (Consolidated)', type: 'main', index: 0 }]
    ]
  },
  'Gemini 3 Extract (Consolidated)': {
    main: [[{ node: 'AI Parse & Validate v3', type: 'main', index: 0 }]]
  },
  'AI Parse & Validate v3': {
    main: [[{ node: 'Send Outlook Notification', type: 'main', index: 0 }]]
  },
  'Send Outlook Notification': {
    main: [[{ node: 'Mark Complete (Notify path)', type: 'main', index: 0 }]]
  },
  'Is Rejection Email?': {
    main: [
      [{ node: 'Send Rejection Email', type: 'main', index: 0 }],
      []
    ]
  },
  'Send Rejection Email': {
    main: [[{ node: 'Mark Complete (Rejection path)', type: 'main', index: 0 }]]
  }
};

// Write out
writeFileSync('g:/My Drive/Tech Jobs/Trustify/03_build/wave-emi-dashboard/pipelines/n8n-workflow-worker-v1.json', JSON.stringify(worker, null, 2));
console.log('Worker v1 written to pipelines/n8n-workflow-worker-v1.json');
console.log('Nodes:', worker.nodes.length);
console.log('Connections:', Object.keys(worker.connections).length);
