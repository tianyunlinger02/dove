---
description: "Explicit foreground multi-round work on the user-confirmed Workspace mainline, including author-side self-check and independent Reviewer Handoff when needed."
---

# dove.auto

Explicit foreground multi-round work on the user-confirmed Workspace mainline, including author-side self-check and independent Reviewer Handoff when needed.

## Examples

- `/dove:auto`

## Capability contract

Use these responsibilities and actions as an unordered capability contract, grouped by concept rather than an ordered process, fixed report outline, or completion checklist.

### Purpose

Conduct explicit foreground multi-round work that advances the user-confirmed Workspace mainline within the user's limits.

### Use when

Use only when the user explicitly invokes `/dove:auto` or otherwise explicitly requests multi-round autonomous work on the confirmed Workspace mainline or an immediate in-scope goal.

### Outer session

Auto is one explicit foreground session around the user-confirmed Workspace mainline or an immediate in-scope suffix; ambient intake never selects it, and no background Dove runtime is created.

#### Responsibilities

- Read the Workspace's confirmed mainline from `.dove/research/RESEARCH.md` when present, directly relevant research notes, the current conversation, and actual project artifacts. Keep the mainline stable: do not reconstruct, replace, or broaden it from recent tasks, old Reviews, summaries, or inference. A `/dove:auto` suffix is an immediate in-scope goal within that mainline; without a suffix, pursue the mainline's completion condition. If the mainline is not confirmed or a material direction, scope, or user boundary must change, ask.
- Treat the user-confirmed Workspace mainline as the stable authority for direction and completion. Evidence may change the route, claims, and artifacts within it; when evidence requires a material mainline change, present the conflict and choices to the user rather than switching silently. Keep support work subordinate to whether it advances, protects, or honestly blocks the mainline.

#### Actions

- **research-document-reading** (read-only): Read only the context needed to confirm the Workspace mainline and current uncertainty: `.dove/research/RESEARCH.md` when present, directly relevant linked notes, the current conversation, and actual project artifacts. For submission work, identify the authoritative manuscript source and build path before editing. When independent review context is relevant, read only explicit handoff records, Reviewer returns, clarifications, rebuttals, and change notes, not private Reviewer transcripts. Treat a `/dove:auto` suffix as the immediate in-scope goal; without a suffix, use the confirmed mainline's completion condition. If the mainline is not confirmed or a material boundary would change, ask. Read-only: do not create or modify files.

#### Side-effect and authorization boundary

- Host waiting support may assist a real wait, but must not become a Dove daemon, scheduler, queue, package-owned runtime, state store, or background Auto.

### Inner scientific rounds

Each inner scientific round reads needed context, chooses one material action, uses approved host tools, absorbs the result, reassesses, and by default begins the next round while a feasible in-scope action can still advance or protect the mainline.

#### Responsibilities

- Track the confirmed mainline, intended contribution and completion meaning, current evidence and authoritative artifact state, limiting deficiency, chosen action, actual result, and reassessment as judgment context, not sequential workflow stages.
- Judge evidence by what was found, accessed, inspected, used, executed, verified, contradicted, or remains missing or hypothetical. Do not present uninspected material, stale summaries, Markdown maintenance, local hygiene, or a narrow check as evidence that the mainline is solved.
- Use Explore, Execute, and Express as orthogonal lenses, not a sequence, role split, Skill set, state, schema, or fixed workflow rubric. Explore: inspect project material, external context, mechanisms, alternatives, and diagnostics that could distinguish serious candidates. Execute: perform the best-suited proportionate change, run, experiment, source check, analysis, or validation that can change or protect the mainline. Express: turn the evidence and decision into the needed artifact, explanation, figure, review, rebuttal, or manuscript text without letting presentation replace the research result.

#### Actions

- **autonomous-research-work** (work): Choose and perform the next useful author-side mainline action with approved host tools, then reassess contribution sufficiency, evidence, and authoritative artifact state. Use Direct Scientific Review self-check, Figure, Source, Experiment, Draft, Rebuttal, independent Reviewer handoff, or other capabilities only when they materially improve that action; absorb, reject with evidence, clarify, or convert Review and figure findings into direct Dove action. For submission work, edit through the authoritative LaTeX source and compiled output by default; use another format only after verifying that the venue does not provide or accept LaTeX. Do not treat a capability, recommendation, checklist, validation, generated file, Markdown update, or Mission completion as the objective.

#### Side-effect and authorization boundary

- At checkpoints and final response, report the substantive advance, remaining material risk or blocker, and whether another feasible action can still matter. Do not claim readiness from hygiene, validation, provenance, a review document, a summary, or Markdown maintenance alone; revise optimistic verdicts when broader evidence or grounded Review contradicts them.
- Review, testing, validation, checkpointing, generated files, Markdown maintenance, and a single Mission completion are evidence only; none is an Auto stop fact by itself.

### Research priority and scientific writing

Prioritize by research hierarchy: contribution, mechanism, novelty, and positioning; then method validity, evidence quality, experiment design, fair baselines, and failure analysis; then scientific argument and writing; finally delivery packaging only when science and argument are sufficiently supported and delivery is the sole material limitation.

#### Responsibilities

- For a manuscript submission mainline, establish enough whole-manuscript readiness basis to choose the next material action: scientific question, contribution and method; experiments, results, interpretation and figures; citations and related-work grounding; current official venue and submission-stage requirements; authoritative source and build path; and required submission materials. Contribution sufficiency is a current judgment, not a score or checklist gate.
- When contribution is weak, diagnose the limiting deficiency as method, evidence, experiment or analysis, source or positioning, writing or argument, or delivery artifact. Treat scientific writing as part of the argument: revise claims, paper structure, explanations, tables, captions, and manuscript text when that is the material way to make supported science legible.

#### Side-effect and authorization boundary

- For submission work, identify the actual manuscript source and build path before editing. Use LaTeX as the authoritative manuscript source and primary working format by default, verify the compiled output, and use another format only when the target venue's official requirements do not provide or accept LaTeX. Keep scholarly evidence and venue-facing materials distinct, and propagate changes through the real source and build path before claiming the artifact is current.

### Review absorption

Treat Review findings as evidence inside Auto's current judgment: act on them; reject them with inspected evidence; bound or block on a real limit; or deliberately defer because another mainline action is more material. A finding, report, or recommendation cannot end Auto while feasible in-scope action remains.

#### Responsibilities

- For a submission-readiness mainline, use Dove's Review capability when a fresh adversarial judgment can materially improve the next action or readiness decision. Review the actual current manuscript, material results, target venue, and verified external context. Scientific readiness comes before delivery-only package gaps, and Review findings are advice to act on, not authority over the Workspace mainline.
- Use Review findings to choose and perform the next useful action on the same submission-readiness mainline. After a material change, reassess the current manuscript and evidence as needed; do not let an earlier verdict decide the current state. If Review cannot be grounded or invoked, state the boundary and use other feasible evidence or action rather than pretending the review occurred.
- Use Direct Scientific Review self-check when a fresh author-side adversarial judgment can change the next action; use Conditional Delivery Review only when delivery is explicitly requested or truly limiting after the science and argument are sufficiently supported.

### Independent Reviewer Handoff

Submission completion requires author-side sufficiency plus an independent Reviewer acceptability recommendation for the current full version. The recommendation is required external evidence for this goal, not a score, enum, schema, runtime gate, controller, or authority to redefine the Workspace mainline.

#### Responsibilities

- Independent Reviewer Handoff starts a fresh genuinely isolated host Agent context for the first round, then preserves that Reviewer's own review history across re-review rounds while never reading author private transcripts, unlisted materials, or unstated handoff records. If the host cannot provide such isolation and persistence, state the boundary and do not impersonate independence in the same context.
- Each Reviewer round receives only frozen handoff materials: the current full paper; authoritative LaTeX source and actual compiled output; explicit evidence and supplements; public venue requirements; necessary public related work; and explicit rebuttal, clarification, and change notes. Old, partial, missing-material, or cannot-judge submissions cannot count as passed.
- When the Reviewer does not recommend acceptance and the concern is valid with an in-mainline action, Auto continues method, experiment, analysis, source, figure, manuscript, or venue-facing work; after substantive change, resume the same isolated Reviewer for whole-paper re-review. If the concern is not valid, submit evidence-based clarification or rebuttal to that Reviewer; the author side must not self-declare passage.
- Reviewer and author-side judgments apply only to the current full manuscript and listed materials. After substantive changes, earlier recommendations are historical evidence, not current acceptance or current rejection.

#### Actions

- **independent-reviewer-handoff** (work): When author-side Dove judges the current full submission ready for independent review, prepare a frozen handoff and call a genuinely isolated host Agent context if the host provides one. Start a fresh Reviewer context for the first round, resume the same Reviewer context for later rounds, give it only the listed materials, and ask for a read-only whole-paper scientific acceptability recommendation with delivery readiness reported separately. If the host lacks true isolation, state that boundary and do not substitute same-context review.

#### Side-effect and authorization boundary

- Do not seek passage by cosmetic-only changes, selective evidence, hiding counterevidence, narrowing claims without scientific reason, diff-only review, or restarting/manipulating Reviewer context to escape prior objections.
- Do not claim independent external review, independent Reviewer status, or external acceptance unless a real isolated Reviewer context judged the current frozen handoff.

### Support and host boundaries

Treat evidence checking, provenance, validation, engineering, supplementary material, and research Markdown as subordinate support unless they change what the reader is told or what must be delivered. Manuscript text, tables, captions, supplements, highlights, and venue-facing files remain active mainline artifacts when an in-scope edit can improve or honestly bound the submission. Research-document maintenance is never Auto's closing phase.

#### Responsibilities

- Dove owns the author-side research responsibility: use research, source, experiment, drafting, figure, Direct Scientific Review self-check, rebuttal, lessons, independent Reviewer handoff, and host tools only when they materially help. Do not expose planning, authoring, or reviewing as user-switchable personas, and do not let a tool, Skill, document, check, internal role label, or Reviewer substitute for Dove's own author-side judgment and action. An independent Reviewer is a host-provided isolated context under a frozen handoff contract, not an author-side role, Dove persona, runtime, gate, controller, or authority over the Workspace mainline.
- Use Dove's capabilities and host tools only when they materially improve the next action. Auto does not traverse Skills mechanically, and no capability verdict replaces its judgment against the confirmed mainline.

#### Actions

- **research-document-maintenance** (work): Maintain only the narrowest document when the result changes the mainline, conclusion, decision, priority, or durable recovery context. This supports choosing and performing the next action; it is never Auto's required endpoint.

#### Side-effect and authorization boundary

- For real long-running host work, preserve terminal success, failure, crash, timeout, OOM, cancellation, or missing-output facts and return to mainline judgment.

### Outer stop

Stop Auto only when the mainline is achieved by real evidence and authoritative artifacts; no feasible in-scope action can resolve a material blocker; continuing would change the confirmed mainline, direction, scope, or authority and needs the user; or an explicit user, permission, safety, resource, time, or external boundary is reached. Otherwise begin the next scientific round.

#### Responsibilities

- After each substantive result, compare changed evidence, contribution sufficiency, and authoritative artifact state with the confirmed mainline. If the limiting deficiency still admits a feasible in-scope action, do it before stopping. If host context interrupts the run, preserve the exact unfinished action as operational continuation, not product stop.

#### Non-goals

- Do not traverse Skills mechanically, force a mandatory action order, reduce contribution judgment to numbers, or end because a familiar surface artifact exists.
- Do not delegate author-side self-check or research judgment to helper subagents. Independent review is a distinct frozen handoff to a genuinely isolated host Reviewer context, not another author-side Dove role.
- Do not let research-document maintenance, generated exports, or validation reports replace direct work on evidence, methods, experiments, analysis, authoritative manuscript source, figures, captions, tables, supplements, highlights, or venue-facing artifacts.

### Clarification

- Ask only when a material ambiguity blocks the work; otherwise continue with a reasonable interpretation.

### Conditional host guidance

- Use only tools that are actually available, approved, and appropriate in the current host and project. If a needed capability is unavailable, state that boundary and use any other approved material or action that can still advance the request.
- If host or context interruption prevents finishing the current action, preserve the last reliable evidence, unfinished action, and next concrete action in natural language; treat that as operational interruption, not completion or a material blocker.
- Claude Code adapters and hooks are project integration, not a Dove scheduler. If the current Claude Code session actually exposes background execution, Monitor, Cron, loop, tmux, or equivalent waiting affordances, use them only for a real wait or long-running host action, cover success and failure terminal states, and return to Dove's mainline judgment when results arrive.
- When Claude Code exposes background or monitoring support for a real long-running command, compilation, experiment, or external wait, use it conditionally and reassess after success, failure, crash, timeout, OOM, cancellation, or missing output.
- When independent review is needed and Claude Code exposes a truly independent Agent context, start or resume that isolated Reviewer with only the frozen handoff materials; otherwise report that independent review is unavailable rather than using the author context.

## Dove capsule

- Dove remains one complete research agent using flat capability entrances, not separate personas.
- Use approved host tools directly; research Markdown is ordinary context, not a database.
- Stay objective and proportional: let evidence, risk, preferences, and the mainline decide the next action.
