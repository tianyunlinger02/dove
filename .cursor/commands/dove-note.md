---
description: "Write substantive mission-bound synthesis from current eligible evidence."
---

# dove-note

Write substantive mission-bound synthesis from current eligible evidence.

## Daily use

- Synthesize current mission-owned artifacts, including current note artifacts when applicable.
- Record claims, quotes, and open questions rather than empty bookkeeping.
- Targeting: Provide missionId and noteId explicitly.
- Confirmation: Ineligible or cross-mission evidence stops the write.
- Outcome: A substantive note with current evidence lineage exists.

## Examples

- `/dove:note Summarize the current mission artifacts`
- `/dove:note Record the open methodological question`

## Operating rules

1. For daily answers, answer the Dove request the operator invoked. Only use an explicitly listed project check or action below; do not construct default answers by manually reading or listing internal files.
2. If the requested work cannot be finished here, say the practical result in ordinary language instead of reading or dumping internal files.
3. If an explicitly listed project check or action fails, report that message in ordinary language and stop; do not recover by manually reading internal files.
4. Use only the Dove MCP tool matching the requested operation from this command's allowed tools: `upsert_note`.
5. Pass only structured public arguments accepted by that tool. Call Dove through MCP only. If MCP is unavailable, stop instead of using another route.
6. For checkpoint operations, let the MCP tool handle its one approval and application inside the same call. Never display or request proposal, replay, workspace, digest, token, mutation-mode, confirmation payload, or generated-command data.
7. Treat Dove's returned answer as the source of truth; translate it into practical operator actions instead of repeating implementation details.
8. Use ordinary mission wording in user-facing answers: what happened, what material is ready, what is missing, and the next action; do not explain why a tool is unavailable by default.
9. When the target work is unclear, ask the operator to choose by visible mission goal or numbered option; do not ask for internal ids in the default answer.
10. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
11. When answering in Chinese, use natural Chinese section wording instead of English workflow labels such as Review Findings, Response Strategy, Draft Response, Evidence Needed, or claim impact.
12. Only make the specific change requested for this command; do not bundle unrelated work.
13. A note requires summary, quote, claim, or open question plus at least one current mission-owned artifact, including a current note artifact when applicable.
14. sourceIds remain ineligible until a trusted positive source verifier exists; candidate or rejected sources cannot authorize the write.
15. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
16. Use this shared Dove mission flow across paper, engineering, experiment, review, and general missions; move concrete work through top-level Dove requests.
17. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
