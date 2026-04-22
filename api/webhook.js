import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

// Whitelist of allowed origins for CORS (replaces wildcard *)
const ALLOWED_ORIGINS = [
  'https://project-ii0tm.vercel.app',
  'https://wave-emi-dashboard.vercel.app',
  'https://tts-test.app.n8n.cloud'
];

export default async function handler(req, res) {
  // CORS — whitelist instead of wildcard
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Webhook-Secret');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  // Webhook authentication — OPTIONAL until WEBHOOK_SECRET env var is set
  // This lets us deploy the code change safely, then enforce auth via env var
  const expectedSecret = process.env.WEBHOOK_SECRET;
  if (expectedSecret) {
    const providedSecret = req.headers['x-webhook-secret'];
    if (providedSecret !== expectedSecret) {
      return res.status(401).json({ error: 'Unauthorized — invalid or missing webhook secret' });
    }
  }

  const data = req.body;
  if (!data || !data.company) {
    return res.status(400).json({ error: 'Missing required field: company' });
  }

  // === STEP 0: Idempotency check ===
  // If n8n retries this call (network blip, transient error), don't create a duplicate ticket.
  // Check if the same message_id was already processed.
  if (data.message_id) {
    try {
      const { data: existingEmail } = await supabase
        .from('ticket_emails')
        .select('ticket_id')
        .eq('message_id', data.message_id)
        .limit(1)
        .maybeSingle();

      if (existingEmail && existingEmail.ticket_id) {
        const { data: existingTicket } = await supabase
          .from('tickets_v2')
          .select('ticket_number, company, amount_requested, scenario')
          .eq('id', existingEmail.ticket_id)
          .single();

        if (existingTicket) {
          console.log(`Idempotent replay: message_id ${data.message_id} already processed as ${existingTicket.ticket_number}`);
          return res.status(200).json({
            success: true,
            ticket_id: existingTicket.ticket_number,
            dashboard_url: `https://project-ii0tm.vercel.app/?ticket=${existingTicket.ticket_number}`,
            idempotent: true,
            message: `Already processed email ${data.message_id} as ${existingTicket.ticket_number}`,
            company: existingTicket.company,
            amount: existingTicket.amount_requested,
            scenario: existingTicket.scenario,
          });
        }
      }
    } catch (e) {
      // Non-blocking — if idempotency check fails, fall through to create
      console.warn('Idempotency check failed (falling through):', e.message);
    }
  }

  // === STEP 1: Build core ticket + insert into tickets_v2 ===
  const approvals = data.approvals || [];
  const required = data.required_approvals || ['Sales HOD', 'Finance Manager'];
  const matrixComplete = required.every(req =>
    approvals.some(a => a.role && a.role.toLowerCase().includes(req.toLowerCase()))
  );
  const mismatch = data.amount_mismatch || false;
  let scenario = 'NORMAL';
  if (mismatch) scenario = 'AMOUNT_MISMATCH';
  else if (!matrixComplete) scenario = 'MISSING_APPROVAL';

  let ticketId = null;    // UUID from DB
  let ticketNumber = null; // TKT-xxx from DB trigger

  try {
    const { data: newTicket, error: ticketErr } = await supabase
      .from('tickets_v2')
      .insert({
        company: data.company || 'Unknown Company',
        type: data.type || 'SalaryToMA',
        currency: data.currency || 'MMK',
        scenario: scenario,
        status: mismatch ? 'ASKED_CLIENT' : 'AWAITING_EMPLOYEE_LIST',
        risk_level: mismatch || !matrixComplete ? 'HIGH' : 'LOW',
        amount_requested: data.amount_requested || data.amount || 0,
        amount_on_bank_slip: data.amount_on_bank_slip || data.amount_requested || data.amount || 0,
        amount_on_document: data.amount_on_document || 0,
        has_mismatch: mismatch,
        approval_matrix_complete: matrixComplete,
        required_approvals: required,
        email_approvals: approvals,
        finance_status: 'PENDING',
        remark: data.remark || '',
        transaction_id: data.transaction_id || '',
        depositor_name: data.depositor_name || '',
        // KAN-35 email-side fields (retroactive — these were extracted since v10.1 but never persisted)
        payment_date: data.payment_date || '',
        payroll_period: data.payroll_period || '',
        // KAN-36 email-side fields (v11)
        initiator_name: data.initiator_name || '',
        purpose: data.purpose || '',
        cost_center: data.cost_center || '',
        // KAN-36 document-side mirror fields for side-by-side comparison (v11)
        doc_company_name: data.doc_company_name || '',
        doc_payment_date: data.doc_payment_date || '',
        doc_initiator_name: data.doc_initiator_name || '',
        doc_purpose: data.doc_purpose || '',
        doc_cost_center: data.doc_cost_center || '',
        // v11.4 Source Info: ticket-level fields for modal header row
        // Note: currency is NOT included here — it's already handled above
        // via `currency: data.currency || 'MMK'` in the existing insert fields.
        corporate_wallet: data.corporate_wallet || '',
        n8n_source: true,
      })
      .select('id, ticket_number')
      .single();

    if (ticketErr) {
      console.error('tickets_v2 insert error:', ticketErr.message);
      return res.status(500).json({ error: 'Failed to create ticket', detail: ticketErr.message });
    }

    ticketId = newTicket.id;
    ticketNumber = newTicket.ticket_number;
  } catch (e) {
    console.error('tickets_v2 insert exception:', e.message);
    return res.status(500).json({ error: 'Failed to create ticket', detail: e.message });
  }

  // === STEP 2: Insert email metadata into ticket_emails ===
  try {
    await supabase.from('ticket_emails').insert({
      ticket_id: ticketId,
      source_email_id: 'N8N-' + Date.now(),
      from_email: data.from_email || '',
      to_email: data.to_email || '',
      cc_emails: data.cc_emails || '',
      reply_to: data.reply_to || '',
      email_date: data.email_date || null,
      message_id: data.message_id || '',
      thread_id: data.thread_id || '',
      original_subject: data.original_subject || '',
      body_preview: data.body_preview || '',
      email_body_full: data.email_body_full || '',
      has_attachments: data.has_attachments || false,
      attachment_names: data.attachment_names || [],
      attachment_count: data.attachment_count || 0,
      n8n_source: true,
      n8n_parsed_at: data.parsed_at || new Date().toISOString(),
    });
  } catch (e) {
    console.error('ticket_emails insert error:', e.message);
    // Non-blocking — ticket already created
  }

  // === STEP 3+4: Per-attachment upload + vision_results (KAN-47 v13.3) ===
  //
  // Accepts two input shapes for backward compatibility:
  //   (a) LEGACY v13.2 — flat single-attachment fields:
  //         data.attachment_base64, data.attachment_mime_type, data.attachment_filename,
  //         data.vision_parsed, data.vision_confidence, ...
  //   (b) NEW v13.3    — `data.attachments: [{ base64, mime_type, filename, vision_*, ... }]`
  //
  // Both shapes flow through the same loop below. For legacy single-attachment shape,
  // we wrap it into a 1-item array so there's only one code path to maintain.
  //
  // Storage path: `{ticket_number}/{index}_{sanitized_filename}` — collision-safe for
  // two attachments with the same filename (Council Q7/Gemini blind spot, test #13).

  const sanitizeFilename = (name) => String(name).replace(/[^a-zA-Z0-9._-]/g, '_');

  let attachmentsInput = [];
  if (Array.isArray(data.attachments) && data.attachments.length > 0) {
    // NEW v13.3 shape
    attachmentsInput = data.attachments;
  } else if (data.attachment_base64) {
    // LEGACY v13.2 shape — wrap as 1-item array carrying flat vision fields
    attachmentsInput = [{
      base64: data.attachment_base64,
      mime_type: data.attachment_mime_type,
      filename: data.attachment_filename,
      vision_parsed: data.vision_parsed,
      vision_confidence: data.vision_confidence,
      vision_status: data.vision_status,
      document_type: data.document_type,
      document_signers: data.document_signers,
      amount_on_document: data.amount_on_document,
      depositor_name: data.depositor_name,
      remark: data.remark,
      transaction_id: data.transaction_id,
    }];
  }

  // First attachment's UUID — used only for legacy backward-compat callers that still
  // expect a single `attachment_id` in the response body.
  let firstAttachmentId = null;

  // Bucket limit is 10 MB per file; guard here to avoid a wasted round-trip to Storage.
  // Check on the decoded buffer size, not the base64 string length — a 10 MB file base64-encodes
  // to ~13.4 MB, so a base64-length threshold would either let oversized files through or
  // reject valid files under the bucket limit.
  const MAX_FILE_BYTES = 10 * 1024 * 1024;

  for (let i = 0; i < attachmentsInput.length; i++) {
    const att = attachmentsInput[i];
    const base64Data = att.base64 || att.attachment_base64;
    if (!base64Data) continue;

    let attachmentId = null;
    let storagePath = null;

    try {
      const buffer = Buffer.from(base64Data, 'base64');
      if (buffer.length > MAX_FILE_BYTES) {
        console.warn(`Skipping attachment ${i}: file ${buffer.length} bytes exceeds bucket limit ${MAX_FILE_BYTES}`);
        continue;
      }
      const mime = att.mime_type || att.attachment_mime_type || 'image/jpeg';
      const ext = mime.includes('pdf') ? 'pdf' : mime.includes('png') ? 'png' : 'jpg';
      const originalName = att.filename || att.attachment_filename || `attachment_${i}.${ext}`;
      storagePath = `${ticketNumber}/${i}_${sanitizeFilename(originalName)}`;

      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(storagePath, buffer, { contentType: mime, upsert: true });

      if (uploadError) {
        console.error(`Storage upload error (attachment ${i}):`, uploadError.message);
        continue;
      }

      // SECURITY: Store the file PATH, not a public URL.
      // Dashboard generates a signed URL (1h expiry) on demand; bucket is private.
      const { data: attRecord, error: attErr } = await supabase
        .from('ticket_attachments')
        .insert({
          ticket_id: ticketId,
          file_name: originalName,
          mime_type: mime,
          storage_url: storagePath,  // path, not URL
          size_bytes: buffer.length,
        })
        .select('id')
        .single();

      if (attErr || !attRecord) {
        console.error(`ticket_attachments insert error (attachment ${i}):`, attErr?.message);
        continue;
      }

      attachmentId = attRecord.id;
      if (i === 0) firstAttachmentId = attachmentId;

      // Per-attachment vision result — only write if the caller actually ran vision
      // on this specific attachment. A bank slip in a Pattern Z email may not have
      // vision data even if the payroll PDF does.
      if (att.vision_parsed) {
        // KAN-47 Layer D: capture per-attachment extracted fields as JSONB.
        // Layer C Parse v3 produces these on each attachments[i]. Pre-KAN-47
        // webhook.js dropped them on the floor; Layer D's multi-column SBS
        // table needs them side-by-side. Fields with dedicated columns on
        // ticket_vision_results (document_type, document_signers,
        // amount_on_document) stay in their columns — not duplicated here.
        // Requires migration 16 (extracted_fields JSONB DEFAULT '{}').
        const extractedFields = att.extracted_fields || {
          company:                  att.company                  || '',
          amount:                   att.amount                   || 0,
          currency:                 att.currency                 || '',
          payment_date:             att.payment_date             || '',
          payroll_period:           att.payroll_period           || '',
          initiator_name:           att.initiator_name           || '',
          purpose:                  att.purpose                  || '',
          cost_center:              att.cost_center              || '',
          corporate_wallet:         att.corporate_wallet         || '',
          doc_company_name:         att.doc_company_name         || '',
          doc_payment_date:         att.doc_payment_date         || '',
          doc_initiator_name:       att.doc_initiator_name       || '',
          doc_purpose:              att.doc_purpose              || '',
          doc_cost_center:          att.doc_cost_center          || '',
          employees:                Array.isArray(att.employees) ? att.employees : [],
          employee_count:           att.employee_count           || 0,
          total_amount_on_document: att.total_amount_on_document || 0,
        };

        try {
          await supabase.from('ticket_vision_results').insert({
            ticket_id: ticketId,
            attachment_id: attachmentId,
            vision_parsed: true,
            vision_confidence: att.vision_confidence || 0,
            vision_status: att.vision_status || 'none',
            document_type: att.document_type || '',
            document_signers: att.document_signers || [],
            amount_on_document: att.amount_on_document || 0,
            depositor_name: att.depositor_name || '',
            remark: att.remark || '',
            transaction_id: att.transaction_id || '',
            extracted_fields: extractedFields,
          });
        } catch (e) {
          console.error(`ticket_vision_results insert error (attachment ${i}):`, e.message);
          // Non-blocking — attachment row already created
        }
      }
    } catch (e) {
      console.error(`Attachment ${i} processing failed:`, e.message);
      // Non-blocking — continue with remaining attachments
    }
  }

  // === STEP 5: Insert employee extraction into ticket_employee_extractions ===
  if (data.extracted_employees && data.extracted_employees.length > 0) {
    try {
      await supabase.from('ticket_employee_extractions').insert({
        ticket_id: ticketId,
        extracted_employees: data.extracted_employees,
        employee_count: data.extracted_employee_count || data.extracted_employees.length,
        total_amount: data.employee_total_extracted || 0,
        confidence: data.employee_extraction_confidence || 0,
        status: data.employee_extraction_status || 'success',
        amount_mismatch: data.employee_amount_mismatch || false,
      });
    } catch (e) {
      console.error('ticket_employee_extractions insert error:', e.message);
    }
  }

  // === STEP 6: Activity log ===
  try {
    const { error: logError } = await supabase.from('activity_log').insert({
      ticket_id: ticketNumber,  // Keep TKT-xxx for readability
      action: 'CREATE',
      message: `${ticketNumber} auto-created via n8n from ${data.company || 'email'}`,
    });
    if (logError) {
      console.error('activity_log insert returned error:', logError.message, logError.details);
    }
  } catch (e) {
    console.error('activity_log insert error:', e.message);
  }

  // === RESPONSE ===
  const dashboardUrl = `https://project-ii0tm.vercel.app/?ticket=${ticketNumber}`;

  return res.status(200).json({
    success: true,
    ticket_id: ticketNumber,      // TKT-xxx for display
    ticket_uuid: ticketId,        // UUID for internal use
    dashboard_url: dashboardUrl,
    supabase_persisted: true,
    company: data.company,
    amount: data.amount_requested || data.amount || 0,
    scenario: scenario,
    message: `Ticket ${ticketNumber} for ${data.company} created.`,
  });
}
