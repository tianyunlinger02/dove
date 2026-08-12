---
name: dove-review
description: "Prepare and preserve a user-managed independent review in one readable document."
---

# Dove Review

Prepare and preserve a user-managed independent review in one readable document.

## Use when

- Prepare and preserve a user-managed independent review in one readable document.

## Examples

- `/dove:review`

## Internal workflow

Internal guidance only; never use this workflow as the final report outline.

- **The user requests independent review preparation, import, or review-context inspection.**
  1. Use host tools (read-only; research-document-reading). If `.dove/research/RESEARCH.md` exists, read it first and follow only the most relevant Markdown links. If it is absent, treat that as normal and inspect ordinary project material instead. Do not require fixed headings, frontmatter, IDs, or a machine index. No file write is required.
  2. Use host tools (work; review-preparation). Select or create one readable Review Markdown. Record the review purpose, declared artifact paths, scope limits, rubric, and a self-contained prompt for a separate reviewer chosen and managed by the user. If exact version freezing matters, use an ordinary Git commit, versioned copy, or review bundle and link it; do not generate a Dove exchange ID or scientific hash. Persist only when: review-prepared.
  3. Use host tools (read-only; review-handoff). Return the declared files and prompt to the user. Never launch, impersonate, silently substitute, or certify the reviewer. No file write is required.
  4. Use host tools (work; research-document-maintenance). When the user supplies the actual return, append it faithfully to the same Review document together with limitations, author interpretation, and follow-up actions. Preserve the original reviewer content; do not require verdict, severity, finding IDs, or a strict import schema. Persist only when: research-context-worth-preserving.
  - Clarification: Explore first. Ask one brief clarification only if material ambiguity in the goal, boundary, or deliverable remains; otherwise continue within the requested boundary.

## Command guidance

- Review is a user-managed separate exchange recorded in one readable document. Dove never launches, impersonates, or certifies the reviewer.

## Dove capsule

- Treat `.dove/research/RESEARCH.md` and its linked Markdown as ordinary researcher-owned documents, not a database or machine authority.
- Use host file and research tools directly. Read the overview first when it exists, then only the linked documents and project artifacts relevant to the task.
- Keep failures, adverse evidence, limitations, and uncertainty visible; tests, host output, and any review remain bounded evidence rather than scientific authority.

## Response policy

- Use natural, clear Chinese unless the user requests another language or format; explain internal terms only when needed.
- Before sending, reorganize from the user's perspective into a faithful synthesis. Do not use the internal workflow or structured machine data as the response outline; remove repetition and preserve material failures, limits, uncertainty, and blockers.
- Requested research artifacts and strict machine-readable contracts take priority; otherwise fit the response to the task, not a fixed template.
