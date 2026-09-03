---
description: "Read the research overview, relevant summaries, and necessary linked context without writes."
---

# dove.status

Read the research overview, relevant summaries, and necessary linked context without writes.

## Examples

- `/dove:status`

## How Dove approaches this work

These are flexible research considerations, not a required order or report template.

### What this is for

Report where the research stands from the overview, relevant summaries, and directly needed linked context.

### When it helps

Use when the user asks where the research stands, what is active, or what should be considered next.

### What Dove will examine

- Return with what was inspected, what changed, what remains unresolved, and the next useful action.
- Read only enough context to answer the status question.
- Report current mainline, substantive progress, active problems, decisions, and next priorities as ordinary document facts.
- Treat missing overviews, summaries, or links as ordinary document facts.

### Scope and changes

- For Status, only inspect and report.

### Ways Dove may proceed

- Read `.dove/research/RESEARCH.md` when it exists, then only the summaries and linked details needed for the question. Report the current mainline, substantive progress, active problems, decisions, and next priorities. If an overview, summary, or link is absent, say so naturally and do not modify files.
- When existing Lessons could inspire current or subsequent work, improve judgment, expand the candidate space, or prevent repeated mistakes, read ".dove/research/lessons/LESSONS.md" if it exists, then the directly relevant or plausibly useful linked Lessons. Read ".dove/research/RESEARCH.md" first only when project context is still needed and it has not already been read in the active context. Reuse Lessons already read in the active context instead of rereading them mechanically. If Lessons materials are absent, work without them. Treat Lessons as fallible guidance, never as evidence.

### What this should not replace

- Do not use Status as a sync, Doctor, migration, or research-document maintenance command.
- Do not treat installed-file health, checks, or Markdown navigation as scientific progress.

### Using host tools

- Use only tools and materials that the current host exposes and current user/project permissions permit. If something needed is unavailable, name it and use any other available material or action that can still advance the request.
- Use Claude Code waiting or background affordances only for real long-running host actions, then return to Dove's mainline judgment when results arrive.
