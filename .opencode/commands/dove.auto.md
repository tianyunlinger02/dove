---
description: "Conduct explicit high-autonomy multi-round research within the documented current mainline."
---

# dove.auto

Conduct explicit high-autonomy multi-round research within the documented current mainline.

## Examples

- `/dove.auto`

## Internal workflow

Internal guidance only; never use this workflow as the final report outline.

- **The user explicitly invokes high-autonomy multi-round research.**
  1. Use host tools (read-only; research-document-reading). Require an existing `.dove/research/RESEARCH.md`, read its current mainline, then read the summary for the current work type and only directly relevant linked details. Do not recursively scan all research files. If the overview is absent, materially incomplete, or evidence says the mainline must change, report that boundary and stop before autonomous work. This step is read-only; do not create or modify files.
  2. Use host tools (work; mainline-boundary-recommendation). When that boundary blocks Auto, create a concise ordinary project recommendation only if the user requested a saved artifact; otherwise return the recommendation directly without changing the research mainline.
  3. Use host tools (read-only; lesson-reading). When reusable guidance may help the current task, read `.dove/research/lessons/LESSONS.md`, then only the naturally linked theme documents directly relevant to the work. Do not read unrelated themes or give any one Lesson special treatment. Treat Lessons as fallible advice, never as evidence or authority. This step is read-only; do not create or modify files.
  4. Use host tools (read-only; project-exploration). Deeply explore relevant code, data, results, drafts, figures, constraints, and external sources. Build an evidence-aware frame covering competing explanations, counterfactuals, baselines, discriminating actions, and current claim boundaries. This step is read-only; do not create or modify files.
  5. Use host tools (work; autonomous-research-work). Let Planner and Builder/Author coordinate autonomously, using subagents when useful. Repeatedly choose and perform the feasible action with the highest expected research value, including retrieval, analysis, code, writing, figures, validation, and experiments. When theory and evidence conflict, reconsider the theory, the experiment, and the route itself; choose the next action that best clarifies the disagreement instead of assuming more experiments are needed.
  6. Use host tools (work; experiment-work). For a selected experiment, write or extend one naturally named document under `experiments/` with the prospective plan before execution. Then execute with host tools, append the actual procedure, result, material failures or deviations, and interpretation to that same document, and update `experiments/EXPERIMENTS.md`.
  7. Use host tools (work; review-handoff). When user-managed separate review is a true dependency, prepare one readable document under `reviews/`, update `reviews/REVIEWS.md`, and return the declared artifacts and prompt to the user for a separate reviewer they manage. Do not launch, impersonate, or fabricate the reviewer; stop if the unavailable return blocks progress.
  8. Use host tools (work; research-document-maintenance). When a round produces durable new evidence, a useful conclusion, a material failure, a decision, or a direction change, update the relevant naturally named topic document and its directory summary. Do not interrupt ordinary exploration merely to log a round. Keep `RESEARCH.md` concise and update it only for material mainline, conclusion, document-link, or priority changes. Preserve adverse evidence instead of overwriting history with a success narrative. Maintain Dove research Markdown only when the work creates durable research value.
  9. Use host tools (read-only; research-synthesis). Continue without a default round count until the goal is achieved, the user budget ends, no feasible action has positive expected research value, a safety or mainline boundary is reached, or a required Review return is unavailable. Report the evidence-bounded result without claiming scientific authority. This step is read-only; do not create or modify files.
  - Clarification: Ask only when a material ambiguity blocks the work; otherwise continue with a reasonable interpretation.

## Dove capsule

- Use host file and research tools directly. Research Markdown is ordinary researcher-owned context, not a database.
- Keep material failures, limitations, and uncertainty visible; model output, tests, and review are bounded evidence rather than scientific authority.
