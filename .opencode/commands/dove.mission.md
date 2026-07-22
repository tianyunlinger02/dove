---
description: "Propose and persist one minimal mission contract or reevaluate its research decision tree."
---

# dove.mission

Propose and persist one minimal mission contract or reevaluate its research decision tree.

## Daily use

- Turn one concrete goal into a minimal mission contract.
- Reevaluate the mission research tree only from explicit current requirements and node outcomes.
- Targeting: The host keeps one private safe mission id for the current checkpoint and optional outcome closure; no packet target is resolved and the id is not shown to the user.
- Confirmation: Approve the exact proposal, adjust it, or cancel.
- Outcome: One durable mission contract or research-tree revision exists without orchestration state.

## Examples

- `/dove.mission Validate the new retrieval method`
- `/dove.mission Reevaluate the research tree for mission <id>`

## Operating rules

1. For daily answers, answer the Dove request the operator invoked. Only use an explicitly listed project check or action below; do not construct default answers by manually reading or listing internal files.
2. If the requested work cannot be finished here, say the practical result in ordinary language instead of reading or dumping internal files.
3. If an explicitly listed project check or action fails, report that message in ordinary language and stop; do not recover by manually reading internal files.
4. Use only the Dove MCP tool matching the requested operation from this command's allowed tools: `create_dove_mission`.
5. Pass only structured public arguments accepted by that tool. Call Dove through MCP only. If MCP is unavailable, stop instead of using another route.
6. For checkpoint operations, let the MCP tool handle its one approval and application inside the same call. Never display or request proposal, replay, workspace, digest, token, mutation-mode, confirmation payload, or generated-command data.
7. Preserve the full original user request before calling Dove. After a successful Dove write, resume that same request in the current host turn using normal host planning, tools, files, testing, search, and review rather than ending at the Dove result.
8. Stop after the Dove checkpoint only when the user explicitly asked solely to create or reevaluate the mission, to create it without execution, or to wait for another instruction. Words such as 'first' or 'before continuing' express order and do not by themselves request a stop.
9. If the Dove call is declined, cancelled, or fails, do not continue work that depended on the unsaved checkpoint; report the practical outcome in ordinary language.
10. Before the create checkpoint, generate one private safe mission id, pass it as `missionId`, and retain it only for this host turn; never show it to the user. After successful substantive host work, call the MCP tool `close_host_outcome` at most once. Reuse that exact mission id. Pass only that mission id, a concise outcome summary, paths actually created or materially changed, and optional real validation-output paths.
11. Do not calculate or pass receipt identifiers, timestamps, fingerprints, contract data, artifact kinds, validation kinds, criterion claims, task ids, or session ids. Do not call closure after create-only, proposal-only, declined, cancelled, failed, or blocked work, and never retry it automatically.
12. A skipped closure is a valid zero-write outcome. If evidence recording fails, preserve every host-produced file and report that the substantive work succeeded but Dove could not record or assess its evidence; never roll back or delete the real work.
13. Treat Dove's returned answer as the source of truth; translate it into practical operator actions instead of repeating implementation details.
14. Use ordinary mission wording in user-facing answers: what happened, what material is ready, what is missing, and the next action; do not explain why a tool is unavailable by default.
15. When the target work is unclear, ask the operator to choose by visible mission goal or numbered option; do not ask for internal ids in the default answer.
16. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
17. When answering in Chinese, use natural Chinese section wording instead of English workflow labels such as Review Findings, Response Strategy, Draft Response, Evidence Needed, or claim impact.
18. Ask for approval before making the proposed change.
19. For mission creation, call create_dove_mission directly; never call query_dove_mission as a preliminary preview because the create tool already performs the zero-write preview, approval, and application.
20. Create persists only goal, scope, out-of-scope, target and expected artifacts, completion criteria, evidence requirements, dependencies, and supersession metadata.
21. Target and expected artifacts must be canonical workspace-relative file paths, never prose descriptions. Evidence requirements are optional; omit them unless they can be expressed exactly as artifact:<path>, validation:<path>, or note:<id>, and never invent free-form evidence requirement text.
22. Research-tree reevaluation records explicit retrieval or experiment decisions, terminal outcomes, and draft failure lessons without adding a new public surface.
23. Every proposal is zero-write; confirmation must exactly replay the returned contract or research-tree diff.
24. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
25. Keep the returned mission or research-tree material identical to the approved content; do not add a role, route, authority, status, or blocker-routing instruction.
