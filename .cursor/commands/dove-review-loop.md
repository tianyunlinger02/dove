---
description: "Loop isolated review, draft revision, and experience planning until coherent or blocked, with max iterations from global config."
---

# dove-review-loop

Loop isolated review, draft revision, and experience planning until coherent or blocked, with max iterations from global config.

## Daily use

- Use this when review, draft revision, and experience planning should iterate together within the configured max rounds.
- Stop when coherent, blocked, at a drawing/review boundary, or when user input is required.
- Targeting: Resolve the loop to one task before changing review, draft, or experience state.
- Confirmation: Run only limited visible iterations; default max is 3 unless configured otherwise.
- Outcome: Each loop iteration moves review, draft, and experience progress until the task is coherent or blocked.

## Examples

- `/dove:review-loop Run up to three review and revision rounds for the current draft`
- `/dove:review-loop Stop when the task is coherent or reaches an evidence blocker`

## Operating rules

1. For daily answers, answer the Dove request the operator invoked. Only use an explicitly listed project check below; do not construct default answers by manually reading or listing internal files.
2. If the requested work cannot be finished here, say the practical result in ordinary language instead of reading or dumping internal files.
3. If an explicitly listed project check fails, report that message in ordinary language and stop; do not recover by manually reading internal files.
4. This request has no listed project check. Do not run status, `node ./bin/dove.mjs review-loop --help`, the matching local surface, or any other unlisted command for it. If the target is unclear, ask the operator to choose from visible context. If this chat cannot finish the requested work directly, answer with what material is ready, what has not been added to the task, and the next user choice; do not explain why the tool is unavailable.
5. Treat Dove's returned answer as the source of truth; translate it into practical operator actions instead of repeating implementation details.
6. Use ordinary task wording in user-facing answers: what happened, what material is ready, what is missing, and the next action; do not explain why a tool is unavailable by default.
7. When the target work is unclear, ask the operator to choose by visible task name or numbered option; do not ask for internal ids in the default answer.
8. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
9. When answering in Chinese, use natural Chinese section wording instead of English workflow labels such as Review Findings, Response Strategy, Draft Response, Evidence Needed, or claim impact.
10. Only make the specific change requested for this command; do not bundle unrelated work.
11. Run only limited visible review, revision, and experience-planning iterations.
12. Use three rounds by default unless the project config says otherwise.
13. Do not start a draft or experiment substep without the needed material.
14. Stop early when the task is coherent, blocked, waiting on review, or waiting on user input.
15. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
16. Use this shared Dove task flow across paper, engineering, experiment, review, and general missions; move concrete work through top-level Dove requests.
17. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
