# dove.paper.approvals

Paper-domain view of `project:dove.approvals` for bounded autonomous paper packet steps.

## Goal

Use the generic Dove approval surface while keeping paper-specific packet, claim, experiment, review, and rebuttal context visible to the operator.

## Workflow

1. Read `.dove/context/actions/current.json` when present, then `.dove/programs/approvals.json`, `.dove/programs/runs.json`, `.dove/programs/index.json`, `.dove/task-packets/index.json`, `.dove/workspace/index.json`, and relevant paper artifacts.
2. Prefer `project:dove.approvals` for the canonical approval workflow.
3. If `dove` MCP is available, call `query_program_approvals` to inspect active approvals and review checkpoints.
4. To authorize one paper-domain bounded continuation, call `issue_program_approval` with explicit packet, program run, worker role, allowed step bounds, `executeBy`, and `reviewAfter` fields.
5. To withdraw authority, call `revoke_program_approval` with `approvalId`, `actorRole`, and a concrete reason.
6. Keep paper-specific approval context tied to durable claim, experiment, review, rebuttal, or draft artifacts; do not create a parallel paper-only approval system.

## Rule

One approval authorizes one bounded step. This paper view must not execute autonomy, materialize packets, or silently reuse consumed or revoked approvals.
