# Installation

Dove ships as the `dove` package and `dove` CLI. Installing Dove adds a host-neutral workflow core plus optional host adapters, without bootstrapping project workflow state. A confirmed `/dove:init` or confirmed first mission creates the sealed minimal schema 7 workspace: manifest, project identity, ownership/lineage indexes, and required directories. Existing legacy or invalid `.dove` state requires an explicit zero-write `dove init --archive-reset` proposal followed by exact direct-process confirmation; no archived content is imported or repaired.

`dove doctor` is read-only. It reports runtime-only state when `.dove` is absent, current schema health when schema 7 is present, and archive-reset-required for legacy or invalid state. It never bootstraps or repairs the workspace.

## Supported install model

The supported install path is host-neutral at the core and adapter-based at the operator surface:

1. copy or sync the standalone runtime bundles (`dist/index.mjs`, `bin/dove-package.mjs`, `mcp/dove-state-server-package.mjs`, and `scripts/doctor-mcp-probe-package.mjs`) plus necessary public docs
2. install requested host adapters generated from the canonical command manifest
3. let the selected host discover Dove command or skill adapter files plus the local MCP configuration when that host supports it
4. leave project workflow state untouched during install/sync
5. let only explicit schema 7 init, mission, receipt, and domain workflows create the state they own

The installed npm package does not include raw `src/` modules or raw development scripts. The package `exports` map restricts package specifiers, but physical omission of raw source provides the filesystem isolation needed to block sibling-URL imports from the public root bundle.

Supported adapter IDs are `opencode`, `codex`, `cursor`, `agents`, `claude`, and `all`. OpenCode remains the default install target, every supported project-local host receives the same flat top-level Dove command set generated from the manifest, and `claude` writes the same manifest-generated commands into the current user's Claude Code config. The Claude host setup also ensures Dove's non-secret Claude Code gateway defaults for Fast mode, model discovery, explicit context and auto-compact windows, and the output-token ceiling. Claude Code uses one user-level `/dove:*` command set, so project installs do not copy `.claude/commands/dove` into the target project.

The Claude gateway defaults write only fixed compatibility switches to Claude Code settings and a managed shell startup block. Dove never writes API keys, auth tokens, provider keys, tunnel tokens, or passwords. Restart Claude Code after `install` or `sync`; when launching from an existing tmux shell, source the shell startup file or open a new shell before starting Claude Code.

## Project-local install

From the target project directory after installing the published package:

```bash
npm install --save-dev dove

# Default: neutral core + OpenCode adapter
npx dove install . --force

# Install selected optional project adapters
npx dove install . --force --host cursor
npx dove install . --force --host codex --host agents

# Install every safe adapter surface, including user-level Claude Code commands and gateway defaults
npx dove install . --force --host all

# Sync only the user-level Claude Code /dove:* commands and gateway defaults
npx dove sync . --force --host claude
```

After the runtime bundle has been copied into the target, `node ./bin/dove-package.mjs ...` is the direct installed-project entrypoint. The raw `bin/dove.mjs` entrypoint exists only in a Dove source checkout.

`sync` accepts the same `--host` flags.

## Existing paper workspaces

Initialize schema 7 explicitly with `dove init`. Existing legacy or invalid `.dove` state is never imported, repaired, or mapped into the current schema; use the exact `--archive-reset` proposal and direct-process confirmation when replacement is intended. Existing manuscript assets remain outside `.dove` until a mission-bound workflow explicitly imports or references them.

## Dove mission workflow

Use the installed host adapters or MCP tools for mission-bound workflow operations:

```text
project:dove.init
project:dove.mission
project:dove.status
project:dove.lessons
project:dove.version
project:dove.source
project:dove.note
project:dove.figure
project:dove.experience
project:dove.draft
project:dove.review
project:dove.rebuttal
```

The daily workflow is: initialize schema 7, confirm one minimal mission contract, use explicit mission-bound source/note/experience/figure/draft/review/rebuttal/version workflows for substantive work, explicitly query or record advisory lessons when requested, and inspect current integrity through read-only status. `dove.lessons` never captures or recalls automatically; record is zero-write until exact confirmation. Removed packet, board, runtime, navigation, review-loop, operator, and public-status surfaces are not callable through the packaged CLI or MCP.

The installed inventory is exactly 12 public commands and 27 MCP tools. The command generator produces 60 adapters when the four checked-in project hosts and 12 Claude user commands are counted together. Retired operator lesson storage and tool names are not installed.

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
node ./bin/dove-package.mjs doctor .
```

The doctor command is read-only. It checks installed runtime/adapters and reports a healthy schema 7 workspace, an absent workspace, or a legacy/invalid workspace that requires explicit archive-reset, without creating or refreshing `.dove/` artifacts. When the Claude host config is explicitly targeted or already managed by Dove, doctor also reports whether the Claude Code gateway defaults are present and suggests `dove sync . --host claude` instead of mutating user config.

## Update boundary safety

`install` and `sync` treat `.dove/` as user-owned workspace data and do not create or refresh it. They never copy a packaged `.dove/` tree over the target project as managed code.

Adapter copying is allowlisted to Dove project surfaces only: `.opencode/commands/dove*.md`, `.opencode/skills/dove-*`, `.cursor/commands/dove-*.md`, `.codex/skills/dove-*`, `.agents/skills/dove-*`, `.opencode.json`, and the Dove-native `AGENTS.md`. The `claude` host is user-level: `install`/`sync` render the same generated commands to `~/.claude/commands/dove` (or `DOVE_CLAUDE_CONFIG_DIR` for isolated validation) and ensure the non-secret Claude Code gateway defaults without copying `.claude/commands/dove` into the target project. Local development scaffolding, host settings, and project-local `.claude/commands/dove` files are not installed as Dove product surfaces. Managed package paths are declared by the command manifest; `.dove/` is outside that managed install boundary.

## Source-checkout validation

These commands are maintainer-only and must be run from a Dove source checkout; an installed target does not contain the raw validation scripts or test suite.

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
      "args": ["./mcp/dove-state-server-package.mjs"]
    }
  }
}
```

The core workflow still works without MCP because `.dove/` remains authoritative.
