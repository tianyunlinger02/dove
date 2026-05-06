# dove.paper.audit

Inspect the current paper workspace without fixing or mutating anything.

## Goal

Find evidence, citation, experiment, claim-bridge, review, version, figure, checklist, and artifact integrity problems while preserving strict audit-only behavior.

## Workflow

1. Read `.dove/context/actions/current.json` when present, then `.dove/orchestration/board.json`, `.dove/state.json`, `.dove/workspace/index.json`, `.dove/checklists/current.md`, `.dove/evidence/index.json`, `.dove/reviews/REVIEW_STATE.json`, `.dove/reviews/concerns.json`, `.dove/experiments/audits.json`, `.dove/claims/bridge-log.json`, `.dove/versions/comparisons.json`, and figure artifacts.
2. If `dove` MCP is available, call `query_paper_audit`.
3. Return findings with severity, confidence, linked artifact paths, and exactly proposal-only next-command suggestions.
4. Do not write, repair, normalize, refresh, sync, materialize, update the board, append handoffs, generate revision plans, or run review loops.
5. If the operator wants fixes, route to exactly one next command such as `project:dove.checklist`, `project:dove.paper.claim-gate`, `project:dove.paper.citations`, `project:dove.paper.experiment-audit`, `project:dove.paper.result-bridge`, `project:dove.paper.figure`, or `project:dove.paper.review-loop`.

## Rule

`dove.paper.audit` is strict no-fix mode: findings are `proposalOnly`, `noAutoApply`, and must not mutate `.dove/` even when malformed artifacts are detected.
