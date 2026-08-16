# Component Guidelines

> Skill, role, adapter, document, CLI, and lifecycle responsibilities for Dove 3.0.0.

---

## Overview

There are no browser components. Treat each Skill, role, generated adapter, research-document convention, CLI command, lifecycle operation, and final user response as a small component over shared behavior.

Do not rebuild the retired structured research architecture inside Markdown. Dove 3 has no Dove-owned research-state MCP tools, Research Format runtime, entity database, public research DTOs, or typed research-error vocabulary. The external paper-acquisition MCP is optional host tooling, not research state.

## Contract Sources

- Canonical Skill workflow sources define the ten flat Skills and host-safety policy.
- Role sources define Planner, Builder/Author, and Reviewer responsibilities.
- Ambient policy defines conservative non-slash routing and keeps Auto explicit-only.
- Final-response policy defines natural user-facing synthesis.
- Adapter generation projects canonical workflows into host formats.
- CLI, installation, Doctor, export, and file-transaction modules own software lifecycle behavior.
- Public documentation and both Trellis spec trees must describe the same architecture.

## Public Layers

1. A **Skill** is a user-facing host workflow.
2. A **role** defines responsibility, not authority or identity.
3. A **research document** is ordinary researcher-owned Markdown.
4. A **project artifact** is substantive host-produced work such as code, data, a draft, figure, or report.
5. An **installation resource** is software-owned project integration recorded by manifest revision `2.0`.
6. **Dove feedback** is ordinary host-maintained Markdown about explicit user feedback and actual Dove failures.
7. An **archive** preserves original legacy JSON bytes from an explicitly authorized export.

These layers do not map one-to-one. A Skill may read several documents and ordinary artifacts; several Skills may contribute to one document.

## Skill Contract

- Public Skills remain flat: `research`, `status`, `source`, `experiment`, `draft`, `figure`, `review`, `rebuttal`, `lessons`, and `auto`.
- Every Skill accepts optional user text and uses host file, coding, execution, and research tools directly.
- Bounded Skills do not create a document merely because they were invoked.
- `research` completes one bounded pass; `auto` is the explicit multi-round mode.
- Ambient routing never selects Auto.
- Status is read-only and treats a missing overview or broken link as a natural document fact.
- Experiment follows the actual request: design-only work stops before execution, existing results are analyzed directly, retrospective records are labeled honestly, and newly executed work writes a prospective plan before appending actual results to the same Experiment document.
- Review follows the requested preparation, faithful return import, or context inspection; the separate Reviewer remains user-managed, scoped to declared artifacts, read-only, and Markdown-returning.
- Draft, Figure, Rebuttal, and substantive analysis create or revise ordinary project artifacts.
- Adapters are thin generated projections and contain no direct research service dependency, shell research fallback, or duplicate document schema.

## Research Document Contract

- `.dove/research/RESEARCH.md` is the concise overview and navigation document, not a machine index.
- Each research directory owns one human-maintained summary: `MISSIONS.md`, `EXPERIMENTS.md`, `SOURCES.md`, `REVIEWS.md`, `CLAIMS.md`, or `lessons/LESSONS.md`.
- Six package-default Lessons themes live under `lessons/`; they are fallible advisory Markdown and never evidence.
- Other research files use human-readable names, useful prose, and ordinary links inside the corresponding directories.
- Missions may preserve bounded goals, work, failures, conclusions, limitations, and next branches in a natural structure.
- Sources may preserve citation details, verification notes, conditions, conflicts, and limitations.
- Claims remain appropriately scoped prose, tables, or dedicated documents when useful; there is no Claim store.
- Do not require fixed headings, frontmatter, generated IDs, enums, hashes, an index file shape, or stored counts.

## Experiment Component

Follow the actual experiment request:

1. for design-only work, produce an executable plan and stop before execution;
2. for a new experiment that will be executed, write what it tests and how the result will be judged, execute with normal host tools, and append the actual result, material failures or deviations, and interpretation evidence to that same document;
3. for analysis of existing results, work directly from their actual provenance; and
4. for retrospective recording, label the record honestly rather than reconstructing a prospective plan.

State what the evidence supports and cannot establish.

## Review Component

Follow the requested Review operation:

1. for preparation, record purpose, relevant project-relative artifact paths, scope limits, rubric, and a self-contained prompt, then return those materials for a separate Reviewer chosen and managed by the user;
2. for import, locate the corresponding Review document and preserve the actual user-obtained Markdown faithfully with a clear boundary from existing text; and
3. for inspection, read and report existing Review context without creating a new document or handoff.

Do not automatically mix author response or revision into import. Add author interpretation only when requested; substantive response and changes remain Rebuttal work. The native Reviewer role separates responsibility but does not prove reviewer identity or independence. Dove never launches or substitutes for the separate Reviewer.

## Primary Responsibilities

- Planner clarifies the goal and evidence needed when planning is useful.
- Builder/Author performs the substantive research, coding, experiments, writing, figures, revisions, and author-side rebuttal.
- Reviewer reads only the exact declared artifact scope, makes no edits, and returns Markdown to the user-managed exchange.

Passing checks, receiving a review, or writing a conclusion does not establish scientific correctness, completion, acceptance, or independence.

## Project Integration and Doctor

Claude Code remains the supported project initialization path. Generated adapters for other host formats are canonical projections, not a readiness guarantee.

Project initialization creates software integration, `.dove/install/manifest.json`, and the complete default research Markdown tree in one transaction; research paths are not manifest-managed resources. Claude integration also declares only `.mcp.json#/mcpServers/dove-paper-search` and a hidden support Skill for pinned external paper acquisition. Dove does not install its runtime, write credentials, or approve project trust. Optional ordinary `DOCTOR.md` feedback about Dove itself remains under `.dove/install/`; there is no Doctor JSON state, issue lifecycle, research telemetry, or scientific health score. Installation hashes protect managed bytes only.

Project update creates each missing default file from complete package content; existing defaults preserve user bytes and receive only exact missing canonical paragraphs or navigation lines, while ordinary topic documents remain untouched. Complete Reinstall is the confirmed destructive reset: its preview shows deletions and existing files that will be replaced, then it deletes custom Dove research and old archives and rebuilds the default tree while preserving ordinary project files. `export-research` is a separately authorized one-time legacy JSON research records-to-Markdown conversion with original-byte archival, additive output into an existing default tree, and no v1 or runtime fallback.

## Review Checklist

- Are Skill, role, adapter, document, project artifact, installation resource, Dove feedback, and archive terms used correctly?
- Does the host perform substantive work rather than only document maintenance?
- Is Status strictly read-only and tolerant of absent or broken navigation?
- Is Auto explicit-only and bounded by the documented mainline?
- Does the same Experiment document contain plan and actual result in the correct order?
- Does the corresponding Review document preserve preparation and the actual return, with author handling added only when requested?
- Is Reviewer scope exact, read-only, user-managed, and Markdown-returning without independence claims?
- Does research Markdown remain natural rather than becoming a disguised schema?
- Are lifecycle, export, reinstall, and ordinary-file boundaries preserved?
- Are the two Trellis spec trees byte-identical?

## Stable Markdown and project file boundaries

- Research Markdown has no format or schema version. Future organization changes use ordinary host file operations to rename, move, relink, or consolidate documents while preserving substantive content, failures, limitations, and uncertainty; they do not create a migration framework or runtime fallback.
- Requested artifacts such as drafts, figures, experiment documents, and revisions are created or modified when the task requires them. Additional Dove research Markdown is maintained only when the workflow requires it or the work creates durable research value.
- Dove project file operations use cross-platform Node path containment, ordinary-file and symbolic-link checks, same-directory temporary writes, expected-state rechecks, and transactional rollback; they do not require Linux `/proc` features.
- Complete Reinstall displays the current deletion and replacement paths, defaults to No, and after confirmation rereads the project and executes the current plan.
- `DOCTOR.md` is ordinary host-maintained Dove feedback, without JSON projection, issue lifecycle, or CLI ownership.
