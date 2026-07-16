# Quality Guidelines

> Code and package quality standards for Dove schema 8.

---

## Primary Gates

Run the checks relevant to the change, and run `npm run check` for broad Phase changes.

```bash
npm run build:check
npm run commands:check
npm run commands:validate
npm run mcp:validate
npm run workflow-goals:validate
npm run governance:audit
npm test
npm run check
npm run doctor:validate
npm run release:check
npm run pack:dry-run
```

`npm run check` verifies generated bundles and adapters, command surfaces, MCP registry and schemas, workflow goals, governance bindings, and the full Node test suite.

## Required Patterns

- Keep the public command inventory flat and exact across all generated hosts.
- Keep MCP discovery as one sealed registry with exact tool names and no tiers.
- Keep the public package root narrow; do not export raw mutation contexts, write helpers, strict-opener internals, or compatibility utilities.
- Keep proposal and query operations zero-write.
- Validate complete write sets before the first mutation.
- Bind receipts and domain artifacts to current workspace, mission, contract digest, canonical path, hash, ownership, and lineage.
- Keep source and Reviewer authority fail closed without a trusted issuer capability.
- Rebuild checked-in bundles after source changes and regenerate adapters after manifest changes.
- Package only current public adapters, the three primary OpenCode responsibility skills, public docs, and standalone bundles.

## Required Tests

Broad schema 8 changes should cover:

- physical deletion and static unreachability of retired modules and callables;
- exact CLI, command, package, and MCP inventories: 12 commands, 27 MCP tools, and 60 combined generated adapters;
- zero-write absent reads, proposals, preflights, assessments, and rejected confirmations;
- strict opener handling for absent, malformed, legacy, future, contradictory, and symlinked state;
- exact confirmation replay and stale workspace, contract, target, source-tree, or mutation-mode rejection;
- receipt path, hash, criterion, ownership, lineage, and immutable-id boundaries;
- cross-mission and stale-artifact rejection before writes;
- review scope, privacy, canonical path, artifact-set hash, handoff/report hash, duplicate import, and fail-closed authority;
- explicit zero-write lesson queries, exact-confirmation recording, five kinds, mission provenance versus global applicability, advisory-only boundaries, and absence of automatic capture/recall/transcript/Trellis/runtime integration;
- package install/sync preservation of user-owned `.dove/` state;
- generated bundle and adapter drift.

## Forbidden Patterns

- Do not bypass or weaken validators after deleting tests.
- Do not retain legacy modules, public aliases, hidden tiers, renamed workflow-control state, or compatibility loaders.
- Do not package stale role skills that reference removed board, packet, runtime, context, meta, wiki, mutation-ledger, or program artifacts.
- Do not let bookkeeping artifacts satisfy mission target or evidence requirements.
- Do not add daemons, schedulers, background loops, automatic continuation, or hidden host hooks.
- Do not let install/sync initialize, repair, convert, or overwrite user-owned `.dove/` data.
- Do not report completion with a failing `npm run check` unless the user explicitly accepts a documented unrelated failure.

## Review Checklist

- Are all durable paths canonical and declared by schema 8?
- Are legacy roots rejected when they coexist with a current manifest?
- Are public exports, CLI commands, generated adapters, MCP tools, governance bindings, and tests aligned?
- Are nested MCP objects sealed?
- Are proposals and read-only paths demonstrably zero-write?
- Are receipts and completion based on substantive current evidence rather than bookkeeping?
- Is Reviewer authority impossible to mint from public handoff fields?
- Are standalone package bundles current and free of retired callables and modules?
- Did `npm run check` pass?
