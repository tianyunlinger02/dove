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
- the project-local Dove shared researcher judgment rule;
- the project-local `SessionStart` hook registration;
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

## Dove agent and ordinary entry

The initialized Claude project provides three complementary entry points:

- `.claude/rules/dove.md` shares research judgment with ordinary Claude conversations; it is not a per-prompt router or a separate agent session.
- `.claude/agents/dove.md` supports `claude --agent dove` for the author-side main research session. Dove can also serve as a subagent for a bounded independent investigation when separate context helps. Work needing the full user conversation, important clarification, or ongoing mainline ownership stays in the main session.
- `.claude/commands/dove/*.md` are nine flat capability shortcuts, not additional researchers.

Dove's flat Skills are `research`, `status`, `source`, `experiment`, `draft`, `figure`, `review`, `rebuttal`, and `lessons`. They are optional specialist shortcuts, not separate personalities, stages, or an autonomy switch. Users can tell Dove the goal directly; default multi-round research progression does not require an Auto command.

Dove no longer installs a `UserPromptSubmit` prompt hook, hidden intake Skill, ambient regex router, or replacement per-prompt hook. The host handles ordinary routing, and the same Dove model chooses whether to answer, clarify, or use optional capabilities. Confirmed goal-shaped requests invoke Dove's default research progression.

## Project runtime invocation

Project configuration invokes the user-installed `dove` command by name. It does not point to a copied bundle or an absolute installation path.

The Claude `SessionStart` hook uses the equivalent of:

```text
dove hook session-start --project <project-root>
```

`SessionStart` uses the user-installed `dove` on `PATH` to synchronize recognized package-managed integration. It does not write `.dove/research/**`, `.dove/reviews/**`, or `.dove/runs/**`, migrate legacy manifests, or perform Complete Reinstall. It skips manifest-owned files or fragments with local edits, continues the remaining safe resources, and reports skipped paths through hook `systemMessage`. Unsafe errors also produce a `systemMessage` where possible and stop synchronization writes. Successful sync updates non-skipped disk resources; it does not reload already-active Claude context.

Only `compact` and `resume` receive a read-only facts card: `RESEARCH.md` existence and absolute mtime; latest Review id, round, absolute `updatedAt`, and material currentness; latest Run id, absolute `startedAt`, status, and exit code. Latest means by Review update time or Run start time, not research importance. The card does not read research Markdown bodies, review reports, or stdout/stderr logs, and does not infer the current mainline or next action. It reads review metadata and run journals; currentness checks the latest round's listed project files against its snapshot receipt. Missing or unreadable facts remain `unavailable`. `startup` and `clear` receive no research card.

Current Dove resources install no `UserPromptSubmit` hook. During update, reinstall, SessionStart sync, or uninstall, a manifest-owned exact old Dove `UserPromptSubmit` hook is removed while unrelated user or Trellis prompt hooks are preserved.

Dove does not install or expose a Claude `Stop` hook and no longer owns Claude `statusLine`. During update or uninstall, a manifest-owned old Dove `statusLine` entry is released; the exact old Dove status line is removed, while user-modified status lines are preserved as user-owned. Retired Dove-owned Stop hook fragments are removed only when they exactly match the old managed entry; user-owned or non-array Stop settings are preserved.

The `dove-paper-search` MCP declaration launches pinned `paper-search-mcp==0.1.4` through user-provided `uvx` for scholarly paper discovery, DOI metadata lookup, download, and full-text reading. When a DOI affects identity, its `get_crossref_paper_by_doi` tool is preferred over fuzzy title search if exposed and permitted; MCP or network failure leaves identity unknown rather than triggering CLI, `curl`, or custom-fetch substitution. The Exa declaration uses the hosted remote MCP server at `https://mcp.exa.ai/mcp` with `.mcp.json` server shape `{ "url": "https://mcp.exa.ai/mcp", "type": "http" }` for ordinary webpage bodies, documentation pages, venue pages, and known URLs. Built-in `WebSearch` remains available for search discovery; built-in `WebFetch` is denied in project-scoped Claude permissions. If scholarly material is relevant but `dove-paper-search` is not exposed or not permitted by current user/project approvals, or ordinary webpage bodies are relevant but Exa is not exposed or not permitted by current user/project approvals, Dove names the missing material and continues with the specific current materials or actions that can still inform the question, such as WebSearch discovery, Exa where ordinary webpage body is relevant, `dove-paper-search` where scholarly material is relevant, local project material, user-provided material, theory, experiment, or analysis. Dove does not install packages, approve project trust, write credentials, or provide CLI, shell, `curl`, or ad hoc fetch-script substitutions for web retrieval.

## Integration manifest

`.dove/install/` is Dove-managed project-integration state. Its manifest records the hosts initialized for that project and the integration contract needed by `update` and `doctor`.

The manifest is not research evidence and must not contain substantive research artifacts. Users should not hand-edit managed integration files.

## Update

Run from an already initialized project:

```bash
dove update
```

`dove update` reads `.dove/install/manifest.json` and refreshes only the hosts already recorded there. For valid manifest-owned Dove integration resources, explicit update replaces local edits, names them in the human output, and reports them as `replacedLocalEdits` in JSON. This does not authorize replacing unowned files or unrelated configuration; use user-owned locations for customizations you need to keep. The one absent-manifest adoption path is explicit `dove update` on a project that already has a readable current `.dove/research/` Markdown tree plus the old `.dove/manifest.json` workspace marker; it creates the revision-2.0 installation manifest, safely claims only current package-managed Claude integration, and leaves research bytes, DOCTOR notes, archives, old markers, private state, unrelated hooks, unrelated MCP servers, and any pre-existing user-owned `permissions.deny` entries unchanged.

If the manifest is absent without that adoption state, malformed, contradictory, unsafe, or contains unknown ownership state, `dove update` fails closed. It must not reconstruct a manifest from generated adapters, hooks, MCP declarations, status-line settings, or copied runtime.

For an already initialized project, update refreshes only package-managed integration. It does not create missing summaries, complete navigation, replace Lessons materials, or rewrite `.dove/research/**`; existing research documents remain researcher-owned.

## Uninstall

Run `dove uninstall` from an initialized project. Dove first shows the exact removal scope and defaults to No. After confirmation it removes manifest-owned host files, the Dove SessionStart hook, retired exact Dove prompt hook entries when recorded by the manifest, permission and MCP fragments, `.dove/install/manifest.json`, and a recognized retired `.dove/manifest.json` adoption marker when present. It preserves `.dove/research/**`, `.dove/reviews/**`, `.dove/runs/**`, `.dove/install/DOCTOR.md`, unrecognized files at the legacy marker path, unrelated host settings, unrelated hooks, unrelated MCP servers, any pre-existing user-owned `permissions.deny` entry for `WebFetch`, and ordinary project files. A project retaining current research Markdown is then classified as unconfigured rather than offered an update. Drift, symlinks, or changed transaction preconditions stop the uninstall and roll back staged changes.

## Doctor

Run from the project root:

```bash
dove doctor
```

Doctor is read-only and reports separate static dimensions rather than collapsing them into one package check:

- **user CLI** — the current program's package version and whether its runtime files are present;
- **project integration** — the project integration package version recorded in `.dove/install/manifest.json`, separately from the validity and currentness of managed resources, paths needing sync, and local edits SessionStart would skip; a missing recorded version stays unknown, not filled from the program version; and
- **research state** — whether ordinary `.dove/research/` Markdown is present, missing, malformed, or legacy.

Matching program and manifest package versions do not establish matching resource bytes. Resource inspection still uses the managed inventory and comparisons among recorded, current project, and packaged digests; these are internal software facts, not research evidence.

Doctor reports only retired Dove `Stop` / `UserPromptSubmit` remnants actually identified by the existing exact-match ownership rules, with a traceable location and reason. This is not a comprehensive scan of custom hooks: user-rewritten or unattributable entries are not certified clean. Inspection does not remove entries, expand lifecycle deletion authority, or scan user/global settings; the ownership and local-edit protections above still apply.

The current session's actual loaded resources remain unknown to the CLI, even after a successful disk sync. Doctor does not probe live Claude readiness, MCP approval or connectivity, hosted Exa availability, runtime reviewer behavior, or scientific correctness; healthy disk integration does not show that scientific judgment occurred. Legacy runtime copied into project `bin/`, `dist/`, `mcp/`, or `scripts/` locations is preserved in place; Dove no longer exposes an automatic export, migration, deletion, or runtime fallback path for that data.

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
