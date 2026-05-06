# dove-checklist

Sync the active Dove mission checklist with durable workspace state.

- Authoritative durable root: `.dove/`.
- Read current action context, board, task packets, workspace index, plans, review state, and relevant mission artifacts.
- Prefer `sync_checklist` through MCP.
- Turn design-stage work into concrete implementation steps and acceptance checks.
- Never mark an item done unless durable files or explicit return evidence support it.
- Do not execute checklist items; route ready work to the owning generic Dove or paper-domain command.
