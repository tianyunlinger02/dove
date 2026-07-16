# Hook Guidelines

> Reusable file-backed helpers and workflow pipelines in Dove schema 8.

---

## Overview

There are no React hooks. Hook-like abstractions are narrow core helpers for strict workspace access, contained mutation, artifact integrity, ownership/lineage, and mission-bound workflows. Do not rely on process memory or implicit host hooks.

## Reusable Helper Patterns

- Resolve canonical contained paths before reading or writing.
- Open workspaces through the strict schema opener.
- Use `readJson` and `readText` only after the relevant contract establishes that a path is current and readable.
- Use `writeJson`, `writeText`, and `writeBinary` through an active mutation context.
- Use artifact integrity helpers to reject traversal, symlink escape, directories, empty evidence, bookkeeping evidence, and stale hashes.
- Use ownership and lineage helpers rather than duplicating mission-binding logic.
- Preflight the complete write set before applying the first mutation.

Before creating a helper, search `src/core/workspace.mjs`, `src/core/artifact-integrity.mjs`, `src/core/artifact-lineage.mjs`, `src/core/domain-artifacts.mjs`, and the relevant domain module.

## Data Flow

A mutation pipeline should be explicit:

1. Validate sealed boundary input.
2. Open the current schema 8 workspace.
3. Load and validate the mission contract.
4. Resolve canonical target and evidence paths.
5. Reassess hashes, source eligibility, ownership, lineage, and review coverage as required.
6. Build the complete deterministic write set.
7. Apply it through `patch-plan` or `direct-process` mutation context.
8. Return machine-checkable results without creating a secondary workflow mirror.

A read-only pipeline stops after assessment and must not repair, bootstrap, or refresh anything. Lesson query follows this rule. Lesson record follows the full proposal/exact-replay pipeline and remains advisory-only; it must not auto-capture, auto-recall, import transcripts, write Trellis/runtime state, or infer global provenance from global applicability.

## Naming Conventions

- Core functions are verb-first camelCase: `createDoveMission`, `queryDoveStatus`, `ingestExecutionReceipt`, `prepareReviewExchange`.
- Normalizers use `normalize<Name>` and validators use `validate<Name>` or `assert<Name>`.
- Query MCP tools use `query_*` or assessment verbs; mutation tools use explicit domain verbs such as `register_*`, `upsert_*`, `prepare_*`, `import_*`, `build_*`, or `create_*`.
- Avoid names that imply host orchestration, background execution, tiers, aliases, or compatibility behavior.

## Common Mistakes

- Reading durable JSON before strict workspace classification.
- Writing directly with `fs` when a mutation context and contained-write helper are required.
- Validating one output at a time and leaving partial state on later failure.
- Accepting a path without checking evidence role, realpath containment, and current hash.
- Creating a second index or lifecycle mirror when the answer can be derived from canonical artifacts.
- Adding fallback parsing for removed schema layouts.
