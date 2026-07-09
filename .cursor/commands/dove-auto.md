---
description: "Convert demand like mission intake, then after confirmation run a few approved work rounds until completion or a blocker is reached."
---

# dove-auto

Convert demand like mission intake, then after confirmation run a few approved work rounds until completion or a blocker is reached.

## Daily use

- Use this when the user wants Dove to continue through a few approved steps after the task is clear.
- When the work depends on current outside information, public docs, papers, or provider behavior, run a visible no-key search/retrieval step early and verify candidates before writing evidence.
- Auto may start from a new demand or an existing task, but it still needs an understandable proposal before spending its work limit.
- Targeting: Use the selected task when it is obvious; otherwise ask the operator to choose or approve a new task.
- Confirmation: Require explicit approval of the target, work limit, and visible steps before running.
- Outcome: Each step either completes useful work with evidence or stops at a clear blocker, review need, missing material, or budget limit.

## Examples

- `/dove:auto Continue the current Dove UX improvement task for up to three approved rounds`
- `/dove:auto Run the selected task until completion or an explicit blocker`

## Operating rules

1. For daily answers, answer the Dove request the operator invoked. Only use an explicitly listed project check below; do not construct default answers by manually reading or listing internal files.
2. If the requested work cannot be finished here, say the practical result in ordinary language instead of reading or dumping internal files.
3. If an explicitly listed project check fails, report that message in ordinary language and stop; do not recover by manually reading internal files.
4. This request has no listed project check. Do not run status, `node ./bin/dove.mjs auto --help`, the matching local surface, or any other unlisted command for it. If the target is unclear, ask the operator to choose from visible context. If this chat cannot finish the requested work directly, answer with what material is ready, what has not been added to the task, and the next user choice; do not explain why the tool is unavailable.
5. Treat Dove's returned answer as the source of truth; translate it into practical operator actions instead of repeating implementation details.
6. Use ordinary task wording in user-facing answers: what happened, what material is ready, what is missing, and the next action; do not explain why a tool is unavailable by default.
7. When the target work is unclear, ask the operator to choose by visible task name or numbered option; do not ask for internal ids in the default answer.
8. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
9. When answering in Chinese, use natural Chinese section wording instead of English workflow labels such as Review Findings, Response Strategy, Draft Response, Evidence Needed, or claim impact.
10. Ask for approval before making changes or spending the proposed work rounds.
11. Propose the target, work limit, and visible steps before running.
12. Run only in the current approved interaction; never schedule hidden background continuation.
13. For research or current-information work, use visible search/retrieval when needed and collect real verified sources or materials before claiming success.
14. Stop clearly at completion, blocker, review need, missing material, or budget limit.
15. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
16. Use this shared Dove task flow across paper, engineering, experiment, review, and general missions; move concrete work through top-level Dove requests.
17. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
