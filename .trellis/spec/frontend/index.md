# Frontend Development Guidelines

> Project-facing package and operator-surface guidelines for this repository.

---

## Overview

This project has no browser frontend. The Trellis `frontend` layer documents the approved Dove 3.0.0 Markdown document architecture: one Dove research agent, nine flat Skills, generated host projections, project lifecycle, Claude SessionStart/prompt hooks, project status line, installation metadata, and software validation.

Dove 3 has no Dove-owned research-state MCP server, public research tool registry, Research Format runtime, or research database. Substantive work uses available and approved host file, coding, writing, figure, execution, and research tools directly; Claude project initialization may declare the pinned external paper-acquisition MCP, the hosted Exa MCP, and hidden support Skills.

## Guidelines Index

| Guide | Description | Status |
|---|---|---|
| [Directory Structure](./directory-structure.md) | Package surfaces, bundles, and project document layout | Filled |
| [Component Guidelines](./component-guidelines.md) | Dove agent, Skill, adapter, document, and lifecycle responsibilities | Filled |
| [Hook Guidelines](./hook-guidelines.md) | Reusable helper flows and ambient entry | Filled |
| [State Management](./state-management.md) | Markdown research context and installation boundaries | Filled |
| [Quality Guidelines](./quality-guidelines.md) | Behavioral, documentation, and release validation | Filled |
| [Type Safety](./type-safety.md) | Software contracts, paths, CLI boundaries, and document non-schema rules | Filled |

## Pre-Development Checklist

- Read Directory Structure, State Management, Type Safety, and Quality Guidelines.
- For the Dove agent, Skills, adapters, CLI, or public documentation, also read Component Guidelines.
- For helper flows or ambient entry, also read Hook Guidelines.
- For cross-layer work, read `../guides/cross-layer-thinking-guide.md`.
- Search canonical sources, public docs, generated outputs, and templates before changing the Dove agent behavior, a Skill ID, CLI command, bundle, manifest revision, managed path, or lifecycle boundary.
- Keep each file in this directory byte-identical to its matching `src/templates/markdown/spec/frontend/` copy. Write both copies with the same content.

## Project Reality

- Runtime: Node.js ESM (`.mjs`), Node.js `>=22`.
- Package release: Dove `3.0.0`.
- Public Skills: `research`, `status`, `source`, `experiment`, `draft`, `figure`, `review`, `rebuttal`, and `lessons`.
- Dove research agent: one complete agent with research drive; planning, authoring, and reviewing are not user-switchable Dove roles.
- For confirmed goals, Dove uses default multi-round progression: it anchors on the user-confirmed Workspace mainline, identifies the highest-level active limit, keeps candidate explanations explicit, chooses a discriminating action, absorbs the result, and continues while useful in-scope action remains.
- Contribution, mechanism, novelty, and positioning come before method, evidence, experiment analysis, baselines, and failure analysis; those come before argument, writing, and figures; delivery remains last.
- Runtime bundles: `dist/index.mjs`, `bin/dove-package.mjs`, and `scripts/dove-user-prompt-submit-package.mjs`.
- Generated adapters are canonical projections, not registration, readiness, or `dove-review` independence proof.
- Claude Code and DeepSeek Harness are the supported project initialization paths. Claude Code receives the complete integration; DSH receives project-local filesystem Skills only and no Claude permissions or MCP projection. Claude safely owns only `.mcp.json#/mcpServers/dove-paper-search` for pinned external paper acquisition, `.mcp.json#/mcpServers/exa` for hosted ordinary webpage retrieval, and a project-scoped `permissions.deny` entry for built-in `WebFetch`; built-in `WebSearch` remains available, while approval, `uvx`, Python, Exa access, and credentials remain user-provided.
- Fresh project initialization creates only researcher-owned `.dove/research/RESEARCH.md`. Mission, Experiment, Source, Review, Claim, and Lesson summaries or topic documents are optional researcher-owned Markdown created naturally when useful. Existing `.dove/research/**` is preserved across update, hot sync, reinstall, and uninstall.
- Research Markdown has no fixed headings, frontmatter, generated IDs, enums, machine index, stored counts, or research hashes.
- A newly executed experiment uses one document for the prospective plan and actual results; design-only, existing-result analysis, and retrospective recording remain honest about what work occurred.
- The corresponding Review document preserves author-side scientific self-checks, `dove-review` handoff purpose, exact frozen path scope, prompt, clarifications, rebuttals, and the actual reviewer return; author handling is added only when requested.
- Each `dove-review` round sees only the explicit frozen list for that round; old Reviews, historical returns, author private transcript, and unlisted materials are not visible by default. Findings are evidence to analyze rather than direct rewrite or claim-narrowing triggers; feasible high-level action comes first, narrowing requires evidence or a real boundary, and changes to the confirmed mainline, contribution, or completion meaning go to the user.
- Missions and Sources are natural documents. Claims remain prose or documents when useful, not a store.
- Status is read-only. A missing overview is normal, and broken links are reported as ordinary documentation problems.
- There is no Auto Skill or command; default foreground multi-round progression reads the user-confirmed Workspace mainline from research context, conversation, and project artifacts, keeps it stable, continues while feasible in-scope actions can advance or protect it, and treats bounded-task completion as separate from mainline progress.
- `.dove/install/manifest.json` uses revision `2.0`; optional ordinary `DOCTOR.md` feedback about Dove itself also belongs under `.dove/install/`, without machine issue state.
- Installation and file-safety hashes are internal software metadata, never research evidence.
- CLI commands are `init`, `update`, `reinstall`, `uninstall`, `doctor`, `export-research`, and `hook`; there is no `mcp` or `migrate-research` command.
- `export-research` is an explicitly authorized, one-time legacy Dove JSON research records-to-Markdown conversion that archives original bytes under `.dove/archive/...`; v1 conversion and runtime fallback are unsupported.
- Project update refreshes package-managed integration and preserves existing `.dove/research/**`; it does not create missing summaries, complete navigation, replace Lessons, or otherwise normalize research Markdown. Confirmed Complete Reinstall rebuilds package-managed integration while preserving `.dove/research/**`, `.dove/install/DOCTOR.md`, and ordinary project files.
- Validation claims remain software-only and never establish scientific correctness, completion, acceptance, `dove-review` independence, or Dove research quality.

---

**Language**: All Trellis documentation must be written in English.
