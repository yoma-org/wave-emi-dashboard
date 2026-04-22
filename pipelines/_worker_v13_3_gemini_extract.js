// Gemini 3 Flash Parallel Extract (v13.3 — KAN-47 Step 4)
// ============================================================================
// Replaces v13.2's single-attachment call with Promise.allSettled over the
// attachments[] array emitted by Prepare for AI v3 (Step 3).
//
// Per Phase 0.6 extended probe (Apr 21): n8n Code nodes have a HARD 60s JS
// task-runner cap SHARED across items. Sequential for-loop over 5 attachments
// × ~15s Gemini = 75s → blows the cap. Parallel Promise.allSettled = slowest
// single call total time → fits with wide margin.
//
// Per-call timeout: each Gemini call wrapped in Promise.race with 25s timeout
// so one slow call can't drag the batch past the 60s ceiling.
//
// Backward compat preserved: legacy top-level fields (_gemini_result,
// _gemini_status, _gemini_usage, _gemini_has_attachment, _extraction_method)
// are still emitted from attachment_extractions[0]. This lets the unchanged
// v13.2 Parse & Validate node (until Step 5) continue consuming the same shape.
//
// MODE: Run Once for Each Item
// ============================================================================

const item = $input.item;
if (!item.json || typeof item.json !== 'object') {
  return { json: { _gemini_result: null, _gemini_status: 'skipped' } };
}
const d = item.json;
const prepData = $('Prepare for AI v3').first().json;

const GEMINI_API_KEY = 'REPLACE_WITH_GEMINI_API_KEY';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=' + GEMINI_API_KEY;
const PER_CALL_TIMEOUT_MS = 25000;   // per-attachment Gemini timeout (< 60s node cap)
const DAILY_CALL_CAP = 100;          // Gemini daily rate limit
const CIRCUIT_BREAKER_ERROR_THRESHOLD = 5;

// ─── Rate limit + circuit breaker state ────────────────────────────────────
const staticData = $getWorkflowStaticData('global');
const today = new Date().toISOString().slice(0, 10);
if (staticData.date !== today) {
  staticData.date = today;
  staticData.textCalls = 0;
  staticData.geminiCalls = 0;
  staticData.geminiErrors = 0;
}

// Determine how many Gemini calls we plan to fire this execution
const attachments = Array.isArray(prepData.attachments) ? prepData.attachments : [];
const validAttachments = attachments.filter(a => a && a.valid);
const plannedCalls = Math.max(1, validAttachments.length); // at least 1 for text-only emails

const currentCalls = staticData.geminiCalls || 0;
const currentErrors = staticData.geminiErrors || 0;

if (currentCalls + plannedCalls > DAILY_CALL_CAP) {
  return {
    json: {
      ...d,
      _gemini_result: null,
      _gemini_status: 'rate_limited',
      attachment_extractions: [],
      extraction_count: 0
    }
  };
}
if (currentErrors >= CIRCUIT_BREAKER_ERROR_THRESHOLD) {
  return {
    json: {
      ...d,
      _gemini_result: null,
      _gemini_status: 'circuit_breaker',
      attachment_extractions: [],
      extraction_count: 0
    }
  };
}

// Atomically reserve the budget BEFORE parallel fires (avoid race on counter)
staticData.geminiCalls = currentCalls + plannedCalls;

// ─── Prompt + response schema (unchanged from v13.2) ───────────────────────
const promptText = `You are an email parser for Wave Money's EMI (Electronic Money Issuer) salary disbursement pipeline in Myanmar.

Analyze the email AND the attached document (if any). Extract all fields per the provided JSON schema.

EMAIL SUBJECT: ${prepData.original_subject || ''}
EMAIL BODY: ${(prepData.email_body_full || '').slice(0, 4000)}
FROM: ${prepData.from_email || ''}

CRITICAL RULES:
- is_disbursement: true ONLY if this is a salary/EMI/disbursement/OTC payment request.
- Email-side fields (company, initiator_name, purpose, cost_center, payment_date, payroll_period) reflect what the email TEXT says.
- Document-side fields (doc_company_name, doc_initiator_name, doc_purpose, doc_cost_center, doc_payment_date) reflect what the ATTACHED DOCUMENT shows. They may differ from email-side.
- payment_date = WHEN the money is meant to be disbursed (e.g. "2026-04-20"). Format as shown or YYYY-MM-DD.
- payroll_period = WHAT WORK PERIOD the salary covers (e.g. "March 2026", "Apr 1-15, 2026").
- These are DIFFERENT fields; if present, extract both.
- corporate_wallet = the SOURCE/FUNDING wallet or account ID on the document header (labels like "Corporate Wallet", "Funding Source Account", "Source Account", "Payment Source"). Empty string if not visible.
- currency: explicit code only (MMK/USD/EUR). Do NOT infer from amount format. Empty string if unclear.
- employees[]: EVERY row in the document's employee/payroll table. Fields: name (full name as printed — required), account_or_phone (exact digits shown), amount (numeric, no commas).
- employee_count: total rows extracted. Must equal employees.length.
- total_amount_on_document: sum of amounts in the employee table, OR the document's own total if labelled.
- type: "SalaryToOTC" if the request mentions OTC / over-the-counter; otherwise "SalaryToMA".
- approvers[]: people who signed/approved, each with name + role + status (use "Approved").
- initiator_name: WITHIN the client company, who initiated the request. Different from approvers. Empty if not explicit.
- Handwritten content: extract what is legible; if a row is illegible do NOT invent values — omit it and lower vision_confidence.
- Return empty string "" for missing text fields, 0 for missing numbers, [] for empty arrays.
- document_type: one of "bank_slip", "payment_instruction", "payroll_form", "unknown".
- vision_confidence: 0.0-1.0 of how clearly the attached document was read (0.0 if no attachment).
- document_signers[]: names + roles of people who signed/authorized the attachment (signature block, "Signed by", "Authorized by" text visible on the document). Empty array if no signatures visible.
- If NO attachment is provided, extract all fields from the email body ONLY. Set vision_confidence to 0, employees to empty array (unless employee data is listed in the email body text), and all doc_* fields to empty strings.`;

const responseSchema = {
  type: "object",
  properties: {
    is_disbursement: { type: "boolean" },
    company: { type: "string" },
    amount: { type: "number" },
    type: { type: "string", enum: ["SalaryToOTC", "SalaryToMA"] },
    approvers: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          role: { type: "string" },
          status: { type: "string" }
        }
      }
    },
    body_preview: { type: "string" },
    payment_date: { type: "string" },
    payroll_period: { type: "string" },
    initiator_name: { type: "string" },
    purpose: { type: "string" },
    cost_center: { type: "string" },
    corporate_wallet: { type: "string" },
    currency: { type: "string" },
    doc_company_name: { type: "string" },
    doc_payment_date: { type: "string" },
    doc_initiator_name: { type: "string" },
    doc_purpose: { type: "string" },
    doc_cost_center: { type: "string" },
    employees: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          account_or_phone: { type: "string" },
          amount: { type: "number" }
        }
      }
    },
    employee_count: { type: "integer" },
    total_amount_on_document: { type: "number" },
    document_type: { type: "string" },
    vision_confidence: { type: "number" },
    document_signers: {
      type: "array",
      items: {
        type: "object",
        properties: { name: { type: "string" }, role: { type: "string" } }
      }
    }
  },
  required: ["is_disbursement", "company", "amount", "type"]
};

// ─── JSON extraction helper (unchanged from v13.2) ─────────────────────────
function extractBalancedJSON(text) {
  if (!text || typeof text !== 'string') return null;
  const fenceStripped = text.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim();
  try { return JSON.parse(fenceStripped); } catch(e) {}
  const candidates = [];
  for (let i = 0; i < fenceStripped.length; i++) {
    if (fenceStripped[i] === '{') {
      let depth = 1;
      for (let j = i + 1; j < fenceStripped.length; j++) {
        if (fenceStripped[j] === '{') depth++;
        else if (fenceStripped[j] === '}') {
          depth--;
          if (depth === 0) {
            candidates.push({ start: i, end: j, text: fenceStripped.slice(i, j + 1) });
            break;
          }
        }
      }
    }
  }
  candidates.sort((a, b) => b.text.length - a.text.length);
  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c.text);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch(e) {}
  }
  return null;
}

// ─── Single Gemini call — returns { parsed, status, usage } ────────────────
async function callGemini(parts, hasAttachment) {
  try {
    const resp = await helpers.httpRequest({
      method: 'POST',
      url: GEMINI_URL,
      headers: { 'content-type': 'application/json' },
      body: {
        contents: [{ parts }],
        generationConfig: (function(){
          // responseSchema enforcement only on vision calls — gemini-3-flash-preview
          // returns empty/unparseable JSON for text-only calls with schema enforcement.
          const cfg = { temperature: 0.1, maxOutputTokens: 8000, responseMimeType: 'application/json' };
          if (hasAttachment) cfg.responseSchema = responseSchema;
          return cfg;
        })()
      },
      json: true
    });

    if (resp && resp.candidates && resp.candidates[0] && resp.candidates[0].content) {
      const content = resp.candidates[0].content.parts[0].text || '';
      const extracted = extractBalancedJSON(content);
      if (extracted) {
        return {
          parsed: extracted,
          status: hasAttachment ? 'success_with_vision' : 'success_text_only',
          usage: resp.usageMetadata || null
        };
      }
      return {
        parsed: { _raw_preview: (content || '').slice(0, 500) },
        status: 'parse_error',
        usage: resp.usageMetadata || null
      };
    }
    return { parsed: null, status: 'empty_response', usage: null };
  } catch(e) {
    return {
      parsed: { error_message: e.message || String(e) },
      status: 'api_error',
      usage: null
    };
  }
}

// ─── Timeout race wrapper ──────────────────────────────────────────────────
// If the underlying call doesn't resolve within ms, resolve with a 'timeout'
// sentinel so Promise.allSettled doesn't hang. 25s < 60s node cap ensures
// the entire parallel batch finishes within the ceiling.
function withTimeout(promise, ms, attachmentLabel) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve({
      parsed: { error_message: 'Gemini call timed out after ' + ms + 'ms' },
      status: 'timeout',
      usage: null
    }), ms))
  ]);
}

// ─── Build parts array for one attachment (or text-only) ───────────────────
function buildParts(attachment) {
  let text = promptText;

  // Backward compat with v13.2: if this is attachment[0] AND v13.2 Prepare for
  // AI v3 parsed a spreadsheet for it, include the parsed text in the prompt.
  // Gemini gets both signals (spreadsheet text + inlineData if vision_eligible).
  if (attachment && attachment.index === 0 && prepData.is_spreadsheet && prepData.spreadsheet_text) {
    text = text + '\n\nSPREADSHEET ATTACHMENT CONTENT (parsed from ' +
      (attachment.filename || 'file') + '):\n' +
      prepData.spreadsheet_text +
      '\n\nIMPORTANT: Extract employee data from the SPREADSHEET rows above. ' +
      'Each data row (after the header row) is one employee. ' +
      'Map columns to: name (employee name if present), account_or_phone (wallet ID, phone, or account number), amount (numeric). ' +
      'Skip any TOTAL or summary rows. ' +
      'If no employee name column exists (wallet-only format), set name to empty string. ' +
      'Also extract metadata from the spreadsheet: corporate_wallet (From Wallet or source account), ' +
      'currency, total_amount_on_document, doc_company_name, doc_payment_date, doc_initiator_name, doc_purpose, doc_cost_center.';
  }

  const parts = [{ text }];
  if (attachment && attachment.vision_eligible && attachment.base64) {
    parts.push({ inlineData: { mimeType: attachment.mime_type, data: attachment.base64 } });
  }
  return parts;
}

// ─── Main: fire calls in parallel (or one text-only call) ──────────────────
let extractions = [];

if (validAttachments.length === 0) {
  // No attachments — fire ONE text-only call (matches v13.2 behavior)
  const result = await withTimeout(callGemini(buildParts(null), false), PER_CALL_TIMEOUT_MS);
  extractions.push({
    attachment_index: null,
    filename: null,
    mime_type: null,
    _gemini_result: result.parsed,
    _gemini_status: result.status,
    _gemini_usage: result.usage
  });
  if (result.status === 'api_error' || result.status === 'parse_error' || result.status === 'empty_response' || result.status === 'timeout') {
    staticData.geminiErrors = (staticData.geminiErrors || 0) + 1;
  } else {
    staticData.geminiErrors = 0;
  }
} else {
  // Fire all valid attachments in parallel — Promise.allSettled so one
  // failure doesn't abort the batch.
  const promises = validAttachments.map(att => {
    return withTimeout(callGemini(buildParts(att), att.vision_eligible), PER_CALL_TIMEOUT_MS, att.filename)
      .then(result => ({
        attachment_index: att.index,
        filename: att.filename,
        mime_type: att.mime_type,
        _gemini_result: result.parsed,
        _gemini_status: result.status,
        _gemini_usage: result.usage
      }));
  });

  const settled = await Promise.allSettled(promises);

  let errorInc = 0;
  extractions = settled.map((s, i) => {
    if (s.status === 'fulfilled') {
      const v = s.value;
      if (v._gemini_status === 'api_error' || v._gemini_status === 'parse_error' || v._gemini_status === 'empty_response' || v._gemini_status === 'timeout') {
        errorInc++;
      }
      return v;
    }
    // Promise itself rejected (shouldn't happen since callGemini catches, but defensive)
    errorInc++;
    return {
      attachment_index: validAttachments[i].index,
      filename: validAttachments[i].filename,
      mime_type: validAttachments[i].mime_type,
      _gemini_result: { error_message: String(s.reason) },
      _gemini_status: 'rejected',
      _gemini_usage: null
    };
  });

  if (errorInc > 0) {
    staticData.geminiErrors = (staticData.geminiErrors || 0) + errorInc;
  } else {
    staticData.geminiErrors = 0;
  }
}

// ─── Backward compat: emit legacy top-level fields from extractions[0] ─────
// The unchanged v13.2 Parse & Validate node (Step 5 target) reads these.
const first = extractions[0] || null;

return {
  json: {
    ...d,
    _gemini_result: first ? first._gemini_result : null,
    _gemini_status: first ? first._gemini_status : 'none',
    _gemini_usage: first ? first._gemini_usage : null,
    _gemini_has_attachment: validAttachments.length > 0,
    _extraction_method: prepData.is_spreadsheet ? 'spreadsheet' : (validAttachments.length > 0 ? 'vision' : 'text_only'),
    // v13.3 NEW — per-attachment parallel extractions (Step 5 will aggregate)
    attachment_extractions: extractions,
    extraction_count: extractions.length
  }
};
