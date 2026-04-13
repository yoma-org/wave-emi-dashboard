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

  // === STEP 3: Upload attachment to Storage + insert into ticket_attachments ===
  let attachmentId = null;
  let attachmentUrl = null;

  if (data.attachment_base64) {
    try {
      const base64Data = data.attachment_base64;
      if (base64Data.length < 5 * 1024 * 1024) {
        const buffer = Buffer.from(base64Data, 'base64');
        const mime = data.attachment_mime_type || 'image/jpeg';
        const ext = mime.includes('pdf') ? 'pdf' : mime.includes('png') ? 'png' : 'jpg';
        const originalName = data.attachment_filename || `attachment.${ext}`;
        const filePath = `${ticketNumber}/${originalName}`;

        const { error: uploadError } = await supabase.storage
          .from('attachments')
          .upload(filePath, buffer, { contentType: mime, upsert: true });

        if (!uploadError) {
          // SECURITY: Store the file PATH, not a public URL.
          // Dashboard generates a signed URL (1h expiry) on demand.
          // Bucket is private — public URL would 404 anyway.
          attachmentUrl = filePath;  // e.g., "TKT-019/payroll.pdf"

          // Insert attachment record
          const { data: attRecord } = await supabase
            .from('ticket_attachments')
            .insert({
              ticket_id: ticketId,
              file_name: originalName,
              mime_type: mime,
              storage_url: attachmentUrl,  // path, not URL
              size_bytes: buffer.length,
            })
            .select('id')
            .single();

          if (attRecord) attachmentId = attRecord.id;
        } else {
          console.error('Storage upload error:', uploadError.message);
        }
      }
    } catch (e) {
      console.error('Attachment upload failed:', e.message);
      // Non-blocking — ticket saves without attachment
    }
  }

  // === STEP 4: Insert vision results into ticket_vision_results ===
  if (data.vision_parsed) {
    try {
      await supabase.from('ticket_vision_results').insert({
        ticket_id: ticketId,
        attachment_id: attachmentId,
        vision_parsed: true,
        vision_confidence: data.vision_confidence || 0,
        vision_status: data.vision_status || 'none',
        document_type: data.document_type || '',
        document_signers: data.document_signers || [],
        amount_on_document: data.amount_on_document || 0,
        depositor_name: data.depositor_name || '',
        remark: data.remark || '',
        transaction_id: data.transaction_id || '',
      });
    } catch (e) {
      console.error('ticket_vision_results insert error:', e.message);
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
