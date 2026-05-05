# dove.paper.follow-through

Inspect or record explicit operator follow-through decisions for proposal-only remediation guidance.

## Goal

Use `.dove/meta/operator-follow-through.json` to keep durable operator decisions explicit when remediation packs, family playbooks, or execution bridge candidates are acknowledged, deferred, accepted for execution, accepted as risk, closed, or superseded.

## Workflow

1. Read `.dove/meta/operator-follow-through.json`, `.dove/meta/remediation-packs.json`, `.dove/meta/operator-playbooks.json`, `.dove/meta/execution-bridge-candidates.json`, `.dove/meta/LATEST_OPTIMIZER_REPORT.md`, and `.dove/workspace/index.json`.
2. If `dove` MCP is available, use `query_operator_follow_through` to inspect the ledger or `record_operator_follow_through` to append/update a durable operator decision.
3. Keep every record explicit and proposal-only. Recording follow-through never auto-creates packets, checklist items, revision tasks, or config changes; use `project:dove.paper.materialize` only when you intentionally want to cross into one real task packet.
4. For `accepted-for-execution`, always provide both an execution deadline and a review checkpoint so overdue or unreviewed execution intent becomes visible to governance, runtime, workspace, and doctor surfaces.
5. Treat this ledger as the explicit autonomy request surface: accepted, executing, stale, overdue, due-review, deferred, and escalated states are what the bounded autonomous controller inspects before it can safely run, supervise one bounded role envelope, materialize one governed planned target, or bind a packet to an approved program run with an explicitly allowed step type.
6. When a program-linked step ends in `review-needed`, inspect the linked program run checkpoint before recording any fresh approval; consumed approvals are intentionally not reusable across invocations.
7. Use `dove.paper.approvals` / `query_program_approvals` to inspect approval state before minting the next fresh approval for the same program lineage.

## Rule

Every deferred, accepted-risk, or closed record should carry enough rationale or closure evidence that another operator can understand why the decision was made.
