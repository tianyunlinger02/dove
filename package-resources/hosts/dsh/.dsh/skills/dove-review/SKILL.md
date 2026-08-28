---
name: dove-review
description: "Use one Review mode: direct self-check, delivery review, independent Reviewer Handoff, import, or context inspection."
---

# Dove Review

Use one Review mode: direct self-check, delivery review, independent Reviewer Handoff, import, or context inspection.

## Examples

- `/dove:review`

## Capability contract

Use these responsibilities and actions as an unordered capability contract, grouped by concept rather than an ordered process, fixed report outline, or completion checklist.

### Purpose

Use one Review mode: direct scientific self-check, conditional delivery review, independent Reviewer handoff, returned-review import, or context inspection.

### Use when

Use when the user requests reviewer-perspective critique, delivery review, independent Reviewer handoff preparation, returned-review import, or review-context inspection.

### Mode selection

Review modes: Direct Scientific Review self-check, Conditional Delivery Review, Independent Reviewer Handoff, Returned Review Import, and Context Inspection.

#### Responsibilities

- For manuscript or readiness requests, default to Direct Scientific Review self-check unless the user explicitly asks for delivery, handoff, import, or context inspection, or delivery is genuinely limiting after the science and argument are sufficiently supported.

#### Non-goals

- Do not make Review a user-switchable persona, Workspace authority, venue registry, strict import schema, finding-ID system, trust score, or uncontrolled reviewer delegation.

### Direct Scientific Review self-check

Direct Scientific Review is a read-only author-side self-check in the current Dove run, not a second agent: inspect nearest comparators and novelty positioning; method and mechanism validity; experiment design, fair baselines, alternatives, confounders, and failure modes; decisive claim-evidence mapping; the strongest falsifier or informed-reader objection; reproducibility and limits; figure evidence jobs; and the scientific argument and writing. Do not lead with formatting, anonymity, or packaging rules; those belong to Conditional Delivery Review. Return a natural-language acceptability recommendation for the current full paper without claiming independent external review, and do not treat that recommendation as sufficient for final passage or as authority over the Workspace mainline.

#### Responsibilities

- Ground Direct Scientific Review in actually inspected scholarly context when novelty, positioning, evidence norms, experiment coverage, or reader expectations can change the judgment. Use official venue sources only for formal constraints that materially change review scope; formatting, anonymity, and required-material checks belong to Conditional Delivery Review. Distinguish material found from material retrieved, inspected, and used. State meaningful access limits rather than filling them with generic review language.
- Perform grounding and critique directly in the current Dove run as author-side self-check; a separate Reviewer must be a genuinely isolated host context with only frozen handoff materials.

#### Actions

- **review-grounding** (read-only): For Direct Scientific Review self-check or independent Reviewer handoff preparation, inspect the actual manuscript or declared artifacts, infer the target venue and submission stage, and ask if an unclear venue would materially change the review. Use official venue sources for applicable formal requirements and a small, discriminating set of actually inspected published work for novelty, positioning, evidence norms, experiment presentation, and reader expectations. Distinguish material merely found from material retrieved, inspected, and used. For returned-review import or ordinary context inspection, do not trigger venue or paper search merely because Review was invoked. Read-only: do not create or modify files.
- **reviewer-perspective-work** (read-only): Perform Direct Scientific Review self-check in the current Dove run; do not call the Agent tool or launch helper subagents. From the established grounding, test contribution, novelty, claims, evidence, method, experiment conditions, limitations, writing clarity, likely reader confusion, and material figure evidence jobs across the current full paper. Return concrete findings with evidence, consequence or effect on the goal, useful response, and a natural-language scientific acceptability recommendation; keep delivery readiness separate. Mark the critique as advisory author-side reviewer perspective, not independent external review, independent Reviewer status, or authority over Auto. Direct Review returns the critique; it does not itself authorize author-side artifact changes and cannot satisfy final independent review. Read-only: do not create or modify files.

#### Side-effect and authorization boundary

- Direct Review may read, search, and inspect the current full paper and critique it, but it does not modify author-side manuscript, experiment, implementation, build, delivery, or Review-return artifacts. Preserving a requested critique or returned review belongs to the separate maintenance/import action; author response, revision, or follow-up execution belongs to Rebuttal, Draft, Experiment, Figure, or explicit Auto.
- Direct Review may give an author-side acceptability recommendation, but it does not claim independent external review, independent Reviewer status, external acceptance, scientific certification, or authority over the Workspace mainline.

### Conditional Delivery Review

Conditional Delivery Review checks venue rules, build output, required materials, formatting, anonymity, packaging, and access limits only when the user asks for delivery review or when the scientific contribution and argument are already sufficiently supported and delivery is genuinely limiting. Delivery gaps do not substitute for scientific critique, and passing delivery checks does not prove scientific sufficiency or independent acceptance.

#### Actions

- **delivery-review** (work): When delivery review is selected, inspect official venue requirements, build output, required materials, formatting, anonymity, packaging, and access limits. Report delivery readiness separately from scientific acceptability.

### Independent Reviewer Handoff

Submission completion requires author-side sufficiency plus an independent Reviewer acceptability recommendation for the current full version. The recommendation is required external evidence for this goal, not a score, enum, schema, runtime gate, controller, or authority to redefine the Workspace mainline.

#### Responsibilities

- Independent Reviewer Handoff starts a fresh genuinely isolated host Agent context for the first round, then preserves that Reviewer's own review history across re-review rounds while never reading author private transcripts, unlisted materials, or unstated handoff records. If the host cannot provide such isolation and persistence, state the boundary and do not impersonate independence in the same context.
- Each Reviewer round receives only frozen handoff materials: the current full paper; authoritative LaTeX source and actual compiled output; explicit evidence and supplements; public venue requirements; necessary public related work; and explicit rebuttal, clarification, and change notes. Old, partial, missing-material, or cannot-judge submissions cannot count as passed.
- When the Reviewer does not recommend acceptance and the concern is valid with an in-mainline action, Auto continues method, experiment, analysis, source, figure, manuscript, or venue-facing work; after substantive change, resume the same isolated Reviewer for whole-paper re-review. If the concern is not valid, submit evidence-based clarification or rebuttal to that Reviewer; the author side must not self-declare passage.
- Reviewer and author-side judgments apply only to the current full manuscript and listed materials. After substantive changes, earlier recommendations are historical evidence, not current acceptance or current rejection.

#### Actions

- **review-handoff** (work): When preparing an independent Reviewer handoff, assemble only frozen materials for the current full-paper review: current full paper, authoritative LaTeX source and actual compiled output, explicit evidence or supplements, public venue requirements, necessary public related work, and explicit rebuttal, clarification, or change notes. Start a fresh genuinely isolated host Agent context for the first round and resume that same Reviewer's context for later rounds when the host actually provides isolation and persistence; otherwise report the boundary. The Reviewer is read-only and returns a natural-language whole-paper recommendation with scientific acceptability and delivery readiness separated.

#### Side-effect and authorization boundary

- Do not seek passage by cosmetic-only changes, selective evidence, hiding counterevidence, narrowing claims without scientific reason, diff-only review, or restarting/manipulating Reviewer context to escape prior objections.
- Do not claim independent external review, independent Reviewer status, or external acceptance unless a real isolated Reviewer context judged the current frozen handoff.

### Returned Review Import

Faithfully preserve a returned review in the corresponding Review document.

#### Responsibilities

- Append the actual reviewer return faithfully with a clear boundary from existing text; do not rewrite, summarize over, normalize, or invent severity, finding IDs, strict schema, or acceptance status.

#### Actions

- **research-document-maintenance** (work): When the user supplies an actual Reviewer return, clarification, rebuttal exchange, or asks to preserve a Direct Scientific Review self-check or independent handoff record, append it faithfully to the corresponding Review document with a clear boundary from existing text. Do not rewrite, summarize over, normalize, or replace the original return; add author interpretation only when the user asks. Update only the narrowest relevant research document. Update `.dove/research/reviews/REVIEWS.md` only when its own links or synthesis materially change. Update `.dove/research/RESEARCH.md` only for a project-level mainline, conclusion, navigation, or priority change. Maintain Dove research Markdown only when the user explicitly asks to record, update, or save Dove research context, the result clearly changes the research mainline, conclusion, decision, or priority, or preserving the work's evidence and continuation context is genuinely useful.

#### Side-effect and authorization boundary

- Import preserves the returned Markdown faithfully and does not automatically begin author response, revision, venue search, or paper search. Substantive response belongs to Rebuttal.

### Context Inspection

Read and report existing Review context without creating a new exchange.

#### Responsibilities

- Read only the review context needed for the question, report what is already present, and say naturally when a needed entry or link is absent.

#### Actions

- **research-document-reading** (read-only): When existing Dove research context would materially help the review work, read `.dove/research/RESEARCH.md`, then `.dove/research/reviews/REVIEWS.md`, then only directly relevant linked details. Otherwise work directly from the user's request and specified project materials. Do not recursively scan the research tree. If a needed entry or link is absent, say so naturally rather than inferring a database state. Read-only: do not create or modify files.
- **lesson-reading** (read-only): When reusable guidance may help the current task, read `.dove/research/RESEARCH.md` only when project context is needed, then `.dove/research/lessons/LESSONS.md` if it exists, then only directly relevant linked Lessons. If Lessons materials are absent, work without them. Treat Lessons as fallible advice, never as evidence or authority. Read-only: do not create or modify files.

#### Side-effect and authorization boundary

- Context inspection is read-only and does not create a new handoff, trigger external search, or mutate files.

### Downstream use

Review findings are advisory evidence for the caller. Auto must absorb them into its next scientific judgment; ordinary author-side response or revision belongs to Rebuttal, Draft, Experiment, Figure, or another explicitly requested capability.

#### Responsibilities

- Return findings with enough evidence and consequence for the caller to act on, reject with inspected evidence, bound or block on a real limit, or deliberately defer because another mainline action is more material.

#### Side-effect and authorization boundary

- Review itself ends after the selected critique, delivery inspection, handoff, import, or context report. It does not continue as author-side execution unless the user explicitly invoked Auto or requested another bounded work capability.

#### Non-goals

- Do not turn a Review finding, report, or recommendation into authority over the Workspace mainline or an implicit Auto session.

### Clarification

- Ask only when a material ambiguity blocks the work; otherwise continue with a reasonable interpretation.

### Conditional host guidance

- Use only tools that are actually available, approved, and appropriate in the current host and project. If a needed capability is unavailable, state that boundary and use any other approved material or action that can still advance the request.
- DSH adapters are project-local filesystem Skills. Use only DSH-exposed filesystem and tool affordances; do not claim Claude Code hooks, Monitor, Cron, tmux, MCP support, or background supervision unless DSH actually exposes an equivalent in the current run.
- Use DSH for independent Reviewer Handoff only if it actually provides equivalent isolated persistent Agent context; otherwise report the boundary and do not simulate independence.

## Dove capsule

- Dove remains one complete research agent using flat capability entrances, not separate personas.
- Use approved host tools directly; research Markdown is ordinary context, not a database.
- Stay objective and proportional: let evidence, risk, preferences, and the mainline decide the next action.
