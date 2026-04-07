# AI Council Review Prompt — Phase 3.1 Implementation Plan

**Instructions for DK:** Copy the prompt below and send to AI councils (Claude, Gemini, Grok, GPT, DeepSeek, Perplexity). Attach `ImplementationPlan_Phase3.1.md` as context. Put responses into `research/ai_council_phase3.1/` folder.

---

## Prompt

```
I am a Data Engineer at Trustify Technology, building an automated salary disbursement system for Wave Money (a Myanmar bank). The system uses AI to:

1. Parse incoming disbursement request emails automatically
2. Extract employee lists from attached payroll documents (images, PDFs) using vision AI
3. Validate phone numbers, clean Myanmar name prefixes (U, Daw, Ko, Ma), reconcile amounts
4. Route through Finance approval → E-Money processing with CSV generation for Utiba system

CURRENT STATE:
- Single-file vanilla JS dashboard (index.html, ~2,540 lines) deployed on Vercel
- n8n Cloud automation pipeline (10 nodes): Gmail → AI text extraction → Vision AI → Employee extraction → Validation → Dashboard
- Current AI: Groq free-tier (llama-3.3-70b for text, llama-4-scout for vision)
- Working: English typed payroll extraction (12 employees, names cleaned, phones validated, amounts reconciled)
- NOT working: Myanmar handwriting, PDF attachments, Myanmar language OCR

TOMORROW'S DEMOS (April 8, 2026):
- 10:00 AM: Client meeting (Rita + team) — show Myanmar handwriting OCR capability + UX progress
- 10:30 AM: Myanmar ops team (non-technical, first time seeing system) — showcase + gather feedback

OVERNIGHT SPRINT PLAN (tonight → deploy by 8 AM):
I'm attaching my Implementation Plan Phase 3.1. Please review it critically.

WHAT I NEED FROM YOU:

1. SAFETY REVIEW
   - Are there any risks I'm missing in the overnight deployment?
   - Is the execution order safe? Should anything be reordered?
   - Are the fallbacks sufficient for each step?
   - Any risk of breaking existing functionality?

2. MYANMAR HANDWRITING OCR
   - What is realistic accuracy for Myanmar handwriting on Groq llama-4-scout?
   - Which model handles Myanmar script best: Claude 3.5 Sonnet, Gemini Flash, GPT-4o, Llama-4-scout?
   - Key challenges with Myanmar OCR (Zawgyi vs Unicode encoding, character stacking, font variations)?
   - Can you generate a realistic-looking FAKE Myanmar payroll document prompt I can use with Grok image generation? (Employee names in Myanmar script, phone numbers, amounts — all fictional)

3. PDF SUPPORT
   - Is converting PDF to PNG in an n8n Cloud sandboxed Code node feasible? What libraries are available?
   - For Vercel serverless: is pdfjs-dist the right choice? Any gotchas with canvas rendering in serverless?
   - Alternative approach: can Groq's llama-4-scout accept PDF directly via the OpenAI-compatible API? (I believe no, but verify)

4. UI/UX REVIEW
   - Is the label renaming approach correct? (n8n → Email Processing, MSISDN → Phone Number, etc.)
   - Collapsible sections pattern — is the CSS/JS toggle approach I described robust enough?
   - For the mismatch flow: is "Return to Client" the right banking terminology? What do real banks call this action?

5. CULTURE SURVEY OCR VALIDATION
   - Using a bilingual (English + Myanmar) survey as an OCR accuracy test — is this methodology sound?
   - The CSV answer key has 52 rows, 5,089 Myanmar characters. Is this enough for a meaningful accuracy assessment?
   - How should I score accuracy: exact string match, semantic similarity, or character-level comparison?

6. TIME MANAGEMENT
   - Is ~7-8 hours realistic for all the tasks listed?
   - Which tasks should I cut if I'm running behind?
   - Any tasks that could run in parallel?

7. DEMO STRATEGY
   - For the non-technical Myanmar ops team: what should I definitely avoid showing?
   - How do I frame "the AI failed to read Myanmar handwriting" as a positive outcome?
   - Any suggestions for the demo flow?

Please be honest and direct. I value accurate assessment over encouragement.
```

---

## Response Collection

Create folder: `research/ai_council_phase3.1/`

Save responses as:
- `claude_phase3.1_review.md`
- `gemini_phase3.1_review.md`
- `grok_phase3.1_review.md`
- `gpt_phase3.1_review.md`
- `deepseek_phase3.1_review.md`
- `perplexity_phase3.1_review.md`

---

## What To Extract From Responses

After collecting all responses, DK and Claude will:
1. Compare safety concerns — if multiple AIs flag the same risk, it's real
2. Cherry-pick the best Myanmar handwriting test approach
3. Verify PDF support feasibility (consensus across AIs)
4. Take the best demo strategy suggestions
5. Adjust the Phase 3.1 plan based on findings
