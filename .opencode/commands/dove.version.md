---
description: "Create a direction-change point and clear active non-init work with confirmation."
---

# dove.version

Create a direction-change point and clear active non-init work with confirmation.

## Daily use

- Use this when the project direction changes enough that active non-root work should be cleared.
- Treat it as a direction reset, not as a general undo command.
- Targeting: Operates on the current workspace direction and active tasks.
- Confirmation: Require a reason before clearing active work.
- Outcome: A direction reset stores the old direction, clears active non-root work, and points the next step at a fresh mission.

## Examples

- `/dove.version Change direction to focus on result-card usability`
- `/dove.version Reset active tasks after a major project direction change`

## Operating rules

1. For daily answers, answer the Dove request the operator invoked. Only use an explicitly listed project check below; do not construct default answers by manually reading or listing internal files.
2. If the requested work cannot be finished here, say the practical result in ordinary language instead of reading or dumping internal files.
3. If an explicitly listed project check fails, report that message in ordinary language and stop; do not recover by manually reading internal files.
4. This request has no listed project check. Do not run status, `node ./bin/dove.mjs version --help`, the matching local surface, or any other unlisted command for it. If the target is unclear, ask the operator to choose from visible context. If this chat cannot finish the requested work directly, answer with what material is ready, what has not been added to the task, and the next user choice; do not explain why the tool is unavailable.
5. Treat Dove's returned answer as the source of truth; translate it into practical operator actions instead of repeating implementation details.
6. Use ordinary task wording in user-facing answers: what happened, what material is ready, what is missing, and the next action; do not explain why a tool is unavailable by default.
7. When the target work is unclear, ask the operator to choose by visible task name or numbered option; do not ask for internal ids in the default answer.
8. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
9. When answering in Chinese, use natural Chinese section wording instead of English workflow labels such as Review Findings, Response Strategy, Draft Response, Evidence Needed, or claim impact.
10. Only make the specific change requested for this command; do not bundle unrelated work.
11. Treat this as a direction reset, not as a general undo command.
12. Require a short reason before clearing active work.
13. Preserve the project goal and reusable lessons, then point the operator to the next mission.
14. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
15. Use this shared Dove task flow across paper, engineering, experiment, review, and general missions; move concrete work through top-level Dove requests.
16. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
