# dove.paper.review

Run a strict single-pass review on `$REVIEW_SCOPE`.

## Goal

Inspect the current artifacts for unsupported claims, citation gaps, and outline drift, then append a durable review entry.

## Workflow

1. Read `.dove/state.json`, `.dove/orchestration/board.json`, `.dove/evidence/index.json`, `.dove/reviews/log.md`, `.dove/reviews/concerns.json`, `.dove/experiments/audits.json`, `.dove/claims/bridge-log.json`, `.dove/revision-plans/current-plan.md`, and the relevant draft files.
2. If `dove` MCP is available, prefer `run_review_loop` for evidence-aware review or `append_review_log` for a manual review record.
3. Convert new findings into blockers, persistent concerns, reviewer-vs-author response ownership, or rebuttal issues rather than leaving them only in prose.
4. Return the verdict, top findings, and the next command.
