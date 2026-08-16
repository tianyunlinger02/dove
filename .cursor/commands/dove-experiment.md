---
description: "Design, execute, analyze, or honestly record an experiment from real evidence."
---

# dove-experiment

Design, execute, analyze, or honestly record an experiment from real evidence.

## Examples

- `/dove:experiment`

## Internal workflow

Internal guidance only; never use this workflow as the final report outline.

- **The user requests experiment design, execution, analysis, or recording.**
  1. Use host tools (read-only; research-document-reading). When existing Dove research context would materially help the experiment, read `.dove/research/RESEARCH.md`, then `.dove/research/experiments/EXPERIMENTS.md`, then only directly relevant linked details. Otherwise work directly from the user's request and specified project materials. Do not recursively scan the research tree. If a needed entry or link is absent, say so naturally rather than inferring a database state. This step is read-only; do not create or modify files.
  2. Use host tools (read-only; lesson-reading). When reusable guidance may help the current task, read `.dove/research/lessons/LESSONS.md`, then only the naturally linked theme documents directly relevant to the work. Do not read unrelated themes or give any one Lesson special treatment. Treat Lessons as fallible advice, never as evidence or authority. This step is read-only; do not create or modify files.
  3. Use host tools (work; experiment-design). Follow the user's actual experiment request. For a new experiment that will be executed, first choose or create one naturally named Experiment document under `experiments/` and write what it tests and how the result will be judged. For design-only work, produce an executable plan and stop before execution. For analysis of existing results, inspect and analyze those results directly. For retrospective recording, label it honestly as retrospective rather than presenting it as a prospective plan.
  4. Use host tools (work; experiment-execution). Execute only when the request calls for execution. Use normal host tools and append the actual procedure and result, material failures or deviations, denominator accounting, and interpretation evidence to the same Experiment document used for the prospective plan. For analysis-only or retrospective work, preserve the actual provenance and do not invent an execution step.
  5. Use host tools (work; research-document-maintenance). Record what the design, execution, analysis, or retrospective evidence supports and cannot establish in the relevant Experiment document when that context is worth preserving. Preserve failures, limitations, and uncertainty rather than normalizing the document into a fixed template. Keep the readable links and synthesis in `.dove/research/experiments/EXPERIMENTS.md` current when a detail document is created or materially changed. Update `.dove/research/RESEARCH.md` only for a material mainline, important conclusion, navigation, or priority change. Maintain Dove research Markdown only when the work creates durable research value.
  - Clarification: Ask only when a material ambiguity blocks the work; otherwise continue with a reasonable interpretation.

## Dove capsule

- Use host file and research tools directly. Research Markdown is ordinary researcher-owned context, not a database.
- Keep material failures, limitations, and uncertainty visible; model output, tests, and review are bounded evidence rather than scientific authority.
