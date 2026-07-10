---
name: dove-mission
description: "Convert a user demand into a confirmable Dove task contract, then hand off to the recommended next workflow."
---

# Dove Mission

Convert a user demand into a confirmable Dove task contract, then hand off to the recommended next workflow.

## Daily use

- Use this for one concrete user demand that should become a tracked mission/task contract and hand off to the right next workflow.
- Describe the desired outcome in normal language; Dove should propose the task, explain the evidence it will need, and wait for approval before materializing the contract.
- Targeting: Creates a new task contract under the project goal, or helps set the project goal first when the workspace is new.
- Confirmation: Show the proposed task in plain language, then ask whether to materialize the contract, adjust it, or cancel.
- Outcome: After approval, the contract exists with recommended next routes; real execution belongs to auto, operator, domain workflows, or explicit tools.

## Examples

- `/dove:mission Fix the status dashboard next-action mismatch`
- `/dove:mission Turn the latest review feedback into one executable task`

## Operating rules

1. For daily answers, answer the Dove request the operator invoked. Only use an explicitly listed project check or action below; do not construct default answers by manually reading or listing internal files.
2. If the requested work cannot be finished here, say the practical result in ordinary language instead of reading or dumping internal files.
3. If an explicitly listed project check or action fails, report that message in ordinary language and stop; do not recover by manually reading internal files.
4. This request has one listed project check: `node ./bin/dove.mjs mission .` from the project root; Summarize its practical result instead of inspecting internal files directly.
5. Treat Dove's returned answer as the source of truth; translate it into practical operator actions instead of repeating implementation details.
6. Use ordinary task wording in user-facing answers: what happened, what material is ready, what is missing, and the next action; do not explain why a tool is unavailable by default.
7. When the target work is unclear, ask the operator to choose by visible task name or numbered option; do not ask for internal ids in the default answer.
8. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
9. When answering in Chinese, use natural Chinese section wording instead of English workflow labels such as Review Findings, Response Strategy, Draft Response, Evidence Needed, or claim impact.
10. Ask for approval before making changes or spending the proposed work rounds.
11. Propose the task first, then ask whether to materialize the contract, adjust it, or cancel.
12. After approval, materialize the contract only and hand off to the recommended next workflow; mission itself does not execute source, note, draft, figure, experiment, review, code, or provider work.
13. Report the created contract and recommended next routes without claiming completion or execution progress.
14. If the contract is planning work, its done criteria must require explicit executable child mission contracts before any later execution flow can mark it completed.
15. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
16. Use this shared Dove task flow across paper, engineering, experiment, review, and general missions; move concrete work through top-level Dove requests.
17. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
