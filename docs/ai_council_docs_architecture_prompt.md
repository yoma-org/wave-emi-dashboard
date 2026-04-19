---
name: ai_council_docs_architecture_prompt
aliases: ["AI Council — Docs Architecture Review"]
description: Comprehensive AI Council prompt for reviewing DK's planned docs+memory system architecture before execution. Sent to Grok, Gemini, Perplexity for independent review.
type: reference
tags: [ai-council, docs-architecture, knowledge-management, obsidian]
created: 2026-04-19
last_reviewed: 2026-04-19
status: active
schema_version: 1.0
---

# AI Council: Docs + Memory System Architecture Review

**Date**: April 19, 2026 (Sunday morning)
**Requester**: DuyKhanh (DK) Nguyen — solo Data Engineer, Trustify Technology (HCM City)
**Primary collaborator**: Claude Code (Opus 4.7, 1M context)
**Purpose**: Independent adversarial review BEFORE executing a 4.5-hour docs cleanup + Obsidian integration

---

## Your role — read this first

You are an **independent consultant** reviewing my planned knowledge management architecture. I've been designing this system with Claude as my primary collaborator. I'm now asking you **explicitly for adversarial, non-consensus perspectives**.

**The ask**:
- Push back hard
- Propose alternatives
- If you'd do it differently, say so with a reason
- Cite real tools, frameworks, or engineering teams at comparable scale
- **Disagree with me on at least one thing** — even if minor

**The captain's-chair framing**: I am the captain of the ship. My primary partner (Claude) is first mate. You are a trusted consultant brought aboard for this decision. I will synthesize your feedback with other consultants' input and Claude's analysis. The more you disagree — substantively — the more value you create.

---

## Who I am (context for calibration)

- **Role**: Data Engineer starting April 1, 2026 at Trustify Technology (HCM City, Vietnam)
- **Real experience**: ~7 months data engineering at ISC (previous role), AI-assisted coding daily
- **Language**: Native Vietnamese, English proficient (my validated career moat)
- **Honest skill profile**: Strong reasoning + problem decomposition; hands-on coding without AI is a known gap; I work WITH AI, not around it
- **Workflow**: Claude is primary pair programmer. I routinely consult Grok, Gemini, Perplexity, DeepSeek, GPT for second opinions on high-stakes decisions ("AI Council" pattern)
- **Input style**: I often use voice-to-text (expect some transcription noise in my messages)
- **Career strategy**: 2-3 year stepping stone at Trustify → client-facing tech lead → PM/Solutions Architect (18-24 months)

## The project ecosystem

This knowledge system must serve three overlapping scopes:

### 1. Wave EMI Dashboard (current production project)
- Single-file vanilla JS dashboard (~2,800 LOC, deployed Vercel Pro)
- n8n automation pipeline (17-node Worker, Supabase-backed durable queue)
- Real client: Wave Money, Myanmar (corporate salary disbursement pipeline)
- Production-grade level expected within weeks
- **Current volume**: ~122 active project files, 45 docs, 27 pipeline versions, 90 memory files

### 2. Career transition archive
- Job search docs (ISC → Trustify), company research, market analysis, resignation messages
- Spans multi-year career arc
- Crosses business strategy + technical domains

### 3. Future Trustify projects (projected)
- 3-5 engineering projects expected over 2-3 years at Trustify
- Must scale without full reorganization each year

**File volume projection**:
- Today: ~200 active files total
- Year 1: ~400 files
- Year 2-3: ~800-1000 files

---

## The pain I'm solving

### Claude-side (primary)
Claude has no persistent memory between sessions — it reads files fresh each session. When file system is messy:
1. **Can't find relevant context** (loads wrong files, wastes token budget)
2. **Re-discovers decisions we already made** (re-debates n8n concurrency, re-evaluates Supabase vs BigQuery)
3. **MEMORY.md index truncates** (currently 331 lines, gets cut mid-load, resume pointer lost)
4. **Loads stale phase-era plans as "current state"**

### Human-side (me)
1. Can't find things in 90 memory files
2. Don't know what's current vs archived
3. Lose decision rationale from 2 months ago
4. Can't see relationships between concepts

### Quantified cost
Claude session startup today burns ~3,000-5,000 tokens on context rediscovery. At current pace, we redo architectural debates 2-3x per week.

---

## Current state of the system

### Exists today
- `CLAUDE.md` — project instructions, always loaded (~9KB)
- `MEMORY.md` — memory index, always loaded (currently 331 lines, truncating)
- `memory/` folder — ~90 files, 5 naming prefixes (user_, feedback_, project_, reference_, checkpoint_)
- `docs/` — 45 files with inconsistent naming (PascalCase, snake_case, Title Case mixed)
- `_archive/` — exists but underused
- Git version control (solo dev, 2 remotes: personal + yoma-org)
- Google Drive sync at root level
- Frontmatter on most memory files (`name`, `description`, `type` only)

### Does NOT exist
- Decision records (ADRs)
- Consistent frontmatter schema across all files
- Obsidian integration
- Maps of Content (MOCs)
- Templates for new files
- Lifecycle discipline (status fields, expiry, review cadence)

---

## Proposed architecture (the plan I want you to critique)

### Principles adopted
- **Diátaxis** (Daniele Procida) — doc types: reference / howto / decision / context
- **ADRs** (Michael Nygard, 2011) — immutable decision records, numbered
- **PARA** (Tiago Forte) — Projects / Areas / Resources / Archives lifecycle graduation
- **Evergreen notes** (Andy Matuschak) — atomic, concept-oriented, densely linked
- **Single source of truth** (GitLab handbook approach)
- **Schema versioning** (API design best practice applied to docs)

### Three-tier persistence architecture

| Tier | File | Cadence | Contains |
|---|---|---|---|
| Stable | `CLAUDE.md` | Monthly | WHO/WHAT/WHY — profile, team, mission, don't-do rules |
| Semi-stable | `CONVENTIONS.md` (NEW) | Quarterly | HOW — naming, schema, lifecycle, archive triggers |
| Volatile | `MEMORY.md` | Per-session | WHERE we are — resume pointer, active status |
| Immutable | `decisions/ADR-NNN_*.md` (NEW) | Never edit | WHAT WAS DECIDED + WHY |

### Frontmatter schema v1.0

```yaml
---
name: kan46_v13_1_unified_architecture          # matches filename (snake_case)
aliases: ["KAN-46 v13.1 Architecture"]           # human-readable Obsidian wiki link target
description: Single-line summary for discovery
type: feedback | project | reference | decision | howto | context
tags: [kan-46, architecture, shipped]
created: 2026-04-17
last_reviewed: 2026-04-19
status: active | paused | blocked | shipped | archived | superseded
schema_version: 1.0
---
```

### Obsidian integration
- Free core app (no Sync subscription — Google Drive + Git already sync)
- Flat namespace (filenames unique across entire vault)
- Tag-based navigation + MOCs for concept entry points
- Aliases enable human-readable wiki links like `[[KAN-46 v13.1 Architecture]]`
- Planned community plugins: Templater, Dataview, obsidian-git

### Execution phases (A–J, ~4.5 hours total)
- **A**: Archive old n8n workflows (v1-v11) via `git mv`
- **A.5**: Convert 6 AI Council rounds → ADR-001..006 (immutable decision records)
- **B**: Archive phase-era docs (Phase 2/3, v12 work, pre-KAN plans, meetings)
- **C**: Atomic rename — filename + frontmatter + H1 in ONE commit
- **C.5**: Add schema v1.0 fields to all active files during rename
- **D**: Archive memory bloat (13 checkpoints, session logs, phase3 projects) → ~90 → ~45 active
- **E**: Consolidate overlapping feedback files (sandbox_constraints + sandbox_process_blocked, etc.)
- **F**: Write CONVENTIONS.md v1.0
- **F.5**: Create `_templates/` folder (ADR template, feedback template, project template, meeting template)
- **G**: Refactor CLAUDE.md to WHO/WHAT/WHY only (extract conventions to CONVENTIONS.md)
- **H**: Update MEMORY.md index (regroup by scope, remove archived pointers)
- **I**: Install Obsidian + vault setup at `g:/My Drive/Tech Jobs/Trustify/`
- **J**: Build 5 MOCs (KAN-46, Active Tickets, Wave EMI Architecture, Career Strategy, Decisions)

### What I explicitly decided NOT to do
- Customer-facing docs in this system (separate Docusaurus/GitBook repo when needed)
- Notion/Confluence migration (loses Git + Claude integration)
- Linter/CI for frontmatter (add when team = 2+ people)
- Date-prefixed filenames (reverse chronological)
- Obsidian Sync subscription ($5/mo unnecessary)

---

## Please answer these specific questions — push back hard

### 1. Blind spots at scale
Where does this system break at 400 files (Year 1) or 1000 files (Year 3)?
What failure modes do year-2+ solo devs most commonly hit with a setup like this?

### 2. Obsidian alternatives
Is Obsidian the right choice for AI-augmented solo workflows, or should I consider:
- **LogSeq** (block-based outliner, open source, may fit voice-to-text better?)
- **Foam** (VS Code-based, zero lock-in, weaker graph)
- **Heptabase** (visual canvas, paid, learning curve)
- **Roam Research** (original backlinks, paid, proprietary)
- **Dendron** (hierarchical, VS Code, declining community)

Given my AI-augmented workflow and cross-project scope, which fits best and why?

### 3. Organizational system: tags vs numbers
Should I layer **Johnny Decimal** (johnnydecimal.com) numerical system ON TOP of tags, or is tag-based enough? Does Johnny Decimal's 99-area constraint help or hurt at 1000-file scale?

### 4. ADR format
Michael Nygard's original format vs **MADR** (Markdown ADR, more structured) vs **Y-Statement** (one-line decisions) — which fits a solo dev with Claude as co-author? Any real-world examples of ADR discipline breaking down at scale?

### 5. Obsidian plugins — mandatory vs optional
Of the Obsidian plugin ecosystem, which are MANDATORY for this use case (not nice-to-have)?
- Templater
- Dataview
- Breadcrumbs
- Obsidian-git
- Excalidraw
- Advanced Tables
- Kanban
- Periodic Notes
- Smart Connections (AI-powered)

Which are non-negotiable? Which are traps (promise much, deliver complexity)?

### 6. Cross-project architecture
My system must span: career docs + Wave EMI + future Trustify projects over 3 years.
- Should career and engineering docs share ONE Obsidian vault or SEPARATE vaults?
- Shared tags or namespaced per project?
- What's the failure mode of each choice?

### 7. AI-readable vs human-readable dual-use
Same files serve two users:
- **Claude** (reads via Read/Grep tools, uses filename + description to find)
- **Me** (navigates via Obsidian graph + tags + wiki links)

Are there patterns that optimize for ONE user at the cost of the other? What should I add specifically for Claude that humans wouldn't care about, or vice versa?

### 8. Schema evolution
CONVENTIONS.md has `schema_version: 1.0`. When I evolve (add field, change rule), what's the ideal migration pattern for a solo dev?
- Lazy migration (fix on touch) vs batch script?
- What do mature docs-as-code projects (Rust RFCs, Kubernetes KEPs, Oxide RFDs) actually do?

### 9. Review/archive cadence
I proposed:
- MEMORY.md: per-session
- CONVENTIONS.md: quarterly
- CLAUDE.md: monthly
- `_archive/`: quarterly

Is this realistic for solo + AI-augmented? Too frequent? Too rare? What cadence do real practitioners hold?

### 10. The meta-question (most important)
If you were advising me, would you do this cleanup NOW (while system is 90 files) or defer until the first "my docs are broken" moment?

What's the real ROI curve on this kind of investment for solo devs — linear, compounding, or front-loaded?

---

## Constraints

- **Time budget**: ~4.5 hours today (Sunday Apr 19)
- **Solo worker** — no team to train right now; may grow to 2-3 in 6-12 months
- **Cannot change**: Markdown + Git foundation, Google Drive sync, Claude-primary workflow
- **Must work across**: career + engineering projects over 3 years
- **Must work on Monday**: Myanmar production testing starts tomorrow — cleanup cannot break live systems (memory/docs are reference-only, no code impact)

---

## What I want back from you (required output)

1. **Rank** the 10 questions above by how much my plan WILL CHANGE based on your answer (which are decision-altering vs cosmetic?)
2. **Name** the single biggest blind spot I have
3. **Recommend** ONE thing to ADD to the plan and ONE thing to CUT
4. **Cite** real tools, frameworks, or engineering teams handling similar scale
5. **Disagree** with me on at least one substantive thing — even if minor

Bonus: if you see a pattern I haven't mentioned (Zettelkasten IDs, Johnny Decimal hybrid, LYT by Nick Milo, digital garden approach), name it and say why it fits or doesn't.

---

## Meta-instruction for your response format

- Be specific. "Use Obsidian" is not useful; "Install Templater + point at `_templates/` + use Dataview query X to track stale files" is useful.
- Cite sources when you can (person, company, book, URL).
- Where you're uncertain, say "I'm less sure about X" rather than hedging generally.
- If you think the whole plan is misguided, say so — with what you'd do instead.
- Target length: enough to be substantive. No word limit. But lean on specificity over length.

Thank you for taking this seriously. My primary partner (Claude) will synthesize your feedback with responses from other AI consultants and with its own analysis. You're helping me build a system I'll live in for 2-3 years.
