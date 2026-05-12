---
name: dove-mission
description: "Propose a task under the init goal, then create it only after explicit operator confirmation."
---

# Dove Mission

Propose a task under the init goal, then create it only after explicit operator confirmation.

## Contract

- Command id: `dove.mission`
- Domain: `generic`
- Category: `mutation`
- Policy: `explicit-approval`

## Workflow

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Follow Dove's response language preference from `.dove/config.json`, `.dove/config.local.json`, or `.dove/state.json.settings.responseLanguage`; supported values are `zh` for Chinese and `en` for English, and the default is `zh`.
3. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/config.json`, `.dove/config.local.json`, `.dove/state.json`, `.dove/task-packets/index.json`, `.dove/meta/operator-lessons.json`.
4. Prefer the `create_dove_task` MCP tool when available.
5. Require explicit operator approval before creating or changing durable workflow state or consuming bounded authority.
6. Require an existing init goal before proposing mission tasks.
7. Return a proposal-only mission contract first: title, stage, domain, level, dependencies, blockers, evidence expectations, and recommended next command.
8. Ask for explicit operator confirmation before passing `confirmed: true` to `create_dove_task` and writing a durable task packet.
9. Classify each task as `plan`, `execute`, or `audit` and as `paper`, `experiment`, or `engineering` before writing.
10. User-created tasks default to level 3; only system-created prerequisite/controller tasks may be level 1 or 2.
11. Do not execute the task from this surface; after confirmation, return the created task, blockers, evidence expectations, and recommended next command.
12. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
13. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
14. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
