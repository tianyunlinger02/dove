---
name: dove-autonomy-operate
description: "Run the explicit, foreground-only, bounded Dove autonomy operating surface with durable stop summaries."
---

# Dove Autonomy Operate

- Treat `.dove/` as the authoritative durable root.
- Read current action context, workspace index, execution bridge candidates, follow-through ledger, campaign/approval state, and runtime controller state first.
- Prefer `run_autonomy_operate` through MCP, or run `dove autonomy-operate . --objective "..."`.
- Keep the run foreground-only, planner-supervised, bounded, and resumable only from the returned stop summary.
- Do not turn this into a daemon, scheduler, hook, hidden executor, or unbounded queue drain.
