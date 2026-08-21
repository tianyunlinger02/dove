# State Management

> Research Markdown and project installation boundaries for Dove 3.0.0.

---

## Overview

Dove is file-first without treating research as machine-owned state. The host performs substantive work. Researchers preserve useful context in ordinary Markdown, and Dove-owned software metadata remains separate.

There is no Dove research-state MCP service, Research Format marker, entity database, hidden research state machine, or runtime fallback reader in Dove 3. The optional external paper MCP is project tooling and stores no Dove research state.

## Boundary Model

- The **Dove agent** is one complete research persona for host work.
- A **Skill** expresses a capability entrance and host workflow.
- A **research document** is ordinary Markdown. The overview, summaries, and project-specific documents are researcher-owned; six built-in Lessons themes are package-managed.
- A **project artifact** holds substantive work in a normal project path.
- An **installation resource** belongs to Dove-managed project integration.
- **Dove feedback** is ordinary `.dove/install/DOCTOR.md` Markdown maintained by the host when the user explicitly comments on Dove or Dove itself actually fails during use.
- An **export archive** preserves original legacy JSON bytes under `.dove/archive/...` after explicit conversion.

Drafts, figures, code, data, logs, papers, review bundles, and rebuttals remain ordinary project artifacts rather than Dove stores.

## Installation State

`.dove/install/manifest.json` is software installation metadata at revision `2.0`. Package version, installation revision, and the content of research Markdown are separate concerns.

Optional `.dove/install/DOCTOR.md` is ordinary natural-language feedback, not a generated projection. It records explicit user feedback, corrections, complaints, improvement ideas, and actual failures of Dove Skills, hooks, routing, integration, document behavior, or guidance. It has no JSON state, IDs, severity, counters, statuses, or fixed template. Ordinary research uncertainty, project bugs, and external-tool failures stay out. Managed-file digests or hashes protect installation bytes and detect drift; they must never be cited as research evidence, source authority, review integrity, or scientific validation.

Claude Code remains the supported project initialization path. Project initialization installs the Dove agent surface, prompt and stop hooks, the complete default research Markdown tree, and one pinned external paper-acquisition MCP fragment plus hidden support Skill. Dove does not register a research-state service, install the external runtime, approve project trust, write credentials, or claim that default documents are substantive research content.

## Research Documents

Research context lives under `.dove/research/`:

- root `RESEARCH.md` is the researcher-owned concise overview and navigation document;
- missions, experiments, sources, reviews, claims, and lessons each have one researcher-owned directory summary;
- `lessons/` begins with six package-managed built-in advisory themes; and
- other files, including explicit-export `lessons/imported-lessons.md`, are researcher-owned human-named linked topic documents in the corresponding directory.

This is recommended organization, not a schema. Do not require fixed headings, frontmatter, generated IDs, enums, machine indexes, stored counts, fingerprints, or research hashes.

### Overview and links

- Keep `RESEARCH.md` useful for recovering the current mainline, material progress, important conclusions and limits, linked work, and next priorities.
- Update it only for material changes, not as a run log.
- An absent overview is normal.
- A missing or broken link is an ordinary document problem. Report the path and affected context naturally; do not invalidate the whole research area.

### Topic documents

- Mission documents may preserve bounded goals, competing explanations, substantive work, current conclusions, decisions, and next branches in a natural structure.
- Source documents may preserve citations or URLs and what was actually inspected and learned.
- A central experiment serves a real problem, key uncertainty, or route decision. When newly executed central work needs recording, one Experiment document holds the prospective plan and later actual execution and results; design-only work stops before execution, existing results are analyzed directly, and retrospective records remain retrospective.
- A prepared Review document contains purpose, relevant declared artifact paths, limits, and prompt; an actual user-obtained Markdown return is preserved faithfully in the corresponding document, while author handling is added only when requested.
- Claims remain scoped prose, tables, or dedicated human-readable documents when useful. There is no Claim store.
- Lessons remain fallible advisory prose and are never evidence or a completion certificate.

## Mutation Rules

- Read only the documents needed for the task.
- Write only when the user explicitly asks to record, update, or save Dove research context, or when results clearly change the research mainline, conclusion, decision, or priority.
- Prefer updating the existing relevant topic document over creating duplicates.
- Use new results to continue, change, or stop the research route.
- Never synthesize a prospective experiment plan after execution.
- Never fabricate a reviewer return or overwrite the original return with an author summary.
- Do not normalize researcher documents into a mandatory template.

Status performs no mutations. Ambient routing does not create research documents merely because a prompt was routed.

## Auto Boundary

Auto is explicit-only and operates in the foreground. It requires an adequately documented current mainline in `RESEARCH.md`. That mainline is read-only for Auto: aligned work and linked documents may advance, but the research direction must not be silently redefined.

If the overview is absent, materially incomplete, or evidence requires a mainline change, Auto returns a recommendation directly unless the user requested a saved artifact, reports the block, and stops. Auto does not create a hidden session store, daemon, scheduler, or research service.

## Review Boundary

The user chooses and manages any separate reviewer. Relevant project-relative artifact paths and scope limits are declared when preparing the review. The reviewer reads only that scope, makes no edits, and returns Markdown. The actual return is preserved faithfully in the corresponding document; author handling is separate unless requested.

A host label, separate local session, or provenance statement does not prove identity or independence.

## Lifecycle Behavior

- `init` creates supported software integration, the Dove agent surface, and the complete default research Markdown tree in one transaction.
- `update` refreshes recognized integration, creates missing summaries, completes current standard navigation only in `RESEARCH.md` and `lessons/LESSONS.md`, and replaces each of the six package-managed built-in Lessons themes with current package content. Each built-in theme carries a plain Markdown notice directing project-specific guidance to a separately named Lesson linked from `lessons/LESSONS.md`. Other research documents remain researcher-owned.
- Deprecated `.dove/research/LESSONS.md` and `lessons/additional-lessons.md` are directly deleted without migration or fallback, and the Additional migrated Lessons link is removed.
- `doctor` reports software and local readability facts without repairing research content; missing summaries are synchronizable defaults rather than corruption.
- `export-research` is a one-time supported legacy JSON research records-to-Markdown conversion. It archives the original legacy JSON bytes under `.dove/archive/...`, writes into the new directory structure even when the default tree exists, preserves legacy `.dove/LESSONS.md` as `lessons/imported-lessons.md`, does not convert v1, and installs no runtime fallback. Real export requires separate user authorization.
- `reinstall` displays the deletion and replacement scope and defaults to No. After confirmation it deletes custom Dove research and old archives, replaces existing default research files, then recreates integration and the current complete default tree while preserving ordinary project files.

## Project File Safety

Project roots and Dove-managed paths must remain contained and unambiguous. Lifecycle operations reject unsafe traversal or symlink use where Dove owns the boundary, preserve ordinary files and unrelated shared-configuration fields, and stop on conflicting or changed managed content. Software changes should be staged and checked before promotion.

## Stable Markdown and project file boundaries

- Research Markdown has no format or schema version. Future organization changes use ordinary host file operations to rename, move, relink, or consolidate substantive content; they do not create a migration framework or runtime fallback.
- Requested artifacts such as drafts, figures, experiment documents, and revisions are created or modified when the task requires them. Additional Dove research Markdown is maintained only when the user explicitly asks to record, update, or save it, or when results clearly change the research mainline, conclusion, decision, or priority.
- Dove project file operations use cross-platform Node path containment, ordinary-file and symbolic-link checks, same-directory temporary writes, expected-state rechecks, and transactional rollback; they do not require Linux `/proc` features.
- Complete Reinstall displays the current deletion and replacement paths, defaults to No, and after confirmation rereads the project and executes the current plan.
- `DOCTOR.md` is ordinary host-maintained Dove feedback, without JSON projection, issue lifecycle, or CLI ownership.
