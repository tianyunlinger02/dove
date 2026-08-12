# Capability matrix

## Public architecture

| Capability | Status | Boundary |
|---|---|---|
| Package release | Implemented | Dove `3.0.0`, Node.js `>=22`. |
| Flat Skills | Implemented | `research`, `status`, `source`, `experiment`, `draft`, `figure`, `review`, `rebuttal`, `lessons`, and explicit-only `auto`. |
| Primary roles | Implemented | Planner, Builder/Author, and Reviewer. |
| Generated adapters | Implemented | Canonical host-format projections; files on disk do not prove registration, readiness, or reviewer independence. |
| Runtime CLI | Implemented | `init`, `sync`, `upgrade`, `reinstall`, `doctor`, `export-research`, and `hook`. |
| Runtime bundles | Implemented | Three bundles: public library, packaged CLI, and prompt hook. |
| Research MCP server and tools | Not part of Dove 3 | Skills use host file and research tools directly; there is no MCP registration path. |
| Research Format runtime or database | Not part of Dove 3 | Research context is ordinary Markdown rather than machine-owned state. |
| Supported project initialization | Claude Code | Other generated host adapters are projections, not a complete readiness path. |

## Skills

| Skill | Status | Boundary |
|---|---|---|
| `dove.research` | Implemented | Completes one bounded research or project pass and preserves durable context only when useful. |
| `dove.status` | Implemented | Reads the overview and relevant links without writes; absence and broken links are reported naturally. |
| `dove.source` | Implemented | The host discovers and verifies material; useful source context is recorded in natural Markdown. |
| `dove.experiment` | Implemented | Prospective plan is written before execution; actual work and results are appended to the same document. |
| `dove.draft` | Implemented | Creates or revises an ordinary project draft from available evidence. |
| `dove.figure` | Implemented | Gathers real materials and creates or revises an ordinary figure and caption. |
| `dove.review` | Implemented | Prepares and preserves a user-managed, exact-scope, read-only review exchange in one document. |
| `dove.rebuttal` | Implemented | Keeps response and revision on the Builder/Author side. |
| `dove.lessons` | Implemented | Reads or maintains one optional complete advisory Markdown document. |
| `dove.auto` | Implemented | Explicit multi-round foreground work inside the documented current mainline; never ambient-selected. |

## Research documents

| Capability | Status | Boundary |
|---|---|---|
| Research root | Recommended | Research Markdown lives under `.dove/research/` when maintained. |
| Overview and navigation | Recommended | `RESEARCH.md` summarizes the current mainline, progress, conclusions and limits, links, and priorities. Its absence is normal. |
| Lessons | Optional | `.dove/research/LESSONS.md` is advisory and is not evidence. |
| Topic documents | Implemented convention | Human-named Markdown files, optionally grouped in human-chosen folders and linked naturally. |
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
| Review preparation | Implemented | One Review document records purpose, exact project-relative paths, limits, rubric, and prompt. |
| Reviewer selection and launch | User-managed | The user chooses and starts the separate reviewer session or person. |
| Reviewer access | Read-only | Review covers only the exact declared path scope and must not edit reviewed artifacts. |
| Reviewer return | Markdown | The user obtains the actual return and supplies it back to the author workflow. |
| Review preservation | Implemented | The same Review document preserves preparation, returned Markdown, limitations, author handling, and follow-up. |
| Native Reviewer role | Implemented | Provides responsibility separation but does not prove identity or independence. |
| Reviewer independence proof | Not established | Host labels, local separation, and return provenance are not proof of independence. |

## Status and Auto

| Capability | Status | Boundary |
|---|---|---|
| Missing overview | Normal | Status reports it plainly and does not create or repair research content. |
| Broken document link | Natural warning | Report the missing path and affected context; do not classify a database state. |
| Status writes | Unavailable | Status is read-only. |
| Ambient Auto | Unavailable | Auto is explicit-only. |
| Auto mainline changes | Blocked | The documented current mainline is a read-only boundary; required direction changes are recommended rather than silently applied. |
| Hidden autonomous service | Unavailable | Auto is foreground host work, not a daemon, scheduler, MCP server, or hidden session store. |

## Installation and lifecycle

| Capability | Status | Boundary |
|---|---|---|
| Exact user installation | Implemented | Installs `dove` on `PATH` from a trusted exact artifact. |
| Claude project initialization | Implemented | Installs generated Claude resources, prompt hook, and current installation metadata. |
| Project MCP registration | Unavailable | Dove 3 has no research MCP server or registration step. |
| Manifest revision | Implemented | `.dove/install/manifest.json` uses revision `2.0`. |
| Doctor document | Implemented | `.dove/install/DOCTOR.md` shows current Dove problems and limited recent resolutions; it is not research evidence. |
| Installation/file safety hashes | Internal | Protect managed software bytes; never used as research evidence or authority. |
| Integration sync | Implemented | Refreshes recognized project integration without changing research documents. |
| Project upgrade | Implemented | Refreshes recognized integration and preserves research Markdown. |
| legacy JSON research records export | Explicit | `dove export-research` performs the one-time JSON-to-Markdown conversion and archives original legacy JSON bytes under `.dove/archive/...`. |
| v1 conversion | Unavailable | Dove 3 does not convert v1 research state. |
| Runtime fallback to old research state | Unavailable | Normal work reads Markdown only. |
| Real export authorization | Required | Export against real research needs separate user authorization and is not a routine test. |
| Complete Reinstall | Destructive, confirmed | Defaults to No; after confirmation deletes Dove research and old archives while preserving ordinary project files. |
| Path and shared-file safety | Implemented | Lifecycle operations preserve ordinary files and unrelated configuration and stop on unsafe or conflicting managed content. |

## Packaging and validation

| Capability | Status | Boundary |
|---|---|---|
| Library bundle | Implemented | `dist/index.mjs`. |
| CLI bundle | Implemented | `bin/dove-package.mjs`. |
| Prompt-hook bundle | Implemented | `scripts/dove-user-prompt-submit-package.mjs`. |
| MCP server bundle | Unavailable | Not part of Dove 3 packaging. |
| Adapter generation checks | Implemented | Protect canonical projection completeness, not host readiness. |
| Software validation | Implemented | Focused tests and release gates check software contracts and package artifacts. |
| Scientific certification | Unavailable | Validation does not prove claims, completion, reproducibility, acceptance, or reviewer independence. |

> Current package release: Dove `3.0.0`. See [Packaging](PACKAGING.md) for release boundaries and [Usage](USAGE.md) for working conventions.
