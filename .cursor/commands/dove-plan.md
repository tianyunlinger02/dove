# dove.plan

Create or update the active Dove mission design plan.

- Read `.dove/` mission, board, task-packet, workspace, and context artifacts first.
- Prefer `upsert_plan` when the Dove MCP server is available.
- Capture scope, non-goals, target artifacts, risks, evidence requirements, and acceptance checks.
- Use `project:dove.paper.plan` only for paper-specific manuscript, claim, citation, or venue planning.
- Do not execute work; route implementation through `project:dove.checklist`.
