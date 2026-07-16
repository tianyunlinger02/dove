---
description: "Read schema 7 mission and evidence integrity without refreshing state."
---

# dove.status

Read schema 7 mission and evidence integrity without refreshing state.

## Daily use

- Inspect current schema and integrity without writes.
- Expand details only when the operator explicitly asks.
- Targeting: Status aggregates real current artifacts across missions without selecting a task.
- Confirmation: No confirmation is applicable because status is read-only.
- Outcome: The operator sees current integrity and one safe next step.

## Examples

- `/dove.status`
- `/dove.status Show full mission integrity`

## Operating rules

1. For daily answers, answer the Dove request the operator invoked. Only use an explicitly listed project check or action below; do not construct default answers by manually reading or listing internal files.
2. If the requested work cannot be finished here, say the practical result in ordinary language instead of reading or dumping internal files.
3. If an explicitly listed project check or action fails, report that message in ordinary language and stop; do not recover by manually reading internal files.
4. This request has one listed project check: `node ./bin/dove-package.mjs status .`. Run it in the host's current working directory without changing directories or reinterpreting a parent repository as the target; `.` is the Dove workspace being operated on. Summarize its practical result instead of inspecting internal files directly.
5. Treat Dove's returned answer as the source of truth; translate it into practical operator actions instead of repeating implementation details.
6. Use ordinary task wording in user-facing answers: what happened, what material is ready, what is missing, and the next action; do not explain why a tool is unavailable by default.
7. When the target work is unclear, ask the operator to choose by visible task name or numbered option; do not ask for internal ids in the default answer.
8. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
9. When answering in Chinese, use natural Chinese section wording instead of English workflow labels such as Review Findings, Response Strategy, Draft Response, Evidence Needed, or claim impact.
10. Stay within this command's purpose and keep implementation details out of the default answer.
11. Absent state returns needs-init; malformed, legacy, contradictory, or future state fails closed.
12. Compact status reports only schema health, mission count, receipt count, source count, and live integrity.
13. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
14. Use this shared Dove task flow across paper, engineering, experiment, review, and general missions; move concrete work through top-level Dove requests.
15. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
