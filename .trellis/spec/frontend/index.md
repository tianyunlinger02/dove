# Frontend Development Guidelines

> Project-facing package and operator-surface guidelines for this repository.

---

## Overview

This project does not currently have a browser frontend. In this Trellis setup, the `frontend` spec layer documents the user-facing surfaces of `Dove`: OpenCode commands and skills, CLI commands, MCP tools, durable `.dove/` artifacts, and the package quality gates that keep those surfaces aligned.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Package surface organization and file layout | Filled |
| [Component Guidelines](./component-guidelines.md) | Command, skill, CLI, and MCP surface patterns | Filled |
| [Hook Guidelines](./hook-guidelines.md) | File-backed context/action patterns and reusable helpers | Filled |
| [State Management](./state-management.md) | Durable `.dove/` state, derived state, and governance state | Filled |
| [Quality Guidelines](./quality-guidelines.md) | Validation scripts, tests, and forbidden patterns | Filled |
| [Type Safety](./type-safety.md) | JavaScript runtime schema/normalization conventions | Filled |

---

## Pre-Development Checklist

Before changing package behavior, read the relevant documents below:

- Always read [Directory Structure](./directory-structure.md), [State Management](./state-management.md), [Type Safety](./type-safety.md), and [Quality Guidelines](./quality-guidelines.md).
- For `.opencode/commands/`, `.opencode/skills/`, CLI, or MCP surface changes, also read [Component Guidelines](./component-guidelines.md).
- For context bundle, manifest, helper, query, or durable workflow pipeline changes, also read [Hook Guidelines](./hook-guidelines.md).
- If a change touches multiple layers or changes command/API contracts, read `../guides/cross-layer-thinking-guide.md`.
- Before changing any constant, artifact path, command ID, MCP tool name, role ID, or config value, search for existing references first.

---

## Project Reality

- Runtime: Node.js ESM (`.mjs`), not TypeScript.
- Package entrypoint: `bin/dove.mjs`.
- Core logic: `src/core/`.
- MCP interface: `src/mcp/` and `mcp/dove-state-server.mjs`.
- Operator surfaces: `.opencode/commands/` and `.opencode/skills/`.
- Durable state model: `.dove/`.
- Validation: `npm run check` combines command validation, MCP validation, governance audit, and Node tests.

---

**Language**: All documentation should be written in **English**.
