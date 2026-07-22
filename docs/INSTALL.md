# Installation

Dove ships as the `dove` package and `dove` CLI. Installing Dove adds a host-neutral workflow core plus optional host adapters, without bootstrapping project workflow state. A confirmed `/dove:init` or confirmed first mission creates the sealed minimal schema 9 workspace: manifest, project identity, and required directories. Ownership and lineage are derived later from immutable execution receipts. Existing legacy or invalid `.dove` state requires an explicit zero-write `dove init --archive-reset` proposal followed by exact direct-process confirmation; no archived content is imported or repaired.

`dove doctor` is read-only. It reports runtime-only state when `.dove` is absent, current schema health when schema 9 is present, and archive-reset-required for legacy or invalid state. It never bootstraps or repairs the workspace.

## Supported install model

The supported install path is host-neutral at the core and adapter-based at the operator surface:

1. copy or sync the standalone runtime bundles (`dist/index.mjs`, `bin/dove-package.mjs`, `mcp/dove-state-server-package.mjs`, and `scripts/doctor-mcp-probe-package.mjs`) plus necessary public docs
2. install requested host adapters generated from the canonical command manifest
3. let the selected host discover Dove command or skill adapter files plus the local MCP configuration when that host supports it
4. leave project workflow state untouched during install/sync
5. let only explicit schema 9 init, mission, receipt, and domain workflows create the state they own

The installed npm package does not include raw `src/` modules or raw development scripts. The package `exports` map restricts package specifiers, but physical omission of raw source provides the filesystem isolation needed to block sibling-URL imports from the public root bundle.

Supported adapter IDs are `opencode`, `codex`, `cursor`, `agents`, `claude`, and `all`. OpenCode remains the default install target, every supported project-local host receives the same flat top-level Dove command set generated from the manifest, and `claude` writes the same manifest-generated commands into the current user's Claude Code command directory while registering the local Dove server in the target project's `.mcp.json`. Claude install and sync do not read, create, rewrite, clean, or warn about `settings.json`, shell startup files, Fast mode, model selection or discovery, context or compact windows, output limits, or environment variables. Project installs do not copy `.claude/commands/dove` into the target project.

## Project-local install

From the target project directory after installing the published package:

```bash
npm install --save-dev dove

# Default: neutral core + OpenCode adapter
npx dove install . --force

# Install selected optional project adapters
npx dove install . --force --host cursor
npx dove install . --force --host codex --host agents

# Install every safe adapter surface, including user-level Claude Code commands and project MCP registration
npx dove install . --force --host all

# Sync the user-level Claude Code /dove:* commands and this project's MCP registration
npx dove sync . --force --host claude
```

After the runtime bundle has been copied into the target, `node ./bin/dove-package.mjs ...` is the direct installed-project entrypoint. The raw `bin/dove.mjs` entrypoint exists only in a Dove source checkout.

`sync` accepts the same `--host` flags.

## Existing paper workspaces

Initialize schema 9 explicitly with `dove init`. Existing legacy or invalid `.dove` state is never imported, repaired, or mapped into the current schema; use the exact `--archive-reset` proposal and direct-process confirmation when replacement is intended. Existing manuscript assets remain outside `.dove` until a mission-bound workflow explicitly imports or references them.

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

The daily workflow is: initialize schema 9, confirm one minimal mission contract, use explicit mission-bound source/note/experience/figure/draft/review/rebuttal/version workflows for substantive work, explicitly query or record advisory lessons when requested, and inspect current integrity through read-only status. `dove.lessons` never captures or recalls automatically; record is zero-write until exact confirmation. Removed packet, board, runtime, navigation, review-loop, operator, and public-status surfaces are not callable through the packaged CLI or MCP.

The host surface has exactly 12 workflows. Separately, the CLI has 16 top-level subcommands (`install`, `sync`, `doctor`, `init`, `mission`, `receipt`, `status`, `lessons`, `version`, `source`, `note`, `draft`, `experience`, `figure`, `review`, and `rebuttal`), 28 MCP tools, and 60 generated adapters: 48 checked-in project adapters plus 12 Claude user commands. The `lessons` and `source` action words are operations inside those top-level CLI subcommands, not additional inventory entries.

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

The doctor command is read-only. It checks installed runtime/adapters and reports a healthy schema 9 workspace, an absent workspace, or a legacy/invalid workspace that requires explicit archive-reset, without creating or refreshing `.dove/` artifacts. For Claude it checks the project MCP registration, the small project installation marker, and the generated user command adapters; settings and shell configuration are outside doctor health. The project marker lets doctor report a deleted `.mcp.json` without treating globally shared Claude commands as proof that every project uses Dove.

## Update boundary safety

`install` and `sync` treat `.dove/` as user-owned workspace data and do not create or refresh it. They never copy a packaged `.dove/` tree over the target project as managed code.

Adapter copying is allowlisted to Dove project surfaces only: `.opencode/commands/dove*.md`, `.opencode/skills/dove-*`, `.cursor/commands/dove-*.md`, `.codex/skills/dove-*`, `.agents/skills/dove-*`, `.opencode.json`, and the Dove-native `AGENTS.md`. The `claude` host combines user-level commands with project registration: `install`/`sync` render the generated commands to `~/.claude/commands/dove` (or `DOVE_CLAUDE_CONFIG_DIR` for isolated validation), merge only `mcpServers.dove` into the target `.mcp.json`, and write a small managed marker under `mcp/` for project-specific doctor detection. The `.mcp.json`, marker, project runtime, and user commands are one atomic transaction. Existing top-level JSON fields and other MCP servers are preserved; malformed JSON, unsupported shapes, symbolic links, and a conflicting Dove server fail before any write, even with `--force`. Local development scaffolding, host settings, and project-local `.claude/commands/dove` files are not installed as Dove product surfaces. Managed package paths are declared by the command manifest; `.dove/` is outside that managed install boundary.

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

Claude install/sync registers one project-scoped local stdio MCP server named `dove` in `.mcp.json`:

```json
{
  "mcpServers": {
    "dove": {
      "type": "stdio",
      "command": "node",
      "args": ["${CLAUDE_PROJECT_DIR:-.}/mcp/dove-state-server-package.mjs"]
    }
  }
}
```

Generated host adapters call Dove through MCP only and stop if the server is unavailable; they do not fall back to the CLI or shell. The project-root expansion and server-side `CLAUDE_PROJECT_DIR` root selection keep the same installation valid when Claude starts from a project subdirectory. Install and sync reject missing or unsafe managed package sources and duplicate JSON object keys before writing while preserving unrelated unique-key fields and servers. Doctor does not approve or modify project trust: it reports registered, pending approval, connected, or failed separately and runs the installed 28-tool/decline/zero-write package probe only after Claude reports a connection. The low-level CLI remains available for install, sync, doctor, maintenance, and explicit manual workflows. `.dove/` remains the authoritative durable state rather than an MCP session database.
