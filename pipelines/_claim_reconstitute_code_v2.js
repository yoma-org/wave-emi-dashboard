// ═══════════════════════════════════════════════════════════════
// EMI Worker — Claim & Reconstitute (KAN-46)
// ═══════════════════════════════════════════════════════════════
// 1. Call claim_next_email_job RPC → atomically claim ONE pending row
// 2. If queue empty, return empty array (workflow ends silently)
// 3. If claimed, reconstitute item.json + item.binary to look like Outlook Trigger output
//    so downstream v12.4 chain sees the same shape as before.

const SUPABASE_URL = 'https://dicluyfkfqlqjwqikznl.supabase.co';
const SUPABASE_SERVICE_KEY = 'REPLACE_WITH_SUPABASE_SERVICE_ROLE_KEY';

const workerId = 'worker-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);

// Call the atomic claim RPC
let claimedRows;
try {
  claimedRows = await helpers.httpRequest({
    method: 'POST',
    url: `${SUPABASE_URL}/rest/v1/rpc/claim_next_email_job`,
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
