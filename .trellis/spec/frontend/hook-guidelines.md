# Hook Guidelines

> How reusable orchestration hooks/pipelines are represented in this project.

---

## Overview

There are no React hooks. The hook-like abstractions in `paper_factory` are explicit file-backed actions and core helper pipelines:

- Pre-action context bundles under `.paper/context/actions/`.
- Role, phase, packet, and artifact manifests under `.paper/context/`.
- Core read/normalize/write helpers in `src/core/workspace.mjs`.
- Query and mutation functions exported through `src/core/index.mjs` and exposed through MCP.

Do not rely on hidden runtime memory or implicit host hooks. Operators should be able to resume from files only.

---

## Custom Hook Patterns

Use small, named helper functions for repeated workflow mechanics:

- `readJson(root, relativePath, fallback)` returns parsed JSON or a cloned fallback and repairs malformed JSON into a backup file.
- `writeJson(root, relativePath, value)` writes pretty JSON with a trailing newline.
- `reconcileManagedJsonArtifact(root, relativePath, fallback, normalize)` reads, normalizes, and writes managed JSON artifacts.
- `withPolicy(...)` in `src/mcp/tool-definitions.mjs` composes policy override fields into role-bound tool schemas.

When introducing a repeated operation, first search for an existing helper in `src/core/workspace.mjs`, `src/core/schema.mjs`, and the relevant `src/core/*.mjs` module.

---

## Data Fetching / Context Loading

Data is fetched from local files, not remote APIs:

1. Resolve paths through `resolvePath(root, relativePath)`.
2. Read JSON through `readJson` with a schema-appropriate fallback.
3. Normalize objects through `normalize*` functions from `src/core/schema.mjs`.
4. Persist normalized data with deterministic formatting.
5. For public commands, read the nearest context first: action bundle, role/phase manifest, packet manifest, then artifact manifest.

Example command pattern: `.opencode/commands/paper.orchestrate.md` reads `.paper/context/actions/current.json` before the board and handoff files. `.opencode/commands/paper.meta-optimize.md` reads optimizer report, recommendations, remediation packs, events, optimizer state, long-horizon memory, and workspace index before recommending next action.

---

## Naming Conventions

- Core functions use verb-first camelCase: `ensureWorkspace`, `queryWorkspaceIndex`, `runAutonomyForeground`, `materializeGuidancePacket`.
- Normalizers use `normalize<Name>`; default object factories use `create<Name>`.
- Query MCP tools use `query_*` or `read_*`; mutating tools use action verbs like `upsert_*`, `append_*`, `run_*`, `materialize_*`.
- Context manifests should be named after the role, phase, action, packet, or artifact they represent.

---

## Common Mistakes

- Reading or writing JSON directly with `fs` in new core code when `readJson`, `writeJson`, and normalizers already exist.
- Adding a helper before searching for the same pattern in existing modules.
- Depending on OpenCode host-level hook interception. `README.md` explicitly lists hidden schedulers and host-level hook interception as out of scope.
- Updating a durable artifact without refreshing the surfaces that make the next session resumable, such as workspace index, context manifests, or handoffs.
