---
name: dove-approvals
description: "Inspect, issue, or revoke explicit Dove program approvals without executing autonomy."
---

# dove.approvals

Use this skill to manage bounded program-run authority.

- Read program approvals, runs, runtime continuation state, controller state, and packet state first.
- Prefer `query_program_approvals` for inspection.
- Use `issue_program_approval` only for explicit bounded continuation authority.
- Use `revoke_program_approval` to withdraw approval.
- Do not run autonomy, materialize packets, or continue a run from this skill.
