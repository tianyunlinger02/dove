# Frontend Development Guidelines

> Project-facing package and operator-surface guidelines for this repository.

---

## Overview

This project has no browser frontend. The Trellis `frontend` layer documents Dove's direct Skills, generated host adapters, CLI and project integration, MCP tools, durable-state boundary, public documentation, and validation gates.

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Package surface organization and file layout | Filled |
| [Component Guidelines](./component-guidelines.md) | Skill, MCP, durable entity, role, and host-policy ownership | Filled |
| [Hook Guidelines](./hook-guidelines.md) | Core helper pipelines and bounded ambient entry | Filled |
| [State Management](./state-management.md) | Durable state and public read/write boundaries | Filled |
| [Quality Guidelines](./quality-guidelines.md) | Validation scripts, inventory checks, and review rules | Filled |
| [Type Safety](./type-safety.md) | Runtime schema, projection, privacy, and language conventions | Filled |

## Pre-Development Checklist

- Always read Directory Structure, State Management, Type Safety, and Quality Guidelines.
- For Skills, adapters, CLI, MCP, or documentation changes, also read Component Guidelines.
- For helper pipelines or ambient entry, also read Hook Guidelines.
- For cross-layer contracts, read `../guides/cross-layer-thinking-guide.md`.
- Search all public and template references before changing a Skill ID, MCP tool name, durable entity, inventory count, selector, installation path, or response-language rule.
- Keep every file in this directory identical to its matching `src/templates/markdown/spec/frontend/` copy.

## Project Reality

- Runtime: Node.js ESM (`.mjs`).
- Package entrypoint: `bin/dove.mjs`.
- Core logic: `src/core/`.
- MCP interface: `src/mcp/` and `mcp/dove-state-server.mjs`.
- Skill and host-policy source: `src/core/command-manifest.mjs`.
- Adapter renderer: `scripts/generate-command-adapters.mjs`.
- Public inventory: 12 direct Skills, 14 canonical MCP tools, and 60 generated adapters across five host formats.
- The three primary responsibility Skills remain Planner, Builder/Author, and Reviewer.
- Source is external capture; Note is internal synthesis; Experience is experimental conception/prevalidation; Experiment is the formal protocol/result record.
- Current state is a clean Schema 18 cutover with Mission-bound ResearchDecisions, one `.dove/LESSONS.md`, thin Draft/Figure/Rebuttal archives, isolated Review records, and no migration or fallback runtime.
- Validation: `npm run check` and `npm run release:check`.

---

**Language**: All Trellis documentation must be written in English.
