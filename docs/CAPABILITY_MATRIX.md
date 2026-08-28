# Capability matrix

## Public architecture

| Capability | Status | Boundary |
|---|---|---|
| Package release | Implemented | Dove `3.0.0`, Node.js `>=22`. |
| Dove research agent | Implemented for generated agent surfaces | `.claude/agents/dove.md` defines one complete Dove persona; planning, authoring, and reviewing are not user-switchable Dove agents. |
| Flat Skills | Implemented | `research`, `status`, `source`, `experiment`, `draft`, `figure`, `review`, `rebuttal`, `lessons`, and explicit-only `auto` are capability entrances. |
| Generated adapters | Implemented | Canonical host-format projections; files on disk do not prove registration, readiness, or independent Reviewer status. |
| Runtime CLI | Implemented | `init`, `update`, `reinstall`, `uninstall`, `doctor`, `export-research`, and `hook`. |
| Runtime bundles | Implemented | Three bundles: public library, packaged CLI, and prompt hook. |
| Dove research-state MCP server and tools | Not part of Dove 3 | Dove does not own a research service, tool registry, or hidden research state. |
| External paper acquisition | Claude project support | A hidden support Skill can use project server `dove-paper-search`, pinned to `paper-search-mcp==0.1.4`, for on-demand scholarly search, open download, and full-text reading. |
| Research Format runtime or database | Not part of Dove 3 | Research context is ordinary Markdown rather than machine-owned state. |
| Supported project initialization | Claude Code and DeepSeek Harness | Claude Code receives the complete integration; DSH receives project-local filesystem Skills only. |

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
| `dove.research` | Implemented | Completes one bounded research or project pass; pure judgment follow-ups answer directly without side effects, and Markdown is maintained for explicit record/update/save requests, clear mainline/conclusion/decision/priority changes, or genuinely useful evidence and continuation context. |
| `dove.status` | Implemented | Reads the overview, relevant summaries, and necessary linked context without writes; absence and broken links are reported naturally. |
| `dove.source` | Implemented | The host may discover, retrieve when available, save when useful, read, and verify material with available approved tools; useful source context is recorded in natural Markdown. |
| `dove.experiment` | Implemented | Handles design, requested execution, existing-result analysis, retrospective records, and smallest low-risk diagnostics needed to establish experiment basis; experiment Markdown is maintained when explicitly requested, when results change a research decision, or when preserving evidence and continuation context is genuinely useful. |
| `dove.draft` | Implemented | Drafts, assesses, creates, or revises ordinary project text and artifacts from available evidence when the deliverable requires it. |
| `dove.figure` | Implemented | Owns actual drawing, redrawing, figure revision, generation, captioning, and material figure validation. It establishes each visual's evidence job, checks the real manuscript layout against captions, claims, source data or selection metadata, and rendering logic, and does not treat standalone images or contact sheets as proof of quality. It uses reproducible plotting for quantitative results, an available specialized figure-generation model for method/concept visuals when best suited, image/SVG tools for repair, and repository-local `.claude/tmp/` for scratch renders. |
| `dove.review` | Implemented | Grounds Direct Scientific Review self-check and independent Reviewer Handoff preparation in current official venue requirements and actually inspected relevant published work when they can change the judgment; faithfully imports returns or inspects existing context without unnecessary search or exchange. |
| `dove.rebuttal` | Implemented | Keeps response and requested evidence-backed revision on the author side. |
| `dove.lessons` | Implemented | Reads `lessons/LESSONS.md` and relevant linked themes only if they exist, or naturally maintains researcher-owned Lessons when explicitly asked. Lessons are optional advisory materials, not mandatory package-owned defaults, and source explanation is optional. |
| `dove.auto` | Implemented as a generated instruction contract | Explicit foreground multi-round work that advances the user-confirmed Workspace mainline within user limits; never ambient-selected and never promotes subordinate support work into the research direction. |

## Research documents

| Capability | Status | Boundary |
|---|---|---|
| Research root | Minimal default | `init` creates ordinary Markdown under `.dove/research/`; fresh initialization creates only the researcher-owned `RESEARCH.md` entry and does not synthesize a larger tree. |
| Overview and navigation | Researcher-owned | Root `RESEARCH.md` remains a concise mainline and navigation document when present. Optional summaries may be created naturally when the work needs them; update does not normalize or rewrite existing research Markdown. |
| Directory summaries | Optional researcher-owned materials | `missions/MISSIONS.md`, `experiments/EXPERIMENTS.md`, `sources/SOURCES.md`, `reviews/REVIEWS.md`, `claims/CLAIMS.md`, and `lessons/LESSONS.md` are human-maintained entrances when present, not generated indexes. |
| Lessons | Optional researcher-owned materials | Lessons documents are advisory and may be maintained when explicitly asked; they are not mandatory package-owned defaults. |
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
| Direct Scientific Review self-check | Implemented | `/dove:review` forms a fresh author-side, read-only judgment from the actual full manuscript and established grounding without inheriting Auto's verdict or package summary. It identifies the intended contribution, traces decisive claims to the evidence offered, tests the strongest plausible falsifier or informed-reader objection, and explains the material findings, evidence, consequence, useful response, and natural-language acceptability recommendation. Delivery-only package checks remain subordinate and cannot establish or truncate scientific acceptability. For material figures it inspects reviewer-facing visuals in the real manuscript layout and at realistic final size, comparing captions, nearby claims, source data or selection metadata, and rendering logic; image counts, embedding, file validity, contact sheets, and merely opening images are inventory or superficial evidence only. Direct self-check remains advisory, is not independent external review, and does not control the Workspace mainline or Auto completion. |
| Independent Reviewer Handoff | Host-provided when available | When independent review is requested or Auto reaches author-side submission readiness, Dove prepares a frozen handoff for a genuinely isolated persistent host Agent context. Each round lists only the current full paper, authoritative LaTeX source and compiled output, explicit evidence or supplements, public venue requirements, necessary public related work, and explicit rebuttal, clarification, or change notes. |
| Reviewer session continuity | Host-provided when available | The Reviewer is read-only, persists its own review history across re-review rounds, and never reads author private transcript, unlisted materials, or unstated handoff records. If the host cannot provide equivalent isolation, Dove reports the boundary rather than simulating it. |
| Review preservation | Implemented | The corresponding Review document preserves direct critiques or returned Markdown faithfully; author handling is added only when requested and substantive response remains Rebuttal work. |
| Native reviewing agent | Removed from Dove | Dove does not package a separate user-switchable reviewing agent. |
| Independent review completion | Natural-language only | Submission completion requires author-side sufficiency plus an independent Reviewer acceptability recommendation for the current full version. Scientific acceptability and delivery readiness remain separate, and this is not a score, enum, schema, runtime gate, or controller. |

## Status and Auto

| Capability | Status | Boundary |
|---|---|---|
| Missing overview | Natural warning | Status reports it plainly and does not create or repair research content. |
| Broken document link | Natural warning | Report the missing path and affected context; do not classify a database state. |
| Status writes | Unavailable | Status is read-only. |
| Ambient Auto | Unavailable | Auto is explicit-only. |
| Auto mainline changes | Judgment boundary | Auto reads the user-confirmed Workspace mainline from substantive research context, conversation, and project artifacts, keeps it stable, and uses an explicit suffix only for an immediate in-scope goal. It asks when a material direction or real boundary would change the work; ordinary support work does not silently redefine the direction. |
| Auto submission readiness | Whole-manuscript plus independent review | Auto uses LaTeX as the authoritative manuscript source and primary working format by default, verifies the actual compiled output, and uses another format only when the target venue officially does not provide or accept LaTeX. It judges the latest actual manuscript, evidence, material figures, required materials, and venue context together. Direct Scientific Review self-check and Figure are used when they materially improve the next action. Final submission completion also requires an independent Reviewer acceptability recommendation for the current full version; no score, enum, schema, runtime gate, or earlier recommendation replaces Auto's judgment against the confirmed mainline. |
| Auto completion | Mainline boundary | Auto compares each substantive result with the confirmed mainline and continues while another feasible in-scope action can advance or protect it. It stops only when the mainline or immediate goal is achieved, a material blocker cannot be resolved within it, or a user decision or explicit external boundary is required. A Review recommendation, review document, summary, validation result, Markdown update, generated file, or delivery-only pass does not decide completion. |
| Hidden autonomous service | Unavailable | Auto is foreground host work, not a daemon, scheduler, MCP server, or hidden session store. |

## Installation and lifecycle

| Capability | Status | Boundary |
|---|---|---|
| Exact user installation | Implemented | Installs `dove` on `PATH` from a trusted exact artifact. |
| Claude project initialization | Implemented | Installs generated Claude resources, the Dove agent, SessionStart and prompt hooks, a project status line, current installation metadata, and the minimal researcher-owned `RESEARCH.md` bootstrap. |
| Project paper MCP declaration | Implemented for Claude | Init/update safely own only `.mcp.json#/mcpServers/dove-paper-search`, preserve unrelated servers, and never write approval, trust, or credentials. |
| Manifest revision | Implemented | `.dove/install/manifest.json` uses revision `2.0`. |
| Dove feedback document | Host-maintained Markdown | `.dove/install/DOCTOR.md` records user feedback when Dove is explicitly named, plus actual Dove failures. Reusable feedback about ordinary research or collaboration without an explicit Dove reference belongs in Lessons. It has no JSON state, issue lifecycle, fixed template, or scientific authority. |
| Installation/file safety hashes | Internal | Protect managed software bytes; never used as research evidence or authority. |
| Automatic integration hot sync | Implemented for initialized Claude projects | SessionStart refreshes valid same-package revision-2.0 managed integration from the user CLI on `PATH`; UserPromptSubmit bridges projects created before SessionStart. It never touches `.dove/research/**`, never uses Stop or Complete Reinstall, and guarantees on-disk refresh rather than same-session host reload. |
| Explicit integration update | Implemented | `dove update` refreshes recognized package-managed integration and preserves existing `.dove/research/**` bytes; it does not create missing summaries, complete navigation, or replace Lessons. |
| Retired Stop hook cleanup | Exact managed-fragment cleanup | Update and uninstall remove only the array entry that exactly matches the old Dove-owned Stop hook fragment; user-owned or non-array Stop settings are preserved. |
| legacy JSON research records export | Explicit | `dove export-research` may write explicit conversion output into Markdown summaries and topic directories, preserves legacy `.dove/LESSONS.md` as researcher-owned `lessons/imported-lessons.md`, and archives original JSON bytes under `.dove/archive/...`. |
| v1 conversion | Unavailable | Dove 3 does not convert v1 research state. |
| Runtime fallback to old research state | Unavailable | Normal work reads Markdown only. |
| Real export authorization | Required | Export against real research needs separate user authorization and is not a routine test. |
| Complete Reinstall | Confirmed integration rebuild | Displays deletion and replacement scope and defaults to No; after confirmation rebuilds package-managed integration while preserving `.dove/research/**`, `.dove/install/DOCTOR.md`, and ordinary project files. |
| Path and shared-file safety | Implemented | Lifecycle operations preserve ordinary files and unrelated configuration and stop on unsafe or conflicting managed content. |

## Packaging and validation

| Capability | Status | Boundary |
|---|---|---|
| Library bundle | Implemented | `dist/index.mjs`. |
| CLI bundle | Implemented | `bin/dove-package.mjs`. |
| Prompt-hook bundle | Implemented | `scripts/dove-user-prompt-submit-package.mjs`. |
| Dove MCP server bundle | Unavailable | Dove packages no research MCP runtime or third-party Python source; the project config launches the pinned external package through user-provided `uvx`. |
| Adapter generation checks | Implemented | Protect canonical projection completeness and drift, not host readiness, scientific judgment, real action, or completion. |
| Software validation | Implemented | Generated-resource checks, package validation, and real CLI runs provide bounded software evidence. |
| Scientific certification | Unavailable | Validation does not prove claims, completion, reproducibility, acceptance, independent review, or Dove research quality. |

> Current package release: Dove `3.0.0`. See [Packaging](PACKAGING.md) for release boundaries and [Usage](USAGE.md) for working conventions.

## Stable Markdown and project file boundaries

- Research Markdown has no format or schema version. Future organization changes use ordinary host file operations to rename, move, relink, or consolidate documents while preserving substantive content, failures, limitations, and uncertainty; they do not create a migration framework or runtime fallback.
- Requested artifacts such as drafts, figures, experiment documents, and revisions are created or modified when the task requires them. Additional Dove research Markdown is maintained when the user explicitly asks to record, update, or save it, when results clearly change the research mainline, conclusion, decision, or priority, or when preserving the work's evidence and continuation context is genuinely useful.
- Dove project file operations use cross-platform Node path containment, ordinary-file and symbolic-link checks, same-directory temporary writes, expected-state rechecks, and transactional rollback; they do not require Linux `/proc` features.
- Complete Reinstall displays the current deletion and replacement paths, defaults to No, and after confirmation rereads the project and executes the current plan.
- `dove doctor` is a read-only developer diagnostic. Users normally do not need it; the host writes relevant Dove feedback directly to ordinary `DOCTOR.md`.
