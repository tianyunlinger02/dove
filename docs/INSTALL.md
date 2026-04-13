# Installation

`paper_factory` ships as a workflow pack, not a fake host fork.

## Supported install model

The supported install path today is:

1. copy or sync the package files into a target project
2. let OpenCode discover commands from `.opencode/commands/`
3. let OpenCode discover skills from `.opencode/skills/`
4. optionally let OpenCode start the local `paper-factory` MCP server from `.opencode.json`
5. bootstrap missing `.paper/` artifacts without overwriting user-owned workspace state

## Project-local install

From the repository root:

```bash
node ./bin/paper-factory.mjs install . --force
```

## Health check

```bash
node ./bin/paper-factory.mjs doctor .
```

The doctor command checks for the required command pack, skill pack, `.paper/state.json`, `.opencode.json`, and the MCP entrypoint.
It also parses key JSON artifacts, reports degraded typed-wiki or figure-managed internals explicitly, and probes the local MCP server so a workspace cannot look healthy purely because files exist.

## Update boundary safety

`install` and `sync` treat `.paper/` as **user-owned workspace data**. The CLI bootstraps missing `.paper` artifacts via the workspace initializer, but it no longer copies the packaged `.paper/` tree over the target project as managed code.

The durable boundary description lives in `.paper/workflow-pack/boundaries.json`.

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
