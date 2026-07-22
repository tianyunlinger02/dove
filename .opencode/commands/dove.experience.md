---
description: "Record one mission-bound experiment protocol, result, audit, and optional claim bridge."
---

# dove.experience

Record one mission-bound experiment protocol, result, audit, and optional claim bridge.

## Daily use

- Record a concrete protocol and success criteria.
- Add current result evidence, audit findings, and claim impact when available.
- Targeting: Provide missionId and experimentId explicitly.
- Confirmation: Integrity flags prevent claim bridging.
- Outcome: Experiment evidence and claim impact are linked without scheduling execution.

## Examples

- `/dove.experience Record the ablation protocol`
- `/dove.experience Audit the result and bridge it to the claim`

## Operating rules

1. For daily answers, answer the Dove request the operator invoked. Only use an explicitly listed project check or action below; do not construct default answers by manually reading or listing internal files.
2. If the requested work cannot be finished here, say the practical result in ordinary language instead of reading or dumping internal files.
3. If an explicitly listed project check or action fails, report that message in ordinary language and stop; do not recover by manually reading internal files.
4. Use only the Dove MCP tool matching the requested operation from this command's allowed tools: `run_experience_workflow`, `upsert_claims`.
5. Pass only structured public arguments accepted by that tool. Call Dove through MCP only. If MCP is unavailable, stop instead of using another route.
6. For checkpoint operations, let the MCP tool handle its one approval and application inside the same call. Never display or request proposal, replay, workspace, digest, token, mutation-mode, confirmation payload, or generated-command data.
7. Preserve the full original user request before calling Dove. After a successful Dove write, resume that same request in the current host turn using normal host planning, tools, files, testing, search, and review rather than ending at the Dove result.
8. Stop after recording the experiment protocol only when the user explicitly asked for protocol-only setup; otherwise continue the requested experiment work with host tools when it is feasible in this turn.
9. If the Dove call is declined, cancelled, or fails, do not continue work that depended on the unsaved checkpoint; report the practical outcome in ordinary language.
10. Treat Dove's returned answer as the source of truth; translate it into practical operator actions instead of repeating implementation details.
11. Use ordinary mission wording in user-facing answers: what happened, what material is ready, what is missing, and the next action; do not explain why a tool is unavailable by default.
12. When the target work is unclear, ask the operator to choose by visible mission goal or numbered option; do not ask for internal ids in the default answer.
13. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
14. When answering in Chinese, use natural Chinese section wording instead of English workflow labels such as Review Findings, Response Strategy, Draft Response, Evidence Needed, or claim impact.
15. Only make the specific change requested for this command; do not bundle unrelated work.
16. The protocol, result, audit, and claim bridge use one implementation and one preflighted write set.
17. Results require current evidence; claim bridges require a clean audit and a current mission claim.
18. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
19. Use this shared Dove mission flow across paper, engineering, experiment, review, and general missions; move concrete work through top-level Dove requests.
20. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
