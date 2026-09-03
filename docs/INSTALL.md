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

Dove supports only these two hosts. Claude Code receives the complete project integration. DSH receives nine project-local filesystem Skills under `.dsh/skills/dove-*/SKILL.md`; Dove does not claim DSH slash commands, hooks, MCP, or a static agent surface without a future Cordis plugin.

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

From the target project root, run bare `dove` for guided setup. After choosing Install, select one or more supported platforms from the checkbox menu; Claude Code is selected initially, and DeepSeek Harness may be selected alone or together with Claude.

For explicit non-interactive initialization:

```bash
dove init --host claude
dove init --host dsh
dove init --host claude --host dsh
```

Claude Code receives the complete integration described below. DSH receives the nine Dove filesystem Skills and no Claude permissions or MCP projection. `dove init` installs project integration and the minimal researcher-owned research entry. It may write:

- `.dove/install/manifest.json`;
- project-local Claude commands under `.claude/commands/dove/`;
- the project-local Dove agent at `.claude/agents/dove.md`;
- the project-local ambient rule and hidden intake skill;
- the project-local `SessionStart` and `UserPromptSubmit` hook registrations;
- the hidden Claude guidance Skill for pinned `dove-paper-search` plus its MCP declaration for scholarly paper discovery, download, and full-text reading;
- the hidden Claude guidance Skill for hosted Exa plus its MCP declaration for ordinary webpage bodies, documentation pages, venue pages, and known URLs;
- the project-scoped `permissions.deny` entry for built-in `WebFetch`, while leaving `WebSearch` available; and
- the minimal `.dove/research/RESEARCH.md` Markdown entry when no research tree exists.

It must preserve unrelated project configuration and preflight the complete managed write set before changing files.

Bare `dove` is the project lifecycle menu. In an unconfigured interactive project it offers Install and then a Claude Code / DeepSeek Harness checkbox menu, with Claude selected initially and at least one platform required. Adoptable research trees offer adoption plus platform selection; initialized projects expose safe update or platform changes when applicable, Complete Reinstall, uninstall, details, and exit. If Dove-managed integration was modified, the first screen gives a concise explanation and offers details or a separately previewed Complete Reinstall; it does not dump the full Doctor panel or silently overwrite files. Complete Reinstall and uninstall show their real scope and require an explicit default-No confirmation, while `.dove/research/**`, `.dove/reviews/**`, `.dove/runs/**`, and `DOCTOR.md` remain preserved. `NO_COLOR=1` disables ANSI styling, redirected or piped output is clean text without the mascot, and `--json` or `--format json` emits only the direct machine-readable integration result.

`dove init` must not:

- copy the Dove runtime into project `bin/`, `dist/`, `mcp/`, or `scripts/` directories;
- write an absolute path to the installed CLI;
- write user/global host configuration or shell files;
- approve MCP trust or write credentials;
- use or install a fallback runtime; or
- silently import, migrate, repair, or delete legacy state.

There is no `dove install` command and no `--platform` option.

## Dove agent and ambient entry

The initialized Claude project contains one directly usable Dove agent plus nine optional specialist Skill shortcuts:

- `.claude/agents/dove.md` is the complete Dove research-agent behavior;
- `.claude/commands/dove/*.md` are the nine optional specialist Skill shortcuts;
- `.claude/rules/dove.md` and `.claude/skills/dove-intake/SKILL.md` provide conservative ambient routing.

Dove's flat Skills are `research`, `status`, `source`, `experiment`, `draft`, `figure`, `review`, `rebuttal`, and `lessons`. They are optional specialist shortcuts, not separate personalities, stages, or an autonomy switch. Users can tell Dove the goal directly; default multi-round research progression does not require an Auto command.

The prompt hook adds hidden intake only when the original non-slash prompt is clearly research-related. The gate is only a research-context wake-up; intake is zero-write and does not select a Skill, authorize execution or writes, or decide continuation or completion. The hook itself performs no synchronization or adoption. The host and the same Dove model choose whether to answer, clarify, or use optional capabilities. Confirmed goal-shaped requests invoke Dove's default research progression.

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

`SessionStart` uses the current user-installed `dove` command on `PATH` to synchronize recognized package-managed integration. It never reads, creates, replaces, or deletes `.dove/research/**`, `.dove/reviews/**`, or `.dove/runs/**`; it does not migrate legacy manifests or perform Complete Reinstall. It guarantees current managed files on disk, not same-session Claude reload.

`UserPromptSubmit` is zero-write. It validates the hook event and, for clearly research-related non-slash prompts, emits hidden intake context only; it does not synchronize, adopt, repair, or modify project files.

Dove does not install or expose a Claude `Stop` hook. Retired Dove-owned Stop hook fragments are removed only when they exactly match the old managed entry; user-owned or non-array Stop settings are preserved.

The `dove-paper-search` MCP declaration launches pinned `paper-search-mcp==0.1.4` through user-provided `uvx` for scholarly paper discovery, download, and full-text reading. The Exa declaration uses the hosted remote MCP server at `https://mcp.exa.ai/mcp` with `.mcp.json` server shape `{ "url": "https://mcp.exa.ai/mcp", "type": "http" }` for ordinary webpage bodies, documentation pages, venue pages, and known URLs. Built-in `WebSearch` remains available for search discovery; built-in `WebFetch` is denied in project-scoped Claude permissions. If scholarly material is relevant but `dove-paper-search` is not exposed or not permitted by current user/project approvals, or ordinary webpage bodies are relevant but Exa is not exposed or not permitted by current user/project approvals, Dove names the missing material and continues with the specific current materials or actions that can still inform the question, such as WebSearch discovery, Exa where ordinary webpage body is relevant, `dove-paper-search` where scholarly material is relevant, local project material, user-provided material, theory, experiment, or analysis. Dove does not install packages, approve project trust, write credentials, or provide CLI, shell, `curl`, or ad hoc fetch-script substitutions for web retrieval.

## Integration manifest

`.dove/install/` is Dove-managed project-integration state. Its manifest records the hosts initialized for that project and the integration contract needed by `update` and `doctor`.

The manifest is not research evidence and must not contain substantive research artifacts. Users should not hand-edit managed integration files.

## Update

Run from an already initialized project:

```bash
dove update
```

`dove update` reads `.dove/install/manifest.json` and refreshes only the hosts already recorded there. The one absent-manifest adoption path is explicit `dove update` on a project that already has a readable current `.dove/research/` Markdown tree plus the old `.dove/manifest.json` workspace marker; it creates the revision-2.0 installation manifest, safely claims only current package-managed Claude integration, and leaves research bytes, DOCTOR notes, archives, old markers, private state, unrelated hooks, unrelated MCP servers, and any pre-existing user-owned `permissions.deny` entries unchanged.

If the manifest is absent without that adoption state, malformed, contradictory, unsafe, or contains unknown managed-file or fragment drift, `dove update` fails closed. It must not reconstruct a manifest from generated adapters, hooks, MCP declarations, or copied runtime.

For an already initialized project, update refreshes only package-managed integration. It does not create missing summaries, complete navigation, replace Lessons materials, or rewrite `.dove/research/**`; existing research documents remain researcher-owned.

## Uninstall

Run `dove uninstall` from an initialized project. Dove first shows the exact removal scope and defaults to No. After confirmation it removes manifest-owned host files, Dove hook, permission, and MCP fragments, `.dove/install/manifest.json`, and a recognized retired `.dove/manifest.json` adoption marker when present. It preserves `.dove/research/**`, `.dove/reviews/**`, `.dove/runs/**`, `.dove/install/DOCTOR.md`, unrecognized files at the legacy marker path, unrelated host settings, unrelated hooks, unrelated MCP servers, any pre-existing user-owned `permissions.deny` entry for `WebFetch`, and ordinary project files. A project retaining current research Markdown is then classified as unconfigured rather than offered an update. Drift, symlinks, or changed transaction preconditions stop the uninstall and roll back staged changes.

## Doctor

Run from the project root:

```bash
dove doctor
```

Doctor is read-only and reports separate static dimensions rather than collapsing them into one package check:

- **user CLI** — whether the source or installed Dove runtime files are present;
- **project integration** — whether `.dove/install/manifest.json` and package-managed project files are valid and current; and
- **research state** — whether ordinary `.dove/research/` Markdown is present, missing, malformed, or legacy.

Doctor does not probe live Claude readiness, MCP approval or connectivity, hosted Exa availability, runtime reviewer behavior, or scientific correctness. Legacy runtime copied into project `bin/`, `dist/`, `mcp/`, or `scripts/` locations is preserved in place; Dove no longer exposes an automatic export, migration, deletion, or runtime fallback path for that data.

## Managed versus user-owned files

The ownership boundary is strict:

- `.dove/install/` and declared project host integration files are Dove-managed integration state.
- `.dove/research/` is ordinary researcher-owned Markdown context.
- `.dove/reviews/` holds explicit isolated review exchange records and is preserved across reinstall and uninstall.
- `.dove/runs/` holds local execution receipts for Dove run supervisors and is preserved across update, SessionStart sync, reinstall, and uninstall.
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
