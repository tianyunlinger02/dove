# Installation

Dove uses a two-stage installation model:

1. install the Dove npm artifact once for the current user so `dove` is available on that user's `PATH`; and
2. initialize each project explicitly with the host integration Dove should manage.

The matching Dove release is not currently available under the bare public npm name `dove`, which is occupied by an unrelated package. Use only an exact package specifier supplied by a trusted Dove release channel, such as a packed tarball, Git commit/tag specifier, or internal-registry specifier tied to the exact source revision.

Do not use bare `npm install -g dove` or bare `npx dove` as a trusted Dove entry point.

## Requirements

- Node.js `>=22`
- npm
- Claude Code or DeepSeek Harness (`dsh`)

Dove supports only these two hosts. Claude Code receives the complete project integration. DSH receives ten project-local filesystem Skills under `.dsh/skills/dove-*/SKILL.md`; Dove does not claim DSH slash commands, hooks, MCP, or a static agent surface without a future Cordis plugin.

## 1. One-time user installation

Install the exact Dove artifact for the current user according to the npm prefix policy used on that machine:

```bash
npm install --global <exact-dove-package-specifier>
```

The user-level npm installation installs the `dove` executable into the current user's npm binary path. It must not:

- write any project;
- edit shell startup or shell RC files;
- write user/global Claude, MCP, or other host configuration; or
- create or modify project research state.

If the npm binary directory is not already on `PATH`, configure the environment through the user's normal system administration process. Dove does not edit shell configuration on the user's behalf.

## 2. Project initialization

From the target project root, choose one supported host:

```bash
dove init --host claude
dove init --host dsh
```

Claude Code receives the complete integration described below. DSH receives the ten Dove filesystem Skills. `dove init` installs project integration and the minimal researcher-owned research entry. It may write:

- `.dove/install/manifest.json`;
- project-local Claude commands under `.claude/commands/dove/`;
- the project-local Dove agent at `.claude/agents/dove.md`;
- the project-local ambient rule and hidden intake skill;
- the project-local `SessionStart` and `UserPromptSubmit` hook registrations;
- the hidden `dove-paper-search` support skill and its pinned external MCP declaration in `.mcp.json`; and
- the minimal `.dove/research/RESEARCH.md` Markdown entry when no research tree exists.

It must preserve unrelated project configuration and preflight the complete managed write set before changing files.

Bare `dove` shows a concise project-aware home; in an interactive terminal it includes Dove's pixel-art bird and points to `dove` for setup, `dove update` when the project needs synchronization, `dove doctor` when attention is needed, or entering Claude Code to switch to the Dove agent or use `/dove:*` when the project is current. It is concise, not narrow: the point is to keep the mainline visible while still nudging toward the next productive move. `NO_COLOR=1` disables ANSI styling, redirected or piped output is clean text without the mascot, and `--json` or `--format json` emits only the direct machine-readable integration result.

`dove init` must not:

- copy the Dove runtime into project `bin/`, `dist/`, `mcp/`, or `scripts/` directories;
- write an absolute path to the installed CLI;
- write user/global host configuration or shell files;
- approve MCP trust or write credentials;
- use or install a fallback runtime; or
- silently import, migrate, repair, or delete legacy state.

There is no `dove install` command and no `--platform` option.

## Dove agent and ambient entry

The initialized Claude project contains one directly usable Dove agent plus flat capability commands:

- `.claude/agents/dove.md` is the complete Dove research-agent persona;
- `.claude/commands/dove/*.md` are the ten flat capability entrances;
- `.claude/rules/dove.md` and `.claude/skills/dove-intake/SKILL.md` provide conservative ambient routing.

Dove's flat Skills are `research`, `status`, `source`, `experiment`, `draft`, `figure`, `review`, `rebuttal`, `lessons`, and explicit-only `auto`. They are capability entrances, not separate personalities.

The prompt hook selects hidden intake only when the original prompt is a clear Dove work request involving research, papers, sources, experiments, drafts, figures, reviews, rebuttals, lessons, or research-adjacent project work. Intake routing is zero-write, may choose no Skill for contextual or pure judgment-only prompts, and never selects Auto. A separate pre-routing lifecycle bridge may transactionally refresh package-managed project integration from the user-installed CLI; it never touches `.dove/research/`. Pure judgment prompts should receive a direct Dove-style judgment and useful next move, then stop before side effects unless the user explicitly asks to execute or record; prompts that ask Dove to judge and then perform bounded work may route normally.

## Project runtime invocation

Project configuration invokes the user-installed `dove` command by name. It does not point to a copied bundle or an absolute installation path.

The Claude `SessionStart` hook uses the equivalent of:

```text
dove hook session-start --project <project-root>
```

The Claude `UserPromptSubmit` hook uses the equivalent of:

```text
dove hook user-prompt-submit --project <project-root>
```

Both lifecycle entry points use the current user-installed `dove` command on `PATH` to hot-sync recognized package-managed integration. `UserPromptSubmit` also bridges revision-2.0 projects initialized before SessionStart was installed. Hot sync never reads, creates, replaces, or deletes `.dove/research/**`; it does not migrate legacy manifests or perform Complete Reinstall. It guarantees current managed files on disk, not same-session Claude reload.

Dove does not install or expose a Claude `Stop` hook. Retired Dove-owned Stop hook fragments are removed only when they exactly match the old managed entry; user-owned or non-array Stop settings are preserved.

The optional paper-acquisition MCP declaration launches pinned `paper-search-mcp==0.1.4` through user-provided `uvx`. Dove does not install that package, approve project trust, write credentials, or provide a CLI/shell fallback for that MCP if it is unavailable; other already-approved host web/search tools, local PDFs, URLs, or user-provided material may still support source work.

## Integration manifest

`.dove/install/` is Dove-managed project-integration state. Its manifest records the hosts initialized for that project and the integration contract needed by `update` and `doctor`.

The manifest is not research evidence and must not contain substantive research artifacts. Users should not hand-edit managed integration files.

## Update

Run from an already initialized project:

```bash
dove update
```

`dove update` reads `.dove/install/manifest.json` and refreshes only the hosts already recorded there. The one absent-manifest adoption path is explicit `dove update` on a project that already has a readable current `.dove/research/` Markdown tree plus the old `.dove/manifest.json` workspace marker; it creates the revision-2.0 installation manifest, safely claims only current package-managed Claude integration, and leaves research bytes, DOCTOR notes, archives, old markers, private state, unrelated hooks, and unrelated MCP servers unchanged.

If the manifest is absent without that adoption state, malformed, contradictory, unsafe, or contains unknown managed-file or fragment drift, `dove update` fails closed. It must not reconstruct a manifest from generated adapters, hooks, MCP declarations, or copied runtime.

For an already initialized project, update refreshes only package-managed integration. It does not create missing summaries, complete navigation, replace Lessons materials, or rewrite `.dove/research/**`; existing research documents remain researcher-owned.

## Uninstall

Run `dove uninstall` from an initialized project. Dove first shows the exact removal scope and defaults to No. After confirmation it removes manifest-owned host files, Dove hook and MCP fragments, `.dove/install/manifest.json`, and a recognized retired `.dove/manifest.json` adoption marker when present. It preserves `.dove/research/**`, `.dove/install/DOCTOR.md`, unrecognized files at the legacy marker path, unrelated host settings, unrelated hooks, unrelated MCP servers, and ordinary project files. A project retaining current research Markdown is then classified as unconfigured rather than offered an update. Drift, symlinks, or changed transaction preconditions stop the uninstall and roll back staged changes.

## Doctor

Run from the project root:

```bash
dove doctor
```

Doctor is read-only and reports separate dimensions rather than collapsing them into one package check:

- **user CLI** — whether the current user's `dove` executable is the expected installed artifact;
- **project integration** — whether `.dove/install/manifest.json` and managed project files are valid;
- **research state** — whether ordinary `.dove/research/` Markdown is present, missing, malformed, or legacy;
- **host registration** — whether the manifest-declared host is registered as expected;
- **host readiness** — whether the host can actually use the integration; and
- **legacy copied runtime** — whether obsolete project-local runtime copies are present.

For Claude, readiness depends on the host's actual ability to use the integration. Pending approval, failed connection, unavailable Claude CLI, timeout, or unknown status is not ready and produces a concrete next step.

Legacy runtime copied into project `bin/`, `dist/`, `mcp/`, or `scripts/` locations is not migrated or deleted automatically. Doctor reports it and fails closed so the user can make an explicit cleanup or migration decision.

## Managed versus user-owned files

The ownership boundary is strict:

- `.dove/install/` and declared project host integration files are Dove-managed integration state.
- `.dove/research/` is ordinary researcher-owned Markdown context.
- the project's `README.md`, `docs/*`, unrelated host settings, and unrelated hooks remain user-owned.

Init and update never copy, read, overwrite, or delete the consumer project's public documentation.

## Source-checkout validation

The following commands are maintainer-only and run from a Dove source checkout, not as consumer installation or daily-use paths:

```bash
npm run commands:check
npm run commands:validate
npm run check
npm run release:check
npm run pack:dry-run
```

Do not use `npx dove` or `node ./bin/dove-package.mjs` as a consumer path. Do not regenerate adapters or other generated artifacts during ordinary installation or documentation validation.
