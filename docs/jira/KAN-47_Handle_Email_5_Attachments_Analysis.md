# KAN-47 — Handle Email with 5 Attachments: Deep Analysis

**Ticket:** [KAN-47](https://yoma-bank.atlassian.net/si/jira.issueviews:issue-html/KAN-47/KAN-47.html) — Handle email with 5 attachments
**Status:** IN PROGRESS (Vinh: Apr 17) — analysis phase
**Assignee:** DK · **Reporter:** Vinh Nguyen · **Priority:** High
**History:** Formerly KAN-28 #4. Vinh split out into standalone ticket on Apr 17 morning after DK's request. KAN-28 now closeable with #1/#2/#3 shipped.
**Predecessors DONE:** KAN-28 #1 (password/ZIP reject), #2 (empty body reject), #3 (body-only processing) — all shipped in v12.2-v12.4

---

## Verbatim Requirement (KAN-47 — Apr 17)

> - If the payroll email has multiple attachments, our pipeline will return with multiple report, the dashboard ticket detail will display separate tab for each attachment, maximum 5 payroll attachment, different in 5 different tabs, if email have more than 5 attachments = pipeline will reject, dashboard will not create ticket for this
> - If email have more than 5 attachments, our pipeline will reject, return email with instruction, dashboard will not log a ticket for this

**Note:** Vinh's split clarified the >5 rejection path needs its own instruction email (not just silent reject). Two bullets in spec = two separate behaviors confirmed.

---

## Scope Breakdown

### Pipeline side (n8n)

| Sub-task | Description | Complexity |
|----------|-------------|------------|
| P1 | Count attachments in incoming email | Low |
| P2 | Reject if >5 attachments (send rejection email) | Low — extends existing rejection pattern |
| P3 | Loop over 1-5 attachments, extract each independently | Medium-High |
| P4 | Per-attachment: file type detection (image/PDF/XLSX/CSV) | DONE (v12.3-v12.4 already handles all types) |
| P5 | Per-attachment: Gemini extraction with structured JSON | Medium |
| P6 | Merge per-attachment results into single webhook payload | Medium |
| P7 | Notification email summarizing all attachments | Low |

### Dashboard side (index.html)

| Sub-task | Description | Complexity |
|----------|-------------|------------|
| D1 | Ticket detail modal: tabbed view per attachment | Medium |
| D2 | Per-tab: side-by-side comparison (email vs attachment) | Medium — reuse existing `kan36RenderSideBySide()` |
| D3 | Tab labels: filename or "Attachment 1/2/3..." | Low |
| D4 | Amount Check: aggregate across all attachments? Or per-attachment? | **OPEN QUESTION** |
| D5 | Employee list: merge all attachment employees or separate? | **OPEN QUESTION** |

### Webhook / Supabase

| Sub-task | Description | Complexity |
|----------|-------------|------------|
| W1 | Webhook payload schema change: `attachments[]` array | Medium |
| W2 | Supabase `raw_payload` can store array (JSONB, no schema change) | Low |
| W3 | Dashboard parsing: handle both legacy single + new multi-attachment payloads | Low-Medium |

---

## Architecture Options

### Option A: Loop inside single workflow execution
- n8n's `SplitInBatches` node or Code node loop
- Process attachment 1 → Gemini → result 1, then attachment 2 → Gemini → result 2, etc.
- Merge all results at end into one webhook POST
- **Pros:** Single ticket, single webhook call, simple dashboard handling
- **Cons:** Sequential Gemini calls = slower (3-5 sec per attachment × 5 = 15-25 sec total). n8n Cloud execution timeout risk.

### Option B: Fan-out with sub-workflow
- Main workflow detects N attachments → calls sub-workflow N times
- Sub-workflow: single attachment → Gemini → result
- Main workflow: merge results → webhook
- **Pros:** Potentially parallel. Cleaner separation.
- **Cons:** n8n Cloud sub-workflow support may have limits. More complex. Credential sharing.

### Option C: Single Gemini call with all attachments
- Send ALL attachments to Gemini in one multimodal call
- Gemini 2.5 Flash supports multiple images/PDFs in one request
- Structured JSON schema requests per-attachment extraction
- **Pros:** One API call, fastest, simplest pipeline
- **Cons:** Context window limits with 5 large attachments. Gemini may confuse cross-attachment data. Schema complexity increases. XLSX/CSV can't go to Gemini directly (need text conversion first).

### Recommended: Option A (Loop) with Option C fallback for images/PDFs only

**Rationale:**
- Option A is safest and most maintainable
- Our file-type-specific handling (v12.4) already works per-attachment — we just loop
- XLSX/CSV MUST go through our pure JS inflate/parse pipeline (can't send to Gemini)
- For image/PDF-only emails, Option C is viable as optimization later
- Sequential processing aligns with KAN-46 (one-at-a-time philosophy)

---

## Open Questions (need Vinh/Rita clarification)

1. **Amount reconciliation across attachments:** If email says "100M MMK" and there are 3 attachments each showing different amounts — how does Three-Way Match work? Sum? Per-attachment? This fundamentally changes the matching logic.

2. **Employee list merge or separate?** If attachment 1 has employees A,B,C and attachment 2 has D,E,F — does the dashboard show one merged list of 6? Or separate lists per tab?

3. **Mixed file types:** Email has 1 PDF + 1 XLSX + 1 JPG — all three go through different extraction paths. Is this a real scenario? Or does Vinh expect all attachments to be the same type?

4. **What counts as an "attachment"?** Email signatures sometimes have embedded images (logos). Do we count those? We currently filter by MIME type — need to ensure signature images are excluded from the count.

5. **Per-attachment rejection:** If 1 of 3 attachments is password-protected, do we reject the entire email? Or process the other 2 and flag the failed one?

---

## Effort Estimate

| Component | Estimate | Notes |
|-----------|----------|-------|
| Pipeline: >5 rejection | 30 min | Extends existing pattern |
| Pipeline: attachment loop | 2-3 hrs | Core complexity. Loop + per-attachment Gemini + merge |
| Dashboard: tabbed UI | 2-3 hrs | New UI component in ticket detail modal |
| Webhook schema update | 30 min | Backward-compatible array wrapping |
| Testing | 2-3 hrs | Need multi-attachment test emails (2, 3, 5, 6 attachments) |
| **Total** | **7-10 hrs** | Spread across 2-3 sessions |

**Difficulty: HIGH** — this is the most architecturally complex remaining KAN-28 item. It touches pipeline, dashboard, webhook, and schema. Not a quick fix.

---

## Dependencies

- KAN-46 (sequential processing) should ideally ship first — multi-attachment + concurrent emails = race condition risk
- Need test email samples with 2-5 attachments of mixed types
- Vinh's answers to open questions above

---

## Progress Tracker

- [ ] Open questions answered by Vinh/Rita
- [ ] Architecture decision finalized
- [ ] AI Council review (if needed)
- [ ] Pipeline: >5 rejection implemented
- [ ] Pipeline: attachment loop implemented
- [ ] Pipeline: merge results logic
- [ ] Dashboard: tabbed attachment UI
- [ ] Webhook: schema backward-compatible update
- [ ] Test: 2 attachments (same type)
- [ ] Test: 3 attachments (mixed types)
- [ ] Test: 5 attachments (max)
- [ ] Test: 6 attachments (rejection)
- [ ] Test: 1 password-protected among valid ones
- [ ] Committed + pushed
- [ ] n8n re-imported + activated
- [ ] Vinh notified

---

*Last updated: Apr 16, 2026 — analysis phase*
