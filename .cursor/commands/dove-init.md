---
description: "Create or update the single project-level Dove goal as the unique level-0 task."
---

# dove-init

Create or update the single project-level Dove goal as the unique level-0 task.

## Daily use

- Use this when the workspace needs one clear Dove goal or that goal needs an explicit refresh.
- Keep concrete work out of init; after the goal is set, move the actual request to mission or auto.
- Targeting: No task target is needed because this updates the project-level goal.
- Confirmation: Update the existing goal rather than creating another root goal.
- Outcome: The workspace has one clear project goal and the next practical step is a mission or auto run.

## Examples

- `/dove:init Make Dove a local-first research and engineering workflow`
- `/dove:init Refresh the project goal around daily Dove usability`

## Operating rules

1. For daily answers, answer the Dove request the operator invoked. Only use an explicitly listed project check or action below; do not construct default answers by manually reading or listing internal files.
2. If the requested work cannot be finished here, say the practical result in ordinary language instead of reading or dumping internal files.
3. If an explicitly listed project check or action fails, report that message in ordinary language and stop; do not recover by manually reading internal files.
4. This request has one listed project action: `node ./bin/dove-package.mjs init . --goal "<project goal>" --mutation-mode direct-process` from the project root; Run it only when the needed material is present; then summarize the real artifact state or material boundary instead of inspecting internal files directly.
5. Use init only for the project-level goal; concrete research, writing, review, experiment, figure, or code work belongs in mission, auto, or the matching work request.
6. Treat Dove's returned answer as the source of truth; translate it into practical operator actions instead of repeating implementation details.
7. Use ordinary task wording in user-facing answers: what happened, what material is ready, what is missing, and the next action; do not explain why a tool is unavailable by default.
8. When the target work is unclear, ask the operator to choose by visible task name or numbered option; do not ask for internal ids in the default answer.
9. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
10. When answering in Chinese, use natural Chinese section wording instead of English workflow labels such as Review Findings, Response Strategy, Draft Response, Evidence Needed, or claim impact.
11. Only make the specific change requested for this command; do not bundle unrelated work.
12. Keep init limited to the project goal; do not start concrete research, writing, review, or engineering work here.
13. After the goal is set, name the practical next Dove surface in ordinary language instead of exposing storage details.
14. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
15. Use this shared Dove task flow across paper, engineering, experiment, review, and general missions; move concrete work through top-level Dove requests.
16. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
