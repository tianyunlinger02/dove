# Capability matrix

## Public architecture

| Capability | Status | Boundary |
|---|---|---|
| Package release | Implemented | Dove `3.0.0`, Node.js `>=22`. |
| Dove research agent | Implemented for generated agent surfaces | `.claude/agents/dove.md` and `.opencode/agents/dove.md` define one complete Dove persona; planning, authoring, and reviewing are not user-switchable Dove agents. |
| Flat Skills | Implemented | `research`, `status`, `source`, `experiment`, `draft`, `figure`, `review`, `rebuttal`, `lessons`, and explicit-only `auto` are capability entrances. |
| Generated adapters | Implemented | Canonical host-format projections; files on disk do not prove registration, readiness, or reviewer independence. |
| Runtime CLI | Implemented | `init`, `update`, `reinstall`, `doctor`, `export-research`, and `hook`. |
| Runtime bundles | Implemented | Three bundles: public library, packaged CLI, and prompt hook. |
| Dove research-state MCP server and tools | Not part of Dove 3 | Dove does not own a research service, tool registry, or hidden research state. |
| External paper acquisition | Claude project support | A hidden support Skill can use project server `dove-paper-search`, pinned to `paper-search-mcp==0.1.4`, for on-demand scholarly search, open download, and full-text reading. |
| Research Format runtime or database | Not part of Dove 3 | Research context is ordinary Markdown rather than machine-owned state. |
| Supported project initialization | Claude Code | The OpenCode Dove agent and other generated host adapters are projections, not a complete readiness path. |

## Dove persona

Dove should act as one complete research agent:

- start from the real research question, current mainline, external context, user need, key uncertainty, and decision that matters;
- use hunches and first impressions as hypotheses, not decisions, and treat user preferences as tradeoff signals rather than rigid rules;
- compare serious candidates with theory and actual use conditions instead of committing to the first plausible route;
- turn limits and gaps into sharp hypotheses, discriminating evidence to seek, or concrete next moves instead of stopping at cautious admission;
- treat rigor, novelty, experiments, validation, engineering, writing, review, documents, and preferences as layered means rather than equal goals;
- act from evidence, task risk, user preference, and the research mainline without rushing into aggressive execution or over-defending with unnecessary checks; and
- give judgment with a useful next move, then stop before side effects when further action is unlikely to resolve a material uncertainty.

## Skills

| Skill | Status | Boundary |
|---|---|---|
| `dove.research` | Implemented | Completes one bounded research or project pass; pure judgment follow-ups answer directly without side effects, and Markdown is maintained for explicit record/update/save requests, clear mainline/conclusion/decision/priority changes, or durable recovery and evidence value. |
| `dove.status` | Implemented | Reads the overview, relevant summaries, and necessary linked context without writes; absence and broken links are reported naturally. |
| `dove.source` | Implemented | The host may discover, retrieve when available, save when useful, read, and verify material with available approved tools; useful source context is recorded in natural Markdown. |
| `dove.experiment` | Implemented | Handles design, requested execution, existing-result analysis, retrospective records, and smallest low-risk diagnostics needed to establish experiment basis; experiment Markdown is maintained when explicitly requested, when results change a research decision, or when durable recovery value warrants it. |
| `dove.draft` | Implemented | Drafts, assesses, creates, or revises ordinary project text and artifacts from available evidence when the deliverable requires it. |
| `dove.figure` | Implemented | Owns actual drawing, redrawing, figure revision, generation, captioning, and material figure validation. It establishes each visual's evidence job, checks the real manuscript layout against captions, claims, source data or selection metadata, and rendering logic, and does not treat standalone images or contact sheets as proof of quality. It uses reproducible plotting for quantitative results, an available specialized figure-generation model for method/concept visuals when best suited, image/SVG tools for repair, and repository-local `.claude/tmp/` for scratch renders. |
| `dove.review` | Implemented | Grounds direct critique and separate handoff preparation in current official venue requirements and actually inspected relevant published work when they can change the judgment; faithfully imports returns or inspects existing context without unnecessary search or exchange. |
| `dove.rebuttal` | Implemented | Keeps response and requested evidence-backed revision on the author side. |
| `dove.lessons` | Implemented | Reads `lessons/LESSONS.md` and relevant linked themes, or naturally maintains a researcher-owned Lesson and its summary when explicitly asked. Built-in themes remain package-managed; all Lessons are advisory and source explanation is optional. |
| `dove.auto` | Implemented as a generated instruction contract | Explicit foreground multi-round research that recovers and advances the current mainline within user limits; never ambient-selected and never promotes subordinate support work into the research direction. Actual host-runtime Skill invocation is established by the tool trace, not by adapter presence. |

## Research documents

| Capability | Status | Boundary |
|---|---|---|
| Research root | Default | `init` creates ordinary Markdown under `.dove/research/`; research files are ordinary context, not installation-manifest authority. |
| Overview and navigation | Researcher-owned default | Root `RESEARCH.md` links the six directory summaries and remains a concise mainline and navigation document. Update only completes its current standard navigation. |
| Directory summaries | Researcher-owned defaults | `missions/MISSIONS.md`, `experiments/EXPERIMENTS.md`, `sources/SOURCES.md`, `reviews/REVIEWS.md`, `claims/CLAIMS.md`, and `lessons/LESSONS.md` are human-maintained entrances, not generated indexes. Missing summaries are created; update only completes current standard navigation in `lessons/LESSONS.md`. |
| Built-in Lessons | Package-managed defaults | Six advisory theme files live under `lessons/`; update replaces each whole file with current package content. Each warns that project-specific guidance belongs in a separately named Lesson linked from `lessons/LESSONS.md`. |
| Topic documents | Implemented convention | Human-named Markdown files live in the corresponding directories and are linked naturally from summaries. |
| Fixed Markdown template | Unavailable by design | No mandatory headings, frontmatter, or document shape. |
| Machine research identifiers or enums | Unavailable by design | Documents use human language and paths rather than generated records. |
| Research index, stored counts, or hashes | Unavailable by design | Navigation is ordinary Markdown; installation safety data stays separate. |
| Mission documents | Supported | Natural documents may preserve bounded goals, work, failures, conclusions, limits, and next branches. |
| Source documents | Supported | Natural notes may preserve citations, what was inspected, and what materially changed the work. |
| Experiment documents | Supported | When newly executed central work needs recording, one document contains the prospective plan and later actual results. |
| Claim store | Unavailable by design | Claims remain scoped prose, tables, or dedicated documents when useful. |
| Automatic scientific interpretation | Unavailable | The host and researchers interpret evidence; Dove does not certify meaning. |

## Review

| Capability | Status | Boundary |
|---|---|---|
| Review grounding | Implemented | Before direct critique or handoff preparation, Dove uses current official venue sources for applicable formal requirements and a small set of actually inspected published work for novelty, positioning, evidence norms, experiment presentation, and reader expectations. Published practice does not replace official rules, and no fixed paper count or checklist is required. |
| Reviewer-perspective critique | Implemented | `/dove:review` forms a fresh judgment from the actual manuscript and established grounding without inheriting Auto's verdict or package summary. It reconstructs the central contribution, traces decisive claims to the evidence offered, identifies the strongest plausible falsifier or informed-reader objection, and judges whether the manuscript answers it. Delivery-only package checks remain subordinate and cannot establish or truncate scientific readiness. For material figures it inspects reviewer-facing visuals in the real manuscript layout and at realistic final size, comparing captions, nearby claims, source data or selection metadata, and rendering logic; image counts, embedding, file validity, contact sheets, and merely opening images are inventory or superficial evidence only, and an uninspected-in-context figure prevents an Auto-gate `PASS`. |
| Review preparation | Implemented | When separate preparation is requested, one Review document records purpose, relevant project-relative paths, limits, grounding, rubric, and a self-contained prompt. |
| Separate reviewer session | User-managed | Dove declares read-only scope and Markdown return expectations; the user chooses and configures the reviewer session or person. |
| Review preservation | Implemented | The corresponding Review document preserves direct critiques or returned Markdown faithfully; author handling is added only when requested and substantive response remains Rebuttal work. |
| Native reviewing agent | Removed from Dove | Dove does not package a separate user-switchable reviewing agent. |
| Separate reviewer independence proof | Not established | Host labels, local separation, and return provenance are not proof of independence. |

## Status and Auto

| Capability | Status | Boundary |
|---|---|---|
| Missing overview | Natural warning | Status reports it plainly and does not create or repair research content. |
| Broken document link | Natural warning | Report the missing path and affected context; do not classify a database state. |
| Status writes | Unavailable | Status is read-only. |
| Ambient Auto | Unavailable | Auto is explicit-only. |
| Auto mainline changes | Judgment boundary | Auto recovers the current mainline from substantive research context, conversation, and project artifacts. An explicit suffix supplies the immediate goal; suffix-free Auto follows the recovered mainline to its real completion condition. It asks only when materially competing directions or a real boundary would change the work; ordinary support work does not silently redefine the direction. |
| Auto submission readiness | Review-gated whole-manuscript judgment | Auto first establishes enough of the scientific, scholarly, venue, source, and required-material basis to choose the next material action. It invokes Dove Review on the current manuscript; `REVISE` keeps Auto working and only the latest current `PASS` permits a submit-ready stop. Material figures must be judged in the real manuscript layout against their evidence job, captions, claims, source data or selection metadata, and rendering logic rather than merely counted or opened. Figure is not another mandatory gate, but actual drawing, redrawing, figure revision, generation, captioning, or figure-specific validation must run through `dove:figure`, followed by another Review after material changes. |
| Auto completion | Goal/mission boundary | Auto compares each substantive deliverable against the goal and continues while another material action can still change the outcome. For submission readiness, completion requires the latest current Review `PASS`; an old verdict, review document, summary, validation result, Markdown update, or generated file is not completion. If Review invocation or required grounding is unavailable, Auto reports the real boundary rather than claiming readiness. |
| Hidden autonomous service | Unavailable | Auto is foreground host work, not a daemon, scheduler, MCP server, or hidden session store. |

## Installation and lifecycle

| Capability | Status | Boundary |
|---|---|---|
| Exact user installation | Implemented | Installs `dove` on `PATH` from a trusted exact artifact. |
| Claude project initialization | Implemented | Installs generated Claude resources, the Dove agent, SessionStart/prompt/stop hooks, current installation metadata, and the default research Markdown tree. |
| Project paper MCP declaration | Implemented for Claude | Init/update safely own only `.mcp.json#/mcpServers/dove-paper-search`, preserve unrelated servers, and never write approval, trust, or credentials. |
| Manifest revision | Implemented | `.dove/install/manifest.json` uses revision `2.0`. |
| Dove feedback document | Host-maintained Markdown | `.dove/install/DOCTOR.md` records user feedback when Dove is explicitly named, plus actual Dove failures. Reusable feedback about ordinary research or collaboration without an explicit Dove reference belongs in Lessons. It has no JSON state, issue lifecycle, fixed template, or scientific authority. |
| Installation/file safety hashes | Internal | Protect managed software bytes; never used as research evidence or authority. |
| Automatic integration hot sync | Implemented for initialized Claude projects | SessionStart refreshes valid same-package revision-2.0 managed integration from the user CLI on `PATH`; UserPromptSubmit bridges projects created before SessionStart. It never touches `.dove/research/**`, never uses Stop or Complete Reinstall, and guarantees on-disk refresh rather than same-session host reload. |
| Explicit integration update | Implemented | `dove update` refreshes recognized integration, creates missing summaries, completes current standard navigation in `RESEARCH.md` and `lessons/LESSONS.md`, and replaces all six package-managed built-in Lessons themes with current package content. Other research documents remain researcher-owned. |
| Deprecated Lessons cleanup | Direct for recognized package-managed artifacts | Update removes `.dove/research/LESSONS.md` and `lessons/additional-lessons.md` without adding a migration or runtime fallback and removes the Additional migrated Lessons link. |
| legacy JSON research records export | Explicit | `dove export-research` writes the new summaries and topic directories, preserves legacy `.dove/LESSONS.md` as researcher-owned `lessons/imported-lessons.md`, supports an existing default tree, and archives original JSON bytes under `.dove/archive/...`. |
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
| Adapter generation checks | Implemented | Protect canonical projection completeness, not host readiness or actual runtime `dove:review` invocation; only the host tool trace can establish that call. |
| Software validation | Implemented | Generated-resource checks, package validation, and real CLI runs provide bounded software evidence. |
| Scientific certification | Unavailable | Validation does not prove claims, completion, reproducibility, acceptance, independent review, or Dove research quality. |

> Current package release: Dove `3.0.0`. See [Packaging](PACKAGING.md) for release boundaries and [Usage](USAGE.md) for working conventions.

## Stable Markdown and project file boundaries

- Research Markdown has no format or schema version. Future organization changes use ordinary host file operations to rename, move, relink, or consolidate documents while preserving substantive content, failures, limitations, and uncertainty; they do not create a migration framework or runtime fallback.
- Requested artifacts such as drafts, figures, experiment documents, and revisions are created or modified when the task requires them. Additional Dove research Markdown is maintained when the user explicitly asks to record, update, or save it, when results clearly change the research mainline, conclusion, decision, or priority, or when durable recovery and evidence value make the work worth preserving.
- Dove project file operations use cross-platform Node path containment, ordinary-file and symbolic-link checks, same-directory temporary writes, expected-state rechecks, and transactional rollback; they do not require Linux `/proc` features.
- Complete Reinstall displays the current deletion and replacement paths, defaults to No, and after confirmation rereads the project and executes the current plan.
- `dove doctor` is a read-only developer diagnostic. Users normally do not need it; the host writes relevant Dove feedback directly to ordinary `DOCTOR.md`.
