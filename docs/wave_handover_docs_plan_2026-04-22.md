---
name: wave_handover_docs_plan_2026-04-22
aliases: ["Wave Handover Docs Plan", "Apr 22 Internal Sync Handover Plan", "Vinh Assignment Handover Package"]
description: Synthesis of the Apr 22 Yoma internal sync (Vinh + Tin + DK + Hao + Khoa) plus the plan for the Wave-team handover documentation package Vinh assigned to DK (co-authored with Huy). Covers the infra scope narrowing, the "chicken-and-egg" solution for the Outlook/Azure AD blocker, and a concrete layout for the runbook Wave's team will execute against.
type: project
topics: [handover, wave-emi, aws, n8n, runbook, documentation, vinh-assignment, kan-47]
status: active
created: 2026-04-22
last_reviewed: 2026-04-22
---

# Wave Handover Docs — Plan & Meeting Synthesis (Apr 22 2026)

## TL;DR

- **Vinh assigned DK** (co-author with Huy) to produce a **step-by-step runbook** the Wave team will follow to stand up eMoney on their own AWS infrastructure. Deliverable: document → review with Huy → send to Vinh.
- **Scope split finalized on the call**: financial-services apps (eMoney, Star City + payment gateway, Tushy Tube, etc.) → Wave AWS. Non-financial simple apps → stay on current Zeyalabs stack (Vercel + small AWS). Cost-driver: Tin confirmed AWS production is ~5–6× more expensive than Vercel for low-traffic non-financial apps, so moving everything to AWS was never the plan.
- **DK's key insight**: Don't wait for the Wave-side Outlook/Azure AD blocker (Ryan) to resolve. Ship the handover doc NOW using our **already-completed-once local setup as the A→Z reference**. Wave follows that runbook; the Outlook credential step gets solved on their side once Ryan unblocks.
- **Vinh's tactic**: give them the `git clone → docker compose → docker pull` one-shot. The Wave team "drops our app in" to their existing server.
- **Stop deploying eMoney to our side Huy-built AWS demo**: Vinh said "dừng hết đi, đừng làm nữa" — we will host on Wave's infra. But DO keep the Huy/DK local AWS scaffold running long enough to validate the runbook ourselves before shipping it to Wave.

Source: [[2026-04-22_Yoma_Internal_Sync_Up]] in `_meetings/`.

---

## Section 1 — The assignment (verbatim from Vinh)

From the transcript, ~10:44–11:14 mark:

> **Vinh** (10:44): *"Khánh hôm nay em làm cái cái vụ em cho anh cái cái cái cái lindo của mình đối với huy đi."*
> (Khanh, today you do this thing — give me the setup guide our side works on with Huy.)

> **DK** (10:55): *"Vậy em nói chuyện bởi vì à rồi dẫn em setup như thế nào?"*
> (OK, I'll talk to [Huy] about how he's setting up.)

> **Vinh** (11:08): *"Em cứ làm cái document đi rồi em review với huy rồi khi nào mà 2 đứa futurelight hết rồi thì gửi cho anh."*
> (**Just make the doc, review with Huy, and when you two have finalized everything, send it to me.**)

> **DK** (11:15): *"OK views."*

**Accepted by DK on the call.** Owner: DK. Co-author: Huy. Reviewer: Vinh.

---

## Section 2 — Context: why this doc needs to exist (infra scope narrowing)

Vinh opened the meeting (~02:23–03:06) re-explaining what Rita had landed that morning on the Zeyalabs standup:

> *"Cái app mới đó nha là những cái app như là e money, Tushy Tube, Star City, nói chung là những cái app mà có liên quan tới Financial services đó và có payment gate quay thì mình sẽ host ở bên phía cái server AWS của Yamaha."*
> (New apps like eMoney, Tushy Tube, Star City — generally any app involving Financial services and payment gateways — we'll host on Yoma's AWS side.)

> *"Còn cái server AWS hiện tại của mình á thì mình chỉ host những cái app nào mà nó [không] nên nên Financial services."*
> (Our current AWS server side — we'll only host apps that are NOT financial-services.)

### Tin's cost reality check (~03:38–05:13)

Tin (Trustify DBA, cost expert on the call) gave concrete numbers:

- **AWS baseline**: ~$300/month for a minimal setup, scales up with each app
- **Per-app AWS cost**: ~$100/month per additional app
- **Vercel equivalent**: ~$10/month per app (**5–6× cheaper** for low-traffic apps)
- **Supabase migration concern**: *"mình đang dùng supabase á nếu mà mua qua direct hết á thì nó nửa vời lắm"* — mixing direct AWS with Supabase is half-baked; either all-in or stay put

**Decision**: financial-services apps go to Wave AWS (because security + they already have the infra). Non-financial small apps stay on Vercel+Supabase+small-AWS. Current cost we reported to Rita (~$300/mo) is already the floor — "đó là cơ bản nhất rồi, không có gì để lừa đâu" (that's already the baseline, nothing to trim).

### Vinh's instruction on shutting down our eMoney AWS scaffold

~06:34–07:13:

> **Vinh**: *"Còn hiện tại thì cái imoney á Khánh — mấy cái mà em đang set up ở trên cái AITOE [AWS] với Huy á — dừng hết đi. Đừng làm nữa."*
> (And currently the eMoney stuff Khánh — what you're setting up on AWS with Huy — stop it all. Don't do it anymore.)

> **Vinh**: *"Tại vì mình sẽ host cái imoney đó bên phía AWS infra của thằng Weibo [Wave] đi luôn. Chứ mình không có host bên này nữa."*
> (Because we'll host eMoney on Wave's AWS. Not on our side anymore.)

### DK's pushback (honored by Vinh)

~07:00–08:07:

> **DK**: *"Cái đấy thì em biết rồi, nhưng mà ý của anh Minh á là mình vẫn phải test lên cái server của mình trước để khi mà mình làm ở TMA ờ Weinmannia, mình còn biết là nó có thành công hay không là mình làm nó cũng dễ hơn đấy."*
> (I know, but Minh's point is we should still test on our server first so that when we do it on Wave's side, we know if it'll work — it makes it easier to help them.)

> **DK**: *"kể cả khi mà bên kia họ đồng ý để mà [host], thì mình họ không phải có hướng dẫn cho mình, nên là mình cũng phải ờ trên cái hệ thống của mình, tên của mình là đã đã và chạy được nữa chứ. Và với cả cái khó nhất là cái phần à setup and phúc cát với cả outlook ở bên kia á nó là cái block ở hiện tại."*
> (Even if they agree to host, they don't have a guide for us — so we need our own system already running on our side. **And the hardest blocker right now is the Outlook/Azure AD setup on their side.**)

Vinh understood and accepted: keep the local scaffold alive long enough to validate the doc, but don't build new features on it. The Huy AWS demo ($100 credit) stays as a **proof artifact + doc validation target**, not a production destination.

---

## Section 3 — DK's "chicken-and-egg" solution (the key insight)

~09:42–10:31:

> **DK**: *"Thực ra cái đấy nói chung là nó không có quái gì phức tạp ở 80 phần đấy, bởi vì bên kia họ có infra rồi. Và anh nghĩ rằng là cái câu chuyện thì là con gà quả trứng thôi — thì là mình sẽ giải quyết bằng cách là đưa cho họ cái setup cụ thể bằng việc là như nào ta setup từ A đến Z của cái app trước đó. Còn cái việc mà con picture của cái Collins [Outlook?], sao thì mình sẽ giải quyết sau, bởi vì đằng nào trước đây cũng chưa làm được."*

**Paraphrased**:
> "80% of this isn't hard because Wave already has infra. It's a chicken-and-egg — we solve it by **giving them the exact A→Z setup of how we built our app**. The Outlook piece we solve separately later, because we were blocked on that anyway."

> **Vinh**: *"Hiểu. Để mình đưa cho họ cái đó cũng được. Tại vì bên kia nó setup sẵn hết rồi — server AWS nó đã dựng lên, đang chạy luôn rồi — thì mình nhét cái app của mình vô thôi."*
> (Understood. Let's give them that. Their AWS is already set up and running; we just plug our app in.)

> **DK**: *"Thì nó cũng dễ mà, tại vì có cái [git] repo đấy rồi, ném cho họ xong rồi có cái doc này — họ [pull]/ignis một phát là xong."*
> (Easy — git repo is there, throw it to them, with this doc they pull one-shot and they're done.)

### Why this matters

This unblocks the Friday Wave + Alex (CIO) meeting without needing Ryan to resolve Azure AD first. The Outlook credential step becomes a **line item in the runbook Wave fills in on their side** — not a dependency that blocks the handoff.

---

## Section 4 — What the Wave team actually needs (doc package scope)

Based on Vinh's framing (~11:53–12:13) — *"setup connection, allow setup Supabase/Postgres, bake claude (Bedrock) in, low of use [end-to-end]"* — and DK's A→Z principle, the deliverable is a **7-chapter runbook** covering every moving piece:

### Chapter 1 — Overview & prerequisites
- Architecture diagram (already exists at [wave_emi_architecture_data_flow.md](wave_emi_architecture_data_flow.md))
- What Wave provides: AWS account, Outlook tenant (emoney@zeyalabs.ai-equivalent), Bedrock access
- What we provide: git repo + schema SQL + workflow JSON + this runbook
- Known stack choices (locked per Apr 22 pivot): Postgres 13+ on RDS, n8n self-hosted or Cloud, AWS Bedrock + Claude Opus 4.7 for extraction, S3 for attachments

### Chapter 2 — AWS infrastructure bring-up
- RDS Postgres instance sizing (we used db.t3.small-equivalent in testing)
- S3 bucket for attachments (replaces Supabase Storage)
- IAM roles: app service account, Bedrock invoke permission
- Secrets Manager entries (webhook secret, outlook credentials, bedrock key if using IAM)
- VPC / security group notes

### Chapter 3 — Database schema deployment
- Single-file DDL: [wave-emi-dashboard/sql/complete/emi_dashboard_schema_aws.sql](../sql/complete/emi_dashboard_schema_aws.sql) (v1.1, pglite-validated, 12 checks green)
- Run top-to-bottom on fresh RDS
- Uncomment `-- VERIFICATION` block at bottom, run 7 checks, paste output
- Schema artifact already in Huy's hands ([[project_huy_aws_migration_kickoff_apr21]])

### Chapter 4 — Application code deployment
- Clone: `github.com/yoma-org/wave-emi-dashboard` (kan47-v13.3 + main branches)
- Dashboard: static `index.html` + `api/` (Vercel-style serverless → Lambda or Express)
  - [api/webhook.js](../api/webhook.js) — intake endpoint (called by n8n worker on success)
  - [api/extract-employees.js](../api/extract-employees.js) — client-side employee list parser helper
- Env vars required:
  - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` → rename to `DB_URL` / `DB_KEY` for AWS
  - `WEBHOOK_SECRET` (shared with n8n)
  - `BEDROCK_REGION` / `BEDROCK_MODEL_ID` (Claude Opus 4.7 via Bedrock)
  - `S3_BUCKET_NAME`
- Deploy path: CloudFront + S3 for static, Lambda/API Gateway or Amplify for `api/*`

### Chapter 5 — n8n pipeline setup
- Pipeline JSON: [EMI Worker v2 (KAN-46 v13.2).json](../../EMI%20Worker%20v2%20(KAN-46%20v13.2)%20—%20Webhook%20+%20Self-Chain%20+%20Gemini%20Retry%20+%20Hardened%20Parse%20+%20Notify%20on%20Failure.json) (v13.3 equivalent will be exported from current prod before handoff)
- Import steps (via n8n UI or CLI)
- Required credentials to attach:
  - **Outlook (Microsoft)** — the Azure AD blocker; see Chapter 6
  - **Gemini API** (to be replaced — see Chapter 7)
  - **Supabase/Postgres** — connection string for claim/complete/fail calls
- Webhook URL wiring (worker exposes `/webhook/v13-3` → dashboard api/webhook.js calls this on queue inserts)
- Code node contents: v13.3 prepare-for-AI, gemini-extract, parse-validate — already in [pipelines/_worker_v13_3_*.js](../pipelines/)

### Chapter 6 — Outlook / Microsoft Graph credential (the "chicken-and-egg" piece)
- **Blocker owner**: Wave IT admin (Ryan, per DK's prior notes — see [[project_graph_api_blocked_by_tenant_admin]])
- What's needed: Azure AD app registration with Mail.Read + Mail.ReadWrite scopes on the mailbox that will monitor corporate email
- OAuth2 flow in n8n credential manager
- Tenant-ID, Client-ID, Client-Secret — all live on Wave's side
- **This is a runbook LINE ITEM, not a blocker** — document what we need, let Ryan fulfill, plug the credential into n8n

### Chapter 7 — LLM migration: Gemini → Claude Opus 4.7 via Bedrock
- Why the swap: Vinh's Apr 22 directive (chat screenshot, [[strategic_pivot_2026-04-22]])
- Endpoint: Bedrock `anthropic.claude-opus-4-7-v1` in Wave's AWS region
- Prompt contract stays identical (see [pipelines/_worker_v13_3_gemini_extract.js](../pipelines/_worker_v13_3_gemini_extract.js) prompts)
- IAM: `bedrock:InvokeModel` on the specific model ARN
- Cost sanity note: Claude Opus is ~2–3× the cost of Gemini 3 Flash Preview per token — Tracy's pending research ([[project_v13_4_backlog_apr22]] #7) was going to quantify this; Vinh decided to go Opus anyway. **Flag the cost delta in the runbook.**

### Chapter 8 — Smoke test + handoff sign-off
- 3 canonical tests (borrowed from [wave_emi_testing_guide_outlook_pipeline.md](wave_emi_testing_guide_outlook_pipeline.md)):
  1. Happy-path: 1 PDF attachment → TKT-NNN lands with extracted fields
  2. Multi-attachment: 4 attachments (PDF + XLSX + PNG + JPEG) → 4 rows in `ticket_attachments` + tabbed dashboard view (validates KAN-47)
  3. Rejection path: empty-body email → rejection email sent back to sender
- Sign-off checklist: Wave ops team confirms each step

---

## Section 5 — Inventory: what we already have vs what's missing

### Already written (reuse wholesale)

| Artifact | Path | Status |
|---|---|---|
| Architecture diagram | [docs/wave_emi_architecture_data_flow.md](wave_emi_architecture_data_flow.md) | ✅ current |
| AWS-portable schema SQL | [sql/complete/emi_dashboard_schema_aws.sql](../sql/complete/emi_dashboard_schema_aws.sql) | ✅ v1.1, pglite-validated, in Huy's hands |
| App walkthrough | [docs/wave_emi_app_walkthrough.md](wave_emi_app_walkthrough.md) | ✅ covers Finance/Intake/EMoney pages |
| Testing guide (pipeline) | [docs/wave_emi_testing_guide_outlook_pipeline.md](wave_emi_testing_guide_outlook_pipeline.md) | ✅ canonical 3-test set |
| User handover guide (Wave Finance) | [docs/wave_emi_user_handover_guide.md](wave_emi_user_handover_guide.md) + v1.0 PDF + HTML | ✅ for end users, not devops |
| Onboarding guide | [docs/wave_emi_onboarding_guide.md](wave_emi_onboarding_guide.md) | ✅ covers dashboard sign-in |
| Worker JS (v13.3) | [pipelines/_worker_v13_3_*.js](../pipelines/) | ✅ ship to Wave as-is |
| webhook.js intake | [api/webhook.js](../api/webhook.js) | ✅ per-attachment persistence (KAN-47 Layer B) |
| KAN-46 architecture decision | [docs/kan46_final_architecture_decision.md](kan46_final_architecture_decision.md) | ✅ explains durable queue choice |
| Infrastructure recommendation | [docs/wave_emi_infrastructure_recommendation.md](wave_emi_infrastructure_recommendation.md) | ⚠️ pre-pivot; needs Wave-AWS lens overlay |

### Missing (DK + Huy to write)

| Chapter | Who | Effort |
|---|---|---|
| 1. Overview + prereqs (refactor existing infra-rec doc) | DK | ~1h |
| 2. AWS infra bring-up (Huy's domain — RDS, S3, IAM, Secrets Manager) | **Huy** | ~2h |
| 3. Schema deploy runbook (thin wrapper on existing SQL + Huy's readme) | DK | ~30m |
| 4. App code deployment (env var mapping, Vercel→AWS notes) | DK | ~1h |
| 5. n8n pipeline setup (import steps + credential checklist) | DK | ~1.5h |
| 6. Outlook / Azure AD credential spec (what Ryan needs to provision) | DK | ~30m |
| 7. Gemini → Bedrock migration delta | DK | ~1h (prompt stays, endpoint + auth swap) |
| 8. Smoke test + sign-off checklist (wrapper on existing test guide) | DK | ~30m |
| **Top-level index / table of contents** | DK | ~20m |

**Total effort**: ~8 hours of DK time + ~2 hours Huy time + review loop. Realistic 2-day turnaround if Huy is parallel-available.

### What the runbook is NOT

- Not a user manual (that's the existing `wave_emi_user_handover_guide.md`)
- Not an architecture defense (that's the ADR set in `decisions/`)
- Not a feature spec (Wave's devs reading this already know what the app does)

It's a **DevOps runbook**: assume the reader is an AWS-comfortable infra engineer who wants to stand up a working system in under a day without reverse-engineering our code.

---

## Section 6 — Collaboration pattern with Huy

Vinh's instruction: DK drafts → Huy reviews → both finalize → send to Vinh. Per transcript (~11:08):

> *"Em cứ làm cái document đi rồi em review với huy rồi khi nào mà 2 đứa futurelight hết rồi thì gửi cho anh."*

### Division of labor (DK proposal, subject to Huy's review)

- **DK owns**: App layer (code, env vars, n8n, schema runbook wrapper, tests) — ~6.5h
- **Huy owns**: AWS infra layer (RDS, S3, IAM, Secrets Manager, networking) — ~2h + review on DK's chapters
- **Shared**: Chapter 1 overview, final polish, Bedrock region/model decisions

### Communication channel

Huy is on the Yoma Bank – Infrastructure Teams channel per [[project_strategic_pivot_2026-04-22]] chat screenshots. DK pings him there with:
1. This plan (for alignment on chapter ownership)
2. Draft skeleton once Chapter 1 + 3 + 4 are sketched
3. Review loop after first pass

---

## Section 7 — Action items

### Today (Apr 22 PM — remaining ~3 hours to 5:30 PM)

| # | Action | Owner | Time |
|---|---|---|---|
| 1 | Ping Huy on Teams — align on chapter ownership, share this plan | DK | 10 min |
| 2 | Export current v13.3 n8n workflow JSON from `dknguyen01trustify.app.n8n.cloud` | DK | 10 min |
| 3 | Draft Chapter 1 (overview + prereqs) — thin, just the frame | DK | 45 min |
| 4 | Draft Chapter 5 (n8n pipeline) — most complex + highest risk of ambiguity | DK | 1 hour |
| 5 | Draft Chapter 8 (smoke test) — reuses existing test guide, lightest lift | DK | 30 min |

### Tomorrow (Apr 23)

| # | Action | Owner |
|---|---|---|
| 6 | Draft Chapters 3, 4, 6, 7 | DK |
| 7 | Huy drafts Chapter 2 (AWS infra) | Huy |
| 8 | Cross-review | DK + Huy |
| 9 | First pass complete → send to Vinh | DK |

### Friday (Apr 24, before Wave + Alex CIO call)

| # | Action | Owner |
|---|---|---|
| 10 | Vinh review feedback integrated | DK |
| 11 | Doc ready as handoff artifact for the Wave meeting | DK |

---

## Section 8 — Open questions to raise with Vinh + Huy

1. **Output format**: single markdown file? PDF? Notion/Confluence export? — Vinh didn't specify. Propose markdown (`wave_handover_runbook_v1_0.md`) + PDF export for easy sharing.
2. **Bedrock region**: does Wave's AWS account have Bedrock enabled in the Singapore region? If not, which region?
3. **n8n hosting choice on Wave's side**: self-hosted n8n on EC2 vs n8n Cloud (paid) — affects Chapter 5 heavily. Ask Huy.
4. **Outlook tenant**: does Wave use the same Microsoft 365 tenant as Zeyalabs or a separate one? Affects Chapter 6 (Ryan's scope).
5. **Shutdown timeline for our current stack**: when does the Zeyalabs Supabase + Vercel + n8n Cloud demo get retired? Affects backup + data-export planning.
6. **Secrets rotation policy**: do we hand over the *current* webhook secret or regenerate on their side? Security-cleanest is regenerate.

---

## Section 9 — Side observations from the meeting

Not related to DK's assignment but captured for completeness (all ~12:37–end):

- **Elevator app (Khoa)**: team name "anh em commercial" rename fix in progress, new run coming, still waiting Win/M. Perry feedback. Not DK's lane.
- **C2C/C2B passport-scan app (Hao)**: `omia` repeater rework done, `MB` (myanmar business?) in progress, expecting test link tomorrow. Thai + work-permit ID similar enough to Myanmar ID that little new training needed. Selfie-with-liveness is **browser-limited** (can't call native MediaType YVX for real-time feedback) — Đông (external dev) concluded web selfie-with-interactivity is "not worth the effort" for pure web. Vinh's workaround: *"I cornered [them] — if you want this, you fund a mobile dev because our current resource has no mobile engineer."* Rita/client pushback expected.
- **Voice assistant feature (new ask from Queen)**: Thailand/Myanmar users are low-literacy / non-technical → 35% drop-off at ID scan and selfie steps. Client wants voice-over guiding users step-by-step + error-correction voiceover. DK on the call: *"Em thấy cái ý tưởng đấy hơi bay bổng"* (this idea is too ambitious) — "need lots of research time, can't answer in one go." Vinh agreed, said he'd push back to Queen + get team's break-down first. **Flag: this is a scope-push vector — watch for it.**
- **Tools/Tushy Tube**: Tin's comment *"không có nói là bên mình có sẵn nha, dinh"* — don't over-promise to client that we already have this capability. We have "experience doing similar apps" only.

These are not DK's assignments; included here so the synthesis is complete and future-you knows what else was on the table.

---

## Provenance

- **Meeting**: ~30-min Yoma Internal Sync Up, Apr 22 2026 ~13:00–13:30 VN time.
- **Attendees**: Vinh Nguyen Quang (chair), Tin Dang Huynh Trung, Khanh Nguyen Duy (DK), Hao Tran Thien, Khoa Nguyen Dang. Huy Nguyen Duc absent (on Christianix side meeting per Vinh).
- **Transcript**: [[2026-04-22_Yoma_Internal_Sync_Up]] in `_meetings/` (gitignored per convention).
- **Author**: DK + Claude (Opus 4.7), Apr 22 ~14:00 VN session.

## Related

- [[strategic_pivot_2026-04-22]] — same-day morning pivot that caused this handover assignment
- [[project_strategic_pivot_2026-04-22]] — memory pointer for pivot
- [[project_huy_aws_migration_kickoff_apr21]] — schema SQL already delivered to Huy
- [[project_graph_api_blocked_by_tenant_admin]] — Ryan / Azure AD blocker (Chapter 6)
- [[project_v13_4_backlog_apr22]] — backlog with item #7 (Tracy's cost research) now pre-empted by Bedrock + Opus 4.7 decision
- [[MOC_KAN-47]] — the v13.3 implementation that's being handed over
- [[feedback_vercel_branch_vs_production_deploy]] — deploy-gotcha to flag in Chapter 4
- [[feedback_self_send_testing_trap]] — testing pitfall to flag in Chapter 8
- [[reference_email_queue_schema]] — DB column names for runbook accuracy
- [CONVENTIONS.md](../../CONVENTIONS.md) — naming/placement rules this file follows
