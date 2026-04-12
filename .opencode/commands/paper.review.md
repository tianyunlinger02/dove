# paper.review

Run a strict single-pass review on `$REVIEW_SCOPE`.

## Goal

Inspect the current artifacts for unsupported claims, citation gaps, and outline drift, then append a durable review entry.

## Workflow

1. Read `.paper/state.json`, `.paper/orchestration/board.json`, `.paper/evidence/index.json`, `.paper/reviews/log.md`, `.paper/reviews/concerns.json`, `.paper/experiments/audits.json`, `.paper/claims/bridge-log.json`, `.paper/revision-plans/current-plan.md`, and the relevant draft files.
2. If `paper-factory` MCP is available, prefer `run_review_loop` for evidence-aware review or `append_review_log` for a manual review record.
3. Convert new findings into blockers, persistent concerns, or rebuttal issues rather than leaving them only in prose.
4. Return the verdict, top findings, and the next command.
