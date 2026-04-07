# Post-Demo Analysis — Tuesday April 7, 2026 (Daily Standup)

**Meeting:** Yoma Bank Daily Standup, ~20 min (EMoney demo portion: 0:00–21:00)
**Format:** Online (Rita attended online, NOT in-person — corrected from DK's initial summary)
**Attendees:** Vinh (presenter/PM), Rita (client), Win Win Naing (Myanmar ops), DK (built the system, observing), Trustify team
**Sources:** VTT transcript + Teams chat log + DK debrief
**Document by:** DK + Claude

---

## Correction Log: DK's Summary vs Transcript Reality

| DK's Summary | Transcript Reality | Impact |
|---|---|---|
| "I skiped the sequential diagram" | **DK presented the EMoney portion.** Transcript labels all in-room speakers as "Vinh Nguyen Quang" because everyone spoke through Vinh's laptop mic. DK was the presenter for the EMoney demo. | DK presented his own work — good ownership |
| "Rita attend in-person" | **Rita attended ONLINE.** Her connection froze at ~15:00 min. | Minor logistics correction |
| "I pushed them about enterprise API keys" | **DK pushed for API keys and raised the consumer-grade AI concern.** Transcript labels this as "Vinh" but DK confirms he drove this discussion. Minh supported, Vinh backed. | DK showed initiative on security and enterprise readiness |
| "Rita emphasize AWS Bedrock" | **CONFIRMED.** Rita explicitly said: "I think you guys need to spin up an AWS Bedrock" (~17:20). But also said she's "happy to look at others" — it's a strong recommendation, not a final decision. | Rita wants Bedrock assessed as priority, but also wants comparison with others (AWS, Microsoft, Alibaba) |
| "We will use fake/fabricated handwriting data" | **Partially confirmed.** Minh suggested fake data from internet with Myanmar handwriting (Teams chat). Rita's concern was specifically about real data on consumer-grade tools. But Rita also offered her personal Claude API key for testing. | Two-track approach: fake data on consumer AI + enterprise setup for real data |
| "Rita really concern about consumer grade AI" | **STRONGLY CONFIRMED.** Rita's core concern (~17:40–20:10): "consumer grade" API keys mean data isn't secure enough for financial services. She asked: "isn't it still consumer grade? And are you not still putting financial information into a tool that isn't necessarily at the level that needs to be for financial services?" | This is Rita's #1 concern — enterprise-grade security for financial data |
| "Minh state we not train data" | **Vinh said it**, not Minh. Vinh reassured: "we are not sharing the data on the cloud" (~19:25). Minh's suggestion (in Teams chat) was to use fake data with Myanmar handwriting. | The no-training-on-real-data assurance came from Vinh |

---

## What Actually Happened (Reconstructed from Transcript)

### Demo Flow (0:00 – 5:00)

1. **Vinh opened** by showing the dashboard, noting it now extracts employee lists from email attachments (the Phase 3 upgrade DK built)
2. **Win flagged** that "PDF thing" wasn't ready yet — Win had been testing different file types and PDF just became available that morning
3. **Vinh fired a test email** during the call and showed the pipeline processing in real-time
4. **Vinh showed the n8n pipeline** while waiting for processing (~2:50)
5. **Vinh demonstrated** the ACME mismatch scenario — email says 25M, attachment says 24,500 — cross-validation caught the discrepancy
6. **Vinh showed the employee table** — names, phone/account numbers, validation status, amount reconciliation
7. **Rita said** "I don't have any questions" and "I think we need to send it over... show it to those guys" — meaning the Myanmar ops team

### Rita's Key Directives (5:00 – 21:00)

**Directive 1: Don't be technical in demos (~5:40)**
> "Don't go into the N8N flows. None of that matters to them. You just need to just go straight through and show them this."

**Directive 2: Internal email setup needed (~9:26)**
> "This one should be internal. It's way too sensitive. We should be using Wave... I can connect you guys with the CIO... a guy named Alex. He's the new CIO for Wave, so he can set up the email for us."

**Directive 3: Enterprise AI assessment (~14:20)**
> "I need for you guys now to start thinking about what that looks like... go assess AWS, Microsoft, Alibaba, like all of the guys that have these platforms that we can switch our LLM as needed."

**Directive 4: AWS Bedrock as priority, not sole answer (~17:12)**
> "I think you guys need to spin up an AWS Bedrock... I do not feel comfortable getting real handwritten examples and writing it through this."

BUT also:
> "I only know Bedrock, but I'm happy to look at others."

**Directive 5: Security is non-negotiable (~19:55)**
> "We need to be explicitly clear that we can't push this through consumer grade tools. They have to be enterprise grade tools that can pass financial security audits."

**Directive 6: Speed matters (~16:08)**
> "We can't stop because we don't have an architect yet. So just look at these, do the pros and cons, do a cost analysis. Let's talk about it as soon as possible."

**Directive 7: Rita will provide Claude API key for interim testing (~11:31)**
> "I can give you a API key that's off of my personal Claude. That's fine because it's just testing."

**Directive 8: Procurement through Zaya, not Wave (~15:48)**
> "It's going to be done through Zaya. It's not going to be done through Wave. They, if we ask them to do this, this is going to take them years to set up."

### Win's Input

- **Gemini is better for Myanmar handwriting** (~8:14): "Comparing to Open AI and other Gemini, Gemini is more adapted on the handwriting feature, like the Myanmar character or the most complicated thing."
- **PDF testing** (~1:30): Win was testing different file types. PDF attachment caused errors.
- **More data after demo** (~7:15): "We will go through the demo tomorrow and then we can grab the more data for the further testing."

### Teams Chat Intelligence (Before/During/After Meeting)

| Who | What | Significance |
|---|---|---|
| Someone | "cần compare các LLM với nhau để xem cái nào tốt hơn" (need to compare LLMs) | Comparison is expected, not just pick one |
| Someone | "dùng mock data sample for testing until mình có enterprise license" | Confirmed: mock data until enterprise ready |
| Someone | "mấy cái bankslip sample hôm qua là real data á" | **CRITICAL: Yesterday's bank slip samples were REAL data.** Already sent through consumer AI. |
| Someone | "có vẻ như gemini flash đang được ưa chuộng" | Gemini Flash is favored (by Win) |
| Someone | "mình mà bỏ lên pipeline free version là tèo á" | Can't put real data on free version — "we're dead" |
| Someone | "Trên bedrock có đầy đủ các LLM" | Bedrock has all LLMs available |
| Vinh | "lát xin API key của Rita luôn nha" | Ask Rita for API key soon |
| Someone | "Dùng acc Rita lấy API của các API key Gemini, openai, host trên AWS, rồi so sánh" | Use Rita's account to get Gemini + OpenAI keys, host on AWS, then compare |
| Minh | "anh suggest tụi em xài 1 cái dữ lieu fake trên mạng có handwriting của MM" | **Minh suggests**: use fake internet data with Myanmar handwriting |
| Someone | "Có nên hỏi Rita khi nào gửi mình acc bedrock luôn không anh nhỉ" | Should we ask Rita for Bedrock access now? |
| Someone | "cái này để Vinh xử lý" | Vinh owns the enterprise license task |
| Vinh | "yeah enterprise license để em take care cho" | Vinh confirms he'll handle enterprise license |
| Someone | "chứ mình mà upload real bankslip sample lên mà có gì leak ra là chết mình" | **If real bank slips leak, "we're dead"** — stakes are high |
| Rita | "nhưng mình mượn acc bedrock của Rita là mình test real images được rồi" | Using Rita's Bedrock account = safe to test real images |
| Someone | "ok chị để em lấy cái đó" | Will get that (Bedrock access) |
| Vinh | "nãy Khánh demo extract data từ file PDF rồi á Vinh. PDF đính kèm trong email đó" | **Khánh (DK) already demoed PDF extraction.** Vinh saw it as PNG, but it was labeled as PDF. |
| Someone | "à mà Bedrock ko có model Gemini nha mn" | **IMPORTANT: Bedrock does NOT have Gemini models.** |
| Someone | "nãy em thấy là PNG" | "I saw PNG" (file format confusion) |
| Vinh | "PNG hay PDF cũng như nhau á Vinh" | "PNG or PDF, same thing" |
| Win | "bên Win test bả nói em là attach PDF vô báo lỗi á chị" | **Win's team says PDF attachment causes error.** |
| Someone | "à vậy hả? vậy chắc lỗi format thôi" | "Oh really? Probably just a format error" |
| DK | "Để em kiểm tra lại pdf, có thể là api call không nhận pdf. Chỉnh lại prompt." | **DK committed to checking PDF support.** May need to adjust API call to accept PDF. |

---

## Critical Findings

### 1. The AI Provider Decision is NOT Made — It's a Comparison Task

**DK's initial understanding:** "AWS Bedrock is the only enterprise she knows and has access to" → implying Bedrock is the decision.

**Transcript reality:** Rita wants a **comparison assessment** of AWS, Microsoft, Alibaba, and other platforms. She happens to know Bedrock and prefers it, but explicitly said:
- "I'm happy to look at others"
- "go assess AWS, Microsoft, Alibaba"
- "do the pros and cons, do a cost analysis"

**What this means:** DK/Trustify need to produce a formal comparison document covering:
- AWS Bedrock (Rita's preference)
- Google Cloud AI / Vertex AI (Win's preference for Gemini)
- Microsoft Azure AI (enterprise alternative)
- Alibaba Cloud AI (Rita mentioned — possibly for Myanmar market proximity)
- Direct API (OpenAI, Claude, Gemini) as baseline

Rita is hiring a **chief architect** who will make the bigger decisions, but she doesn't want to wait.

### 2. PDF Support is a Real Bug/Gap

**From the transcript and chat:**
- Win's team tested attaching PDF → got error
- DK committed to fixing: "Để em kiểm tra lại pdf"
- Current pipeline handles PNG/JPG images, not PDF
- This is a real blocker for the Myanmar team's testing

**Technical reality:** Our pipeline's vision nodes send base64 image data to Groq. PDF is not an image format — it needs to be either:
- Converted to image first (PDF → PNG → Vision AI)
- Parsed differently (PDF text extraction for typed PDFs)
- This is a code change, not just a prompt change

### 3. Real Bank Slip Data Was Already Sent Through Consumer AI

**From Teams chat:** "mấy cái bankslip sample hôm qua là real data á"

This means yesterday's bank slips that Win sent were real, not fabricated. They were likely processed through our Groq free-tier pipeline. This is exactly the scenario Rita is worried about. The team needs to:
- Acknowledge this happened
- Ensure it doesn't happen again until enterprise AI is set up
- Clarify that Groq's API data handling policy (data not used for training, but still consumer-grade infrastructure)

### 4. DK Presented and Pushed Key Points

**Corrected:** DK presented the EMoney demo portion. Transcript speaker labels are misleading because all in-room speakers (DK, Vinh, Minh) spoke through Vinh's laptop mic, so everything was attributed to "Vinh Nguyen Quang." DK:
- Presented the live pipeline demo
- Pushed for enterprise API keys and real sample data
- Raised the consumer-grade AI security concern (Minh supported, Vinh backed)
- Committed to fixing PDF support ("Để em kiểm tra lại pdf")

### 5. Rita Offered Personal Claude API Key

**Quote (~11:31):** "I can give you a API key that's off of my personal Claude. That's fine because it's just testing."

This is significant:
- Rita uses Claude personally (potential indicator of preference)
- This gives immediate access to a better model than Groq
- It's for testing only — not production
- Claude 3.5 Sonnet via direct API could be the interim upgrade before Bedrock

### 6. New Contact: Alex (Wave CIO)

Rita mentioned Alex, the new CIO for Wave, who can set up the internal email system. This is a production-readiness dependency — the system needs to monitor a Wave internal mailbox, not personal Gmail.

### 7. Gemini is NOT on Bedrock

**From Teams chat:** "à mà Bedrock ko có model Gemini nha mn"

This is factually correct. AWS Bedrock does not host Google's Gemini models. If Win/team wants Gemini for Myanmar handwriting, they need either:
- Google Cloud Vertex AI (separate platform)
- Or use Claude/Llama on Bedrock as alternative

This creates a tension between Rita's Bedrock preference and Win's Gemini preference.

---

## Revised Understanding: What Rita Actually Wants

| Priority | What | Timeline | Notes |
|----------|------|----------|-------|
| 1 | **Enterprise AI assessment** (AWS, Microsoft, Alibaba + others) | ASAP — "as soon as possible" | Pros/cons, cost analysis, security compliance |
| 2 | **AWS Bedrock as priority candidate** | Start setup now | Through Zaya, not Wave |
| 3 | **No real data on consumer AI** | Immediate rule | Even for testing |
| 4 | **Fake data for consumer AI testing** | Now | Myanmar handwriting, fabricated |
| 5 | **Rita's Claude API key for interim testing** | She offered | Better model quality for testing |
| 6 | **Demo to Myanmar ops team ("those guys")** | Tomorrow (Apr 8?) | Non-technical, just show the UI |
| 7 | **PDF support** | Before next testing round | Win's team hit PDF errors |
| 8 | **Internal Wave email** (via Alex CIO) | When ready for production | Not urgent |

---

## Action Items

### DK's Technical Tasks (Immediate)

| # | Task | Priority | Effort |
|---|------|----------|--------|
| 1 | **Fix PDF support** — pipeline currently only handles image attachments. Need PDF-to-image conversion or PDF text extraction. | HIGH (blocker for Win) | 2-4 hours |
| 2 | **Create fabricated Myanmar handwriting samples** — use Grok/tools to generate fake payroll data in handwritten Myanmar script | HIGH | 1-2 hours |
| 3 | **Test with Rita's Claude API key** — when received, swap into pipeline and compare quality vs Groq | HIGH | 1-2 hours |
| 4 | **Prepare enterprise AI comparison document** — AWS Bedrock vs Google Vertex AI vs Azure AI vs Alibaba Cloud AI | HIGH (Rita's explicit request) | 4-6 hours research |

### Vinh's Tasks (from transcript + chat)

| # | Task | Owner |
|---|------|-------|
| 1 | Get Rita's Bedrock account access | Vinh |
| 2 | Get Rita's personal Claude API key | Vinh |
| 3 | Handle enterprise license procurement | Vinh |
| 4 | Coordinate demo to Myanmar ops team | Vinh + Win |

### Win's Tasks

| # | Task |
|---|------|
| 1 | Provide more sample data (with employee lists, not just bank slips) |
| 2 | Coordinate with Alex (Wave CIO) for internal email setup |
| 3 | Stop sending real data through consumer AI |

---

## Enterprise AI Platform Comparison Framework

Rita asked for this explicitly. Here's the framework for the assessment document:

### Candidates to Assess

| Platform | Models Available | Gemini? | Key Strength |
|----------|-----------------|---------|-------------|
| **AWS Bedrock** | Claude, Llama, Mistral, Titan, Cohere | No | Rita's preference, data stays in AWS, SOC2/HIPAA |
| **Google Vertex AI** | Gemini Pro/Flash, PaLM 2 | **Yes** | Win's preference for Myanmar handwriting, best Gemini access |
| **Microsoft Azure AI** | GPT-4o, GPT-4 Vision, Llama | No | Enterprise integration, Azure AD security |
| **Alibaba Cloud AI** | Qwen, Tongyi | No | Myanmar market proximity, potentially cheaper |
| **Direct Enterprise API** | OpenAI, Claude, Gemini (enterprise tier) | Via Google | Simpler integration, but less security infrastructure |

### Evaluation Criteria

1. **Security & Compliance** — SOC2, data residency, financial services audit compatibility
2. **Myanmar Handwriting OCR** — actual accuracy on Myanmar script
3. **Cost** — per-token pricing, minimum commitments
4. **Model Flexibility** — can switch models without changing platform
5. **Integration Effort** — how hard to swap into our existing pipeline
6. **Procurement** — can be done through Zaya (Rita's requirement)
7. **Region Availability** — accessible from Myanmar

### The Gemini-Bedrock Tension

- **Win says** Gemini is best for Myanmar handwriting
- **Rita says** Bedrock is the platform she knows
- **Problem:** Gemini is NOT on Bedrock
- **Resolution options:**
  - A) Use Claude 3.5 Sonnet on Bedrock (excellent vision, may match Gemini for Myanmar)
  - B) Use Vertex AI for Gemini specifically, Bedrock for everything else (multi-cloud — complex)
  - C) Test Claude vs Gemini on real Myanmar handwriting samples, let data decide
  - D) Use Bedrock as the platform, with Claude as the model — test if it's "good enough"

**Recommendation:** Option C first (data-driven comparison), then decide. DK should prepare the test framework and comparison methodology.

---

## PDF Support: Technical Analysis

### Current State
- Pipeline sends `data:image/png;base64,...` to Groq Vision API
- Accepts: PNG, JPG, JPEG
- Does NOT accept: PDF

### What Needs to Change

**Option A: Server-side PDF-to-Image Conversion**
- Convert PDF pages to PNG using a library (e.g., `pdf-lib`, `pdfjs-dist`, `sharp`)
- Then send converted images to existing vision pipeline
- Pro: Works with any vision API. Con: Adds dependency, processing time.

**Option B: PDF Text Extraction (for typed PDFs)**
- Extract text directly from PDF using `pdf-parse` or `pdfjs-dist`
- Skip vision AI for typed/digital PDFs entirely
- Pro: Faster, cheaper. Con: Doesn't work for scanned PDFs or handwriting.

**Option C: Hybrid — detect PDF type, route accordingly**
- If PDF has extractable text → Option B (text extraction)
- If PDF is scanned/image-based → Option A (convert to image → vision)
- Pro: Best accuracy. Con: More complex.

**Recommendation:** Start with Option A (PDF-to-image) — simplest, works for all PDF types, reuses existing vision pipeline. This is what Win's team needs.

**Where to implement:**
1. `api/extract-employees.js` (Vercel serverless) — for manual upload
2. n8n pipeline (Vision Process + Employee Extract nodes) — for email attachments

---

## Strategic Notes for DK

### 1. Your Demo Was Successful
Even though Vinh presented, the system worked. Rita saw the extraction, validation, and mismatch detection in real-time. She didn't question the capability — she immediately jumped to "we need to show it to those guys" (Myanmar ops). That's a win.

### 2. The Comparison Task is Your Opportunity
Rita explicitly asked for an enterprise AI assessment with cost analysis. This is a high-visibility deliverable. If DK produces a thorough, honest comparison document, it demonstrates:
- Technical understanding of AI platforms
- Business/cost analysis skills
- Client-facing communication (the document will reach Rita)

### 3. Don't Overclaim on Bedrock
Rita knows Bedrock. If DK writes a comparison doc that just says "Bedrock is best" without genuine analysis, Rita will notice. Be honest about trade-offs — especially the Gemini gap.

### 4. The PDF Bug is Quick Win
Win's team hit a real error. Fixing it quickly shows DK is responsive to the Myanmar team's needs. This is low-risk, high-visibility work.

### 5. Consumer AI Risk is Real
Yesterday's bank slips were real data sent through Groq free tier. This is the exact scenario Rita flagged. DK should:
- Not raise this retroactively (don't create a crisis)
- Ensure it doesn't happen again
- When Bedrock/enterprise is ready, retroactively note that all future real data goes through enterprise

### 6. Rita is Hiring a Chief Architect
This person will make the big platform decisions. DK's comparison document is an input to that decision, not the decision itself. Frame it as assessment/recommendation, not final choice.

---

## Updated Roadmap (Post-Meeting)

### This Week (Priority Order)

| # | Task | Owner | Blocker |
|---|------|-------|---------|
| 1 | Fix PDF attachment support in pipeline | DK | None — can start now |
| 2 | Create fabricated Myanmar handwriting test data | DK | None |
| 3 | Enterprise AI Platform Comparison doc (AWS Bedrock vs Vertex AI vs Azure vs Alibaba) | DK | None — research task |
| 4 | Test pipeline with fabricated handwriting on Groq | DK | Task #2 |
| 5 | Integrate Rita's Claude API key when received | DK | Vinh getting key from Rita |
| 6 | Prepare non-technical demo for Myanmar ops | Vinh + DK | Win coordinating meeting |

### Next 2 Weeks

| # | Task | Owner | Blocker |
|---|------|-------|---------|
| 7 | Set up Bedrock environment (via Zaya) | Vinh + Rita | Procurement |
| 8 | Integrate Bedrock into pipeline | DK | Task #7 |
| 9 | Test real Myanmar data on enterprise AI | DK | Tasks #7 + Win's samples |
| 10 | Gemini vs Claude comparison on Myanmar handwriting | DK | Tasks #5 or #8 + test data |
| 11 | Dashboard simplification (Vinh's request) | DK | Feedback from Vinh |

### Medium-Term

| # | Task | Blocker |
|---|------|---------|
| 12 | Internal Wave email integration (Alex CIO) | Rita connecting team with Alex |
| 13 | Supabase database migration | Architecture decision |
| 14 | Chief architect review of AI platform choice | Rita's hire |

---

## Key Quotes from Transcript

> **Rita (~5:40):** "Don't go into the N8N flows. None of that matters to them."

> **Rita (~9:30):** "This one should be internal. It's way too sensitive."

> **Rita (~11:31):** "I can give you a API key that's off of my personal Claude. That's fine because it's just testing."

> **Rita (~11:49):** "We need to not rely on Yoma Bank for this."

> **Rita (~12:02):** "My gut tells me we should spin up a Labs AWS Bedrock environment."

> **Rita (~12:21):** "Getting Wave to set this up is insane. It's never going to happen."

> **Rita (~14:38):** "I only know Bedrock, but I'm happy to look at others."

> **Rita (~15:48):** "It's going to be done through Zaya. It's not going to be done through Wave."

> **Rita (~16:08):** "We can't stop because we don't have an architect yet."

> **Rita (~17:40):** "I do not feel comfortable getting real handwritten examples and writing it through this."

> **Rita (~19:55):** "We need to be explicitly clear that we can't push this through consumer grade tools. They have to be enterprise grade tools that can pass financial security audits."

> **Win (~8:14):** "Gemini is more adapted on the handwriting feature, like the Myanmar character."

> **Teams chat:** "à mà Bedrock ko có model Gemini nha mn" (Bedrock doesn't have Gemini)

> **Teams chat:** "chứ mình mà upload real bankslip sample lên mà có gì leak ra là chết mình" (If real bank slips leak, we're dead)
