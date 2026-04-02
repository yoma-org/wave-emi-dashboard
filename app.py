"""
Wave EMI Disbursement Pipeline Dashboard
Steps 1–3: Intake, Pre-checks, Finance Approval
Bridges to: https://dknguyentrustify.github.io/Wave-eMoney/ (Steps 4–7)
"""

import base64
import json
import os
import re
import time
from datetime import datetime

import pandas as pd
import streamlit as st

# ─── PAGE CONFIG ────────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="Wave EMI Dashboard",
    page_icon="🌊",
    layout="wide",
)

# ─── CSS INJECTION ──────────────────────────────────────────────────────────────
st.markdown("""
<style>
.risk-high    { background:#F8D7DA; color:#721C24; padding:3px 10px; border-radius:20px; font-size:12px; font-weight:600; display:inline-block; }
.risk-medium  { background:#FFF3CD; color:#856404; padding:3px 10px; border-radius:20px; font-size:12px; font-weight:600; display:inline-block; }
.risk-low     { background:#D4EDDA; color:#155724; padding:3px 10px; border-radius:20px; font-size:12px; font-weight:600; display:inline-block; }
.badge-awaiting { background:#E2E8F0; color:#475569; padding:3px 10px; border-radius:20px; font-size:12px; font-weight:600; display:inline-block; }
.badge-pending  { background:#FFF3CD; color:#856404; padding:3px 10px; border-radius:20px; font-size:12px; font-weight:600; display:inline-block; }
.badge-ready    { background:#D4EDDA; color:#155724; padding:3px 10px; border-radius:20px; font-size:12px; font-weight:600; display:inline-block; }
.badge-rejected { background:#F8D7DA; color:#721C24; padding:3px 10px; border-radius:20px; font-size:12px; font-weight:600; display:inline-block; }
.badge-sent     { background:#CCE5FF; color:#004085; padding:3px 10px; border-radius:20px; font-size:12px; font-weight:600; display:inline-block; }
.badge-otc      { background:#E0E7FF; color:#3730A3; padding:3px 10px; border-radius:20px; font-size:12px; font-weight:600; display:inline-block; }
.badge-ma       { background:#DBEAFE; color:#1E40AF; padding:3px 10px; border-radius:20px; font-size:12px; font-weight:600; display:inline-block; }
.track-done     { color:#28a745; font-weight:600; }
.track-pend     { color:#856404; font-weight:600; }
.track-fail     { color:#dc3545; font-weight:600; }
.approval-row   { display:flex; gap:8px; align-items:center; padding:4px 0; }
</style>
""", unsafe_allow_html=True)

# ─── CONSTANTS ──────────────────────────────────────────────────────────────────
STATE_FILE = os.path.join(os.path.dirname(__file__), "state.json")
CHECKER_DASHBOARD_URL = "https://dknguyentrustify.github.io/Wave-eMoney/"

ROLES = ["Intake / Maker", "Finance", "E-Money"]

# ─── MOCK EMAIL DATA ─────────────────────────────────────────────────────────────
MOCK_EMAILS = [
    {
        "id": "EMAIL-001",
        "subject": "Salary Disbursement – Myanmar Brewery Ltd",
        "from": "accounts@myanmarbrewery.com",
        "received": "2026-04-02 09:14:00",
        "company": "Myanmar Brewery Ltd",
        "type": "SalaryToMA",
        "amount_requested": 4_800_000,
        "amount_on_bank_slip": 4_800_000,
        "currency": "MMK",
        "scenario": "NORMAL",
        "required_approvals": ["Sales HOD", "Finance Manager"],
        "approvals": [
            {"name": "U Kyaw Zin", "role": "Sales HOD", "status": "Approved"},
            {"name": "Daw Aye Myint", "role": "Finance Manager", "status": "Approved"},
        ],
        "body_preview": (
            "Please process salary disbursement for 48 employees. "
            "Bank slip and employee list attached. "
            "Approved by U Kyaw Zin (Sales HOD) and Daw Aye Myint (Finance Manager)."
        ),
    },
    {
        "id": "EMAIL-002",
        "subject": "EMI Request – Thiri Dar Co. Ltd",
        "from": "finance@thirdar.com",
        "received": "2026-04-02 10:02:00",
        "company": "Thiri Dar Co. Ltd",
        "type": "SalaryToMA",
        "amount_requested": 3_200_000,
        "amount_on_bank_slip": 3_500_000,  # MISMATCH: 300,000 MMK gap
        "currency": "MMK",
        "scenario": "AMOUNT_MISMATCH",
        "required_approvals": ["Sales HOD", "Finance Manager"],
        "approvals": [
            {"name": "Ko Aung Myat", "role": "Sales Manager", "status": "Approved"},
            {"name": "Ma Hnin Wai", "role": "Finance Officer", "status": "Approved"},
        ],
        "body_preview": (
            "Attached bank slip and employee list for this month's salary run. "
            "Approved by Ko Aung Myat (Sales Manager)."
        ),
    },
    {
        "id": "EMAIL-003",
        "subject": "OTC Disbursement Request – Mega Steel Industries",
        "from": "hr@megasteel.mm",
        "received": "2026-04-02 11:30:00",
        "company": "Mega Steel Industries",
        "type": "SalaryToOTC",
        "amount_requested": 11_500_000,
        "amount_on_bank_slip": 11_500_000,
        "currency": "MMK",
        "scenario": "MISSING_APPROVAL",
        "required_approvals": ["Sales HOD", "Finance Manager"],
        "approvals": [
            {"name": "U Zaw Lin", "role": "Sales Manager", "status": "Approved"},
            # Finance approval MISSING — system must flag this
        ],
        "body_preview": (
            "Please find attached the employee list and bank confirmation for "
            "OTC salary processing. Approved by U Zaw Lin (Sales Manager). "
            "Awaiting Finance sign-off."
        ),
    },
]

# ─── VALIDATION & CLEANING LOGIC ────────────────────────────────────────────────

def normalize_msisdn(raw) -> str:
    """Strip Myanmar country code prefix before validation."""
    s = str(raw).strip().replace(" ", "").replace("-", "")
    if s.startswith("+959"):
        s = "0" + s[3:]       # +959XX → 09XX
    elif s.startswith("959") and len(s) > 10:
        s = "0" + s[2:]       # 959XX → 09XX
    return s


def validate_msisdn(raw) -> dict:
    """Valid Myanmar mobile: starts with 09, 10 or 11 digits total."""
    s = normalize_msisdn(raw)
    if not s.startswith("09"):
        return {"valid": False, "normalized": s, "reason": "Must start with 09"}
    if len(s) not in (10, 11):
        return {"valid": False, "normalized": s, "reason": f"Expected 10–11 digits, got {len(s)}"}
    return {"valid": True, "normalized": s, "reason": "OK"}


# Ordered longest-first to prevent partial matches (e.g., "Mrs." before "Mr.")
MYANMAR_PREFIXES = [
    "Nang", "Mrs.", "Mrs", "Daw", "Mr.", "Ms.", "Dr.",
    "Saw", "Nai", "Sai", "Mr", "Ms", "Dr", "Mg", "Ma", "Ko", "U",
]


def clean_name(raw_name: str) -> str:
    """Remove Myanmar/English honorific prefixes from name."""
    name = str(raw_name).strip()
    for prefix in MYANMAR_PREFIXES:
        pattern = rf'^{re.escape(prefix)}(?:\s+|(?=[A-Z]))'
        name = re.sub(pattern, '', name, flags=re.IGNORECASE).strip()
    return re.sub(r'\s+', ' ', name).strip()


COLUMN_ALIASES = {
    "name": ["name", "employee name", "emp name", "full name"],
    "msisdn": ["msisdn", "phone", "mobile", "phone number", "mobile number", "number"],
    "amount": ["amount", "salary", "amt", "disbursement amount"],
}


def resolve_columns(df_cols: list) -> dict:
    """Map actual column names to canonical names."""
    mapping = {}
    lower_cols = {c.lower().strip(): c for c in df_cols}
    for canonical, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            if alias in lower_cols:
                mapping[canonical] = lower_cols[alias]
                break
        if canonical not in mapping:
            raise ValueError(f"Missing required column. Expected one of: {aliases}")
    return mapping


def process_employee_list(df: pd.DataFrame) -> pd.DataFrame:
    """Clean names, validate MSISDNs, return enriched DataFrame."""
    col_map = resolve_columns(list(df.columns))

    result = pd.DataFrame()
    result["Original_Name"] = df[col_map["name"]].astype(str).str.strip()
    result["Cleaned_Name"] = result["Original_Name"].apply(clean_name)
    result["Amount"] = pd.to_numeric(df[col_map["amount"]], errors="coerce").fillna(0)

    validation = df[col_map["msisdn"]].apply(validate_msisdn)
    result["MSISDN"] = validation.apply(lambda x: x["normalized"])
    result["MSISDN_Valid"] = validation.apply(lambda x: x["valid"])
    result["Validation_Status"] = result["MSISDN_Valid"].map({True: "✅ Valid", False: "❌ Invalid"})
    result["Validation_Reason"] = validation.apply(lambda x: x["reason"])
    result["Name_Changed"] = result["Original_Name"] != result["Cleaned_Name"]

    return result


def reconcile_amounts(ticket: dict, employee_df) -> list:
    """
    Compare three amount sources.
    Returns list of check results: {"check", "status": pass|warn|fail, "detail"}
    """
    checks = []
    req = ticket["amount_requested"]
    slip = ticket.get("amount_on_bank_slip")

    # Check 1: Email amount vs Bank slip amount
    if slip is not None:
        if req == slip:
            checks.append({
                "check": "Email vs Bank Slip",
                "status": "pass",
                "detail": f"Both show {req:,.0f} MMK ✅"
            })
        else:
            gap = abs(req - slip)
            checks.append({
                "check": "Email vs Bank Slip",
                "status": "fail",
                "detail": f"Email: {req:,.0f} vs Slip: {slip:,.0f} — Gap: {gap:,.0f} MMK"
            })
    else:
        checks.append({
            "check": "Email vs Bank Slip",
            "status": "warn",
            "detail": "No bank slip uploaded yet"
        })

    # Check 2: Employee list total vs Requested amount
    if employee_df is not None and len(employee_df) > 0:
        emp_total = float(employee_df["Amount"].sum())
        if emp_total == req:
            checks.append({
                "check": "Employee Total vs Requested",
                "status": "pass",
                "detail": f"Both show {req:,.0f} MMK ✅"
            })
        else:
            gap = abs(emp_total - req)
            checks.append({
                "check": "Employee Total vs Requested",
                "status": "fail",
                "detail": f"Employees: {emp_total:,.0f} vs Requested: {req:,.0f} — Gap: {gap:,.0f} MMK"
            })
    else:
        checks.append({
            "check": "Employee Total vs Requested",
            "status": "warn",
            "detail": "No employee list uploaded yet"
        })

    # Check 3: Three-way match (only if both sources available)
    if slip is not None and employee_df is not None and len(employee_df) > 0:
        emp_total = float(employee_df["Amount"].sum())
        if req == slip == emp_total:
            checks.append({
                "check": "Three-Way Match",
                "status": "pass",
                "detail": f"All sources agree: {req:,.0f} MMK ✅"
            })
        else:
            checks.append({
                "check": "Three-Way Match",
                "status": "fail",
                "detail": f"Email: {req:,.0f} | Slip: {slip:,.0f} | Employees: {emp_total:,.0f}"
            })

    return checks


# ─── STATE MANAGEMENT ────────────────────────────────────────────────────────────

def save_state():
    """Persist tickets and activity log to disk after every mutation."""
    data = {
        "tickets": st.session_state.tickets,
        "activity_log": st.session_state.get("activity_log", []),
        "parsed_emails": list(st.session_state.get("parsed_emails", set())),
    }
    try:
        # Convert bytes to base64 for JSON serialization
        serializable = json.loads(json.dumps(data, default=str))
        with open(STATE_FILE, "w") as f:
            json.dump(serializable, f, indent=2)
    except Exception:
        pass  # Non-blocking — Streamlit Cloud filesystem is ephemeral


def load_state():
    """Load persisted state on startup."""
    try:
        with open(STATE_FILE, "r") as f:
            data = json.load(f)
            st.session_state.tickets = data.get("tickets", {})
            st.session_state.activity_log = data.get("activity_log", [])
            st.session_state.parsed_emails = set(data.get("parsed_emails", []))
    except (FileNotFoundError, json.JSONDecodeError):
        pass


def log_activity(message: str):
    """Append to activity log and persist."""
    if "activity_log" not in st.session_state:
        st.session_state.activity_log = []
    st.session_state.activity_log.insert(0, {
        "time": datetime.now().strftime("%H:%M:%S"),
        "message": message,
    })
    st.session_state.activity_log = st.session_state.activity_log[:20]
    save_state()


# ─── TICKET MODEL ────────────────────────────────────────────────────────────────

def generate_ticket_id() -> str:
    existing = [k for k in st.session_state.tickets.keys() if k.startswith("TKT-")]
    return f"TKT-{len(existing) + 1:03d}"


def derive_status(ticket: dict) -> str:
    """
    Derives status from track states. No circular references.
    Uses explicit sent_to_checker flag instead of checking own status.
    """
    if ticket["finance_status"] == "REJECTED":
        return "REJECTED"
    if ticket.get("sent_to_checker"):
        return "SENT_TO_CHECKER"
    if ticket.get("prechecks_done") and ticket["finance_status"] == "APPROVED":
        return "READY_FOR_CHECKER"
    if not ticket.get("prechecks_done"):
        return "AWAITING_EMPLOYEE_LIST"
    return "PENDING_FINANCE"


def compute_risk(ticket: dict) -> str:
    if ticket.get("has_mismatch") or ticket.get("scenario") == "MISSING_APPROVAL":
        return "HIGH"
    if ticket.get("invalid_msisdn_count", 0) > 0:
        return "MEDIUM"
    return "LOW"


def update_ticket(ticket_id: str, updates: dict):
    """Mutate ticket, re-derive status, persist."""
    ticket = st.session_state.tickets[ticket_id]
    ticket.update(updates)
    ticket["status"] = derive_status(ticket)
    ticket["risk_level"] = compute_risk(ticket)
    st.session_state.tickets[ticket_id] = ticket
    save_state()


# ─── DEMO SEED TICKETS ───────────────────────────────────────────────────────────

def seed_demo_tickets():
    """Pre-populate 2 tickets so dashboard looks alive."""
    seeds = [
        {
            "id": "TKT-001",
            "source_email_id": None,
            "company": "Capital Taiyo",
            "type": "SalaryToMA",
            "currency": "MMK",
            "scenario": "NORMAL",
            "created_at": "2026-04-01 14:22:00",
            "amount_requested": 2_450_000,
            "amount_on_bank_slip": 2_450_000,
            "has_mismatch": False,
            "employee_total": 2_450_000,
            "required_approvals": ["Sales HOD", "Finance Manager"],
            "email_approvals": [
                {"name": "U Myo Htun", "role": "Sales HOD", "status": "Approved"},
                {"name": "Daw Su Su", "role": "Finance Manager", "status": "Approved"},
            ],
            "approval_matrix_complete": True,
            "bank_slip_filename": "capital_taiyo_slip_apr.pdf",
            "bank_slip_bytes": None,
            "bank_slip_type": "application/pdf",
            "prechecks_done": True,
            "prechecks_at": "2026-04-01 14:25:00",
            "employee_data": None,
            "total_employees": 22,
            "invalid_msisdn_count": 0,
            "names_cleaned_count": 3,
            "employee_file_name": "capital_taiyo_employees.xlsx",
            "reconciliation": [
                {"check": "Email vs Bank Slip", "status": "pass", "detail": "Both show 2,450,000 MMK ✅"},
                {"check": "Employee Total vs Requested", "status": "pass", "detail": "Both show 2,450,000 MMK ✅"},
                {"check": "Three-Way Match", "status": "pass", "detail": "All sources agree: 2,450,000 MMK ✅"},
            ],
            "finance_status": "APPROVED",
            "finance_approved_by": "Thin Thin Aye",
            "finance_approved_at": "2026-04-01 15:10:00",
            "finance_notes": "Funds verified. Approved.",
            "sent_to_checker": False,
        },
        {
            "id": "TKT-002",
            "source_email_id": None,
            "company": "GGI Nippon Life",
            "type": "SalaryToOTC",
            "currency": "MMK",
            "scenario": "NORMAL",
            "created_at": "2026-04-02 08:45:00",
            "amount_requested": 5_100_000,
            "amount_on_bank_slip": 5_100_000,
            "has_mismatch": False,
            "employee_total": 5_100_000,
            "required_approvals": ["Sales HOD", "Finance Manager"],
            "email_approvals": [
                {"name": "Ko Thiha", "role": "Sales Manager", "status": "Approved"},
            ],
            "approval_matrix_complete": False,
            "bank_slip_filename": "ggi_slip_apr.png",
            "bank_slip_bytes": None,
            "bank_slip_type": "image/png",
            "prechecks_done": True,
            "prechecks_at": "2026-04-02 08:50:00",
            "employee_data": None,
            "total_employees": 41,
            "invalid_msisdn_count": 2,
            "names_cleaned_count": 7,
            "employee_file_name": "ggi_employees.xlsx",
            "reconciliation": [
                {"check": "Email vs Bank Slip", "status": "pass", "detail": "Both show 5,100,000 MMK ✅"},
                {"check": "Employee Total vs Requested", "status": "pass", "detail": "Both show 5,100,000 MMK ✅"},
            ],
            "finance_status": "PENDING",
            "finance_approved_by": None,
            "finance_approved_at": None,
            "finance_notes": None,
            "sent_to_checker": False,
        },
    ]
    for t in seeds:
        t["status"] = derive_status(t)
        t["risk_level"] = compute_risk(t)
        st.session_state.tickets[t["id"]] = t
    save_state()
    log_activity("Demo tickets seeded (Capital Taiyo + GGI Nippon)")


def init_state():
    load_state()

    if "current_role" not in st.session_state:
        st.session_state.current_role = "Intake / Maker"
    if "parsed_emails" not in st.session_state:
        st.session_state.parsed_emails = set()
    if "tickets" not in st.session_state:
        st.session_state.tickets = {}
    if "activity_log" not in st.session_state:
        st.session_state.activity_log = []

    # Seed demo tickets only if completely empty
    if len(st.session_state.tickets) == 0:
        seed_demo_tickets()


# ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────────

def all_tickets():
    return list(st.session_state.tickets.values())


def count_by_status(status: str) -> int:
    return sum(1 for t in all_tickets() if t["status"] == status)


def status_badge_html(status: str) -> str:
    cls_map = {
        "AWAITING_EMPLOYEE_LIST": "badge-awaiting",
        "PENDING_FINANCE": "badge-pending",
        "READY_FOR_CHECKER": "badge-ready",
        "REJECTED": "badge-rejected",
        "SENT_TO_CHECKER": "badge-sent",
    }
    label_map = {
        "AWAITING_EMPLOYEE_LIST": "Awaiting Employee List",
        "PENDING_FINANCE": "Pending Finance",
        "READY_FOR_CHECKER": "Ready for Checker",
        "REJECTED": "Rejected",
        "SENT_TO_CHECKER": "Sent to Checker",
    }
    cls = cls_map.get(status, "badge-awaiting")
    label = label_map.get(status, status)
    return f'<span class="{cls}">{label}</span>'


def risk_badge_html(risk: str) -> str:
    cls_map = {"HIGH": "risk-high", "MEDIUM": "risk-medium", "LOW": "risk-low"}
    cls = cls_map.get(risk, "risk-low")
    return f'<span class="{cls}">{risk}</span>'


def type_badge_html(t_type: str) -> str:
    if t_type == "SalaryToOTC":
        return '<span class="badge-otc">OTC</span>'
    return '<span class="badge-ma">MA</span>'


def reconcile_icon(status: str) -> str:
    return {"pass": "✅", "warn": "⚠️", "fail": "❌"}.get(status, "❓")


def check_authority_matrix(ticket: dict) -> list:
    """
    Returns list of {required_role, found_name, present} dicts.
    Uses whole-word matching to prevent "Finance Officer" falsely satisfying "Finance Manager".
    """
    results = []
    for req_role in ticket.get("required_approvals", []):
        req_words = set(req_role.lower().split())
        found = next(
            (a for a in ticket.get("email_approvals", [])
             if req_words.issubset(set(a["role"].lower().split()))),
            None
        )
        results.append({
            "required_role": req_role,
            "found_name": found["name"] if found else "—",
            "present": found is not None,
        })
    return results


# ─── PAGE: DASHBOARD ─────────────────────────────────────────────────────────────

def render_dashboard():
    st.title("🌊 Wave EMI Pipeline Dashboard")
    st.caption("Unified command center — Steps 1–3 Intake & Approval")

    # Metric cards
    col1, col2, col3, col4, col5 = st.columns(5)
    new_emails = len(MOCK_EMAILS) - len(st.session_state.parsed_emails)
    col1.metric("📥 New Emails", new_emails)
    col2.metric(
        "⏳ Pending",
        count_by_status("PENDING_FINANCE") + count_by_status("AWAITING_EMPLOYEE_LIST")
    )
    col3.metric("✅ Ready for Checker", count_by_status("READY_FOR_CHECKER"))
    col4.metric("⚠️ Mismatches", sum(1 for t in all_tickets() if t.get("has_mismatch")))
    col5.metric("🔴 High Risk", sum(1 for t in all_tickets() if t.get("risk_level") == "HIGH"))

    st.divider()

    tickets = sorted(all_tickets(), key=lambda t: t.get("created_at", ""), reverse=True)
    if not tickets:
        st.info("No tickets yet. Go to Incoming Emails to parse an email.")
        return

    st.subheader("All Tickets")
    for t in tickets:
        matrix = check_authority_matrix(t)
        track_a = "✅ Done" if t.get("prechecks_done") else "⏳ Pending"
        fin_st = t.get("finance_status", "PENDING")
        if fin_st == "APPROVED":
            track_b = "✅ Approved"
        elif fin_st == "REJECTED":
            track_b = "❌ Rejected"
        else:
            track_b = "⏳ Pending"

        with st.container():
            c1, c2, c3, c4, c5, c6, c7, c8 = st.columns([1, 2.5, 1, 2, 1.5, 1.5, 2, 1.2])
            c1.write(f"**{t['id']}**")
            c2.write(t["company"])
            c3.markdown(type_badge_html(t["type"]), unsafe_allow_html=True)
            c4.write(f"{t['amount_requested']:,.0f} MMK")
            c5.write(track_a)
            c6.write(track_b)
            c7.markdown(status_badge_html(t["status"]), unsafe_allow_html=True)
            c8.markdown(risk_badge_html(t.get("risk_level", "LOW")), unsafe_allow_html=True)

    st.divider()

    # Activity log
    st.subheader("Activity Log")
    log = st.session_state.get("activity_log", [])
    if not log:
        st.caption("No activity yet.")
    else:
        for entry in log[:5]:
            st.caption(f"[{entry['time']}] {entry['message']}")


# ─── PAGE: INCOMING EMAILS (INTAKE) ──────────────────────────────────────────────

def render_emails():
    st.title("📧 Incoming Emails")
    st.caption("Parse client emails to create disbursement tickets.")

    if st.session_state.current_role != "Intake / Maker":
        st.warning("🔒 This page is for Intake / Maker role only.")
        st.stop()

    for email in MOCK_EMAILS:
        eid = email["id"]
        parsed = eid in st.session_state.parsed_emails
        # Find existing ticket for this email
        existing_ticket = next(
            (t for t in all_tickets() if t.get("source_email_id") == eid),
            None
        )

        scenario_badge = {
            "NORMAL": "✅ Normal",
            "AMOUNT_MISMATCH": "⚠️ Amount Mismatch",
            "MISSING_APPROVAL": "🔴 Missing Finance Approval",
        }.get(email["scenario"], email["scenario"])

        with st.expander(
            f"{'✅' if parsed else '📩'} {email['subject']}  ·  {email['received']}  ·  {scenario_badge}",
            expanded=not parsed,
        ):
            c1, c2 = st.columns(2)
            c1.write(f"**From:** {email['from']}")
            c1.write(f"**Company:** {email['company']}")
            c1.write(f"**Type:** {email['type']}")
            c2.write(f"**Amount:** {email['amount_requested']:,.0f} MMK")
            c2.write(f"**Bank Slip Amount:** {email['amount_on_bank_slip']:,.0f} MMK")

            st.write(f"**Preview:** {email['body_preview']}")

            # Authority matrix indicator
            st.markdown("**Authority Matrix:**")
            matrix_cols = st.columns(3)
            matrix_cols[0].write("Required")
            matrix_cols[1].write("Email Found")
            matrix_cols[2].write("Status")
            for req_role in email["required_approvals"]:
                found = next(
                    (a for a in email["approvals"] if req_role.lower() in a["role"].lower()),
                    None
                )
                matrix_cols[0].write(req_role)
                matrix_cols[1].write(found["name"] if found else "—")
                matrix_cols[2].write("✅ Present" if found else "❌ Missing")

            if not parsed:
                if st.button(f"🔍 Parse & Create Ticket", key=f"parse_{eid}"):
                    with st.spinner("Parsing email and extracting data..."):
                        time.sleep(0.5)

                    # Check authority matrix completeness
                    matrix_complete = all(
                        any(req_role.lower() in a["role"].lower() for a in email["approvals"])
                        for req_role in email["required_approvals"]
                    )
                    amount_mismatch = email["amount_requested"] != email["amount_on_bank_slip"]

                    tid = generate_ticket_id()
                    new_ticket = {
                        "id": tid,
                        "source_email_id": eid,
                        "company": email["company"],
                        "type": email["type"],
                        "currency": email["currency"],
                        "scenario": email["scenario"],
                        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        "amount_requested": email["amount_requested"],
                        "amount_on_bank_slip": email["amount_on_bank_slip"],
                        "has_mismatch": amount_mismatch,
                        "employee_total": None,
                        "required_approvals": email["required_approvals"],
                        "email_approvals": email["approvals"],
                        "approval_matrix_complete": matrix_complete,
                        "bank_slip_filename": None,
                        "bank_slip_bytes": None,
                        "bank_slip_type": None,
                        "prechecks_done": False,
                        "prechecks_at": None,
                        "employee_data": None,
                        "total_employees": 0,
                        "invalid_msisdn_count": 0,
                        "names_cleaned_count": 0,
                        "employee_file_name": None,
                        "reconciliation": None,
                        "finance_status": "PENDING",
                        "finance_approved_by": None,
                        "finance_approved_at": None,
                        "finance_notes": None,
                        "sent_to_checker": False,
                    }
                    new_ticket["status"] = derive_status(new_ticket)
                    new_ticket["risk_level"] = compute_risk(new_ticket)
                    st.session_state.tickets[tid] = new_ticket
                    st.session_state.parsed_emails.add(eid)
                    log_activity(f"{tid} created from {email['company']} email")
                    save_state()
                    st.success(f"✅ Ticket {tid} created. Upload employee list to complete pre-checks.")
                    st.rerun()
            else:
                st.success(f"✅ Parsed → {existing_ticket['id'] if existing_ticket else 'ticket created'}")

            # Employee list + bank slip upload (only for parsed tickets)
            if parsed and existing_ticket:
                tid = existing_ticket["id"]
                st.divider()
                st.markdown("**Step 2 — Upload Employee List**")

                emp_file = st.file_uploader(
                    "Employee List (XLSX or CSV)",
                    type=["xlsx", "csv"],
                    key=f"emp_{eid}",
                )
                if emp_file is not None:
                    try:
                        if emp_file.name.endswith(".xlsx"):
                            df_raw = pd.read_excel(emp_file)
                        else:
                            df_raw = pd.read_csv(emp_file)

                        df_proc = process_employee_list(df_raw)
                        invalid_count = int((~df_proc["MSISDN_Valid"]).sum())
                        cleaned_count = int(df_proc["Name_Changed"].sum())
                        emp_total = float(df_proc["Amount"].sum())

                        # Display preview with color indication
                        st.write(
                            f"📊 **{len(df_proc)} records · {invalid_count} invalid MSISDNs · {cleaned_count} names cleaned**"
                        )

                        # Show table with invalid rows indicated
                        display_df = df_proc[[
                            "Original_Name", "Cleaned_Name", "MSISDN",
                            "Validation_Status", "Amount"
                        ]].copy()
                        st.dataframe(display_df, use_container_width=True)

                        if invalid_count > 0:
                            st.warning(f"⚠️ {invalid_count} phone number(s) failed validation. Review before submitting.")

                        # Three-way reconciliation
                        st.markdown("**💰 Amount Reconciliation:**")
                        rec_checks = reconcile_amounts(existing_ticket, df_proc)
                        for chk in rec_checks:
                            icon = reconcile_icon(chk["status"])
                            if chk["status"] == "pass":
                                st.success(f"{icon} **{chk['check']}:** {chk['detail']}")
                            elif chk["status"] == "fail":
                                st.error(f"{icon} **{chk['check']}:** {chk['detail']}")
                            else:
                                st.warning(f"{icon} **{chk['check']}:** {chk['detail']}")

                        # Bank slip upload
                        st.markdown("**Step 3 — Upload Bank Slip** *(optional)*")
                        slip_file = st.file_uploader(
                            "Bank Slip (PDF, PNG, JPEG)",
                            type=["pdf", "png", "jpg", "jpeg"],
                            key=f"slip_{eid}",
                        )
                        slip_bytes = None
                        slip_filename = None
                        slip_type = None
                        if slip_file is not None:
                            slip_bytes = slip_file.read()
                            slip_filename = slip_file.name
                            slip_type = slip_file.type
                            if slip_type in ("image/png", "image/jpeg"):
                                st.image(slip_bytes, caption="Bank Slip Preview", width=400)
                            else:
                                st.info(f"📎 PDF uploaded: {slip_filename}")

                        if st.button("💾 Save & Submit for Finance Approval", key=f"save_{eid}"):
                            emp_data_json = df_proc.to_dict(orient="records")
                            # Reuse already-computed rec_checks to avoid a duplicate call
                            reconciliation = rec_checks
                            update_ticket(tid, {
                                "prechecks_done": True,
                                "prechecks_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                                "employee_data": emp_data_json,
                                "total_employees": len(df_proc),
                                "invalid_msisdn_count": invalid_count,
                                "names_cleaned_count": cleaned_count,
                                "employee_file_name": emp_file.name,
                                "employee_total": emp_total,
                                "reconciliation": reconciliation,
                                # Bug 1 fix: use base64 so binary bytes survive JSON round-trip safely
                                "bank_slip_bytes": ("b64:" + base64.b64encode(slip_bytes).decode("ascii")) if slip_bytes else None,
                                "bank_slip_filename": slip_filename,
                                "bank_slip_type": slip_type,
                                "has_mismatch": (
                                    existing_ticket["amount_requested"] != existing_ticket["amount_on_bank_slip"]
                                    or any(c["status"] == "fail" for c in reconciliation)
                                ),
                            })
                            log_activity(f"{tid} pre-checks complete — {len(df_proc)} employees")
                            st.success(f"✅ {tid} submitted for Finance Approval.")
                            st.rerun()

                    except ValueError as e:
                        st.error(f"⚠️ {e}")
                    except Exception:
                        st.error("⚠️ Could not read file. Please upload a valid .xlsx or .csv")


# ─── PAGE: FINANCE APPROVAL ──────────────────────────────────────────────────────

def render_finance():
    st.title("💰 Finance Approval")
    st.caption("Review and approve disbursement tickets awaiting finance sign-off.")

    if st.session_state.current_role != "Finance":
        st.warning("🔒 This page is for Finance role only.")
        st.stop()

    # Bug 3 fix: only show tickets where pre-checks are done — prevents Finance seeing incomplete tickets
    pending = [t for t in all_tickets() if t["finance_status"] == "PENDING" and t.get("prechecks_done")]
    if not pending:
        st.success("✅ No tickets awaiting Finance approval.")
        return

    for ticket in pending:
        tid = ticket["id"]
        with st.container():
            st.subheader(f"{tid} · {ticket['company']} · {ticket['type']}")
            st.write(f"**Requested Amount:** {ticket['amount_requested']:,.0f} MMK")

            # Authority matrix
            st.markdown("**🔐 Authority Matrix:**")
            matrix = check_authority_matrix(ticket)
            m_cols = st.columns(3)
            m_cols[0].write("Required")
            m_cols[1].write("Email Found")
            m_cols[2].write("Status")
            for row in matrix:
                m_cols[0].write(row["required_role"])
                m_cols[1].write(row["found_name"])
                m_cols[2].write("✅ Present" if row["present"] else "❌ Missing")

            # Pre-check results
            st.markdown("**📊 Pre-check Results:**")
            st.write(
                f"{ticket.get('total_employees', 0)} employees · "
                f"{ticket.get('invalid_msisdn_count', 0)} invalid MSISDNs · "
                f"{ticket.get('names_cleaned_count', 0)} names cleaned"
            )

            # Amount reconciliation
            if ticket.get("reconciliation"):
                st.markdown("**💰 Amount Reconciliation:**")
                for chk in ticket["reconciliation"]:
                    icon = reconcile_icon(chk["status"])
                    if chk["status"] == "pass":
                        st.success(f"{icon} **{chk['check']}:** {chk['detail']}")
                    elif chk["status"] == "fail":
                        st.error(f"{icon} **{chk['check']}:** {chk['detail']}")
                    else:
                        st.warning(f"{icon} **{chk['check']}:** {chk['detail']}")

            # Bank slip display
            slip_bytes = ticket.get("bank_slip_bytes")
            if slip_bytes:
                st.markdown("**📎 Bank Slip:**")
                slip_type = ticket.get("bank_slip_type", "")
                if slip_type in ("image/png", "image/jpeg"):
                    try:
                        # Bug 1 fix: decode from base64 (stored as "b64:<data>")
                        if isinstance(slip_bytes, str) and slip_bytes.startswith("b64:"):
                            img_bytes = base64.b64decode(slip_bytes[4:])
                        elif isinstance(slip_bytes, str):
                            img_bytes = slip_bytes.encode("latin-1")  # legacy fallback
                        else:
                            img_bytes = slip_bytes
                        st.image(img_bytes, caption="Bank Slip", width=500)
                    except Exception:
                        st.info(f"📎 Bank slip: {ticket.get('bank_slip_filename', 'uploaded')}")
                else:
                    st.info(f"📎 Bank slip uploaded: {ticket.get('bank_slip_filename', 'file')} (PDF — preview not available)")
            elif ticket.get("bank_slip_filename"):
                st.info(f"📎 Bank slip on record: {ticket['bank_slip_filename']}")

            # Conditional warnings BEFORE approve button
            if ticket.get("has_mismatch"):
                st.warning(
                    f"⚠️ **Amount Mismatch:** Email {ticket['amount_requested']:,.0f} MMK vs "
                    f"Bank Slip {ticket.get('amount_on_bank_slip', 0):,.0f} MMK"
                )
            if ticket.get("scenario") == "MISSING_APPROVAL":
                st.error("🔴 **Missing Finance Approval in original email.** Finance Manager sign-off was not found.")
            if not ticket.get("approval_matrix_complete"):
                missing = [
                    row["required_role"]
                    for row in check_authority_matrix(ticket)
                    if not row["present"]
                ]
                st.warning(f"⚠️ **Missing approvals:** {', '.join(missing)}")

            # Approve / Reject form
            col_approve, col_reject = st.columns(2)
            with col_approve:
                approver_name = st.text_input("Approved by (your name):", key=f"appname_{tid}")
                notes = st.text_input("Notes (optional):", key=f"notes_{tid}")
                if st.button("✅ Approve", key=f"approve_{tid}", type="primary"):
                    if not approver_name.strip():
                        st.error("⚠️ Please enter your name before approving.")
                    else:
                        update_ticket(tid, {
                            "finance_status": "APPROVED",
                            "finance_approved_by": approver_name.strip(),
                            "finance_approved_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                            "finance_notes": notes.strip() or None,
                        })
                        log_activity(f"{tid} approved by Finance ({approver_name.strip()})")
                        st.success(f"✅ {tid} approved. Now ready for E-Money team.")
                        st.rerun()

            with col_reject:
                st.write("")
                st.write("")
                if st.button("❌ Reject", key=f"reject_{tid}"):
                    update_ticket(tid, {
                        "finance_status": "REJECTED",
                        "finance_approved_by": None,
                        "finance_approved_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        "finance_notes": "Rejected by Finance.",
                    })
                    log_activity(f"{tid} rejected by Finance")
                    st.warning(f"❌ {tid} rejected.")
                    st.rerun()

            st.divider()


# ─── PAGE: E-MONEY REVIEW ─────────────────────────────────────────────────────────

def render_emoney():
    st.title("🔁 E-Money Review")
    st.caption("Tickets approved by Finance and ready for the E-Money checker team.")

    if st.session_state.current_role != "E-Money":
        st.warning("🔒 This page is for E-Money role only.")
        st.stop()

    ready = [t for t in all_tickets() if t["status"] == "READY_FOR_CHECKER"]
    sent = [t for t in all_tickets() if t["status"] == "SENT_TO_CHECKER"]

    if not ready and not sent:
        st.info("No tickets ready for E-Money yet.")
        return

    if ready:
        st.subheader("Ready for Checker")
        for ticket in ready:
            tid = ticket["id"]
            with st.container():
                st.markdown(
                    f"**{tid} · {ticket['company']}** · "
                    f"{type_badge_html(ticket['type'])} · "
                    f"{ticket['amount_requested']:,.0f} MMK",
                    unsafe_allow_html=True,
                )

                col_a, col_b = st.columns(2)
                col_a.write(
                    f"Pre-checks: ✅ Done ({ticket.get('total_employees', 0)} employees, "
                    f"{ticket.get('invalid_msisdn_count', 0)} invalid)"
                )
                col_b.write(
                    f"Finance: ✅ Approved by {ticket.get('finance_approved_by', '—')}"
                )
                st.write(f"Risk: {risk_badge_html(ticket.get('risk_level', 'LOW'))}", unsafe_allow_html=True)

                # Amount summary
                rec = ticket.get("reconciliation")
                if rec:
                    all_pass = all(c["status"] == "pass" for c in rec)
                    if all_pass:
                        st.success(f"💰 All amounts match: {ticket['amount_requested']:,.0f} MMK ✅")
                    else:
                        for chk in rec:
                            if chk["status"] != "pass":
                                st.warning(f"⚠️ {chk['check']}: {chk['detail']}")

                # Expandable employee list
                if ticket.get("employee_data"):
                    with st.expander("Show Cleaned Employee List"):
                        df_view = pd.DataFrame(ticket["employee_data"])
                        cols_to_show = [c for c in ["Cleaned_Name", "MSISDN", "Amount", "Validation_Status"] if c in df_view.columns]
                        st.dataframe(df_view[cols_to_show], use_container_width=True)

                btn_col1, btn_col2, btn_col3 = st.columns(3)

                with btn_col1:
                    st.link_button("🔗 Open in Checker Dashboard", CHECKER_DASHBOARD_URL)

                with btn_col2:
                    export_data = {k: v for k, v in ticket.items() if k != "bank_slip_bytes"}
                    st.download_button(
                        "📥 Export Ticket Data (JSON)",
                        data=json.dumps(export_data, indent=2, default=str),
                        file_name=f"{tid}_export.json",
                        mime="application/json",
                        key=f"export_{tid}",
                    )

                with btn_col3:
                    if st.button("✉️ Mark as Sent to Checker", key=f"send_{tid}"):
                        update_ticket(tid, {"sent_to_checker": True})
                        log_activity(f"{tid} marked as sent to E-Money checker")
                        st.success(f"✅ {tid} marked as Sent to Checker.")
                        st.rerun()

                st.divider()

    if sent:
        st.subheader("Already Sent")
        for ticket in sent:
            st.write(f"✅ **{ticket['id']}** · {ticket['company']} · Sent to checker")


# ─── SIDEBAR ─────────────────────────────────────────────────────────────────────

def render_sidebar():
    with st.sidebar:
        st.markdown("## 🌊 Wave EMI Dashboard")
        st.divider()

        st.markdown("**👤 Role**")
        selected_role = st.selectbox(
            "Select your role:",
            ROLES,
            index=ROLES.index(st.session_state.current_role),
            label_visibility="collapsed",
        )
        if selected_role != st.session_state.current_role:
            st.session_state.current_role = selected_role
            st.rerun()

        st.divider()
        st.markdown(
            """
⚠️ **DEMO MODE**

Role access uses session state, not real authentication.

Production requires: JWT/OAuth, encrypted sessions, server-side role enforcement, and audit logging.

**Do not process real customer data in this version.**
""",
            help="This is a prototype for demonstration purposes only.",
        )

        st.divider()
        if st.button("🔄 Reset Demo"):
            try:
                if os.path.exists(STATE_FILE):
                    os.remove(STATE_FILE)
            except Exception:
                pass
            for key in ["tickets", "activity_log", "parsed_emails", "current_role"]:
                if key in st.session_state:
                    del st.session_state[key]
            st.rerun()

        st.divider()
        st.markdown("**Navigation**")
        page = st.radio(
            "Go to:",
            ["Dashboard", "Incoming Emails", "Finance Approval", "E-Money Review"],
            label_visibility="collapsed",
        )
        return page


# ─── MAIN ────────────────────────────────────────────────────────────────────────

def main():
    init_state()
    page = render_sidebar()

    if page == "Dashboard":
        render_dashboard()
    elif page == "Incoming Emails":
        render_emails()
    elif page == "Finance Approval":
        render_finance()
    elif page == "E-Money Review":
        render_emoney()


if __name__ == "__main__":
    main()
