# dove.governance-audit

Inspect Dove governance coverage without mutating policy.

## Workflow

1. Treat `.dove/` as the authoritative durable root.
2. Read `.dove/meta/governance-coverage.json`, `.dove/meta/governance-coverage-report.json`, and `.dove/meta/LATEST_GOVERNANCE_COVERAGE_REPORT.md` when present.
3. Prefer `query_governance_coverage_report` through MCP.
4. Summarize guarded vs exempt paths, bound commands/tools/functions, uncovered bindings, and negative-coverage gaps.
5. Do not edit governance policy from this command.
