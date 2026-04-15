# paper.governance-audit

Inspect the durable governance coverage proof for guarded and exempt mutation paths.

## Goal

Use `.paper/meta/governance-coverage.json`, `.paper/meta/governance-coverage-report.json`, and `.paper/meta/LATEST_GOVERNANCE_COVERAGE_REPORT.md` to verify that mutation governance coverage is complete, explicit, and auditable.

## Workflow

1. Read the governance coverage artifacts and the latest optimizer report.
2. If `paper-factory` MCP is available, use `query_governance_coverage_report` for the current durable proof snapshot.
3. Confirm guarded vs exempt paths, bound commands/tools/functions, and whether any uncovered bindings or negative-coverage gaps remain.

## Rule

Treat this command as audit/proof, not execution. It does not change governance policy by itself.
