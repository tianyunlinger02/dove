# Frontend Development Guidelines

> Project-facing package and operator-surface guidelines for this repository.

---

## Overview

This project has no browser frontend. The Trellis `frontend` layer documents Dove Research Format 1, its direct Skills, generated host adapters, runtime CLI and project integration, MCP tools, semantic entities, public research projection, and validation gates.

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Package surface organization and file layout | Filled |
| [Component Guidelines](./component-guidelines.md) | Skill, MCP, semantic entity, role, and host-policy ownership | Filled |
| [Hook Guidelines](./hook-guidelines.md) | Core helper pipelines and zero-write ambient entry | Filled |
| [State Management](./state-management.md) | Research state and public read/write boundaries | Filled |
| [Quality Guidelines](./quality-guidelines.md) | Validation scripts, inventory checks, and review rules | Filled |
| [Type Safety](./type-safety.md) | Runtime schema, projection, privacy, and language conventions | Filled |

## Pre-Development Checklist

- Always read Directory Structure, State Management, Type Safety, and Quality Guidelines.
- For Skills, adapters, CLI, MCP, or documentation changes, also read Component Guidelines.
- For helper pipelines or ambient entry, also read Hook Guidelines.
- For cross-layer contracts, read `../guides/cross-layer-thinking-guide.md`.
- Search all public and template references before changing a Skill ID, MCP tool name, semantic entity, inventory count, identifier, installation path, research format, or response-language rule.
- Keep every file in this directory identical to its matching `src/templates/markdown/spec/frontend/` copy.

## Project Reality

- Runtime: Node.js ESM (`.mjs`).
- Package release: `0.7.0`.
- Package entrypoint: `bin/dove.mjs`.
- Core logic: `src/core/`.
- MCP interface: `src/mcp/` and `mcp/dove-state-server.mjs`.
- Skill and host-policy source: `src/core/command-manifest.mjs`.
- Adapter renderer: `scripts/generate-command-adapters.mjs`.
- Public inventory: 9 direct Skills, 8 canonical MCP tools, and 45 generated adapters across five host formats.
- The three primary responsibilities remain Planner, Builder/Author, and Reviewer.
- Source is captured external material; Draft, Figure, and Rebuttal are host-produced project artifacts; Experiment records a frozen plan and its result; Review uses a user-managed separate exchange.
- Research Format 1 keeps semantic entities distinct: Workspace, root and child Missions, Mission conclusions, Sources, Experiment plans and results, Claims, Reviews, and the canonical Lessons document.
- Ambient routing is zero-write. It selects a responsibility and the smallest Skill but does not create a Mission or invoke a completion callback.
- The CLI is runtime-only: it manages installation, synchronization, diagnosis, MCP serving, and prompt-hook forwarding. It is not a fallback path for research operations and no runtime bundle is copied into consumer projects.
- `.dove/` is the single project-private root. `.dove/install/manifest.json` is managed installation state; the Research Format 1 siblings are optional research state.
- `.dove-install/` is legacy input only for project Upgrade or Complete Reinstall cleanup, never a current or compatibility root.
- Upgrade and Complete Reinstall are project-level operations and never manage the user's npm installation.
- Validation: `npm run check` and `npm run release:check`.

---

**Language**: All Trellis documentation must be written in English.
