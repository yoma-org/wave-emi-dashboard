// ═══════════════════════════════════════════════════════════════
// EMI Spooler v1 — Fast Ingest to Supabase email_queue
// KAN-46: Decouples ingestion from processing for concurrency safety
// ═══════════════════════════════════════════════════════════════

const item = $input.item;
const SUPABASE_URL = 'https://dicluyfkfqlqjwqikznl.supabase.co';
const SUPABASE_SERVICE_KEY = 'REPLACE_WITH_SUPABASE_SERVICE_ROLE_KEY';

// ─────────────────────────────────────────────────────────────
// STEP 0: Unwrap n8n Webhook body if needed
// ─────────────────────────────────────────────────────────────
// n8n Webhook node (typeVersion 2) wraps POST body under `body`.
// Outlook Trigger doesn't. Detect wrapper and unwrap uniformly.
let d = item.json;
if (d && d.webhookUrl && d.headers && d.body && typeof d.body === 'object') {
  d = d.body;
}

// ─────────────────────────────────────────────────────────────
// STEP 1: Guard against malformed items
// ─────────────────────────────────────────────────────────────
if (!d || typeof d !== 'object' || Array.isArray(d)) {
  return { json: { _spool_status: 'skipped', _reason: 'malformed_item' } };
}

// Skip items that have no email metadata (e.g., binary-only fragments)
if (!d.subject && !d.bodyPreview && !d.Subject && !d.From && !(d.body && d.body.content) && !d.from) {
  return { json: { _spool_status: 'skipped', _reason: 'no_email_metadata' } };
}

// ─────────────────────────────────────────────────────────────
// STEP 2: Extract minimal metadata (Outlook format)
// ─────────────────────────────────────────────────────────────
const isEmail = d.snippet !== undefined || d.threadId !== undefined || d.Subject !== undefined ||
               d.From !== undefined || d.bodyPreview !== undefined || (d.from && d.from.emailAddress);
const source = isEmail ? 'email' : 'webhook';

function resolveValue(val) {
  if (typeof val === 'string') return val;
  if (val && typeof val === 'object') {
    if (val.text && typeof val.text === 'string') return val.text;
    if (Array.isArray(val.value) && val.value[0]) {
      return val.value.map(v => v.address || '').filter(Boolean).join(', ');
    }
    if (val.address) return val.address;
  }
  return '';
}

const subject = isEmail
  ? (d.subject || d.Subject || '')
  : (d.body?.subject || d.subject || '');

const messageId = d.id || d.messageId || d.Message_ID || '';
if (!messageId) {
  return { json: { _spool_status: 'skipped', _reason: 'no_message_id' } };
}

// Extract sender email
let fromAddress = '';
if (d.from && d.from.emailAddress && d.from.emailAddress.address) {
  fromAddress = d.from.emailAddress.address;
} else if (d.From) {
  fromAddress = resolveValue(d.From);
}

// ─────────────────────────────────────────────────────────────
// STEP 3: LOOP GUARD — skip our own outbound emails
// ─────────────────────────────────────────────────────────────
// emoney@zeyalabs.ai is CC'd on notifications; without this, pipeline loops.
// This is the ONLY filter in Spooler. All other filters run in Worker.
if (fromAddress.toLowerCase() === 'emoney@zeyalabs.ai' ||
    subject.includes('EMI Pipeline:') ||
    subject.includes('EMI Pipeline \u2014')) {
  return { json: { _spool_status: 'skipped', _reason: 'loop_guard_self_send', message_id: messageId } };
}

// ─────────────────────────────────────────────────────────────
// STEP 4: Extract binary attachments as base64 (for Worker)
// ─────────────────────────────────────────────────────────────
const attachments = [];
const MAX_ATTACHMENT_SIZE = 4 * 1024 * 1024; // 4MB per attachment
const MAX_ATTACHMENTS = 5;

if (item.binary) {
  const keys = Object.keys(item.binary).filter(k => k.startsWith('attachment_'));
  for (let j = 0; j < Math.min(keys.length, MAX_ATTACHMENTS); j++) {
    const meta = item.binary[keys[j]];
    try {
      const buffer = await helpers.getBinaryDataBuffer($itemIndex, keys[j]);
      if (buffer.length <= MAX_ATTACHMENT_SIZE) {
        attachments.push({
          filename: meta.fileName || keys[j],
          mimeType: meta.mimeType || 'application/octet-stream',
          base64: buffer.toString('base64'),
          sizeBytes: buffer.length
        });
      } else {
        attachments.push({
          filename: meta.fileName || keys[j],
          mimeType: meta.mimeType || 'application/octet-stream',
          base64: null,
          sizeBytes: buffer.length,
          _skipped_reason: 'exceeds_4mb_limit'
        });
      }
    } catch (e) {
      // Skip unreadable attachment but continue
    }
  }
}

// ─────────────────────────────────────────────────────────────
// STEP 5: Build payload for Supabase email_queue
// ─────────────────────────────────────────────────────────────
const payload = {
  message_id: messageId,
  from_address: fromAddress,
  subject: subject,
  received_at: d.receivedDateTime || new Date().toISOString(),
  payload: {
    source: source,
    raw_email: d,                        // full Outlook payload for Worker
    attachments: attachments,            // base64 attachments for Worker
    attachment_count: attachments.length,
    spooled_at: new Date().toISOString()
  }
};

// ─────────────────────────────────────────────────────────────
// STEP 6: POST to Supabase email_queue with retry (3x, 2s delay)
// ─────────────────────────────────────────────────────────────
let lastError = null;
let inserted = false;

for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    await helpers.httpRequest({
      method: 'POST',
      url: `${SUPABASE_URL}/rest/v1/email_queue`,
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=ignore-duplicates'
      },
      body: payload,
      json: true
    });
    inserted = true;
    break;
  } catch (e) {
    lastError = e;
    if (attempt < 3) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

if (!inserted) {
  // All 3 retries failed — throw so n8n marks execution as failed.
  // Operator will see failed execution in n8n UI and can investigate.
  // DK can manually mark email as unread in Outlook to replay via v12.4 fallback.
  throw new Error('Spooler failed to persist to Supabase after 3 attempts: ' + (lastError?.message || String(lastError)));
}

return {
  json: {
    _spool_status: 'queued',
    message_id: messageId,
    from_address: fromAddress,
    subject: subject,
    attachment_count: attachments.length,
    spooled_at: new Date().toISOString()
  }
};
