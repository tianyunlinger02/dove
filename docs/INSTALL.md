# Installation

Dove ships as the `dove` package and `dove` CLI. Installing Dove adds a host-neutral workflow core plus optional host adapters, then bootstraps a project-local `.dove/` workspace as the authoritative durable state root.

Ignored stale workspace artifacts are not imported automatically. If they exist, `dove doctor` reports them as warnings so an operator can decide how to handle them explicitly.

## Supported install model

The supported install path is host-neutral at the core and adapter-based at the operator surface:

1. copy or sync neutral package files into a target project (`bin/`, `docs/`, `mcp/`, `scripts/`, `src/`, and `README.md`)
2. install requested host adapters generated from the canonical command manifest
3. let the selected host discover Dove command or skill adapter files plus the local MCP configuration when that host supports it
4. bootstrap missing `.dove/` artifacts without overwriting user-owned workspace state
5. write `.dove/manifest.json` as the Dove authority manifest

Supported adapter IDs are `opencode`, `codex`, `cursor`, `agents`, `claude`, and `all`. OpenCode remains the default install target, every supported project-local host receives the same flat top-level Dove command set generated from the manifest, and `claude` writes the same manifest-generated commands into the current user's Claude Code config. The Claude host setup also ensures Dove's non-secret Claude Code gateway defaults for Fast mode, model discovery, explicit context and auto-compact windows, and the output-token ceiling. Claude Code uses one user-level `/dove:*` command set, so project installs do not copy `.claude/commands/dove` into the target project.

The Claude gateway defaults write only fixed compatibility switches to Claude Code settings and a managed shell startup block. Dove never writes API keys, auth tokens, provider keys, tunnel tokens, or passwords. Restart Claude Code after `install` or `sync`; when launching from an existing tmux shell, source the shell startup file or open a new shell before starting Claude Code.

## Project-local install

From the repository root:

```bash
# Default: neutral core + OpenCode adapter
node ./bin/dove.mjs install . --force

# Install selected optional project adapters
node ./bin/dove.mjs install . --force --host cursor
node ./bin/dove.mjs install . --force --host codex --host agents

# Install every safe adapter surface, including user-level Claude Code commands and gateway defaults
node ./bin/dove.mjs install . --force --host all

# Sync only the user-level Claude Code /dove:* commands and gateway defaults
node ./bin/dove.mjs sync . --force --host claude
```

`sync` accepts the same `--host` flags.

## Existing paper onboarding

```bash
# Proposal-only scan; writes nothing
node ./bin/dove.mjs onboard .

# Persist only the proposed reference map
node ./bin/dove.mjs onboard . --write-map
```

The artifact map lives at `.dove/workspace/artifact-map.json` and records source path, lifecycle family, suggested `.dove` target, confidence, conflicts, unmapped assets, and recommended next actions. The onboarding flow never moves, deletes, imports, rewrites, or overwrites manuscript assets.

## Dove task workflow

Use the installed host adapters or MCP tools for task-centered workflow operations:

```text
project:dove.init
project:dove.mission
project:dove.auto
project:dove.status
project:dove.operator
project:dove.lessons
project:dove.version
project:dove.source
project:dove.note
project:dove.figure
project:dove.experience
project:dove.draft
project:dove.review
project:dove.review-loop
project:dove.rebuttal
```

The daily workflow is: create/update the unique init goal, create or auto-run concrete tasks under that goal, use preset commands for source/note/experience/figure/draft/review/rebuttal work, inspect and adjust state through status, run ready work through operator, and record reusable lessons explicitly. Lower-level CLI and MCP support tools may still exist for validation or import/export workflows, but they are not separate public slash commands.

## Language configuration

Dove defaults to Chinese responses. To switch a workspace to English, add this to `.dove/config.json` or `.dove/config.local.json`:

```json
{
  "language": "en"
}
```

Supported values are `zh` for Chinese and `en` for English. `DOVE_LANGUAGE` or `DOVE_RESPONSE_LANGUAGE` can override the file preference for a single process.

## Health check

```bash
node ./bin/dove.mjs doctor .
```

The doctor command checks the neutral core, `.dove/state.json`, `.dove/manifest.json`, the MCP entrypoint, required adapter files, key JSON artifacts, typed-wiki and figure-managed internals, installed host adapters, artifact-map status, ignored stale workspace artifacts, and the local MCP probe. When the Claude host config is explicitly targeted or already managed by Dove, doctor also reports whether the Claude Code gateway defaults are present and suggests `dove sync . --host claude` instead of mutating user config.

## Update boundary safety

`install` and `sync` treat `.dove/` as user-owned workspace data. The CLI bootstraps missing `.dove` artifacts via the workspace initializer, but it does not copy a packaged `.dove/` tree over the target project as managed code.

Adapter copying is allowlisted to Dove project surfaces only: `.opencode/commands/dove*.md`, `.opencode/skills/dove-*`, `.cursor/commands/dove-*.md`, `.codex/skills/dove-*`, `.agents/skills/dove-*`, `.opencode.json`, and the Dove-native `AGENTS.md`. Those paths are derived from `src/core/command-manifest.mjs`; run `npm run commands:generate` to rewrite checked-in project adapters and `npm run commands:check` to detect drift. The `claude` host is user-level: `install`/`sync` render the same manifest commands to `~/.claude/commands/dove` (or `DOVE_CLAUDE_CONFIG_DIR` for tests) and ensure the non-secret Claude Code gateway defaults without copying `.claude/commands/dove` into the target project. Local development scaffolding, host settings, and project-local `.claude/commands/dove` files are not installed as Dove product surfaces. The durable boundary description lives in `.dove/workflow-pack/boundaries.json`.

## Validation

```bash
npm run commands:check
npm run commands:validate
npm run mcp:validate
npm test
npm run doctor:validate

# Full pre-release/package gate
npm run release:check
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
