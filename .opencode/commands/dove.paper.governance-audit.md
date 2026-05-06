# dove.paper.governance-audit

Inspect the paper-domain view of Dove governance coverage proof.

## Goal

Use `project:dove.governance-audit` semantics, scoped to paper writing, research, experiment, review, rebuttal, citation, figure, and version mutation surfaces.

## Workflow

1. Read `.dove/meta/governance-coverage.json`, `.dove/meta/governance-coverage-report.json`, `.dove/meta/LATEST_GOVERNANCE_COVERAGE_REPORT.md`, and the latest optimizer report.
2. If `dove` MCP is available, use `query_governance_coverage_report` for the current durable proof snapshot.
3. Highlight paper-domain guarded/exempt paths, bound commands/tools/functions, and any uncovered paper-specific bindings.

## Rule

This is a paper-domain view of `project:dove.governance-audit`; it does not change governance policy by itself.
