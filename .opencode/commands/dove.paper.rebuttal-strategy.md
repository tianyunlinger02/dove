# dove.paper.rebuttal-strategy

Turn review findings into a durable rebuttal issue board and response strategy.

## Goal

Keep `.dove/rebuttal/issues.json`, `.dove/rebuttal/strategy.md`, and `.dove/rebuttal/response-draft.md` current before polishing the rebuttal section.

## Workflow

1. Read `.dove/orchestration/board.json`, `.dove/reviews/log.md`, `.dove/reviews/REVIEW_STATE.json`, `.dove/rebuttal/issues.json`, and `.dove/claims/CLAIMS_FROM_RESULTS.md`.
2. If `dove` MCP is available, use `normalize_rebuttal_issues` and `build_rebuttal_strategy`.
3. Separate issues that need evidence or experiments from issues that only need clarification.
4. Return the top rebuttal risks and the next revision or versioning command.
