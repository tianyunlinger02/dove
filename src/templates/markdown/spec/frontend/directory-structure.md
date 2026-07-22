# Directory Structure

> Project-facing surface and module organization for `Dove` schema 9.

---

## Overview

This repository has no browser frontend. The Trellis `frontend` layer documents Dove's user-facing package surfaces: generated multi-host command adapters, the three primary OpenCode responsibility skills, CLI commands, MCP tools, and sealed `.dove/` artifacts.

## Directory Layout

```text
.
├── .opencode/commands/       # Generated OpenCode command adapters
├── .opencode/skills/         # Planner, Builder, and Reviewer skills
├── .cursor/commands/         # Generated Cursor adapters
├── .codex/skills/            # Generated Codex adapters
├── .agents/skills/           # Generated shared-agent adapters
├── bin/                      # CLI executable
├── docs/                     # Package documentation
├── mcp/                      # Thin MCP executable wrapper
├── scripts/                  # Generators and validation gates
├── src/
│   ├── core/                 # Schema 9 mission, receipt, domain, review, and workspace logic
│   └── mcp/                  # MCP definitions, dispatch, validation, and server
└── tests/
    ├── integration/
    └── unit/
```

A user workspace contains only schema 9 identity, mission, advisory lesson, receipt, source, note, claim, experiment, draft, figure, review, rebuttal, and version artifacts. Ownership and lineage are derived from the immutable receipt ledger rather than persisted as current mirror files.

## Module Organization

- Keep canonical paths and governance registries in `src/core/schema.mjs`.
- Keep strict workspace classification and initialization in `src/core/workspace-schema.mjs` and `src/core/workspace-init.mjs`.
- Keep mission proposal/materialization in `src/core/mission-contracts.mjs`, read-only status in `src/core/mission-queries.mjs`, and explicit advisory lesson query/record in `src/core/lessons.mjs`.
- Keep execution evidence in `src/core/execution-receipts.mjs` and ownership/lineage in narrow artifact modules.
- Keep domain workflows in `src/core/retained-domain-workflows.mjs`, source trust in `src/core/source-trust.mjs`, and review exchange in `src/core/review-exchange.mjs`.
- Define MCP schemas in `src/mcp/tool-definitions.mjs` and dispatch exact names in `src/mcp/handlers.mjs`.
- Define command and host-adapter metadata in `src/core/command-manifest.mjs`; regenerate adapters rather than editing them by hand.
- Treat `.dove/` as user-owned durable state. Install and sync must not initialize, repair, convert, or overwrite it.

## Naming Conventions

- Node.js modules use ESM `.mjs` and descriptive kebab-case filenames.
- Public command IDs are the twelve flat `dove.<surface>` entries in `COMMAND_SURFACES`; the generator emits 48 checked-in project adapters plus 12 Claude user commands, 60 combined.
- MCP tool names are snake_case and core functions are camelCase.
- Durable artifact paths come from `ARTIFACT_PATHS`; do not scatter ad hoc `.dove/...` constants.
- Mission-bound mutations require explicit mission identity and current artifact evidence.

## Forbidden Patterns

- Do not add compatibility roots, aliases, fallbacks, or hidden callable surfaces.
- Do not add task catalogs, boards, routes, queues, leases, campaigns, background continuation, or host orchestration mirrors.
- Do not package extra role skills that reintroduce removed workflow-control state.
- Do not put durable invariants only in prompts; enforce them in core code and tests.
- Do not add a command or MCP tool in only one layer.
- Do not hand-edit generated adapters.
- Do not let install or sync mutate user-owned `.dove/` state.
