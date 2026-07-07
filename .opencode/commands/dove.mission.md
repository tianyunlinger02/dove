---
description: "Convert a user demand into a Dove task contract, then after approval run one approved work pass."
---

# dove.mission

Convert a user demand into a Dove task contract, then after approval run one approved work pass.

## Daily use

- Use this for one concrete user demand that should become a tracked task and receive one approved work pass.
- Describe the desired outcome in normal language; Dove should propose the task, explain the evidence it will need, and wait for approval before doing work.
- Targeting: Creates a new task under the project goal, or helps set the project goal first when the workspace is new.
- Confirmation: Show the proposed task in plain language, then ask whether to run one pass, adjust it, or cancel.
- Outcome: After approval, one work pass either makes real progress with evidence or stops with a clear blocker and next action.

## Examples

- `/dove.mission Fix the status dashboard next-action mismatch`
- `/dove.mission Turn the latest review feedback into one executable task`

## Operating rules

1. For daily answers, answer the Dove request the operator invoked. Only use an explicitly listed project check below; do not construct default answers by manually reading or listing internal files.
2. If the requested work cannot be finished here, say the practical result in ordinary language instead of reading or dumping internal files.
3. If an explicitly listed project check fails, report that message in ordinary language and stop; do not recover by manually reading internal files.
4. This request has one listed project check: `node ./bin/dove.mjs mission .` from the project root; summarize its practical result instead of inspecting internal files directly.
5. Treat Dove's returned answer as the source of truth; translate it into practical operator actions instead of repeating implementation details.
6. Use ordinary task wording in user-facing answers: what happened, what material is ready, what is missing, and the next action; do not explain why a tool is unavailable by default.
7. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
8. When answering in Chinese, use natural Chinese section wording instead of English workflow labels such as Review Findings, Response Strategy, Draft Response, Evidence Needed, or claim impact.
9. Ask for approval before making changes or spending the proposed work rounds.
10. Propose the task first, then ask whether to run one pass, adjust it, or cancel.
11. After approval, run exactly one approved work pass; do not tell the operator to start auto for the first pass.
12. Only report completion when there is real evidence; otherwise report the blocker, what is missing, and the next useful action.
13. If the pass is planning work, create follow-up tasks only when each one has a clear title, goal, and evidence expectation.
14. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
15. Use this shared Dove task flow across paper, engineering, experiment, review, and general missions; move concrete work through top-level Dove requests.
16. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
