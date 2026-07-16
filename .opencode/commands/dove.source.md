---
description: "Register mission-bound source candidates or record a rejection."
---

# dove.source

Register mission-bound source candidates or record a rejection.

## Daily use

- Register real external material with title or locator.
- Query eligibility or reject a candidate after an explicit audit.
- Targeting: Provide missionId and sourceId explicitly.
- Confirmation: No candidate becomes trusted through public input.
- Outcome: The source has current identity, material fingerprint, lifecycle, and eligibility.

## Examples

- `/dove.source Register this paper for the mission`
- `/dove.source Reject the candidate after checking the captured PDF`

## Operating rules

1. For daily answers, answer the Dove request the operator invoked. Only use an explicitly listed project check or action below; do not construct default answers by manually reading or listing internal files.
2. If the requested work cannot be finished here, say the practical result in ordinary language instead of reading or dumping internal files.
3. If an explicitly listed project check or action fails, report that message in ordinary language and stop; do not recover by manually reading internal files.
4. This request has one listed project action: `node ./bin/dove-package.mjs source register . --mission-id "<mission id>" --source-id "<source id>" --title "<source title>" --locator "<url or doi>" --capture-path "<visible captured material path>" --mutation-mode direct-process --json`. Run it in the host's current working directory without changing directories or reinterpreting a parent repository as the target; `.` is the Dove workspace being operated on. Run it only when the needed material is present; then summarize the real artifact state or material boundary instead of inspecting internal files directly.
5. First use `search_network` to discover a non-authoritative registrationDraft, visibly capture the selected material with host tools, run the listed registration command with that exact capture path, then run `node ./bin/dove-package.mjs source . --mission-id "<mission id>" --source-id "<source id>" --json` to inspect the candidate. Search and registration make no trust claim; public verification can reject but cannot issue positive trust.
6. Treat Dove's returned answer as the source of truth; translate it into practical operator actions instead of repeating implementation details.
7. Use ordinary mission wording in user-facing answers: what happened, what material is ready, what is missing, and the next action; do not explain why a tool is unavailable by default.
8. When the target work is unclear, ask the operator to choose by visible mission goal or numbered option; do not ask for internal ids in the default answer.
9. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
10. When answering in Chinese, use natural Chinese section wording instead of English workflow labels such as Review Findings, Response Strategy, Draft Response, Evidence Needed, or claim impact.
11. Only make the specific change requested for this command; do not bundle unrelated work.
12. Registration always creates a candidate and imports captured material under mission-owned source artifacts.
13. Schema 8 stores only candidate or rejected source state; public verification is rejection-only and ordinary execution receipts never mint positive source authority.
14. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
15. Use this shared Dove mission flow across paper, engineering, experiment, review, and general missions; move concrete work through top-level Dove requests.
16. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
