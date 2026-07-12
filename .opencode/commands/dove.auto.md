---
description: "Convert demand like mission intake, then after confirmation run a few approved work rounds until completion or a blocker is reached."
---

# dove.auto

Convert demand like mission intake, then after confirmation run a few approved work rounds until completion or a blocker is reached.

## Daily use

- Use this when the user wants Dove to continue through a few approved steps after the task is clear.
- When the work depends on current outside information, public docs, papers, or provider behavior, run a visible no-key search/retrieval step early and verify candidates before writing evidence.
- Auto may start from a new demand or an existing task, but it still needs an understandable proposal before spending its work limit.
- Targeting: Use the selected task when it is obvious; otherwise ask the operator to choose or approve a new task.
- Confirmation: Require explicit approval of the target, work limit, and visible steps before running.
- Outcome: Each step either completes useful work with evidence or stops at a clear blocker, review need, missing material, or budget limit.

## Examples

- `/dove.auto Continue the current Dove UX improvement task for up to three approved rounds`
- `/dove.auto Run the selected task until completion or an explicit blocker`

## Operating rules

1. For daily answers, answer the Dove request the operator invoked. Only use an explicitly listed project check or action below; do not construct default answers by manually reading or listing internal files.
2. If the requested work cannot be finished here, say the practical result in ordinary language instead of reading or dumping internal files.
3. If an explicitly listed project check or action fails, report that message in ordinary language and stop; do not recover by manually reading internal files.
4. This request has one listed project check: `node ./bin/dove-package.mjs auto . --target "<task title>" --mutation-mode direct-process` from the project root; Summarize its practical result instead of inspecting internal files directly.
5. First return the proposal without writing. When real workflow material is supplied, pass the complete structured step array once through `--steps-json '<JSON array>'`; after approval, run the exact confirmation command so the proposal token preserves those step arguments. Run auto only when the selected task has real work material or a concrete material boundary to report.
6. Treat Dove's returned answer as the source of truth; translate it into practical operator actions instead of repeating implementation details.
7. Use ordinary task wording in user-facing answers: what happened, what material is ready, what is missing, and the next action; do not explain why a tool is unavailable by default.
8. When the target work is unclear, ask the operator to choose by visible task name or numbered option; do not ask for internal ids in the default answer.
9. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
10. When answering in Chinese, use natural Chinese section wording instead of English workflow labels such as Review Findings, Response Strategy, Draft Response, Evidence Needed, or claim impact.
11. Ask for approval before making changes or spending the proposed work rounds.
12. Propose the target, work limit, and visible steps before running.
13. Run only in the current approved interaction; never schedule hidden background continuation.
14. For research or current-information work, use visible search/retrieval when needed and collect real verified sources or materials before claiming success.
15. Stop clearly at completion, blocker, review need, missing material, or budget limit.
16. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
17. Use this shared Dove task flow across paper, engineering, experiment, review, and general missions; move concrete work through top-level Dove requests.
18. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
