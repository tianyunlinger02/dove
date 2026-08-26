# Type Safety

> Software contracts, path safety, CLI boundaries, and research-document non-schema rules for Dove 3.0.0.

---

## Overview

Dove uses Node.js ESM JavaScript. Runtime safety applies to software-owned boundaries such as package metadata, CLI parsing, installation manifests, managed paths, lifecycle plans, generated inventories, and export authorization.

Research meaning is not a runtime type system. Ordinary Markdown must not acquire a replacement schema, DTO layer, typed research errors, generated IDs, or machine authority.

## Software Contract Sources

- `package.json` and package metadata define package identity and Node requirements.
- The project installation manifest implementation defines revision `2.0` and managed-resource metadata.
- CLI parsing defines the supported command and option inventory.
- Project installation and file-transaction modules enforce contained software writes and conflict handling.
- The canonical Dove agent persona and Skill workflow sources define workflow inventory for adapter generation.
- Build scripts define the library, CLI, and hook bundles.
- Export code defines the supported legacy JSON input boundary, archival behavior, confirmation or authorization boundary, and Markdown output.

No research MCP definitions or Research Format schema belong in the Dove 3 contract surface.

## Required Software Validation

- Package name and release version are valid and explicit.
- Node.js `>=22` remains the supported runtime.
- CLI parsing accepts only `init`, `update`, `reinstall`, `doctor`, `export-research`, and `hook` with their declared options.
- The CLI does not expose `mcp` or `migrate-research`.
- Installation manifests use revision `2.0` and reject unsupported or ambiguous software state.
- Project roots and Dove-managed paths reject traversal, escaping paths, and unsafe symlink use where Dove owns the boundary.
- Shared configuration preserves unrelated fields.
- Managed-resource digests detect changed installation bytes without becoming public research evidence.
- File-set changes verify preconditions and avoid partial promotion.
- Generated adapters match the ten-Skill and Dove-agent canonical sources.
- Package output contains exactly the declared library, CLI, and hook runtime bundles.
- Hook parsing distinguishes `SessionStart`, `UserPromptSubmit`, and `Stop`; lifecycle sync validates the exact initialized project before writes, and the Stop continuation guard prevents repeated summaries.
- Real research export requires separate user authorization.
- Export accepts supported legacy Dove JSON research records only, archives the original bytes under `.dove/archive/...`, and does not install a runtime fallback.
- Complete Reinstall requires an explicit confirmed destructive plan whose default is No.

## Research Markdown Boundary

Research content under `.dove/research/` is ordinary UTF-8 Markdown. Software may enforce only genuine file-safety boundaries needed to read or write a selected project file. It must not validate research meaning through a fixed document shape.

Allowed conventions include:

- researcher-owned root `RESEARCH.md` overview and navigation;
- one researcher-owned summary in each default research directory;
- six package-managed built-in Lessons theme files under `lessons/`; and
- researcher-owned human-named linked topic documents.

Do not require or synthesize:

- fixed headings or section order;
- frontmatter;
- generated document, Mission, Source, Experiment, Claim, or Review IDs;
- research enums or status vocabularies;
- machine indexes or stored inventory counts;
- research fingerprints or hashes; or
- a mandatory Markdown template.

An absent overview is normal. A broken Markdown link is reported naturally and does not become a typed invalid-research-state error.

## Workflow Invariants Without a Database

Some semantic order and responsibility boundaries still matter even though documents are untyped:

- prospective experiment planning is written before execution;
- actual experiment results are appended to the same document;
- direct reviewer-perspective critique stays scoped and does not claim independent external review;
- review purpose, exact path scope, limits, and prompt precede any separate external exchange;
- any separate reviewer remains user-managed, read-only, and Markdown-returning;
- the actual user-obtained return is preserved in the corresponding Review document, and author handling is added only when requested;
- Auto is explicit-only multi-round research, recovers the current mainline from substantive context, and asks only when a competing direction or real boundary changes the work; and
- Status performs no writes.

Protect these through canonical workflow order, generated-resource validation, real interface checks, and semantic review. Do not enforce them by inventing an entity database.

## Version and Lifecycle Boundaries

- Package release: `3.0.0`.
- Installation manifest revision: `2.0`.
- Supported export source: legacy JSON research state.
- Unsupported export source: v1 research state.
- Runtime research source: ordinary Markdown only.
- Runtime fallback to old JSON: none.

Project update creates missing summaries, completes current standard navigation only in `RESEARCH.md` and `lessons/LESSONS.md`, replaces each package-managed built-in Lessons theme with current package content, and deletes only the recognized deprecated package-managed Lessons artifacts `.dove/research/LESSONS.md` and `lessons/additional-lessons.md` without migration or fallback. It removes the Additional migrated Lessons link. Other research documents, including explicit-export `lessons/imported-lessons.md`, remain researcher-owned. Complete Reinstall previews deletions and replacements, then after default-No confirmation deletes custom Dove research and old archives, replaces existing default research files, rebuilds the complete default tree, and preserves ordinary project files.

## Machine and Human Language

Final conversation policy defaults to natural Chinese unless the user requests another language or format. Source code names, CLI commands, package versions, manifest revisions, and project-relative paths remain exact where needed. Research documents use the language and structure appropriate to their human readers.

Validation output must stay software-scoped and must not imply scientific correctness, completion, reproducibility, acceptance, reviewer independence, or Dove research quality.

## Stable Markdown and project file boundaries

- Research Markdown has no format or schema version. Future organization changes use ordinary host file operations to rename, move, relink, or consolidate substantive content; they do not create a migration framework or runtime fallback.
- Requested artifacts such as drafts, figures, experiment documents, and revisions are created or modified when the task requires them. Additional Dove research Markdown is maintained only when the user explicitly asks to record, update, or save it, when results clearly change the research mainline, conclusion, decision, or priority, or when durable recovery and evidence value make the work worth preserving.
- Dove project file operations use cross-platform Node path containment, ordinary-file and symbolic-link checks, same-directory temporary writes, expected-state rechecks, and transactional rollback; they do not require Linux `/proc` features.
- Complete Reinstall displays the current deletion and replacement paths, defaults to No, and after confirmation rereads the project and executes the current plan.
- `DOCTOR.md` is ordinary host-maintained feedback rather than typed Doctor state; it has no fixed schema, IDs, statuses, or counters.
