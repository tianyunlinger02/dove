# Directory Structure

> Project-facing surfaces and Markdown research organization for Dove 3.0.0.

---

## Overview

This repository has no browser frontend. It contains the canonical Dove agent persona, canonical Skill workflows, generated host adapters, a lifecycle CLI, Claude SessionStart/prompt/stop hooks, three runtime bundles, public documentation, project installation logic, and software validation.

There is no Dove research-state MCP server or Research Format runtime in the Dove 3 architecture. Claude project integration may declare one pinned external paper-acquisition MCP without bundling its runtime.

## Repository Layout

```text
.
├── .opencode/commands/       # generated OpenCode Skill adapters
├── .opencode/agents/         # generated OpenCode Dove agent surface
├── .cursor/commands/         # generated Cursor adapters
├── .codex/skills/            # generated Codex adapters
├── .agents/skills/           # generated shared-agent adapters
├── .claude/                  # Claude adapters, Dove agent, and ambient resources
├── bin/                      # CLI source and packaged CLI bundle
├── dist/                     # public library bundle
├── docs/                     # public documentation
├── scripts/                  # generators, prompt hook, build, and validation
├── src/
│   ├── cli/                  # CLI parsing and terminal presentation
│   ├── core/                 # workflows, documents, installation, Doctor, and file safety
│   └── templates/markdown/   # installed Trellis spec copies
```

The three package bundles are:

```text
dist/index.mjs
bin/dove-package.mjs
scripts/dove-user-prompt-submit-package.mjs
```

Do not add or document a research MCP bundle.

## Consumer Project Layout

Dove separates software-owned metadata, research Markdown with explicit ownership, export archives, and ordinary project artifacts:

```text
.dove/
├── install/
│   ├── manifest.json         # installation manifest revision 2.0
│   └── DOCTOR.md             # optional natural-language feedback about Dove itself
├── research/
│   ├── RESEARCH.md
│   ├── missions/MISSIONS.md
│   ├── experiments/EXPERIMENTS.md
│   ├── sources/SOURCES.md
│   ├── reviews/REVIEWS.md
│   ├── claims/CLAIMS.md
│   └── lessons/
│       ├── LESSONS.md
│       ├── decision-making.md
│       ├── research-method.md
│       ├── experiments-and-evidence.md
│       ├── engineering-and-validation.md
│       ├── writing-and-review.md
│       └── collaboration-and-environment.md
└── archive/                  # original bytes from explicit legacy JSON export
```

Current initialization creates this default tree. `RESEARCH.md` and the six summaries are researcher-owned entrances and syntheses, not generated indexes or entity stores. The six built-in Lessons themes are package-managed and each carries a plain Markdown notice directing project-specific guidance to separately named Lessons linked from `lessons/LESSONS.md`. Missing summaries are synchronizable defaults rather than research corruption, and an absent overview is still reported naturally if encountered.

Specific Mission, Experiment, Source, Review, Claim, and additional Lessons documents remain naturally named, split, and linked. Explicit-export `lessons/imported-lessons.md` is researcher-owned. Do not require fixed headings, frontmatter, IDs, enums, hashes, a generated index, or stored counts.

Drafts, code, datasets, logs, figures, papers, source captures, review bundles, and rebuttals remain ordinary project files outside Dove-owned software metadata. Research documents may link to them with readable project-relative paths.

## Module Responsibilities

- The canonical Dove agent persona and Skill workflow sources own workflow meaning; generated host adapters remain thin projections.
- Ambient policy owns conservative routing and keeps Auto explicit-only.
- Research-document helpers may support safe discovery and file handling, but they must not introduce a schema or database authority over Markdown.
- CLI modules own `init`, `update`, `reinstall`, `doctor`, `export-research`, and `hook` parsing and presentation.
- Project installation and transaction modules own manifest revision `2.0`, managed-resource safety, current-installation refresh, the supported 1.0 → 2.0 migration, and Complete Reinstall.
- Export logic owns the separately authorized one-time legacy JSON research records-to-Markdown conversion and exact-byte archival under `.dove/archive/...`.
- Build and generator scripts own the three bundles, generated adapter projections, and hidden Claude paper-search support Skill.
- Every file in this directory must match its `src/templates/markdown/spec/frontend/` copy byte-for-byte.

## Naming and Boundaries

- Public Skill IDs remain flat `dove.<surface>` names.
- Source functions use clear verb-first camelCase names.
- Research files use human-readable names and ordinary Markdown links rather than generated semantic IDs.
- Dove agent, Skills, adapters, research documents, project artifacts, installation metadata, ordinary Dove feedback, archives, and bundles are distinct concepts.
- Generated files do not establish host registration, project readiness, scientific correctness, or reviewer independence.

The installed `dove` executable handles project initialization, project integration update, Complete Reinstall, Doctor, explicit legacy JSON research export, and prompt/stop-hook forwarding. It has no `mcp` or `migrate-research` command. Research work remains in the Dove agent, Skills, and normal host tools.

Project roots and Dove-managed paths must be contained and unambiguous. Ordinary files and unrelated shared-configuration fields are preserved. Conflicting or modified managed content blocks automatic replacement. Research defaults are outside the installation manifest; update creates missing summaries, completes current standard overview and Lessons-summary navigation, replaces the six built-in Lessons themes, and deletes only the recognized deprecated package-managed Lessons artifacts `.dove/research/LESSONS.md` and `lessons/additional-lessons.md` without migration or fallback.
