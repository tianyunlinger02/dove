# Installation

Dove ships as the `dove` package and `dove` CLI. Installing Dove adds a host-neutral workflow core plus optional host adapters, then bootstraps a project-local `.dove/` workspace as the authoritative durable state root.

Old `.paper/` files are not imported automatically. If they exist, `dove doctor` reports them as stale legacy state so an operator can decide how to handle them explicitly.

## Supported install model

The supported install path is host-neutral at the core and adapter-based at the operator surface:

1. copy or sync neutral package files into a target project (`bin/`, `docs/`, `mcp/`, `scripts/`, `src/`, and `README.md`)
2. install requested host adapters
3. let the selected host discover Dove command or skill adapter files plus the local MCP configuration when that host supports it
4. bootstrap missing `.dove/` artifacts without overwriting user-owned workspace state
5. write `.dove/manifest.json` as the Dove authority manifest

Supported adapter IDs are `opencode`, `claude`, `codex`, `cursor`, `agents`, and `all`.

## Project-local install

From the repository root:

```bash
# Default: neutral core + OpenCode adapter
node ./bin/dove.mjs install . --force

# Install selected optional adapters
node ./bin/dove.mjs install . --force --host claude,cursor
node ./bin/dove.mjs install . --force --host codex --host agents

# Install every safe adapter surface
node ./bin/dove.mjs install . --force --host all
```

`sync` accepts the same `--host` flags.

## Existing paper onboarding

```bash
# Proposal-only scan; writes nothing
node ./bin/dove.mjs onboard .

# Alias with the same behavior
node ./bin/dove.mjs migrate .

# Persist only the proposed reference map
node ./bin/dove.mjs onboard . --write-map
```

The artifact map lives at `.dove/workspace/artifact-map.json` and records source path, lifecycle family, suggested `.dove` target, confidence, conflicts, unmapped assets, and recommended next actions. The onboarding flow never moves, deletes, imports, rewrites, or overwrites manuscript assets.

## Dove queries and governed launch

```bash
# Route one mission without writing durable state
node ./bin/dove.mjs orchestrate . --request "Ship cache safely" --domain engineering --stage execution

# Frame one mission contract without writing durable state
node ./bin/dove.mjs mission . --domain engineering --stage execution --artifact src/cache.mjs --acceptance-check "tests or validation output"

# Inspect the as-read mission board without writing or refreshing
node ./bin/dove.mjs board . --domain engineering

# Inspect audit and return readiness without writing, fixing, running tests, or inspecting git
node ./bin/dove.mjs audit . --domain engineering --changed-file src/cache.mjs --test-evidence tests/cache.test.mjs --validation-output tmp/cache-test.log
node ./bin/dove.mjs return . --domain engineering --changed-file src/cache.mjs --test-evidence tests/cache.test.mjs --validation-output tmp/cache-test.log

# Governed launch after accepted guidance exists
node ./bin/dove.mjs launch . --source-type remediation-pack --source-id <pack-id> --execute-by 2099-01-01T00:00:00.000Z --review-after 2099-01-01T12:00:00.000Z --domain engineering --stage execution
```

The query commands return proposal-only JSON and do not create mission packets, update the board, append handoffs, refresh workspace indexes, run tests, inspect git, execute autonomy, or repair `.dove` artifacts. `dove launch` is a guarded write surface that requires an accepted source plus `executeBy` and `reviewAfter`, writes mission packets under `.dove/task-packets`, and does not execute autonomy.

## Health check

```bash
node ./bin/dove.mjs doctor .
```

The doctor command checks the neutral core, `.dove/state.json`, `.dove/manifest.json`, the MCP entrypoint, required adapter files, key JSON artifacts, typed-wiki and figure-managed internals, installed host adapters, artifact-map status, stale legacy `.paper/` conflicts, and the local MCP probe.

## Update boundary safety

`install` and `sync` treat `.dove/` as user-owned workspace data. The CLI bootstraps missing `.dove` artifacts via the workspace initializer, but it does not copy a packaged `.dove/` tree over the target project as managed code.

Adapter copying is allowlisted to Dove surfaces only: `.opencode/commands/dove*.md`, `.opencode/skills/dove-*`, `.claude/commands/dove`, `.cursor/commands/dove-*.md`, `.codex/skills/dove-*`, `.agents/skills/dove-*`, `.opencode.json`, and the Dove-native `AGENTS.md`. Trellis development commands, skills, plugins, agents, and local host settings are not installed as Dove product surfaces. The durable boundary description lives in `.dove/workflow-pack/boundaries.json`.

## Validation

```bash
npm run commands:validate
npm run mcp:validate
npm test
```

## Optional MCP surface

The package registers one local stdio MCP server named `dove`:

```json
{
  "mcpServers": {
    "dove": {
      "type": "stdio",
      "command": "node",
      "args": ["./mcp/dove-state-server.mjs"]
    }
  }
}
```

The core workflow still works without MCP because `.dove/` remains authoritative.
