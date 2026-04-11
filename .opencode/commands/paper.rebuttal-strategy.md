# paper.rebuttal-strategy

Turn review findings into a durable rebuttal issue board and response strategy.

## Goal

Keep `.paper/rebuttal/issues.json`, `.paper/rebuttal/strategy.md`, and `.paper/rebuttal/response-draft.md` current before polishing the rebuttal section.

## Workflow

1. Read `.paper/orchestration/board.json`, `.paper/reviews/log.md`, `.paper/reviews/REVIEW_STATE.json`, `.paper/rebuttal/issues.json`, and `.paper/claims/CLAIMS_FROM_RESULTS.md`.
2. If `paper-factory` MCP is available, use `normalize_rebuttal_issues` and `build_rebuttal_strategy`.
3. Separate issues that need evidence or experiments from issues that only need clarification.
4. Return the top rebuttal risks and the next revision or versioning command.
