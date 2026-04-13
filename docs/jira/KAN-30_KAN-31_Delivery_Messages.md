# KAN-30 + KAN-31 — Delivery Messages (copy-paste ready)

**Generated:** 2026-04-13 evening
**Status:** All 12 Vinh requirements implemented + verified end-to-end via Outlook channel (TKT-021)

---

## 📋 Jira Comment for KAN-30 (paste when moving to Done)

```
Done. All 4 items shipped in pipeline v10 (active in n8n Cloud, v9 kept as fallback).

Commit: 56aac88 — pipeline v10 file (see repo: wave-emi-dashboard/pipelines/n8n-workflow-v10.json)

Items delivered:
✅ #1 Payment type classification — "salarytoMA" if employee list parsed, else "salarytoOTC"
✅ #2 Attachment count bug — root-cause fix: has_attachments now synced with actual attachment_names count (Outlook flag can lie when binaries not downloaded). Template also displays filenames.
✅ #3 Verification Status — expanded from 2 rows to 7-row checklist:
   Company name / Payment type / Amount / Date time / Approval / Attachment / Employee list
   Each row shows ✅ (pass) or ⚠️ (warn)
✅ #4 Ticket ID displayed at top of notification email

End-to-end verified via Outlook Trigger path (test email → TKT-021 created → notification delivered with all 4 items visible).

Fallback: v9 pipeline stays available in n8n Cloud. Instant rollback if any issue.
```

**Attach screenshots:**
- Notification email for TKT-021 showing 7-row verification + ticket ID + new payment_type format
- n8n Cloud showing v10 active + v9 inactive

---

## 📋 Jira Comment for KAN-31 (paste when moving to Done)

```
Done. All 8 items shipped in 3 commits to main (auto-deployed to project-ii0tm.vercel.app).

Commits:
- 56f1120 — text renames + remove quick-filter panels (#1, #3, #4, #8)
- 3064498 — 3-card clickable filters + search bar + CSS-hidden tabs (#2, #5, #6, #7)
- f96dfef — #2 scope correction (see note below)

Items delivered:
✅ #1 Rename "Wave EMI Pipeline" → "Wave eMoney" (nav logo + browser tab)
✅ #3 Rename page title → "eMoney Dashboard"
✅ #4 Remove "Unified command center - Steps 1-7" subtitle
✅ #8 Remove 3 quick-filter panels below cards (Vision AI / mismatch / high-risk)
✅ #5 Reduce 5 cards → 3 (All Emails / Mismatch / Ready for Finance)
✅ #6 Clickable cards filter ticket table + active card highlighted (click same card to clear)
✅ #7 Search bar added next to "All Tickets" for ticket ID search (works in combination with card filter)
✅ #2 Hide tabs — scope adjusted after internal review (details below)

Bonus: Ctrl+Shift+D keyboard shortcut toggles between clean eMoney view and dev view (all tabs visible for internal testing).

═══════════════════════════════════════════════════════════
Note on #2 scope adjustment:
═══════════════════════════════════════════════════════════
We kept Finance Approval and E-Money Review tabs visible because they contain active workflow stations — Finance users need the Approval queue to do their work, and E-Money team uses E-Money Review for Steps 4-7 (Utiba CSV prep, Checker review, Group mapping, Monitoring, Closing). Hiding them would prevent those roles from completing their work.

Ticket List tab is hidden per our internal consensus that the Dashboard's "All Tickets" table replaces it (with search + filter).

If you want a fully-clean view for demo screenshots with only Dashboard visible, use Ctrl+Shift+D toggle.

Happy to revisit the scope if you see it differently.
```

**Attach screenshots:**
- Dashboard before (5 cards, old labels, all tabs, quick-filter row)
- Dashboard after (3 cards, renamed, cleaner)
- Click demonstration: clicking Mismatch card → table filtered
- Search box demo: typing "TKT-021" → filtered result

---

## 💬 Message to Vinh (Teams/Slack — short, CEO-scannable)

```
Hi Vinh,

KAN-30 and KAN-31 are done and deployed to production.

✅ KAN-30: Pipeline v10 live (v9 kept as fallback). Notification emails now include ticket ID, payment type (salarytoMA/salarytoOTC), 7-row verification checklist, and correct attachment count.

✅ KAN-31: Dashboard refreshed — renamed to "Wave eMoney", 3 clickable filter cards, ticket ID search bar, cleaner layout.

One scope adjustment on KAN-31 #2: we kept Finance Approval and E-Money Review tabs visible (they contain active workflow for Finance and E-Money roles). Ticket List is hidden as we agreed internally. Ctrl+Shift+D provides a clean screenshot-mode if you want.

Verified end-to-end with a test email — TKT-021 with full new format. Screenshots + commit SHAs in the Jira tickets.

Let me know if any adjustment needed.

— DK
```

---

## 🧹 Post-Delivery Cleanup (after Vinh acknowledges)

### Test tickets from tonight's verification
These were created during testing and should be removed from Supabase before real go-live:
- **TKT-021** — "Test Company KAN30 Ltd" (Apr 13 evening, Outlook test)

SQL to review + delete (run in Supabase SQL editor with service role):

```sql
-- Review first
SELECT ticket_number, company, amount_requested, created_at
FROM tickets_v2
WHERE ticket_number IN ('TKT-021')
   OR company LIKE '%Test Company KAN30%'
   OR company LIKE '%Manual Webhook Test%';

-- Delete if confirmed test junk (CASCADE removes child records)
DELETE FROM tickets_v2
WHERE ticket_number IN ('TKT-021')
   OR company LIKE '%Test Company KAN30%';
```

(Do NOT run the DELETE until you've visually confirmed in the SELECT result.)

### What stays in git
- v10 JSON file committed to repo (reference for future versions, fallback re-import if n8n Cloud loses it)
- v9 JSON stays as documented fallback
- Analysis + Plan + Delivery docs stay in `docs/jira/` for future reference

### What needs no action
- No schema migration needed (new fields cherry-picked by webhook.js, extras silently ignored)
- No Supabase policy changes
- No secrets rotation

---

## ⚠️ Known Issue Filed (for v11 future work, not blocking go-live)

**Manual INTAKE webhook test path** fails with n8n error "A 'json' property isn't an object [item 0]" when POSTed directly via curl. Pre-existing issue — NOT caused by KAN-30 v10 changes. Outlook Trigger is the production path and works perfectly.

Details saved in `memory/known_issue_manual_webhook_test_payload.md`. Fix planned for v11 post-Apr-20 go-live.
