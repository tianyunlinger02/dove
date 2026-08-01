# Installation

Dove uses separate user installation and project initialization.

The bare public npm package named `dove` is unrelated. Use an exact tarball, Git revision, or internal-registry package/version supplied by a trusted Dove release channel.

## Requirements

- Node.js `>=22`
- npm
- Claude Code for the currently accepted project initialization path

Generated adapters for other hosts are package artifacts and do not establish registration, connection, or readiness.

## Install the user CLI

```bash
npm install --global <exact-dove-package-specifier>
```

This places `dove` on the current user's `PATH`. It does not write projects, edit shell startup files, write global host configuration, or create `.dove/`.

## Initialize one project

```bash
cd <target-project>
dove init --host claude
```

Initialization writes only managed project integration:

- `.dove-install/manifest.json`;
- 12 Claude command adapters under `.claude/commands/dove/`;
- `.claude/rules/dove.md`;
- hidden `.claude/skills/dove-intake/SKILL.md` and `.claude/skills/dove-lessons-intake/SKILL.md`;
- the managed `UserPromptSubmit` hook fragment in `.claude/settings.json`;
- Dove MCP registration in `.mcp.json`; and
- the minimal project-local MCP approval setting.

Unrelated project settings and hooks are preserved. Project configuration invokes `dove mcp serve --project ...` and `dove hook user-prompt-submit --project ...` from `PATH`. No runtime bundle is copied into project `bin/`, `dist/`, `mcp/`, or `scripts/`, and no absolute path or fallback command is installed.

## Establish the Workspace

After initialization, re-enter Claude Code from the project, approve Dove MCP if prompted, and run:

```text
/dove:workspace
```

The Skill briefly inspects the project, states its situation and structure, and immediately establishes one concise title-like research mainline. It creates current Schema 18 `.dove/` state only through this explicit operation. Unsupported prior state requires an explicit archive reset; it is never imported or converted.

## Ambient resources

The project hook selects two hidden non-slash routes:

- `dove-intake` for clear ordinary or research work, creating only through `create_ambient_dove_mission` before host execution;
- `dove-lessons-intake` for explicit Lessons read, remember, or reflect requests, using only `manage_dove_lessons` and creating no Mission.

Both routes may ask one zero-write clarification round for material ambiguity. Slash commands remain explicit.

## Sync

```bash
dove sync
```

Sync refreshes only hosts recorded by a valid `.dove-install/manifest.json`. It does not infer a host from files, create `.dove/`, migrate research state, or select another host.

## Doctor

```bash
dove doctor
```

Doctor is read-only and reports user CLI health, managed project integration, Workspace state, host registration, readiness, and obsolete copied runtime separately. An absent `.dove/` after project initialization is healthy. Claude readiness requires `claude mcp get dove` to report `Connected`.

## Ownership and cutover

- `.dove-install/` and declared host files are Dove-managed integration.
- `.dove/` and archived research workspaces are user-owned research state.
- project documentation, unrelated host settings, and unrelated hooks remain user-owned.

Dove 0.4.0 is a clean Schema 18 cutover. There is no state migration, compatibility shim, alias, copied-runtime fallback, or automatic deletion of unsupported state.
