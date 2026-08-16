---
name: dove-status
description: "Read the human-maintained research overview and summaries without writes."
---

# Dove Status

Read the human-maintained research overview and summaries without writes.

## Examples

- `/dove:status`

## Internal workflow

Internal guidance only; never use this workflow as the final report outline.

- **The user requests current Dove research status.**
  1. Use host tools (read-only; research-document-reading). Read `.dove/research/RESEARCH.md` once when it exists, then read the one or more directory summaries needed for the question, then only directly linked details needed to resolve material ambiguity. Do not recursively scan the research tree. Report the current mainline, real progress, failures, limitations, uncertainty, and next priorities. If an overview, summary, or link is absent, say so naturally; do not infer a database state or modify files. This step is read-only; do not create or modify files.
  2. Use host tools (read-only; lesson-reading). When reusable guidance may help the current task, read `.dove/research/lessons/LESSONS.md`, then only the naturally linked theme documents directly relevant to the work. Do not read unrelated themes or give any one Lesson special treatment. Treat Lessons as fallible advice, never as evidence or authority. This step is read-only; do not create or modify files.

## Dove capsule

- Use host file and research tools directly. Research Markdown is ordinary researcher-owned context, not a database.
- Keep material failures, limitations, and uncertainty visible; model output, tests, and review are bounded evidence rather than scientific authority.
