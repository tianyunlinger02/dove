# Type Safety

> Runtime type and schema safety patterns for Dove schema 7.

---

## Overview

Dove uses Node.js ESM JavaScript (`.mjs`), not TypeScript. Safety comes from sealed runtime inputs, strict durable schemas, canonical path checks, exact hashes, explicit mutation contexts, and tests that assert complete public contracts.

## Type Organization

- Keep schema versions, artifact paths, and governance registries in `src/core/schema.mjs`.
- Keep strict workspace classification and durable shape validation in `src/core/workspace-schema.mjs`.
- Keep mission proposal and exact replay validation in `src/core/mission-contracts.mjs`.
- Keep contained writes in `src/core/mutation-backend.mjs` and narrow IO helpers in `src/core/workspace.mjs`.
- Keep MCP input schemas in `src/mcp/tool-definitions.mjs`, schema evaluation in `src/mcp/schema-validation.mjs`, and exact dispatch in `src/mcp/handlers.mjs`.

## Required Validation Patterns

- Every public input object rejects unknown properties.
- Identifiers use explicit safe lowercase patterns.
- Timestamps must round-trip to the exact ISO-8601 string.
- SHA-256 values are lowercase 64-character digests.
- Durable paths must be canonical, project-contained, realpath-contained, and appropriate for their evidence role.
- Mission, workspace, contract, receipt, source, artifact, and review identities must match before writes.
- Proposal confirmation must replay the exact returned fields; no aliases or partial confirmation forms. Lesson replay also binds the recording mission, applicability scope, one of five kinds, content, evidence snapshots, artifact applicability, supersession, and timestamp.
- Read-only queries fail closed on malformed current JSON and never repair it.

## MCP Conventions

- Tool discovery exposes one sealed registry with no public/internal or operator tiers.
- Mutating tools include `mutationMode`; read-only tools do not.
- Nested object schemas also set `additionalProperties: false` and enumerate their fields.
- Domain mutation schemas require explicit `missionId`.
- Retired routing, role, lifecycle, policy-override, packet, board, runtime, and continuation fields are absent rather than ignored.

## Durable Schema Conventions

- Schema 7 has no compatibility loader for legacy business state.
- The strict opener accepts absent state only where explicitly permitted and accepts current state only when manifest, project, required directories, ownership, lineage, missions, and receipts validate.
- Current schema declarations that coexist with legacy workflow-control roots are contradictory and rejected.
- Completion, source trust, and Reviewer authority are reassessed from current evidence and fail closed when trusted proof is unavailable.

## Forbidden Patterns

- Do not introduce TypeScript syntax into `.mjs` files.
- Do not accept unsealed objects or silently discard unknown fields.
- Do not normalize unsafe path aliases into accepted durable references.
- Do not export mutation contexts, raw write helpers, or compatibility internals through the public package root.
- Do not add fallback parsing, migration, repair, or authority inference for removed schemas.
- Do not add a public command or MCP tool without aligned registry, handler, governance, validator, bundle, and test coverage.
- Do not accept lesson kinds outside `preference`, `constraint`, `method`, `failure`, and `review-insight`, or fields that imply automatic capture, recall, transcript ingestion, Trellis/runtime state, authority, or completion credit.
