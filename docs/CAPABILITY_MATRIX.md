# Capability matrix

## Public architecture

| Capability | Status | Boundary |
|---|---|---|
| Package release | Implemented | Dove `3.0.0`, Node.js `>=22`. |
| Flat Skills | Implemented | `research`, `status`, `source`, `experiment`, `draft`, `figure`, `review`, `rebuttal`, `lessons`, and explicit-only `auto`. |
| Primary roles | Implemented | Planner, Builder/Author, and Reviewer. |
| Generated adapters | Implemented | Canonical host-format projections; files on disk do not prove registration, readiness, or reviewer independence. |
| Runtime CLI | Implemented | `init`, `update`, `reinstall`, `doctor`, `export-research`, and `hook`. |
| Runtime bundles | Implemented | Three bundles: public library, packaged CLI, and prompt hook. |
| Dove research-state MCP server and tools | Not part of Dove 3 | Dove does not own a research service, tool registry, or hidden research state. |
| External paper acquisition | Claude project support | A hidden support Skill can use project server `dove-paper-search`, pinned to `paper-search-mcp==0.1.4`, for on-demand scholarly search, open download, and full-text reading. |
| Research Format runtime or database | Not part of Dove 3 | Research context is ordinary Markdown rather than machine-owned state. |
| Supported project initialization | Claude Code | Other generated host adapters are projections, not a complete readiness path. |

## Skills

| Skill | Status | Boundary |
|---|---|---|
| `dove.research` | Implemented | Completes one bounded research or project pass and preserves durable context only when useful. |
| `dove.status` | Implemented | Reads the overview and relevant links without writes; absence and broken links are reported naturally. |
| `dove.source` | Implemented | The host may discover, retrieve, save, read, and verify material; useful source context is recorded in natural Markdown. |
| `dove.experiment` | Implemented | Handles design, requested execution, existing-result analysis, and honestly labeled retrospective records; a newly executed experiment uses one document for prospective plan and actual results. |
| `dove.draft` | Implemented | Creates or revises an ordinary project draft from available evidence. |
| `dove.figure` | Implemented | Gathers real materials and creates or revises an ordinary figure and caption. |
| `dove.review` | Implemented | Prepares a user-managed read-only review, faithfully imports its return, or inspects existing review context without creating an unnecessary exchange. |
| `dove.rebuttal` | Implemented | Keeps response and revision on the Builder/Author side. |
| `dove.lessons` | Implemented | Reads `lessons/LESSONS.md` and relevant linked themes, or naturally maintains a theme and its summary. Lessons remain advisory and source explanation is optional. |
| `dove.auto` | Implemented | Explicit multi-round foreground work inside the documented current mainline; never ambient-selected. |

## Research documents

| Capability | Status | Boundary |
|---|---|---|
| Research root | Default | `init` creates ordinary researcher-maintained Markdown under `.dove/research/`; these files are not installation-manifest resources. |
| Overview and navigation | Default | Root `RESEARCH.md` links the six directory summaries and remains a concise mainline and navigation document. |
| Directory summaries | Default | `missions/MISSIONS.md`, `experiments/EXPERIMENTS.md`, `sources/SOURCES.md`, `reviews/REVIEWS.md`, `claims/CLAIMS.md`, and `lessons/LESSONS.md` are human-maintained entrances, not generated indexes. |
| Lessons | Default advisory themes | Six general theme files live under `lessons/`; they are fallible guidance and never evidence. |
| Topic documents | Implemented convention | Human-named Markdown files live in the corresponding directories and are linked naturally from summaries. |
| Fixed Markdown template | Unavailable by design | No mandatory headings, frontmatter, or document shape. |
| Machine research identifiers or enums | Unavailable by design | Documents use human language and paths rather than generated records. |
| Research index, stored counts, or hashes | Unavailable by design | Navigation is ordinary Markdown; installation safety data stays separate. |
| Mission documents | Supported | Natural documents may preserve bounded goals, work, failures, conclusions, limits, and next branches. |
| Source documents | Supported | Natural notes may preserve citations, verification, conditions, conflicts, and limitations. |
| Experiment documents | Supported | One document contains the prospective plan and later actual results. |
| Claim store | Unavailable by design | Claims remain scoped prose, tables, or dedicated documents when useful. |
| Automatic scientific interpretation | Unavailable | The host and researchers interpret evidence; Dove does not certify meaning. |

## Review

| Capability | Status | Boundary |
|---|---|---|
| Review preparation | Implemented | When preparation is requested, one Review document records purpose, relevant project-relative paths, limits, rubric, and prompt. |
| Reviewer selection and launch | User-managed | The user chooses and starts the separate reviewer session or person. |
| Reviewer access | Read-only | Review stays within the declared artifact scope and says when that scope is insufficient. |
| Reviewer return | Markdown | The user obtains the actual return and supplies it back to the author workflow. |
| Review preservation | Implemented | The corresponding Review document preserves the returned Markdown faithfully; author handling is added only when requested and substantive response remains Rebuttal work. |
| Native Reviewer role | Implemented | Provides responsibility separation but does not prove identity or independence. |
| Reviewer independence proof | Not established | Host labels, local separation, and return provenance are not proof of independence. |

## Status and Auto

| Capability | Status | Boundary |
|---|---|---|
| Missing overview | Normal | Status reports it plainly and does not create or repair research content. |
| Broken document link | Natural warning | Report the missing path and affected context; do not classify a database state. |
| Status writes | Unavailable | Status is read-only. |
| Ambient Auto | Unavailable | Auto is explicit-only. |
| Auto mainline changes | Blocked | The documented current mainline is a read-only boundary; required direction changes are recommended rather than silently applied. Ordinary exploration is not logged round by round; durable evidence, conclusions, failures, decisions, and direction changes are preserved when useful. |
| Hidden autonomous service | Unavailable | Auto is foreground host work, not a daemon, scheduler, MCP server, or hidden session store. |

## Installation and lifecycle

| Capability | Status | Boundary |
|---|---|---|
| Exact user installation | Implemented | Installs `dove` on `PATH` from a trusted exact artifact. |
| Claude project initialization | Implemented | Installs generated Claude resources, prompt and stop hooks, and current installation metadata. |
| Project paper MCP declaration | Implemented for Claude | Init/update safely own only `.mcp.json#/mcpServers/dove-paper-search`, preserve unrelated servers, and never write approval, trust, or credentials. |
| Manifest revision | Implemented | `.dove/install/manifest.json` uses revision `2.0`. |
| Dove feedback document | Host-maintained Markdown | `.dove/install/DOCTOR.md` records user feedback when Dove is explicitly named, plus actual Dove failures. Reusable feedback about ordinary research or collaboration without an explicit Dove reference belongs in Lessons. It has no JSON state, issue lifecycle, fixed template, or scientific authority. |
| Installation/file safety hashes | Internal | Protect managed software bytes; never used as research evidence or authority. |
| Integration update | Implemented | Refreshes recognized integration, creates each missing default file from complete package content, and exactly appends missing canonical content only to existing defaults while preserving their byte prefix and ordinary topic documents. Missing defaults make status `needs-sync`. |
| legacy JSON research records export | Explicit | `dove export-research` writes the new summaries and topic directories, preserves legacy `.dove/LESSONS.md` as `lessons/imported-lessons.md`, supports an existing default tree, and archives original JSON bytes under `.dove/archive/...`. |
| v1 conversion | Unavailable | Dove 3 does not convert v1 research state. |
| Runtime fallback to old research state | Unavailable | Normal work reads Markdown only. |
| Real export authorization | Required | Export against real research needs separate user authorization and is not a routine test. |
| Complete Reinstall | Destructive, confirmed | Displays deletion and replacement scope and defaults to No; after confirmation deletes custom Dove research and old archives, replaces existing default research files with current defaults, preserves ordinary project files, and rebuilds the complete default tree. |
| Path and shared-file safety | Implemented | Lifecycle operations preserve ordinary files and unrelated configuration and stop on unsafe or conflicting managed content. |

## Packaging and validation

| Capability | Status | Boundary |
|---|---|---|
| Library bundle | Implemented | `dist/index.mjs`. |
| CLI bundle | Implemented | `bin/dove-package.mjs`. |
| Prompt-hook bundle | Implemented | `scripts/dove-user-prompt-submit-package.mjs`. |
| Dove MCP server bundle | Unavailable | Dove packages no research MCP runtime or third-party Python source; the project config launches the pinned external package through user-provided `uvx`. |
| Adapter generation checks | Implemented | Protect canonical projection completeness, not host readiness. |
| Software validation | Implemented | Generated-resource checks, package validation, and real CLI runs provide bounded software evidence. |
| Scientific certification | Unavailable | Validation does not prove claims, completion, reproducibility, acceptance, or reviewer independence. |

> Current package release: Dove `3.0.0`. See [Packaging](PACKAGING.md) for release boundaries and [Usage](USAGE.md) for working conventions.

## Stable Markdown and project file boundaries

- Research Markdown has no format or schema version. Future organization changes use ordinary host file operations to rename, move, relink, or consolidate documents while preserving substantive content, failures, limitations, and uncertainty; they do not create a migration framework or runtime fallback.
- Requested artifacts such as drafts, figures, experiment documents, and revisions are created or modified when the task requires them. Additional Dove research Markdown is maintained only when the workflow requires it or the work creates durable research value.
- Dove project file operations use cross-platform Node path containment, ordinary-file and symbolic-link checks, same-directory temporary writes, expected-state rechecks, and transactional rollback; they do not require Linux `/proc` features.
- Complete Reinstall displays the current deletion and replacement paths, defaults to No, and after confirmation rereads the project and executes the current plan.
- `dove doctor` is a read-only developer diagnostic. Users normally do not need it; the host writes relevant Dove feedback directly to ordinary `DOCTOR.md`.
