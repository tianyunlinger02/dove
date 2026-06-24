---
description: "Create or update the single project-level Dove goal as the unique level-0 task."
---

# dove.init

Create or update the single project-level Dove goal as the unique level-0 task.

## Daily use

- Use this when the workspace needs its one global Dove goal or the goal wording needs an explicit refresh.
- Keep concrete work out of init; after init, route the actual request to mission or auto.
- Targeting: No task target is needed because init owns the unique level-0 root.
- Confirmation: Guarded mutation only; update the existing init instead of creating another root.
- Outcome: The workspace has one level-0 init task and the next practical command is mission or auto.

## Examples

- `/dove:init Make Dove a local-first research and engineering workflow`
- `/dove:init Refresh the project goal around daily Dove usability`

## Contract

- Command id: `dove.init`
- Domain: `generic`
- Category: `mutation`
- Policy: `guarded-mutation`

## Guardrails

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Follow Dove's response language preference from `.dove/config.json`, `.dove/config.local.json`, or `.dove/state.json.settings.responseLanguage`; supported values are `zh` for Chinese and `en` for English, and the default is `zh`.
3. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/config.json`, `.dove/config.local.json`, `.dove/state.json`, `.dove/task-packets/index.json`.
4. Prefer the `init_dove_goal` MCP tool when available.
5. Only perform the governed mutation owned by this surface, scoped to the operator request.
6. For ordinary prompts, first use compact `query_dove_status` and `statusHome.preActionGuidance` for intent routing before choosing a mutation command; users should not need to guess slash command names.
7. For ordinary prompts that ask to bind, save, deposit, archive, or 沉淀 results to a main task, resolve the durable packet first, register external URLs/templates/guidelines as packet-bound sources, then synthesize internal findings through `upsert_note` or `record_document_evidence` instead of treating the synthesis as an external source.
8. Treat `preActionGuidance` as read-only guidance that automatically recalls applicable lessons from `.dove/meta/operator-lessons.json`; recording lessons remains explicit through `/dove:lessons` and `record_operator_lesson` only.
9. Frame work through Planner, Builder, and Reviewer primary roles; researcher, experiment-planner, revision-lead, rebuttal-lead, version-analyst, and review-loop are subagents/modes under those roles, not public slash surfaces.
10. Treat status as the project command center and mission as a durable work contract/progress object; do not make a mission board the default UI.
11. Never create hidden runtime, scheduler, daemon, background continuation, or unconfirmed writes; auto/operator/mission execution remains explicit bounded foreground work.
12. There is exactly one level-0 init task; update it instead of creating a second root.
13. Use init only for the global project goal, then route concrete work through `/dove:mission` or `/dove:auto`.
14. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
15. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
16. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
