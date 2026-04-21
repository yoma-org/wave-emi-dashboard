// Prepare raw email data for AI extraction (v11.1)
// v11.1: skip-flag pattern replaces `return []` to avoid n8n 2.14 Task Runner
//        "json property isn't an object" errors that were aborting batches and
//        dropping legitimate emails sharing the Outlook polling cycle.
// v11.1: email body preserves line breaks for dashboard display (two versions —
//        bodyForDisplay keeps \n, bodyForAI collapses whitespace for Groq).
// v11: KAN-36 extraction fields (initiator_name, purpose, cost_center)
// v10.1: KAN-35 payment_date + payroll_period
// v10: KAN-30 payment_type classification + attachment fix + verification checklist
// v5.1: full email body passthrough, circuit breaker fix
// v3: binary attachment extraction + rate limiting
// MODE: Run Once for Each Item (n8n 2.x Task Runner compatible)

const item = $input.item;

// v11.1 SKIP PATTERN: always return a valid json object. Skip Filter IF node
// downstream routes _skip:true items to a dead-end. No more `return []` errors.
const skip = (reason) => ({ json: { _skip: true, _skip_reason: reason } });

// Error guard — skip binary-only items and malformed emails
if (!item.json || typeof item.json !== 'object' || Array.isArray(item.json)) {
  return skip('malformed_item');
}
const d = item.json;

// Skip items that are just binary attachments (no email metadata)
if (!d.subject && !d.bodyPreview && !d.snippet && !d.Subject && !d.From && !(d.body && d.body.content) && !(d.payload && d.payload.headers) && !d.from) {
  return skip('no_email_metadata');
}

// Rate limit: text calls (persists across production executions)
const staticData = $getWorkflowStaticData('global');
const today = new Date().toISOString().slice(0, 10);
if (staticData.date !== today) {
  staticData.date = today;
  staticData.textCalls = 0;
  staticData.visionCalls = 0;
  staticData.visionErrors = 0;
}
if (staticData.textCalls >= 100) {
  return skip('daily_text_cap_reached');
}
staticData.textCalls++;

// Helper: resolve a value that might be string, object, or array to a readable string
function resolveValue(val) {
  if (typeof val === 'string') return val;
  if (val && typeof val === 'object') {
    if (val.text && typeof val.text === 'string') return val.text;
    if (Array.isArray(val.value) && val.value[0]) {
      const parts = val.value.map(v => v.address ? (v.name ? v.name + ' <' + v.address + '>' : v.address) : '');
      return parts.filter(Boolean).join(', ');
    }
    if (val.address) return val.name ? val.name + ' <' + val.address + '>' : val.address;
    if (Array.isArray(val)) {
      return val.map(v => resolveValue(v)).filter(Boolean).join(', ');
    }
    try { const j = JSON.stringify(val); if (j !== '{}') return j; } catch(e) {}
  }
  return '';
}

// Helper: extract any email header by name (works across all Gmail data formats)
function getHeader(name) {
  if (d.payload && d.payload.headers && Array.isArray(d.payload.headers)) {
    const h = d.payload.headers.find(h => h.name && h.name.toLowerCase() === name.toLowerCase());
    if (h && h.value) return h.value;
  }
  const capKey = name.charAt(0).toUpperCase() + name.slice(1);
  if (d[capKey]) return resolveValue(d[capKey]);
  if (d[name.toLowerCase()]) return resolveValue(d[name.toLowerCase()]);
  if (d.headers && typeof d.headers === 'object' && !Array.isArray(d.headers)) {
    const val = d.headers[name] || d.headers[name.toLowerCase()];
    if (val) return resolveValue(val);
  }
  return '';
}

const isEmail = d.snippet !== undefined || d.threadId !== undefined || d.Subject !== undefined || d.From !== undefined || (d.payload && d.payload.headers) || d.bodyPreview !== undefined || (d.from && d.from.emailAddress);
const source = isEmail ? 'email' : 'webhook';

// v13.3 KAN-47: skip Outlook drafts silently.
// Spooler v1 can pick up drafts from the mailbox depending on folder config.
// Drafts have no real content and must NOT route to Send Rejection Email
// (which would attempt to email an empty from-address). Silent skip = no
// ticket created, no rejection notification fired.
if (isEmail && d.isDraft === true) {
  return skip('outlook_draft');
}

const subject = isEmail
  ? (d.subject || getHeader('Subject') || '')
  : (d.body?.subject || d.subject || '');

// LOOP GUARD: skip our own outbound emails (notifications + returns) that land in emoney@zeyalabs.ai via CC
// v10.1+ fix: sender-based check catches return emails + future outbound types.
// Subject checks kept as belt-and-suspenders defense.
const senderEmailAddr = (d.from && d.from.emailAddress ? d.from.emailAddress.address : '').toLowerCase();
if (isEmail && (senderEmailAddr === 'emoney@zeyalabs.ai' || subject.includes('EMI Pipeline:') || subject.includes('EMI Pipeline \u2014'))) {
  return skip('loop_guard_self_send');
}

// v13.3 KAN-47: defensive skip for shape-without-content emails.
// Stronger guard than the earlier strict key-existence check. Catches cases
// where keys exist but all values are empty (Outlook draft-like payloads,
// malformed Spooler entries, webhook replay shells). Routing as
// 'no_email_metadata' makes Is Rejection Email? dead-end them (only matches
// 'empty_body'), preventing Send Rejection Email fires to empty addresses.
if (isEmail && !subject && !senderEmailAddr) {
  return skip('no_email_metadata');
}

// v6: Skip internal Yoma/Wave emails that aren't disbursement requests
const internalDomains = ['yoma.com.mm', 'wavemoney.com.mm'];
const senderDomain = (d.from && d.from.emailAddress ? d.from.emailAddress.address : '').split('@')[1] || '';
if (isEmail && internalDomains.includes(senderDomain) && !subject.toLowerCase().includes('disbursement') && !subject.toLowerCase().includes('payroll') && !subject.toLowerCase().includes('salary')) {
  return skip('internal_domain_non_disbursement');
}

let body = '';
if (isEmail) {
  body = d.textPlain || d.text || (d.body && d.body.content ? d.body.content : '') || d.bodyPreview || d.snippet || d.textHtml || '';
  if ((!body || body.length < 50) && d.payload && d.payload.parts) {
    for (const part of d.payload.parts) {
      if (part.mimeType === 'text/plain' && part.body && part.body.data) {
        try { body = Buffer.from(part.body.data, 'base64').toString('utf-8'); } catch(e) {}
        break;
      }
    }
  }
  if ((!body || body.length < 50) && d.payload && d.payload.body && d.payload.body.data) {
    try { body = Buffer.from(d.payload.body.data, 'base64').toString('utf-8'); } catch(e) {}
  }
  // v11.1 + v11.2 + v11.3 + v11.4 SCOPE FIX: Build TWO body versions
  //   1) bodyForDisplay — preserve line breaks (for dashboard "Show full email")
  //   2) body (collapsed) — fed to Groq prompt (existing behavior)
  //
  // v11.4 SCOPE FIX: declare bodyForDisplay at function scope (var inside if)
  // instead of let (block-scoped). Previously v11.3 heuristic was mutating a
  // block-scoped variable that evaporated at block exit — the return statement
  // read `typeof bodyForDisplay === 'string'` from function scope (undefined)
  // and fell back to the collapsed `body` version. Empirical proof: SQL on
  // TKT-038 showed has_newlines=false despite the heuristic code path running.
  //
  // v11.3 addition: After HTML stripping, if the result STILL has no newlines
  // AND is longer than 200 chars, inject heuristic newlines before common email
  // structure markers (Field:, bullets, signatures). This catches Outlook Web's
  // case of wrapping all content in inline tags only.
  var bodyForDisplay = body
    // Strip HTML conditional comments (<!--[if gte mso 9]>...<![endif]-->)
    .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    // Strip <head>/<style>/<script> blocks entirely
    .replace(/<(head|style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    // Convert HTML entities representing newlines BEFORE tag stripping
    .replace(/&#13;&#10;/g, '\n')
    .replace(/&#10;/g, '\n')
    .replace(/&#13;/g, '\n')
    .replace(/&#xD;/gi, '\n')
    .replace(/&#xA;/gi, '\n')
    // Convert block-breaking tags to newline (v11.3: added span as Outlook often wraps paragraphs in spans with no block tags)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote|section|article|address)>/gi, '\n')
    .replace(/<\/(ul|ol|table)>/gi, '\n\n')
    // Microsoft Office placeholder tag — treat as noise
    .replace(/<o:p>\s*<\/o:p>/gi, ' ')
    .replace(/<\/o:p>/gi, '\n')
    // Strip all remaining HTML tags → space
    .replace(/<[^>]*>/g, ' ')
    // Decode common HTML entities AFTER tag stripping
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    // Collapse spaces/tabs only (preserve newlines)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  // v11.3 HEURISTIC FALLBACK: if HTML stripping yielded no newlines but body is long,
  // inject newlines before common disbursement-email structure markers. This is a
  // pragmatic fix for Outlook Web's all-inline HTML format that our regex can't
  // structurally detect. Not perfect, but produces readable output for the typical
  // email shapes clients send.
  if (bodyForDisplay.length > 200 && bodyForDisplay.indexOf('\n') === -1) {
    bodyForDisplay = bodyForDisplay
      // Before common field labels: put on their own line
      .replace(/\s+(Initiator|Purpose|Payment Date|Payroll Period|Cost Center|Total Amount|Payment Type|Approvals?|Approved by|Requested by|Regards|Best regards|Sincerely|Thanks|Thank you)\s*[:,]/gi, '\n$1:')
      // Bullet items (- Name, Role)
      .replace(/\s+-\s+([A-Z])/g, '\n- $1')
      // Sentence boundaries (.  Capital letter) — keep conservative, only after 3+ word sentence
      .replace(/([a-z]{3,}\.)\s+([A-Z])/g, '$1\n$2')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
  // Strip Outlook external-email warnings from BOTH versions
  const stripWarnings = (s) => s
    .replace(/You don't often get email from[^.]*\./g, '')
    .replace(/Learn why this is important/g, '')
    .replace(/EXTERNAL EMAIL:[^.]*\./g, '')
    .replace(/This email originated from outside of the organization[^.]*\./g, '')
    .trim();
  bodyForDisplay = stripWarnings(bodyForDisplay);
  // AI version: fully collapsed (same semantics as pre-v11.1)
  body = bodyForDisplay.replace(/\s+/g, ' ').trim();
} else {
  const raw = d.body?.body || d.bodyPreview || d.body || '';
  body = typeof raw === 'string' ? raw : '';
  var bodyForDisplay = body;
}

let from = '';
if (isEmail) {
  // Outlook format: from.emailAddress.address
  if (d.from && d.from.emailAddress && d.from.emailAddress.address) {
    from = d.from.emailAddress.address;
  } else {
    let rawFrom = getHeader('From');
    if (!rawFrom) {
      for (const [key, val] of Object.entries(d)) {
        if (key.toLowerCase().includes('from') && typeof val === 'string' && val.includes('@')) {
          rawFrom = val; break;
        }
      }
    }
    if (typeof rawFrom === 'string' && rawFrom) {
      const m = rawFrom.match(/<([^>]+)>/);
      from = m ? m[1] : rawFrom.trim();
    }
  }
} else {
  from = d.body?.from || d.from || '';
}

// Outlook: toRecipients[].emailAddress.address, ccRecipients, receivedDateTime, conversationId

// KAN-28 #2: reject emails with empty/minimal body (Vinh spec)
// Placed AFTER from extraction (from is let-declared, can't access before init)
if (isEmail && (!body || body.trim().length < 30)) {
  return { json: { _skip: true, _skip_reason: 'empty_body', from_email: from, original_subject: subject } };
}

const to_email = isEmail ? (d.toRecipients ? d.toRecipients.map(r => r.emailAddress ? r.emailAddress.address : '').join(', ') : getHeader('To')) : '';
const cc_emails = isEmail ? (d.ccRecipients ? d.ccRecipients.map(r => r.emailAddress ? r.emailAddress.address : '').join(', ') : getHeader('Cc')) : '';
const reply_to = isEmail ? (d.replyTo ? (Array.isArray(d.replyTo) ? d.replyTo.map(r => r.emailAddress ? r.emailAddress.address : '').join(', ') : '') : getHeader('Reply-To')) : '';
const email_date = isEmail ? (d.receivedDateTime || getHeader('Date')) : '';
const message_id = d.id || (isEmail ? getHeader('Message-ID') : '') || '';
const thread_id = d.conversationId || d.threadId || '';

let has_attachments = d.hasAttachments || false;
const attachment_names = [];
function scanParts(parts) {
  if (!Array.isArray(parts)) return;
  for (const part of parts) {
    if (part.filename && part.filename.length > 0) {
      has_attachments = true;
      attachment_names.push(part.filename);
    }
    if (part.parts) scanParts(part.parts);
  }
}
if (d.payload && d.payload.parts) scanParts(d.payload.parts);
// Outlook attachments: already handled via downloadAttachments option in trigger node

// === v3 NEW: Binary attachment extraction (n8n Cloud Task Runner compatible) ===
// v13.3 KAN-47: raised MAX_ATTACHMENTS 2 → 5, added smime.p7m filter so Outlook
// digital signature blobs don't consume a slot or trigger unsupported_file_format
// rejection on emails that are otherwise processable.
const attachment_base64_list = [];
const MAX_ATTACHMENTS = 5;
const MAX_SIZE = 4 * 1024 * 1024; // 4MB Groq hard limit
let stripped_smime_count = 0;
let stripped_too_large_count = 0;

// Helper: detect Outlook S/MIME signature attachments.
// These accompany digitally-signed emails and are not user-uploaded content.
// Rejecting them as 'unsupported_file_format' (the v2 behavior) wrongly blocked
// legitimate disbursement emails that happened to be signed.
function isSmimeSignature(meta, mime) {
  const fn = (meta && meta.fileName ? meta.fileName.toLowerCase() : '');
  return (
    mime === 'application/pkcs7-signature' ||
    mime === 'application/x-pkcs7-signature' ||
    mime === 'application/pkcs7-mime' ||
    mime === 'application/x-pkcs7-mime' ||
    fn === 'smime.p7m' ||
    fn === 'smime.p7s' ||
    fn.endsWith('.p7m') ||
    fn.endsWith('.p7s')
  );
}

if (item.binary) {
  const keys = Object.keys(item.binary).filter(k => k.startsWith('attachment_'));
  for (let j = 0; j < keys.length && attachment_base64_list.length < MAX_ATTACHMENTS; j++) {
    const meta = item.binary[keys[j]];
    const mime = meta.mimeType || '';
    // v13.3: skip S/MIME signature blobs silently — not real user attachments.
    if (isSmimeSignature(meta, mime)) {
      stripped_smime_count++;
      // Also remove from attachment_names so the user-facing count is accurate.
      if (meta.fileName) {
        const idx = attachment_names.indexOf(meta.fileName);
        if (idx !== -1) attachment_names.splice(idx, 1);
      }
      continue;
    }
    // v9: Populate attachment_names for Outlook (was Gmail-only via scanParts)
    if (meta.fileName && !attachment_names.includes(meta.fileName)) {
      attachment_names.push(meta.fileName);
      has_attachments = true;
    }
    // v12.3.2: extract ALL binary types for file detection (v12.3).
        // Previously only image/* and application/pdf were extracted,
        // so ZIP/RAR/XLSX/OLE2 bypassed detection entirely.
        if (mime) {
      try {
        // Task Runner: use helpers.getBinaryDataBuffer (no this.)
        const buffer = await helpers.getBinaryDataBuffer($itemIndex, keys[j]);
        if (buffer.length <= MAX_SIZE) {
          attachment_base64_list.push({
            filename: meta.fileName || keys[j],
            mimeType: mime,
            base64: buffer.toString('base64'),
            sizeBytes: buffer.length
          });
        } else {
          stripped_too_large_count++;
        }
      } catch (e) { /* Binary extraction failed — continue without */ }
    }
  }
}

// v10/KAN-30 #2: sync has_attachments with real count (Outlook hasAttachments flag can lie when binaries not downloaded)
has_attachments = attachment_names.length > 0;

// ═══ v12.3 / KAN-28 #1: Attachment file type validation ═══
// Detects and rejects: password-protected files, ZIP/RAR/7z archives.
// Accepts: normal PDF, images, unprotected XLSX/XLS/CSV.
// Uses only Buffer ops (no npm packages — n8n Cloud Task Runner compatible).
//
// v13.3 KAN-47 refactor: logic extracted into `detectRejectReason(buf)` so we
// can validate EVERY attachment (not just [0]) and tag each with its own result.
// The original "reject the whole email if [0] fails" behavior is preserved
// unchanged in this step — that gate gets upgraded in Layer C Step 6.
function detectRejectReason(buf) {
  const hasMagic = (sig, off) => {
    if (buf.length < off + sig.length) return false;
    for (let i = 0; i < sig.length; i++) { if (buf[off + i] !== sig[i]) return false; }
    return true;
  };
  const findStr = (str, maxScan) => {
    const target = Buffer.from(str, 'utf8');
    const limit = Math.min(buf.length, maxScan || 65536);
    return buf.indexOf(target, 0) !== -1 && buf.indexOf(target, 0) < limit;
  };
  const findUtf16 = (str, maxScan) => {
    const target = Buffer.from(str, 'utf16le');
    const limit = Math.min(buf.length, maxScan || 65536);
    const pos = buf.indexOf(target, 0);
    return pos !== -1 && pos < limit;
  };

  // 1. RAR / 7z — reject immediately (unambiguous magic, zero false positives)
  if (hasMagic([0x52,0x61,0x72,0x21,0x1A,0x07], 0)) return 'rar_archive';
  if (hasMagic([0x37,0x7A,0xBC,0xAF,0x27,0x1C], 0)) return '7z_archive';

  // 2. OLE2 Compound Document (D0 CF 11 E0) — encrypted XLSX lives here
  if (hasMagic([0xD0,0xCF,0x11,0xE0,0xA1,0xB1,0x1A,0xE1], 0)) {
    if (findUtf16('EncryptedPackage') || findUtf16('EncryptionInfo')) return 'password_protected_file';
    if (!findUtf16('Workbook') && !findUtf16('Book')) return 'unsupported_file_format';
    return null; // legacy unprotected XLS — accept
  }

  // 3. ZIP-based files (PK signature) — distinguish XLSX from generic ZIP
  if (hasMagic([0x50,0x4B,0x03,0x04], 0) || hasMagic([0x50,0x4B,0x05,0x06], 0)) {
    const zipEncrypted = buf.length >= 8 && (buf.readUInt16LE(6) & 0x0001) !== 0;
    if (zipEncrypted) return 'password_protected_file';
    const isOOXML = findStr('[Content_Types].xml') && findStr('xl/');
    if (!isOOXML) return 'zip_archive';
    return null; // normal unprotected XLSX — accept
  }

  // 4. PDF encryption check
  if (hasMagic([0x25,0x50,0x44,0x46,0x2D], 0)) {
    const needle = Buffer.from('/Encrypt');
    let pos = buf.indexOf(needle, 0);
    while (pos !== -1 && pos < Math.min(buf.length, 65536)) {
      const next = buf[pos + 8];
      if (next === 0x20 || next === 0x09 || next === 0x0A || next === 0x0D || (next >= 0x30 && next <= 0x39)) {
        return 'password_protected_file';
      }
      pos = buf.indexOf(needle, pos + 8);
    }
  }
  return null;
}

// v13.3: validate EVERY attachment and tag each with its result. Downstream
// nodes (Layer C Step 6) will use this per-attachment data to apply the
// all-or-nothing rejection rule + emit combined rejection reasons.
for (let k = 0; k < attachment_base64_list.length; k++) {
  const att = attachment_base64_list[k];
  const buf = Buffer.from(att.base64, 'base64');
  att._rejectReason = detectRejectReason(buf);
  att._valid = att._rejectReason === null;
}

// BACKWARD-COMPAT GATE (v2 behavior, unchanged in Step 3):
// If the FIRST attachment has a rejection reason, reject the whole email.
// This preserves v13.2's rejection semantic for incremental test safety.
// Layer C Step 6 will replace this with the all-or-nothing + combined rule.
if (attachment_base64_list.length > 0 && attachment_base64_list[0]._rejectReason) {
  return { json: { _skip: true, _skip_reason: attachment_base64_list[0]._rejectReason, from_email: from, original_subject: subject } };
}


// ═══ v12.4: CSV/XLSX spreadsheet parsing ═══
// Detects CSV/XLSX attachments, extracts content as text for Gemini.
// Demo approach: Gemini reads the full spreadsheet text alongside email body.
let isSpreadsheet = false;
let spreadsheetText = '';
let spreadsheetRows = [];

if (attachment_base64_list.length > 0) {
  const att = attachment_base64_list[0];
  const attBuf = Buffer.from(att.base64, 'base64');
  const mime = att.mimeType || '';
  const fname = (att.filename || '').toLowerCase();

  // Detect XLSX (ZIP with OOXML markers — already passed file detection v12.3)
  const isXlsx = (mime.includes('spreadsheet') || mime.includes('excel') ||
    fname.endsWith('.xlsx') || fname.endsWith('.xls')) &&
    attBuf[0] === 0x50 && attBuf[1] === 0x4B;

  // Detect CSV/TSV
  const isCsv = mime.includes('csv') || mime.includes('tab-separated') ||
    mime === 'text/plain' || fname.endsWith('.csv') || fname.endsWith('.tsv');

  if (isXlsx) {
    // === XLSX: extract XML from ZIP, parse to 2D array ===
    try {
      // Pure JS DEFLATE — replaces require('zlib') which is blocked in n8n Cloud.
      // AI Council confirmed: DecompressionStream and node:zlib also blocked.
      
// ═══ Pure JS DEFLATE decompressor (RFC 1951) ═══
// AI Council result: n8n Cloud blocks require('zlib'), DecompressionStream,
// and node:zlib. This self-contained implementation handles all XLSX files.
function inflateRaw(input) {
  const inp = input instanceof Uint8Array ? input : new Uint8Array(input);
  const out = [];
  let bp = 0, pos = 0;

  function bits(n) {
    let r = 0;
    for (let i = 0; i < n; i++) {
      if (pos >= inp.length) throw new Error('DEFLATE: unexpected EOF');
      r |= ((inp[pos] >> bp) & 1) << i;
      if (++bp === 8) { bp = 0; pos++; }
    }
    return r;
  }
  function align() { if (bp !== 0) { bp = 0; pos++; } }

  const CLEN_ORDER = [16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];
  const LEN_BASE   = [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
  const LEN_EXTRA  = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
  const DIST_BASE  = [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
  const DIST_EXTRA = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];

  function buildHuff(lens) {
    const MAX = 15;
    const blc = new Array(MAX + 1).fill(0);
    for (let i = 0; i < lens.length; i++) if (lens[i] > 0) blc[lens[i]]++;
    const fc = new Array(MAX + 1).fill(0);
    const fs = new Array(MAX + 1).fill(0);
    let c = 0, s = 0;
    for (let b = 1; b <= MAX; b++) {
      c = (c + blc[b - 1]) << 1;
      fc[b] = c; fs[b] = s;
      s += blc[b];
    }
    const syms = new Array(s);
    const off = new Array(MAX + 1).fill(0);
    for (let i = 0; i < lens.length; i++) {
      const l = lens[i];
      if (l > 0) syms[fs[l] + off[l]++] = i;
    }
    return { blc, fc, fs, syms };
  }

  function decode(h) {
    let c = 0;
    for (let l = 1; l <= 15; l++) {
      c = (c << 1) | bits(1);
      const n = h.blc[l];
      if (n > 0) {
        const idx = c - h.fc[l];
        if (idx >= 0 && idx < n) return h.syms[h.fs[l] + idx];
      }
    }
    throw new Error('DEFLATE: invalid Huffman code');
  }

  const fixedLitLens = new Array(288);
  for (let i = 0;   i < 144; i++) fixedLitLens[i] = 8;
  for (let i = 144; i < 256; i++) fixedLitLens[i] = 9;
  for (let i = 256; i < 280; i++) fixedLitLens[i] = 7;
  for (let i = 280; i < 288; i++) fixedLitLens[i] = 8;
  const fixedLit  = buildHuff(fixedLitLens);
  const fixedDist = buildHuff(new Array(30).fill(5));

  let bfinal = 0;
  while (!bfinal) {
    bfinal = bits(1);
    const btype = bits(2);

    if (btype === 0) {
      align();
      const len  = inp[pos] | (inp[pos + 1] << 8); pos += 2;
      const nlen = inp[pos] | (inp[pos + 1] << 8); pos += 2;
      for (let i = 0; i < len; i++) out.push(inp[pos++]);
    } else if (btype === 1 || btype === 2) {
      let litH, distH;
      if (btype === 1) {
        litH = fixedLit; distH = fixedDist;
      } else {
        const hlit  = bits(5) + 257;
        const hdist = bits(5) + 1;
        const hclen = bits(4) + 4;
        const clenLens = new Array(19).fill(0);
        for (let i = 0; i < hclen; i++) clenLens[CLEN_ORDER[i]] = bits(3);
        const clenH = buildHuff(clenLens);
        const lens = new Array(hlit + hdist).fill(0);
        let i = 0;
        while (i < hlit + hdist) {
          const sym = decode(clenH);
          if (sym < 16) { lens[i++] = sym; }
          else if (sym === 16) { const rep = bits(2) + 3; const prev = lens[i - 1]; for (let k = 0; k < rep; k++) lens[i++] = prev; }
          else if (sym === 17) { const rep = bits(3) + 3; for (let k = 0; k < rep; k++) lens[i++] = 0; }
          else if (sym === 18) { const rep = bits(7) + 11; for (let k = 0; k < rep; k++) lens[i++] = 0; }
          else { throw new Error('DEFLATE: bad code-length symbol'); }
        }
        litH  = buildHuff(lens.slice(0, hlit));
        distH = buildHuff(lens.slice(hlit));
      }
      while (true) {
        const sym = decode(litH);
        if (sym < 256) { out.push(sym); }
        else if (sym === 256) { break; }
        else {
          const lsym = sym - 257;
          const len  = LEN_BASE[lsym] + bits(LEN_EXTRA[lsym]);
          const dsym = decode(distH);
          const dist = DIST_BASE[dsym] + bits(DIST_EXTRA[dsym]);
          const start = out.length - dist;
          for (let k = 0; k < len; k++) out.push(out[start + k]);
        }
      }
    } else { throw new Error('DEFLATE: reserved block type'); }
  }
  return Buffer.from(out);
}

      // ZIP local file header parser
      function extractFromZip(zipBuf, target) {
        let pos = 0;
        while (pos < zipBuf.length - 4) {
          if (zipBuf[pos]===0x50 && zipBuf[pos+1]===0x4B && zipBuf[pos+2]===0x03 && zipBuf[pos+3]===0x04) {
            const fnLen = zipBuf.readUInt16LE(pos+26);
            const exLen = zipBuf.readUInt16LE(pos+28);
            const cSize = zipBuf.readUInt32LE(pos+18);
            const cMethod = zipBuf.readUInt16LE(pos+8);
            const fn = zipBuf.toString('utf8', pos+30, pos+30+fnLen);
            if (fn.includes(target)) {
              const raw = zipBuf.subarray(pos+30+fnLen+exLen, pos+30+fnLen+exLen+cSize);
              if (cMethod === 0) return raw.toString('utf8');
              if (cMethod === 8) return (function(){ const dec = inflateRaw(raw); return new TextDecoder("utf-8").decode(dec); })();
            }
            pos += 30 + fnLen + exLen + cSize;
          } else pos++;
        }
        return null;
      }
      // Parse shared strings
      const ssXml = extractFromZip(attBuf, 'sharedStrings.xml') || '';
      const sharedStrings = [];
      const siRe = /<si[^>]*>([\s\S]*?)<\/si>/g;
      const tRe = /<t[^>]*>([\s\S]*?)<\/t>/g;
      let siM;
      while ((siM = siRe.exec(ssXml)) !== null) {
        let combined = '';
        let tM;
        while ((tM = tRe.exec(siM[1])) !== null) combined += tM[1];
        sharedStrings.push(combined.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"'));
        tRe.lastIndex = 0;
      }
      // Parse sheet1
      const sheetXml = extractFromZip(attBuf, 'sheet1.xml') || '';
      const rows = {};
      let maxCol = 0;
      const colToNum = (s) => { let n=0; for(const c of s) n=n*26+(c.charCodeAt(0)-64); return n-1; };
      const rowRe = /<row[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
      const cellRe = /<c[^>]*\br="([A-Z]+)(\d+)"(?:[^>]*\bt="([^"]*)")?[^>]*>([\s\S]*?)<\/c>/g;
      let rM;
      while ((rM = rowRe.exec(sheetXml)) !== null) {
        const rowNum = +rM[1] - 1;
        const cells = {};
        let cM;
        while ((cM = cellRe.exec(rM[2])) !== null) {
          const colIdx = colToNum(cM[1]);
          const type = cM[3] || 'n';
          const body = cM[4];
          let val = '';
          if (type === 's') {
            const vM = body.match(/<v>([\s\S]*?)<\/v>/);
            val = vM ? (sharedStrings[parseInt(vM[1])] || '') : '';
          } else if (type === 'inlineStr') {
            const tM2 = body.match(/<t[^>]*>([\s\S]*?)<\/t>/);
            val = tM2 ? tM2[1] : '';
          } else {
            const vM = body.match(/<v>([\s\S]*?)<\/v>/);
            val = vM ? vM[1] : '';
          }
          cells[colIdx] = val;
          if (colIdx > maxCol) maxCol = colIdx;
        }
        cellRe.lastIndex = 0;
        rows[rowNum] = cells;
      }
      // Build 2D array
      const rowNums = Object.keys(rows).map(Number).sort((a,b)=>a-b);
      spreadsheetRows = rowNums.map(r => {
        const arr = [];
        for (let c = 0; c <= maxCol; c++) arr.push(rows[r][c] || '');
        return arr;
      });
      // Convert to text (pipe-delimited, max 50 rows)
      const textRows = spreadsheetRows.slice(0, 50).map((r, i) =>
        'R' + (rowNums[i]+1) + ': ' + r.join(' | ')
      );
      spreadsheetText = textRows.join('\n');
      isSpreadsheet = true;
    } catch(e) {
      // XLSX parsing failed — surface the error for debugging
      spreadsheetText = 'XLSX_PARSE_ERROR: ' + (e.message || String(e));
      isSpreadsheet = false;
    }
  } else if (isCsv) {
    // === CSV: detect encoding + delimiter, parse to 2D array ===
    try {
      let csvStr = '';
      // Encoding detection
      if (attBuf[0]===0xEF && attBuf[1]===0xBB && attBuf[2]===0xBF) {
        csvStr = attBuf.toString('utf8', 3); // UTF-8 BOM
      } else if (attBuf[0]===0xFF && attBuf[1]===0xFE) {
        csvStr = attBuf.toString('utf16le', 2); // UTF-16 LE
      } else if (attBuf[0]===0xFE && attBuf[1]===0xFF) {
        csvStr = attBuf.toString('utf16le', 2); // UTF-16 BE (approximate)
      } else {
        csvStr = attBuf.toString('utf8');
      }
      // Normalize line endings
      csvStr = csvStr.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      // Delimiter detection (check first non-empty line)
      const firstLine = csvStr.split('\n').find(l => l.trim().length > 0) || '';
      const delimiters = [',', '\t', ';', '|'];
      let bestDel = ',';
      let bestCount = 0;
      for (const d of delimiters) {
        const count = (firstLine.match(new RegExp(d === '|' ? '\\|' : d, 'g')) || []).length;
        if (count > bestCount) { bestCount = count; bestDel = d; }
      }
      // Parse rows (simple split — handles most cases)
      const lines = csvStr.split('\n').filter(l => l.trim().length > 0);
      spreadsheetRows = lines.map(line => line.split(bestDel).map(c => c.trim().replace(/^"|"$/g, '')));
      // Convert to text (max 50 rows)
      spreadsheetText = spreadsheetRows.slice(0, 50).map((r, i) =>
        'R' + (i+1) + ': ' + r.join(' | ')
      ).join('\n');
      isSpreadsheet = true;
    } catch(e) {
      spreadsheetText = 'CSV_PARSE_ERROR: ' + (e.message || String(e));
      isSpreadsheet = false;
    }
  }
}


const prompt = `You are an email parser for Wave Money's EMI (Electronic Money Issuer) salary disbursement pipeline in Myanmar.

Analyze this email and extract structured data.

EMAIL SUBJECT: ${subject}
EMAIL BODY: ${body}
FROM: ${from}

Return a JSON object with these exact fields:
{
  "is_disbursement": true or false (is this a salary/EMI/disbursement/OTC request?),
  "company": "company name requesting disbursement",
  "amount": number (total amount in MMK, 0 if not found),
  "type": "SalaryToOTC" if OTC or over-the-counter is mentioned, otherwise "SalaryToMA",
  "approvers": [{"name": "person name", "role": "their title/role", "status": "Approved"}],
  "body_preview": "first 200 characters of the email body",
  "payment_date": "the date the client wants the salary to be disbursed (their intended pay day), format YYYY-MM-DD or as written; empty string if not mentioned",
  "payroll_period": "the time period the salary covers (e.g., 'March 2026' or 'Apr 1-15, 2026'); empty string if not mentioned. NOTE: payment_date is WHEN money moves, payroll_period is WHAT WORK PERIOD the money covers — these are different",
  "initiator_name": "the person or role WITHIN THE CLIENT COMPANY who is initiating this disbursement request (e.g., 'HR Manager', 'Thida Hlaing, Payroll Specialist', 'Finance Director'). This is typically the sender or a person named at the top/bottom of the email as 'Requested by' or 'From'. DIFFERENT from approvers. Empty string if not stated explicitly — do NOT infer from email domain.",
  "purpose": "why this disbursement is being made (e.g., 'March 2026 Salary', 'Q1 2026 Bonus', 'Contractor Payments for Project X'). Empty string if not mentioned.",
  "cost_center": "accounting cost center or department code if mentioned (e.g., 'HR-OPS-001', 'FIN-2026-Q1', 'DEPT-SALES'). Empty string if not mentioned."
}

IMPORTANT: Return ONLY the JSON object, no explanation or markdown.`;

return {
  json: {
    _source: source,
    from_email: from,
    original_subject: subject,
    prompt: prompt,
    to_email: to_email,
    cc_emails: cc_emails,
    reply_to: reply_to,
    email_date: email_date,
    message_id: message_id,
    thread_id: thread_id,
    has_attachments: has_attachments,
    attachment_names: attachment_names,
    attachment_count: attachment_names.length,
    // v11.1: pass full email body to dashboard with line breaks preserved
    // (capped at 2000 chars; dashboard renders with white-space:pre-line CSS)
    email_body_full: (typeof bodyForDisplay === 'string' ? bodyForDisplay : body).substring(0, 2000),
    // v3: binary attachment data for vision processing (LEGACY single-attachment shape)
    // Kept for backward compat with v13.2 Gemini Extract node (unchanged in Step 3).
    // Step 4 will switch Gemini to consume the attachments[] array below and
    // this field can be phased out once the dashboard + downstream stop reading it.
    attachment_base64: attachment_base64_list[0] || null,
    is_spreadsheet: isSpreadsheet,
    spreadsheet_text: spreadsheetText,
    spreadsheet_rows: isSpreadsheet ? spreadsheetRows : null,
    spreadsheet_row_count: isSpreadsheet ? spreadsheetRows.length : 0,
    // v12.3.2: vision_eligible only for image/pdf — XLSX/ZIP/etc should NOT
    // be sent to Gemini as inlineData (Gemini can't read spreadsheet binary).
    // v12.4: XLSX/XLS sent to Gemini via inlineData (same as PDF)
    // n8n Cloud sandbox blocks zlib so we can't parse XLSX XML ourselves.
    // Gemini reads spreadsheets directly — extracts employees + metadata.
    vision_eligible: attachment_base64_list.length > 0 && (
      attachment_base64_list[0].mimeType.startsWith('image/') ||
      attachment_base64_list[0].mimeType === 'application/pdf' ||
      false // XLSX now parsed internally, not sent to Gemini vision
    ),
    // ═══ v13.3 KAN-47: Multi-attachment array ═══
    // Each attachment carries its own validation result + vision eligibility.
    // Step 4 Gemini node will Promise.allSettled over valid entries in parallel.
    // Step 5 Parse & Validate will merge Gemini results back into this array
    // for per-attachment visibility on the dashboard (AI Assists, Human Decides).
    attachments: attachment_base64_list.map((a, i) => ({
      index: i,
      filename: a.filename,
      mime_type: a.mimeType,
      base64: a.base64,
      size_bytes: a.sizeBytes,
      valid: a._valid === true,
      rejection_reason: a._rejectReason || null,
      // v13.3 KAN-47 fix (Apr 21): XLSX/spreadsheet mimes INTENTIONALLY
      // EXCLUDED from vision_eligible. Gemini 3 Flash inlineData supports
      // only image/* + application/pdf; sending XLSX binary returns HTTP
      // 400. XLSX is parsed internally (inflateRaw) and fed to Gemini via
      // the spreadsheet_text prompt append in Gemini 3 Extract buildParts().
      // Matches v13.2 behavior that was lost in the initial Step 3 rewrite.
      vision_eligible: (
        a.mimeType.startsWith('image/') ||
        a.mimeType === 'application/pdf'
      )
    })),
    valid_attachment_count: attachment_base64_list.filter(a => a._valid).length,
    invalid_attachment_count: attachment_base64_list.filter(a => !a._valid).length,
    stripped_smime_count: stripped_smime_count,
    stripped_too_large_count: stripped_too_large_count,
  }
};
