**Safety Review (1)**  
Your plan is **very solid** — low-risk overall, with excellent checkpoints and stop-rules. This is one of the cleanest overnight sprints I’ve seen.  

**Risks you’re missing (minor):**  
- PDF.js CDN load in `index.html`: If the user is on a very slow Myanmar mobile connection or has aggressive ad-blockers, the lazy-load could fail silently. Mitigation: Add a fallback message (“PDF preview loading…”) and a manual “Convert to image” button.  
- n8n Cloud binary handling: Gmail attachments sometimes come through with slightly different MIME types (`application/octet-stream` instead of `application/pdf`). Your MIME check must include a fallback.  
- Vercel cold starts + large base64: After PDF→PNG conversion, base64 can balloon. Add a quick client-side resize/compress step (max 2000px width) before sending to the API.  
- Regression on existing image flow: After adding PDF logic, the original PNG/JPG path must remain untouched.  

**Execution order**: Perfect. P0 → P1 → P3 (fast wins) → P2 layers is correct. The checkpoints are your safety net — you will always have something deployable. Fallbacks are sufficient. No risk of breaking existing functionality if you follow the “never touch v3 workflow” rule.  

**Verdict**: Deploy-safe. Proceed with confidence.

**Myanmar Handwriting OCR (2)**  
**Realistic accuracy on Groq Llama-4-scout (as of April 2026):**  
- Printed Myanmar (Unicode, clean fonts): ~75-85% character-level on tables.  
- **Handwritten Myanmar**: **35-65%** realistic (names often 40-55%, numbers/phones 70%+). Handwriting is the weak point — stacking consonants, tone marks, and cursive variations trip it up.  

**Best models for Myanmar script (current ranking):**  
1. **Gemini 3.1 Pro / 3 Flash** — clear leader in Burmese benchmarks.  
2. **Claude Opus 4.5 / Sonnet** — excellent natural Myanmar output.  
3. **GPT-5.x** — strong but slightly behind Gemini on Burmese.  
4. **Llama-4 Scout** — solid vision but **not in top 5** for Burmese; its 12-language list does **not** include Burmese. It will work but will be the weakest of the major VLMs here.  

**Key challenges (Myanmar-specific):**  
- Complex script: consonant stacking + vowel diacritics (many characters combine vertically).  
- Handwriting variability: thickness, slant, connected strokes.  
- Legacy Zawgyi encoding still appears in some real documents (but your images will be Unicode-rendered, so less issue).  
- Font/style variation across payroll templates.  

**Prompt for Grok image generation (copy-paste ready):**  
```
Generate a realistic, slightly imperfect handwritten Myanmar payroll document on white A4 paper with subtle paper texture and soft shadows, photographed from above under office lighting. Style: real ballpoint pen handwriting, natural variations in stroke thickness, slight smudges, realistic Myanmar script (not typed).

Layout: professional payroll table with 8-10 employees.

Columns (in order, left to right):
- No.
- Employee Name (in clear handwritten Myanmar script: မောင်မောင်, ဒေါ်ခိုင်ခိုင်, ကိုကိုကိုး, နှင်းဆီ, ဦးမြမြ, မယ်မယ်, ကိုမင်းမင်း, ဒေါ်စုစု)
- Phone Number (09xxxxxxxxx format, handwritten in Latin numerals)
- Amount (MMK, handwritten numbers with commas, e.g. 450,000)
- Remarks (short optional Myanmar note)

Bottom of table:
- Total Amount: 3,850,000 MMK (large bold handwriting)
- Company name at top: "Pacific Star Trading Co., Ltd." (handwritten in English + small Myanmar below)
- Date: 07 April 2026
- "Salary Disbursement Request" title in Myanmar and English

Make the handwriting legible but realistically imperfect — some letters slightly slanted or with natural pressure variation. High resolution, sharp focus, no blur. Aspect ratio 4:5 (portrait). Fake data only — no real names or phone numbers.
```

Use this exact prompt in Grok (or Grok Imagine). Generate 2 variations. Option B (AI Council) is good parallel but Grok’s image quality is currently excellent for this.

**PDF Support (3)**  
- **n8n Cloud Code node**: Not feasible without external services or custom nodes. Sandbox has no poppler/canvas/pdf-poppler. Your Option A (MIME detection + flag for manual upload) is the only safe path. Do not spend time on Option B.  
- **pdfjs-dist client-side**: Correct choice. Zero Vercel/serverless issues because it runs in the browser. Use CDN (`https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs`). Scale to 2.0x for OCR quality. Your code snippet is good. Add error handling and a progress indicator.  
- **Groq Llama-4-scout**: Does **not** accept PDF directly. Only images (base64 or URL, max 20 MB / 4 MB base64). OpenAI added PDF support recently; Groq has not.

**UI/UX Review (4)**  
- Label renaming: 100% correct. Removing “n8n”, “Groq”, “llama”, “MSISDN” makes it non-technical and professional.  
- Collapsible sections: Your CSS/JS pattern is robust enough for a single-file dashboard. Add `event.stopPropagation()` on toggles and aria attributes for accessibility (nice-to-have).  
- Mismatch flow terminology: “Return to Client” is understandable but slightly informal for banking. Better options used in real disbursement/approval systems: **“Return to Requester”** or **“Send Back to Client”** or **“Query Client”**. I recommend **“Return to Requester”** — it’s the cleanest and most common in Maker-Checker workflows.

**Culture Survey OCR Validation (5)**  
- Methodology: **Excellent** — bilingual ground truth is one of the best ways to measure real-world accuracy without fabricating data. Minh’s idea is smart.  
- Sample size (5,089 Myanmar characters, 52 rows): More than enough for a meaningful overnight assessment. It’s statistically useful for printed text.  
- Scoring: Use **semantic match** as your headline number (what humans actually care about). Report character-level as technical appendix. Exact string match is too strict — AI will rephrase naturally. 80%+ semantic = strong win; 50-70% = realistic consumer-grade; <50% = clear enterprise-AI justification.

**Time Management (6)**  
~7-8 hours is realistic if you stay disciplined.  
- P0 (image) + P1 (survey test): 2-2.5 hrs max.  
- P3 (labels + badges + collapsible + banners): 45-60 min.  
- P2 Layer 2 (PDF.js): 60-90 min (biggest unknown if you haven’t used it before).  

**If running behind, cut in this order:**  
1. P4 entirely (structural UX) — nice-to-have.  
2. P3d (info banners) — can be verbal in demo.  
3. P3c (collapsible) — defer to Phase 4 if needed.  

Parallel: While PDF.js is compiling/testing, you can run Culture Survey OCR in a separate browser tab with direct API calls.

**Demo Strategy (7)**  
**For Myanmar ops team (non-technical):**  
- **Definitely avoid**: Any mention of n8n, Groq, llama, API keys, base64, nodes, or “AI model”. Never open dev tools.  
- Script: “The system reads the email and attachment automatically. You just review and approve.”  

**Framing “AI failed to read Myanmar handwriting”**:  
Positive spin (use this verbatim):  
“Consumer AI can already read some Myanmar handwriting — but not perfectly. This is exactly why we’re moving to enterprise-grade AI (Claude/Gemini/Bedrock). The gap we’re seeing today is the business case for the investment Rita asked for.”

**Recommended demo flow (both meetings):**  
1. Live email send → ticket appears instantly.  
2. Click ticket → Amount Verification (visible by default).  
3. Expand “View AI Analysis” (collapsed) only if they ask.  
4. Show employee table (if P4a done) or just the summary.  
5. PDF support: “Even if Win sends a PDF, it now works.”  
6. End with: “What do you think? Any part confusing?”

You’re in great shape. This sprint positions you perfectly for tomorrow’s demos and the enterprise AI conversation. Execute cleanly and you’ll look extremely competent.  

If you hit any blocker tonight (especially PDF.js), ping me immediately — I can give exact code snippets. Good luck.