# paper.plan

Create or refresh the durable paper plan.

## Goal

Write `.paper/plans/current-plan.md` so it reflects the thesis, audience, section strategy, evidence gaps, milestones, and figure needs.

## Workflow

1. Read `.paper/state.json`, `.paper/orchestration/board.json`, `.paper/claims/CLAIMS_FROM_RESULTS.md`, `.paper/wiki/index.md`, and `.paper/findings.md`.
2. If `paper-factory` MCP is available, call `upsert_plan`.
3. Keep the plan evidence-aware: gaps, blockers, and role-owned board tasks stay explicit instead of being smoothed over.
4. Point to the next drafting, experiment, or review command.
