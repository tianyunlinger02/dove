# Directory Structure

> Project-facing surface and Research Format 1 organization for Dove.

---

## Overview

This repository has no browser frontend. The Trellis `frontend` layer covers 9 direct Skills, 45 generated adapters, three primary responsibilities, runtime CLI and project integration, 8 MCP tools, public documentation, and distinct Research Format 1 semantic entities.

## Directory Layout

```text
.
├── .opencode/commands/       # 9 generated OpenCode Skill adapters
├── .opencode/skills/         # Planner, Builder/Author, and Reviewer
├── .cursor/commands/         # 9 generated Cursor Skill adapters
├── .codex/skills/            # 9 generated Codex Skill adapters
├── .agents/skills/           # 9 generated shared-agent Skill adapters
├── .claude/                  # 9 Claude Skill adapters plus ambient integration
├── .dove/                    # Project installation state plus optional Research Format 1
├── bin/                      # Runtime CLI entrypoint and package bundle
├── docs/                     # User and maintainer documentation
├── mcp/                      # MCP server entrypoints
├── scripts/                  # Generators, bundles, and validation gates
├── src/
│   ├── core/                 # Workspace, Mission, evidence, and review logic
│   ├── mcp/                  # MCP definitions, adapters, handlers, and server
│   └── templates/markdown/   # Installed Trellis documentation copies
└── tests/
    ├── integration/
    └── unit/
```

## Consumer Project Root

- `.dove/` is the single Dove project-private root.
- `.dove/install/manifest.json` is Dove-managed installation state. It records the package, proven hosts, runtime protocol, managed resources, and ownership; it is not a research entity.
- Research Format 1 is optional. When initialized through `manage_dove_workspace`, its files are siblings of `.dove/install/`.
- `.dove-install/` is a legacy root recognized only for project Upgrade or Complete Reinstall cleanup. It must not be treated as current state, a secondary root, or a compatibility path.
- Normal project paths hold substantive artifacts such as drafts, figures, rebuttals, notes, source captures, code, and experiment outputs.

Research Format 1 uses `.dove/format.json`, `.dove/workspace.json`, `.dove/missions/`, `.dove/sources/`, `.dove/experiments/`, `.dove/claims/`, `.dove/reviews/`, and `.dove/LESSONS.md`. Semantic entities include one Workspace, immutable root and child Mission contracts, optional immutable Mission conclusions, Sources, frozen Experiment plans, immutable Experiment results, Claims, imported Reviews, and the canonical Lessons document. Mission lineage is derived from parent and dependency identifiers; it is not a second store.

## Module Ownership

- Keep the package version, Research Format marker, canonical research paths, and required layout in `src/core/schema.mjs`.
- Keep strict Research Format 1 classification and Workspace validation in `src/core/workspace-schema.mjs`.
- Keep Workspace, Mission, Source, Experiment, Claim, Review, and Lessons persistence in `src/core/research-stores.mjs`.
- Keep cross-entity research projections in `src/core/research-context.mjs`.
- Keep the 8 public MCP schemas in `src/mcp/tool-definitions.mjs`, adaptation in `src/mcp/research-adapter.mjs`, and exact dispatch in `src/mcp/handlers.mjs`.
- Keep the 9 Skill definitions in `src/core/command-manifest.mjs` and render all adapters from that source.
- Keep installation manifests and managed integration behavior in project-installation modules, separate from Research Format state.
- Keep every Trellis frontend spec identical to its `src/templates/markdown/spec/frontend/` copy.

## Naming and Inventory

- Public Skill IDs are the 9 flat `dove.<surface>` names.
- The generator emits 45 adapters: 9 for each of five host formats.
- MCP tool names are snake_case; core functions are camelCase.
- Durable research identifiers are semantic lowercase IDs, not positional selectors.
- Research paths come from `ARTIFACT_PATHS`.
- Generated adapter presence does not establish host registration or readiness.
- Skill, MCP tool, semantic entity, project artifact, installation resource, and runtime inventories remain separate.

## Runtime and Installation Boundary

The installed `dove` executable is the runtime entry for `init`, `sync`, project Upgrade, project Complete Reinstall, `doctor`, `mcp serve`, and `hook user-prompt-submit`. Consumer projects reference that executable from `PATH`; installation does not copy runtime bundles into project `bin/`, `dist/`, `mcp/`, or `scripts/` directories. Upgrade and Complete Reinstall manage only the selected project and never install, upgrade, uninstall, or otherwise manage user npm. Skills use MCP for research operations and must not fall back to CLI, shell, or direct `.dove/` access.

Upgrade preserves current Research Format 1 bytes while converging a valid legacy `.dove-install/` manifest and optional `.dove-archive/`. Complete Reinstall deletes project-private Dove research and integration state only after explicit default-No confirmation, then recreates installation state under `.dove/install/`.

Research Format 1 is the only writable research format. Legacy or unknown research layouts under `.dove/` may be classified read-only for diagnosis, but research operations do not migrate, overlay, replace, or open them through a fallback reader.
