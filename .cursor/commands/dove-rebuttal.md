---
description: "Normalize reviewer findings and write author-side evidence-linked responses."
---

# dove-rebuttal

Normalize reviewer findings and write author-side evidence-linked responses.

## Daily use

- Normalize concrete reviewer findings before strategy.
- Write evidence-linked author responses without claiming Reviewer authority.
- Targeting: Provide missionId and finding references explicitly.
- Confirmation: Unsupported findings or responses stop before writing.
- Outcome: Issues, strategy, and response text retain current finding and evidence lineage.

## Examples

- `/dove:rebuttal Normalize the reviewer findings`
- `/dove:rebuttal Draft evidence-backed responses`

## Operating rules

1. For daily answers, answer the Dove request the operator invoked. Only use an explicitly listed project check or action below; do not construct default answers by manually reading or listing internal files.
2. If the requested work cannot be finished here, say the practical result in ordinary language instead of reading or dumping internal files.
3. If an explicitly listed project check or action fails, report that message in ordinary language and stop; do not recover by manually reading internal files.
4. This request has one listed project action: `node ./bin/dove-package.mjs rebuttal . --mission-id "<mission id>" --issue-json "<finding-linked issue JSON>" --strategy "<strategy>" --response-json "<response JSON>" --mutation-mode direct-process`. Run it in the host's current working directory without changing directories or reinterpreting a parent repository as the target; `.` is the Dove workspace being operated on. Run it only when the needed material is present; then summarize the real artifact state or material boundary instead of inspecting internal files directly.
5. Every issue must link a current review artifact and finding id; responses remain author-side and evidence-linked.
6. Treat Dove's returned answer as the source of truth; translate it into practical operator actions instead of repeating implementation details.
7. Use ordinary task wording in user-facing answers: what happened, what material is ready, what is missing, and the next action; do not explain why a tool is unavailable by default.
8. When the target work is unclear, ask the operator to choose by visible task name or numbered option; do not ask for internal ids in the default answer.
9. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
10. When answering in Chinese, use natural Chinese section wording instead of English workflow labels such as Review Findings, Response Strategy, Draft Response, Evidence Needed, or claim impact.
11. Only make the specific change requested for this command; do not bundle unrelated work.
12. Every issue must link to a current mission-owned review artifact and concrete finding id.
13. Strategy and responses remain author-side and reject stale issues, stale strategy, or missing evidence.
14. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
15. Use this shared Dove task flow across paper, engineering, experiment, review, and general missions; move concrete work through top-level Dove requests.
16. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
