# Quick Showcase Script (3-5 min)

> For Minh / boss — before client meeting. Keep it fast.

---

## Setup (30 sec before demo)

1. Open https://wave-emi-dashboard.vercel.app
2. Ctrl+Shift+R to reset (clean slate)
3. Have Gmail open in another tab (to show emails arriving)

---

## The Story (what to say)

### Opening (15 sec)

> "This is the EMI Pipeline dashboard. It automates the salary disbursement intake process — from email to approval. Let me show you what it does with a real email."

### Show Email 2 — Golden Dragon (NO attachment, ~1 min)

Send the Golden Dragon email. Wait ~30 sec for n8n to process.

> "An email just came in from Golden Dragon Trading requesting 15 million MMK."

**Click the ticket on Dashboard.**

> "The AI parsed everything automatically:"
> - **Company, amount, type** — extracted from the email text
> - **Authority matrix** — found both required approvers (Sales HOD + Finance Manager)
> - **Status** — ready for the next step

> "No human touched this. Email came in, AI parsed it, ticket created."

### Show Email 1 — ACME (WITH attachment, ~2 min) **THE WOW**

Send the ACME email with `bank_slip_acme_innovations.png` attached. Wait ~30 sec.

> "Now this one has a bank slip attached."

**Click the ticket.** Point to the two cards:

> "Left card — what the AI read from the **email**: 25 million MMK."
> "Right card — what the AI read from the **bank slip image**: 24,500."

**Point to the yellow highlights:**

> "See both amount fields are highlighted yellow? The system automatically detected a mismatch."

**Point to the cross-validation box:**

> "It shows the exact difference — and flags it for human review. Without this, someone would have to open the PDF, compare numbers manually, and hope they don't miss it."

### Privacy Toggle (10 sec)

**Click "Private" in the nav bar.**

> "One click — all sensitive data is blurred. For client demos or screen shares."

**Click "Visible", enter 1234.**

### Close (15 sec)

> "This covers Phase 1 of Rita's workflow — Request Intake. Email parsing, document vision, cross-validation, authority check. All automated."
>
> "Next phase: employee list processing + finance approval workflow. The foundation is solid."

---

## If They Ask Questions

**"What AI models?"**
> Groq — llama-3.3-70b for text, llama-4-scout for vision. Both free tier. Zero cost.

**"What about the employee Excel files?"**
> Stays client-side only. Never sent to cloud. That's Minh's rule — we follow it.

**"How long to build this?"**
> About 1 week. Single HTML file + n8n automation. No framework, no build step, deploys instantly.

**"Can it handle real volume?"**
> Current version is a demo. Production would need: database instead of localStorage, proper auth, and Utiba API integration. But the AI pipeline is production-ready.

**"What about Rita's other phases?"**
> Phases 1-3 covered (Intake, File Prep, Maker-Checker). Phases 4-6 partially. Phases 7-9 need live system access. We focused on the highest-impact phases first.
