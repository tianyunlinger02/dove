# dove.approvals

Inspect, issue, or revoke explicit Dove program approvals.

## Workflow

1. Treat `.dove/` as the authoritative durable root.
2. Read program approvals, program runs, runtime continuation state, controller state, and task packets.
3. Prefer `query_program_approvals` for inspection.
4. Use `issue_program_approval` only to authorize one explicit bounded continuation.
5. Use `revoke_program_approval` to withdraw an existing approval.
6. Do not execute autonomy, materialize packets, or continue runs from this command.
