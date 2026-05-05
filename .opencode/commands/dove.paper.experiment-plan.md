# dove.paper.experiment-plan

Create or refresh a claim-driven experiment plan.

## Goal

Maintain durable experiment plans and results under `.dove/experiments/` so claims, comparisons, and outcomes stay auditable.

## Workflow

1. Read `.dove/orchestration/board.json`, `.dove/evidence/index.json`, `.dove/experiments/plans.json`, `.dove/experiments/results.json`, and `.dove/experiments/EXPERIMENT_LOG.md`.
2. If `dove` MCP is available, use `upsert_experiment_plan` and `upsert_experiment_result`.
3. Every experiment plan should name the target claim, methodology, success metric, and comparison targets.
4. Return which claim is now better supported and what remains blocked.
