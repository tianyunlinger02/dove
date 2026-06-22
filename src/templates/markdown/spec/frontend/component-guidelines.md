# Component Guidelines

> How user-facing command, skill, CLI, and MCP surfaces are built in this project.

---

## Overview

There are no React components in this repository. Treat each public surface as a component with a small, explicit contract:

- Generated project command adapters in `.opencode/commands/`, `.cursor/commands/`, `.codex/skills/`, and `.agents/skills/` are host-specific prompt or skill adapter components; Claude Code uses manifest-rendered user-level `/dove:*` entries via `dove install/sync --host claude` instead of project-local `.claude/commands/dove/`.
- OpenCode role skills in `.opencode/skills/dove-*/` are reusable role/discipline components.
- CLI subcommands in `bin/dove.mjs` are terminal components.
- MCP tools in `src/mcp/tool-definitions.mjs` and `src/mcp/handlers.mjs` are API components.

Command adapters should be generated from `src/core/command-manifest.mjs` via `scripts/generate-command-adapters.mjs`. All surfaces should converge on the same file-backed `.dove/` state and should prefer deterministic core functions over prompt-only behavior.

---

## Surface Structure

### Generated command adapters

Define command metadata in `src/core/command-manifest.mjs`, then run `npm run commands:generate` to rewrite host adapters. Use a short title, a goal, and an ordered workflow. The first workflow step should say exactly which durable context/artifacts to read.

Example generated contract for `dove.status`:

```md
# dove.status

Route the current Dove mission to one next surface without writing durable state.

## Goal

Inspect existing `.dove/` context and return a proposal-only next command across paper, engineering, experiment, review, or general domains.

## Workflow

1. Read `.dove/context/actions/current.json`, `.dove/workspace/index.json`, and `.dove/orchestration/board.json` as available.
2. Prefer `query_dove_orchestrate` or the CLI read-only route when available.
3. Do not call mutation tools such as `upsert_orchestration_board`, `append_handoff`, or packet materialization tools.
```

### Skills

Use YAML frontmatter with `name` and `description`, then concise bullet rules. OpenCode role skills such as `.opencode/skills/dove-planner/SKILL.md` tell the planner to treat `.dove/orchestration/board.json` as canonical and use handoffs instead of hidden runtime memory.

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
- Command IDs, host slugs, and adapter paths come from `src/core/command-manifest.mjs`; MCP tool names are snake_case; core functions are camelCase.
- Role-bound mutation tools should expose policy/override fields through `withPolicy(...)` in `src/mcp/tool-definitions.mjs`.
- Prompt surfaces should say when MCP is preferred, but must remain useful when MCP is unavailable by naming the file-backed artifacts to read.
- Read-only/query surfaces should be clearly separate from mutation surfaces.

---

## Scenario: Isolated reviewer command handoff

### 1. Scope / Trigger

- Trigger: `dove.review` spans command markdown, CLI, core file mutations, external process invocation, governance coverage, and review-state import.
- Purpose: keep writer/main-session private context isolated from reviewer private context while still allowing an operator to mediate through explicit artifacts.

### 2. Signatures

- Slash command: `dove.review`.
- CLI runner: `dove isolated-review [target] --reviewer-command <cmd> [--scope <text>] [--run-id <id>] [--instructions <text>] [--artifact <path>]...`.
- CLI prepare-only: `dove isolated-review-prepare [target] [--scope <text>] [--run-id <id>] [--instructions <text>] [--artifact <path>]...`.
- CLI import-only: `dove isolated-review-import [target] --run-id <id> [--handoff <path>] [--report <path>]`.
- Core functions: `prepareIsolatedReview(root, args)`, `runIsolatedReview(root, args)`, and `importIsolatedReview(root, args)`.

### 3. Contracts

- Prepared input path: `.dove/reviews/isolated/<run-id>/input.json`.
- Manifest path: `.dove/reviews/isolated/<run-id>/manifest.json`.
- Reviewer output paths: `.dove/reviews/isolated/<run-id>/handoff.json` and optional `.dove/reviews/isolated/<run-id>/report.md`.
- Reviewer command receives argv: `--input <inputPath> --handoff <handoffPath> --report <reportPath> --run-id <runId>`.
- Reviewer command receives env: `DOVE_ISOLATED_REVIEW_INPUT`, `DOVE_ISOLATED_REVIEW_HANDOFF`, `DOVE_ISOLATED_REVIEW_REPORT`, `DOVE_ISOLATED_REVIEW_RUN_ID`, and `DOVE_ISOLATED_REVIEW_INPUT_SHA256`.
- Imported handoff must include matching `runId`, `inputPath`, `inputSha256`, `verdict`, `summary`, and reviewer findings/action items. Private reviewer transcripts are not imported.

### 4. Validation & Error Matrix

- Missing reviewer command -> reject the all-in-one runner before spawning.
- Unterminated command quote -> reject during CLI argv parsing.
- Handoff `runId` mismatch -> reject import.
- Handoff `inputPath` mismatch -> reject import.
- Handoff `inputSha256` mismatch -> reject import.
- Reviewer non-zero exit -> reject runner and surface stdout/stderr.
- Findings with missing IDs -> normalize to stable run-scoped IDs before writing concerns.

### 5. Good/Base/Bad Cases

- Good: slash command invokes the CLI runner; reviewer sees only `input.json`; main session imports only `handoff.json` and `report.md`; private reviewer notes remain outside review logs.
- Base: operator prepares a run, manually coordinates clarification artifacts, then imports a valid handoff later.
- Bad: pasting writer-session hidden reasoning into reviewer input, importing reviewer private transcript, or accepting a handoff whose input hash does not match the frozen bundle.

### 6. Tests Required

- Integration test: fake external reviewer writes handoff/report/private transcript; runner imports verdict and concerns but not private transcript.
- Integration test: import rejects mismatched `inputSha256`.
- Command validation: `dove.review.md` is registered through the canonical command manifest and generated adapters.
- Governance audit/hardening: isolated-review mutations bind to command/core surfaces; MCP binding may be absent for this CLI-only external-process surface.

### 7. Wrong vs Correct

#### Wrong

```bash
dove isolated-review . --reviewer-command "node reviewer.js --private-session-log writer-transcript.md"
```

#### Correct

```bash
dove isolated-review . --reviewer-command "node reviewer.js" --scope "current draft"
```

## Composition Patterns

- Compose public surfaces around core functions exported from `src/core/index.mjs`; do not duplicate workflow logic in CLI or MCP layers.
- Keep CLI operations thin: parse args, call core functions, print JSON or human-readable status.
- Keep command metadata in `src/core/command-manifest.mjs`, regenerate adapters, and keep OpenCode role skills aligned with the same artifact paths and role names defined in code.
- Use action bundles, role manifests, phase manifests, packet manifests, and artifact manifests to narrow context before mutating durable state.

---

## Accessibility / Operator Ergonomics

For this CLI/prompt package, accessibility means operators can recover state from files without hidden context:

- Commands must name canonical files and next actions explicitly.
- Outputs should be machine-checkable JSON when exposed through CLI/MCP.
- Handoffs, board state, approvals, runtime results, and optimizer decisions should be durable, not only described in chat.

---

## Common Mistakes

- Hand-editing generated command adapters instead of updating `src/core/command-manifest.mjs` and running `npm run commands:generate`.
- Adding a command to the manifest but forgetting governance classification in `src/core/schema.mjs` or validation coverage in `scripts/validate-commands.mjs`.
- Adding an MCP tool definition without adding a matching dispatch case and classification tests in `tests/integration/mcp-tools.test.mjs`.
- Letting prompt text mention an artifact path that is not in `ARTIFACT_PATHS` or not bootstrapped by `ensureWorkspace`.
- Auto-applying `dove.status` recommendations. That surface is proposal-only until materialized through governed follow-through.
