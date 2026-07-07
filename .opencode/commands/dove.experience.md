---
description: "Convert an idea into experiment goals/plans/results and bridge validated outcomes into claims or conclusions."
---

# dove.experience

Convert an idea into experiment goals/plans/results and bridge validated outcomes into claims or conclusions.

## Daily use

- Use this as the experiment/evidence workflow: turn ideas into experiment plans, results, audits, and claim impact.
- Do not treat experience as general retrospectives; use lessons for reusable operator guidance.
- Targeting: Resolve the experiment or evidence work to one durable task packet before writing.
- Confirmation: Ask for task confirmation when experiment/result/claim signals do not identify one packet.
- Outcome: Experiment artifacts, audit state, and claim bridge events are linked to the selected task.

## Examples

- `/dove:experience Design an experiment to validate retrieval quality`
- `/dove:experience Import this experiment result and bridge it to the claim`

## Operating rules

1. For daily answers, first use the matching Dove capability or a local Dove CLI command; do not construct default answers by using host Read, Glob, Grep, or file-list tools over saved-record files.
2. If the Dove capability or CLI command is unavailable, say the Dove runtime is unavailable or name the skipped live check in ordinary language instead of reading or dumping saved records.
3. If the Dove CLI exits non-zero, report that message and stop; do not recover by reading saved records with host file tools.
4. If neither a matching Dove capability nor a documented local Dove CLI command exists for this surface, do not emulate it by reading saved records with host tools; say the Dove runtime for this command is unavailable and ask for a capability or CLI route.
5. Treat Dove's saved project records as the source of truth through Dove capability or local CLI results; translate those results into practical operator actions instead of repeating storage details.
6. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
7. Only perform the governed change owned by this surface, scoped to the operator request.
8. Use this as the combined experiment and claim workflow; do not expose separate public experiment or claim-gate slash commands.
9. Make experiment goals, success criteria, result evidence, audit status, and claim impact explicit.
10. Do not create a placeholder experience plan without a real goal, title, idea, or experimentId.
11. Do not promote unsupported results into claims.
12. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
13. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
14. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
