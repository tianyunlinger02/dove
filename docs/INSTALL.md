# Installation

`paper_factory` ships as the compatibility package for Dove: a workflow pack, not a fake host fork. Dove is the primary product model, while `paper-factory` and `.paper/` remain the safe compatibility entrypoints during the staged transition. The installer bootstraps `.paper/workspace/dove-root-manifest.json` as a manifest-only migration record; it does not create an authoritative `.dove/` root.

## Supported install model

The supported install path is host-neutral at the core and adapter-based at the operator surface:

1. copy or sync the neutral package files into a target project (`bin/`, `docs/`, `mcp/`, `scripts/`, `src/`, and `README.md`)
2. install the requested host adapters; OpenCode remains the default adapter for compatibility
3. let the selected host discover its commands, agents, skills, or local MCP configuration from its adapter files
4. bootstrap missing `.paper/` artifacts without overwriting user-owned workspace state

Supported adapter IDs are `opencode`, `claude`, `codex`, `cursor`, `agents`, and `all`.

## Project-local install

From the repository root:

```bash
# Default: neutral core + OpenCode adapter
node ./bin/paper-factory.mjs install . --force

# Install selected optional adapters
node ./bin/paper-factory.mjs install . --force --host claude,cursor
node ./bin/paper-factory.mjs install . --force --host codex --host agents

# Install every safe adapter surface
node ./bin/paper-factory.mjs install . --force --host all
```

`sync` accepts the same `--host` and `--platform` flags.

## Existing paper onboarding

```bash
# Proposal-only scan; writes nothing
node ./bin/paper-factory.mjs onboard .

# Alias with the same behavior
node ./bin/paper-factory.mjs migrate .

# Persist only the proposed reference map
node ./bin/paper-factory.mjs onboard . --write-map
```

The artifact map lives at `.paper/workspace/artifact-map.json` and records source path, paper lifecycle family, suggested `.paper` target, confidence, conflicts, unmapped assets, and recommended next actions. The onboarding flow never moves, deletes, imports, rewrites, or overwrites manuscript assets.

## Dove read-only queries and governed launch

```bash
# Route one mission without writing durable state
node ./bin/paper-factory.mjs dove-orchestrate . --request "Ship cache safely" --domain engineering --stage execution

# Frame one mission contract without writing durable state
node ./bin/paper-factory.mjs dove-mission . --domain engineering --stage execution --artifact src/cache.mjs --acceptance-check "tests or validation output"

# Inspect the as-read compatibility mission board without writing or refreshing
node ./bin/paper-factory.mjs dove-board . --domain engineering
node ./bin/dove.mjs board . --domain engineering

# Inspect audit and return readiness without writing, fixing, running tests, or inspecting git
node ./bin/paper-factory.mjs dove-audit . --domain engineering --changed-file src/cache.mjs --test-evidence tests/cache.test.mjs --validation-output tmp/cache-test.log
node ./bin/paper-factory.mjs dove-return . --domain engineering --changed-file src/cache.mjs --test-evidence tests/cache.test.mjs --validation-output tmp/cache-test.log

# Governed launch after accepted guidance exists; writes mission packets backed by .paper/task-packets
node ./bin/paper-factory.mjs dove-launch . --source-type remediation-pack --source-id <pack-id> --execute-by 2099-01-01T00:00:00.000Z --review-after 2099-01-01T12:00:00.000Z --domain engineering --stage execution

# Nested aliases are equivalent
node ./bin/paper-factory.mjs dove orchestrate . --domain paper
node ./bin/paper-factory.mjs dove mission . --domain paper
node ./bin/paper-factory.mjs dove board . --domain paper
node ./bin/paper-factory.mjs dove audit . --domain paper
node ./bin/paper-factory.mjs dove return . --domain paper
node ./bin/paper-factory.mjs dove launch . --source-type remediation-pack --source-id <pack-id> --execute-by 2099-01-01T00:00:00.000Z --review-after 2099-01-01T12:00:00.000Z
```

The query commands return proposal-only JSON and do not create mission packets, update the board, append handoffs, refresh workspace indexes, run tests, inspect git, execute autonomy, or repair `.paper` artifacts. Engineering audit and return checks inspect only declared project-local changed-file, test-evidence, validation-output, and review-evidence paths. `dove launch` is different: it is a guarded write surface that requires an accepted source plus `executeBy` and `reviewAfter`, writes Dove mission packets through the authoritative `.paper/task-packets` materialization bridge, does not execute autonomy, and refuses possible authoritative `.dove` state. The `dove` binary is a limited alias for orchestrate, mission, board, audit, return, and governed launch; it is not a package rename. `.paper/` remains the authoritative durable root, `.paper/workspace/dove-root-manifest.json` records the manifest-only migration strategy, and `.dove/` remains planned compatibility metadata rather than a second root.

## Health check

```bash
node ./bin/paper-factory.mjs doctor .
```

The doctor command checks the neutral core, `.paper/state.json`, the MCP entrypoint, and the required files for each installed host adapter.
It also parses key JSON artifacts, reports degraded typed-wiki or figure-managed internals explicitly, verifies the Dove no-dual-root manifest, exposes installed host adapters, reports proposal-first artifact-map status for legacy paper assets, and probes the local MCP server so a workspace cannot look healthy purely because files exist.

## Update boundary safety

`install` and `sync` treat `.paper/` as **user-owned workspace data**. The CLI bootstraps missing `.paper` artifacts via the workspace initializer, but it does not copy a packaged `.paper/` tree over the target project as managed code.

Adapter copying is allowlisted and skips unsafe local artifacts such as `node_modules`, `.git`, `.env*`, `*.local.json`, `settings.local.json`, logs, caches, and temp files. The durable boundary description lives in `.paper/workflow-pack/boundaries.json`.

## Validation

```bash
npm run commands:validate
npm run mcp:validate
npm test
```

## Optional MCP surface

The package registers one local stdio MCP server named `paper-factory`:

```json
{
  "mcpServers": {
    "paper-factory": {
      "type": "stdio",
      "command": "node",
      "args": ["./mcp/paper-state-server.mjs"]
    }
  }
}
```

The core workflow still works without MCP because `.paper/` remains authoritative.
