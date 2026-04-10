import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

export default async function handler(req, res) {
  // CORS headers for n8n Cloud
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const data = req.body;
  if (!data || !data.company) {
    return res.status(400).json({ error: 'Missing required field: company' });
  }

  // Generate ticket ID (query Supabase for max)
  let ticketId = 'TKT-001';
  try {
    const { data: latest } = await supabase
      .from('tickets')
      .select('id')
      .like('id', 'TKT-%')
      .order('created_at', { ascending: false })
      .limit(1);
    if (latest && latest.length > 0) {
      const num = parseInt(latest[0].id.replace('TKT-', '')) || 0;
      ticketId = 'TKT-' + String(num + 1).padStart(3, '0');
    }
  } catch (e) { /* fallback to TKT-001 */ }

  // Determine scenario
  const approvals = data.approvals || [];
  const required = data.required_approvals || ['Sales HOD', 'Finance Manager'];
  const matrixComplete = required.every(req =>
    approvals.some(a => a.role && a.role.toLowerCase().includes(req.toLowerCase()))
  );
  const mismatch = data.amount_mismatch || false;
  let scenario = 'NORMAL';
  if (mismatch) scenario = 'AMOUNT_MISMATCH';
  else if (!matrixComplete) scenario = 'MISSING_APPROVAL';

  // Build ticket object
  const ticket = {
    id: ticketId,
    source_email_id: 'N8N-' + Date.now(),
    company: data.company || 'Unknown Company',
    type: data.type || 'SalaryToMA',
    currency: data.currency || 'MMK',
    scenario: scenario,
    amount_requested: data.amount_requested || data.amount || 0,
    amount_on_bank_slip: data.amount_on_bank_slip || data.amount_requested || data.amount || 0,
    amount_on_document: data.amount_on_document || 0,
    has_mismatch: mismatch,
    approval_matrix_complete: matrixComplete,
    required_approvals: required,
    email_approvals: approvals,
    status: mismatch ? 'ASKED_CLIENT' : 'AWAITING_EMPLOYEE_LIST',
    risk_level: mismatch || !matrixComplete ? 'HIGH' : 'LOW',
    n8n_source: true,
    n8n_parsed_at: data.parsed_at || new Date().toISOString(),
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
    vision_parsed: data.vision_parsed || false,
    vision_confidence: data.vision_confidence || 0,
    vision_status: data.vision_status || 'none',
    document_type: data.document_type || '',
    document_signers: data.document_signers || [],
    depositor_name: data.depositor_name || '',
    remark: data.remark || '',
    transaction_id: data.transaction_id || '',
    extracted_employees: data.extracted_employees || [],
    extracted_employee_count: data.extracted_employee_count || 0,
    employee_extraction_confidence: data.employee_extraction_confidence || 0,
    employee_extraction_status: data.employee_extraction_status || 'none',
    employee_total_extracted: data.employee_total_extracted || 0,
    employee_amount_mismatch: data.employee_amount_mismatch || false,
    attachment_url: null,
    attachment_mime_type: data.attachment_mime_type || null,
  };

  // Upload attachment to Supabase Storage (if present)
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY && data.attachment_base64) {
    try {
      const base64Data = data.attachment_base64;
      if (base64Data.length < 5 * 1024 * 1024) {
        const buffer = Buffer.from(base64Data, 'base64');
        const mime = data.attachment_mime_type || 'image/jpeg';
        const ext = mime.includes('pdf') ? 'pdf' : mime.includes('png') ? 'png' : 'jpg';
        const filePath = `${ticketId}/attachment.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('attachments')
          .upload(filePath, buffer, {
            contentType: mime,
            upsert: true
          });

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('attachments')
            .getPublicUrl(filePath);
          ticket.attachment_url = urlData.publicUrl;
        } else {
          console.error('Storage upload error:', uploadError.message);
        }
      }
    } catch (e) {
      console.error('Attachment upload failed:', e.message);
      // Non-blocking — ticket saves without attachment
    }
  }

  // Persist to Supabase
  let supabaseOk = false;
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    const { error } = await supabase.from('tickets').upsert(ticket, { onConflict: 'id' });
    if (error) {
      console.error('Supabase insert error:', error.message);
    } else {
      supabaseOk = true;
      // Log activity
      await supabase.from('activity_log').insert({
        ticket_id: ticketId,
        action: 'CREATE',
        message: `${ticketId} auto-created via n8n from ${data.company || 'email'}`
      });
    }
  }

  // Dashboard URLs
  const dashboardUrl = `https://project-ii0tm.vercel.app/?ticket=${ticketId}`;
  const encoded = Buffer.from(JSON.stringify(ticket)).toString('base64');
  const legacyUrl = `https://wave-emi-dashboard.vercel.app/?n8n_ticket=${encoded}`;

  return res.status(200).json({
    success: true,
    ticket_id: ticketId,
    dashboard_url: dashboardUrl,
    legacy_dashboard_url: legacyUrl,
    supabase_persisted: supabaseOk,
    company: ticket.company,
    amount: ticket.amount_requested,
    scenario: ticket.scenario,
    message: `Ticket ${ticketId} for ${ticket.company} created.`,
  });
}
