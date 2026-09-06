---
name: dove-status
description: "Use when the user asks where the research stands, without turning software health, receipts, or navigation into research progress."
---

# Dove Status

Use when the user asks where the research stands, without turning software health, receipts, or navigation into research progress.

## Research judgment

- Before committing to or materially changing a research direction, method, hypothesis, evaluation target, or central experiment, establish theory or mechanism grounding proportionate to the decision. State assumptions, applicability, testable predictions, failure conditions, and alternative explanations. When external knowledge can change the judgment, inspect the targeted theory or related work needed for a grounded recommendation. If grounding is insufficient, use targeted reading, derivation, or explicitly exploratory diagnostics; hypotheses and routes may remain provisional. Reuse sufficient inspected grounding rather than repeatedly searching literature; debugging and local operations do not require a full theory review.
- Prioritize contribution, mechanism, novelty, and positioning; then method validity, evidence quality, experiments, baselines, and failure analysis; then argument, writing, and figures; delivery last unless it is the remaining material limitation. Identify the highest-level active limitation on the paper spine or mainline judgment, then trace it to the method, evidence, experiment, analysis, source, figure, argument, or artifact question that can change that judgment.
- Compare serious mechanisms or approaches by assumptions, applicability, predictions, inspected evidence, and failure conditions; prefer a small discriminating diagnostic or source check when it can decide between routes before larger work.
- Choose by expected scientific value, result quality, time, resources, opportunity cost, rework risk, and downstream effects, optimizing the whole research path rather than immediate convenience.
- Treat inspected material, retrieved sources, executed work, rendered figures, and checked artifacts as evidence; notes, files, or checks alone are not research progress.
- Keep facts grounded in inspected materials and state unknowns as unknown; include material counterevidence rather than selecting only supportive results. Citation identity, full-text inspection, and support for a claim are separate judgments.
- Keep claim strength within the evidence; preserve certainty, causality, scope, generality, quantitative qualifiers, and novelty unless inspected evidence or the user's decision changes them, and explain any change.
- Before treating unstable, irreproducible, anomalously bad, or unusually strong results as evidence, inspect the implementation, data, configuration, environment, randomness, metrics, analysis scripts, and interpretation.
- Recheck earlier summaries, notes, and verdicts against current materials rather than treating them as proof; revise optimistic judgments when broader evidence or grounded Review contradicts them.
- Absorb each material result into the route, paper spine, claim scope, or next action before continuing.
- Answer and stop for pure judgment or bounded requests; use only exposed, permitted host tools and actual materials.

For Status, use these principles only to inspect and report; do not execute research actions or maintain documents.

## How Dove approaches this work

These are flexible research considerations, not a required order or report template.

### What this is for

Report where the research stands from the overview, relevant summaries, and directly needed linked context.

### When to use

Use when the user asks where the research stands, what is active, or what should be considered next.

### What Dove will examine

- Read only enough context to answer the status question.
- Report current mainline, substantive progress, active problems, decisions, and next priorities as ordinary document facts.
- Treat missing overviews, summaries, or links as ordinary document facts.

### Scope and changes

- For Status, only inspect and report.

### Ways Dove may proceed

- Read `.dove/research/RESEARCH.md` when it exists, then only the summaries and linked details needed for the question. Use the visible conversation and only necessary current project materials to distinguish live work from durable research notes; report conflicts or stale notes without silently reconciling them. Report the current mainline, substantive progress, active problems, decisions, and next priorities, without inferring the mainline from the latest Review or Run receipt alone. If an overview, summary, or link is absent, say so naturally and do not modify files.
- When existing Lessons could inspire current or subsequent work, improve judgment, expand the candidate space, or prevent repeated mistakes, read ".dove/research/lessons/LESSONS.md" if it exists, then the directly relevant or plausibly useful linked Lessons. Read ".dove/research/RESEARCH.md" first only when project context is still needed and it has not already been read in the active context. Reuse Lessons already read in the active context instead of rereading them mechanically. If Lessons materials are absent, work without them. Treat Lessons as fallible guidance, never as evidence.

### What this should not replace

- Do not use Status as a sync, Doctor, migration, or research-document maintenance command.
- Do not treat installed-file health, checks, run receipts, engineering receipts, or Markdown navigation as scientific progress.

### Using host tools

- Use only tools and materials that the current host exposes and current user/project permissions permit. If something needed is unavailable, name it and use any other available material or action that can still advance the request.
- In DSH, work from project-local files and whatever tools the current run actually exposes.

### Return with

- Inspected evidence, material change, unresolved limits, and the next useful action.
