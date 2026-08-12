# Packaging

## Delivery model

Dove 3.0.0 is one host-neutral Node.js 22 npm artifact. It installs the `dove` executable for the current user. Consumer projects invoke `dove` from `PATH`; project initialization installs host-facing Markdown resources and software metadata, not copied runtime bundles.

The bare public npm package named `dove` is unrelated. Release instructions must use an exact trusted tarball, Git revision, or internal-registry package version.

## Release inventory

Every Dove 3.0.0 release contains:

- **10 flat Skills**: `research`, `status`, `source`, `experiment`, `draft`, `figure`, `review`, `rebuttal`, `lessons`, and explicit-only `auto`;
- **3 roles**: Planner, Builder/Author, and Reviewer;
- generated adapters for the declared host formats;
- the project lifecycle CLI and prompt hook;
- public documentation; and
- **3 standalone Node.js bundles**.

There is no research MCP server bundle, research tool inventory, MCP registration command, or Research Format runtime.

A Skill is a host workflow. A role defines responsibility. An adapter is a generated projection for a host format. A research document is ordinary researcher-owned Markdown. These concepts intentionally do not map one-to-one.

## Generated host surfaces

Canonical adapter outputs include:

- `.opencode/commands/dove.*.md`;
- `.codex/skills/dove-*/SKILL.md`;
- `.cursor/commands/dove-*.md`;
- `.agents/skills/dove-*/SKILL.md`; and
- `.claude/commands/dove/*.md`.

Role and ambient resources include the Planner, Builder/Author, and Reviewer projections where supported, the Claude Reviewer definition, the Claude ambient rule and hidden intake resources, and the managed prompt hook.

Adapters are generated from canonical Dove workflow sources. Do not edit generated projections independently. Adapter presence does not establish installation, registration, tool availability, project readiness, reviewer identity, or reviewer independence.

Claude Code remains the supported project initialization path. Other host projections may be packaged without a complete initialization path in this release.

## Three runtime bundles

The package contains three standalone Node.js 22 ESM bundles:

| Bundle | Purpose |
|---|---|
| `dist/index.mjs` | Public library bundle. |
| `bin/dove-package.mjs` | Packaged `dove` CLI. |
| `scripts/dove-user-prompt-submit-package.mjs` | Prompt-hook bundle. |

The package contains no MCP server bundle. The canonical build checks generated adapters and these three bundles for drift. Consumer installation does not regenerate them.

## Project integration

For the supported path, `dove init --host claude` installs the Claude command adapters, role and ambient resources, prompt hook, and `.dove/install/manifest.json`.

It does not add a project `.mcp.json`, register a user MCP server, create research documents, or copy the runtime bundles into the project.

The project installation manifest uses revision `2.0`. Optional Doctor machine state and readable `DOCTOR.md` also belong under `.dove/install/`. Managed-file hashes are internal software safety data and are not exposed as research evidence.

Project paths and managed-resource parents must remain contained and unambiguous. Existing matching resources may be recognized without rewriting them. Conflicting or user-modified managed content blocks automatic replacement. Shared configuration keeps unrelated fields and entries.

## Research documents are not package state

Research context, when maintained, is ordinary Markdown under `.dove/research/`:

- `RESEARCH.md` is the recommended overview and navigation document;
- `LESSONS.md` is optional; and
- other files are human-named linked topic documents.

The package does not define fixed headings, frontmatter, IDs, enums, machine indexes, stored counts, research hashes, or a mandatory Markdown template. Mission, Source, Experiment, Review, and occasional Claim documents are conventions chosen for readability, not entity stores.

The same Experiment document holds the prospective plan and later actual results. The same Review document holds preparation, the actual user-obtained Markdown return, and author handling.

## CLI inventory and lifecycle

The packaged CLI exposes:

```text
init, sync, upgrade, reinstall, doctor, export-research, hook
```

- `init` creates supported project integration.
- `sync` and `upgrade` refresh recognized integration without changing research documents.
- `export-research` performs an explicit one-time conversion from supported legacy Dove JSON research records state to Markdown and archives the original bytes under `.dove/archive/...`. It does not convert v1 and does not install a runtime fallback. A real export requires separate user authorization.
- `reinstall` displays the deletion scope and defaults to No. After confirmation it removes Dove research and old archives while preserving ordinary project files, then recreates integration as applicable.
- `doctor` maintains software-facing diagnostics under `.dove/install/` and does not judge science.
- `hook user-prompt-submit` provides the packaged prompt-hook entry.

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

`npm run check` is the regular software gate. Release validation should protect the ten-Skill and three-role inventory, generated adapter drift, absence of the retired MCP runtime, the three bundle entrypoints, CLI inventory, project lifecycle safety, and package archive contents.

These checks validate the software release only. They do not prove scientific correctness, research completion, reproducibility, acceptance, or independent review.
