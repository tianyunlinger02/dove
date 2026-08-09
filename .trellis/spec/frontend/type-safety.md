# Type Safety

> Runtime schema and public-boundary safety for Dove Research Format 1.

---

## Overview

Dove uses Node.js ESM JavaScript rather than TypeScript. Safety comes from sealed public schemas, exact inventories, semantic identifiers, contained paths, immutable records, artifact fingerprints, current evidence checks, and narrow public projection.

## Ownership

- `src/core/command-manifest.mjs` owns the 9 direct Skill definitions and host projections.
- `src/mcp/tool-definitions.mjs` owns the 8 sealed MCP tool schemas.
- `src/mcp/research-adapter.mjs` owns public-operation adaptation.
- `src/mcp/handlers.mjs` owns dispatch, path normalization, and safe projection.
- `src/core/schema.mjs` owns the package version, Research Format marker, and durable paths.
- `src/core/workspace-schema.mjs` owns format classification and Workspace validation.
- `src/core/research-stores.mjs` owns semantic entity validation and persistence.
- Project-installation modules own `.dove/install/manifest.json` independently from the optional Research Format 1 siblings.

## Layer Types

Use precise vocabulary:

- **Skill**: direct host workflow with optional text.
- **MCP tool**: sealed structured research operation.
- **Semantic entity**: validated Research Format 1 state under `.dove/`.
- **Project artifact**: host-produced substantive file in a normal project path.
- **Installation resource**: managed host integration recorded by `.dove/install/manifest.json`.

Do not create implied type equality between these layers. Draft, Figure, Rebuttal, and internal synthesis are not same-named semantic entities.

## Required Validation

- Every public input object rejects unknown properties.
- Nested MCP objects that form contracts are sealed.
- Durable references use safe lowercase semantic IDs rather than positional selectors.
- Root and child Mission creation validates parent and dependency existence, explicit branch provenance, and acyclic lineage.
- Mission contracts, conclusions, Sources, Experiment plans/results, Claims, and Reviews are immutable once written.
- Paths are normalized project-relative paths and cannot escape the workspace or point into Dove bookkeeping unless the core explicitly owns that path.
- Source captures and Review scopes bind current file size and SHA-256 evidence where required.
- Experiment results require a prior persisted plan and exact Mission binding.
- Claims require support references and explicit cannot-say boundaries.
- Failed or stopped experiments preserve failures or limitations.
- Read-only calls fail closed without repair, conversion, or hidden writes.
- Public projection removes `.dove/` paths, write diagnostics, review snapshot hashes, and fields ending in `Digest`, `Token`, or `Binding`.
- Review import validates the prepared exchange and structured return; it cannot mint reviewer authority or independence.

## Inventory Types

Validation treats these as separate exact sets:

- 9 direct Skill IDs;
- 8 MCP tool names;
- 45 generated adapter paths;
- managed Claude ambient resources;
- Planner, Builder/Author, and Reviewer responsibility definitions;
- Research Format 1 semantic entity kinds;
- project artifact paths; and
- installation manifest resources.

Generated adapter presence is not a host-readiness type.

## Current Semantic Vocabulary

Research Format 1 uses Workspace, Mission, Mission conclusion, Source, Experiment plan, Experiment result, Claim, Review, and Lessons entities. Mission lineage is the research tree view, not another entity type. Draft, Figure, Rebuttal, and internal synthesis remain project artifacts.

Do not describe retired revision, execution-bookkeeping, private-protocol, positional-selection, or duplicate-tree models as current types.

## Format and Installation Boundaries

The package release is `0.7.0`, and the research format marker is `dove-research-v1`. Package semver and Research Format identity are separate boundaries. `.dove/install/manifest.json` has its own installation schema, integration, ownership, and runtime protocol fields; those validate managed integration and do not validate the optional sibling Research Format files under `.dove/`.

`.dove-install/manifest.json` is accepted only as legacy project-lifecycle input for Upgrade or Complete Reinstall cleanup. It is not a current installation type, secondary root, alias, or compatibility authority. Those project-level operations do not manage the user's npm installation.

A legacy numbered workspace schema may be detected only to refuse research writes clearly. It is not a current format, migration input, fallback type, or compatibility authority.

## Language

Canonical human output defaults to Chinese and may be explicitly requested in English. Machine keys, tool names, Skill IDs, semantic IDs, format markers, and status tokens remain English.
