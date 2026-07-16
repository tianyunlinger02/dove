---
description: "Query advisory lessons by default or explicitly record one exact-confirmation mission-provenanced lesson."
---

# dove.lessons

Query advisory lessons by default or explicitly record one exact-confirmation mission-provenanced lesson.

## Daily use

- Query only the lessons explicitly requested for the current mission, kind, tags, or artifact scope.
- Use record only when the operator explicitly asks to preserve a specific lesson, then inspect and replay the exact confirmation command.
- Targeting: Query may include globally applicable lessons and current mission-scoped lessons while preserving each recording mission; artifact filters require an explicit missionId.
- Confirmation: Query never confirms. Record proposes with zero writes and accepts only the exact proposal token plus --confirmed; there is no confirmation alias.
- Outcome: The operator receives current advisory guidance or one immutable advisory lesson with evidence lineage.

## Examples

- `/dove.lessons Query method lessons for the current mission`
- `/dove.lessons Record this explicit review insight`

## Operating rules

1. For daily answers, answer the Dove request the operator invoked. Only use an explicitly listed project check or action below; do not construct default answers by manually reading or listing internal files.
2. If the requested work cannot be finished here, say the practical result in ordinary language instead of reading or dumping internal files.
3. If an explicitly listed project check or action fails, report that message in ordinary language and stop; do not recover by manually reading internal files.
4. This request has one listed project check: `node ./bin/dove-package.mjs lessons query . --mission-id "<mission id>" --json`. Run it in the host's current working directory without changing directories or reinterpreting a parent repository as the target; `.` is the Dove workspace being operated on. Summarize its practical result instead of inspecting internal files directly.
5. Query is the default and must remain zero-write. Never auto-capture a lesson and never auto-recall lessons from another command. Use `lessons record` only when the operator explicitly asks to preserve a specific lesson; then run only the exact confirmation command returned by the zero-write proposal.
6. Treat Dove's returned answer as the source of truth; translate it into practical operator actions instead of repeating implementation details.
7. Use ordinary mission wording in user-facing answers: what happened, what material is ready, what is missing, and the next action; do not explain why a tool is unavailable by default.
8. When the target work is unclear, ask the operator to choose by visible mission goal or numbered option; do not ask for internal ids in the default answer.
9. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
10. When answering in Chinese, use natural Chinese section wording instead of English workflow labels such as Review Findings, Response Strategy, Draft Response, Evidence Needed, or claim impact.
11. Only make the specific change requested for this command; do not bundle unrelated work.
12. Default behavior is an explicit read-only query; never auto-capture a lesson and never auto-recall lessons from another command.
13. Every lesson retains its recording mission as provenance; global scope means broad applicability, not provenance detached from that mission.
14. The only lesson kinds are preference, constraint, method, failure, and review-insight.
15. Recording is advisory-only: proposal is strictly zero-write, and only the exact returned proposal token may be replayed with --confirmed inside a MutationContext.
16. Lessons never grant authority, satisfy completion, replace current evidence checks, become mission output artifacts, import transcripts, write Trellis state, or create runtime memory.
17. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
18. Use this shared Dove mission flow across paper, engineering, experiment, review, and general missions; move concrete work through top-level Dove requests.
19. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
