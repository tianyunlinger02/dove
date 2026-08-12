---
description: "Conduct explicit high-autonomy multi-round research within the documented current mainline."
---

# dove.auto

Conduct explicit high-autonomy multi-round research within the documented current mainline.

## Use when

- Conduct explicit high-autonomy multi-round research within the documented current mainline.

## Examples

- `/dove.auto`

## Internal workflow

Internal guidance only; never use this workflow as the final report outline.

- **The user explicitly invokes high-autonomy multi-round research.**
  1. Use host tools (read-only; research-document-reading). Require an existing `.dove/research/RESEARCH.md`, read its current mainline and linked work, and reground from the actual project. If the overview is absent, materially incomplete, or evidence says the mainline must change, write a recommendation as an ordinary project artifact, report the block, and stop. No file write is required.
  2. Use host tools (read-only; lesson-reading). Read `.dove/research/LESSONS.md` when present and treat it as fallible guidance, never as evidence or authority. No file write is required.
  3. Use host tools (read-only; project-exploration). Deeply explore relevant code, data, results, drafts, figures, constraints, and external sources. Build an evidence-aware frame covering competing explanations, counterfactuals, baselines, discriminating actions, and current claim boundaries. No file write is required.
  4. Use host tools (work; autonomous-research-work). Let Planner and Builder/Author coordinate autonomously, using subagents when useful. Repeatedly choose and perform the feasible action with the highest expected research value, including retrieval, analysis, code, writing, figures, validation, and experiments. No file write is required.
  5. Use host tools (work; experiment-work). For every selected experiment, write or extend one experiment Markdown document with the prospective plan before execution. Then execute with host tools and append actual procedure, results, failures, denominator accounting, deviations, limitations, uncertainty, and implications to that same document. Persist only when: selected-experiment.
  6. Use host tools (work; review-handoff). When independent review is a true dependency, prepare one readable Review document and return the declared artifacts and prompt to the user for a separate reviewer they manage. Do not launch, impersonate, or fabricate the reviewer; stop if the unavailable return blocks progress. Persist only when: review-needed.
  7. Use host tools (work; research-document-maintenance). After each material round, update the relevant topic document. Keep `RESEARCH.md` concise and update it only for material mainline, conclusion, document-link, or priority changes. Preserve adverse evidence instead of overwriting history with a success narrative. Persist only when: research-context-worth-preserving.
  8. Use host tools (read-only; research-synthesis). Continue without a default round count until the goal is achieved, the user budget ends, no feasible action has positive expected research value, a safety or mainline boundary is reached, or a required Review return is unavailable. Report the evidence-bounded result without claiming scientific authority. No file write is required.
  - Clarification: Explore first. Ask one brief clarification only if material ambiguity in the goal, boundary, or deliverable remains; otherwise continue within the requested boundary.

## Dove capsule

- Treat `.dove/research/RESEARCH.md` and its linked Markdown as ordinary researcher-owned documents, not a database or machine authority.
- Use host file and research tools directly. Read the overview first when it exists, then only the linked documents and project artifacts relevant to the task.
- Keep failures, adverse evidence, limitations, and uncertainty visible; tests, host output, and any review remain bounded evidence rather than scientific authority.

## Response policy

- Use natural, clear Chinese unless the user requests another language or format; explain internal terms only when needed.
- Before sending, reorganize from the user's perspective into a faithful synthesis. Do not use the internal workflow or structured machine data as the response outline; remove repetition and preserve material failures, limits, uncertainty, and blockers.
- Requested research artifacts and strict machine-readable contracts take priority; otherwise fit the response to the task, not a fixed template.
