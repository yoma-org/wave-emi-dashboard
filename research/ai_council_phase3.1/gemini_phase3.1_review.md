This is a highly structured, pragmatic sprint plan. You have accurately identified the highest-value items for the demos and isolated the high-risk technical rabbit holes. 

Here is a direct, critical assessment of your Phase 3.1 plan to ensure you survive the overnight sprint and nail the demos.

---

### 1. Safety Review & Hidden Traps

Your execution order is generally solid, but there is a massive hidden trap in your **P2 Layer 2 (Client-Side PDF-to-Image)** plan that could derail the night.

* **The Vercel Payload Limit Trap:** You plan to render the PDF to a `<canvas>`, export it as a base64 PNG, and POST it to your Vercel serverless API (`api/extract-employees.js`). Vercel serverless functions have a strict **4.5 MB request body payload limit**. A high-resolution PNG of a document can easily exceed this, causing a silent 413 Payload Too Large error.
    * *The Fix:* Change `canvas.toDataURL('image/png')` to `canvas.toDataURL('image/jpeg', 0.8)`. JPEG compression is critical here to stay under the Vercel limit while maintaining enough quality for OCR.
* **Execution Order Tweak:** Do P1 (Culture Survey Test) *before* P0 (Handwriting). P1 uses existing, known data. If you get bogged down trying to fabricate the perfect handwriting image for P0, you risk having zero OCR metrics to show. Secure the P1 win first.

### 2. Myanmar Handwriting OCR

* **Realistic Accuracy:** Expect Groq's Llama vision model to perform poorly on Myanmar handwriting—likely **under 30% accuracy**. Llama models are heavily skewed toward English and Latin scripts. Burmese script is highly complex (circular geometry, stacked consonants, lack of explicit word spacing), and handwriting introduces wild variations.
* **Model Comparison:** For complex, low-resource scripts like Myanmar, **Gemini 1.5 Pro/Flash** and **Claude 3.5 Sonnet** are currently the undisputed leaders. They handle non-Latin document understanding natively. Llama will struggle. 
* **Key Challenges:** Aside from handwriting itself, the biggest technical hurdle is the historical Zawgyi vs. Unicode encoding conflict. If the AI outputs Zawgyi but your system expects Unicode (or vice versa), the text will render as gibberish.
* **Prompt for Fabricated Data:** To get a usable image from an image generator, you must be extremely specific about layout, as AI struggles to generate coherent non-Latin text.
    > *"A top-down, well-lit smartphone photo of a handwritten payroll sheet resting on a wooden desk. The paper is lined. The text is handwritten in blue ink. The document contains a table with three columns. The first column contains handwritten Myanmar (Burmese) script. The second column contains phone numbers in the format 09-XXX-XXX. The third column contains numbers ending in '000'. Make the handwriting look natural and slightly rushed. Do not use typed fonts."*

### 3. PDF Support Assessment

* **n8n Cloud Sandboxes:** Standard n8n Cloud instances do not support binary image rendering libraries (like `canvas`, `sharp`, or `Ghostscript`) natively. Trying to brute-force a PDF-to-PNG conversion inside an n8n Code node tonight will likely result in missing dependency errors. **Stick to your Layer 3a plan (MIME type detection + skip to manual).** It is the only safe overnight bet.
* **Client-Side PDF.js:** Loading Mozilla's `pdfjs-dist` via CDN is the correct approach for Vercel serverless architecture, entirely bypassing backend binary constraints.
* **OpenAI/Groq Vision APIs:** Standard OpenAI-compatible vision APIs (which Groq mimics) strictly require image formats (PNG, JPEG, WEBP). They do not accept `application/pdf`. Converting to images is mandatory for this specific pipeline.

### 4. UI/UX Review

* **Labels:** Your changes are spot on. Abstracting away "n8n" and "Groq" keeps the client focused on the business value, not the plumbing. "Email Processing" and "Ticket List" are perfect.
* **Collapsible JS/CSS:** The toggle class pattern is lightweight, robust, and requires zero external libraries. It's the right choice for a vanilla JS file. 
* **Banking Terminology:** "Return to Client" is okay, but in financial operations, you are usually dealing with a Maker-Checker dynamic. More standard terminology would be **"Return for Correction"**, **"Reject - RFI (Request for Information)"**, or **"Query with Sender"**. 

### 5. Culture Survey OCR Validation

* **Methodology Flaw:** Using the English translation as the ground truth for OCR accuracy is dangerous because it conflates *OCR capability* with *translation capability*. The AI might read the Myanmar text perfectly but translate it using different phrasing than your CSV, resulting in a false "failure."
* **Scoring Strategy:** You have 5,089 Myanmar characters in the CSV. That is an excellent sample size.
    * Instruct the AI to output *both* the raw extracted Myanmar text AND the English translation.
    * Score the translation using **Semantic Match** (Does it mean the same thing?).
    * If you have time, score the raw Myanmar text extraction using Character Error Rate (CER) or a simple character-level comparison. This gives you a true OCR metric to report.

### 6. Time Management

* **Realism:** 8-9 hours is highly optimistic for vanilla JS DOM manipulation and asynchronous file handling. Relying on your AI coding assistants will be vital here to compress the boilerplate generation for the PDF.js canvas rendering. 
* **What to Cut:** If you hit 3:00 AM and are falling behind, completely drop **P4 (Structural UX)**. The employee table in the modal and the mismatch flow are "nice-to-haves." The P3 label and color changes take 20 minutes and provide 80% of the perceived UX polish for the non-technical team.

### 7. Demo Strategy

* **Framing the "Failure":** You have the perfect narrative for when the Llama model inevitably fails on Myanmar handwriting. Lean into it. 
    * *Script:* "We stress-tested the current consumer-grade open-source AI with Myanmar handwriting. As expected, it struggled. This is exactly why Rita was right to suggest an enterprise AI assessment. Consumer tools handle English and printed text fine, but for the complex, localized reality of Wave Money's operations, we need to unlock enterprise models like Claude or Vertex."
* **Non-Technical Ops Demo:**
    * **Avoid:** Any mention of API calls, Webhooks, Base64, or Model parameters. 
    * **Focus:** Show them the email being sent, and the data appearing on the screen. Frame the AI not as a robot doing their job, but as an *assistant doing data entry*. 
    * **Flow:** When you open the ticket, say, "Normally, your team would have to read the email, open the attachment, and type this into a spreadsheet. The system has already drafted it for you. You just have to check the amounts and click approve." Let them see how it removes the tedious parts of their day.