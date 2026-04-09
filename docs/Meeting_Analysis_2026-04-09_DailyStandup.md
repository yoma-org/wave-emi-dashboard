# Meeting Analysis — April 9, 2026 Daily Standup

**Meeting:** 10:00 AM, ~20 minutes
**Attendees:** Vinh (PM), Rita (Client), Win (Myanmar ops), Minh (MD), Tin (DE/Backend)
**Transcript:** `_meetings/2026-04-09_Yoma_Daily_Standup.vtt`

---

## Critical Decisions

### 1. Go-Live: Wednesday April 15 (Board Meeting Thursday April 16)

> **Rita (07:12):** "Target go live for Wednesday. We have a board meeting on Thursday and it would be very good to say that we're live."

**Go-live definition = MANUAL, not fully automated:**
> **Rita (06:43):** "We're going to do it manually at first, so there's no reading of an email. It's just something that we're forwarding."

This means: **the AI email parsing pipeline is NOT what goes live.** The go-live is a manual process where someone forwards emails to the system. This dramatically reduces the technical bar.

### 2. EMI App Is "Basically Done" — Only 3 Features Remaining

> **Rita (01:35):** "We basically are done. The only things that they really requested was that feature of the batch and unbatch, and the audit document at the end."

| Remaining Feature | Description | Source |
|---|---|---|
| **Batch / Unbatch** | Group and ungroup disbursement items (exact spec unclear — needs clarification) | Wave team, Apr 8 demo |
| **Audit Confirmation Form** | End-of-process sign-off document ("basically just a confirmation" — Rita) | Wave team, Apr 8 demo |
| **Finance Approval Exemption** | Client email list determines who skips finance step. "Very easy one" per Rita. | Thet Hnin Wai / Win, Apr 8 |

### 3. Myanmar Handwriting OCR Is NOT a Go-Live Blocker

> **Rita (02:24):** "The Burmese handwriting, I think you guys have a really good strategy, but we should not block that. That should not be a blocker to go live, because what we were going to do was just read it and then still send it to a human to review."

**Impact:** Our handwriting OCR work is validated but deprioritized. Go-live uses human review as fallback.

### 4. Don't Over-Engineer

> **Rita (02:08):** "Don't get distracted because you don't need to."
> **Rita (03:25):** "Don't over engineer this. Don't overthink this."

### 5. Control Mailbox Must Move to Zaya Labs Before Go-Live

> **Rita (05:51):** "We can't do this on Gmail, right? There's a list of things that must happen before we go live. That's one of them."

New mailbox: **emoney@zeyalabs.ai** (Vinh + Win own this)

### 6. Infrastructure Choice = LLM Choice (Still Open)

> **Rita (16:54):** "Either we use a Google infrastructure and you guys know how to set that up, manage it... or we use Bedrock, in which case you don't use Gemini, we use Claude or you use Anthropic."

> **Rita (18:27):** "Once we pick our infrastructure, you don't get to pick whatever LLM you want to use. We will pick an enterprise LLM that we will use."

> **Minh (16:18):** "The important thing here is not about which LLM. The problem is coming from the infrastructure."

**Gemini NOT on Bedrock confirmed by Rita:**
> **Rita (14:47):** "Bedrock doesn't support Gemini natively anymore because Bedrock is a competitive feature to Google Cloud."

**Gemma rejected by Tin:**
> **Tin (15:29):** "This is the open source model that's not good for document or OCR... I think we stick on the Gemini for the best accuracy."

**Two paths remain:**
- **Path A:** Google Cloud → keep Gemini (Tin prefers for OCR accuracy)
- **Path B:** AWS Bedrock → use Claude/Anthropic (Rita's AWS contacts ready)

### 7. Interim Plan: Vercel Pro + Supabase Pro (From Post-Meeting Teams Chat)

> **Vinh (10:32, Teams):** "Trước mắt làm NextJS và Postgres, Supabase trên Vercel Pro bên Zeralab trước. Sau này migrate qua Infras do Tín và Huy setup sau."

Translation: **First, deploy NextJS + PostgreSQL (Supabase) on Vercel Pro under Zaya Labs. Later, migrate to infrastructure that Tin and Huy set up.**

This means: **Don't wait for AWS/GCP decision. Ship on Vercel Pro + Supabase Pro NOW, migrate later.** This is the fastest path to Wednesday go-live.

---

## Action Items

| # | Action | Owner | Deadline |
|---|--------|-------|---------|
| 1 | Implement batch/unbatch feature | DK + team | Before Apr 15 |
| 2 | Implement audit confirmation form | DK + team | Before Apr 15 |
| 3 | Implement finance approval exemption list | DK + team | Before Apr 15 |
| 4 | Move control mailbox to emoney@zeyalabs.ai | Vinh + Win | Before Apr 15 |
| 5 | Setup Vercel Pro + Supabase Pro (interim backend + DB) | DK + Tin | TODAY |
| 6 | NextJS + PostgreSQL backend | DK + Tin | This week |
| 7 | Setup MFA on mailbox for Trustify control | Vinh | ASAP |
| 8 | Get final Wave team feedback | Win | April 10 |
| 9 | Review DevOps infra proposal | Minh | This week |
| 10 | Send infra proposal to Rita → AWS contacts | Minh → Rita | This week |
| 11 | Give Tin's WhatsApp to Rita for AWS group | Vinh | Today |
| 12 | Manage manual rollout plan | Win | Before Apr 15 |

---

## Rita's AWS Contacts (New Intelligence)

| Person | Role | Context |
|--------|------|---------|
| **Vo** | Head of AWS Financial Services (likely APAC) | Rita reached out directly |
| **Victoria** | AWS account manager for Yoma | In the WhatsApp group |
| **Hung** | Head of Solutions Architect team, HCM City | AWS team in Vietnam |

Rita is part of an AWS WhatsApp group. She asked for Trustify's infra assessment before connecting the teams.

---

## Post-Meeting Teams Chat Summary (10:27 - 10:36 AM)

**Vinh's assignments:**
1. "Khanh Nguyen Duy em work với Tin Dang Huynh Trung để implement backend và DB cho eMoney app nhé" → **DK + Tin: backend + DB**
2. "anh sẽ work với win để setup new control mail box emoney@zeyalabs.ai" → **Vinh + Win: mailbox**
3. "t4 tuần sau golive cho bên Wave Money rồi là phải có DB và backend để store record" → **Week 4 go-live needs DB + backend**
4. "ưu tiên phần này trong hôm nay cho anh nha" → **Priority this TODAY**
5. "đưa lên Vercel Pro và Supabase pro trước để có backend và DB" → **Vercel Pro + Supabase Pro first**
6. "em liên hệ Tin Dang Huynh Trung nhé" → **Contact Tin**
7. "em setup MFA bên phía mình luôn cho dễ control" → **Setup MFA for security**

**Tin's responses:**
- "có gì hú em help" → "call me if you need help"
- "ok" → acknowledged backend + DB assignment

**Note:** "Dong Duong Bac is out of office and may not respond" — Dong is unavailable.

---

## What This Changes

### Previous Understanding vs Reality

| Before (Apr 8) | After (Apr 9) |
|---|---|
| Go-live = full automated pipeline | **Go-live = manual forwarding, human review** |
| Myanmar OCR must work perfectly | **OCR is NOT a go-live blocker** |
| Wait for Huy to setup AWS (weeks) | **Ship on Vercel Pro + Supabase Pro NOW, migrate later** |
| Dong helps with frontend next week | **Dong is out of office** |
| DK works alone on dashboard | **DK + Tin collaborate on backend + DB** |
| Infrastructure takes weeks | **Interim: Vercel Pro + Supabase today** |
| Need to compare LLMs | **"Don't get distracted." Ship what works.** |
| Complex feature backlog | **Only 3 features: batch/unbatch, audit form, finance exemption** |

### Revised Priority Stack (Apr 9 → Apr 15)

| Priority | Task | Effort | Who |
|---|---|---|---|
| **P0** | Vercel Pro + Supabase Pro setup | 2-4h | DK + Tin |
| **P0** | NextJS scaffold + PostgreSQL schema | 4-6h | DK + Tin |
| **P1** | Finance approval exemption list | 2-3h | DK |
| **P1** | Audit confirmation form | 2-3h | DK |
| **P1** | Batch/unbatch (needs spec clarification) | 4-8h | DK (after spec from Win) |
| **P2** | Migrate current index.html features to NextJS | 8-16h | DK + Tin |
| **P2** | Control mailbox migration | Vinh + Win | Vinh + Win |
| **P3** | Polish / UI cleanup | 2-4h | DK |

---

## Unknowns That Need Answers

| Question | Who to Ask | Why It Matters |
|---|---|---|
| What exactly is "batch and unbatch"? | Win / Thet Hnin Wai | Can't implement without spec |
| What does the audit confirmation form look like? | Win / Rita | Need template/format |
| Finance exemption client email list — when? | Win / Thet Hnin Wai | Needed for implementation |
| Vercel Pro + Supabase Pro — who creates the accounts? Zaya Labs billing? | Vinh / Tin | Need access today |
| POI number matching requirement — what is this? | Win | Mentioned but unclear |
| Does "go-live" include the AI pipeline or just manual workflow? | Rita / Vinh | Scoping question |

---

## Rita's New "Product Builder + Hardening Engineer" Model

Rita is experimenting with a new workflow for Star City Living App:
1. **Rita builds frontend with AI** (Claude) in hours
2. **Trustify engineers "harden"** the AI-generated code (review, security, testing)

> **Rita (12:13):** "It's not about these guys doing the work. It's about these guys reviewing the work that AI has done."

**DK's relevance:** This model is what DK already does (build with AI assistance). If this model succeeds at Trustify, DK's "AI-augmented development" skill becomes the standard, not the exception. Watch this closely.

---

## Key Quotes

> **Rita on scope:** "Don't get distracted. Don't over engineer this. Don't overthink this." (02:08-03:30)

> **Rita on go-live:** "We're going to do it manually at first, so there's no reading of an email. It's just something that we're forwarding." (06:43)

> **Rita on timeline:** "We have a board meeting on Thursday and it would be very good to say that we're live." (07:12)

> **Rita on infrastructure:** "Once we pick our infrastructure, you don't get to pick whatever LLM you want to use." (18:27)

> **Minh on infrastructure:** "The problem is coming from the infrastructure... we should stick with something AWS has already." (16:18)

> **Tin on Gemini:** "I think we stick on the Gemini for the best accuracy." (15:29)
