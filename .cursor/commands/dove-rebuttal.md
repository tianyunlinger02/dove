---
description: "Perform author-side rebuttal and revision from actual review findings and evidence."
---

# dove-rebuttal

Perform author-side rebuttal and revision from actual review findings and evidence.

## Examples

- `/dove:rebuttal`

## Internal workflow

Internal guidance only; never use this workflow as the final report outline.

- **The user requests author-side rebuttal or revision from review findings.**
  1. Use host tools (read-only; research-document-reading). When existing Dove research context would materially help the relevant returned review, read `.dove/research/RESEARCH.md`, then `.dove/research/reviews/REVIEWS.md`, then only directly relevant linked details. Otherwise work directly from the user's request and specified project materials. Do not recursively scan the research tree. If a needed entry or link is absent, say so naturally rather than inferring a database state. This step is read-only; do not create or modify files.
  2. Use host tools (read-only; lesson-reading). When reusable guidance may help the current task, read `.dove/research/lessons/LESSONS.md`, then only the naturally linked theme documents directly relevant to the work. Do not read unrelated themes or give any one Lesson special treatment. Treat Lessons as fallible advice, never as evidence or authority. This step is read-only; do not create or modify files.
  3. Use host tools (work; rebuttal-and-revision). Read the relevant Review document and actual artifacts. Analyze each material finding against the evidence, write the response, and make requested ordinary project revisions. This remains Builder/Author work rather than a separate review return.
  4. Use host tools (read-only; artifact-validation). Validate that each response maps to a real finding and that revisions do not overstate evidence or erase failures and uncertainty. This step is read-only; do not create or modify files.
  5. Use host tools (work; research-document-maintenance). Append the author response, revisions, resulting decisions, unresolved issues, and follow-up to the same Review document or the directly affected research document when that context is worth preserving. Keep the readable links and synthesis in `.dove/research/reviews/REVIEWS.md` current when a detail document is created or materially changed. Update `.dove/research/RESEARCH.md` only for a material mainline, important conclusion, navigation, or priority change. Maintain Dove research Markdown only when the work creates durable research value.
  - Clarification: Ask only when a material ambiguity blocks the work; otherwise continue with a reasonable interpretation.

## Dove capsule

- Use host file and research tools directly. Research Markdown is ordinary researcher-owned context, not a database.
- Keep material failures, limitations, and uncertainty visible; model output, tests, and review are bounded evidence rather than scientific authority.
