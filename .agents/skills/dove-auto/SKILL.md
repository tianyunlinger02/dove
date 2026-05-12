---
name: dove-auto
description: "Start with mission-style intake, then after confirmation automatically execute the task until completion or a boundary is reached."
---

# Dove Auto

Start with mission-style intake, then after confirmation automatically execute the task until completion or a boundary is reached.

## Contract

- Command id: `dove.auto`
- Domain: `generic`
- Category: `mutation`
- Policy: `explicit-approval`

## Workflow

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Follow Dove's response language preference from `.dove/config.json`, `.dove/config.local.json`, or `.dove/state.json.settings.responseLanguage`; supported values are `zh` for Chinese and `en` for English, and the default is `zh`.
3. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/config.json`, `.dove/config.local.json`, `.dove/state.json`, `.dove/task-packets/index.json`, `.dove/runtime`, `.dove/meta/operator-lessons.json`.
4. Prefer the `run_dove_auto` MCP tool when available.
5. Require explicit operator approval before creating or changing durable workflow state or consuming bounded authority.
6. Use the same intake and classification model as `/dove:mission` before autonomous execution starts.
7. Require explicit operator confirmation before execution beyond task creation or selection.
8. May internally call public Dove workflows such as source, note, experience, figure, draft, review, review-loop, rebuttal, lessons, and status as needed.
9. Stop at completed, blocked, killed, authority/review boundary, missing provider credentials, conflicting packet target, or step-budget exhaustion.
10. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
11. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
12. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
