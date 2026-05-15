---
name: dove-init
description: "Create or update the single project-level Dove goal as the unique level-0 task."
---

# Dove Init

Create or update the single project-level Dove goal as the unique level-0 task.

## Daily use

- Use this when the workspace needs its one global Dove goal or the goal wording needs an explicit refresh.
- Keep concrete work out of init; after init, route the actual request to mission or auto.
- Targeting: No task target is needed because init owns the unique level-0 root.
- Confirmation: Guarded mutation only; update the existing init instead of creating another root.
- Outcome: The workspace has one level-0 init task and the next practical command is mission or auto.

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
6. There is exactly one level-0 init task; update it instead of creating a second root.
7. Use init only for the global project goal, then route concrete work through `/dove:mission` or `/dove:auto`.
8. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
9. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
10. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
