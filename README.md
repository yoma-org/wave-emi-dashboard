# 🌊 Wave EMI Disbursement Pipeline Dashboard

A Streamlit-based operations tool for Wave Money's corporate EMI (Electronic Money Instruction) disbursement workflow. Covers **Steps 1–3** of the full 7-step pipeline.

---

## 🗺️ Pipeline Overview

| Step | Stage | Tool |
|------|-------|------|
| 1 | Email Intake & Parsing | ✅ **This app** |
| 2 | Employee List Upload & MSISDN Validation | ✅ **This app** |
| 3 | Finance Approval | ✅ **This app** |
| 4 | Checker Review & MSISDN Correction | 🔗 [Checker Dashboard](https://dknguyentrustify.github.io/Wave-eMoney/) |
| 5 | CSV Generation (7 files) | 🔗 [Checker Dashboard](https://dknguyentrustify.github.io/Wave-eMoney/) |
| 6 | Group Mapping (OTC only) | 🔗 [Checker Dashboard](https://dknguyentrustify.github.io/Wave-eMoney/) |
| 7 | Monitoring & Close | 🔗 [Checker Dashboard](https://dknguyentrustify.github.io/Wave-eMoney/) |

---

## 🚀 Quick Start (Local)

### Prerequisites
- Python ≥ 3.9
- `pip` or `conda`

### Install & Run

```bash
# 1. Clone the repo
git clone https://github.com/yoma-org/wave-emi-dashboard.git
cd wave-emi-dashboard

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run
streamlit run app.py
```

Open your browser at **http://localhost:8501**

---

## 📁 File Structure

```
wave-emi-dashboard/
├── app.py                    # Main Streamlit application (Steps 1–3)
├── requirements.txt          # Python dependencies
├── sample_employees.csv      # Demo employee list for testing
├── .streamlit/
│   └── config.toml          # Streamlit theme configuration
├── .gitignore
└── README.md
```

---

## 🎭 Demo Mode

The app ships with **2 pre-seeded tickets** to illustrate the workflow:

| Ticket | Company | Scenario |
|--------|---------|---------|
| TKT-001 | Capital Taiyo | ✅ Normal — 22 employees, Finance Approved |
| TKT-002 | GGI Nippon Life | ⚠️ OTC — 41 employees, 2 invalid MSISDNs, Pending Finance |

Use the **🔄 Reset Demo** button in the sidebar to restore these at any time.

### Test Employee File
Use `sample_employees.csv` to test the employee upload flow:

```csv
name,msisdn,amount
U Kyaw Zin,09123456789,120000
Daw Aye Myint,09987654321,95000
Ko Thiha Zaw,+95 9 876 543210,110000
```

---

## 👥 Roles

Switch roles using the sidebar dropdown:

| Role | Access | Pages |
|------|--------|-------|
| **Intake / Maker** | Parse emails, upload employee lists, submit to Finance | Incoming Emails |
| **Finance** | Review reconciliation, approve/reject tickets | Finance Approval |
| **E-Money** | Hand off approved tickets to Checker Dashboard | E-Money Review |

> ⚠️ **Demo mode only:** Role switching uses session state, not real authentication. Do not process real customer data.

---

## ☁️ Streamlit Cloud Deployment

1. Go to [share.streamlit.io](https://share.streamlit.io)
2. Sign in with GitHub (`DKNguyenTrustify`)
3. Click **New app**
4. Repository: `yoma-org/wave-emi-dashboard` · Branch: `main` · File: `app.py`
5. Click **Deploy**

### Notes
- The `state.json` file is **ephemeral** on Streamlit Cloud — state resets on reboot (handled gracefully)
- Free tier: 1 GB RAM (app is well within limits)
- Repo must be **public** for Streamlit Community Cloud free tier

---

## 🛠️ Tech Stack

- [Streamlit](https://streamlit.io/) ≥ 1.32.0
- [Pandas](https://pandas.pydata.org/) ≥ 2.0.0
- [openpyxl](https://openpyxl.readthedocs.io/) ≥ 3.1.0 (Excel support)

---

## 📋 Roadmap (Phase 2)

- [ ] Step 4: Inline Checker Review within Streamlit
- [ ] Step 5: 7-file CSV Generation + ZIP download
- [ ] Step 6: Group Mapping UI (OTC disbursements)
- [ ] Step 7: Monitoring, Close & Archive workflow

---

*Built by Trustify for Wave Money Myanmar · Internal Operations Tool · v1.0*
