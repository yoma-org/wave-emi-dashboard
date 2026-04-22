// AI Parse & Validate v4 (v13.3 KAN-47 Step 5) — consumes consolidated Gemini 3
// output with multi-attachment support.
//
// WHAT CHANGED vs v13.2:
// - Merges prepData.attachments[] (raw attachment data from Step 3) with
//   d.attachment_extractions[] (Gemini results from Step 4) into a single
//   attachments[] array that is POSTed to webhook.js (Layer B).
// - webhook.js already accepts this array-shaped payload (shipped in Layer B),
//   so the dashboard will start seeing per-attachment rows automatically.
// - Primary ticket fields (company, amount, approvers, etc.) still sourced
//   from the LEGACY _gemini_result (which is attachment_extractions[0] per
//   Step 4's backward-compat), preserving v13.2 behavior for the main ticket
//   record. Layer D (dashboard) will later read attachments[] for per-tab
//   rendering; Step 5 just plumbs the data through.
//
// MODE: Run Once for All Items

const items = $input.all();
const results = [];

const prepData = $('Prepare for AI v3').first().json;
const source = prepData._source;
const from_email = prepData.from_email;
const original_subject = prepData.original_subject;
const to_email = prepData.to_email || '';
const cc_emails = prepData.cc_emails || '';
const reply_to = prepData.reply_to || '';
const email_date = prepData.email_date || '';
const message_id = prepData.message_id || '';
const thread_id = prepData.thread_id || '';
const has_attachments = prepData.has_attachments || false;
const attachment_names = prepData.attachment_names || [];
const attachment_count = prepData.attachment_count || 0;

for (const item of items) {
  const d = item.json;
  const parsed = d._gemini_result || {};
  const geminiStatus = d._gemini_status || 'none';

  if (!parsed.is_disbursement) {
    // v13.2 diagnostic: enriched with sender-facing fields for Send Failure Notification
    // Reasons that should trigger client notification (exclude infra errors like api_error)
    const NOTIFY_REASONS = ['not_disbursement_or_gemini_failed', 'gemini_parse_error', 'schema_mismatch'];
    const REASON_MAP = {
      'not_disbursement_or_gemini_failed': 'We could not identify the disbursement details in your email or attachment. This usually means the email body is missing key information (company name, amount, approvers) or the attachment could not be read clearly.',
      'gemini_parse_error': 'We could not parse the structured data from your attachment. This often happens with complex handwriting, low-resolution scans, or unusual document layouts.',
      'schema_mismatch': 'The information extracted from your email did not match the expected disbursement format. Please verify all required fields are present.',
      'empty_response': 'Our document extraction service returned an empty response. Please try resubmitting.',
      'api_error': 'A temporary technical issue occurred on our side. Please try again later.',
      'default': 'We encountered an issue processing your disbursement request.'
    };
    const reason = (geminiStatus === 'parse_error') ? 'gemini_parse_error'
                  : (geminiStatus === 'empty_response') ? 'empty_response'
                  : (geminiStatus === 'api_error') ? 'api_error'
                  : 'not_disbursement_or_gemini_failed';
    const userFriendlyReason = REASON_MAP[reason] || REASON_MAP['default'];
    const shouldNotify = NOTIFY_REASONS.includes(reason)
                        && from_email
                        && from_email.toLowerCase() !== 'emoney@zeyalabs.ai';
    return [{ json: {
      _diagnostic: true,
      _reason: reason,
      _user_friendly_reason: userFriendlyReason,
      _should_notify_sender: shouldNotify,
      from_email: from_email,
      original_subject: original_subject,
      _gemini_status: geminiStatus,
      _gemini_result_keys: parsed ? Object.keys(parsed) : [],
      _gemini_is_disbursement: parsed.is_disbursement,
      _gemini_company: parsed.company || null,
      _raw_gemini: JSON.stringify(parsed).substring(0, 500)
    }}];
  }

  const required = ['Sales HOD', 'Finance Manager'];
  const matrixResults = required.map(req => {
    const found = (parsed.approvers || []).find(a =>
      a && a.role && a.role.toLowerCase().includes(req.toLowerCase())
    );
    return { requiredRole: req, found: !!found, foundName: found ? found.name : 'MISSING' };
  });
  const matrixComplete = matrixResults.every(m => m.found);

  let scenario = 'NORMAL';
  if (!matrixComplete) scenario = 'MISSING_APPROVAL';

  const employees = Array.isArray(parsed.employees) ? parsed.employees : [];
  const extractedEmployeeCount = parsed.employee_count || employees.length;
  const docTotal = parsed.total_amount_on_document || 0;
  const visionConfidence = parsed.vision_confidence || 0;
  let emailAmount = parsed.amount || 0;

  // v12.2: body-only fallback — when Gemini text-only maps the total to
  // total_amount_on_document instead of amount (no responseSchema enforcement),
  // use docTotal as the primary amount so the ticket isn't stuck at 0.
  if (emailAmount === 0 && docTotal > 0) {
    emailAmount = docTotal;
  }

  let amountMismatch = false;
  if (docTotal > 0 && emailAmount > 0) {
    const diff = Math.abs(docTotal - emailAmount);
    amountMismatch = diff > (emailAmount * 0.01);
  }
  if (amountMismatch) scenario = 'AMOUNT_MISMATCH';

  const empSum = employees.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const empSumMismatch = emailAmount > 0 && empSum > 0
    ? Math.abs(empSum - emailAmount) > (emailAmount * 0.01)
    : false;

  const ticket = {
    company: parsed.company || 'Unknown Company',
    type: parsed.type || 'SalaryToMA',
    amount_requested: emailAmount,
    amount_on_bank_slip: docTotal > 0 ? docTotal : emailAmount,
    currency: parsed.currency || 'MMK',
    approvals: parsed.approvers || [],
    required_approvals: required,
    body_preview: parsed.body_preview || '',
    email_body_full: prepData.email_body_full || '',
    initiator_name: parsed.initiator_name || '',
    purpose: parsed.purpose || '',
    cost_center: parsed.cost_center || '',
    original_subject: original_subject,
    parsed_at: new Date().toISOString(),
    scenario,
    approval_matrix_complete: matrixComplete,
    ai_parsed: true,
    from_email, to_email, cc_emails, reply_to,
    email_date, message_id, thread_id,
    has_attachments, attachment_names, attachment_count,
    amount_on_document: docTotal,
    amount_mismatch: amountMismatch,
    document_type: parsed.document_type || '',
    doc_company_name: parsed.doc_company_name || '',
    doc_payment_date: parsed.doc_payment_date || '',
    doc_initiator_name: parsed.doc_initiator_name || '',
    doc_purpose: parsed.doc_purpose || '',
    doc_cost_center: parsed.doc_cost_center || '',
    corporate_wallet: parsed.corporate_wallet || '',
    vision_parsed: visionConfidence > 0 || extractedEmployeeCount > 0,
    vision_confidence: visionConfidence,
    vision_status: geminiStatus,
      extraction_method: d._extraction_method || "vision",
    extracted_employees: employees,
    extracted_employee_count: extractedEmployeeCount,
    employee_extraction_confidence: visionConfidence,
    employee_extraction_status: extractedEmployeeCount > 0 ? 'success' : geminiStatus,
    employee_total_extracted: empSum,
    employee_amount_mismatch: empSumMismatch,
    payment_date: parsed.payment_date || '',
    payroll_period: parsed.payroll_period || '',
  };

  // ─── v13.3 KAN-47 Step 5: merge attachments[] + attachment_extractions[] ───
  // Build a unified attachments array for webhook.js (Layer B) containing raw
  // attachment data + per-attachment Gemini extraction results. Maps extraction
  // back to raw attachment via attachment_index so invalid attachments (which
  // Gemini didn't process) still appear in the array with rejection info.
  const rawAttachments = Array.isArray(prepData.attachments) ? prepData.attachments : [];
  const extractions = Array.isArray(d.attachment_extractions) ? d.attachment_extractions : [];

  const mergedAttachments = rawAttachments.map(raw => {
    const ext = extractions.find(e => e && e.attachment_index === raw.index) || null;
    const gr = ext ? ext._gemini_result : null;
    return {
      index: raw.index,
      filename: raw.filename,
      mime_type: raw.mime_type,
      base64: raw.base64,
      size_bytes: raw.size_bytes,
      valid: raw.valid,
      rejection_reason: raw.rejection_reason,
      vision_eligible: raw.vision_eligible,
      // Per-attachment Gemini output (empty when attachment was invalid / skipped)
      vision_parsed: ext ? (ext._gemini_status === 'success_with_vision' || ext._gemini_status === 'success_text_only') : false,
      vision_confidence: gr && typeof gr.vision_confidence === 'number' ? gr.vision_confidence : 0,
      vision_status: ext ? ext._gemini_status : 'skipped_invalid',
      company: gr && gr.company ? gr.company : '',
      amount: gr && typeof gr.amount === 'number' ? gr.amount : 0,
      currency: gr && gr.currency ? gr.currency : '',
      payment_date: gr && gr.payment_date ? gr.payment_date : '',
      document_type: gr && gr.document_type ? gr.document_type : '',
      document_signers: gr && Array.isArray(gr.document_signers) ? gr.document_signers : [],
      corporate_wallet: gr && gr.corporate_wallet ? gr.corporate_wallet : '',
      doc_company_name: gr && gr.doc_company_name ? gr.doc_company_name : '',
      doc_payment_date: gr && gr.doc_payment_date ? gr.doc_payment_date : '',
      doc_initiator_name: gr && gr.doc_initiator_name ? gr.doc_initiator_name : '',
      doc_purpose: gr && gr.doc_purpose ? gr.doc_purpose : '',
      doc_cost_center: gr && gr.doc_cost_center ? gr.doc_cost_center : '',
      employees: gr && Array.isArray(gr.employees) ? gr.employees : [],
      employee_count: gr && typeof gr.employee_count === 'number' ? gr.employee_count : 0,
      total_amount_on_document: gr && typeof gr.total_amount_on_document === 'number' ? gr.total_amount_on_document : 0,
      extraction_error: gr && gr.error_message ? gr.error_message : null
    };
  });

  const webhookPayload = {
    ...ticket,
    // Legacy single-attachment fields — kept for backward compat with any
    // webhook.js code path that hasn't been updated to consume attachments[].
    attachment_base64: prepData.attachment_base64 ? prepData.attachment_base64.base64 : null,
    attachment_mime_type: prepData.attachment_base64 ? prepData.attachment_base64.mimeType : null,
    attachment_filename: prepData.attachment_base64 ? prepData.attachment_base64.filename : null,
    // v13.3 multi-attachment array — webhook.js (Layer B) prefers this when present.
    attachments: mergedAttachments,
    attachment_extraction_summary: {
      total: rawAttachments.length,
      valid: rawAttachments.filter(a => a.valid).length,
      invalid: rawAttachments.filter(a => !a.valid).length,
      stripped_smime: prepData.stripped_smime_count || 0,
      stripped_too_large: prepData.stripped_too_large_count || 0,
      extraction_count: extractions.length
    }
  };

  let ticketId = null;
  let dashboardUrl = 'https://project-ii0tm.vercel.app';
  try {
    const webhookResp = await helpers.httpRequest({
      method: 'POST',
      url: 'https://project-ii0tm.vercel.app/api/webhook',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': 'REPLACE_WITH_WEBHOOK_SECRET'
      },
      body: webhookPayload,
      json: true
    });
    if (webhookResp && webhookResp.ticket_id) {
      ticketId = webhookResp.ticket_id;
      dashboardUrl = webhookResp.dashboard_url || `https://project-ii0tm.vercel.app/?ticket=${ticketId}`;
    }
  } catch(e) { /* fallback */ }

  results.push({
    json: {
      _source: source,
      ticket_id: ticketId,
      dashboard_url: dashboardUrl,
      company: ticket.company,
      amount: emailAmount,
      type: ticket.type,
      scenario,
      matrix_complete: matrixComplete,
      matrix_details: matrixResults,
      from_email, original_subject,
      to_email, cc_emails,
      email_date,
      has_attachments, attachment_count,
      attachment_names,
      vision_parsed: ticket.vision_parsed,
      vision_confidence: ticket.vision_confidence,
      vision_status: geminiStatus,
      amount_on_document: docTotal,
      document_type: ticket.document_type,
      document_signers: Array.isArray(parsed.document_signers) ? parsed.document_signers : [],
      extracted_employees: employees,
      extracted_employee_count: extractedEmployeeCount,
      employee_extraction_confidence: visionConfidence,
      employee_extraction_status: ticket.employee_extraction_status,
      employee_total_extracted: empSum,
      employee_amount_mismatch: empSumMismatch,
      depositor_name: '',
      remark: '',
      email_body_full: ticket.email_body_full,
      transaction_id: '',
      payment_type: extractedEmployeeCount > 0 ? 'salarytoMA' : 'salarytoOTC',
      payment_date: ticket.payment_date,
      payroll_period: ticket.payroll_period,
      initiator_name: ticket.initiator_name,
      purpose: ticket.purpose,
      cost_center: ticket.cost_center,
      doc_company_name: ticket.doc_company_name,
      doc_payment_date: ticket.doc_payment_date,
      doc_initiator_name: ticket.doc_initiator_name,
      doc_purpose: ticket.doc_purpose,
      doc_cost_center: ticket.doc_cost_center,
      corporate_wallet: ticket.corporate_wallet,
      currency: ticket.currency,
      verification: {
        company_name: !!(ticket.company && ticket.company !== 'Unknown Company'),
        payment_type: true,
        amount: emailAmount > 0,
        payment_date: !!ticket.payment_date,
        payroll_period: !!ticket.payroll_period,
        approval: matrixComplete,
        attachment: attachment_count > 0,
        employee_list: extractedEmployeeCount > 0,
        initiator_name: !!ticket.initiator_name,
        purpose: !!ticket.purpose,
        cost_center: !!ticket.cost_center
      },
      attachment_base64: prepData.attachment_base64 ? prepData.attachment_base64.base64 : null,
      attachment_mime_type: prepData.attachment_base64 ? prepData.attachment_base64.mimeType : null,
      attachment_filename: prepData.attachment_base64 ? prepData.attachment_base64.filename : null,
      // v13.3 multi-attachment summary (full attachments[] intentionally NOT
      // included here — payload already POSTed to webhook.js with it, and
      // base64 blobs would bloat downstream node payloads unnecessarily)
      attachment_extraction_summary: webhookPayload.attachment_extraction_summary
    }
  });
}

return results;
