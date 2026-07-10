---
description: "Run limited local review and optional revision or experience steps until materials are coherent or blocked."
---

# dove-review-loop

Run limited local review and optional revision or experience steps until materials are coherent or blocked.

## Daily use

- Use this when local review, draft revision, and experience planning should iterate together within the configured max rounds.
- Start each iteration by inspecting evidence and findings; revise or plan experiments only when the needed material is supplied.
- Stop when coherent, blocked, at a drawing/review boundary, or when user input is required.
- Targeting: Resolve the loop to one task before changing review, draft, or experience state.
- Confirmation: Run only limited visible iterations; default max is 3 unless configured otherwise.
- Outcome: Each loop iteration reports inspected findings or moves a real draft/experience artifact until the task is coherent or blocked.

## Examples

- `/dove:review-loop Run up to three evidence-aware review and revision rounds`
- `/dove:review-loop Stop when the task is coherent or reaches an evidence blocker`

## Operating rules

1. For daily answers, answer the Dove request the operator invoked. Only use an explicitly listed project check or action below; do not construct default answers by manually reading or listing internal files.
2. If the requested work cannot be finished here, say the practical result in ordinary language instead of reading or dumping internal files.
3. If an explicitly listed project check or action fails, report that message in ordinary language and stop; do not recover by manually reading internal files.
4. This request has one listed project action: `node ./bin/dove.mjs review-loop . --target "<task title>"` from the project root; Run it only when the needed material is present; then summarize the real artifact state or material boundary instead of inspecting internal files directly.
5. Use this for limited local review iterations; provide draft or experiment material before asking it to revise or plan those substeps.
6. Treat Dove's returned answer as the source of truth; translate it into practical operator actions instead of repeating implementation details.
7. Use ordinary task wording in user-facing answers: what happened, what material is ready, what is missing, and the next action; do not explain why a tool is unavailable by default.
8. When the target work is unclear, ask the operator to choose by visible task name or numbered option; do not ask for internal ids in the default answer.
9. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
10. When answering in Chinese, use natural Chinese section wording instead of English workflow labels such as Review Findings, Response Strategy, Draft Response, Evidence Needed, or claim impact.
11. Only make the specific change requested for this command; do not bundle unrelated work.
12. Run only limited visible local review, revision, and experience-planning iterations.
13. Use three rounds by default unless the project config says otherwise.
14. Do not start a draft or experiment substep without the needed material.
15. Stop early when the task is coherent, blocked, waiting on material, or waiting on user input.
16. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
17. Use this shared Dove task flow across paper, engineering, experiment, review, and general missions; move concrete work through top-level Dove requests.
18. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
