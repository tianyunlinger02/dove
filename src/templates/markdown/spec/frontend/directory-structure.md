# Directory Structure

> Project-facing surfaces and Markdown research organization for Dove 3.0.0.

---

## Overview

This repository has no browser frontend. It contains the canonical Dove agent definition, canonical Skill workflows, generated host adapters, a lifecycle CLI, the Claude SessionStart hook, the statusline helper retained only for user-owned composition scripts, two runtime bundles, explicit isolated review handoff runtime, local run receipt runtime, public documentation, project installation logic, and software validation.

There is no Dove research-state MCP server or Research Format runtime in the Dove 3 architecture. Claude project integration may declare the pinned `dove-paper-search` MCP for scholarly paper discovery, download, and full-text reading plus hosted Exa for ordinary webpage bodies, documentation pages, venue pages, and known URLs, without bundling either runtime.

## Repository Layout

```text
.
├── bin/                      # packaged CLI entrypoint and source bundle target
├── dist/                     # public library bundle
├── docs/                     # public and development documentation
├── package-resources/
│   └── hosts/                # packaged Claude and DSH project resources
├── scripts/                  # generators, build, and validation
├── src/
│   ├── cli/                  # CLI parsing and terminal presentation
│   ├── core/                 # workflows, documents, installation, Doctor, and file safety
│   └── templates/markdown/   # installed Trellis spec copies
```

The package bundles are:

```text
dist/index.mjs
bin/dove-package.mjs
```

Do not add or document a research MCP bundle.

## Consumer Project Layout

Dove separates software-owned metadata, explicit isolated review exchange records, research Markdown with explicit ownership, preserved legacy data, and ordinary project artifacts:

```text
.dove/
├── install/
│   ├── manifest.json         # installation manifest revision 2.0
│   └── DOCTOR.md             # optional natural-language feedback about Dove itself
├── reviews/                  # explicit isolated review exchange records
│   └── <review-id>/
│       ├── review.json
│       └── rounds/<round>/
│           ├── snapshot.json
│           ├── report.md
│           └── backend.json
├── runs/                     # explicit local experiment run receipts
│   └── <run-id>/
│       ├── run.jsonl
│       ├── stdout.log
│       └── stderr.log
├── research/
│   ├── RESEARCH.md           # minimal researcher-owned bootstrap on fresh init
│   ├── missions/             # optional researcher-owned Mission materials
│   ├── experiments/          # optional researcher-owned Experiment materials
│   ├── sources/              # optional researcher-owned Source materials
│   ├── reviews/              # optional researcher-owned Review materials
│   ├── claims/               # optional researcher-owned Claim materials
│   └── lessons/              # optional researcher-owned Lessons materials
└── archive/                  # preserved legacy or user-owned archival material when already present
```

Current initialization creates only the minimal `RESEARCH.md` bootstrap when no research tree exists. Optional summaries, topic documents, and Lessons remain researcher-owned Markdown and are created naturally when useful. Missing summaries are not corruption and are not package-managed defaults.

Specific Mission, Experiment, Source, Review, Claim, Lessons, and other preserved legacy/user-owned documents remain naturally named, split, and linked. Do not require fixed headings, frontmatter, IDs, enums, hashes, a generated index, or stored counts.

Drafts, code, datasets, logs, figures, papers, source captures, copied review materials, and rebuttals remain ordinary project files outside Dove-owned software metadata. `.dove/reviews/**` records are explicit exchange provenance for the isolated review runtime and remain separate from researcher-authored Review Markdown. `.dove/runs/**` records are local command execution receipts for experiments or diagnostics, not Experiment Markdown or scientific conclusions. Research documents may link to these records with readable project-relative paths.

Reviewer runtime workspaces use short paths rather than embedding the consumer project's directory hierarchy. Keep the actual isolated workspace separate from durable `.dove/reviews/**` exchange records; path layout alone is not evidence of reviewer isolation.

## Module Responsibilities

- The canonical Dove agent definition and Skill workflow sources own workflow meaning; generated host adapters remain thin projections.
- The shared Dove rule owns ordinary-response researcher judgment and keeps default progression explicit without a per-prompt hook.
- Research-document helpers may support safe discovery and file handling, but they must not introduce a schema or database authority over Markdown.
- CLI modules own `init`, `update`, `reinstall`, `uninstall`, `doctor`, `review`, `run`, and `hook` parsing and presentation.
- Project installation and transaction modules own manifest revision `2.0`, managed-resource safety, current-installation refresh, the supported 1.0 → 2.0 installation migration, and Complete Reinstall.
- Legacy research-data detection is read-only; old data remains in place and Dove does not automatically convert or delete it.
- Build and generator scripts own the two bundles, generated adapter projections, and hidden Claude guidance Skills for pinned `dove-paper-search` and hosted Exa use.
- Every file in this directory must match its `src/templates/markdown/spec/frontend/` copy byte-for-byte.

## Naming and Boundaries

- Public Skill IDs remain flat `dove.<surface>` names.
- Source functions use clear verb-first camelCase names.
- Research files use human-readable names and ordinary Markdown links rather than generated semantic IDs.
- Dove agent, Skills, adapters, research documents, project artifacts, installation metadata, ordinary Dove feedback, archives, and bundles are distinct concepts.
- Generated files do not establish host registration, project readiness, scientific correctness, or `dove-review` independence.

The installed `dove` executable handles project initialization, project integration update, Complete Reinstall, Doctor, explicit isolated review handoff operations, explicit local run receipts, the managed SessionStart hook entry point, and a retained statusline helper for older user-owned configurations. It has no Auto Skill or command, no `mcp`, `migrate-research`, legacy export, `UserPromptSubmit`, hidden intake, replacement per-prompt hook, or Stop hook command. Research work remains in the Dove agent, Skills, and normal host tools.

Project roots and Dove-managed paths must be contained and unambiguous. Ordinary files and unrelated shared-configuration fields are preserved. Unowned conflicts and unsafe paths block replacement. Explicit update replaces valid manifest-owned local edits with a notice; SessionStart skips them, syncs the remaining safe resources, and reports skipped paths through `systemMessage`. Research bootstrap files, `.dove/reviews/**` exchange records, and `.dove/runs/**` run receipts are outside the installation manifest; update, SessionStart sync, reinstall, and uninstall preserve existing `.dove/research/**`, `.dove/reviews/**`, and `.dove/runs/**` bytes and do not complete navigation, replace Lessons, or delete retired researcher-visible materials, Review records, or run receipts. Current Dove resources install no `UserPromptSubmit` hook; lifecycle refresh removes only exact old manifest-owned Dove prompt hooks while preserving unrelated prompt hooks.
