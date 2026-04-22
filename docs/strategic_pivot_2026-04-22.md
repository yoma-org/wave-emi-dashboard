---
name: strategic_pivot_2026-04-22
aliases: ["Wave AWS Handover Pivot", "Apr 22 Strategic Pivot", "Rita Pivot Apr 22"]
description: Synthesis of Apr 22 Zeyalabs daily standup (Rita + Minh + Vinh) plus the post-meeting Yoma Bank Infrastructure Teams chat. Captures the directional shift from "Trustify hosts Wave EMI" to "Wave hosts on their own AWS, Trustify advises", and the parallel landing of the Digital Lending project as the new #1 financial services priority.
type: project
topics: [strategic-pivot, wave-emi, aws, handover, digital-lending, kan-47, infrastructure, scope]
status: active
created: 2026-04-22
last_reviewed: 2026-04-22
---

# Strategic Pivot — Apr 22 2026 (Wave Handover + Digital Lending Landing)

## TL;DR

1. **Wave EMI hosting is being kicked over to the Wave team.** Rita + Minh agreed on the call: Wave already has an AWS instance, hosting on Trustify is unnecessary cost and security liability. We become **advisor / observer**, not the operator. **Friday meeting with Wave + their new CIO Alex is the formal reset.**
2. **AWS Bedrock + Claude Opus 4.7** is now the recommended production LLM stack (replacing Gemini for OCR/extraction). Vinh made the call in the post-meeting chat.
3. **Digital Lending** is the new #1 financial services priority. Rita wrote the business case last night; folders are in the project drive (`Digital Lending/From Tín/`, `Digital Lending/From Paul/`). She told Vinh to consider the kickoff started — assess scope this week, build over the next couple of weeks.
4. **What we just shipped (KAN-47 v13.3) is still valuable** — as proof-of-capability for Friday and as the reference implementation Wave's team will copy from. Don't destroy Huy's AWS work either ($100 credit + proof artifact).

Source files:
- [[2026-04-22_Zeyalabs_Daily_Standup]] — full transcript in `_meetings/`
- Yoma Bank – Infrastructure Teams chat (screenshots inline below — not on disk)

---

## Section 1 — What was decided (Standup, ~9:30–11:50 mark)

### The pivot moment

**Vinh** (giving status, ~9:25): *"They want to host the E Money app on the AWS infra…"*

**Rita** (cutting in): *"They don't want to do anything. I'm saying — why don't we have THEM do it? That saves us a lot of complexity. Tell them what we need."*

**Minh** (strong agreement, 10:31): *"Absolutely. The best way that we can hand over that two-way money — we can go together with them for setting up the whole infrastructure. They get the root account. We can be like an observer, support them for the whole configuration."*

**Minh, on cost** (10:55): *"For me at this moment, if we want to have the E Money in for our own account, that will be costly. Take a lot of money. Doesn't make sense to move it for production. The reason we have AWS is for testing only."*

**Rita, sealing it** (11:05): *"Yeah, and it's also not necessary, right? Like, they've already got an AWS instance. It feels so unnecessary for us to do this."*

### Friday call

Rita: *"I'll talk to Alex about it as well."* — Alex is Wave's **new CIO**. There's a meeting Friday that Rita has not yet responded to. She had previously paused engagement: *"You guys keep adding scope and whatever, right?"* — she wants to reset.

**This Friday is the inflection point.** Wave can either accept the handover terms or push back.

---

## Section 2 — Post-meeting Teams chat (Yoma Bank - Infrastructure)

Source: 6 screenshots from Vinh ↔ Tin ↔ Minh ↔ Huy ↔ Khanh (DK) thread, ~10:19–10:44 AM.

### Translated key beats

| Time | Who | What |
|------|-----|------|
| 10:21 | Tin | "Anh Minh's idea is to use AWS as a demo first, right?" (clarifying) |
| 10:21 | Vinh | "No — Minh kicked it over to Wave entirely. No hosting on our side anymore." |
| 10:21 | Minh | "You guys still need to try AWS Bedrock though." |
| 10:21 | Vinh | "Wave already has the whole AWS infra. They want to host eMoney there instead of on Zeyalabs." |
| 10:22 | Vinh | "Once we move there, we just advise Wave to use **Claude Opus 4.7**." |
| 10:23 | Tin | "So we're handing it over completely? Confirming. After review, we support Wave hosting it." |
| 10:24 | Vinh | "Yeah, let Wave host. We advise. Set up a channel to guide them through config. **Safer for us — if there's any sensitive-data security breach, Wave bears it.**" |
| 10:25 | Huy | "So what do I do next? Destroy what I've implemented?" |
| 10:26 | Vinh | "Hold off. Don't destroy yet." |
| 10:26 | Tin | "No, since we have $100 AWS credit, just keep using it. **Proof that our side can do it.** Whatever data, Wave bears. Production goes to Wave." |
| 10:28 | Vinh | "Huy + Khanh — finish whatever setup is in progress." |
| 10:31 | Huy | "Try my best today. Still pending init DB schema." |
| 10:31 | Vinh | "Also still need n8n hookup to Outlook." |
| 10:32 | Tin | "Just deploy eMoney to done already." |
| 10:33 | DK | **"This requires working with Zeyalabs.ai IT to configure n8n hookup outlook credential. Need Azure AD. I'll contact Vinh about this. Let me text Win. This takes time. Need IT admin permission from the Lead — Ryan I think."** |
| 10:35 | Vinh | "okie" |
| 10:44 | DK | (forwards Huy the schema v1.1 update with migration 16 baked in — see [[project_huy_aws_migration_kickoff_apr21]]) |

### Synthesis from chat

- **The team has internalized the pivot in <30 minutes.** No resistance, full alignment behind Rita+Minh's directive.
- **AWS Bedrock + Claude Opus 4.7** is now official direction (replaces Gemini). This pre-empts Tracy's Opus-vs-Sonnet cost research from [[project_v13_4_backlog_apr22]] item #7.
- **Liability framing** is the key justification ("data breach → Wave chịu"). This is sharper than the cost framing alone.
- **Huy keeps building** — the AWS demo continues as a proof artifact, not a production target. Schema SQL DK shipped Apr 21 ([[project_huy_aws_migration_kickoff_apr21]]) becomes the **handoff document**, not the migration script.
- **DK's lane in this** is the n8n→Outlook bridge requiring Azure AD admin (Ryan via Win) — same blocker we already had ([[project_graph_api_blocked_by_tenant_admin]]), now sharper because handoff to Wave makes this a Wave-side problem too.

---

## Section 3 — What this means for already-shipped work

### KAN-47 v13.3 (live in production)

**Status: still valuable.** It demonstrates end-to-end capability and is the visual artifact for Friday's meeting. Don't tear it down.

But the framing shifts:
- ✅ **Still useful**: as a working PoC + screenshot fodder for Wave + as the "reference implementation" Wave's team will study
- ❌ **No longer the production endpoint**: Vercel + Supabase + n8n Cloud were our intended production stack. Now they're our *demo* stack.
- ⚠️ **Backwards-pressure on v13.4 backlog**: items that fix UX rough edges (XLSX index>0, date-format mismatch, PDF currency) drop in priority unless they affect the Friday demo or the handoff documentation. Items that are real bugs (item #9 dead-end branch) still matter for demo stability.

### Huy's AWS schema work (Apr 21 handoff)

**Status: still valuable, role changed.**
- The pglite-validated `emi_dashboard_schema_aws.sql` becomes the **schema artifact Wave's team copies** when standing up their RDS.
- Huy's AWS demo deployment continues so we can prove "we did it once, here's the runbook."
- Migration 16 (KAN-47 per-attachment extracted_fields JSONB) is already inlined in v1.1 — Wave gets a single-pass DDL.

**Don't destroy Huy's AWS resources** — Tin's call ($100 credit covers it, proof artifact justifies it).

### n8n trial decision (Apr 25 deadline — 3 days)

**Recalibrate.** The decision was: upgrade to $20/mo Starter (2,500 exec) for production OR shut down. With production moving to Wave, n8n Cloud is **demo-only**. Options:

1. **Upgrade $20** — keep demo running for Friday + handoff period. Cheap, low-risk.
2. **Stay on trial → expire** — let it die after Wave handoff. Risk: demo dark before Wave's environment is live.
3. **Migrate demo to free local n8n** — possible but burns time we don't have.

**Recommendation: upgrade $20 for at least one month.** Trivial cost vs the risk of demo going dark mid-handoff. Revisit at end of May.

### v13.4 backlog ([[project_v13_4_backlog_apr22]])

| # | Item | Pre-pivot priority | Post-pivot priority |
|---|------|--------------------|---------------------|
| 1 | XLSX extraction at attachments[1+] | Medium | **Low** — defer until Wave asks |
| 2 | SBS date-format false positives | Low | **Low** (unchanged) |
| 3 | PDF currency from email body | Low | **Low** (unchanged) |
| 4 | Deferred Layer C smoke tests | Low | **Low** (unchanged) |
| 5 | n8n hostname drift in docs | Very low | **Done** (already cleaned) |
| 6 | Row 15 postmortem | Low | **Drop** — historical curiosity now |
| 7 | Opus vs Sonnet cost analysis (Tracy) | Medium | **PRE-EMPTED** — Vinh chose Opus 4.7 in chat |
| 8 | Text-only amount extraction | Low | **Low** (unchanged) |
| 9 | `Is Rejection Email?` dead-end branch | **HIGH** | **STILL HIGH** — affects demo stability for Friday |

**Net**: only #9 deserves urgent attention before Friday. Everything else can wait for Wave to surface real production friction (which Wave will only do after they're hosting).

---

## Section 4 — Digital Lending (new #1 priority)

### What we know from the standup

- Folder: `Digital Lending/` in the project drive (top-level, alongside the existing project folders)
- Two subfolders inside:
  - `From Tín/` — Tín is **CTO of Yoma Bank**
  - `From Paul/` — Paul is **PM of the current digital lending product**
- Rita wrote a "high-level business case" **last night** (Apr 21 evening)
- Rita: *"When this lands, it's going to be the single most important thing we do."*
- Rita to Vinh: *"I think you should consider it started. The only reason I hadn't formally kicked it off was because I was waiting for someone to confirm something, but it doesn't matter."*
- Timeline: *"Probably will start [in] the next couple of weeks."* Rita wants to start working on it **this week if she can**.
- Scope assumption: *"You can assume almost everything I've written is the scope of what will need to be done"* — minor changes possible, no major changes.

### Implications

- **This is Yoma Bank ↔ Trustify**, not Wave. New client surface, deeper relationship (CTO direct).
- **DK should read the business case TODAY** (Rita said "I think you guys should start assessing it now").
- **Fits DK's career strategy**: client-facing technical role with the bank's CTO is exactly the dual-bandwidth proof (English + technical + financial-services domain) the long-term plan needs ([Trustify/CLAUDE.md](../../../CLAUDE.md)).
- **Vinh said**: "When you guys have more insight, let me know and I'll create a plan for the team to start working on it." — Vinh is owner of the work-allocation; DK's role inside this isn't yet defined.

### Action items for Digital Lending

1. **Today**: Find the `Digital Lending/` folder, read Rita's business case, read Tín + Paul subfolders.
2. **Today/Tomorrow**: Surface questions to Vinh + Rita.
3. **This week**: Be ready to scope DK's role in the build (DE? DA? PM-adjacent?). The earlier DK shapes his role here, the better — this is the project that defines the next 2–3 quarters.
4. **Don't write code yet.** Rita explicitly said assessment phase first.

---

## Section 5 — Action items (today, this week)

### Today (Apr 22 PM)

| Owner | Task | Source |
|-------|------|--------|
| DK | Find `Digital Lending/` folder, read business case + Tín + Paul subfolders | Rita standup |
| DK | Text Win re: Azure AD admin (Ryan) for n8n→Outlook hookup | Chat |
| DK | Liaise with Vinh re: setting up Wave config-guidance channel | Chat |
| DK | Decide: fix v13.4 #9 (dead-end branch) before Friday demo? | Demo stability for Friday |
| Huy | Finish init DB schema, keep AWS demo alive (don't destroy) | Chat |
| Vinh | Ping Rita with Digital Lending scoping questions when ready | Standup |

### This week

| Owner | Task | Why |
|-------|------|-----|
| Rita | Friday call with Wave + Alex (CIO) | Formal handoff conversation |
| DK | Pre-Friday: prepare a "what we're handing over" packet (schema SQL + workflow JSON + dashboard URL + runbook) | Friday will go better with the artifact ready |
| DK | n8n trial decision by Apr 25 (recommend: upgrade $20) | Demo continuity through handoff |
| Vinh + DK | Scope DK's role in Digital Lending | Career-defining moment |

---

## Section 6 — Open questions for the Friday Wave meeting

1. **Does Wave's team have AWS + Postgres + n8n competence to receive the handoff?** If no, the "we advise" model has a long tail of support effort.
2. **Who owns Wave's AWS account?** Their infra team, or Vinh (Vinh is also at Wave-Yoma side)?
3. **Timeline for Wave's environment going live?** Affects how long we keep the demo running.
4. **Does Wave still want all of KAN-47's polish?** Or is the v13.3 baseline + a runbook enough for them to extend on their own?
5. **Bedrock + Claude Opus 4.7 — does Wave have Bedrock access in their AWS account?** Otherwise this is a setup task in the handoff.
6. **Outlook hookup — does Wave use the same Microsoft 365 tenant?** Or different? If different, the Graph API / Azure AD setup is theirs to do.

---

## Section 7 — DK career angle

This pivot doesn't hurt DK — and probably helps:

- **Hosting work was always non-portfolio-positive** for DK personally. Building a system Wave runs is a much better story than "I babysit a Vercel deploy."
- **Advisor / trainer role** maps cleanly onto DK's dual-bandwidth career strategy: English + technical + client-facing. Walking Wave's team through config IS the client-facing work.
- **Digital Lending** is the bigger career upside. Yoma Bank CTO direct line is a much higher-stake project. A Data Engineer/Analyst at the inception of a digital lending product (with English to translate between Yoma's bank-side stakeholders and Trustify's dev team) is the exact PM-adjacent path Trustify CLAUDE.md describes.
- **Honest gap to watch**: DK's coding-without-AI ability matters less for advisor/PM work than it would have for hosting work. So this pivot reduces DK's biggest personal risk on the Wave engagement.

**The play**: lean into the advisor role for Wave. Don't volunteer to host anything. Use the saved bandwidth to grab a meaningful slice of Digital Lending early.

---

## Section 8 — Side observations from the standup

- **Honey vs Kind title absurdity** (~16:55–17:25) — Rita venting about Yoma's titles being meaningless ("It makes no f***ing sense"). Not actionable, but useful texture: Rita treats hierarchy with low ceremony.
- **Lotus Labs migration** — Rita wants Win to move all her stuff from Lotus Labs to a common Zeyalabs OneDrive/SharePoint. Not blocking but visible.
- **Rita going to Alibaba Cloud event** — interested in what Alibaba is doing in AI. Watch for follow-up if she shares anything (could shift LLM strategy again).
- **Voucher project** — Win waiting on docs from financial services side. Not active.

---

## Provenance

- **Standup**: 18-minute Zeyalabs daily standup, Apr 22 ~10:00 VN time. Attendees: Rita Nguyen, Vinh Nguyen Quang, Minh Ngo, Win Win Naing, Khanh Nguyen (DK), Tín Dang. Transcript: [[2026-04-22_Zeyalabs_Daily_Standup]] in `_meetings/` (gitignored per [CONVENTIONS.md](../../CONVENTIONS.md)).
- **Teams chat**: Yoma Bank – Infrastructure channel, ~10:19–10:44 AM, Apr 22. Source: 6 screenshots shared in conversation. No persistent transcript on disk.
- **Author**: DK + Claude (Opus 4.7), Apr 22 13:00 VN session.

## Related

- [[MOC_KAN-47]] — what we just shipped that this pivot reframes
- [[project_kan47_v13_3_shipped]] — production state of the work being handed over
- [[project_huy_aws_migration_kickoff_apr21]] — the schema artifact that becomes the handoff document (existing memory file uses pre-convention `_apr21` suffix)
- [[project_v13_4_backlog_apr22]] — backlog now re-prioritized (only #9 urgent) (existing memory file uses pre-convention `_apr22` suffix)
- [[project_strategic_pivot_2026-04-22]] — companion project memo (this memo's memory pointer)
- [[project_digital_lending_kickoff_2026-04-22]] — sister project landing same day
- [[project_n8n_trial_expiration_may1]] — decision recalibrated (recommend upgrade $20 for demo continuity)
- [[project_graph_api_blocked_by_tenant_admin]] — same blocker, now blocking handoff too
- [[reference_team_members]] — Trustify team context
- [[feedback_infrastructure_first]] — Rita's prior infra-first directive (consistent with today's pivot)
