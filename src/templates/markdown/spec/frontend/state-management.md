# State Management

> Research Markdown and project installation boundaries for Dove 3.0.0.

---

## Overview

Dove is file-first without treating research as machine-owned state. The host performs substantive work. Researchers preserve useful context in ordinary Markdown, and Dove-owned software metadata remains separate.

There is no research MCP service, Research Format marker, entity database, hidden research state machine, or runtime fallback reader in Dove 3.

## Boundary Model

- A **Skill** expresses user intent and host workflow.
- A **role** defines responsibility.
- A **research document** is ordinary Markdown owned by the project and researcher.
- A **project artifact** holds substantive work in a normal project path.
- An **installation resource** belongs to Dove-managed project integration.
- **Doctor state** records bounded local software issues under `.dove/install/`; `DOCTOR.md` presents current problems and limited recent resolutions for people.
- An **export archive** preserves original legacy JSON bytes under `.dove/archive/...` after explicit conversion.

Drafts, figures, code, data, logs, papers, review bundles, and rebuttals remain ordinary project artifacts rather than Dove stores.

## Installation State

`.dove/install/manifest.json` is software installation metadata at revision `2.0`. Package version, installation revision, and the content of research Markdown are separate concerns.

Optional `.dove/install/doctor.json` is machine-facing maintenance state, while `.dove/install/DOCTOR.md` is its readable projection. Managed-file digests or hashes protect installation bytes and detect drift; they must never be cited as research evidence, source authority, review integrity, or scientific validation.

Claude Code remains the supported project initialization path. Project initialization does not register a research MCP server and does not create research content.

## Research Documents

Research context, when maintained, lives under `.dove/research/`:

- `RESEARCH.md` is the recommended concise overview and navigation document;
- `LESSONS.md` is an optional complete advisory document; and
- other files are human-named linked topic documents, optionally grouped into human-chosen folders.

This is recommended organization, not a schema. Do not require fixed headings, frontmatter, generated IDs, enums, machine indexes, stored counts, fingerprints, or research hashes.

### Overview and links

- Keep `RESEARCH.md` useful for recovering the current mainline, material progress, important conclusions and limits, linked work, and next priorities.
- Update it only for material changes, not as a run log.
- An absent overview is normal.
- A missing or broken link is an ordinary document problem. Report the path and affected context naturally; do not invalidate the whole research area.

### Topic documents

- Mission documents may preserve bounded goals, assumptions, competing explanations, evidence needs, work, failures, conclusions, limitations, uncertainty, and next branches in a natural structure.
- Source documents may preserve citations or URLs, what was actually inspected, relevant conditions, conflicts, and limitations.
- One Experiment document contains the prospective plan before execution and the actual execution and results afterward.
- One Review document contains purpose, exact declared path scope, limits, prompt, the actual user-obtained Markdown return, and author handling.
- Claims remain scoped prose, tables, or dedicated human-readable documents when useful. There is no Claim store.
- Lessons remain fallible advisory prose and are never evidence or a completion certificate.

## Mutation Rules

- Read only the documents needed for the task.
- Write only when durable context improves future research recovery.
- Prefer updating the existing relevant topic document over creating duplicates.
- Preserve adverse, null, failed, stopped, and uncertain evidence.
- Never synthesize a prospective experiment plan after execution.
- Never fabricate a reviewer return or overwrite the original return with an author summary.
- Do not normalize researcher documents into a mandatory template.

Status performs no mutations. Ambient routing does not create research documents merely because a prompt was routed.

## Auto Boundary

Auto is explicit-only and operates in the foreground. It requires an adequately documented current mainline in `RESEARCH.md`. That mainline is read-only for Auto: aligned work and linked documents may advance, but the research direction must not be silently redefined.

If the overview is absent, materially incomplete, or evidence requires a mainline change, Auto records or returns a recommendation, reports the block, and stops. Auto does not create a hidden session store, daemon, scheduler, or research service.

## Review Boundary

The user chooses and manages the separate Reviewer. The exact project-relative artifact paths are declared in the Review document. The Reviewer reads only that scope, makes no edits, and returns Markdown. The actual return is preserved in the same document before author handling is added.

A native Reviewer role, separate local session, or provenance statement does not prove identity or independence.

## Lifecycle Behavior

- `init` creates supported software integration only.
- `sync` and `upgrade` refresh recognized integration without modifying `.dove/research/` documents.
- `doctor` reports software and local readability facts without repairing research content.
- `export-research` is a one-time supported legacy JSON research records-to-Markdown conversion. It archives the original legacy JSON bytes under `.dove/archive/...`, does not convert v1, and installs no runtime fallback. Real export requires separate user authorization.
- `reinstall` displays the destructive scope and defaults to No. After confirmation it deletes Dove research and old archives, then recreates integration as applicable while preserving ordinary project files.

## Project File Safety

Project roots and Dove-managed paths must remain contained and unambiguous. Lifecycle operations reject unsafe traversal or symlink use where Dove owns the boundary, preserve ordinary files and unrelated shared-configuration fields, and stop on conflicting or changed managed content. Software changes should be staged and checked before promotion.
