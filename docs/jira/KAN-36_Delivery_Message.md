# KAN-36 — Delivery Message (copy-paste ready)

**Generated:** 2026-04-15
**Status:** Pipeline v11 + dashboard refactor shipped. Awaits DK import on new n8n trial account + real email test.

---

## 📋 Jira Comment for KAN-36 (paste when moving to Done)

```
Done. KAN-36 shipped as pipeline v11 + dashboard modal refactor.

Commits (main branch):
- 840b99c — Wave 5A: pipeline v11 JSON (new extraction fields)
- 3f563bf — Wave 5B1: remove Approval Status + Processing Status
- 875f105 — Wave 5B2: employee list 4-column rework + OTC note
- 768d713 — Wave 5B3: AI Analysis side-by-side (6 fields)
- 999aa1f — Wave 5B4: Generate CSV for Finance button + gate
- bf67b50 — Wave 5B5: Inform client for missing data warning panel

Pipeline (n8n):
- New workflow: "EMI Email Intake Pipeline v11 (KAN-36 + Initiator/Purpose/Cost Center)"
- Groq + Gemini extended with 3 new fields: initiator_name, purpose, cost_center
- Parse & Validate now passes both email-side AND document-side values through (doc_initiator_name, doc_purpose, doc_cost_center, doc_company_name, doc_payment_date) for side-by-side comparison
- v10.1 remains active on old n8n account as emergency fallback

Dashboard (index.html):
✅ Approval Status section removed
✅ Processing Status section removed
✅ Employee List rewritten to 4-column: SI No | From Wallet | To Wallet | eMoney Amount
✅ OTC tickets: show convention note instead of empty table ("Over-The-Counter — no employee list expected")
✅ AI Analysis: side-by-side table comparing email vs document across Company / Initiator / Amount / Pay Date / Purpose / Cost Center — green = match, yellow = mismatch or one-side missing
✅ "Generate CSV for Finance" button (replaces "Approve & Download CSV") — enabled only when pipeline captured enough data
✅ "Inform client for missing data" warning panel lists specific missing fields + mismatch, with "Return with this list" one-click action that pre-fills the return email with polite client-facing text

Soft-gate decision on Cost Center:
Real Myanmar salary emails rarely include cost center codes explicitly. Per internal decision, Cost Center appears in the warning panel (labeled "optional") but does NOT strictly block CSV generation. Other 5 fields remain hard gate.

Design principle locked in for v12:
v11 uses provider-agnostic field names and response schemas. v12 Claude migration = HTTP URL + auth change only, zero field renames, zero downstream code changes.

n8n migration note:
Shipped on dknguyen01trustify (new trial account, 14 days). Old trial retained as read-only fallback reference until expiry.
```

**Attach screenshots:**
- Side-by-side AI Analysis on a full-data ticket (all green)
- Warning panel on a ticket missing Purpose + Cost Center
- Generate CSV for Finance button disabled state with tooltip
- Original Employee List (before) vs new 4-column (after)

---

## 💬 Teams Message to Vinh (short, CEO-scannable)

```
Hi anh Vinh,

KAN-36 done đó. Pipeline v11 + ticket detail popup refactor đã ship.

✅ AI Analysis side-by-side (Email vs Document, 6 fields, green/yellow)
✅ Employee list 4 cột theo spec: SI / From Wallet / To Wallet / eMoney Amount
✅ OTC ticket: thêm note thay vì để trống (OTC convention)
✅ Approval Status + Processing Status đã remove
✅ Nút "Generate CSV for Finance" thay cho "Approve & Download CSV", có gate đủ field mới enable
✅ Warning panel "Inform client for missing data" có list field thiếu + nút "Return with this list" pre-fill reason

1 điểm em xin flag: Cost Center em để là soft gate — vẫn hiện trong warning nhưng không block CSV. Lý do: real emails Myanmar rất ít khi có cost center code, nếu strict gate sẽ block 80%+ tickets. Anh OK tiếp hay muốn strict?

Em đã migrate sang n8n account mới (trial gia hạn được 14 ngày) vì trial cũ sắp hết. v10.1 vẫn còn trên account cũ làm fallback.

v12 Claude migration em để thành session riêng — đợi v11 chạy stable 1-2 ngày trước khi migrate model. Mình không bundle 2 thứ risky vào 1 session.

Em sẽ gửi anh screenshots + commit SHAs trong Jira KAN-36.

— DK
```

---

## 📦 What DK needs to do on new n8n account

### 1. Open instance
Click "Open instance" from dashboard → https://dknguyen01trustify.app.n8n.cloud/

### 2. Set up credentials (one-time)
- **Microsoft Outlook OAuth2** for emoney@zeyalabs.ai
- **Groq API key** (HTTP Header Auth: `Authorization: Bearer <key>`)
- **Gemini API key** (paste into URL param in Vision Process + Employee List Extract nodes)
- **Webhook secret** (X-Webhook-Secret header in Parse & Validate HTTP request)

### 3. Import two workflows
- File → Import from File → `pipelines/n8n-workflow-v11.json`
- File → Import from File → `pipelines/n8n-workflow-return-email-v1.json`

### 4. Attach credentials to imported nodes
Both imported workflows will have placeholder credential IDs. For each Outlook/HTTP node, click and re-select the credential you created in step 2 from the dropdown.

### 5. Activate both workflows
Toggle Active → On for both v11 and Return-to-Client.

### 6. Test: send one real email
Send a test salary disbursement email with Initiator Name + Purpose + Cost Center to emoney@zeyalabs.ai. Verify:
- New ticket appears in dashboard
- Side-by-side AI Analysis shows extracted fields
- Generate CSV button enabled if all data present
- Warning panel appears + lists missing fields otherwise

### 7. Deactivate v10.1 on old account
Once v11 confirmed working on new account, go to old n8n account and toggle v10.1 workflow off. Keep it as read-only reference until old trial expires.

### 8. Update dashboard RETURN_EMAIL_WEBHOOK constant if needed
If new n8n instance URL differs from old `tts-test.app.n8n.cloud`, update `RETURN_EMAIL_WEBHOOK` constant in `index.html` (search for the constant definition) and redeploy.

### 9. Update Vercel webhook URL (API Parse & Validate node)
If webhook persistence endpoint moved, update the POST URL in AI Parse & Validate v3 node. (Most likely stays the same: `https://project-ii0tm.vercel.app/api/webhook`.)

### 10. Ping Vinh on Teams
Use the template above. Share screenshots + commit SHAs.

---

## ⚠️ Known items NOT addressed in v11 (deferred)

- v12 Claude migration (requires AI Council research first + model swap session)
- AWS Bedrock infra (Tin's domain)
- Webhook authentication on /webhook/return-to-client (anonymous currently)
- `return []` → `{json:{_skip:true}}` refactor (cosmetic n8n 2.14 noise)
- TKT-021 + other test tickets cleanup in Supabase
- Utiba-format CSVs (Rita's 9-phase deeper scope)
- Finance exemption master list (Thet Hnin Wai)
- Batch/unbatch spec (Win)

---

## 🧭 Navigation
- Vinh's spec: `docs/jira/KAN-36_eMoney_Ticket_Detail_Popup.pdf`
- Analysis doc: `docs/jira/KAN-36_Analysis_And_Plan.md`
- Live checkpoint: `memory/checkpoint_08_v11_in_progress.md`
- Pipeline file: `pipelines/n8n-workflow-v11.json`
- Dashboard: `index.html` (openTicketDetail ~line 3200, helpers near ~line 3160)
