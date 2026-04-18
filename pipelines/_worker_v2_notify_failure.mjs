// KAN-46 v13.2: Notify sender on extraction failure
// Modifies worker-v2.json in place to add sender-facing failure notifications.
//
// CHANGES:
//   1. AI Parse & Validate v3 jsCode: diagnostic branch now includes
//      _user_friendly_reason, _should_notify_sender, from_email, original_subject
//   2. NEW node: "Should Notify Sender?" IF node (checks _should_notify_sender boolean)
//   3. NEW node: "Send Failure Notification" Outlook Send Message node
//   4. Connection rewire:
//        Is Diagnostic? [true]           → Should Notify Sender?
//        Should Notify Sender? [true]    → Send Failure Notification
//        Should Notify Sender? [false]   → Mark Failed (Diagnostic)
//        Send Failure Notification       → Mark Failed (Diagnostic)
//   5. Sticky note updated for v13.2 feature
//
// Run: node _worker_v2_notify_failure.mjs

import { readFileSync, writeFileSync } from 'fs';

const SRC = 'g:/My Drive/Tech Jobs/Trustify/03_build/wave-emi-dashboard/pipelines/n8n-workflow-worker-v2.json';
const worker = JSON.parse(readFileSync(SRC, 'utf8'));

// =====================================================================
// 1. MODIFY AI Parse & Validate v3 — enrich diagnostic output
// =====================================================================

const parse = worker.nodes.find(n => n.id === 'parse-validate-v3');
if (!parse) throw new Error('parse-validate-v3 node not found');

const oldDiagnosticReturn = `if (!parsed.is_disbursement) {
    // v12.2 diagnostic: instead of silent return [], output what Gemini returned
    // so we can inspect _gemini_status and _gemini_result in n8n execution view.
    return [{ json: {
      _diagnostic: true,
      _reason: 'not_disbursement_or_gemini_failed',
      _gemini_status: geminiStatus,
      _gemini_result_keys: parsed ? Object.keys(parsed) : [],
      _gemini_is_disbursement: parsed.is_disbursement,
      _gemini_company: parsed.company || null,
      _raw_gemini: JSON.stringify(parsed).substring(0, 500)
    }}];
  }`;

const newDiagnosticReturn = `if (!parsed.is_disbursement) {
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
  }`;

if (!parse.parameters.jsCode.includes(oldDiagnosticReturn)) {
  // Check if already patched (idempotent)
  if (parse.parameters.jsCode.includes('_should_notify_sender')) {
    console.log('  ✓ AI Parse diagnostic already enriched (idempotent skip)');
  } else {
    throw new Error('Could not find AI Parse diagnostic block. Manual inspection needed.');
  }
} else {
  parse.parameters.jsCode = parse.parameters.jsCode.replace(oldDiagnosticReturn, newDiagnosticReturn);
  console.log('  ✓ AI Parse & Validate v3 diagnostic enriched (added _should_notify_sender, _user_friendly_reason, from_email, original_subject)');
}

// =====================================================================
// 2. ADD new node: Should Notify Sender? (IF)
// =====================================================================

const alreadyHasShouldNotify = worker.nodes.some(n => n.id === 'should-notify-sender');

if (!alreadyHasShouldNotify) {
  const shouldNotifyNode = {
    parameters: {
      conditions: {
        options: {
          caseSensitive: true,
          leftValue: '',
          typeValidation: 'strict'
        },
        conditions: [
          {
            id: 'should-notify-check',
            leftValue: '={{ $json._should_notify_sender }}',
            rightValue: true,
            operator: {
              type: 'boolean',
              operation: 'true',
              singleValue: true
            }
          }
        ],
        combinator: 'and'
      },
      options: {}
    },
    id: 'should-notify-sender',
    name: 'Should Notify Sender?',
    type: 'n8n-nodes-base.if',
    typeVersion: 2,
    position: [1900, 400]
  };
  worker.nodes.push(shouldNotifyNode);
  console.log('  ✓ Added "Should Notify Sender?" IF node');
}

// =====================================================================
// 3. ADD new node: Send Failure Notification (Outlook Send Message)
// =====================================================================

const alreadyHasSendFailure = worker.nodes.some(n => n.id === 'send-failure-notification');

if (!alreadyHasSendFailure) {
  // Plain-text body — better deliverability than HTML for transactional emails
  const failureBody = `=✉️ Disbursement Request — Unable to Process

━━━━━━━━━━━━━━━━━━━━━━━━

Dear Sender,

Thank you for contacting Wave Money E-Money Operations.

Our automated disbursement system received your email but was unable
to extract the required information for processing.

━━━━━━━━━━━━━━━━━━━━━━━━

ℹ  What happened

{{ $json._user_friendly_reason }}

━━━━━━━━━━━━━━━━━━━━━━━━

➡  What to do next

Please resubmit your request making sure to include:

  • A clear email body with:
    - Company name requesting disbursement
    - Total amount (with currency)
    - Sales HOD + Finance Manager approvals
    - Payroll period or payment date

  • If an attachment is required:
    - Use typed/printed documents when possible
    - For handwritten payroll lists, ensure high-resolution and clear writing
    - Accepted formats: PDF, XLSX, CSV, or clear photo (JPG/PNG)

━━━━━━━━━━━━━━━━━━━━━━━━

❓  Still having issues?

If this is the second time your request has failed, please reply to
this email or contact our operations team directly.

We apologize for any inconvenience.

━━━━━━━━━━━━━━━━━━━━━━━━

Wave Money | E-Money Operations
emoney@zeyalabs.ai

Reference: {{ $('Claim & Reconstitute').first().json._queue_message_id }}`;

  const sendFailureNode = {
    parameters: {
      resource: 'message',
      operation: 'send',
      toRecipients: '={{ $json.from_email }}',
      subject: '=Re: {{ $json.original_subject || \'Your request\' }} — Unable to process',
      bodyContent: failureBody,
      options: {
        ccRecipients: 'emoney@zeyalabs.ai'
      }
    },
    id: 'send-failure-notification',
    name: 'Send Failure Notification',
    type: 'n8n-nodes-base.microsoftOutlook',
    typeVersion: 2,
    position: [2100, 300],
    credentials: {
      microsoftOutlookOAuth2Api: {
        id: 'REPLACE_WITH_OUTLOOK_CREDENTIAL_ID',
        name: 'Outlook (emoney@zeyalabs.ai)'
      }
    },
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 2000
  };
  worker.nodes.push(sendFailureNode);
  console.log('  ✓ Added "Send Failure Notification" Outlook node');
}

// =====================================================================
// 4. REWIRE connections
// =====================================================================

// Is Diagnostic? [true] → Should Notify Sender? (was: Mark Failed (Diagnostic))
// Is Diagnostic? [false] → Send Outlook Notification (unchanged)
worker.connections['Is Diagnostic?'] = {
  main: [
    [{ node: 'Should Notify Sender?', type: 'main', index: 0 }],
    [{ node: 'Send Outlook Notification', type: 'main', index: 0 }]
  ]
};

// Should Notify Sender? [true] → Send Failure Notification
// Should Notify Sender? [false] → Mark Failed (Diagnostic) (skip notification)
worker.connections['Should Notify Sender?'] = {
  main: [
    [{ node: 'Send Failure Notification', type: 'main', index: 0 }],
    [{ node: 'Mark Failed (Diagnostic)', type: 'main', index: 0 }]
  ]
};

// Send Failure Notification → Mark Failed (Diagnostic)
worker.connections['Send Failure Notification'] = {
  main: [[{ node: 'Mark Failed (Diagnostic)', type: 'main', index: 0 }]]
};

// Mark Failed (Diagnostic) → Chain Next Job (unchanged)
// (preserved from v13.1.1)

console.log('  ✓ Connections rewired: Is Diagnostic → Should Notify → {Send Failure | skip} → Mark Failed → Chain Next');

// =====================================================================
// 5. Update workflow metadata + sticky note
// =====================================================================

worker.name = 'EMI Worker v2 (KAN-46 v13.2) — Webhook + Self-Chain + Gemini Retry + Hardened Parse + Notify on Failure';

const sticky = worker.nodes.find(n => n.id === 'sticky-note-worker-v13-1');
if (sticky) {
  if (!sticky.parameters.content.includes('v13.2')) {
    sticky.parameters.content += `\n\n### v13.2 additions (Apr 18 morning)
- **Notify sender on failure**: When extraction fails (Gemini parse error, schema mismatch, etc.), sender receives a polite "Unable to process" email with a user-friendly reason + next-step checklist.
- Skip reasons that don't warrant client-facing notification: \`api_error\`, \`spool_duplicate\` (our infra, not client's problem).
- Loop protection: Should Notify Sender? IF node skips if sender = emoney@zeyalabs.ai.
- Flow: Is Diagnostic [true] → Should Notify Sender? → {true: Send Failure Notification → Mark Failed | false: Mark Failed directly}`;
  }
}

writeFileSync(SRC, JSON.stringify(worker, null, 2));
console.log('');
console.log(`✓ Patched worker-v2.json written`);
console.log(`  Nodes: ${worker.nodes.length}`);
console.log(`  Connections: ${Object.keys(worker.connections).length}`);
console.log('');
console.log('Next steps for DK:');
console.log('  1. n8n UI: Open Worker v2 → delete all nodes (or delete workflow)');
console.log('  2. Import updated pipelines/n8n-workflow-worker-v2.json');
console.log('  3. Re-paste service_role JWT in 5 places (Claim, Mark Complete x2, Chain Next, Mark Failed)');
console.log('  4. Re-paste Gemini API key + Vercel webhook_secret');
console.log('  5. Attach Outlook credential to THREE send nodes now:');
console.log('     - Send Outlook Notification (existing)');
console.log('     - Send Rejection Email (existing)');
console.log('     - Send Failure Notification (NEW)');
console.log('  6. Save (do not activate yet)');
console.log('  7. Send Wave test email — expect to receive failure notification in your inbox');
console.log('  8. Send ACME regression email — expect normal ticket + notification');
console.log('  9. Activate for Monday Myanmar testing');
