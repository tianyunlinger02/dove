---
name: dove-experience
description: "Record one mission-bound experiment protocol, result, audit, and optional claim bridge."
---

# Dove Experience

Record one mission-bound experiment protocol, result, audit, and optional claim bridge.

## Daily use

- Record a concrete protocol and success criteria.
- Add current result evidence, audit findings, and claim impact when available.
- Targeting: Provide missionId and experimentId explicitly.
- Confirmation: Integrity flags prevent claim bridging.
- Outcome: Experiment evidence and claim impact are linked without scheduling execution.

## Examples

- `/dove:experience Record the ablation protocol`
- `/dove:experience Audit the result and bridge it to the claim`

## Operating rules

1. For daily answers, answer the Dove request the operator invoked. Only use an explicitly listed project check or action below; do not construct default answers by manually reading or listing internal files.
2. If the requested work cannot be finished here, say the practical result in ordinary language instead of reading or dumping internal files.
3. If an explicitly listed project check or action fails, report that message in ordinary language and stop; do not recover by manually reading internal files.
4. This request has one listed project action: `node ./bin/dove-package.mjs experience . --mission-id "<mission id>" --experiment-id "<experiment id>" --goal "<experiment goal>" --hypothesis "<hypothesis>" --protocol "<protocol>" --success-criterion "<criterion>" --mutation-mode direct-process --json`. Run it in the host's current working directory without changing directories or reinterpreting a parent repository as the target; `.` is the Dove workspace being operated on. Run it only when the needed material is present; then summarize the real artifact state or material boundary instead of inspecting internal files directly.
5. Results require current evidence and a clean audit before claim bridging.
6. Treat Dove's returned answer as the source of truth; translate it into practical operator actions instead of repeating implementation details.
7. Use ordinary mission wording in user-facing answers: what happened, what material is ready, what is missing, and the next action; do not explain why a tool is unavailable by default.
8. When the target work is unclear, ask the operator to choose by visible mission goal or numbered option; do not ask for internal ids in the default answer.
9. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
10. When answering in Chinese, use natural Chinese section wording instead of English workflow labels such as Review Findings, Response Strategy, Draft Response, Evidence Needed, or claim impact.
11. Only make the specific change requested for this command; do not bundle unrelated work.
12. The protocol, result, audit, and claim bridge use one implementation and one preflighted write set.
13. Results require current evidence; claim bridges require a clean audit and a current mission claim.
14. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
15. Use this shared Dove mission flow across paper, engineering, experiment, review, and general missions; move concrete work through top-level Dove requests.
16. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
