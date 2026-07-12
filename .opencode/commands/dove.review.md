---
description: "Run a local evidence-aware review pass over selected task materials and produce concrete revision guidance."
---

# dove.review

Run a local evidence-aware review pass over selected task materials and produce concrete revision guidance.

## Daily use

- Use this for a local evidence-aware review pass over the selected task materials.
- Inspect concrete claims, sources, notes, drafts, experiments, figures, and recorded concerns; do not substitute a verdict label for review work.
- Use separate isolated or audio review only when the operator explicitly asks for that mode.
- Targeting: Resolve the review to one task and the exact materials being reviewed.
- Confirmation: If the target or reviewed material is unclear, ask for the material instead of guessing or falling back to a status panel.
- Outcome: The operator gets concrete findings, action items, missing evidence, or a coherent result backed by inspected materials.

## Examples

- `/dove.review Check whether the current draft is supported by evidence`
- `/dove.review Review the selected task materials before marking them done`

## Operating rules

1. For daily answers, answer the Dove request the operator invoked. Only use an explicitly listed project check or action below; do not construct default answers by manually reading or listing internal files.
2. If the requested work cannot be finished here, say the practical result in ordinary language instead of reading or dumping internal files.
3. If an explicitly listed project check or action fails, report that message in ordinary language and stop; do not recover by manually reading internal files.
4. This request has one listed project action: `node ./bin/dove-package.mjs review . --target "<task title>" --mutation-mode direct-process` from the project root; Run it only when the needed material is present; then summarize the real artifact state or material boundary instead of inspecting internal files directly.
5. Use this for local evidence-aware review; use separate isolated or audio review only when the operator explicitly asks for that mode.
6. Treat Dove's returned answer as the source of truth; translate it into practical operator actions instead of repeating implementation details.
7. Use ordinary task wording in user-facing answers: what happened, what material is ready, what is missing, and the next action; do not explain why a tool is unavailable by default.
8. When the target work is unclear, ask the operator to choose by visible task name or numbered option; do not ask for internal ids in the default answer.
9. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
10. When answering in Chinese, use natural Chinese section wording instead of English workflow labels such as Review Findings, Response Strategy, Draft Response, Evidence Needed, or claim impact.
11. Only make the specific change requested for this command; do not bundle unrelated work.
12. Inspect real project materials and report concrete review findings, action items, missing evidence, or a coherent result.
13. Do not substitute a status panel, task list, or verdict string for review work.
14. Use separate isolated or audio review only when the operator explicitly asks for that mode, and keep private writer/reviewer transcripts out of ordinary review replies.
15. Report review outcomes in plain language.
16. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
17. Use this shared Dove task flow across paper, engineering, experiment, review, and general missions; move concrete work through top-level Dove requests.
18. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
