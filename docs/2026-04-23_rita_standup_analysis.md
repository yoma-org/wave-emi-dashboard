---
name: 2026-04-23_Rita_Standup_Analysis
aliases: ["Rita Standup Apr 23 Analysis", "Zeyalabs Daily Apr 23", "Rita eMoney Infra Direction Apr 23"]
description: Actionable synthesis of the 2026-04-23 Zeyalabs Daily Standup (Rita + Vinh + Win + Minh, ~15 min). Key takeaways for Wave EMI: (1) Rita confirmed + hardened yesterday's pivot — host everything on Wave/Yoma's AWS, not Trustify's; (2) her simplification preference validates our drop-extract-employee decision; (3) one important caveat — she explicitly mentioned CSV upload/download as a fallback pattern if Wave APIs aren't ready for other projects, which affects how quickly we delete the Vercel extract-employee endpoint; (4) she flagged Yoma's DevSecOps sophistication as a concern, implying our handover doc needs explicit security requirements.
type: analysis
topics: [wave-emi, rita-direction, aws-migration, zeyalabs-standup, csv-fallback, devsecops-concern, yoma-infra, process-change]
status: active
created: 2026-04-23
last_reviewed: 2026-04-23
---

# Rita Daily Standup Analysis — 2026-04-23

**Source**: [_meetings/2026-04-23_Zeyalabs_Daily_Standup.vtt](../../_meetings/2026-04-23_Zeyalabs_Daily_Standup.vtt)
**Duration**: ~15 min | **Participants**: Rita Nguyen, Vinh Nguyen Quang, Win Win Naing, Minh Ngo
**Scope of this analysis**: extract only what affects Wave EMI and our immediate work. Avoid noise.

---

## TL;DR — 3 things that matter for us

1. **Yesterday's pivot is now hardened, not a whim.** Rita re-stated it today with conviction: *"I don't even know why we're talking about setting up our own [infra]. For right now... I don't know why I overcomplicated that."* — Wave/Yoma hosts, Trustify operates. Our docs are on the right track.

2. **Drop-extract-employee decision is validated** by Rita's simplification preference — she preaches "don't build scattered isolated infrastructure" throughout the meeting. Aligns perfectly with this morning's choice to remove Lambda extract-employee from AWS v1.

3. **One important caveat worth respecting**: Rita said about the C2P/mini app — *"We may have to, you know, the E Money things that we're doing right now with the upload download of CSV files, we might have to resort to that."* This means the **CSV upload/download pattern** (which extract-employee supports) may come back as a fallback strategy if Wave APIs aren't ready. **Don't rush to delete the Vercel endpoint yet** — wait until Rita confirms Wave's API situation.

---

## 1. What Rita said that directly affects Wave EMI

### 1.1 Confirmation: host on Wave/Yoma's AWS

> *"I don't even know why we're talking about setting up our own [infra]. The only time we need to set up our own is when we start building financial services, common shared services, like we're building something that they all have to hit. But for right now, yeah, I don't know why I overcomplicated that."*

**Translation**: Rita herself walks back any suggestion that Trustify needs its own AWS. **Everything Wave-side goes on Wave's AWS, full stop.** Our HANDOVER_APP.md + HANDOVER_INFRA.md direction is correct.

### 1.2 Validation of simplification mindset

Throughout the call, Rita preaches simplification:
- Pushes to host Star City app on Yoma infra too (not Trustify's)
- Pushes to host even small apps on Wave/Yoma's AWS, not Vercel+Supabase: *"if we can just put it all on... The Group, AWS... then we should just do that and not have a whole bunch of isolated incidences."*
- Rejects Vinh's initial suggestion to keep Vercel+Supabase for non-functional apps

**Implication for us**: our decision to drop Lambda extract-employee for AWS v1 aligns cleanly with Rita's philosophy. She'd approve if asked.

### 1.3 The CSV-upload-as-fallback signal — **pay attention here**

Rita discussing the C2P/mini app (different project, but relevant pattern):

> *"I wrote that document with a lot of assumptions that Wave has stuff and I am not convinced that they do have those. We may have to, you know, the E Money things that we're doing right now with the upload download of CSV files, we might have to resort to that."*

**Why this matters for us**:
- Rita is explicitly pointing to our eMoney's CSV pattern as a **fallback model** for when Wave APIs aren't ready
- The dashboard's current `extract-employee` endpoint is adjacent to this pattern (user uploads a file, system parses it)
- **If we delete the Vercel extract-employee + UI button too aggressively**, we remove a building block that might be needed for Wave API fallback scenarios

**Action adjustment**: when we implement "drop extract-employee," do it in two stages:
- **Stage 1 (now, safe)**: remove from AWS migration scope (don't port to AWS)
- **Stage 2 (wait)**: delete Vercel endpoint + UI button — **hold off 1-2 weeks** until Rita's upcoming meetings clarify Wave's API readiness across her projects. If CSV fallback becomes a pattern, keep the Vercel version alive as reference.

### 1.4 Yoma DevSecOps sophistication warning

Rita on Yoma's internal infra team:
> *"I will say they tend to not be very... sophisticated with their DevSecOps. So we will need to just keep an eye on that."*

**Implication for our handover docs**: Yoma's infra team (who will implement our spec) may misconfigure things. Our docs should be **explicit about security requirements** rather than assuming best-practice defaults:

- IAM roles: specify minimum-privileges explicitly (don't write "grant Bedrock access" — write "grant only `bedrock:InvokeModel` on specific model ARNs")
- Network posture: specify "internal-only ALB, no public internet ingress" in clear language
- Secrets: specify "all secrets via Secrets Manager, no plaintext in env vars"
- CloudWatch: specify what to log vs. what to mask (PII, payroll data)

This is work on us. Adds ~30 min of polish to each handover doc section.

### 1.5 Vinh-to-Rita eMoney update: zero friction

Vinh: *"we are working on to prepare the AWS infrastructure setup document for the Wave team to host the e-money. It's almost complete, so today we're going to review it internally, and then we're going to send it over to you and Win."*

Rita: *"Okay."*

**Read**: minimal engagement, neutral-positive tone. She's not scrutinizing details because she trusts the direction. Pace is right. Keep shipping.

---

## 2. Other things that happened (tracking only, not acting on)

| Item | Direct impact on DK/Wave EMI? |
|---|---|
| Culture survey resend button (Apr 29 launch, May 8 reminder) | **None** — Vinh's project |
| Elevator app MMPR reports | **None** — Vinh's project |
| Star City app hosted on Yoma | Indirect — reinforces landlord/operator pattern |
| C2P/mini app OCR with 11labs (Burmese voice recording needed) | Indirect — but see §1.3 re: Wave API caveat |
| Hiring: Haymar + Ryan (Ryan starts early May; Haymar ~June) | Ryan = likely Wave's tenant admin who blocks Graph API access (per [[project_graph_api_blocked_by_tenant_admin]]) — could unblock by early May |
| Rita wants weekly Vinh-Rita prioritization meeting (no Jira discipline) | Indirect — DK's output needs to land in that sync through Vinh |
| April 29 culture survey launch + May 1 holiday | Need team standby on Apr 30 + May 1 (Minh's point) |

---

## 3. Alignment check against yesterday's and this morning's decisions

### Decision: pivot to Wave-hosted AWS (from Apr 22)
✅ **Hardened, not softened.** Rita re-stated today. Not a whim.

### Decision: drop Lambda extract-employee from AWS v1 (this morning)
✅ **Validated in principle.** Rita preaches simplification. No evidence she'd push back.
⚠️ **One caveat**: don't delete the Vercel endpoint yet — CSV upload may be a pattern she wants preserved. Drop from AWS scope; keep Vercel as reference until API readiness is confirmed.

### Decision: Huy's HANDOVER_INFRA.md deadline (end of today)
✅ **Schedule holds.** Vinh told Rita it's almost done. Keep pace.

### Decision: extend horizon to post-Tết 2027 (from last night's career doc)
✅ **Still orthogonal.** Meeting didn't touch DK's career trajectory. No update needed.

---

## 4. Risk-watches added by this meeting

| Risk | Probability | Blast | Mitigation |
|---|---|---|---|
| Yoma DevSecOps misconfigures our handed-over infra | Medium | Looks bad on Trustify | Make security requirements explicit in HANDOVER docs (§1.4 above) |
| CSV fallback pattern resurfaces for Wave APIs | Medium | Requires us to keep extract-employee alive longer | Don't delete Vercel endpoint for 1-2 weeks; watch Rita's Wave API findings |
| Ryan starting early May unlocks Graph API access | Medium-High positive | Unblocks Outlook tenant-admin flow | No action — monitor Ryan's onboarding |
| Rita's mood was frustrated (vented about Alibaba event) | Low-Medium | Higher scrutiny on any polish gaps | Tighten handover doc language; proof-read before sending |
| Trustify hire of DevSecOps person | Low short-term | Changes team shape over time | No action — monitor |

---

## 5. Concrete action items (for DK, today-tomorrow)

1. **No change** to the drop-extract-employee-from-AWS plan. Proceed.
2. **Change**: in the handover doc + post-decision cleanup, **hold off on deleting the Vercel extract-employee endpoint** for 1-2 weeks until Rita clarifies Wave API readiness. Keep the "drop from AWS" decision; postpone the "delete from Vercel" follow-up.
3. **Add to HANDOVER_APP.md §5 or new §9**: explicit security requirements (IAM least-privilege, no public-internet ingress, Secrets Manager only, CloudWatch logging spec). Defensive language for Yoma DevSecOps.
4. **Keep the Apr 30 + May 1 standby awareness** in mind — no specific action unless something breaks.
5. **Monitor Ryan's start date** (~early May). If he's the Wave tenant admin, we may finally unblock Graph API access post-cutover.

---

## 6. What NOT to act on from this meeting (noise)

Deliberately excluding:
- Rita's Alibaba event vent (emotional context only; not actionable)
- Culture survey mechanics (not our project)
- Elevator app MMPR reports (not our project)
- C2P OCR Burmese voice recording (not our project)
- Process change for weekly prioritization (Vinh manages this upstream)
- Star City app hosting (Win + Yoma coordinate this)
- Holiday staffing logistics (Minh coordinates this)

Listed explicitly so this analysis doesn't pollute the focus: **two items that matter for us**, the rest is context.

---

## 7. Cross-references

- [[project_strategic_pivot_2026-04-22]] — yesterday's pivot that this meeting confirms
- [[project_wave_infra_v2_huy_cloudfront_dropped]] — Huy's architecture direction (still valid)
- [[known_issue_browser_to_rds_crud_gap]] — the open architectural gap independent of this meeting
- [[2026-04-23_DK_Huy_Architecture_Talk_Analysis]] — this morning's drop-extract-employee decision
- [[Rita_Nguyen_Strategic_Profile]] — Rita profile (her budget philosophy + comms style are reinforced in this meeting)
- [[project_graph_api_blocked_by_tenant_admin]] — Ryan's hire (~early May) may unblock this
- `_meetings/2026-04-23_Zeyalabs_Daily_Standup.vtt` — source transcript

---

## 8. One-line summary for CLAUDE_CONTEXT

> 2026-04-23 Rita standup: hardened the Wave-hosts-AWS pivot + validated drop-extract-employee. One caveat: keep Vercel endpoint alive for 1-2 weeks in case CSV-upload becomes a fallback pattern for Wave APIs.
