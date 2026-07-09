---
name: dove-experience
description: "Convert an idea into experiment goals/plans/results and bridge validated outcomes into claims or conclusions."
---

# Dove Experience

Convert an idea into experiment goals/plans/results and bridge validated outcomes into claims or conclusions.

## Daily use

- Use this as the experiment and evidence workflow: turn ideas into experiment plans, results, audits, and claim impact.
- Do not treat experience as general retrospectives; use lessons for reusable operator guidance.
- Targeting: Resolve the experiment or evidence work to one task before writing.
- Confirmation: Ask for task confirmation when the experiment, result, or claim signal does not identify one task.
- Outcome: Experiment plans, reviewed results, and claim impact are connected to the selected task.

## Examples

- `/dove:experience Design an experiment to validate retrieval quality`
- `/dove:experience Import this experiment result and connect it to the claim`

## Operating rules

1. For daily answers, answer the Dove request the operator invoked. Only use an explicitly listed project check below; do not construct default answers by manually reading or listing internal files.
2. If the requested work cannot be finished here, say the practical result in ordinary language instead of reading or dumping internal files.
3. If an explicitly listed project check fails, report that message in ordinary language and stop; do not recover by manually reading internal files.
4. This request has no listed project check. Do not run status, `node ./bin/dove.mjs experience --help`, the matching local surface, or any other unlisted command for it. If the target is unclear, ask the operator to choose from visible context. If this chat cannot finish the requested work directly, answer with what material is ready, what has not been added to the task, and the next user choice; do not explain why the tool is unavailable.
5. Treat Dove's returned answer as the source of truth; translate it into practical operator actions instead of repeating implementation details.
6. Use ordinary task wording in user-facing answers: what happened, what material is ready, what is missing, and the next action; do not explain why a tool is unavailable by default.
7. When the target work is unclear, ask the operator to choose by visible task name or numbered option; do not ask for internal ids in the default answer.
8. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
9. When answering in Chinese, use natural Chinese section wording instead of English workflow labels such as Review Findings, Response Strategy, Draft Response, Evidence Needed, or claim impact.
10. Only make the specific change requested for this command; do not bundle unrelated work.
11. Require a real experiment goal, title, idea, result, or outcome before writing.
12. Make success criteria, result evidence, audit state, and claim impact understandable to the operator.
13. Do not promote unsupported results into claims.
14. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
15. Use this shared Dove task flow across paper, engineering, experiment, review, and general missions; move concrete work through top-level Dove requests.
16. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
