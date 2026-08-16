---
name: dove-review
description: "Prepare, import, or inspect a user-managed review in one readable document."
---

# Dove Review

Prepare, import, or inspect a user-managed review in one readable document.

## Examples

- `/dove:review`

## Internal workflow

Internal guidance only; never use this workflow as the final report outline.

- **The user requests user-managed separate review preparation, import, or review-context inspection.**
  1. Use host tools (read-only; research-document-reading). When existing Dove research context would materially help the review exchange, read `.dove/research/RESEARCH.md`, then `.dove/research/reviews/REVIEWS.md`, then only directly relevant linked details. Otherwise work directly from the user's request and specified project materials. Do not recursively scan the research tree. If a needed entry or link is absent, say so naturally rather than inferring a database state. This step is read-only; do not create or modify files.
  2. Use host tools (read-only; lesson-reading). When reusable guidance may help the current task, read `.dove/research/lessons/LESSONS.md`, then only the naturally linked theme documents directly relevant to the work. Do not read unrelated themes or give any one Lesson special treatment. Treat Lessons as fallible advice, never as evidence or authority. This step is read-only; do not create or modify files.
  3. Use host tools (work; review-preparation). Follow the user's actual Review request. To prepare a new review, select or create one naturally named Review Markdown under `reviews/` and record the purpose, relevant project-relative artifact paths, scope limits, useful rubric, and a self-contained prompt for a separate reviewer chosen and managed by the user. If exact version freezing matters, use an ordinary Git commit, versioned copy, or review bundle and link it. To import a returned review, locate the corresponding Review document and preserve the supplied return faithfully without reconstructing preparation. To inspect existing review context, read and report it without creating a new Review document.
  4. Use host tools (read-only; review-handoff). Only when preparing a new review, return the relevant files and self-contained prompt to the user. Do not launch or substitute for the separate reviewer. When importing or inspecting, do not create a new handoff. This step is read-only; do not create or modify files.
  5. Use host tools (work; research-document-maintenance). When the user supplies an actual reviewer return, append it faithfully to the corresponding Review document with a clear boundary from existing text. Do not rewrite, summarize over, or normalize the original return, and do not require verdict, severity, finding IDs, or a strict schema. Add author interpretation only when the user asks for it; use Rebuttal for substantive response, revision, and follow-up work. Keep the readable links and synthesis in `.dove/research/reviews/REVIEWS.md` current when a detail document is created or materially changed. Update `.dove/research/RESEARCH.md` only for a material mainline, important conclusion, navigation, or priority change. Maintain Dove research Markdown only when the work creates durable research value.
  - Clarification: Ask only when a material ambiguity blocks the work; otherwise continue with a reasonable interpretation.

## Command guidance

- Review is a user-managed separate exchange recorded in one readable document. Dove never launches, impersonates, or certifies the reviewer.

## Dove capsule

- Use host file and research tools directly. Research Markdown is ordinary researcher-owned context, not a database.
- Keep material failures, limitations, and uncertainty visible; model output, tests, and review are bounded evidence rather than scientific authority.
