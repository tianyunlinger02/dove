# paper.follow-through

Inspect or record explicit operator follow-through decisions for proposal-only remediation guidance.

## Goal

Use `.paper/meta/operator-follow-through.json` to keep durable operator decisions explicit when remediation packs, family playbooks, or execution bridge candidates are acknowledged, deferred, accepted for execution, accepted as risk, closed, or superseded.

## Workflow

1. Read `.paper/meta/operator-follow-through.json`, `.paper/meta/remediation-packs.json`, `.paper/meta/operator-playbooks.json`, `.paper/meta/execution-bridge-candidates.json`, `.paper/meta/LATEST_OPTIMIZER_REPORT.md`, and `.paper/workspace/index.json`.
2. If `paper-factory` MCP is available, use `query_operator_follow_through` to inspect the ledger or `record_operator_follow_through` to append/update a durable operator decision.
3. Keep every record explicit and proposal-only. Recording follow-through never auto-creates packets, checklist items, revision tasks, or config changes.

## Rule

Every deferred, accepted-risk, or closed record should carry enough rationale or closure evidence that another operator can understand why the decision was made.
