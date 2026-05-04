# paper.audit

Inspect the current paper workspace without fixing or mutating anything.

## Goal

Find evidence, citation, experiment, claim-bridge, review, version, figure, checklist, and artifact integrity problems while preserving strict audit-only behavior.

## Workflow

1. Read `.paper/context/actions/current.json` when present, then `.paper/orchestration/board.json`, `.paper/state.json`, `.paper/workspace/index.json`, `.paper/checklists/paper.md`, `.paper/evidence/index.json`, `.paper/reviews/REVIEW_STATE.json`, `.paper/reviews/concerns.json`, `.paper/experiments/audits.json`, `.paper/claims/bridge-log.json`, `.paper/versions/comparisons.json`, and figure artifacts.
2. If `paper-factory` MCP is available, call `query_paper_audit`.
3. Return findings with severity, confidence, linked artifact paths, and exactly proposal-only next-command suggestions.
4. Do not write, repair, normalize, refresh, sync, materialize, update the board, append handoffs, generate revision plans, or run review loops.
5. If the operator wants fixes, route to exactly one next command such as `project:paper.checklist`, `project:paper.claim-gate`, `project:paper.citations`, `project:paper.experiment-audit`, `project:paper.result-bridge`, `project:paper.figure`, or `project:paper.review-loop`.

## Rule

`paper.audit` is strict no-fix mode: findings are `proposalOnly`, `noAutoApply`, and must not mutate `.paper/` even when malformed artifacts are detected.
