---
description: "Inspect or record global and task-bound lessons that future Dove work must obey."
---

# dove.lessons

Inspect or record global and task-bound lessons that future Dove work must obey.

## Daily use

- Use this when a closed task yields reusable guidance that future Dove work should obey.
- Keep lesson entries explicit and short: problem, decision, pitfall, validation, and next-time guidance.
- Targeting: Can add global lessons or bind a lesson to a selected task.
- Confirmation: When task binding is ambiguous, show task choices and wait for the operator.
- Outcome: Applicable lessons are recalled later as standing guidance without importing raw traces or adding new lessons implicitly.

## Examples

- `/dove.lessons Add that status should not show completed or killed mission lists`
- `/dove.lessons Show lessons that apply to the selected task`

## Operating rules

1. For daily answers, answer the Dove request the operator invoked. Only use an explicitly listed project check below; do not construct default answers by manually reading or listing internal files.
2. If the requested work cannot be finished here, say the practical result in ordinary language instead of reading or dumping internal files.
3. If an explicitly listed project check fails, report that message in ordinary language and stop; do not recover by manually reading internal files.
4. This request has no listed project check. Do not run status, `node ./bin/dove.mjs lessons --help`, the matching local surface, or any other unlisted command for it. If the target is unclear, ask the operator to choose from visible context. If this chat cannot finish the requested work directly, answer with what material is ready, what has not been added to the task, and the next user choice; do not explain why the tool is unavailable.
5. Treat Dove's returned answer as the source of truth; translate it into practical operator actions instead of repeating implementation details.
6. Use ordinary task wording in user-facing answers: what happened, what material is ready, what is missing, and the next action; do not explain why a tool is unavailable by default.
7. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
8. When answering in Chinese, use natural Chinese section wording instead of English workflow labels such as Review Findings, Response Strategy, Draft Response, Evidence Needed, or claim impact.
9. Add only the explicit note or lesson the operator asked for.
10. Add only distilled guidance: problem, decision, pitfall, validation, and next-time behavior.
11. Do not import raw transcripts or noisy runtime traces as lessons.
12. When task binding is unclear, ask the operator to choose the task before writing.
13. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
14. Use this shared Dove task flow across paper, engineering, experiment, review, and general missions; move concrete work through top-level Dove requests.
15. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
