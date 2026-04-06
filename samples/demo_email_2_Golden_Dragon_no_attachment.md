# Demo Email 2 — Golden Dragon Ltd (NORMAL, no attachment)

**Attach:** NOTHING (send email only, no attachment)

**Expected result:** NORMAL scenario. Text AI parses company, amount, approvers. Vision AI card shows "Not processed — No attachment." Authority matrix complete (both approvers found). No mismatch.

---

## Email

**Subject:** `Salary Disbursement - Golden Dragon Trading Ltd`

**Body:**

```
Dear Wave Money Operations Team,

Please process monthly salary disbursement for Golden Dragon Trading Ltd.

Amount: 15,000,000 MMK (SalaryToMA)
Payment Period: March 2024
Total employees: 22

Approved by:
- U Aung Myint, Sales HOD — Approved
- Daw Aye Myint, Finance Manager — Approved

Employee list and bank slip will follow separately.

Thank you,
Ko Zaw Naing
Golden Dragon Trading Ltd
```

---

## Demo talking points

1. "This email came in without any attachment — just the text request."
2. "The AI still parsed everything: company name, amount, disbursement type, and both approvers."
3. "Notice the Vision AI card says 'Not processed — No attachment.' The system knows there's nothing to cross-validate."
4. "The authority matrix is complete — Sales HOD and Finance Manager both approved."
5. "Now compare this with the ACME ticket — that one HAD an attachment, so the AI read both the email AND the bank slip, and caught a discrepancy."
6. "The system handles both scenarios gracefully: with or without attachments."
