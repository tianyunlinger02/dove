# Frontend Development Guidelines

> Project-facing package and operator-surface guidelines for this repository.

---

## Overview

This project has no browser frontend. The Trellis `frontend` layer documents the approved Dove 3.0.0 Markdown document architecture: ten flat Skills, three roles, generated host projections, project lifecycle, the prompt hook, installation metadata, and software validation.

Dove 3 has no research MCP server, public research tools, MCP registration path, Research Format runtime, or research database. Substantive work uses host file, coding, execution, and research tools directly.

## Guidelines Index

| Guide | Description | Status |
|---|---|---|
| [Directory Structure](./directory-structure.md) | Package surfaces, bundles, and project document layout | Filled |
| [Component Guidelines](./component-guidelines.md) | Skill, role, adapter, document, and lifecycle responsibilities | Filled |
| [Hook Guidelines](./hook-guidelines.md) | Reusable helper flows and ambient entry | Filled |
| [State Management](./state-management.md) | Markdown research context and installation boundaries | Filled |
| [Quality Guidelines](./quality-guidelines.md) | Behavioral, documentation, and release validation | Filled |
| [Type Safety](./type-safety.md) | Software contracts, paths, CLI boundaries, and document non-schema rules | Filled |

## Pre-Development Checklist

- Read Directory Structure, State Management, Type Safety, and Quality Guidelines.
- For Skills, roles, adapters, CLI, or public documentation, also read Component Guidelines.
- For helper flows or ambient entry, also read Hook Guidelines.
- For cross-layer work, read `../guides/cross-layer-thinking-guide.md`.
- Search canonical sources, public docs, tests, generated outputs, and templates before changing a Skill ID, role, CLI command, bundle, manifest revision, managed path, or lifecycle boundary.
- Keep each file in this directory byte-identical to its matching `src/templates/markdown/spec/frontend/` copy. Write both copies with the same content.

## Project Reality

- Runtime: Node.js ESM (`.mjs`), Node.js `>=22`.
- Package release: Dove `3.0.0`.
- Public Skills: `research`, `status`, `source`, `experiment`, `draft`, `figure`, `review`, `rebuttal`, `lessons`, and explicit-only `auto`.
- Primary roles: Planner, Builder/Author, and Reviewer.
- Runtime bundles: `dist/index.mjs`, `bin/dove-package.mjs`, and `scripts/dove-user-prompt-submit-package.mjs`.
- Generated adapters are canonical projections, not registration, readiness, or reviewer-independence proof.
- Claude Code remains the supported project initialization path.
- Research context is ordinary Markdown under `.dove/research/` when maintained. `RESEARCH.md` is the recommended overview and navigation document; `LESSONS.md` is optional; other files are human-named linked topic documents.
- Research Markdown has no fixed headings, frontmatter, generated IDs, enums, machine index, stored counts, or research hashes.
- One Experiment document holds the prospective plan before execution and the actual results afterward.
- One Review document holds purpose, exact path scope, prompt, the actual user-obtained Markdown return, and author handling.
- Missions and Sources are natural documents. Claims remain prose or documents when useful, not a store.
- Status is read-only. A missing overview is normal, and broken links are reported as ordinary documentation problems.
- Auto is explicit-only and treats the documented current mainline as a read-only boundary.
- `.dove/install/manifest.json` uses revision `2.0`; optional Doctor machine state and its readable `DOCTOR.md` belong under `.dove/install/`.
- Installation and file-safety hashes are internal software metadata, never research evidence.
- CLI commands are `init`, `sync`, `upgrade`, `reinstall`, `doctor`, `export-research`, and `hook`; there is no `mcp` or `migrate-research` command.
- `export-research` is an explicitly authorized, one-time legacy Dove JSON research records-to-Markdown conversion that archives original bytes under `.dove/archive/...`; v1 conversion and runtime fallback are unsupported.
- Sync and Upgrade do not change research documents. Confirmed Complete Reinstall deletes Dove research and old archives while preserving ordinary project files.
- Validation claims remain software-only and never establish scientific correctness, completion, acceptance, or reviewer independence.

---

**Language**: All Trellis documentation must be written in English.
