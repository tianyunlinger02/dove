---
description: "Discover, query, register, or reject mission-bound source candidates."
---

# dove.source

Discover, query, register, or reject mission-bound source candidates.

## Daily use

- Use public network search when discovery is needed, then visibly capture the selected material with host tools.
- Register real external material with title or locator, query eligibility, or reject a candidate after an explicit audit.
- Targeting: Provide missionId and sourceId explicitly for mission-bound source records.
- Confirmation: Search and query are read-only; an explicit register or reject request authorizes that write. No candidate becomes trusted through public input.
- Outcome: The selected source material is captured and its candidate identity, fingerprint, lifecycle, and eligibility are current.

## Examples

- `/dove.source Find and register a relevant public paper for the mission`
- `/dove.source Reject the candidate after checking the captured PDF`

## Operating rules

1. For daily answers, answer the Dove request the operator invoked. Only use an explicitly listed project check or action below; do not construct default answers by manually reading or listing internal files.
2. If the requested work cannot be finished here, say the practical result in ordinary language instead of reading or dumping internal files.
3. If an explicitly listed project check or action fails, report that message in ordinary language and stop; do not recover by manually reading internal files.
4. Use only the Dove MCP tool matching the requested operation from this command's allowed tools: `search_network`, `query_sources`, `register_source`, `verify_source`.
5. Pass only structured public arguments accepted by that tool. Call Dove through MCP only. If MCP is unavailable, stop instead of using another route.
6. For checkpoint operations, let the MCP tool handle its one approval and application inside the same call. Never display or request proposal, replay, workspace, digest, token, mutation-mode, confirmation payload, or generated-command data.
7. Treat Dove's returned answer as the source of truth; translate it into practical operator actions instead of repeating implementation details.
8. Use ordinary mission wording in user-facing answers: what happened, what material is ready, what is missing, and the next action; do not explain why a tool is unavailable by default.
9. When the target work is unclear, ask the operator to choose by visible mission goal or numbered option; do not ask for internal ids in the default answer.
10. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
11. When answering in Chinese, use natural Chinese section wording instead of English workflow labels such as Review Findings, Response Strategy, Draft Response, Evidence Needed, or claim impact.
12. Only make the specific change requested for this command; do not bundle unrelated work.
13. Registration always creates a candidate and imports captured material under mission-owned source artifacts.
14. Schema 9 stores only candidate or rejected source state; public verification is rejection-only and ordinary execution receipts never mint positive source authority.
15. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
16. Use this shared Dove mission flow across paper, engineering, experiment, review, and general missions; move concrete work through top-level Dove requests.
17. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
