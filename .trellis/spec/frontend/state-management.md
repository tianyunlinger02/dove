# State Management

> How durable state is managed in this project.

---

## Overview

`paper_factory` is file-first. State lives in durable `.paper/` artifacts, not in process memory, browser stores, or hidden agent context. Core functions load state from disk, normalize it, mutate explicit artifacts, and write deterministic JSON/Markdown outputs.

Primary state locations:

- `.paper/state.json` for normalized top-level paper/workflow state.
- `.paper/orchestration/board.json` and `.paper/orchestration/handoffs.md` for coordination.
- `.paper/task-packets/` and `.paper/context/` for resumable task/context narrowing.
- `.paper/research`, `.paper/sources`, `.paper/notes`, `.paper/evidence`, `.paper/experiments`, `.paper/claims`, `.paper/drafts`, `.paper/reviews`, `.paper/rebuttal`, `.paper/versions`, and `.paper/figures` for paper artifacts.
- `.paper/meta`, `.paper/programs`, and `.paper/runtime` for proposal, approval, and explicit foreground autonomy surfaces.

---

## State Categories

### Package-managed defaults

Defaults and schema constants live in `src/core/schema.mjs`. `ARTIFACT_PATHS` is the canonical registry for durable paths, and factory functions such as `createDefaultState()` and `createWorkflowBoundaries()` define expected shapes.

### User-owned durable workspace

`.paper/` contains the user's paper state. Install/sync code in `bin/paper-factory.mjs` calls `ensureWorkspace(target)` but must preserve user-owned data. The boundary policy returned from `createWorkflowBoundaries()` separates managed package paths from bootstrap-only/user-owned paths.

### Orchestration state

The board is canonical for active workflow coordination. `.opencode/commands/paper.orchestrate.md` requires phase, intent type, assigned role, focus, next action, continuation state, review gate status, tasks, blockers, evidence links, experiment IDs, rebuttal issue IDs, version lineage, and packet-linked questions/decisions to stay explicit.

### Proposal and runtime state

`paper.meta-optimize` is proposal-only. Accepted proposals must cross a governed bridge through follow-through/materialization before execution. Runtime/autonomy state under `.paper/runtime/` is explicit foreground state, not a daemon or hidden scheduler.

### Lifecycle mirror state

Campaign, workspace, task graph, navigation, and autonomy-loop summaries are mirrors over lower-level durable artifacts. When adding a lifecycle transition, update the canonical artifact first, then reflect the outcome into every durable mirror that operators use to resume work. Keep reflection passive: it may summarize or copy explicit outcomes, but it must not schedule, approve, or execute new work.

---

## When to Add or Promote State

Add durable state only when it is needed for session recovery, governance, tests, or user-facing package behavior. Before adding a field or artifact:

1. Search for existing fields/constants in `src/core/schema.mjs`, `.paper/context/`, and tests.
2. Add the path or field to the relevant schema/default/normalizer.
3. Ensure `ensureWorkspace` bootstraps or normalizes it when needed.
4. Expose it through CLI/MCP/commands only if it is part of a public contract.
5. Add or update tests that prove the state is created, normalized, queried, or governed.

---

## Server State

There is no server-side database. The optional MCP server is a deterministic interface over local files. `src/mcp/handlers.mjs` dispatches tool calls to core functions and returns JSON text. Keep MCP behavior equivalent to CLI/core behavior by calling shared functions rather than reimplementing mutations.

---

## Derived State

Derived summaries and indexes should be refreshable from source artifacts:

- Workspace/navigation surfaces (`queryWorkspaceIndex`, task graph, open questions, decisions, lineage).
- Governance coverage reports.
- Optimizer frontier reports and remediation packs.
- Figure QA and staged figure contract outputs.

Derived state should not become the only source of truth for facts that belong in sources, notes, experiments, claims, reviews, or board state.

---

## Examples

- `src/core/schema.mjs` defines `ARTIFACT_PATHS`, `SCHEMA_VERSION`, `PIPELINE_STAGE_ORDER`, role IDs, governance registries, default object factories, and normalizers.
- `src/core/workspace.mjs` shows the standard read/normalize/write flow used by `ensureWorkspace(root)` to create and reconcile durable `.paper/` artifacts.
- `.opencode/commands/paper.orchestrate.md` documents the board-first operator flow and the required context files to read before mutating orchestration state.
- `.opencode/commands/paper.meta-optimize.md` documents the proposal-only optimizer flow and the governed bridge to materialized work.
- `tests/integration/workflow.test.mjs` exercises state transitions across workspace creation, sources, notes, claims, experiments, review, handoffs, snapshots, comparisons, and checklist sync.

---

## Common Mistakes

- Treating `.paper/meta/*` optimizer recommendations as executable state. They are proposal-only until materialized.
- Adding a new `.paper/` artifact path without updating `ARTIFACT_PATHS`, workspace bootstrapping, validators, and tests.
- Mutating user-owned workspace data during install/sync beyond bootstrap-safe defaults.
- Storing important workflow decisions only in chat or prompt text instead of durable artifacts.
