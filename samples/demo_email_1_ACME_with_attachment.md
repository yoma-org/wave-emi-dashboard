# Demo Email 1 — ACME Innovations (AMOUNT MISMATCH)

**Attach:** `bank_slip_acme_innovations.png` (from this same folder)

**Expected result:** AMOUNT_MISMATCH — Email says 25,000,000 MMK but Vision AI reads ~24,500 from the bank slip. Both amount fields highlight yellow. Cross-validation box shows difference and percentage.

---

## Email

**Subject:** `Salary Disbursement Request - Acme Innovations Inc`

**Body:**

```
Dear Wave Money Operations Team,

Please process the salary disbursement for Acme Innovations Inc.

Amount: 25,000,000 MMK (SalaryToMA)
Payroll Period: February 1-15, 2024
Number of employees: 35

The bank slip confirmation is attached for your verification.

Approved by:
- U Kyaw Zin, Sales HOD — Approved
- Daw Su Su Lwin, Finance Manager — Approved

Please confirm receipt and processing timeline.

Best regards,
Maria Chen
Acme Innovations Inc.
```

---

## Demo talking points

1. "An email came in from Acme Innovations requesting 25 million MMK."
2. "Our AI pipeline parsed the email AND read the attached bank slip."
3. "Look — the left card shows what the AI extracted from the email: 25 million. The right card shows what it read from the document: 24,500."
4. "The system automatically flagged this as an AMOUNT MISMATCH. The difference and percentage are shown right here."
5. "Without this system, a human would have to manually open the bank slip, compare the numbers, and catch this discrepancy. Our AI does it in seconds."
