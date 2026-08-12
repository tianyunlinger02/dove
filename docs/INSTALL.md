# Installation

Dove 3.0.0 uses two installation scopes:

1. install an exact trusted package for the current user so `dove` is available on `PATH`; and
2. initialize each Claude Code project explicitly.

There is no research MCP server, MCP registration step, or project MCP configuration in Dove 3.0.

The bare public npm package named `dove` is unrelated. Do not use bare `npm install -g dove` or bare `npx dove` as trusted release instructions.

## Requirements

- Node.js `>=22`
- npm
- Claude Code for the supported project initialization path

Generated OpenCode, Codex, Cursor, and shared-agent adapters may be packaged, but their presence does not establish a supported initialization path, registration, connectivity, or readiness.

## User installation

```bash
npm install --global <exact-dove-package-specifier>
```

Use an exact trusted tarball, Git revision, or internal-registry version. User installation places `dove` on `PATH`. It does not modify a project, shell startup files, host settings, or research documents.

## Claude project initialization

From the target project:

```bash
dove init --host claude
```

Initialization may add:

- `.dove/install/manifest.json`;
- the ten Claude command adapters under `.claude/commands/dove/`;
- the Claude Reviewer role definition;
- the Claude ambient rule and hidden intake resources; and
- the Dove prompt-hook fragment in `.claude/settings.json`.

It does not create a research MCP entry, add a project `.mcp.json`, start a server, create `.dove/research/RESEARCH.md`, create a Mission, or copy runtime bundles into the project.

After initialization, leave and re-enter Claude Code from the project so a new host session can load the project integration.

## Installation metadata and Doctor state

Dove-owned project software metadata lives under:

```text
.dove/install/
├── manifest.json
├── doctor.json    # optional Doctor machine state
└── DOCTOR.md      # readable current problems and recent resolutions
```

The project installation manifest uses revision `2.0`:

```json
{"revision":"2.0"}
```

The manifest records the installed package, selected host integration, managed resources, and timestamps needed for lifecycle safety. Doctor machine state tracks bounded local software and integration issues; `DOCTOR.md` presents them in readable form without internal IDs or hashes. Neither is research content.

Dove may use hashes internally to detect conflicting or changed managed files. Those values protect installation bytes; they are not source identities, research evidence, or scientific validation.

## Project and file safety

Dove resolves one real project root before changing project integration. Lifecycle operations reject escaping or ambiguous managed paths and avoid following symlinks where Dove owns the boundary.

Initialization and synchronization follow these rules:

- ordinary project files are not touched;
- unrelated fields and other hooks in shared configuration are preserved;
- an existing generated Dove resource may be adopted when it already matches;
- conflicting content blocks initialization; and
- later user changes to managed content block automatic replacement rather than being overwritten.

Project integration changes are staged and checked before promotion. Cleanup warnings after a completed change are reported separately.

## Synchronization

```bash
dove sync
dove sync --host claude
```

Synchronization refreshes only recognized Dove-managed project integration and its manifest. It does not read, rewrite, normalize, or validate `.dove/research/` documents.

## Upgrade

```bash
dove upgrade
```

Upgrade refreshes recognized project integration while preserving ordinary project files and research Markdown. It does not convert old structured research state automatically and does not rewrite human-authored research documents.

## One-time research export

```bash
dove export-research
```

`export-research` is the explicit one-time conversion from supported legacy JSON research state to Dove 3 Markdown documents. It archives the original legacy JSON bytes under `.dove/archive/...` before completing the conversion.

Important boundaries:

- v1 research state is not converted;
- normal Dove 3 work does not read old JSON as a fallback;
- `init`, `sync`, `upgrade`, and Doctor never export research implicitly; and
- running a real export against project research requires separate user authorization. Do not use real research as an installation or validation fixture.

If the source cannot be converted without inventing meaning, preserve the source and stop rather than fabricating a document.

## Complete Reinstall

```bash
dove reinstall
```

Complete Reinstall displays the selected-project deletion scope and asks for confirmation. The default is No.

After confirmation, it removes Dove-owned project state, including research under `.dove/` and Dove archives such as `.dove/archive/` or recognized older archive locations, then recreates current project integration as applicable. This deliberately deletes Dove research history and exported old-state archives.

It preserves ordinary project files and unrelated shared-configuration fields. It does not update or remove the user's global npm installation.

Use Complete Reinstall only when the user intends a destructive project reset. `sync` and `upgrade` are the non-destructive choices for refreshing integration.

## Doctor

```bash
dove doctor
dove doctor --json
```

Doctor reports observable software, package, project-integration, prompt-hook, and local file-readability facts. Manual Doctor does not repair or rewrite research documents. Its optional state remains under `.dove/install/` and must not become a research log, prompt history, or scientific health score.

A healthy Doctor result means the checked software boundary appears usable. It does not mean the research is correct, complete, accepted, reproducible, or independently reviewed.

## CLI inventory

Dove 3.0 exposes these top-level commands:

```text
init, sync, upgrade, reinstall, doctor, export-research, hook
```

The prompt hook entry is:

```text
dove hook user-prompt-submit --project <project-root>
```

There is no `mcp` command and no `migrate-research` command.

## Supported project integration

Claude Code remains the supported project initialization path. Other generated adapters are canonical workflow projections for their host formats, not a registration or readiness guarantee.

## Maintainer validation

From a source checkout, use `npm run check` for the regular software gate and `npm run release:check` before packaging. Run destructive lifecycle and real export checks only in isolated synthetic projects unless the user separately authorizes work on real research data.
