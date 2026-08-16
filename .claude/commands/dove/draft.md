---
description: "Write or revise ordinary project drafts from the available evidence."
---

# dove.draft

Write or revise ordinary project drafts from the available evidence.

## Examples

- `/dove:draft`

## Internal workflow

Internal guidance only; never use this workflow as the final report outline.

- **The user requests drafting or revision of an ordinary project artifact.**
  1. Use host tools (read-only; research-document-reading). When existing Dove research context would materially help the draft and its material claims, read `.dove/research/RESEARCH.md`, then `.dove/research/claims/CLAIMS.md`, then only directly relevant linked details. Otherwise work directly from the user's request and specified project materials. Do not recursively scan the research tree. If a needed entry or link is absent, say so naturally rather than inferring a database state. This step is read-only; do not create or modify files.
  2. Use host tools (read-only; lesson-reading). When reusable guidance may help the current task, read `.dove/research/lessons/LESSONS.md`, then only the naturally linked theme documents directly relevant to the work. Do not read unrelated themes or give any one Lesson special treatment. Treat Lessons as fallible advice, never as evidence or authority. This step is read-only; do not create or modify files.
  3. Use host tools (work; artifact-editing). Read the target and relevant project evidence, then create or revise the ordinary draft artifact with host editing tools. Keep every claim within the available evidence and retain material counter-evidence and uncertainty.
  4. Use host tools (read-only; artifact-validation). Run appropriate host-native validation and report remaining unsupported claims, citation gaps, and uncertainty. This step is read-only; do not create or modify files.
  5. Use host tools (work; research-document-maintenance). Create or revise a naturally named Claim document under `claims/` only when a material claim and its support, counter-evidence, missing evidence, or cannot-say boundary deserves durable treatment. Do not build a Claim database. Keep the readable links and synthesis in `.dove/research/claims/CLAIMS.md` current when a detail document is created or materially changed. Update `.dove/research/RESEARCH.md` only for a material mainline, important conclusion, navigation, or priority change. Maintain Dove research Markdown only when the work creates durable research value.
  - Clarification: Ask only when a material ambiguity blocks the work; otherwise continue with a reasonable interpretation.

## Dove capsule

- Use host file and research tools directly. Research Markdown is ordinary researcher-owned context, not a database.
- Keep material failures, limitations, and uncertainty visible; model output, tests, and review are bounded evidence rather than scientific authority.
