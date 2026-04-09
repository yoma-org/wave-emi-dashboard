# Power Automate vs n8n — Analysis for EMI Pipeline

**Date:** April 9, 2026
**Context:** Minh suggested evaluating Power Automate (Microsoft Power Platform) as alternative to n8n, given Wave Money's Microsoft ecosystem (Outlook, SharePoint, Teams).

---

## Executive Summary

| Criteria | n8n | Power Automate |
|----------|-----|---------------|
| External API calls (Groq, Gemini) | Native (HTTP Request node) | Premium connector required ($15/user/mo) |
| Custom JavaScript code | Full support (Code nodes) | **NOT SUPPORTED** in cloud flows |
| Outlook integration | Via OAuth2 or IMAP | Native, zero-setup |
| SharePoint integration | Via HTTP (manual) | Native connector |
| State persistence (rate limiting, circuit breaker) | `staticData` built-in | No equivalent — needs external storage |
| Binary/base64 handling | Full buffer API | Limited expression functions |
| JSON export + git | Single JSON file | Solution-based, clunky |
| Cost | $20/mo (Cloud Starter) | $15/user/mo (Premium required) |
| Migration effort from current n8n | N/A | **3-5 days minimum, likely a week+** |

**Recommendation: Stay on n8n for the AI pipeline.** The lack of inline code execution is fatal for our workflow design (3 heavy Code nodes, 200+ lines JS each). Consider Power Automate for future Microsoft-integration tasks (SharePoint reporting, Teams notifications, approval routing).

---

## 1. Can Power Automate Replace Our n8n Pipeline?

### What Works
- Outlook email trigger — native, simpler than n8n's OAuth setup
- Conditional routing (if/else) — Condition and Switch actions
- HTTP calls to external APIs — via premium HTTP connector
- JSON export/import — possible but complex (Solution-based)
- Teams/SharePoint integration — native, excellent

### What Doesn't Work (Dealbreakers)

**No inline JavaScript code.** Our pipeline has 3 Code nodes (~450+ lines total):
- `Prepare for AI v3` (~120 lines) — email body extraction, attachment base64, rate limiting
- `Vision Process` (~100 lines) — dual-path Groq/Gemini, circuit breaker
- `Employee List Extract` (~80 lines) — dual-path OCR, JSON parsing
- `AI Parse & Validate v3` (~150 lines) — authority matrix, cross-validation, dashboard URL

In Power Automate, each Code node would become either:
- 20-50 individual Compose/Expression actions (verbose, hard to debug)
- OR external Azure Functions (defeats the managed platform benefit)

**No state persistence.** `$getWorkflowStaticData('global')` in n8n persists rate limiting counters and circuit breaker state across executions. Power Automate has no equivalent — would need SharePoint/Dataverse as external storage.

**Expression limits.** 8,192 character limit per expression. Our JSON construction for Groq/Gemini API calls exceeds this easily.

---

## 2. Pricing Comparison

| Plan | Cost | Includes |
|------|------|---------|
| **n8n Cloud Starter** | $20/mo | 2,500 executions, unlimited workflows |
| **n8n Cloud Pro** | $50/mo | 10,000 executions |
| **n8n Self-hosted** | $0 (+ VM cost ~$20-40/mo) | Unlimited everything |
| **Power Automate Premium** | $15/user/mo | Premium connectors, HTTP action, 40k actions/day |
| **Power Automate Process** | $150/flow/mo | Higher limits, flow-centric |

For our single pipeline, n8n is cheaper and more capable.

---

## 3. Where Power Automate Makes Sense (Future Phases)

| Phase | Task | Why Power Automate Wins |
|-------|------|----------------------|
| Phase 6: Reporting | Update SharePoint, poll Liferay | Native SharePoint connector |
| Approval workflows | Finance approval routing | Built-in Approvals + Teams integration |
| File routing | Documents between SharePoint/OneDrive/email | Native connectors |
| Teams notifications | Alert ops team | Adaptive cards, channel posting |

**Hybrid approach:** n8n for AI-heavy intake (Steps 1-2), Power Automate for Microsoft-ecosystem integration (Steps 6+). They communicate via webhooks.

---

## 4. Migration Effort Assessment

| n8n Node | Power Automate Equivalent | Difficulty |
|----------|--------------------------|------------|
| Webhook Trigger | HTTP request trigger (premium) | Easy |
| Gmail/Outlook Trigger | Outlook "When email arrives" (standard) | Easy — simpler |
| Prepare for AI (Code, 120 lines) | 20-30 actions OR Azure Function | **Hard** |
| Groq AI Extract (HTTP) | HTTP action (premium) | Medium |
| Vision Process (Code, 100 lines) | Azure Function needed | **Hard** |
| Employee Extract (Code, 80 lines) | Azure Function needed | **Hard** |
| Parse & Validate (Code, 150 lines) | Azure Function needed | **Very Hard** |
| Route by Source (If) | Condition action | Easy |
| Respond to Webhook | Response action | Easy |
| Email Notification | Send email / Teams message | Easy |

**Realistic path:** You'd end up with Power Automate + Azure Functions + Dashboard = more moving parts than n8n alone.

---

## 5. n8n Trial Situation

- Current: n8n Cloud free trial, **8 days left** (expires ~April 17)
- Go-live: Wednesday April 15 — 2 days of buffer
- Executions: 114/1,000 in April

**Options:**
1. New n8n Cloud account (Minh's suggestion) — another 14 days free
2. n8n Cloud Starter — $20/month
3. Self-hosted n8n on AWS — free, unlimited (part of infra migration plan)

**Recommended:** Option 1 (new account) for immediate needs, then Option 3 (self-hosted) when AWS infra is ready.

---

## Sources
- [Power Automate License Types](https://learn.microsoft.com/en-us/power-platform/admin/power-automate-licensing/types)
- [Power Automate Limits and Config](https://learn.microsoft.com/en-us/power-automate/limits-and-config)
- [Power Automate vs n8n - Sibasi](https://blog.sibasi.com/power-automate-vs-n8n-practical-perspective-automation-professional)
- [n8n vs Power Automate - Lowcode Agency](https://www.lowcode.agency/blog/n8n-vs-power-automate)
- [AI Builder 2025 Release Wave 1](https://learn.microsoft.com/en-us/power-platform/release-plan/2025wave1/ai-builder/)
