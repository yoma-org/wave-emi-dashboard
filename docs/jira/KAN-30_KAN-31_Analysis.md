# KAN-30 + KAN-31 — Comprehensive Analysis

**Tickets:** KAN-30 (eMoney Email UI/UX Enhancement) + KAN-31 (eMoney Dashboard UX/UI Enhancement)
**Reporter:** Vinh Nguyen (Trustify BA/PM)
**Assignee:** Duy Khanh Nguyen
**Priority:** High
**Status:** In Progress
**Created:** Apr 10, 2026 | **Updated:** Apr 13, 2026
**Analysis date:** Apr 13, 2026 (evening, post-hardening sprint)
**Source PDFs:**
- [KAN-30_eMoney_Email_Notification_Enhancement.pdf](KAN-30_eMoney_Email_Notification_Enhancement.pdf)
- [KAN-31_eMoney_Dashboard_UX_Enhancement.pdf](KAN-31_eMoney_Dashboard_UX_Enhancement.pdf)

---

## 1. Executive Summary

Two stakeholder-driven UX polish tickets from Vinh, both tied to the **Apr 20 soft go-live demo** AND — critically — Vinh's expectation of EOD Apr 13 delivery (tickets have been "In Progress" for days).

- **Alignment with project direction:** Strong. Fits Minh's "simplify" principle, Rita's polished-demo expectation, and the Apr 20 go-live milestone.
- **Decision:** Ship **tonight (Apr 13 evening)**. Missing Vinh's timeline = bigger credibility hit than minor fatigue risk.
- **Risk level:** **Low** — all changes are additive or in isolated files (single `index.html` + new pipeline v10 clone). v9 stays as fallback. Easy rollback at every step.
- **Execution plan:** See `KAN-30_KAN-31_Implementation_Plan.md` — 4 blocks, ~4 hrs, with checkpoint memory after each block so any crash is recoverable.

---

## 2. KAN-30 — Email Notification Enhancement

### Scope

Improvements to the **Outlook notification email** the pipeline sends back after processing a disbursement request (current node: `Send Outlook Notification` in pipeline v9).

### Requirements (from Vinh)

| # | Requirement | Type | Notes |
|---|-------------|------|-------|
| 1 | Display Type of Payment: `salarytoMA` or `salarytoOTC` | New feature | Logic: employee list present → `salarytoMA`; no employee list → `salarytoOTC` |
| 2 | Fix attachment count — currently always shows "0 file(s)" | **Bug fix** | Attachment metadata not propagating to notification node |
| 3 | Expand Verification Status checklist | New feature | Add: Company name / Payment type / Amount / Date time / Approval / Attachment / Employee List checks |
| 4 | Display ticket ID in email | New feature | So Ops can search dashboard |

### Current State

Notification currently shows:
- Company
- Amount
- Type (Mobile Account / OTC — but derived from email body, not pipeline classification)
- Attachments: 0 file(s) ← **BUG**
- Approval check: Complete (Sales HOD + Finance Manager found)
- Amount check: Passed

### Gap

- Items #1, #3, #4: missing entirely
- Item #2: real bug — attachment count not being passed to Send Outlook Notification node properly

### Technical Changes Required

| Location | Change |
|----------|--------|
| `pipelines/n8n-workflow-v9.json` → clone to v10 | All changes in new workflow (v9 stays as fallback) |
| Parse & Validate node | Add `payment_type_classification` logic (MA if employees parsed, OTC if not) |
| Parse & Validate node | Add explicit `attachment_count` field from prior node's binary count |
| Parse & Validate node | Expand verification object with all 7 check results |
| Send Outlook Notification node | Rewrite email template to include all new fields + ticket ID |

### Risk Assessment

- **Low risk** — notification is output-only, doesn't affect DB writes or pipeline logic
- No regression to existing tickets (v9 stays active until v10 tested)
- Easy rollback: reactivate v9

### Estimated Effort

- Pipeline clone + updates: 1.5 hrs
- Notification template redesign: 30 min
- End-to-end testing (send test email, verify notification content): 1 hr
- **Total: ~3 hrs**

---

## 3. KAN-31 — Dashboard UX/UI Enhancement

### Scope

Simplification of the `index.html` dashboard page (visible to eMoney users) — Vinh wants a cleaner, more focused view.

### Requirements (from Vinh)

| # | Requirement | Type | Location |
|---|-------------|------|----------|
| 1 | Rename header "Wave EMI Pipeline" → "Wave eMoney" | Rename | Top-left logo |
| 2 | **Hide all tabs except Dashboard** (Ticket List, Finance Approval, E-Money Review, role buttons) | UX change | Top nav |
| 3 | Rename "Wave EMI Pipeline Dashboard" → "eMoney Dashboard" | Rename | Page title |
| 4 | Remove subtitle "Unified command center - Step 1-7" | Remove text | Below page title |
| 5 | Reduce 5 stat cards → **3 blocks**: All emails / Mismatch / Ready for Finance | UX change | Top of dashboard |
| 6 | Make cards clickable → apply filter to ticket list below | New feature | Dashboard |
| 7 | Add search bar next to "All Tickets" (ticket ID search) | New feature | Ticket list section |
| 8 | Remove the 3 quick-filter panels below cards (Vision AI / mismatch / high-risk) | Remove feature | Between cards and table |

### Ambiguity — ⚠️ Clarify with Vinh Before Shipping

**Requirement #2: "Hide all tabs except Dashboard"**
- Hidden **forever** (all users) = breaks internal testing of Finance Approval, E-Money pages
- Hidden **for demo only** (eMoney user role view) = keep dev-mode switcher for internal testing
- **Needs explicit answer** — don't ship until clarified

### Technical Changes Required

| Change | Files | Complexity |
|--------|-------|-----------|
| Text renames (#1, #3, #4) | `index.html` header + title | Trivial |
| Hide tabs (#2) | `index.html` nav section | Trivial after clarification |
| 5 → 3 cards (#5) | `index.html` dashboard section + calculation logic | Low |
| Clickable card filters (#6) | `index.html` + state management for active filter | Medium — needs `activeFilter` state + ticket list filter logic |
| Ticket ID search bar (#7) | `index.html` + filter function | Low — string match on `ticket_number` |
| Remove quick-filter panels (#8) | `index.html` | Trivial |

### Risk Assessment

- **Low overall** — all changes in `index.html`, no backend/DB impact
- Medium risk point: clickable card filters need careful state management to not conflict with existing search + status filters
- Zero risk for renames and removals
- Easy rollback: git revert

### Estimated Effort

- Renames + removes (#1, #3, #4, #8): 30 min
- Hide tabs (#2, after clarification): 15 min
- 5 → 3 cards (#5): 30 min
- Clickable card filters (#6): 1.5 hrs (state wiring + testing)
- Search bar (#7): 1 hr
- **Total: ~3.5 hrs**

---

## 4. Alignment with Project Vision & Direction

### Strong alignment

- **Minh's "simplify" principle** — reducing 5 cards to 3, hiding tabs, removing dev-clutter = exactly the product philosophy he has communicated
- **Rita's Apr 20 soft go-live** — these make the demo look like a polished product vs a development dashboard
- **First Jira-driven sprint for DK at Trustify** — shipping cleanly builds credibility with Vinh (BA) and by extension the PM chain
- **Portfolio/demo value** — a polished dashboard + cleaner notifications are what stakeholders remember, not backend hardening work
- **No conflict with next-phase NextJS migration (KAN-26)** — these are UX decisions that carry forward; text labels and filter UX inform future design

### Tensions (minor)

- KAN-31 #2 (hide tabs) breaks internal role-switching workflow for DK's own testing — resolved by clarification + conditional rendering
- Time cost (5–8 hrs) eats into Apr 14–19 window where other KAN tickets may land (batch/unbatch spec from Win, finance exemption list from Thet Hnin Wai, audit form from Rita)

---

## 5. Priority × Effort × Risk Matrix

| Rank | Task | Ticket | Effort | Risk | Business value |
|------|------|--------|--------|------|----------------|
| 🔥 1 | Fix attachment count bug (shows 0 when files exist) | KAN-30 #2 | 45 min | Low | **High** — current bug, visible to Ops |
| 🔥 2 | Text renames (Wave EMI → Wave eMoney) | KAN-31 #1,3,4 | 15 min | Zero | Medium |
| 🔥 3 | Display ticket ID in notification email | KAN-30 #4 | 15 min | Zero | High — enables Ops self-service search |
| 2 | Remove subtitle + quick-filter panels | KAN-31 #4,8 | 15 min | Zero | Low |
| 2 | Reduce 5 → 3 stat cards | KAN-31 #5 | 30 min | Low | Medium |
| 3 | Payment type (MA/OTC) classification in email | KAN-30 #1 | 45 min | Low | Medium |
| 3 | Expand verification checklist in email | KAN-30 #3 | 1 hr | Low | Medium |
| 4 | Clickable cards as filters | KAN-31 #6 | 1.5 hr | Medium | High — UX clarity |
| 4 | Ticket ID search bar | KAN-31 #7 | 1 hr | Low | High — power user feature |
| ⚠️ | Hide tabs | KAN-31 #2 | 15 min | **Clarify first** | Cannot estimate until scoped |

---

## 6. Execution Plan

**Canonical plan** with step-by-step commands, rollback procedures, and checkpoint memory is in:
**`KAN-30_KAN-31_Implementation_Plan.md`** (same folder)

High-level summary — 4 blocks, ~4 hours, all tonight (Apr 13):

| Block | Scope | Vinh items covered | Duration | Checkpoint |
|-------|-------|-------------------|----------|------------|
| 0 | Pre-flight safety snapshot | — | 5 min | `checkpoint_00_preflight.md` |
| 1 | Text renames + removes in `index.html` | KAN-31 #1, #3, #4, #8 | 30 min | `checkpoint_01_block1.md` |
| 2 | Dashboard structural (3 cards + click filter + search + hide tabs via CSS) | KAN-31 #2, #5, #6, #7 | 1.5 hrs | `checkpoint_02_block2.md` |
| 3 | Pipeline v10 clone + KAN-30 (all 4 items) | KAN-30 #1, #2, #3, #4 | 1.5 hrs | `checkpoint_03_block3.md` |
| 4 | Delivery: push, activate v10, update Jira | — | 15 min | `checkpoint_04_done.md` |

**KAN-31 #2 (hide tabs) decision:** Shipping as CSS-hidden via body class (not deletion) — safest interpretation that both satisfies Vinh's intent and preserves internal testing capability. Revert or refine later if Vinh requests different.

---

## 7. Open Questions

| # | Question | For |
|---|----------|-----|
| Q1 | KAN-31 #2 — hide tabs permanently or behind dev flag? | Vinh |
| Q2 | KAN-30 #1 — payment type logic: "employee list detected" = employees extracted successfully, or just attachment present? | Vinh (assumption: successful extraction) |
| Q3 | KAN-31 #5 — "Ready for Finance" card: does this count all non-exempt clients awaiting approval, or all clients regardless of exemption? | Vinh (assumption: all non-exempt) |
| Q4 | KAN-31 #7 — search scope: ticket ID only, or also company name / amount? | Vinh (assumption: ticket ID only per spec) |

Default assumptions will be used if Vinh doesn't respond — but document assumptions in PR description.

---

## 8. Progress Tracking

| Task | Status | Commit | Date |
|------|--------|--------|------|
| Text renames (KAN-31 #1,3,4) | ⏳ Pending | — | — |
| Subtitle + quick-filter panels removal (KAN-31 #4,8) | ⏳ Pending | — | — |
| 5 → 3 stat cards (KAN-31 #5) | ⏳ Pending | — | — |
| Clickable card filters (KAN-31 #6) | ⏳ Pending | — | — |
| Ticket ID search (KAN-31 #7) | ⏳ Pending | — | — |
| Hide tabs (KAN-31 #2) | 🔶 Blocked on clarification | — | — |
| Attachment count bug fix (KAN-30 #2) | ⏳ Pending | — | — |
| Payment type display (KAN-30 #1) | ⏳ Pending | — | — |
| Verification checklist expansion (KAN-30 #3) | ⏳ Pending | — | — |
| Ticket ID in email (KAN-30 #4) | ⏳ Pending | — | — |
| Pipeline v10 clone + activation | ⏳ Pending | — | — |
| End-to-end testing | ⏳ Pending | — | — |
| Vinh clarification sent | ⏳ Pending | — | — |
| Jira tickets moved to Done | ⏳ Pending | — | — |

Update this table as work progresses. Reference commit SHAs and dates.

---

## 9. Honest Judgment Summary

**Is it worth doing?** Yes. Both tickets are legitimate stakeholder asks from the ticket reporter, both directly serve the Apr 20 demo quality bar, and shipping them cleanly is the first Jira close-out at Trustify — that matters for credibility.

**Is it risky?** Low, IF done rested. Medium, if done fatigued tonight after the day's hardening sprint.

**Is it aligned with the 2–3 year extraction plan?** Yes — polished client-visible work is more portable portfolio proof than backend RLS hardening (which is great engineering but invisible to non-technical stakeholders).

**Could any of this be deferred?** Yes:
- KAN-31 #6 (clickable card filters) could slip to post-Apr-20 without pain
- KAN-31 #7 (search bar) could slip if time runs out — current table is sortable
- Everything else is table-stakes for the demo

**Final decision (revised Apr 13 evening):** Ship everything tonight. Vinh has been waiting days, expects EOD delivery, and the work is low-risk (additive, isolated, rollback at every step). Implementation plan with checkpoints in `KAN-30_KAN-31_Implementation_Plan.md`.

**Reconnaissance completed (Apr 13 evening, pre-Block-0):** Real code in `index.html` and `n8n-workflow-v9.json` has been inspected. Plan now uses concrete line numbers, real CSS class names, and actual pipeline field names — no guesses remain. See "Reconnaissance Findings" section at top of Implementation Plan.

**Session rollback point:** Commit `bb62a22` (pre-KAN-30/31 baseline). Any catastrophe recoverable via `git reset --hard bb62a22` + reactivate v9 in n8n.
