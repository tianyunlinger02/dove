# Installation

Dove uses a two-stage installation model:

1. install the Dove npm artifact once for the current user so `dove` is available on that user's `PATH`; and
2. initialize each project explicitly with the host integration Dove should manage.

The matching Dove release is not currently available under the bare public npm name `dove`, which is occupied by an unrelated package. Use only an exact package specifier supplied by a trusted Dove release channel, such as a packed tarball, Git commit/tag specifier, or internal-registry specifier tied to the exact source revision.

Do not use bare `npm install -g dove` or bare `npx dove` as a trusted Dove entry point.

## Requirements

- Node.js `>=22`
- npm
- Claude Code for the currently supported and accepted project initialization path

Generated adapters may exist for other hosts, but their presence in the package or repository does not mean that project initialization, registration, connection, or readiness for those hosts has been completed or accepted.

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

## 2. Claude project initialization

From the target project root, run:

```bash
dove init --host claude
```

This is the currently supported and accepted project-initialization path. `dove init` installs project integration and the default ordinary Markdown research tree. It may write:

- `.dove/install/manifest.json`;
- project-local Claude commands under `.claude/commands/dove/`;
- the project-local Dove agent at `.claude/agents/dove.md`;
- the project-local ambient rule and hidden intake skill;
- the project-local `UserPromptSubmit` and `Stop` hook registrations;
- the hidden `dove-paper-search` support skill and its pinned external MCP declaration in `.mcp.json`; and
- default Markdown research files under `.dove/research/`.

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

The prompt hook selects hidden intake only when the original prompt is a clear Dove research work request. Intake routing is zero-write, may choose no Skill for contextual or judgment-only prompts, and never selects Auto. Judgment-only prompts should receive a direct Dove-style judgment and stop unless the user explicitly asks to execute or record.

## Project runtime invocation

Project configuration invokes the user-installed `dove` command by name. It does not point to a copied bundle or an absolute installation path.

The Claude `UserPromptSubmit` hook uses the equivalent of:

```text
dove hook user-prompt-submit --project <project-root>
```

The Claude `Stop` hook uses the equivalent of:

```text
dove hook stop --project <project-root>
```

The optional paper-acquisition MCP declaration launches pinned `paper-search-mcp==0.1.4` through user-provided `uvx`. Dove does not install that package, approve project trust, write credentials, or provide a CLI/shell fallback if it is unavailable.

## Integration manifest

`.dove/install/` is Dove-managed project-integration state. Its manifest records the hosts initialized for that project and the integration contract needed by `update` and `doctor`.

The manifest is not research evidence and must not contain substantive research artifacts. Users should not hand-edit managed integration files.

## Update

Run from an already initialized project:

```bash
dove update
```

`dove update` reads `.dove/install/manifest.json` and refreshes only the hosts already recorded there. It does not select new hosts, bootstrap a project, or infer configuration from generated adapters.

If the manifest is absent, malformed, contradictory, or unsafe, `dove update` fails closed and instructs the user to run an explicit project initialization. It must not reconstruct a manifest from surrounding files.

Update creates missing summaries, completes current standard navigation only in `RESEARCH.md` and `lessons/LESSONS.md`, and replaces the six package-managed built-in Lessons themes with current package content. Other research documents remain researcher-owned.

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
