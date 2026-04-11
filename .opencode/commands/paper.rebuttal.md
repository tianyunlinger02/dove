# paper.rebuttal

Prepare rebuttal notes from reviews and revision artifacts.

## Goal

Turn review findings and resolved actions into a durable rebuttal package under `.paper/rebuttal/` plus `.paper/drafts/rebuttal.md`.

## Workflow

1. Read `.paper/orchestration/board.json`, `.paper/reviews/log.md`, `.paper/revision-plans/current-plan.md`, `.paper/rebuttal/issues.json`, `.paper/rebuttal/strategy.md`, and `.paper/claims/CLAIMS_FROM_RESULTS.md`.
2. If `paper-factory` MCP is available, call `build_rebuttal_strategy` and `build_rebuttal`.
3. Summarize reviewer concerns, the evidence-backed response, and any remaining limitations.
4. Keep responses factual, scoped, and tied to artifacts.
