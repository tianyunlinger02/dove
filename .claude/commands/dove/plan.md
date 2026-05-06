# dove.plan

Create or update the active Dove mission design plan.

## Workflow

1. Treat `.dove/` as the authoritative durable root.
2. Read the current mission, board, task packets, workspace index, and relevant action/context bundles.
3. Prefer the `upsert_plan` MCP tool when available.
4. Capture scope, non-goals, target artifacts, risks, evidence requirements, and acceptance checks.
5. Use `project:dove.paper.plan` only for paper-specific manuscript/claim/citation planning.
6. Do not execute work from this command; route execution through `project:dove.checklist`.
