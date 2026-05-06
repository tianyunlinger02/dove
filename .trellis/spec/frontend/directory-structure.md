# Directory Structure

> Project-facing surface and module organization for `Dove`.

---

## Overview

This repository does not contain a React/browser frontend. The Trellis `frontend` layer is used for the user-facing package surfaces: generated multi-host command adapters, OpenCode role skills, CLI entrypoints, MCP tools, and durable `.dove/` artifacts. New work should stay file-first and package-first: manifest metadata, generated adapters, role skills, CLI/MCP handlers, core state logic, and tests each have separate homes.

---

## Directory Layout

```text
.
├── .opencode/
│   ├── commands/          # Generated OpenCode command adapters, e.g. dove.paper.orchestrate.md
│   └── skills/            # OpenCode role/discipline skill packs, one SKILL.md per skill
├── .claude/commands/dove/ # Generated Claude Code command adapters
├── .cursor/commands/      # Generated Cursor command adapters
├── .codex/skills/         # Generated Codex skill adapters, one dove-*/SKILL.md per command
├── .agents/skills/        # Generated shared agent skill adapters, one dove-*/SKILL.md per command
├── .dove/                 # Durable workspace/artifact template used by the package
│   ├── context/           # Role, phase, artifact, and action manifests
│   ├── orchestration/     # Board and handoffs
│   ├── meta/              # Proposal-only optimizer/governance surfaces
│   ├── runtime/           # Foreground autonomy state/results/leases/events
│   └── ...                # Research, evidence, drafts, reviews, versions, figures
├── bin/                   # CLI executable (`dove`)
├── docs/                  # Package documentation
├── mcp/                   # Thin executable wrapper for the MCP server
├── scripts/               # Validation, generator, and audit scripts used by npm scripts
├── src/
│   ├── core/              # File-backed domain logic, command manifest, and schema normalization
│   └── mcp/               # MCP definitions, server, and dispatch handlers
└── tests/
    ├── integration/       # End-to-end package/workflow/MCP tests
    └── unit/              # Schema and focused core behavior tests
```

---

## Module Organization

- Put durable workflow behavior in `src/core/*.mjs`. Examples: `src/core/workspace.mjs` owns file IO helpers and workspace bootstrapping; `src/core/schema.mjs` owns schema versions, constants, default objects, and normalization.
- Put canonical command and host-adapter metadata in `src/core/command-manifest.mjs`.
- Put MCP exposure in `src/mcp/*.mjs`. `src/mcp/tool-definitions.mjs` defines schemas; `src/mcp/handlers.mjs` dispatches tool names to core functions.
- Put install/doctor/autonomy CLI wiring in `bin/dove.mjs`; keep reusable behavior in `src/core/`.
- Put adapter generation in `scripts/generate-command-adapters.mjs`, and validation/audit scripts in `scripts/*.mjs` wired through `package.json`.
- Put generated host adapters in `.opencode/commands/`, `.claude/commands/dove/`, `.cursor/commands/`, `.codex/skills/dove-*/SKILL.md`, and `.agents/skills/dove-*/SKILL.md`. Do not hand-maintain divergent command inventories per host.
- Put OpenCode role skills in `.opencode/skills/dove-*/SKILL.md`.
- Treat `.dove/` as the durable artifact model, not as generated scratch. Bootstrap may create files there, but package update logic must preserve user-owned state.

---

## Naming Conventions

- JavaScript modules use ESM `.mjs` and kebab-case filenames where they are executables/scripts (`validate-mcp.mjs`, `dove-state-server.mjs`). Core modules use descriptive lower-case names (`schema.mjs`, `orchestration.mjs`).
- Command IDs live in `src/core/command-manifest.mjs` as `dove.<surface>` for general Dove surfaces and `dove.paper.<action>` for paper-domain surfaces.
- Generated adapter slugs are derived from command IDs: Claude uses `.claude/commands/dove/<slug>.md`, Cursor uses `.cursor/commands/dove-<slug>.md`, and Codex/Agents use `dove-<slug>/SKILL.md`.
- OpenCode role skills use `dove-<discipline>/SKILL.md` with YAML frontmatter.
- Durable artifact paths are centralized in `ARTIFACT_PATHS` in `src/core/schema.mjs`; do not scatter new `.dove/...` string constants through command, MCP, or test surfaces.
- Role IDs are explicit and lower-case hyphenated (`rebuttal-lead`, `experiment-planner`, `version-analyst`).

---

## Examples

- `README.md` documents the public package surfaces and the canonical `.dove/` artifact list.
- `src/core/command-manifest.mjs` is the example for centralizing command IDs, generated adapter paths, host inventories, and managed adapter boundaries.
- `scripts/generate-command-adapters.mjs` is the example for deterministic checked-in host adapter generation.
- `src/core/schema.mjs` is the example for centralizing artifact paths, role IDs, governance registries, and schema defaults.
- `src/core/workspace.mjs` is the example for file-first workspace creation and normalized JSON writes.
- `.opencode/commands/dove.orchestrate.md` and `.opencode/commands/dove.paper.orchestrate.md` are generated read-only router examples; host-specific copies should match generator output.
- `tests/integration/workflow.test.mjs` is the example for validating an end-to-end paper workflow through core functions.

---

## Forbidden Patterns

- Do not create a hidden app-style frontend tree (`components/`, `pages/`, `hooks/`) unless a real UI is introduced.
- Do not put durable workflow rules only in prompts; core invariants need code and tests.
- Do not add new package-managed paths without checking workflow boundaries in `createWorkflowBoundaries()` and `src/core/command-manifest.mjs`.
- Do not hand-add generated command adapters; update the manifest, regenerate adapters, and update validators/tests that assert complete surface classification.
