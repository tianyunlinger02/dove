# dove.paper.rebuttal

Prepare rebuttal notes from reviews and revision artifacts.

## Goal

Turn review findings and resolved actions into a durable rebuttal package under `.dove/rebuttal/` plus `.dove/drafts/rebuttal.md`.

## Workflow

1. Read `.dove/orchestration/board.json`, `.dove/reviews/log.md`, `.dove/revision-plans/current-plan.md`, `.dove/rebuttal/issues.json`, `.dove/rebuttal/strategy.md`, and `.dove/claims/CLAIMS_FROM_RESULTS.md`.
2. If `dove` MCP is available, call `build_rebuttal_strategy` and `build_rebuttal`.
3. Summarize reviewer concerns, the evidence-backed response, and any remaining limitations.
4. Keep responses factual, scoped, and tied to artifacts.
