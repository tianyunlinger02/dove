# Directory Structure

> Project-facing surface and module organization for `paper_factory`.

---

## Overview

This repository does not contain a React/browser frontend. The Trellis `frontend` layer is used for the user-facing package surfaces: OpenCode commands, skills, CLI entrypoints, MCP tools, and durable `.paper/` artifacts. New work should stay file-first and package-first: prompts, skills, CLI/MCP handlers, core state logic, and tests each have separate homes.

---

## Directory Layout

```text
.
├── .opencode/
│   ├── commands/          # OpenCode command markdown surfaces, e.g. paper.orchestrate.md
│   └── skills/            # Role/discipline skill packs, one SKILL.md per skill
├── .paper/                # Durable workspace/artifact template used by the package
│   ├── context/           # Role, phase, artifact, and action manifests
│   ├── orchestration/     # Board and handoffs
│   ├── meta/              # Proposal-only optimizer/governance surfaces
│   ├── runtime/           # Foreground autonomy state/results/leases/events
│   └── ...                # Research, evidence, drafts, reviews, versions, figures
├── bin/                   # CLI executable (`paper-factory`)
├── docs/                  # Package documentation
├── mcp/                   # Thin executable wrapper for the MCP server
├── scripts/               # Validation and audit scripts used by npm scripts
├── src/
│   ├── core/              # File-backed domain logic and schema normalization
│   └── mcp/               # MCP definitions, server, and dispatch handlers
└── tests/
    ├── integration/       # End-to-end package/workflow/MCP tests
    └── unit/              # Schema and focused core behavior tests
```

---

## Module Organization

- Put durable workflow behavior in `src/core/*.mjs`. Examples: `src/core/workspace.mjs` owns file IO helpers and workspace bootstrapping; `src/core/schema.mjs` owns schema versions, constants, default objects, and normalization.
- Put MCP exposure in `src/mcp/*.mjs`. `src/mcp/tool-definitions.mjs` defines schemas; `src/mcp/handlers.mjs` dispatches tool names to core functions.
- Put install/doctor/autonomy CLI wiring in `bin/paper-factory.mjs`; keep reusable behavior in `src/core/`.
- Put validation scripts in `scripts/*.mjs` and wire them through `package.json` scripts.
- Put user-facing OpenCode prompt surfaces in `.opencode/commands/paper.*.md` and role skills in `.opencode/skills/paper-factory-*/SKILL.md`.
- Treat `.paper/` as the durable artifact model, not as generated scratch. Bootstrap may create files there, but package update logic must preserve user-owned state.

---

## Naming Conventions

- JavaScript modules use ESM `.mjs` and kebab-case filenames where they are executables/scripts (`validate-mcp.mjs`, `paper-state-server.mjs`). Core modules use descriptive lower-case names (`schema.mjs`, `orchestration.mjs`).
- OpenCode commands use `paper.<action>.md`, matching command IDs tested by `scripts/validate-commands.mjs`.
- Skills use `paper-factory-<discipline>/SKILL.md` with YAML frontmatter.
- Durable artifact paths are centralized in `ARTIFACT_PATHS` in `src/core/schema.mjs`; do not scatter new `.paper/...` string constants through command, MCP, or test surfaces.
- Role IDs are explicit and lower-case hyphenated (`rebuttal-lead`, `experiment-planner`, `version-analyst`).

---

## Examples

- `README.md` documents the public package surfaces and the canonical `.paper/` artifact list.
- `src/core/schema.mjs` is the example for centralizing artifact paths, role IDs, governance registries, and schema defaults.
- `src/core/workspace.mjs` is the example for file-first workspace creation and normalized JSON writes.
- `.opencode/commands/paper.orchestrate.md` is the example command: it starts by reading local context, names canonical artifacts, and tells the operator which MCP tools to prefer.
- `tests/integration/workflow.test.mjs` is the example for validating an end-to-end paper workflow through core functions.

---

## Forbidden Patterns

- Do not create a hidden app-style frontend tree (`components/`, `pages/`, `hooks/`) unless a real UI is introduced.
- Do not put durable workflow rules only in prompts; core invariants need code and tests.
- Do not add new package-managed paths without checking workflow boundaries in `createWorkflowBoundaries()`.
- Do not add new command/MCP surfaces without updating validators and tests that assert complete surface classification.
