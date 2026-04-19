---
name: vinh_update_2026-04-17
aliases: ["Vinh Update 2026-04-17", "KAN-46 Status Update to Vinh"]
description: Teams/Messenger message draft to Vinh reporting v13.1.1 patch shipped (hardened parser + diagnostic routing). English and Vietnamese versions.
type: reference
topics: [vinh-updates, kan-46, v13-1-1, teams-message]
status: archived
created: 2026-04-17
last_reviewed: 2026-04-19
---

# Message draft to Vinh — KAN-46 status update

**Context:** Sent Apr 17, 2026 evening after shipping v13.1.1 patch.

---

## 📩 Draft (English, Teams/Messenger format)

Hi anh Vinh 👋

Quick status update on **KAN-46** before Monday Myanmar testing begins.

### ✅ Shipped today

**v13.1 Zero-Waste Architecture** — replaces v12.4 direct pipeline with a decoupled queue design:
- 🗂️ Supabase `email_queue` table + atomic claim RPC (FOR UPDATE SKIP LOCKED)
- ⚡ Database trigger + pg_cron sweeper replace n8n's 30-sec polling (saves ~95% cap burn)
- 🛡️ Spooler + Worker architecture with single-flight gate
- 🔧 Hardened Gemini parser handles 2.5/3.0 thinking-mode responses
- 🚨 Failed extractions marked `status='failed'` with reason (no silent bugs)
- ↩️ Rollback to v12.4 preserved, <30 sec via toggle

**Commits:** `e62b3e9`, `c7f1f64`, `a81e190` (pushed to origin + yoma)

### 🧪 Tested & validated today

- ✅ Single email end-to-end (TKT-055 through TKT-058, Vision 95%)
- ✅ 5-email burst (all processed, no duplicates, SKIP LOCKED confirmed)
- ✅ Gemini failure case (Wave handwritten 21-emp JPG → correctly marked failed, no cascade)

### 📊 Expected Monday behavior

- 90-95% emails → normal tickets + notifications
- 5-10% complex cases (handwritten Burmese docs etc.) → `status='failed'` with reason → human review
- 0% infinite loops or malformed self-sends (defense-in-depth via Spooler loop guard)

### 🎯 n8n cap budget

- Trial: 1,000 executions/month, 902 remaining, expires ~May 1
- New design: ~20-30 executions/day (vs v13.0's 2,880/day from Cron)
- Buffer: ~58% headroom for Myanmar testing week

### ⚠️ Decision needed by **Apr 25**

n8n trial expires ~May 1. Options:
- **Upgrade to Starter: $20/mo** (2,500 execs) — recommended to keep testing running
- Shut down and wait for AWS self-host (Ryan's tenant admin still pending)

### 🔜 v13.2 backlog (post-Monday, prioritized based on Myanmar signal)

1. Notify sender on extraction failure (so clients know to resubmit)
2. Tighten single-flight gate (observed leak on rapid bursts — no impact, but optimization)
3. Dashboard All Tickets auto-refresh (currently only Pipeline Queue strip refreshes live)
4. Spooler multi-row INSERT batching (saves webhook fires)

### 🟡 Still open: **KAN-47** (handle 5+ attachments)

Analysis doc in `docs/jira/KAN-47_Handle_Email_5_Attachments_Analysis.md`. Not blocking Monday testing. Can plan this week.

Let me know if you want to jump on a quick call before Monday!

Dk 🫡

---

## Alternative Vietnamese version (if preferred)

Anh Vinh ơi,

Em đã ship xong **KAN-46 v13.1.1** — queue architecture mới thay cho v12.4 direct pipeline:

✅ Durable queue ở Supabase (no email loss dưới burst load)
✅ Database trigger + pg_cron → loại bỏ 95% cap burn của n8n
✅ Hardened parser cho Gemini thinking-mode responses
✅ Failed extraction → mark 'failed' với reason (có observability)
✅ Rollback về v12.4 <30 sec

**Tested:** single email + 5-email burst + Gemini failure case — tất cả đều pass.

**Monday:** Myanmar team bắt đầu stress test, expect 90-95% emails work normally, 5-10% edge cases sẽ mark 'failed' cho human review.

**Decision cần trước Apr 25:** n8n trial hết May 1. Upgrade Starter $20/mo hay shut down?

Có thể họp nhanh trước Monday nếu anh muốn review chi tiết.

Dk

---

## Notes on sending
- Vinh prefers English for technical updates (per prior messages)
- Keep under 25 lines when pasting into Teams
- Include commit hash in case Vinh wants to review
- Avoid jargon — "durable queue" explained as "no-loss architecture"
