# paper.experiment-plan

Create or refresh a claim-driven experiment plan.

## Goal

Maintain durable experiment plans and results under `.paper/experiments/` so claims, comparisons, and outcomes stay auditable.

## Workflow

1. Read `.paper/orchestration/board.json`, `.paper/evidence/index.json`, `.paper/experiments/plans.json`, `.paper/experiments/results.json`, and `.paper/experiments/EXPERIMENT_LOG.md`.
2. If `paper-factory` MCP is available, use `upsert_experiment_plan` and `upsert_experiment_result`.
3. Every experiment plan should name the target claim, methodology, success metric, and comparison targets.
4. Return which claim is now better supported and what remains blocked.
