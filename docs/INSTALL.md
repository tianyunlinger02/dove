# Installation

Dove has two installation steps: install an exact trusted npm artifact for the current user, then initialize each target project. Later global upgrades may refresh registered projects; Dove never selects projects by scanning your home directory.

The bare public npm name `dove` belongs to an unrelated package. Do not use bare `npm install -g dove` or `npx dove`. Use a trusted tarball, exact Git revision/tag, or internal-registry specifier tied to the intended source.

## Requirements

- Node.js `>=22` and npm
- Claude Code or DeepSeek Harness (`dsh`)

Claude receives complete project integration. DSH receives nine project-local filesystem Skills under `.dsh/skills/dove-*/SKILL.md`, not Claude agents, hooks, permissions, or MCP declarations.

## 1. One-time user installation

```bash
npm install --global <exact-dove-package-specifier>
```

The executable uses the current user's npm binary path. Dove does not edit shell startup files, user/global host or MCP configuration, credentials, or research state. If the npm binary directory is not on `PATH`, configure it through normal system administration.

With npm lifecycle scripts enabled, a global install/upgrade runs `postinstall` to refresh package-managed integration in projects already registered by this user. The registry is `$XDG_CONFIG_HOME/dove/projects.json`, or `~/.config/dove/projects.json` when unset; it is installation metadata, not a research record.

## 2. Project initialization

From the target root, run bare `dove` for guided setup. Install offers a host checkbox menu, initially selecting Claude Code; choose Claude, DSH, or both. Explicit setup is also available:

```bash
dove init --host claude
dove init --host dsh
dove init --host claude --host dsh
```

Claude integration includes:

- `.claude/rules/dove.md` for ordinary main-session collaboration;
- `.claude/agents/dove.md` for the optional author-side entrance, plus native read-only `.claude/agents/dove-mentor.md` and `.claude/agents/dove-review.md`;
- nine optional commands under `.claude/commands/dove/`;
- managed `SessionStart`, `UserPromptSubmit`, and the narrow round-completion `Stop` hook;
- a read-only Dove `statusLine` only if the project has no existing line;
- hidden guidance Skills and project MCP declarations for pinned `dove-paper-search` and hosted Exa; and
- a project `permissions.deny` entry for built-in `WebFetch`, leaving `WebSearch` available.

Both hosts share `.dove/install/manifest.json` and four exact references: short `RESEARCH_QUALITY.md` and `AUTHOR_PREFERENCES.md`, with preserved `RESEARCH_QUALITY_FULL.md` and `AUTHOR_PREFERENCES_FULL.md` companions. No folder-wide ownership follows.

If no research tree exists, init creates only the minimal researcher-owned `.dove/research/RESEARCH.md` entry. It does not create an identity card, evaluation, or round on the user's behalf. Existing research directories remain untouched even without an overview. Research work maintains `IDENTITY.md`, `EVAL.md`, and `rounds/`; existing `missions/`, `experiments/`, and `claims/` stay in place without migration or deletion. See [Usage](USAGE.md#research-markdown).

Setup preflights the complete managed write set and preserves unrelated configuration. It does not copy runtime bundles into project `bin/`, `dist/`, `mcp/`, or `scripts/`, write an absolute installed-CLI path, approve trust, install dependencies, or repair/migrate unknown legacy material. There is no `dove install` command or `--platform` option.

Bare `dove` classifies integration as `uninitialized`, `current`, `needs-update`, or `blocked` and shows appropriate lifecycle actions. Update/platform changes are explicit; Complete Reinstall and uninstall preview their scope and default to No. Technical Doctor details stay behind View details. Redirected output is plain Chinese without mascot or ANSI; `--json`/`--format json` returns a direct machine-readable result.

## Registered projects and global upgrades

For older initialized projects, register exact roots once and optionally synchronize now:

```bash
dove projects import --project <root>... --sync
```

Use `dove projects sync` to retry the registered set and read-only `dove projects status` to inspect registration and the last report. Neither discovers arbitrary projects. If a stale registration lock is reported, inspect the exact path and confirm no registration is active before manually removing it; Dove does not steal an occupied lock.

Automatic/bulk sync preserves locally changed or removed manifest-owned files and configuration fragments—including MCP entries—and updates the remaining items. Each project is reported as `updated` or `unchanged`, with any `preservedLocalEdits` listed separately; preserving local edits alone is not a `partial` sync. Preserved items keep their previous ownership record, not a digest of local content. The manifest package version advances, but Doctor and prompt hooks can still report local integration drift; that is not a failed update of the remaining items. Integration that cannot be safely planned still blocks that project, while other registered projects continue. Explicit `dove update` is different: it may replace valid manifest-owned edits and reports them. Neither operation changes `.dove/research/**`, historical `.dove/reviews/**`, `.dove/runs/**`, or ordinary project artifacts.

npm may hide lifecycle output; `npm install --global --foreground-scripts <exact-dove-package-specifier>` shows it. `--ignore-scripts` disables cascading. If one project has already refreshed and another fails, partial success exits zero to avoid npm rolling back a partly applied operation; failures before any project commits may exit nonzero. Read the per-project outcomes and inspect `dove projects status` after upgrades.

Disk refresh is not host reload. An already-open Claude context with a working registered Dove prompt hook resolving the new CLI can receive verified current guidance on its next real prompt, then personally read changed rule/essentials as needed. Complete hook, agent, tool, permission, or configuration loading may require a fresh context; `/reload-skills` reloads only optional Skills. Installation, matching versions, and hook output do not prove model adoption.

## Dove agent and ordinary entry

Start ordinary `claude` in the initialized project and describe the task. The rule is the primary complete entrance, not a prompt router. `claude --agent dove` and the nine flat Skills add no authority or permissions. The main session owns the full user conversation, clarification, execution, and adoption of delegated findings.

`dove-mentor` and `dove-review` share Dove's identity but use fresh native Claude contexts with only `Read`, `Grep`, and `Glob`. They read explicitly supplied materials and return findings; they do not receive the execution conversation, resume history, edit files, or launch commands. The mentor reads the identity/evaluation/recent rounds and actual changes; paper review reads the specified current manuscript and cited results. The old `dove review` CLI and frozen-material/model-launch runtime are removed; `/dove:review` remains a Skill.

Every fresh main context personally reads both short Chinese quality/preference essentials before substantive work. Full companions are consulted for relevant detail, not read through EOF by default. Claude startup and `/clear` deliver this bootstrap; DSH applies it on first author-side Skill use if needed. Compact/resume reuses the same context's reading. Installed copies are guidance, not evidence, Lessons, permissions, or the editable preference source. See [Usage](USAGE.md#short-core-and-two-reference-read-contracts).

## Project runtime invocation

Managed project settings invoke the user-installed `dove` by name on `PATH`, not a copied bundle or absolute installation path.

### SessionStart and UserPromptSubmit

```text
dove hook session-start --project <project-root>
dove hook user-prompt-submit --project <project-root>
```

SessionStart inspects integration read-only. Non-current integration may produce a `systemMessage` suggesting explicit `dove update`; unsupported or ambiguous state requires diagnosis. It never synchronizes, writes research/configuration, or cleans up files. Startup/clear adds the two-essentials bootstrap; compact/resume presents the bounded identity card and round-continuity reminder. It does not reconstruct the mainline from old overview/review/run timestamps or transcripts.

UserPromptSubmit verifies current managed integration and presents the project-owned identity card and bounded current guidance on each prompt. Stale/unsafe integration receives a nonblocking diagnostic. It does not classify prompts, write research, decide permissions, or block submission.

Keep `Current round` and `Round status` at the top of `IDENTITY.md`, within its first 4KB. If the card is longer, presentation retains the first 4KB and asks for shortening; it is not reported missing. The main session—not a hook—maintains the card and reads the linked brief and evaluation. Missing/unreadable identity is not inferred from history.

### Narrow Stop reminder

```text
dove hook stop --project <project-root>
```

The read-only managed Stop hook blocks once only when the card identifies an ongoing round and the current turn has no `dove-mentor` call. It asks the main session to save the round result and call the mentor. `stop_hook_active: true` immediately allows stopping; missing/unreadable transcript evidence also allows it. The hook checks host tool-call events without analyzing or sending conversation content to a model. It creates no tracking file or extra tool hook and writes no research state.

If the user explicitly asks to discuss only or stop, the main session sets `Round status: paused` before ending. This reminder replaces the old scheduling/continuation mechanism; it is not a background scheduler, new permission, or scientific completion gate.

### Status line

When `.claude/settings.json` has no existing `statusLine`, Dove installs read-only `dove hook statusline --project "$CLAUDE_PROJECT_DIR"`. The first line shows host model/context facts, optional unlabeled cyan Mainline and current round number, Git branch, and current-session duration; the second contains only the absolute project path. A nonempty `NO_COLOR` disables color. Mainline comes from one unambiguous ordinary `Mainline: <text>` line in the bounded card, never a branch or latest record. Branch and duration are not research conclusions.

Existing user/Trellis status lines remain unowned and unchanged. Explicit update/reinstall may restore a modified Dove-owned line and report it; uninstall removes it only when still owned. Project lifecycle commands do not repair a user-level `~/.claude/settings.json` line; inspect its command and the host's `dove` on `PATH` if it invokes an unsupported command.

### External source tools

`dove-paper-search` launches `paper-search-mcp==0.1.4` through user-provided `uvx` with `mcp<2`. It supports scholarly discovery, DOI lookup, download, and full-text reading. Prefer `get_crossref_paper_by_doi` when DOI identity matters and the tool is exposed/permitted.

Exa uses hosted `https://mcp.exa.ai/mcp` with `{ "url": "https://mcp.exa.ai/mcp", "type": "http" }` for ordinary webpages, documentation, venue pages, and known URLs. `WebSearch` remains discovery-only; project permissions deny built-in `WebFetch`. Declaration does not approve trust or prove connectivity. When access is unavailable, name the gap and use relevant permitted local/user materials or other available tools. Do not substitute shell, `curl`, or custom-fetch scripts, install dependencies, or approve access on the user's behalf.

## Integration manifest

`.dove/install/manifest.json` records installed hosts and ownership of declared integration resources. It is software metadata, not research evidence. Within that directory only the manifest and four exact reference files are managed; optional host-maintained `DOCTOR.md` feedback and unknown files are not package-owned.

## Update

```bash
dove update
```

Update refreshes only the recorded hosts (or an explicitly requested supported host change) under valid ownership. It replaces local edits to valid manifest-owned Dove resources and lists them in human output and `replacedLocalEdits` JSON. Keep customizations in user-owned locations. Unowned files and unrelated settings remain protected.

Absent, malformed, unsupported, contradictory, unsafe, or unknown manifest ownership blocks update. There is no adoption or old-manifest migration path. Update does not reconstruct ownership from copied adapters or runtime, create missing summaries, normalize links, or overwrite existing research. Historical `missions/`, `experiments/`, and `claims/` remain in place.

## Uninstall

`dove uninstall` previews exact managed removal and defaults to No. After confirmation it removes still-owned host files/fragments, hooks, permission/MCP entries, manifest, and four reference files. It preserves research, historical review exchanges, run receipts, `DOCTOR.md`, ordinary files, unrelated settings/hooks/MCP servers, pre-existing WebFetch denials, and unknown/legacy material.

A project retaining only researcher-owned context can become uninitialized; unknown installation residue may still leave setup blocked. Drift, symlinks, or changed transaction preconditions block replacement. Caught promotion failures roll back; if restoration fails, Dove retains backups/transaction roots and reports their absolute paths. This does not promise crash recovery or filesystem-wide atomicity. Reinstall uses the same ownership protections to rebuild integration, never research.

## Doctor

```bash
dove doctor
```

Doctor is read-only and reports separate facts:

- **user CLI** — the running package version and runtime-file presence;
- **project integration** — recorded package version, resource currentness, paths needing update, and owned edits update would replace; and
- **research state** — ordinary Markdown presence/readability or legacy markers.

Its states are `uninitialized`, `current`, `needs-update`, and `blocked`, not research grades. Equal package versions do not establish equal resource bytes. Ownership digests are internal software facts, not scientific evidence. Doctor reports only attributable retired hook fragments under exact ownership rules, not a comprehensive scan of custom/global hooks.

Loaded session state remains unknown to the CLI. Doctor does not certify native mentor/reviewer behavior, MCP approval/connectivity, scientific correctness, or research completion. Copied legacy runtime remains in place; no automatic export, migration, deletion, or fallback is provided.

## Managed versus user-owned files

- **Managed** — manifest, four exact references, and declared host resources/fragments.
- **Researcher-owned** — `IDENTITY.md`, `EVAL.md`, rounds, short history index, historical missions/experiments/claims, Sources, Reviews, Lessons, and ordinary project artifacts.
- **Preserved runtime history** — `.dove/reviews/**` and `.dove/runs/**`; preservation does not reactivate the old review runtime.
- **Unowned** — `DOCTOR.md`, consumer `README.md`/`docs/*`, unrelated host settings/hooks, and unknown files.

Init/update never copy, read, overwrite, or delete a consumer project's public docs. All lifecycle operations preserve existing research history without moving it.

## Source-checkout validation

Maintainer-only commands, not consumer entry paths:

```bash
npm run commands:check
npm run commands:validate
npm run check
npm run release:check
npm run pack:dry-run
```

Documentation validation does not regenerate artifacts, initialize test projects, or write tests into real research. Do not use `npx dove` or `node ./bin/dove-package.mjs` as a consumer path. See [Packaging](PACKAGING.md#verification-evidence) for evidence boundaries.
