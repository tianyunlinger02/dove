---
description: "Use when the user asks where the research stands, without turning software health, receipts, or navigation into research progress."
argument-hint: "optional request, artifact path, venue, constraint, or follow-up context"
---

# dove.status

Use when the user asks where the research stands, without turning software health, receipts, or navigation into research progress.

## Request

$ARGUMENTS

## Examples

- `/dove:status`

## How Dove approaches this work

These are flexible research considerations, not a required order or report template. Named levels describe the relevant object's scope and evidence, not mandatory stages to complete.

### What this is for

Report where the research stands from the overview, relevant summaries, and directly needed linked context.

### When to use

Use when the user asks where the research stands, what is active, or what should be considered next.

### What Dove will examine

- Read only enough context to answer the status question.
- Report the current goal, substantive progress, active problems, and decisions. State the relevant object's named level only when existing materials support it, with its basis and important unknowns; otherwise leave the level undetermined. Mention next priorities when relevant to the question.
- Treat missing overviews, summaries, or links as ordinary document facts.

### Scope and changes

- For Status, only inspect and report; do not start validation or maintain documents to fill a missing level or evidence gap.

### Ways Dove may proceed

- Read `.dove/research/RESEARCH.md` when it exists, then only the summaries and linked details needed for the question. Use the visible conversation and only necessary current project materials to distinguish live work from durable research notes; report conflicts or stale notes without silently reconciling them. Do not infer the mainline from the latest Review or Run receipt alone. If an overview, summary, or link is absent, say so naturally and do not modify files.
- When existing Lessons could inspire current or subsequent work, improve judgment, expand the candidate space, or prevent repeated mistakes, read ".dove/research/lessons/LESSONS.md" if it exists, then the directly relevant or plausibly useful linked Lessons. Read ".dove/research/RESEARCH.md" first only when project context is still needed and it has not already been read in the active context. Reuse Lessons already read in the active context instead of rereading them mechanically. If Lessons materials are absent, work without them. Treat Lessons as fallible guidance, never as evidence.

### What this should not replace

- Do not use Status as a sync, Doctor, migration, or research-document maintenance command.
- Do not treat installed-file health, checks, run receipts, engineering receipts, or Markdown navigation as scientific progress.

### Using host tools

- Use only tools and materials that the current host exposes and current user/project permissions permit. If something needed is unavailable, name it and use any other available material or action that can still advance the request.
- Use Claude Code waiting or background affordances only for real long-running host actions, then return to Dove's mainline judgment when results arrive.

### Return with

- Inspected evidence, material change, and unresolved limits; include the next useful action only when it helps the current request.
