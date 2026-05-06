# dove.autonomy-operate

Run the explicit, bounded Dove autonomy operating surface.

## Workflow

1. Treat `.dove/` as the authoritative durable root.
2. Read current action context, workspace index, execution bridge candidates, follow-through ledger, campaign/approval state, and runtime controller state first.
3. Prefer `run_autonomy_operate` through MCP with explicit objective or source pair and planner-supervised bounds.
4. If MCP is unavailable, run `dove autonomy-operate . --objective "..."` or `dove autonomy-operate . --source-type execution-bridge --source-id <id>`.
5. Keep the run foreground-only and bounded; resume only from the returned stop summary and issue fresh approvals for later authority windows.
6. Do not turn this into a daemon, scheduler, hook, hidden executor, or unbounded queue drain.
