# paper.experiment-audit

Audit the integrity of a recorded experiment result.

## Goal

Persist an experiment audit in `.paper/experiments/audits.json` that is distinct from the raw experiment result and explicit about integrity flags, reviewed artifacts, and confidence.

## Workflow

1. Read `.paper/experiments/plans.json`, `.paper/experiments/results.json`, `.paper/experiments/audits.json`, and the linked evidence artifacts.
2. If `paper-factory` MCP is available, call `run_experiment_audit`.
3. Keep the audit file-first: integrity flags, reviewed artifact refs, audit findings, and confidence must be durable and queryable.
4. If the audit raises flags, convert them into review blockers or concerns before claiming the experiment cleanly supports a result.
