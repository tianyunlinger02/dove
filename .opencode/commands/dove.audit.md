# dove.audit

Inspect a Dove mission return without fixing or mutating durable state.

## Goal

Run strict no-fix inspection over the current compatibility-backed `.paper` workspace and report whether the mission has enough evidence, validation, review, and acceptance support to return safely.

## Workflow

1. Read `.paper/context/actions/current.json` when present, then `.paper/workspace/index.json`, `.paper/orchestration/board.json`, `.paper/state.json`, `.paper/task-packets/index.json`, and the mission's linked artifacts.
2. Treat `.paper/workspace/index.json.dove` as the Dove mission kernel summary when present; otherwise use the compatibility mapping from paper lifecycle families to Dove mission stages.
3. If `paper-factory` MCP is available, call `query_dove_audit` for Dove-shaped paper-compatible findings, return readiness, engineering evidence, review state, and checklist status.
4. Return findings as proposal-only mission audit items with severity, confidence, linked artifact paths, return readiness, and one compatible next command.
5. Do not write, repair, normalize, refresh, sync, materialize, update the board, append handoffs, generate revision plans, run tests, run review loops, or execute autonomy from this command.
6. If the operator wants fixes or execution, route to exactly one existing owner command such as `project:paper.checklist`, `project:paper.draft`, `project:paper.revise`, `project:paper.experiment-audit`, `project:paper.review-loop`, or `project:paper.version-snapshot`.

## Rule

`dove.audit` is a compatibility alias for Dove-style mission inspection. It is strict no-fix mode and must preserve existing `paper.audit` no-write guarantees.
