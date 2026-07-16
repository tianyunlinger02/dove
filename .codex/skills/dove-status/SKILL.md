---
name: dove-status
description: "Read schema 8 mission and evidence integrity without refreshing state."
---

# Dove Status

Read schema 8 mission and evidence integrity without refreshing state.

## Daily use

- Inspect current schema and integrity without writes.
- Pass missionId to scope completion, source, domain, and review checks; when more than one mission exists, choose explicitly.
- Targeting: With zero missions status reports none; with one mission it scopes to the only mission; with multiple missions it never selects an implicit latest mission.
- Confirmation: No confirmation is applicable because status is read-only.
- Outcome: The operator sees stable gaps and one existing command or tool to run next.

## Examples

- `/dove:status`
- `/dove:status Show integrity for mission <id>`

## Operating rules

1. For daily answers, answer the Dove request the operator invoked. Only use an explicitly listed project check or action below; do not construct default answers by manually reading or listing internal files.
2. If the requested work cannot be finished here, say the practical result in ordinary language instead of reading or dumping internal files.
3. If an explicitly listed project check or action fails, report that message in ordinary language and stop; do not recover by manually reading internal files.
4. This request has one listed project check: `node ./bin/dove-package.mjs status . --json`. Run it in the host's current working directory without changing directories or reinterpreting a parent repository as the target; `.` is the Dove workspace being operated on. Summarize its practical result instead of inspecting internal files directly.
5. When multiple missions exist, rerun with `--mission-id "<mission id>" --json`; never select an implicit latest mission.
6. Treat Dove's returned answer as the source of truth; translate it into practical operator actions instead of repeating implementation details.
7. Use ordinary mission wording in user-facing answers: what happened, what material is ready, what is missing, and the next action; do not explain why a tool is unavailable by default.
8. When the target work is unclear, ask the operator to choose by visible mission goal or numbered option; do not ask for internal ids in the default answer.
9. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
10. When answering in Chinese, use natural Chinese section wording instead of English workflow labels such as Review Findings, Response Strategy, Draft Response, Evidence Needed, or claim impact.
11. Stay within this command's purpose and keep implementation details out of the default answer.
12. Absent state returns needs-init; malformed, legacy, contradictory, or future state fails closed.
13. Compact status reports only schema health, mission count, receipt count, source count, and live integrity.
14. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
15. Use this shared Dove mission flow across paper, engineering, experiment, review, and general missions; move concrete work through top-level Dove requests.
16. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
