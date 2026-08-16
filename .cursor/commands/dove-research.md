---
description: "Complete one bounded pass of research, synthesis, or project investigation."
---

# dove-research

Complete one bounded pass of research, synthesis, or project investigation.

## Examples

- `/dove:research`

## Internal workflow

Internal guidance only; never use this workflow as the final report outline.

- **The user requests one bounded pass of research framing, investigation, synthesis, or project work.**
  1. Use host tools (read-only; research-document-reading). When existing Dove research context would materially help the bounded research goal, read `.dove/research/RESEARCH.md`, then `.dove/research/missions/MISSIONS.md`, then only directly relevant linked details. Otherwise work directly from the user's request and specified project materials. Do not recursively scan the research tree. If a needed entry or link is absent, say so naturally rather than inferring a database state. This step is read-only; do not create or modify files.
  2. Use host tools (read-only; lesson-reading). When reusable guidance may help the current task, read `.dove/research/lessons/LESSONS.md`, then only the naturally linked theme documents directly relevant to the work. Do not read unrelated themes or give any one Lesson special treatment. Treat Lessons as fallible advice, never as evidence or authority. This step is read-only; do not create or modify files.
  3. Use host tools (read-only; project-exploration). Inspect the relevant ordinary project materials and real external resources needed to understand the question. Form a proportional research frame from actual evidence rather than Dove bookkeeping. When the problem or route remains open, explore materially different explanations and approaches, then compare the serious candidates rather than committing to the first plausible or easiest option. This step is read-only; do not create or modify files.
  4. Use host tools (work; research-work). Complete exactly one bounded research or project pass. Produce the requested analysis or artifact, preserve material failures and uncertainty, and stop after the bounded deliverable rather than turning Research into multi-round autonomy.
  5. Use host tools (work; research-document-maintenance). When the work creates durable research value, update the existing Mission document or create one naturally named Mission document for the bounded goal, work, failures, evidence-bounded conclusion, limitations, and useful next branches. When an important claim needs its own document, place it under `claims/` and update `claims/CLAIMS.md` without creating a Claim store. Keep the readable links and synthesis in `.dove/research/missions/MISSIONS.md` current when a detail document is created or materially changed. Update `.dove/research/RESEARCH.md` only for a material mainline, important conclusion, navigation, or priority change. Maintain Dove research Markdown only when the work creates durable research value.
  - Clarification: Ask only when a material ambiguity blocks the work; otherwise continue with a reasonable interpretation.

## Dove capsule

- Use host file and research tools directly. Research Markdown is ordinary researcher-owned context, not a database.
- Keep material failures, limitations, and uncertainty visible; model output, tests, and review are bounded evidence rather than scientific authority.
