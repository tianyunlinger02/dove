# Packaging

## Delivery model

Dove 3.0.0 is one host-neutral Node.js 22 npm artifact. It installs the `dove` executable for the current user. Consumer projects invoke `dove` from `PATH`; project initialization installs host-facing Markdown resources and software metadata, not copied runtime bundles.

The bare public npm package named `dove` is unrelated. Release instructions must use an exact trusted tarball, Git revision, or internal-registry package version.

## Release inventory

Every Dove 3.0.0 release contains:

- **10 flat Skills**: `research`, `status`, `source`, `experiment`, `draft`, `figure`, `review`, `rebuttal`, `lessons`, and explicit-only `auto`;
- **3 roles**: Planner, Builder/Author, and Reviewer;
- generated adapters for the declared host formats;
- the project lifecycle CLI plus Claude prompt and stop hooks;
- public documentation; and
- **3 standalone Node.js bundles**.

There is no Dove research MCP server bundle, research tool registry, MCP CLI command, or Research Format runtime. The artifact does contain one hidden Claude support Skill and a fixed project fragment for the external `paper-search-mcp==0.1.4`; it does not contain that Python package.

A Skill is a host workflow. A role defines responsibility. An adapter is a generated projection for a host format. A research document is ordinary researcher-owned Markdown. These concepts intentionally do not map one-to-one.

## Generated host surfaces

Canonical adapter outputs include:

- `.opencode/commands/dove.*.md`;
- `.codex/skills/dove-*/SKILL.md`;
- `.cursor/commands/dove-*.md`;
- `.agents/skills/dove-*/SKILL.md`; and
- `.claude/commands/dove/*.md`.

Role and ambient resources include the Planner, Builder/Author, and Reviewer projections where supported, the Claude Reviewer definition, the Claude ambient rule and hidden intake resources, the hidden `dove-paper-search` support Skill, and the managed prompt and stop hooks.

Adapters are generated from canonical Dove workflow sources. Do not edit generated projections independently. Adapter presence does not establish installation, registration, tool availability, project readiness, reviewer identity, or reviewer independence.

Claude Code remains the supported project initialization path. Other host projections may be packaged without a complete initialization path in this release.

## Three runtime bundles

The package contains three standalone Node.js 22 ESM bundles:

| Bundle | Purpose |
|---|---|
| `dist/index.mjs` | Public library bundle. |
| `bin/dove-package.mjs` | Packaged `dove` CLI. |
| `scripts/dove-user-prompt-submit-package.mjs` | Prompt-hook bundle. |

The package contains no MCP server bundle or third-party Python source. The canonical build checks generated adapters, the hidden paper support Skill, and these three bundles for drift. Consumer installation does not regenerate them.

## Project integration

For the supported path, `dove init --host claude` installs the Claude command adapters, role and ambient resources, prompt and stop hooks, `.dove/install/manifest.json`, and one owned fragment at `.mcp.json#/mcpServers/dove-paper-search`.

The fragment launches the pinned external package through user-provided `uvx`. Dove does not install or bundle Python/OpenAGS code, write credentials, register a user-level server, or approve project trust. It also bootstraps the package-owned default research Markdown tree, which remains outside the installation manifest and researcher-maintained after creation.

The project installation manifest uses revision `2.0`. Optional ordinary `DOCTOR.md` feedback about Dove itself also lives under `.dove/install/`; there is no Doctor JSON state or issue lifecycle. Managed-file hashes are internal software safety data and are not exposed as research evidence.

Project paths and managed-resource parents must remain contained and unambiguous. Existing matching resources may be recognized without rewriting them. Conflicting or user-modified managed content blocks automatic replacement. Shared configuration keeps unrelated fields and entries.

## Research documents are not package state

Research context is ordinary Markdown under `.dove/research/`. The default tree contains:

- root `RESEARCH.md`;
- `missions/MISSIONS.md`, `experiments/EXPERIMENTS.md`, `sources/SOURCES.md`, `reviews/REVIEWS.md`, and `claims/CLAIMS.md`;
- `lessons/LESSONS.md`; and
- six general Lessons themes under `lessons/`.

Each summary is a human-maintained entrance and synthesis, not a generated index. Other documents remain naturally named and linked. Source explanations are useful when available but not mandatory.

The package does not define fixed headings, frontmatter, IDs, enums, machine indexes, stored counts, research hashes, or a mandatory Markdown template. Mission, Source, Experiment, Review, and occasional Claim documents are conventions chosen for readability, not entity stores.

The same Experiment document holds the prospective plan and later actual results. The corresponding Review document preserves preparation and the actual user-obtained Markdown return; author handling is added only when requested, and substantive response and revision remain Rebuttal work.

## CLI inventory and lifecycle

The packaged CLI exposes:

```text
init, update, reinstall, doctor, export-research, hook
```

- `init` creates supported project integration and the complete default research Markdown tree in one transaction.
- `update` refreshes recognized integration and synchronizes research defaults additively. A missing default file is created from its complete package content. An existing file is preserved byte-for-byte as a prefix and receives only missing canonical paragraphs or exact navigation lines. Cross-file exact deduplication applies when appending preference paragraphs to an existing default Lessons theme, not when creating that theme; theme introductions are not forced back into naturally edited existing files. A rewritten canonical paragraph is not semantically deduplicated and may be appended again.
- `export-research` performs an explicit one-time conversion from supported legacy Dove JSON research records state to the new Markdown directories and archives the original bytes under `.dove/archive/...`. It keeps legacy `.dove/LESSONS.md` as `lessons/imported-lessons.md`, may add output to an existing default tree, does not convert v1, and installs no runtime fallback. A real export requires separate user authorization.
- `reinstall` displays the deletion and replacement scope and defaults to No. After confirmation it removes custom Dove research and old archives, replaces existing default research files with current defaults, preserves ordinary project files, and recreates integration and the complete default tree.
- `doctor` is a read-only developer diagnostic and does not judge science. Host-maintained `DOCTOR.md` feedback is separate and does not require this command.
- `hook user-prompt-submit` provides conservative ambient routing for clear work requests, including Lessons, through one hidden intake.
- `hook stop` requests one additional plain-language rendering and then allows the loop-guarded continuation to finish. Hook execution checks the installed manifest and Claude host but does not run full synchronization inspection on every call.

There is no `mcp` command and no `migrate-research` command.

## Research and review boundaries

- The host performs real retrieval, analysis, experiments, coding, writing, and figure production.
- `status` is read-only; a missing overview is normal, and broken links are reported naturally.
- `auto` is explicit-only and treats the documented mainline as a read-only boundary.
- A reviewer is selected and managed by the user, reads only exact declared paths, makes no edits, and returns Markdown.
- A native Reviewer role does not establish independence.
- Tests and packaged artifacts do not certify research claims.

## Build and release validation

From a source checkout:

```bash
npm ci
npm run release:check
npm run pack:dry-run
```

`npm run check` is the regular software gate. Release validation protects the ten-Skill and three-role inventory, generated adapter drift, absence of the retired MCP runtime, the three bundle entrypoints, CLI inventory, and package archive contents. Exercise lifecycle behavior separately through the real CLI in an isolated synthetic project when those paths change.

These checks validate the software release only. They do not prove scientific correctness, research completion, reproducibility, acceptance, or independent review.

## Stable Markdown and project file boundaries

- Research Markdown has no format or schema version. Future organization changes use ordinary host file operations to rename, move, relink, or consolidate documents while preserving substantive content, failures, limitations, and uncertainty; they do not create a migration framework or runtime fallback.
- Requested artifacts such as drafts, figures, experiment documents, and revisions are created or modified when the task requires them. Additional Dove research Markdown is maintained only when the workflow requires it or the work creates durable research value.
- Dove project file operations use cross-platform Node path containment, ordinary-file and symbolic-link checks, same-directory temporary writes, expected-state rechecks, and transactional rollback; they do not require Linux `/proc` features.
- Complete Reinstall displays the current deletion and replacement paths, defaults to No, and after confirmation rereads the project and executes the current plan.
- `DOCTOR.md` is ordinary host-maintained feedback about Dove itself, without JSON projection, issue lifecycle, or CLI ownership.
