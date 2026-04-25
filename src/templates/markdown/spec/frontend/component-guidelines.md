# Component Guidelines

> How user-facing command, skill, CLI, and MCP surfaces are built in this project.

---

## Overview

There are no React components in this repository. Treat each public surface as a component with a small, explicit contract:

- OpenCode commands in `.opencode/commands/` are prompt components.
- Skills in `.opencode/skills/` are reusable role/discipline components.
- CLI subcommands in `bin/paper-factory.mjs` are terminal components.
- MCP tools in `src/mcp/tool-definitions.mjs` and `src/mcp/handlers.mjs` are API components.

All surfaces should converge on the same file-backed `.paper/` state and should prefer deterministic core functions over prompt-only behavior.

---

## Surface Structure

### OpenCode commands

Use a short title, a goal, and an ordered workflow. The first workflow step should say exactly which durable context/artifacts to read.

Example: `.opencode/commands/paper.orchestrate.md`:

```md
# paper.orchestrate

Align the durable orchestration board and decide the next role-owned step.

## Goal

Treat `.paper/orchestration/board.json` as the canonical workflow board...

## Workflow

1. Read `.paper/context/actions/current.json`, then `.paper/orchestration/board.json`...
2. If `paper-factory` MCP is available, prefer `upsert_orchestration_board`...
```

### Skills

Use YAML frontmatter with `name` and `description`, then concise bullet rules. Example: `.opencode/skills/paper-factory-planner/SKILL.md` tells the planner to treat `.paper/orchestration/board.json` as canonical and use handoffs instead of hidden runtime memory.

### MCP tools

Define input schemas in `src/mcp/tool-definitions.mjs`, route by exact tool name in `src/mcp/handlers.mjs`, and return JSON text through the shared result helpers.

Example pattern from `src/mcp/handlers.mjs`:

```js
case "query_workspace_index":
  return makeTextResult(queryWorkspaceIndex(root));
case "upsert_orchestration_board":
  return makeTextResult(upsertOrchestrationBoard(root, args));
```

---

## Contract Conventions

- Every user-facing mutation surface should name its target artifact and, when relevant, its role/policy requirements.
- MCP tool names are snake_case; command IDs are `paper.kebab-case`; core functions are camelCase.
- Role-bound mutation tools should expose policy/override fields through `withPolicy(...)` in `src/mcp/tool-definitions.mjs`.
- Prompt surfaces should say when MCP is preferred, but must remain useful when MCP is unavailable by naming the file-backed artifacts to read.
- Read-only/query surfaces should be clearly separate from mutation surfaces.

---

## Composition Patterns

- Compose public surfaces around core functions exported from `src/core/index.mjs`; do not duplicate workflow logic in CLI or MCP layers.
- Keep CLI operations thin: parse args, call core functions, print JSON or human-readable status.
- Keep command markdown and skill markdown aligned with the same artifact paths and role names defined in code.
- Use action bundles, role manifests, phase manifests, packet manifests, and artifact manifests to narrow context before mutating durable state.

---

## Accessibility / Operator Ergonomics

For this CLI/prompt package, accessibility means operators can recover state from files without hidden context:

- Commands must name canonical files and next actions explicitly.
- Outputs should be machine-checkable JSON when exposed through CLI/MCP.
- Handoffs, board state, approvals, runtime results, and optimizer decisions should be durable, not only described in chat.

---

## Common Mistakes

- Adding a command file but forgetting `requiredCommands` in `scripts/validate-commands.mjs` or governance classification in `src/core/schema.mjs`.
- Adding an MCP tool definition without adding a matching dispatch case and classification tests in `tests/integration/mcp-tools.test.mjs`.
- Letting prompt text mention an artifact path that is not in `ARTIFACT_PATHS` or not bootstrapped by `ensureWorkspace`.
- Auto-applying `paper.meta-optimize` recommendations. `.opencode/commands/paper.meta-optimize.md` explicitly treats that surface as proposal-only until materialized through governed follow-through.
