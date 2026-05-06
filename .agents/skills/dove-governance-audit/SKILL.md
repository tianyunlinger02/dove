---
name: dove-governance-audit
description: "Inspect Dove governance coverage proof from authoritative .dove state without mutating policy."
---

# Dove Governance Audit

- Treat `.dove/` as the authoritative durable root.
- Read governance coverage artifacts under `.dove/meta/`.
- Prefer `query_governance_coverage_report` through MCP.
- Return guarded vs exempt paths, bound commands/tools/functions, uncovered bindings, and negative-coverage gaps.
- Do not edit governance policy from this skill.
