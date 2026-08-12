# Component Guidelines

> Skill, role, adapter, document, CLI, and lifecycle responsibilities for Dove 3.0.0.

---

## Overview

There are no browser components. Treat each Skill, role, generated adapter, research-document convention, CLI command, lifecycle operation, and final user response as a small component over shared behavior.

Do not rebuild the retired structured research architecture inside Markdown. Dove 3 has no research MCP tools, Research Format runtime, entity database, public research DTOs, or typed research-error vocabulary.

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
6. A **Doctor issue** is bounded local software-maintenance state.
7. An **archive** preserves original legacy JSON bytes from an explicitly authorized export.

These layers do not map one-to-one. A Skill may read several documents and ordinary artifacts; several Skills may contribute to one document.

## Skill Contract

- Public Skills remain flat: `research`, `status`, `source`, `experiment`, `draft`, `figure`, `review`, `rebuttal`, `lessons`, and `auto`.
- Every Skill accepts optional user text and uses host file, coding, execution, and research tools directly.
- Bounded Skills do not create a document merely because they were invoked.
- `research` completes one bounded pass; `auto` is the explicit multi-round mode.
- Ambient routing never selects Auto.
- Status is read-only and treats a missing overview or broken link as a natural document fact.
- Experiment planning is written before execution, and actual results are appended to the same Experiment document.
- Review remains user-managed, exact-path scoped, read-only for the Reviewer, and returned as Markdown.
- Draft, Figure, Rebuttal, and substantive analysis create or revise ordinary project artifacts.
- Adapters are thin generated projections and contain no direct research service dependency, shell research fallback, or duplicate document schema.

## Research Document Contract

- `.dove/research/RESEARCH.md` is the recommended concise overview and navigation document, not a machine index.
- `.dove/research/LESSONS.md` is optional, complete advisory Markdown and is never evidence.
- Other research files use human-readable names, useful prose, and ordinary links.
- Folders such as `missions/`, `sources/`, `experiments/`, and `reviews/` are optional organization, not stores.
- Missions may preserve bounded goals, work, failures, conclusions, limitations, and next branches in a natural structure.
- Sources may preserve citation details, verification notes, conditions, conflicts, and limitations.
- Claims remain appropriately scoped prose, tables, or dedicated documents when useful; there is no Claim store.
- Do not require fixed headings, frontmatter, generated IDs, enums, hashes, an index file shape, or stored counts.

## Experiment Component

Use one readable Experiment document for the whole lifecycle:

1. write the prospective question, competing explanations, protocol, inputs, comparisons, metrics, discriminating observations, stop conditions, expected artifacts, cost, risk, and failure value before execution;
2. execute with normal host tools; and
3. append actual procedure, observations, denominators, exclusions, deviations, failures, limitations, uncertainty, and implications to that same document.

Preserve positive, negative, null, mixed, failed, and stopped outcomes. Never reconstruct the prospective plan after observing the result.

## Review Component

Use one readable Review document for the whole exchange:

1. record purpose, exact project-relative artifact paths, scope limits, rubric, and a self-contained prompt;
2. return those declared paths and prompt to the user;
3. let the user choose and manage the separate Reviewer;
4. require read-only review and a Markdown return;
5. preserve the actual user-obtained return faithfully in the same document; and
6. record author interpretation, response, revisions, unresolved issues, and follow-up.

The native Reviewer role helps separate responsibilities but does not prove reviewer identity or independence. Dove never launches, impersonates, silently substitutes, or certifies the Reviewer.

## Primary Responsibilities

- Planner defines goals, scope, evidence needs, assumptions, unknowns, alternatives, and stop conditions.
- Builder/Author performs substantive retrieval, analysis, coding, experiments, writing, figures, revisions, and author-side rebuttal.
- Reviewer reads only the exact declared artifact scope, makes no edits, and returns Markdown to the user-managed exchange.

Passing checks, receiving a review, or writing a conclusion does not establish scientific correctness, completion, acceptance, or independence.

## Project Integration and Doctor

Claude Code remains the supported project initialization path. Generated adapters for other host formats are canonical projections, not a readiness guarantee.

Project initialization creates software integration and `.dove/install/manifest.json`; it does not create research content or register a research MCP server. Doctor machine state and readable `DOCTOR.md` remain under `.dove/install/` and must not become research telemetry or a scientific health score. Installation hashes protect managed bytes only.

Sync and Upgrade preserve research documents. Complete Reinstall is the confirmed destructive reset and deletes Dove research and old archives while preserving ordinary project files. `export-research` is a separately authorized one-time legacy JSON research records-to-Markdown conversion with original-byte archival and no v1 or runtime fallback.

## Review Checklist

- Are Skill, role, adapter, document, project artifact, installation resource, Doctor state, and archive terms used correctly?
- Does the host perform substantive work rather than only document maintenance?
- Is Status strictly read-only and tolerant of absent or broken navigation?
- Is Auto explicit-only and bounded by the documented mainline?
- Does the same Experiment document contain plan and actual result in the correct order?
- Does the same Review document preserve preparation, actual return, and author handling?
- Is Reviewer scope exact, read-only, user-managed, and Markdown-returning without independence claims?
- Does research Markdown remain natural rather than becoming a disguised schema?
- Are lifecycle, export, reinstall, and ordinary-file boundaries preserved?
- Are the two Trellis spec trees byte-identical?
