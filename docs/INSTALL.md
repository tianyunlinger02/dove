# Installation

Dove has two installation steps: install an exact trusted npm artifact for the current user, then initialize each target project. Later global upgrades may refresh registered projects; Dove never selects projects by scanning your home directory.

The bare public npm name `dove` belongs to an unrelated package. Do not use bare `npm install -g dove` or `npx dove`. Use a trusted tarball, exact Git revision/tag, or internal-registry specifier tied to the intended source.

## Requirements

- Node.js `>=22` and npm
- Claude Code

Claude Code is the one supported host. Earlier releases also generated DeepSeek Harness (DSH) Skills; that host is no longer maintained, and an adapter can be regenerated from the single source if it is needed again.

## 1. One-time user installation

```bash
npm install --global <exact-dove-package-specifier>
```

The executable uses the current user's npm binary path. Dove does not edit shell startup files, user/global host or MCP configuration, credentials, or research state. If the npm binary directory is not on `PATH`, configure it through normal system administration.

With npm lifecycle scripts enabled, a global install/upgrade runs `postinstall` to refresh package-managed integration in projects already registered by this user. The registry is `$XDG_CONFIG_HOME/dove/projects.json`, or `~/.config/dove/projects.json` when unset; it is installation metadata, not a research record.

## 2. Project initialization

From the target root, run bare `dove` for guided setup, or explicitly:

```bash
dove init --host claude
```

Implicit setup from HOME is refused, including when Git-root discovery would select HOME. Enter the intended project directory; intentionally using HOME requires `dove init --project "$HOME"`.

Claude integration includes:

- `.claude/rules/dove.md` for ordinary main-session collaboration;
- `.claude/agents/dove.md` for the optional author-side entrance, plus native read-only `.claude/agents/dove-mentor.md` and `.claude/agents/dove-review.md`;
- seven optional commands under `.claude/commands/dove/`;
- `SessionStart` and `UserPromptSubmit` context hooks and a `Stop` hook (see below);
- a read-only Dove `statusLine` only if the project has no existing line;
- hidden guidance Skills and project MCP declarations for pinned `dove-paper-search` and hosted Exa.

The installation also owns `.dove/install/manifest.json` and four exact references: the research standard `RESEARCH_QUALITY.md`, the user's most frequent sayings `AUTHOR_PREFERENCES.md`, the full preferences `AUTHOR_PREFERENCES_FULL.md`, and the topic-selection standard `TOPIC_CRITERIA.md`. No folder-wide ownership follows. Upgrades remove the retired `RESEARCH_QUALITY_FULL.md`, `lessons` and `rebuttal` files while they are unchanged.

If no research tree exists, init creates only the minimal researcher-owned `.dove/research/RESEARCH.md` entry. It does not create an identity card, evaluation, or round on the user's behalf. Existing research directories remain untouched even without an overview. Research work maintains `IDENTITY.md`, `EVAL.md`, and `rounds/`; existing `missions/`, `experiments/`, and `claims/` stay in place without migration or deletion. See [Usage](USAGE.md#research-markdown).

Setup preflights the complete managed write set and preserves unrelated configuration. It does not copy runtime bundles into project `bin/`, `dist/`, `mcp/`, or `scripts/`, write an absolute installed-CLI path, approve trust, install dependencies, or repair/migrate unknown legacy material. There is no `dove install` command or `--platform` option.

Bare `dove` classifies integration as `uninitialized`, `current`, `needs-update`, or `blocked` and shows appropriate lifecycle actions. Update/platform changes are explicit; Complete Reinstall and uninstall preview their scope and default to No. Technical Doctor details stay behind View details. Redirected output is plain Chinese without mascot or ANSI; `--json`/`--format json` returns a direct machine-readable result.

## Registered projects and global upgrades

For older initialized projects, register exact roots once and optionally synchronize now:

```bash
dove projects import --project <root>... --sync
```

Use `dove projects sync` to retry and read-only `dove projects status` to inspect the registered set and last report. `dove settings --host-migration on` enables versioned migration notices (default off; also in dashboard settings). Updates register tasks under `.dove/install/`; SessionStart and ordinary UserPromptSubmit deliver them for the host to finish after current work without interrupting jobs or altering conclusions/user originals. Completion removes the pending file; the same version is not registered again. No home scan or CLI research rewrite occurs.

Automatic/bulk sync preserves locally changed or removed manifest-owned files and configuration fragments—including MCP entries—and updates the remaining items. Each project is reported as `updated` or `unchanged`, with any `preservedLocalEdits` listed separately; preserving local edits alone is not a `partial` sync. Preserved items keep their previous ownership record, not a digest of local content. The manifest package version advances, but Doctor and prompt hooks can still report local integration drift; that is not a failed update of the remaining items. Integration that cannot be safely planned still blocks that project, while other registered projects continue. Explicit `dove update` is different: it may replace valid manifest-owned edits and reports them. Neither operation changes `.dove/research/**`, historical `.dove/reviews/**`, `.dove/runs/**`, or ordinary project artifacts.

Dove registers its own Stop hook beside any of the user's. A project without one gets it on the next sync; an identical unowned Dove Stop is adopted rather than duplicated. Automatic sync preserves a locally modified or removed Dove Stop with its previous ownership record and reports it; explicit update restores it. Users' own Stop hooks are never touched.

npm may hide lifecycle output; `npm install --global --foreground-scripts <exact-dove-package-specifier>` shows it. `--ignore-scripts` disables cascading. If one project has already refreshed and another fails, partial success exits zero to avoid npm rolling back a partly applied operation; failures before any project commits may exit nonzero. Read the per-project outcomes and inspect `dove projects status` after upgrades.

Disk refresh is not host reload. An already-open Claude context with a working registered Dove prompt hook resolving the new CLI receives, with its next real message, one notice to re-read the operating manual and the user's sayings. Complete hook, agent, tool, permission, or configuration loading may require a fresh context; `/reload-skills` reloads only optional Skills. Installation, matching versions, and hook output do not prove model adoption.

## Dove agent and ordinary entry

Start ordinary `claude` in the initialized project and describe the task. The rule (the operating manual) is the primary complete entrance, not a prompt router. `claude --agent dove` and the seven flat Skills add no authority or permissions. The main session owns the full user conversation, clarification, execution, and adoption of delegated findings.

`dove-mentor` and `dove-review` share Dove's identity and use fresh read-only native contexts, without execution conversation, resumed history, edits or commands. Generate its call with `dove mentor brief --project <root>`: actual materials and fixed questions, with only a bounded authored opinion and new raw-artifact paths appended; the mentor may retrieve paper/web sources. The reviewer uses only `Read`, `Grep` and `Glob` on the specified current manuscript, cited results and supplied grounding. The main session saves their returns. The old review CLI and frozen-material/model-launch runtime are removed; `/dove:review` remains a Skill.

Every fresh main context personally reads the user's most frequent sayings before substantive work; Claude loads the operating manual itself. The research standard is consulted at the moments the manual names; the full preferences on demand. Claude startup and `/clear` deliver this bootstrap; compact/resume reuses the same context's reading. Installed copies are guidance, not evidence, permissions, or the editable preference source. See [Usage](USAGE.md#what-the-host-reads-and-when).

## Project runtime invocation

Managed project settings invoke the user-installed `dove` by name on `PATH`, not a copied bundle or absolute installation path.

### SessionStart, UserPromptSubmit and Stop

```text
dove hook session-start --project <project-root>
dove hook user-prompt-submit --project <project-root>
dove hook stop --project <project-root>
```

SessionStart inspects integration read-only. Non-current integration may produce a `systemMessage` suggesting explicit `dove update`; unsupported or ambiguous state requires diagnosis. It never synchronizes installation, writes research/configuration, or cleans up files. Startup/clear asks the main context to read the user's sayings and remembers that this session saw the current guidance; compact/resume presents the bounded identity card, this round's situation and the continuity reminder, and best-effort refreshes only the derived `.dove/install/USER_ORIGINALS.md`, `user-originals-index.json` and `activity-index.json`. It does not reconstruct the mainline from old records or transcripts.

UserPromptSubmit presents, on ordinary user messages, the installed guidance version, the identity card, this round's situation computed from the records (aim, how it counts as done, scale, due date, overrun or stall, main metric, latest bottleneck, what waits for the user) and, once per session after an update, a notice to re-read the manual and the sayings. Known host-generated notifications and no-visible-output automatic prompts receive one version line without reading the project. It never writes research, classifies intent, grants permissions or blocks submission.

Stop, when the host ends a turn, asks once per condition on an overrun or a stall by quoting the user's own words (see [Usage](USAGE.md#what-dove-computes)). It stays silent while the host is answering a Stop prompt, when nothing is due, when `dove settings --stop-prompts off` is set, or on any error.

Keep `Current round` and `Round status` at the top of `IDENTITY.md`, within its first 4KB. If the card is longer, presentation retains the first 4KB and notes it; it is not reported missing. The main session—not a hook—maintains the card and reads the linked brief and evaluation. Missing/unreadable identity is not inferred from history.

### Status line

When `.claude/settings.json` has no existing `statusLine`, Dove installs read-only `dove hook statusline --project "$CLAUDE_PROJECT_DIR"`. The first line shows host model/context facts, Git branch, current-session duration, and optional unlabeled cyan Mainline last so a long goal does not displace the preceding facts; the second shows the current round, its aim and due date, overrun or stall, and the main metric in short form (omitted when none of these is recorded); the last contains only the absolute project path. A nonempty `NO_COLOR` disables color. Mainline comes from the bounded card's single Mainline field, read the way the hooks and dashboard read it (`Mainline: <text>`, a list item or a bold annotated field, below any other field), never a branch or latest record. Branch and duration are not research conclusions.

Existing custom status lines remain unowned and unchanged. Explicit update/reinstall may restore a modified Dove-owned line and report it; uninstall removes it only when still owned. Project lifecycle commands do not repair a user-level `~/.claude/settings.json` line; inspect its command and the host's `dove` on `PATH` if it invokes an unsupported command.

### External source tools

`dove-paper-search` launches `paper-search-mcp==0.1.4` through user-provided `uvx` with `mcp<2`. It supports scholarly discovery, DOI lookup, download, and full-text reading. Prefer `get_crossref_paper_by_doi` when DOI identity matters and the tool is exposed/permitted.

Exa uses hosted `https://mcp.exa.ai/mcp` with `{ "url": "https://mcp.exa.ai/mcp", "type": "http" }` for ordinary webpages, documentation, venue pages, and known URLs. `WebSearch` finds pages; when Exa is missing or out of quota, the host reads pages with `WebFetch` or downloads them with `curl`.

## Integration manifest

`.dove/install/manifest.json` records installed hosts and ownership of declared integration resources. It is software metadata, not research evidence. The manifest and four references are canonical integration; optional migration pending/version records, the hook state, the activity index and the cross-project experience file are runtime files Dove derives. Host-maintained `DOCTOR.md` and unknown files are not package-owned.

## Update

```bash
dove update
```

Update refreshes only the recorded hosts (or an explicitly requested supported host change) under valid ownership. It replaces local edits to valid manifest-owned Dove resources and lists them in human output and `replacedLocalEdits` JSON. Keep customizations in user-owned locations. Unowned files and unrelated settings remain protected.

Absent, malformed, unsupported, contradictory, unsafe, or unknown manifest ownership blocks update. There is no adoption or old-manifest migration path. Update does not reconstruct ownership from copied adapters or runtime, create missing summaries, normalize links, or overwrite existing research. Historical `missions/`, `experiments/`, and `claims/` remain in place.

## Uninstall

`dove uninstall` previews exact managed removal and defaults to No. After confirmation it removes still-owned host files/fragments, hooks, permission/MCP entries, manifest, four reference files and Dove's derived install files. It preserves research, historical review exchanges, old run receipts, `DOCTOR.md`, ordinary files, unrelated settings/hooks/MCP servers, pre-existing WebFetch denials, and unknown/legacy material.

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
- **Researcher-owned** — `IDENTITY.md`, `EVAL.md`, rounds, mentor notes, short history index, historical missions/experiments/claims, Sources, Reviews, and ordinary project artifacts.
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
