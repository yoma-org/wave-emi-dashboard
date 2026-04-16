# KAN-28 + KAN-42 — Analysis, Scope, Triage

**Status (as of Apr 16 10:00):**
- ✅ **KAN-42 SHIPPED** via 3-commit reorg (`8a5ab94` + `cc4e659` + `3ef438a`). Verified on TKT-044 + TKT-045.
- ✅ **KAN-28 #2 SHIPPED** — empty body rejection. Skip + Is Rejection Email? IF + Send Rejection Email node. Tested: rejection email sent, no ticket created.
- ✅ **KAN-28 #3 SHIPPED** — body-only processing. Conditional responseSchema (vision-only) + amount fallback. TKT-049: 4 employees extracted from inline text, Three-Way Match green.
- ✅ **v12.2 signers patch SHIPPED** — document_signers in Gemini schema + prompt + Parse passthrough.
- ⏸️ **KAN-28 #1** — password-protected Excel detection. Needs research (magic-byte, OLE2 vs ZIP signatures).
- ⏸️ **KAN-28 #4** — multiple attachments. Deferred per Vinh ("waiting for final solution" + align with Rita).

**Created:** 2026-04-15 evening, post-v12.1 ship
**Assignee:** DK · **Reporter:** Vinh Nguyen · **Priority:** both High
**Source PDFs:**
- [KAN-28_eMoney_n8n_Pipeline_Enhancement.pdf](KAN-28_eMoney_n8n_Pipeline_Enhancement.pdf)
- [KAN-42_eMoney_Enhance_Ticket_Detail.pdf](KAN-42_eMoney_Enhance_Ticket_Detail.pdf)

---

## 📋 Verbatim requirements

### KAN-28 — n8n Pipeline Enhancement (4 edge cases)

1. **Password-protected Excel** → pipeline rejects the file, sends a return email explaining "pipeline only supports non-password, non-data-encrypt files", dashboard does NOT create a ticket.
2. **Empty email body (title only, with or without attachment)** → pipeline rejects, sends return email instructing the user to "update their email body with attachment", dashboard does NOT create a ticket.
3. **Payroll data in email body, no attachment** → pipeline PROCEEDS using the email body alone; no attachment required.
4. **Multiple attachments** → pipeline returns a report per attachment; dashboard ticket detail shows a separate tab per attachment. *(Vinh note: "waiting for final solution")*

### KAN-42 — Enhance Ticket Detail (2 UX tweaks)

1. **Rename "Document" → "Attachment"** in the "AI Analysis — Email vs Document" section (including the table's "From Document (Vision)" column header). Rationale: "user will understand that we're comparing email body versus attachment; using the word Document will confuse them."
2. **Remove the "Pipeline Details (Technical)" collapsible dropdown section entirely.** Rationale: "we already have the Email vs Document [table] above; we don't need to show Pipeline Details (Technical)."

---

## 🎯 Scope triage — what ships today vs later

| Item | Effort | Risk | Ship Today? | Reason |
|---|---|---|---|---|
| **KAN-42 #1** Rename Document → Attachment | XS (~10 min) | Very low | ✅ YES | Pure index.html string edits; no pipeline touches |
| **KAN-42 #2** Remove Pipeline Details section | XS (~10 min) | Very low | ✅ YES | Pure index.html block deletion |
| **KAN-28 #2** Empty body rejection | S (~30 min) | Low | ✅ YES (if time) | Small additive change to Prepare for AI v3 Skip Filter path; re-import to n8n |
| **KAN-28 #3** Body-only (no attachment) processing | S (~30 min) | Low | ✅ YES (likely already works) | v12 pipeline may already handle this; need verification |
| **KAN-28 #1** Password-protected Excel rejection | M (~1-2 hrs) | Medium | ❌ TOMORROW | Requires research on password-protect detection (magic-byte check, try-decrypt pattern, or XLSX structural signature) |
| **KAN-28 #4** Multiple attachments (per-attachment tab) | L-XL (~3-5 hrs) | High | ❌ TOMORROW/LATER | Vinh flagged as "waiting for final solution" — architectural change: schema supports array of extractions, dashboard needs tab UI |

---

## 🧩 Debt-overlap radar (the "one stone, two targets" opportunity)

### KAN-28 #3 (body-only processing) ↔ **Outlook HTML body regex failure** (known issue)
**Overlap: HIGH.** If Gemini extracts from email body alone (no attachment), the body text quality matters more than ever. Our current v11.3 heuristic newline injection is a band-aid. When we implement Case #3, it's the natural moment to fix the plain-text-body-from-Graph-API migration (Option 1 in `known_issue_outlook_html_body_format.md`). Two targets one stone.

### KAN-28 #4 (multiple attachments) ↔ **CSV/XLSX pipeline parsing** (deferred)
**Overlap: HIGH.** If the pipeline supports N attachments, one of them could be CSV/XLSX while another is a PDF/image. This is the natural moment to wire in SheetJS server-side (or via `xlsx` npm package in a Code node) so a CSV attachment flows through the same extraction schema. DK mentioned "I might have the solution for you after we done Vinh new ticket" — this is likely what DK foresaw.

### KAN-28 #1 (password-protected detection) ↔ **nothing in current debt list**
**Overlap: LOW.** Standalone capability; doesn't fold in elsewhere.

### KAN-28 #2 (empty body rejection) ↔ **Skip Filter pattern** (already exists)
**Overlap: MEDIUM.** v12's Skip Filter already routes `_skip: true` items away. Case #2 is adding one more skip reason (`empty_body`) + a return email. Clean extension, not a new mechanism.

### KAN-42 #1 (rename Document → Attachment) ↔ **nothing in debt list**
**Overlap: NONE.** Pure UX polish. Ship clean.

### KAN-42 #2 (remove Pipeline Details section) ↔ **Dashboard bloat**
**Overlap: LOW but positive.** Reducing dashboard surface area = fewer places to maintain. Aligns with KAN-34 UI simplification direction.

---

## 🏗️ Implementation notes (for tomorrow's coding session)

### KAN-42 #1 — Rename Document → Attachment
- Locations in `index.html`:
  - Section header `AI ANALYSIS — EMAIL VS DOCUMENT` → `EMAIL VS ATTACHMENT`
  - Table column `From Document (Vision)` → `From Attachment (Vision)`
  - Any inline text referring to "document" in the KAN-36 side-by-side block
- Keep internal variable names (`doc_company_name`, `amount_on_document` etc.) — only user-facing strings change.
- Also check notification email template if it says "document" anywhere.

### KAN-42 #2 — Remove Pipeline Details (Technical) section
- Grep `index.html` for `PIPELINE DETAILS` or `Pipeline Details (Technical)` — find the collapsible `<details>` or div block.
- Delete the block entirely; verify nothing else references its inner IDs.
- Side-by-side table already carries all the info, so no downstream refactor needed.

### KAN-28 #2 — Empty body rejection
- In `Prepare for AI v3` node's jsCode, after body extraction (~around where `body` variable is finalized):
  ```js
  if ((!body || body.trim().length < 20) && attachment_base64_list.length === 0) {
    // Empty body AND no attachment — reject
    return skip('empty_body_no_attachment');
  }
  if ((!body || body.trim().length < 20) && attachment_base64_list.length > 0) {
    // Empty body but has attachment — Vinh says reject this too with instruction
    return skip('empty_body_with_attachment');
  }
  ```
- New n8n logic branch: Skip Filter's "true" arm (currently dead-ends) should route to a new **Send Return Email** node that sends Vinh's instruction back to the sender.
- This requires adding 1 new node + 1 new connection. Small pipeline edit.

### KAN-28 #3 — Body-only processing (likely already works)
**Verification first, before any code.** Our v12 Gemini 3 Extract node:
```js
const parts = [{ text: prompt }];
if (attachment && visionEligible) {
  parts.push({ inlineData: { ... } });
}
```
**It already handles attachment-less items** — the Gemini call sends text only if no attachment. Just need to verify the prompt emphasizes extracting from body when no attachment is present (it currently does). Test with a real payroll email containing all info in the body.

If verification confirms, this becomes a no-code ticket — we just document it as working.

### KAN-28 #1 — Password-protected Excel rejection
**Research needed before coding:**
- XLSX file signature starts with `PK` (ZIP). Password-protected XLSX uses OLE2 compound file signature `D0 CF 11 E0 A1 B1 1A E1` — different magic bytes.
- Detection approach: in Prepare node, check attachment's first bytes against both signatures; if OLE2 with no readable XML, reject.
- Alternative: attempt to unzip; if unzip fails with "encrypted" error → reject.
- Libraries: `exceljs` or `xlsx` in a Code node would give us read-attempt + error handling.
- New skip reason: `password_protected_file`.
- New return email template: "Pipeline only supports non-password, non-encrypted files. Please resend an unprotected version."

### KAN-28 #4 — Multiple attachments (architectural)
**Defer. Vinh flagged "waiting for final solution."** When we do tackle it:
- Schema change: `_gemini_result` becomes array of results, one per attachment
- Webhook payload: `attachments[]` with per-attachment extraction
- DB: either denormalize (multiple rows per ticket) or add `ticket_attachments` table
- Dashboard: `<details>` tabs per attachment in the detail modal
- Non-trivial. Best done post Apr 20 go-live.

---

## 🚦 Recommended execution plan

### Tonight (Apr 15 evening, ~45 min max)
1. **KAN-42 #1 + #2** — rename + remove section (~20 min combined)
2. **Commit + push** — 1 commit for KAN-42
3. **Verify KAN-28 #3 is already supported** — send one body-only payroll email, confirm extraction works, document finding (no code if already works) (~15 min)
4. **Draft Teams update to Vinh** covering KAN-36 + v11.4 + v12 + v12.1 + KAN-42 shipped (save draft; send whenever)

### Tomorrow (Apr 16)
1. **KAN-28 #2** — empty body rejection + return email node (~45 min + n8n re-import)
2. **KAN-28 #1** — password-protected detection (~1-2 hrs with research)
3. **KAN-28 #3** — if verification tonight shows gaps, fix them
4. **Bundle for the "body-only + Outlook plain-text"** — fold in Outlook plain-text body fix (known_issue) since Case #3 depends on body quality

### Later (post go-live or on explicit Vinh green-light)
- **KAN-28 #4** (multiple attachments) — architectural
- **CSV/XLSX pipeline parsing** — natural fold-in once #4 is designed

---

## ⚠️ Pipeline-stability guardrails (near go-live)

- **KAN-42 is safe** — index.html only, no pipeline edits, dashboard auto-deploys via Vercel.
- **KAN-28 #2 + #3** require Prepare node edit → re-import to n8n → re-paste Gemini API key and webhook secret in code. Budget 10 extra minutes for credential dance.
- **KAN-28 #1 + #4** are larger and deserve fresh morning eyes + explicit test passes before commit.
- **Non-negotiable:** no pipeline edits without a local test via the manual POST intake first. v12 is at 100% on 5 real tickets — we don't risk it for cosmetics.

---

## 🔗 Related memory + docs

- [checkpoint_11_v12_gemini_consolidation_ready.md](../../../..../../xaosp/.claude/projects/g--My-Drive-Tech-Jobs-Trustify-03-build/memory/checkpoint_11_v12_gemini_consolidation_ready.md) — v12 + v12.1 ship log
- [known_issue_outlook_html_body_format.md](../../../..../../xaosp/.claude/projects/g--My-Drive-Tech-Jobs-Trustify-03-build/memory/known_issue_outlook_html_body_format.md) — folds into KAN-28 #3
- [project_v12_acceptance_criteria.md](../../../..../../xaosp/.claude/projects/g--My-Drive-Tech-Jobs-Trustify-03-build/memory/project_v12_acceptance_criteria.md) — historical v12 scope reference
- Pipeline file: `pipelines/n8n-workflow-v12.json`
- Dashboard: `index.html`
