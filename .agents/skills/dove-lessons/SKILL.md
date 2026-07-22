---
name: dove-lessons
description: "Query advisory lessons by default or explicitly record one mission-provenanced lesson."
---

# Dove Lessons

Query advisory lessons by default or explicitly record one mission-provenanced lesson.

## Daily use

- Query only the lessons explicitly requested for the current mission, kind, tags, or artifact scope.
- Use record only when the operator explicitly asks to preserve a specific lesson.
- Targeting: Query may include globally applicable lessons and current mission-scoped lessons while preserving each recording mission; artifact filters require an explicit missionId.
- Confirmation: Query is read-only. An explicit record request authorizes only that lesson write and does not ask again.
- Outcome: The operator receives current advisory guidance or one immutable advisory lesson with evidence lineage.

## Examples

- `/dove:lessons Query method lessons for the current mission`
- `/dove:lessons Record this explicit review insight`

## Operating rules

1. For daily answers, answer the Dove request the operator invoked. Only use an explicitly listed project check or action below; do not construct default answers by manually reading or listing internal files.
2. If the requested work cannot be finished here, say the practical result in ordinary language instead of reading or dumping internal files.
3. If an explicitly listed project check or action fails, report that message in ordinary language and stop; do not recover by manually reading internal files.
4. Use only the Dove MCP tool matching the requested operation from this command's allowed tools: `query_dove_lessons`, `record_dove_lesson`.
5. Pass only structured public arguments accepted by that tool. Call Dove through MCP only. If MCP is unavailable, stop instead of using another route.
6. For checkpoint operations, let the MCP tool handle its one approval and application inside the same call. Never display or request proposal, replay, workspace, digest, token, mutation-mode, confirmation payload, or generated-command data.
7. Treat Dove's returned answer as the source of truth; translate it into practical operator actions instead of repeating implementation details.
8. Use ordinary mission wording in user-facing answers: what happened, what material is ready, what is missing, and the next action; do not explain why a tool is unavailable by default.
9. When the target work is unclear, ask the operator to choose by visible mission goal or numbered option; do not ask for internal ids in the default answer.
10. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
11. When answering in Chinese, use natural Chinese section wording instead of English workflow labels such as Review Findings, Response Strategy, Draft Response, Evidence Needed, or claim impact.
12. Only make the specific change requested for this command; do not bundle unrelated work.
13. Default behavior is an explicit read-only query; never auto-capture a lesson and never auto-recall lessons from another command.
14. Every lesson retains its recording mission as provenance; global scope means broad applicability, not provenance detached from that mission.
15. The only lesson kinds are preference, constraint, method, failure, and review-insight.
16. An explicit record request authorizes that one advisory lesson write without a second confirmation.
17. Lessons never grant authority, satisfy completion, replace current evidence checks, become mission output artifacts, import transcripts, write Trellis state, or create runtime memory.
18. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
19. Use this shared Dove mission flow across paper, engineering, experiment, review, and general missions; move concrete work through top-level Dove requests.
20. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
