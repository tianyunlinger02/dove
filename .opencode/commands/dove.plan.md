# dove.plan

Create or update the active Dove mission design plan.

## Goal

Use the shared Dove design surface to capture mission scope, non-goals, target artifacts, risks, required evidence, and acceptance checks before execution starts.

## Workflow

1. Read `.dove/context/actions/current.json` when present, then `.dove/state.json`, `.dove/workspace/index.json`, `.dove/orchestration/board.json`, `.dove/task-packets/index.json`, and relevant artifact context files.
2. Clarify the mission domain, lifecycle stage, target artifacts, evidence requirements, risks, and acceptance checks.
3. If `dove` MCP is available, call `upsert_plan` with the planned sections and explicit acceptance checks.
4. Route paper-specific structure, claims, citations, venue strategy, and manuscript work through `project:dove.paper.plan` when the mission domain is paper.
5. After the plan is durable, route executable work through `project:dove.checklist` before implementation.

## Rule

Planning records the design contract; it must not execute the work, run autonomy, or mark checklist items complete by itself.
