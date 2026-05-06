# dove.checklist

Sync the active Dove mission checklist with durable workspace state.

## Workflow

1. Treat `.dove/` as the authoritative durable root.
2. Read the current action context, board, task packets, workspace index, plans, review state, and relevant mission artifacts.
3. Prefer the `sync_checklist` MCP tool when available.
4. Turn design-stage work into concrete implementation steps and acceptance checks.
5. Never mark an item done unless durable files or explicit return evidence support it.
6. Do not execute checklist items; route ready work to the owning generic Dove or paper-domain command.
