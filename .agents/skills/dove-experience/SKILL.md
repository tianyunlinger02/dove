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

1. For daily answers, answer the Dove request the operator invoked. Only use an explicitly listed project check or action below; do not construct default answers by manually reading or listing internal files.
2. If the requested work cannot be finished here, say the practical result in ordinary language instead of reading or dumping internal files.
3. If an explicitly listed project check or action fails, report that message in ordinary language and stop; do not recover by manually reading internal files.
4. This request has one listed project action: `node ./bin/dove-package.mjs experience . --target "<task title>" --goal "<experiment goal>" --methodology "<method>" --success-metric "<metric>" --mutation-mode direct-process` from the project root; Run it only when the needed material is present; then summarize the real artifact state or material boundary instead of inspecting internal files directly.
5. Use this for experiment/evidence material; if method, metric, result evidence, or claim linkage is missing, say exactly which material is missing.
6. Treat Dove's returned answer as the source of truth; translate it into practical operator actions instead of repeating implementation details.
7. Use ordinary task wording in user-facing answers: what happened, what material is ready, what is missing, and the next action; do not explain why a tool is unavailable by default.
8. When the target work is unclear, ask the operator to choose by visible task name or numbered option; do not ask for internal ids in the default answer.
9. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
10. When answering in Chinese, use natural Chinese section wording instead of English workflow labels such as Review Findings, Response Strategy, Draft Response, Evidence Needed, or claim impact.
11. Only make the specific change requested for this command; do not bundle unrelated work.
12. Require a real experiment goal, title, idea, result, or outcome before writing.
13. Make success criteria, result evidence, audit state, and claim impact understandable to the operator.
14. Do not promote unsupported results into claims.
15. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
16. Use this shared Dove task flow across paper, engineering, experiment, review, and general missions; move concrete work through top-level Dove requests.
17. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
