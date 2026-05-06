# dove.approvals

Inspect, issue, or revoke explicit Dove program approvals.

- Read `.dove/programs/approvals.json`, `.dove/programs/runs.json`, `.dove/runtime/continuation.json`, and linked packet state first.
- Prefer `query_program_approvals` for inspection.
- Use `issue_program_approval` only for one explicit bounded continuation.
- Use `revoke_program_approval` to withdraw authority.
- Do not execute autonomy, materialize packets, or continue runs from this command.
