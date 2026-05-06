# dove.approvals

Inspect, issue, or revoke explicit Dove program approvals for bounded autonomous packet steps.

## Goal

Use the generic Dove approval surface to keep program-run authority explicit, fresh, bounded, and auditable before any foreground autonomy continuation.

## Workflow

1. Read `.dove/context/actions/current.json`, `.dove/programs/approvals.json`, `.dove/programs/runs.json`, `.dove/runtime/continuation.json`, `.dove/runtime/controller-state.json`, and `.dove/task-packets/index.json` first.
2. If `dove` MCP is available, call `query_program_approvals` to inspect active approvals and review checkpoints.
3. To authorize one bounded continuation, call `issue_program_approval` with explicit `packetId`, `programRunId`, `actorRole`, `workerRole`, allowed step bounds, `executeBy`, and `reviewAfter`.
4. To withdraw authority, call `revoke_program_approval` with `approvalId`, `actorRole`, and a concrete reason.
5. Treat `dove.paper.approvals` as a paper-domain view of this same approval surface, not as a separate approval system.

## Rule

Approvals authorize later bounded work; this command must not execute autonomy, materialize packets, or silently continue a run.
