---
name: dove-init
description: "Prepare Dove project records and save the project goal after approval."
---

# Dove Init

Prepare Dove project records and save the project goal after approval.

## Daily use

- Preview what initialization will establish without creating or changing files.
- Ask whether to create Dove project records and save the current project goal.
- Targeting: Initialization applies only to the current project.
- Confirmation: Show one plain-language approve-or-cancel question; never display internal confirmation data.
- Outcome: The project has minimal Dove records and its stated goal, without creating workflow tasks or runtime state.

## Examples

- `/dove:init Initialize this research workspace`
- `/dove:init Replace invalid Dove project records and initialize again`

## Operating rules

1. For daily answers, answer the Dove request the operator invoked. Only use an explicitly listed project check or action below; do not construct default answers by manually reading or listing internal files.
2. If the requested work cannot be finished here, say the practical result in ordinary language instead of reading or dumping internal files.
3. If an explicitly listed project check or action fails, report that message in ordinary language and stop; do not recover by manually reading internal files.
4. Use only the Dove MCP tool matching the requested operation from this command's allowed tools: `init_dove_goal`.
5. Pass only structured public arguments accepted by that tool. Call Dove through MCP only. If MCP is unavailable, stop instead of using another route.
6. For checkpoint operations, let the MCP tool handle its one approval and application inside the same call. Never display or request proposal, replay, workspace, digest, token, mutation-mode, confirmation payload, or generated-command data.
7. Treat Dove's returned answer as the source of truth; translate it into practical operator actions instead of repeating implementation details.
8. For the visible initialization approval, say only that no files have changed, what minimal project records and goal will be saved, and ask whether to approve or cancel. Do not print or paraphrase schema versions, workspace identifiers, hashes, proposal tokens, confirmation payloads, replay fields, generated commands, or internal paths.
9. Use ordinary mission wording in user-facing answers: what happened, what material is ready, what is missing, and the next action; do not explain why a tool is unavailable by default.
10. When the target work is unclear, ask the operator to choose by visible mission goal or numbered option; do not ask for internal ids in the default answer.
11. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
12. When answering in Chinese, use natural Chinese section wording instead of English workflow labels such as Review Findings, Response Strategy, Draft Response, Evidence Needed, or claim impact.
13. Only make the specific change requested for this command; do not bundle unrelated work.
14. The preview is strictly zero-write; approval creates only the minimal project records and required directories.
15. Keep schema versions, workspace identifiers, hashes, proposal tokens, confirmation payloads, replay fields, generated commands, and internal paths out of user-facing answers.
16. Use the returned approval wording for the visible confirmation; keep integrity verification and the generated confirmation command internal.
17. Legacy or invalid state requires an explicit archive reset with no import, repair, fallback, or alias.
18. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
19. Use this shared Dove mission flow across paper, engineering, experiment, review, and general missions; move concrete work through top-level Dove requests.
20. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
