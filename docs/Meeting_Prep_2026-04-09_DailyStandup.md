# Meeting Prep — April 9, 2026 Daily Standup (10:00 AM)

**Attendees:** DK, Vinh, Minh, Rita, Win, team
**DK's update time:** Keep under 3 minutes

---

## 1. What to Talk

### Last Night — Win's Handwriting Test
- Tested pipeline with Win's real Myanmar handwriting (OTC payroll, 4 employees)
- Results: 100% Myanmar name transliteration (Ko Zaw Min, Noe Aye, Nyi Ko Ko Maw, Ma Aye Phyu Htet)
- 100% amount extraction, mismatch detection caught the gap (151,000 vs 245,600 MMK)
- Phone number accuracy ~50% — handwriting ambiguity on last digits (need Win to verify)
- Pipeline: v5.1, Groq vision (llama-4-scout), consumer-grade — enterprise AI will be better

### This Morning — Minh's Confidence Question
- Implemented confidence tiered badges: green (>=90%), amber (70-89%), red (<70%)
- Warning box in ticket modal when confidence below 90%: "Please verify extracted data before submitting"
- No hard blocking — warnings only, user always has control
- Amount Mismatch detection remains the primary safety net (objective math, not AI self-assessment)

### This Morning — "Asked Client" Status (Minh's Apr 8 Directive)
- Mismatch tickets now show "Asked Client" status (amber badge)
- "Return for Correction" opens mailto draft to client
- Ticket preserved for audit — corrected resubmission creates new ticket
- Mismatch banner now shows the actual discrepancy (employee total vs requested, not the misleading 0 MMK email-vs-document comparison)

### What's Next
- Infrastructure recommendation document (Rita's #1 ask from Apr 8)
- KAN-26: Defining tech stack for backend (NextJS) + DB (PostgreSQL) — planning with Dong next week
- Waiting on: OTC validation rules (Kim), client master list (Thet Hnin Wai), more Myanmar handwriting samples (Win)

---

## 2. What to Ask

| Question | Who | Purpose |
|----------|-----|---------|
| Names correct? Ko Zaw Min, Noe Aye, Nyi Ko Ko Maw, Ma Aye Phyu Htet | Win | Validate 100% transliteration claim |
| Phone rows 3-4: 084321942 and 097892149 — correct? | Win | Ground truth for 50% phone accuracy |
| Was the 245,600 vs 151,000 gap intentional or are employees missing? | Win | Determine if AI missed rows or test was designed that way |
| Infrastructure recommendation — which platforms to prioritize? AWS Bedrock, Vertex AI, Azure? | Vinh | Align research direction before spending time |
| Any update on OTC validation rules and client master list? | Kim / Thet Hnin Wai (via Vinh) | Unblock future feature work |
| When does Dong start next week? | Vinh | Coordinate KAN-26 (NextJS + PostgreSQL) planning |

---

## 3. What to Watch For

| Signal | What It Means | How to Respond |
|--------|--------------|----------------|
| Rita asks about infrastructure progress | Her #1 priority — she's tracking this | "Working on recommendation doc, will have it in 1-2 days" |
| Rita wants stricter confidence controls | May want hard blocking, not just warnings | Note the requirement, don't push back |
| Minh follows up on "Asked Client" | May want auto-email or record-linking (old ticket to new ticket) | Note it — record-linking needs database (KAN-26) |
| Win says names are wrong | Our 100% claim needs correction | Adjust immediately, update the log |
| Tracy is mentioned or joins | She influences Rita's technical decisions (recommends Gemini) | Pay attention to her position, find out her role |
| New Jira tickets assigned | Vinh may add more KAN tasks | Note them, don't commit to timeline |
| Rita asks about LLM comparison | Redirect to infrastructure per her own Apr 8 directive | "Focusing infrastructure first per your direction yesterday" |
| Demo request from Myanmar ops | They may want to test this week | Confirm: fake data only for consumer AI (Rita's rule) |

---

## 4. Don't

- Don't show n8n pipeline flows — Rita said "none of that matters to them"
- Don't mention consumer AI + real bank slip data from Apr 7 — sensitive
- Don't promise KAN-26 build timelines — "defining tech stack first, building with Dong next week"
- Don't oversell Myanmar OCR — "promising results, need more samples to validate at scale"
- Don't compare LLMs — infrastructure decision comes first

---

## 5. Do

- Credit Win for volunteering her handwriting sample
- Show screenshots of confidence badges + warning (Minh's question answered with code)
- Show "Asked Client" status on a mismatch ticket
- Mention Amount Check 3-way comparison (email vs slip vs employees) — Minh values data integrity
- If asked about KAN-26: "Tech stack is defined (NextJS + PostgreSQL), starting schema design this week, frontend build with Dong next week"
