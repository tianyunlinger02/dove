# Quality Guidelines

> Code and package quality standards for `Dove`.

---

## Overview

Quality is enforced through package scripts, deterministic file-backed behavior, and tests that assert public surfaces remain complete. Before reporting implementation work as complete, run the relevant checks from `package.json`.

Primary commands:

```bash
npm run commands:validate
npm run mcp:validate
npm run governance:audit
npm test
npm run check
npm pack --dry-run
```

`npm run check` currently runs command validation, MCP validation, governance coverage audit, and the Node test suite.

---

## Forbidden Patterns

- Do not commit or report completed work with failing `npm run check` unless the failure is explicitly documented as unrelated and accepted by the user.
- Do not bypass validators or tests when adding command/MCP/governance surfaces.
- Do not add hidden daemons, hidden schedulers, or host-level hook interception. `README.md` lists those as intentionally out of scope.
- Do not let package install/sync overwrite user-owned `.dove/` data.
- Do not make `.dove/meta/*` optimizer output execute changes automatically; it is proposal-only until governed materialization/follow-through.
- Do not add command, skill, artifact, or MCP names in only one layer. Public surfaces must stay aligned across markdown, schema registries, handlers, validators, and tests.

---

## Required Patterns

- Keep durable workflow state file-first and resumable from `.dove/`.
- Prefer shared core functions for behavior exposed by CLI and MCP.
- Update governance registries when adding or changing mutation surfaces.
- Keep role ownership and override policy fields explicit for guarded mutations.
- Use deterministic JSON formatting (`JSON.stringify(value, null, 2)` plus newline) for written artifacts.
- Include real tests for new state, normalization, command lists, MCP surfaces, and governance coverage.

---

## Testing Requirements

Choose checks based on what changed:

- Command/skill prompt changes: `npm run commands:validate` and any relevant tests.
- MCP tool definitions or handlers: `npm run mcp:validate` and `tests/integration/mcp-tools.test.mjs`.
- Governance registries, guarded/exempt mutations, or follow-through logic: `npm run governance:audit` and relevant integration/unit tests.
- Lifecycle mirror changes across programs, campaigns, workspace summaries, runtime results, or navigation reports: add a focused transition test and run that subset before `npm run check`.
- Schema/default/normalizer changes: `tests/unit/schema.test.mjs` plus any affected integration tests.
- CLI install/sync/doctor behavior: integration tests under `tests/integration/` and `npm pack --dry-run` when package boundaries change.
- Broad changes: `npm run check`.

Examples of existing quality tests:

- `scripts/validate-commands.mjs` asserts all required command files and skill files exist and that every command surface is classified.
- `tests/integration/mcp-tools.test.mjs` asserts exact MCP tool names and role-bound policy fields.
- `tests/integration/workflow.test.mjs` validates a full durable paper workflow from workspace creation through sources, notes, claims, experiments, review, handoffs, snapshots, and comparisons.
- `tests/unit/schema.test.mjs` validates migration/default state behavior and exposed artifact paths.

---

## Code Review Checklist

- Are all new durable paths listed in `ARTIFACT_PATHS` and bootstrapped/normalized correctly?
- Are command IDs, MCP tool names, core function names, validators, and tests aligned?
- Are user-owned paths protected by workflow boundaries?
- Are role and policy semantics explicit for guarded mutations?
- Can the next operator resume from files without chat history?
- Are proposal-only surfaces still proposal-only?
- Did the appropriate npm validation/test command run successfully?

---

## Common Mistakes

- Updating `.opencode/commands/*.md` without updating validation lists or governance classification.
- Adding MCP input fields without checking tests that assert policy/approval/runtime fields.
- Fixing one layer of the package while leaving README, command text, context artifacts, and tests inconsistent.
- Using reference repos as implementation targets. `reference_repos/` is context only; project code lives in this package.
