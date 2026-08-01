# Type Safety

> Runtime schema and public-boundary safety for Dove.

---

## Overview

Dove uses Node.js ESM JavaScript rather than TypeScript. Safety comes from sealed public schemas, exact inventories, contained paths, current evidence checks, deterministic operation metadata, and narrow public projection.

## Ownership

- `src/core/command-manifest.mjs` owns the 12 direct Skill definitions and host projections.
- `src/mcp/tool-definitions.mjs` owns the 14 sealed MCP tool schemas.
- `src/mcp/handlers.mjs` owns operation dispatch and one-based selector resolution.
- `src/core/operation-registry.mjs` owns continuation and closure metadata.
- `src/core/schema.mjs` owns durable path and governance registries.
- `src/core/public-reports.mjs` owns safe human and machine channels.

## Layer Types

Use precise vocabulary:

- **Skill**: direct host workflow with optional text.
- **MCP tool**: sealed structured operation.
- **Durable entity**: validated current state under `.dove/`.

Do not create implied type equality between these layers. `dove.note` has no Note entity, and `dove.experience` has no Experience sidecar entity.

## Required Validation

- Every public input object rejects unknown properties.
- Nested MCP objects are sealed.
- Public Mission selectors are explicit one-based integers.
- Root and child creation validate parent selection, branch provenance, and current Workspace binding.
- Paths, timestamps, safe labels, evidence references, and integrity values are validated before writes.
- Read-only calls fail closed without repair or conversion.
- Experiment results exactly match the frozen protocol and declared checks.
- Claims exactly match current experiment evidence and evaluated scope.
- Public reports omit durable IDs, hashes, private paths, mutation controls, and callback internals.
- Typed closure requests expose only the fixed tool, public bound arguments, declared dynamic fields, defaults, and exactly-once semantics.

## Inventory Types

Validation treats these as separate exact sets:

- 12 direct Skill IDs;
- 14 MCP tool names;
- 60 generated adapter paths;
- three generated Claude ambient paths;
- canonical native Reviewer definitions; and
- durable entity kinds.

Generated adapter presence is not a host-readiness type.

## Current Durable Vocabulary

Current state uses Workspace, Mission, ResearchDecision, Receipt, artifact handoff, Source, Claim, Experiment, Draft, Figure, Review, Rebuttal, and Lesson records.

ResearchTree, Note-store, Experience-sidecar, migration-state, compatibility-root, and fallback-runtime types are not part of the current public or durable model.

## Language

Canonical human output defaults to Chinese and may be explicitly requested in English. Machine keys, tool names, Skill IDs, and status tokens remain English.
