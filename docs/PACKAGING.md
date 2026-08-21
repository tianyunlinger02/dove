# Packaging

## Delivery model

Dove 3.0.0 is one host-neutral Node.js 22 npm artifact. It installs the `dove` executable for the current user. Consumer projects invoke `dove` from `PATH`; project initialization installs host-facing Markdown resources and software metadata, not copied runtime bundles.

The bare public npm package named `dove` is unrelated. Release instructions must use an exact trusted tarball, Git revision, or internal-registry package version.

## Release inventory

Every Dove 3.0.0 release contains:

- **one Dove research agent** for supported agent hosts;
- **10 flat Skills**: `research`, `status`, `source`, `experiment`, `draft`, `figure`, `review`, `rebuttal`, `lessons`, and explicit-only `auto`;
- generated adapters for the declared host formats;
- the project lifecycle CLI plus Claude prompt and stop hooks;
- public documentation; and
- **3 standalone Node.js bundles**.

There is no Dove research MCP server bundle, research tool registry, MCP CLI command, Research Format runtime, or separate Dove-managed planning, authoring, or reviewing agent. The artifact does contain one hidden Claude support Skill and a fixed project fragment for the external `paper-search-mcp==0.1.4`; it does not contain that Python package.

A Skill is a capability entrance for the Dove agent. An adapter is a generated projection for a host format. Research documents are ordinary Markdown; only the six built-in Lessons themes are package-managed. These concepts intentionally do not map one-to-one.

## Generated host surfaces

Canonical adapter outputs include:

- `.claude/agents/dove.md`;
- `.opencode/agents/dove.md`;
- `.opencode/commands/dove.*.md`;
- `.codex/skills/dove-*/SKILL.md`;
- `.cursor/commands/dove-*.md`;
- `.agents/skills/dove-*/SKILL.md`; and
- `.claude/commands/dove/*.md`.

Ambient resources include the Claude ambient rule and hidden intake resources, the hidden `dove-paper-search` support Skill, and the managed prompt and stop hooks.

Adapters are generated from canonical Dove workflow sources. They carry the same Dove agent persona into installed projects: start from the research mainline and decision that matters, use hunches as hypotheses, treat user preferences as tradeoff signals, turn gaps into discriminating evidence or concrete next moves, layer constraints and artifacts by whether they change or protect the mainline decision, and act from evidence and task risk without rushing into aggressive execution or over-defending. Do not edit generated projections independently. Adapter presence does not establish installation, registration, tool availability, project readiness, reviewer identity, or reviewer independence.

Claude Code remains the supported project initialization path. The OpenCode Dove agent and other host projections may be packaged without a complete initialization path in this release.

## Three runtime bundles

The package contains three standalone Node.js 22 ESM bundles:

| Bundle | Purpose |
|---|---|
| `dist/index.mjs` | Public library bundle. |
| `bin/dove-package.mjs` | Packaged `dove` CLI. |
| `scripts/dove-user-prompt-submit-package.mjs` | Prompt-hook bundle. |

The package contains no MCP server bundle or third-party Python source. The canonical build checks generated adapters, the hidden paper support Skill, and these three bundles for drift. Consumer installation does not regenerate them.

## Project integration

For the supported path, `dove init --host claude` installs the Claude command adapters, Dove agent, ambient resources, prompt and stop hooks, `.dove/install/manifest.json`, and one owned fragment at `.mcp.json#/mcpServers/dove-paper-search`.

The fragment launches the pinned external package through user-provided `uvx`. Dove does not install or bundle Python source, write credentials, register a user-level server, or approve project trust. It also bootstraps the default research Markdown tree outside the installation manifest. The overview and six summaries are researcher-owned; the six built-in Lessons themes are package-managed.

The project installation manifest uses revision `2.0`. Optional ordinary `DOCTOR.md` feedback about Dove itself also lives under `.dove/install/`; there is no Doctor JSON state or issue lifecycle. Managed-file hashes are internal software safety data and are not exposed as research evidence.

Project paths and managed-resource parents must remain contained and unambiguous. Existing matching resources may be recognized without rewriting them. Conflicting or user-modified managed content blocks automatic replacement. Shared configuration keeps unrelated fields and entries.

## Research Markdown ownership

Research context is ordinary Markdown under `.dove/research/`. The default tree contains:

- root `RESEARCH.md`;
- `missions/MISSIONS.md`, `experiments/EXPERIMENTS.md`, `sources/SOURCES.md`, `reviews/REVIEWS.md`, and `claims/CLAIMS.md`;
- `lessons/LESSONS.md`; and
- six general Lessons themes under `lessons/`.

Each summary is a researcher-owned entrance and synthesis, not a generated index. The six built-in Lessons themes are package-managed, and each directs project-specific guidance to a separately named Lesson linked from `lessons/LESSONS.md`. Other documents remain naturally named, linked, and researcher-owned. Source explanations are useful when available but not mandatory.

The package does not define fixed headings, frontmatter, IDs, enums, machine indexes, stored counts, research hashes, or a mandatory Markdown template. Mission, Source, Experiment, Review, and occasional Claim documents are conventions chosen for readability, not entity stores.

When newly executed central experiment work needs recording, the same Experiment document holds the prospective plan and later actual results. The corresponding Review document preserves preparation and the actual user-obtained Markdown return; author handling is added only when requested, and substantive response and revision remain author-side Dove work.

## CLI inventory and lifecycle

The packaged CLI exposes:

```text
init, update, reinstall, doctor, export-research, hook
```

- `init` creates supported project integration and the complete default research Markdown tree in one transaction.
- `update` refreshes recognized integration, creates missing summaries, and completes current standard navigation only in `RESEARCH.md` and `lessons/LESSONS.md`. It replaces each of the six package-managed built-in Lessons themes with current package content. Other research documents, including explicit-export `lessons/imported-lessons.md`, remain researcher-owned.
- `update` directly deletes deprecated `.dove/research/LESSONS.md` and `lessons/additional-lessons.md` without migration or fallback and removes the Additional migrated Lessons link.
- `export-research` performs an explicit one-time conversion from supported legacy Dove JSON research records state to the new Markdown directories and archives the original bytes under `.dove/archive/...`. It keeps legacy `.dove/LESSONS.md` as researcher-owned `lessons/imported-lessons.md`, may add output to an existing default tree, does not convert v1, and installs no runtime fallback. A real export requires separate user authorization.
- `reinstall` displays the deletion and replacement scope and defaults to No. After confirmation it removes custom Dove research and old archives, replaces existing default research files with current defaults, preserves ordinary project files, and recreates integration and the complete default tree.
- `doctor` is a read-only developer diagnostic and does not judge science. Host-maintained `DOCTOR.md` feedback is separate and does not require this command.
- `hook user-prompt-submit` provides conservative ambient routing only for clear Dove/research work requests. Hidden intake may choose no Dove Skill for contextual follow-ups, explanations, confirmations, or judgment-only prompts.
- `hook stop` requests one additional plain-language rendering and then allows the loop-guarded continuation to finish. Hook execution checks the installed manifest and Claude host but does not run full synchronization inspection on every call.

There is no `mcp` command and no `migrate-research` command.

## Research and review boundaries

- The host performs real retrieval, analysis, experiments, coding, writing, and figure production.
- `status` is read-only; a missing overview is reported naturally, and broken links are reported naturally.
- `auto` is explicit-only and treats the documented mainline as a read-only boundary.
- A separate reviewer is user-managed, scoped to declared paths, read-only, and Markdown-returning.
- A native role or local session does not establish independence.
- Tests and packaged artifacts do not certify research claims or Dove research quality.

## Build and release validation

From a source checkout:

```bash
npm ci
npm run release:check
npm run pack:dry-run
```

`npm run check` is the regular software gate. Release validation protects the ten-Skill inventory, Dove agent surface, generated adapter drift, absence of the retired MCP runtime, the three bundle entrypoints, CLI inventory, and package archive contents. Exercise lifecycle behavior separately through the real CLI in an isolated synthetic project when those paths change.

These checks validate the software release only. They do not prove scientific correctness, research completion, reproducibility, acceptance, independent review, or Dove research quality.

## Stable Markdown and project file boundaries

- Research Markdown has no format or schema version. Future organization changes use ordinary host file operations to rename, move, relink, or consolidate documents while preserving substantive content, failures, limitations, and uncertainty; they do not create a migration framework or runtime fallback.
- Requested artifacts such as drafts, figures, experiment documents, and revisions are created or modified when the task requires them. Additional Dove research Markdown is maintained only when the user explicitly asks to record, update, or save it, or when results clearly change the research mainline, conclusion, decision, or priority.
- Dove project file operations use cross-platform Node path containment, ordinary-file and symbolic-link checks, same-directory temporary writes, expected-state rechecks, and transactional rollback; they do not require Linux `/proc` features.
- Complete Reinstall displays the current deletion and replacement paths, defaults to No, and after confirmation rereads the project and executes the current plan.
- `DOCTOR.md` is ordinary host-maintained feedback about Dove itself, without JSON projection, issue lifecycle, or CLI ownership.
