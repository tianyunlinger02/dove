# Installation

`paper_factory` ships as a workflow pack, not a fake host fork.

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

## Health check

```bash
node ./bin/paper-factory.mjs doctor .
```

The doctor command checks the neutral core, `.paper/state.json`, the MCP entrypoint, and the required files for each installed host adapter.
It also parses key JSON artifacts, reports degraded typed-wiki or figure-managed internals explicitly, exposes installed host adapters, reports proposal-first artifact-map status for legacy paper assets, and probes the local MCP server so a workspace cannot look healthy purely because files exist.

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
