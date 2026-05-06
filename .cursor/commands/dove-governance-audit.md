# dove-governance-audit

Inspect Dove governance coverage without mutating policy.

- Authoritative durable root: `.dove/`.
- Read governance coverage artifacts under `.dove/meta/`.
- Prefer `query_governance_coverage_report` through MCP.
- Summarize guarded vs exempt paths, bound commands/tools/functions, uncovered bindings, and negative-coverage gaps.
- Do not edit governance policy from this command.
