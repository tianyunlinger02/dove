# paper.approvals

Inspect, issue, or revoke explicit program approvals for bounded autonomous packet steps.

## Goal

Use `.paper/programs/approvals.json`, `.paper/programs/runs.json`, and `.paper/programs/index.json` to keep program approvals explicit, durable, and single-use without changing the one-step runtime model.

## Workflow

1. Read `.paper/programs/approvals.json`, `.paper/programs/runs.json`, `.paper/programs/index.json`, `.paper/task-packets/index.json`, and `.paper/workspace/index.json`.
2. If `paper-factory` MCP is available, call `query_program_approvals` to inspect the current approval state.
3. Issue a fresh approval only for an existing packet/program linkage that is ready to be re-armed for one bounded step.
4. When a prior run is already in `review-needed`, prefer issuing the next approval from its durable continuation intent instead of restitching packet/program/run metadata by hand.
5. Revoke an approval when execution authority should be withdrawn before the next explicit `autonomy-once` pass.
6. Treat approvals as governance bookkeeping, not execution: issuing or revoking approvals must never create packets, materialize work, or run autonomy by itself.
7. After a bounded step lands in `review-needed`, mint a fresh `programRunId` and `approvalId` before the next bounded continuation step.
8. The current bounded allowlist also includes `bridge-result-to-claim`; use it only when an approved audit and explicit bridge rationale are already durable.

## Rule

One approval authorizes one bounded step. Consumed or revoked approvals must not be silently reused.
