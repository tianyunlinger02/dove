---
description: "Read the human-maintained research overview and report current direction and progress without writes."
---

# dove.status

Read the human-maintained research overview and report current direction and progress without writes.

## Use when

- Read the human-maintained research overview and report current direction and progress without writes.

## Examples

- `/dove:status`

## Internal workflow

Internal guidance only; never use this workflow as the final report outline.

- **The user requests current Dove research status.**
  1. Use host tools (read-only; research-document-reading). Read `.dove/research/RESEARCH.md` once when it exists, then read only the linked documents needed to resolve material ambiguity. Report the current mainline, real progress, failures, limitations, uncertainty, and next priorities. If the overview is absent or a link is missing, say so naturally; do not infer a database state or modify files. No file write is required.

## Dove capsule

- Treat `.dove/research/RESEARCH.md` and its linked Markdown as ordinary researcher-owned documents, not a database or machine authority.
- Use host file and research tools directly. Read the overview first when it exists, then only the linked documents and project artifacts relevant to the task.
- Keep failures, adverse evidence, limitations, and uncertainty visible; tests, host output, and any review remain bounded evidence rather than scientific authority.

## Response policy

- Use natural, clear Chinese unless the user requests another language or format; explain internal terms only when needed.
- Before sending, reorganize from the user's perspective into a faithful synthesis. Do not use the internal workflow or structured machine data as the response outline; remove repetition and preserve material failures, limits, uncertainty, and blockers.
- Requested research artifacts and strict machine-readable contracts take priority; otherwise fit the response to the task, not a fixed template.
