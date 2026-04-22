---
name: KAN-47 Layer D — Dashboard Multi-Attachment Rendering Plan
description: Detailed implementation plan for dashboard index.html changes to support multi-attachment ticket rendering. Follows the v3 canonical mockup (kan47_tabbed_ui_v3_mockup.html). Layer C is shipped; this plan covers the final user-facing piece.
type: project
status: active
created: 2026-04-21
---

# Layer D — Dashboard Multi-Attachment Rendering

## Context

Layer C (n8n pipeline) is feature-complete and validated through TKT-007 (single XLSX) + TKT-008 (4 parallel attachments). Dashboard currently renders the LEGACY single-attachment view even for multi-attachment tickets — TKT-008 shows "4 file(s): filename1, filename2, ..." as a comma list instead of per-attachment tabs.

Layer D rewrites parts of `wave-emi-dashboard/index.html` to render multi-attachment tickets per the v3 canonical mockup, while preserving single-attachment ticket rendering unchanged (backward compat with TKT-001 through TKT-007).

## Canonical references

- Mockup: [`docs/mockups/kan47_tabbed_ui_v3_mockup.html`](../mockups/kan47_tabbed_ui_v3_mockup.html) — visual target
- Database: `ticket_attachments` table (FK to tickets_v2.id), populated by Layer C via webhook.js `attachments[]` array
- Live working example to test against: **TKT-008** (4 PDFs attached, AMOUNT_MISMATCH scenario)

## Design principle (from mockup)

"AI Assists, Human Decides" — no aggregation, no dedup, no inference. Side-by-side rendering; Finance eyeballs and decides. Summary tab is a multi-column table with one column per attachment + one column for email-side extraction.

## Implementation plan

### Step 1 — Data access layer

Add helper function in `index.html`:

```js
async function fetchTicketAttachments(ticketId) {
  // Query ticket_attachments rows joined with ticket_vision_results
  // Returns: [{ id, index, filename, mime_type, storage_url, size_bytes,
  //            valid, rejection_reason, vision_parsed, vision_confidence,
  //            extracted_fields: { company, amount, currency, payment_date,
  //            document_type, document_signers, corporate_wallet,
  //            doc_company_name, doc_payment_date, doc_initiator_name,
  //            doc_purpose, doc_cost_center, employees, employee_count,
  //            total_amount_on_document } }]
}
```

Database query:
```sql
SELECT ta.*, tvr.vision_parsed, tvr.vision_confidence, tvr.extracted_fields
FROM ticket_attachments ta
LEFT JOIN ticket_vision_results tvr ON tvr.attachment_id = ta.id
WHERE ta.ticket_id = $1
ORDER BY ta.created_at ASC;
```

Exposed via new Supabase view or direct query.

### Step 2 — Dispatch logic in `openTicketDetail()`

```js
async function openTicketDetail(ticketId) {
  const ticket = await fetchTicket(ticketId);
  const attachments = await fetchTicketAttachments(ticketId);

  if (attachments.length <= 1) {
    // Single-attachment or zero-attachment ticket — use legacy single-column render
    renderTicketDetailLegacy(ticket, attachments[0] || null);
  } else {
    // Multi-attachment — use new tabbed render
    renderTicketDetailMulti(ticket, attachments);
  }
}
```

**Backward compat**: TKT-001 through TKT-007 hit the legacy render path. Zero behavior change for those tickets.

### Step 3 — `renderTicketDetailMulti(ticket, attachments)`

Top-level structure (mirrors mockup):

```html
<div class="ticket-modal">
  <div class="ticket-header">
    <h3>{ticket_number} · {subject}</h3>
    <div class="ticket-meta">...</div>
    <div class="ticket-badges">
      <span class="badge badge-wave">{type}</span>
      <span class="badge badge-{risk}">{risk_level} risk</span>
      <span class="badge badge-summary">{N} attachments · side-by-side</span>
    </div>
  </div>

  <div class="tabstrip">
    <div class="tab summary active" data-tab="summary">Summary</div>
    {attachments.map(a => `<div class="tab" data-tab="att-${a.index}">${a.index + 1}. ${a.filename}</div>`)}
  </div>

  <div class="tab-panel" id="panel-summary">
    {renderEmailPreview(ticket)}
    {renderMultiColumnSBS(ticket, attachments)}
    {renderThreeWayMatchVisual(ticket, attachments)}
  </div>

  {attachments.map(a => `
    <div class="tab-panel hidden" id="panel-att-${a.index}">
      {renderSingleAttachmentDetail(a)}
    </div>
  `)}

  <div class="action-bar">
    <button class="btn-ghost" onclick="returnToClient()">↩ Return to Client</button>
    <button class="btn-primary" onclick="openCsvDialog()">📊 Generate CSV for Finance</button>
  </div>
</div>
```

Tab switching is vanilla JS: click handler on `.tab` swaps `.active` class and shows/hides corresponding `.tab-panel`.

### Step 4 — `renderMultiColumnSBS(ticket, attachments)`

Table with rows = field names, columns = {Field, Email, Att 1, Att 2, ..., Att N}.

Fields to compare:
- Company Name (ticket.company vs attachment.doc_company_name or .company)
- Total Amount (ticket.amount_requested vs attachment.total_amount_on_document or .amount)
- Currency
- Payment Date (ticket.payment_date vs attachment.doc_payment_date)
- Payroll Period
- Initiator Name (ticket.initiator_name vs attachment.doc_initiator_name)
- Purpose
- Cost Center

Row coloring:
- `.match` (green) if all non-empty values agree
- `.mismatch` (yellow) if 2+ non-empty values disagree
- `.neutral` (gray) if only email side has value (attachments empty — not a mismatch)

"Not extracted" display in italic for empty attachment values.

### Step 5 — `renderThreeWayMatchVisual(ticket, attachments)`

Visual comparison box (NOT a PASS assertion — per v3 principle):

```html
<div class="twm-box">
  <h4>🔺 Three-Way Match — visual comparison</h4>
  <div class="twm-note">Finance eyeballs alignment. No automated pass/fail.</div>
  <div class="twm-grid">
    <div class="twm-card">
      <div class="src">Email says</div>
      <div class="amount">{ticket.amount_requested} {ticket.currency}</div>
    </div>
    <div class="twm-card">
      <div class="src">Attachment total</div>
      <div class="amount">{sum of extracted total_amount_on_document across attachments}</div>
    </div>
    <div class="twm-card">
      <div class="src">Employee rows</div>
      <div class="amount">{sum of employee amounts across attachments}</div>
    </div>
  </div>
</div>
```

### Step 6 — `renderSingleAttachmentDetail(attachment)`

Per-tab view: single attachment's full extraction. Similar to the CURRENT legacy single-attachment view, but scoped to one attachment.

- Preview frame (PDF embedded via storage_url, image inline, XLSX download link)
- Extraction fields table
- Employee list table
- Document type, confidence, signers

### Step 7 — `renderEmailPreview(ticket)`

Collapsible block at top of Summary panel (per mockup lines 309-328):
- Header (always visible): from, subject, attachment count + filenames
- Body (expandable): full email body text

### Step 8 — CSV source-picker dialog

Triggered by "Generate CSV for Finance" button. Modal dialog:

```html
<div class="dialog">
  <h4>Which attachment has the employee list?</h4>
  {attachments.filter(a => a.employees && a.employees.length > 0).map(a => `
    <div class="opt" data-source="${a.index}">
      <div class="radio"></div>
      <div class="opt-text">
        <b>${a.filename}</b>
        <small>${a.employees.length} employees · ${formatAmount(a.total_amount_on_document)}</small>
      </div>
    </div>
  `)}
  <div class="action-bar">
    <button class="btn-ghost" onclick="closeDialog()">Cancel</button>
    <button class="btn-primary" onclick="downloadCsvForSource()" disabled id="dl-btn">Generate CSV</button>
  </div>
</div>
```

On selection, highlight the chosen option + enable the Generate button. Download triggers the existing CSV generation logic but scoped to that attachment's `employees[]`.

### Step 9 — Wiring + smoke test

- Wire `openTicketDetail()` dispatch
- Test against TKT-008 in browser (should now render 4 tabs + SBS)
- Test against TKT-007 (single XLSX — should STILL render legacy view, not multi)
- Test against TKT-003/TKT-005/TKT-006 (single PDF — legacy view)

## File changes

Only one file: `wave-emi-dashboard/index.html`

Estimated LOC:
- Add: ~400-600 lines (new functions + CSS for tabs + dispatch logic)
- Modify: ~20 lines (openTicketDetail dispatch branching)
- No delete (legacy render preserved for backward compat)

## CSS scoping

The mockup CSS uses variable names like `--navy`, `--accent`, etc. These must match the existing `index.html` CSS variables to avoid conflicts. Verify before copying classes verbatim:

```bash
grep "var(--navy)" wave-emi-dashboard/index.html
grep "var(--accent)" wave-emi-dashboard/index.html
```

If names match → paste mockup CSS wholesale into a new `/* KAN-47 Multi-Attachment Tabs */` block. If names differ, rename tokens in the pasted CSS.

## Test checklist

- [ ] TKT-008 renders with 4 tabs + Summary tab selected by default
- [ ] Switching tabs shows correct per-attachment detail
- [ ] Summary SBS table colors rows correctly (match green, mismatch yellow)
- [ ] Three-Way Match shows 3 distinct amounts without PASS/FAIL
- [ ] CSV source-picker only lists attachments with `employees.length > 0`
- [ ] CSV generation downloads the correct attachment's employee data
- [ ] Email preview collapses and expands
- [ ] TKT-007 (single XLSX) renders UNCHANGED (legacy view)
- [ ] TKT-003, TKT-005, TKT-006 (single PDF) render UNCHANGED (legacy view)
- [ ] Return to Client button works for both single and multi
- [ ] Mobile viewport renders without horizontal scroll breakage

## Open questions

1. **Where to query ticket_attachments from?** Current dashboard uses direct Supabase queries via supabase-js client. Add a new query function `fetchTicketAttachments(ticketId)`. OR create a view (`ticket_detail_view`) that joins everything — would be cleaner for dashboard but adds a migration.
2. **Storage URL handling**: Supabase Storage URLs need signed access tokens for private buckets. The current dashboard uses `supabase.storage.from('attachments').createSignedUrl(...)` — apply the same pattern for multi-attachment preview frames.
3. **What happens to Vinh's testing?** Step 6+7 deferred smoke tests (too_many_attachments, combined rejection) should be documented in the Phase 1.5 acceptance checklist so Myanmar team or Vinh can validate before cutover.

## Deferred from this session (Layer C tests)

- **too_many_attachments** smoke test — requires 6+ attachments to survive Graph API strip. Send 8 small PDFs (each under 1MB) to validate. Gate logic is deterministic; deferred for time.
- **combined rejection** smoke test — requires password PDF + ZIP + another unsupported file. Fixtures harder to prepare. Gate logic is deterministic; deferred for time.

Both are documented in the commit messages (`a663bc2`, `8445a21`) and session log `CP-23`. Safe to defer; can be validated by Vinh / Myanmar team in Phase 1.5.
