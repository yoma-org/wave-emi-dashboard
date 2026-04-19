---
name: vinh_update_2026-04-16
aliases: ["Vinh Update 2026-04-16", "Vinh Apr 16 Evening"]
description: Teams message draft to Vinh reporting KAN-45 done, KAN-28 #1/#2/#3 done, CSV/XLSX support shipped. Guidance on ticket closure + KAN-28 split into KAN-47.
type: reference
topics: [vinh-updates, kan-45, kan-28, teams-message]
status: archived
created: 2026-04-16
last_reviewed: 2026-04-19
---

# Vinh Teams Message — Apr 16 Evening Update

**Context:** Report KAN-45 done, KAN-28 #1/#2/#3 done, CSV/XLSX support shipped. Guide Vinh on ticket closure + KAN-28 split.
**Send via:** Microsoft Teams
**Voice reference:** Matches DK's previous messages (KAN-36, KAN-42 evening update style)

---

## Message (Vietnamese — copy-paste ready for Teams)

```
Hi anh Vinh 👋

Em update tiếp từ hôm qua nha.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ KAN-45 — Pipeline đọc Excel bankslip: DONE
- XLSX parse trực tiếp trong n8n, không cần thêm service bên ngoài
- File Excel có password → pipeline detect tự động, gửi email reject với hướng dẫn rõ ràng cho sender
- Đã test với file Wave Money MFS Emoney Transfer Approval Form thật (3 employees, MMK) → ticket tạo thành công, Three-Way Match xanh 🟢
- 👉 Anh close KAN-45 trên Jira được luôn ạ: https://yoma-bank.atlassian.net/si/jira.issueviews:issue-html/KAN-45/KAN-45.html

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ KAN-28 — 3 trên 4 items done:
  ✅ #1 File password-protected / ZIP / RAR / 7z → reject + email hướng dẫn
  ✅ #2 Email body trống (chỉ có title) → reject + email hướng dẫn gửi lại
  ✅ #3 Payroll data trong body, không attachment → pipeline xử lý bình thường, tạo ticket từ nội dung email
  ⏳ #4 Multiple attachments → chưa làm

💡 Đề xuất: Em thấy anh update thêm spec mới cho #4 (max 5 attachments, separate tabs, >5 reject). Scope này lớn hơn 3 cái trên nhiều (cần thay đổi pipeline + dashboard UI + webhook schema). Em đề xuất anh tách #4 ra ticket riêng để track, rồi close KAN-28 với 3 items đã done.
👉 KAN-28: https://yoma-bank.atlassian.net/si/jira.issueviews:issue-html/KAN-28/KAN-28.html

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎁 Bonus: CSV support
Pipeline cũng đọc được file CSV (ngoài XLSX). Tự detect encoding + delimiter.

📊 Tổng hợp attachment types pipeline hiện tại:
  ✅ JPG/PNG (image) → Gemini Vision
  ✅ PDF → Gemini inlineData
  ✅ XLSX (Excel) → Pure JS parse — MỚI
  ✅ CSV → Text parse — MỚI
  ✅ Body-only (không file) → Text extraction
  ❌ Password-protected → Reject + email hướng dẫn
  ❌ ZIP / RAR / 7z → Reject + email hướng dẫn
  ❌ Empty body → Reject + email hướng dẫn

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⏳ KAN-46 (Performance Optimize)
Em đã phân tích xong, có vài option từ config đơn giản (n8n built-in setting) tới queue pattern. Em sẽ implement + update anh.
👉 KAN-46: https://yoma-bank.atlassian.net/si/jira.issueviews:issue-html/KAN-46/KAN-46.html

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🧪 Anh muốn test thử, theo 3 bước:

1️⃣ Vào dashboard xem tickets mới:
   👉 https://project-ii0tm.vercel.app
   (click vào ticket gần nhất để xem detail — phần "From Attachment" sẽ hiển thị "Parsed ✓" cho XLSX/CSV)

2️⃣ Test XLSX: Gửi email tới emoney@zeyalabs.ai có attach file Excel (không password)
   → Chờ 1-2 phút → vào dashboard refresh → ticket mới xuất hiện với employee list từ Excel

3️⃣ Test rejection: Gửi email tới emoney@zeyalabs.ai có attach file ZIP hoặc Excel có password
   → Chờ 1-2 phút → check inbox email gửi → sẽ nhận được email reject với hướng dẫn step-by-step

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❓ 1 câu hỏi cho KAN-28 #4 (khi anh tách ticket):
Nếu email có 3 attachments mà 1 cái bị password-protected, anh muốn:
  A) Reject toàn bộ email?
  B) Xử lý 2 cái OK + flag cái lỗi trong ticket?

Anh reply em khi nào tiện nha 🙏

— DK
```

---

## English version (if needed)

```
Hi Vinh 👋

Follow-up from yesterday.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ KAN-45 — Pipeline reads Excel bankslip: DONE
- XLSX parsed directly in n8n, no external service needed
- Password-protected Excel → auto-detected, rejection email sent with clear instructions
- Tested with real Wave Money MFS Emoney Transfer Approval Form (3 employees, MMK) → ticket created, Three-Way Match green 🟢
- 👉 You can close KAN-45 on Jira: https://yoma-bank.atlassian.net/si/jira.issueviews:issue-html/KAN-45/KAN-45.html

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ KAN-28 — 3 of 4 items done:
  ✅ #1 Password-protected / ZIP / RAR / 7z → reject + instruction email
  ✅ #2 Empty email body (title only) → reject + instruction email
  ✅ #3 Payroll data in body, no attachment → pipeline processes normally, creates ticket from email content
  ⏳ #4 Multiple attachments → not started

💡 Suggestion: I see you added new spec for #4 (max 5 attachments, separate tabs, >5 reject). This is significantly larger scope than the other 3 (requires pipeline + dashboard UI + webhook schema changes). I'd suggest splitting #4 into its own ticket, then closing KAN-28 with the 3 done items.
👉 KAN-28: https://yoma-bank.atlassian.net/si/jira.issueviews:issue-html/KAN-28/KAN-28.html

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎁 Bonus: CSV support
Pipeline also reads CSV files (in addition to XLSX). Auto-detects encoding + delimiter.

📊 Full attachment support matrix:
  ✅ JPG/PNG (image) → Gemini Vision
  ✅ PDF → Gemini inlineData
  ✅ XLSX (Excel) → Pure JS parse — NEW
  ✅ CSV → Text parse — NEW
  ✅ Body-only (no file) → Text extraction
  ❌ Password-protected → Reject + instruction email
  ❌ ZIP / RAR / 7z → Reject + instruction email
  ❌ Empty body → Reject + instruction email

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⏳ KAN-46 (Performance Optimize)
Analysis done, have several options from simple config (n8n built-in setting) to queue pattern. Will implement + update you.
👉 KAN-46: https://yoma-bank.atlassian.net/si/jira.issueviews:issue-html/KAN-46/KAN-46.html

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🧪 To test — 3 steps:

1️⃣ Check the dashboard for new tickets:
   👉 https://project-ii0tm.vercel.app
   (click latest ticket to see detail — "From Attachment" section shows "Parsed ✓" badge for XLSX/CSV)

2️⃣ Test XLSX: Send email to emoney@zeyalabs.ai with an Excel attachment (no password)
   → Wait 1-2 min → refresh dashboard → new ticket appears with employee list extracted from Excel

3️⃣ Test rejection: Send email to emoney@zeyalabs.ai with a ZIP file or password-protected Excel
   → Wait 1-2 min → check your sent email's inbox → you'll receive a rejection email with step-by-step instructions

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❓ One question for KAN-28 #4 (when you split the ticket):
If an email has 3 attachments but 1 is password-protected, do you want:
  A) Reject the entire email?
  B) Process the 2 valid ones + flag the failed one in the ticket?

Reply whenever convenient 🙏

— DK
```

---

*Draft — review before sending. Polished with emojis, hyperlinks, and step-by-step test guide.*
