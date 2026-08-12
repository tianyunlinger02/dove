---
description: "Plan and execute a real experiment while keeping plan and result in one document."
---

# dove.experiment

Plan and execute a real experiment while keeping plan and result in one document.

## Use when

- Plan and execute a real experiment while keeping plan and result in one document.

## Examples

- `/dove.experiment`

## Internal workflow

Internal guidance only; never use this workflow as the final report outline.

- **The user requests experiment design, execution, analysis, or recording.**
  1. Use host tools (read-only; research-document-reading). If `.dove/research/RESEARCH.md` exists, read it first and follow only the most relevant Markdown links. If it is absent, treat that as normal and inspect ordinary project material instead. Do not require fixed headings, frontmatter, IDs, or a machine index. No file write is required.
  2. Use host tools (work; experiment-design). Select or create one readable experiment Markdown document. Before execution, write why the experiment matters, hypotheses or competing explanations, protocol, inputs, comparisons, metrics, discriminating observations, stop conditions, expected artifacts, cost, risk, and failure value. Do not execute first and reconstruct the plan afterward. Persist only when: experiment-selected.
  3. Use host tools (work; experiment-execution). Execute the written plan with normal host tools. Append actual execution, raw artifact paths, observations, positive, negative, null, mixed, failed or stopped outcomes, denominator accounting, exclusions, deviations, unexpected observations, limitations, and uncertainty to the same document. Persist only when: experiment-executed.
  4. Use host tools (work; research-document-maintenance). Explain in that experiment document what the result supports, weakens, leaves unresolved, and cannot establish. Update `RESEARCH.md` only when the result materially changes the mainline, important conclusions, linked work, or next priority. Persist only when: research-context-worth-preserving.
  - Clarification: Explore first. Ask one brief clarification only if material ambiguity in the goal, boundary, or deliverable remains; otherwise continue within the requested boundary.

## Dove capsule

- Treat `.dove/research/RESEARCH.md` and its linked Markdown as ordinary researcher-owned documents, not a database or machine authority.
- Use host file and research tools directly. Read the overview first when it exists, then only the linked documents and project artifacts relevant to the task.
- Keep failures, adverse evidence, limitations, and uncertainty visible; tests, host output, and any review remain bounded evidence rather than scientific authority.

## Response policy

- Use natural, clear Chinese unless the user requests another language or format; explain internal terms only when needed.
- Before sending, reorganize from the user's perspective into a faithful synthesis. Do not use the internal workflow or structured machine data as the response outline; remove repetition and preserve material failures, limits, uncertainty, and blockers.
- Requested research artifacts and strict machine-readable contracts take priority; otherwise fit the response to the task, not a fixed template.
