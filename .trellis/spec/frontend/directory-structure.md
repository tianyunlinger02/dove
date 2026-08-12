# Directory Structure

> Project-facing surfaces and Markdown research organization for Dove 3.0.0.

---

## Overview

This repository has no browser frontend. It contains canonical Skill workflows, three role definitions, generated host adapters, a lifecycle CLI, a prompt hook, three runtime bundles, public documentation, project installation logic, and software validation.

There is no research MCP server or Research Format runtime in the Dove 3 architecture.

## Repository Layout

```text
.
├── .opencode/commands/       # generated OpenCode Skill adapters
├── .opencode/skills/         # Planner, Builder/Author, and Reviewer projections
├── .cursor/commands/         # generated Cursor adapters
├── .codex/skills/            # generated Codex adapters
├── .agents/skills/           # generated shared-agent adapters
├── .claude/                  # Claude adapters, Reviewer, and ambient resources
├── bin/                      # CLI source and packaged CLI bundle
├── dist/                     # public library bundle
├── docs/                     # public documentation
├── scripts/                  # generators, prompt hook, build, and validation
├── src/
│   ├── cli/                  # CLI parsing and terminal presentation
│   ├── core/                 # workflows, documents, installation, Doctor, and file safety
│   └── templates/markdown/   # installed Trellis spec copies
└── tests/                    # focused unit and integration behavior
```

The three package bundles are:

```text
dist/index.mjs
bin/dove-package.mjs
scripts/dove-user-prompt-submit-package.mjs
```

Do not add or document a research MCP bundle.

## Consumer Project Layout

Dove separates software-owned metadata, researcher-owned Markdown, export archives, and ordinary project artifacts:

```text
.dove/
├── install/
│   ├── manifest.json         # installation manifest revision 2.0
│   ├── doctor.json           # optional Doctor machine state
│   └── DOCTOR.md             # readable current problems and recent resolutions
├── research/
│   ├── RESEARCH.md           # recommended overview and navigation
│   ├── LESSONS.md            # optional advisory guidance
│   └── ...                   # human-named linked topic documents
└── archive/                  # original bytes from explicit legacy JSON export
```

Any of the research paths may be absent when a project has not chosen to maintain them. A missing `RESEARCH.md` is normal and must not be turned into an invalid-database state.

A project may group topic documents into human-chosen folders such as `missions/`, `sources/`, `experiments/`, or `reviews/`. Those folder names are recommendations, not required entity stores. Do not require fixed headings, frontmatter, IDs, enums, hashes, a generated index, or stored counts.

Drafts, code, datasets, logs, figures, papers, source captures, review bundles, and rebuttals remain ordinary project files outside Dove-owned software metadata. Research documents may link to them with readable project-relative paths.

## Module Responsibilities

- Canonical Skill and role sources own workflow meaning; generated host adapters remain thin projections.
- Ambient policy owns conservative routing and keeps Auto explicit-only.
- Research-document helpers may support safe discovery and file handling, but they must not introduce a schema or database authority over Markdown.
- CLI modules own `init`, `sync`, `upgrade`, `reinstall`, `doctor`, `export-research`, and `hook` parsing and presentation.
- Project installation and transaction modules own manifest revision `2.0`, managed-resource safety, synchronization, Upgrade, and Complete Reinstall.
- Export logic owns the separately authorized one-time legacy JSON research records-to-Markdown conversion and exact-byte archival under `.dove/archive/...`.
- Build and generator scripts own the three bundles and generated adapter projections.
- Every file in this directory must match its `src/templates/markdown/spec/frontend/` copy byte-for-byte.

## Naming and Boundaries

- Public Skill IDs remain flat `dove.<surface>` names.
- Source functions use clear verb-first camelCase names.
- Research files use human-readable names and ordinary Markdown links rather than generated semantic IDs.
- Skills, roles, adapters, research documents, project artifacts, installation metadata, Doctor state, archives, and bundles are distinct concepts.
- Generated files do not establish host registration, project readiness, scientific correctness, or reviewer independence.

The installed `dove` executable handles project initialization, synchronization, Upgrade, Complete Reinstall, Doctor, explicit legacy JSON research export, and prompt-hook forwarding. It has no `mcp` or `migrate-research` command. Research work remains in Skills and normal host tools.

Project roots and Dove-managed paths must be contained and unambiguous. Ordinary files and unrelated shared-configuration fields are preserved. Conflicting or modified managed content blocks automatic replacement. Sync and Upgrade never rewrite researcher-owned Markdown.
