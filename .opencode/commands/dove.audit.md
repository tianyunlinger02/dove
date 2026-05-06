# dove.audit

Inspect a Dove mission without fixing or mutating durable state.

## Goal

Report mission audit findings and return readiness from authoritative `.dove/` state and declared evidence paths, while preserving strict proposal-only behavior.

## Workflow

1. Read `.dove/context/actions/current.json` when present, then `.dove/workspace/index.json`, `.dove/orchestration/board.json`, `.dove/task-packets/index.json`, `.dove/checklists/current.md`, `.dove/reviews/REVIEW_STATE.json`, `.dove/reviews/concerns.json`, `.dove/experiments/audits.json`, `.dove/claims/bridge-log.json`, `.dove/versions/comparisons.json`, and linked mission-packet or artifact manifests.
2. If the `dove` MCP server is available, call `query_dove_audit` with the mission domain/stage, target artifacts, acceptance checks, declared changed-file paths, test/validation evidence paths, validation output paths or text, and review evidence paths.
3. Report audit verdict, severity counts, category counts, findings, return readiness, engineering evidence, and one next command.
4. Keep strict no-fix behavior: findings may route work, but this command never applies repairs.
5. Do not write, repair, refresh, run tests, inspect git, execute autonomy, update the board, append handoffs, or materialize mission packets.
