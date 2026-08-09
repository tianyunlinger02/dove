# Installation

Dove uses a two-stage model:

1. install an exact trusted npm artifact for the current user so `dove` is available on `PATH`;
2. initialize each project explicitly.

The bare public npm package named `dove` is unrelated. Do not use bare `npm install -g dove` or bare `npx dove` as trusted release instructions.

## Requirements

- Node.js `>=22`
- npm
- Claude Code for the complete supported project initialization path

OpenCode, Codex, Cursor, and shared-agent adapters are packaged release artifacts, but this release does not provide or claim a complete project installation, MCP registration, and readiness path for them.

## User installation

```bash
npm install --global <exact-dove-package-specifier>
```

Use an exact trusted tarball, Git revision, or internal-registry version. User installation places `dove` on `PATH`. It does not write projects, shell startup files, user/global host configuration, or research state.

## Claude project initialization

From the target project:

```bash
dove init --host claude
```

Initialization may write:

- `.dove/install/manifest.json`;
- nine project-local commands under `.claude/commands/dove/`;
- one project-local Claude Reviewer definition;
- one ambient rule and two hidden intake Skills;
- the project-local `UserPromptSubmit` hook fragment; and
- Dove MCP registration in the project's `.mcp.json`.

It preserves unrelated project configuration. It does not initialize Research Format 1, create a Workspace, create a Mission, copy runtime bundles into the project, write an absolute CLI path, edit user/global configuration, or install a fallback runtime.

After initialization, leave and re-enter Claude Code from the project. If the host asks for MCP approval, approve the project-local Dove server. Then continue ordinary project work or invoke `/dove:research` when research routing is useful.

An absent Research Workspace is normal. The Research Skill can first inspect ordinary project material outside `.dove` without writes. It initializes durable research state only through an explicit `manage_dove_workspace` request; it never creates a Workspace or Mission merely because a Skill was invoked.

## Current integration marker

Current project integration is stored at:

```text
.dove/install/manifest.json
```

`.dove-install/manifest.json` is accepted only as a legacy project Upgrade or Complete Reinstall input. It is not current state, a fallback root, or a compatibility authority.

## Runtime invocation

Project configuration invokes the user-installed command by name:

```text
dove mcp serve --project <project-root>
dove hook user-prompt-submit --project <project-root>
```

There is no source-checkout, copied-runtime, shell-business-command, or direct `.dove` fallback. If the user-installed CLI is unavailable, host Skills stop rather than escaping through another transport.

## Sync

```bash
dove sync
```

Sync refreshes only hosts recorded in the current installation manifest. A missing, malformed, contradictory, or unsafe manifest fails closed. Sync does not create or repair Research Format 1.

## Upgrade

```bash
dove upgrade
```

Project Upgrade refreshes managed integration while preserving current Research Format 1 bytes. It may consume a valid legacy `.dove-install/manifest.json` and move a legacy `.dove-archive/` into `.dove/archive/`. It does not migrate unsupported research formats and does not manage user npm.

## Complete Reinstall

```bash
dove reinstall
```

Complete Reinstall displays the selected-project deletion inventory and asks once for explicit confirmation. The default is No. On approval it removes project-private Dove integration, optional research state, recognized legacy roots, and obsolete copied runtimes, then recreates only current project integration under `.dove/install/`.

It does not remove or update the user's npm installation, ordinary project files, or unrelated shared configuration fields.

## Doctor

```bash
dove doctor
dove doctor --json
```

Doctor is read-only and reports separately:

- user CLI health;
- current or legacy project integration;
- project MCP connection and runtime compatibility;
- shallow research-format state;
- Claude registration/readiness; and
- obsolete copied-runtime evidence.

Human output explains the state and safe next action. Machine tokens remain in JSON diagnostics. Doctor does not initialize, repair, migrate, reset, or delete research state.

## Research formats

Research Format 1 uses the exact marker `dove-research-v1`. A completely absent Research Workspace and install-only `.dove` are normal. Legacy, future, malformed, symlinked, or incomplete research formats fail closed and remain unchanged.

Dove has no fallback reader, alias root, or automatic research migration. Only explicitly confirmed Complete Reinstall may delete unsupported selected-project state.

## Public inventories

- 9 Skills
- 8 MCP tools
- 45 generated adapters
- 7 runtime CLI commands
- 5 package bundles
- 7 Research Format 1 entities

Only Claude has a complete project initialization and registration path in 0.7.0.

## Maintainer validation

```bash
npm run commands:check
npm run commands:validate
npm run mcp:validate
npm run check
npm run release:check
npm run pack:dry-run
```

Run lifecycle tests only against isolated synthetic scratch projects. Never run install, sync, upgrade, reinstall, or reset against real research state during validation.
