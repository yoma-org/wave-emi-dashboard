# Schema Refactoring — Tonight's Execution Plan

**Date:** April 10, 2026 (evening)
**Goal:** Migrate from flat 70-column table to normalized 5-table schema
**Time estimate:** 3-4 hours with testing
**Risk level:** LOW — old table untouched, rollback = 1 line change

---

## Part 1: What This Refactoring Unlocks

### Immediate Capabilities (available after tonight)

| Feature | Flat Schema (now) | Normalized Schema (after) |
|---------|-------------------|---------------------------|
| **Multiple attachments per email** | 1 attachment per ticket (single `attachment_url` field) | Unlimited — each row in `ticket_attachments` is a separate file |
| **Multiple emails per ticket** | 1 email per ticket | Unlimited — corrections, follow-ups, resubmissions tracked separately |
| **Batch/unbatch** | Not possible — no way to group tickets | Add `batch_id` column → group tickets by batch. Unbatch = set `batch_id = NULL` |
| **Vision per attachment** | 1 vision result per ticket | 1 vision result per attachment — OCR each file independently |
| **Re-extraction** | Overwrites previous result | Each extraction is a new row — full audit trail |
| **Concurrent ticket creation** | `Math.max()` in JS — collision risk under load | `generate_ticket_number()` DB trigger — atomic, race-condition-proof |
| **Type safety** | All fields are TEXT in PostgreSQL | ENUMs, NUMERIC(18,2), BOOLEAN — DB rejects invalid data |
| **NextJS/Prisma ready** | Cannot generate typed models from flat table | Clean normalized schema → direct Prisma/Drizzle mapping |

### PM's Questions — Answered

**Q: What happens when they send an email with multiple attachments?**

| | Current System | After Refactoring |
|-|---------------|-------------------|
| **Pipeline** | Extracts FIRST attachment only (`prepData.attachment_base64` is singular) | Same — pipeline change needed separately (Phase 2) |
| **Webhook** | Stores 1 attachment URL per ticket | Can store N attachments per ticket via `ticket_attachments` table |
| **Dashboard** | Shows 1 attachment preview | Can show all attachments (UI update needed separately) |
| **Impact:** | Second attachment is LOST | Second attachment is STORED but not yet processed by AI |

**Honest assessment:** The schema refactoring gives us the DATABASE capability for multiple attachments tonight. The PIPELINE still only processes the first one. Pipeline multi-attachment support is a separate task (~2 hours, involves changing the Prepare node to loop through all attachments).

**Q: What happens when multiple emails arrive simultaneously?**

| | Current System | After Refactoring |
|-|---------------|-------------------|
| **n8n trigger** | Polls sequentially — processes ONE email at a time | Same — n8n polling is inherently sequential |
| **Webhook concurrency** | Vercel serverless — can handle 100+ concurrent requests | Same |
| **Ticket ID collision** | `Math.max()` in JS — if 2 webhooks fire within milliseconds, BOTH could generate `TKT-012` | `generate_ticket_number()` DB trigger — PostgreSQL handles concurrency with row-level locking. ZERO collision risk. |
| **Impact:** | Under burst load, ticket IDs CAN collide (we fixed this once already) | Ticket numbering is bulletproof |

**Honest assessment:** n8n processes emails one at a time, so simultaneous emails queue up naturally. The real concurrency risk is the webhook — and the new schema eliminates that risk entirely with DB-level numbering.

**Q: How does batch/unbatch work with the new schema?**

After refactoring, batch support requires ONE column addition:

```sql
ALTER TABLE tickets_v2 ADD COLUMN batch_id UUID REFERENCES batches(id);

CREATE TABLE batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_number VARCHAR(20) UNIQUE,  -- BATCH-001
  company VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

- **Batch:** Set same `batch_id` on multiple tickets → grouped
- **Unbatch:** Set `batch_id = NULL` → standalone ticket
- **Not possible with flat schema** — no relational grouping mechanism

This is a future addition (not tonight) but the normalized schema makes it trivial.

---

## Part 2: Risk Assessment Per Step

| Step | What | Risk | Worst Case | Rollback Time |
|------|------|------|-----------|---------------|
| **1. Create tables** | Run SQL in Supabase | **ZERO** — new tables alongside old | Tables exist but unused | `DROP TABLE tickets_v2 CASCADE` — 5 sec |
| **2. Create VIEW** | Run SQL in Supabase | **ZERO** — VIEW reads from new tables | VIEW exists but unused | `DROP VIEW tickets_flat` — 5 sec |
| **3. Migrate data** | Run SQL in Supabase | **LOW** — old table untouched | Bad data in new tables | Drop + recreate tables — 2 min |
| **4. Rewrite webhook** | Edit `api/webhook.js` | **MEDIUM** — new emails won't persist if broken | Pipeline sends email but webhook fails to save | Swap to `webhook-legacy.js` — 1 min deploy |
| **5. Update dashboard read** | Edit `loadState()` | **MEDIUM** — dashboard could show wrong data | Dashboard empty or broken layout | Change `tickets_flat` back to `tickets` — 1 line |
| **6. Update dashboard write** | Edit `saveState()` | **HIGH** — wrong writes corrupt data | User actions (approve, reject) don't save | Revert to old saveState — 2 min |
| **7. Test end-to-end** | Send test email | **ZERO** — read-only verification | Test reveals issues to fix | N/A |

**The key safety net:** Old `tickets` table stays alive and untouched. Dashboard can switch back in 1 line. We never delete the old table tonight.

---

## Part 3: Execution Order (Tonight)

### Phase 1: Database (30 min, ZERO risk)

**Step 1.1 — Create tables + triggers**
- Open Supabase SQL Editor
- Paste and run `db/02_enhanced_schema.sql`
- Verify: 5 new tables appear in Table Editor

**Step 1.2 — Create bridge VIEW**
- Paste and run `db/03_bridge_view.sql`
- Verify: `tickets_flat` appears as a view

**Step 1.3 — Migrate existing data**
- Paste and run `db/04_data_migration.sql`
- Verify: `SELECT * FROM tickets_flat` returns 11 rows with correct data
- Verify: `ticket_number` matches old IDs (TKT-001 through TKT-011)
- Cross-check: compare TKT-011 in old `tickets` vs `tickets_flat` — all fields match

**Checkpoint:** If anything fails, run `db/05_rollback.sql` and stop. Old system unaffected.

### Phase 2: Webhook (1 hour, MEDIUM risk)

**Step 2.1 — Backup current webhook**
```bash
cp api/webhook.js api/webhook-legacy.js
```

**Step 2.2 — Rewrite webhook**
New webhook inserts across normalized tables:
1. INSERT into `tickets_v2` → get UUID + ticket_number back
2. INSERT into `ticket_emails` (email metadata)
3. UPLOAD to Supabase Storage → INSERT into `ticket_attachments`
4. INSERT into `ticket_vision_results` (if vision data exists)
5. INSERT into `ticket_employee_extractions` (if employee data exists)
6. INSERT into `activity_log` (audit)
7. Return ticket_number + dashboard URL

**Step 2.3 — Deploy + test**
- Push to GitHub → Vercel auto-deploys
- Send test email to emoney@zeyalabs.ai
- Verify: TKT-012 appears in all 5 tables
- Verify: `tickets_flat` VIEW shows TKT-012 correctly
- Verify: old `tickets` table NOT modified (safety check)

**Checkpoint:** If webhook breaks, swap `webhook-legacy.js` → `webhook.js`, redeploy.

### Phase 3: Dashboard Read (45 min, MEDIUM risk)

**Step 3.1 — Update `loadState()`**
```javascript
// Change from:
sb.from('tickets').select('*')
// To:
sb.from('tickets_flat').select('*')
```

Plus add the ID mapping layer:
```javascript
data.forEach(t => {
  t._uuid = t.id;           // Keep UUID for DB writes
  t.id = t.ticket_number;   // Dashboard uses TKT-xxx
});
```

**Step 3.2 — Test dashboard**
- Reload dashboard
- Verify: all tickets display with correct IDs, amounts, statuses
- Verify: sorting works
- Verify: ticket detail modal shows all fields
- Verify: vision badges, confidence, mismatch all display correctly

**Checkpoint:** If dashboard breaks, change `tickets_flat` → `tickets` in loadState, redeploy.

### Phase 4: Dashboard Write (1 hour, HIGH risk — go slow)

**Step 4.1 — Update `saveState()` Supabase section**
- Write to `tickets_v2` using UUID (`t._uuid`)
- Strip child-table fields from the upsert payload
- Keep localStorage write unchanged (still flat)

**Step 4.2 — Update `updateTicket()`**
- Same pattern: write to `tickets_v2` using UUID

**Step 4.3 — Update `logActivity()`**
- Use `ticket_number` (TKT-xxx) for activity log readability

**Step 4.4 — Test write operations**
- Click through finance approval → verify `tickets_v2` updates
- Upload employee list → verify data saves
- Check activity log → verify entries appear

**Checkpoint:** This is the riskiest step. Test EACH operation individually before moving to next.

### Phase 5: Dashboard Ticket Creation (30 min, MEDIUM risk)

**Step 5.1 — Update `createTicketFromN8n()`**
- Insert to `tickets_v2` + child tables (same pattern as webhook)
- Remove `generateTicketId()` — DB trigger handles it
- Load ticket_number back from Supabase response

**Step 5.2 — Update mock email creation**
- Same normalized insert pattern

**Step 5.3 — Test**
- Create ticket from mock email → verify in all tables

### Phase 6: End-to-End Smoke Test (15 min, ZERO risk)

1. Send fresh email to emoney@zeyalabs.ai
2. Wait for pipeline to process
3. Reload dashboard → new ticket appears
4. Walk through Steps 1-3 on the ticket
5. Check all 5 tables in Supabase → data in correct places
6. Check activity_log → entries present
7. Clear localStorage → reload → tickets load from Supabase correctly

### Phase 7: Push + Verify Deployments (15 min)

1. `git add . && git commit` with descriptive message
2. `git push origin main` (Vercel Hobby auto-deploys)
3. `git push yoma main` (Vercel Pro auto-deploys)
4. Verify both URLs work:
   - https://project-ii0tm.vercel.app/
   - https://wave-emi-dashboard.vercel.app/

---

## Part 4: What We're NOT Doing Tonight

| Item | Why Not | When |
|------|---------|------|
| Pipeline multi-attachment support | Requires n8n Prepare node changes + multi-loop | Phase 2 (Apr 14) |
| Batch/unbatch feature | Need spec from Win first | After spec received |
| Audit confirmation form | UI feature, not schema | Apr 14-15 |
| Finance exemption list | Business logic, not schema | Apr 14-15 |
| Drop old `tickets` table | Safety net — keep until go-live verified | Post Apr 19 |
| NextJS migration | Major rewrite, separate project | KAN-26 |

---

## Part 5: File Changes Summary

| File | Change Type | Lines Changed (est.) |
|------|-------------|---------------------|
| `api/webhook.js` | **MAJOR rewrite** | ~130 → ~160 lines |
| `api/webhook-legacy.js` | **NEW** (backup of current) | Copy of current |
| `index.html` loadState() | **MODERATE** | ~10 lines |
| `index.html` saveState() | **MODERATE** | ~15 lines |
| `index.html` updateTicket() | **MODERATE** | ~10 lines |
| `index.html` createTicketFromN8n() | **MODERATE** | ~20 lines |
| `index.html` generateTicketId() | **REMOVE** | -6 lines |
| `index.html` logActivity() | **MINOR** | ~3 lines |
| `db/*.sql` | **Already created** | Ready to run |
| n8n pipeline | **NO CHANGE** | 0 |
| localStorage | **NO CHANGE** | 0 |

**Total: ~80 lines of code changes across 2 files + SQL execution.**

---

## Part 6: Definition of Done (Tonight)

- [ ] 5 normalized tables exist in Supabase with correct data
- [ ] `tickets_flat` VIEW returns same shape as old flat table
- [ ] Webhook creates tickets across all 5 tables
- [ ] Dashboard loads from VIEW and displays correctly
- [ ] Dashboard writes to `tickets_v2` (core operations)
- [ ] New test email creates TKT-012 end-to-end
- [ ] Old `tickets` table is UNTOUCHED (safety net)
- [ ] Both Vercel deployments working
- [ ] Code committed and pushed
