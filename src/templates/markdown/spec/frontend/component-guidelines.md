# Component Guidelines

> Dove agent, Skill, adapter, document, CLI, and lifecycle responsibilities for Dove 3.0.0.

---

## Overview

There are no browser components. Treat the Dove agent persona, each Skill, generated adapter, research-document convention, CLI command, lifecycle operation, and final user response as a small component over shared behavior.

Do not rebuild the retired structured research architecture inside Markdown. Dove 3 has no Dove-owned research-state MCP tools, Research Format runtime, entity database, public research DTOs, or typed research-error vocabulary. The external paper-acquisition MCP is optional host tooling, not research state.

## Contract Sources

- The canonical Dove agent persona defines the shared research behavior.
- Canonical Skill workflow sources define the ten flat Skills and host-safety policy.
- Ambient policy defines conservative non-slash routing and keeps Auto explicit-only.
- Final-response policy defines natural user-facing synthesis.
- Adapter generation projects canonical workflows into host formats.
- CLI, installation, Doctor, export, and file-transaction modules own software lifecycle behavior.
- Public documentation and both Trellis spec trees must describe the same architecture.

## Public Layers

1. The **Dove agent** is one complete research persona, not a planning/authoring/reviewing switchboard.
2. A **Skill** is a capability entrance for that persona.
3. A **research document** is ordinary Markdown; the overview, summaries, and project-specific documents are researcher-owned, while six built-in Lessons themes are package-managed.
4. A **project artifact** is substantive host-produced work such as code, data, a draft, figure, or report.
5. An **installation resource** is software-owned project integration recorded by manifest revision `2.0`.
6. **Dove feedback** is ordinary host-maintained Markdown about explicit user feedback and actual Dove failures.
7. An **archive** preserves original legacy JSON bytes from an explicitly authorized export.

These layers do not map one-to-one. A Skill may read several documents and ordinary artifacts; several Skills may contribute to one document. Planning, authoring, and reviewing labels are not public Dove personas.

## Skill Contract

- Public Skills remain flat: `research`, `status`, `source`, `experiment`, `draft`, `figure`, `review`, `rebuttal`, `lessons`, and `auto`.
- Every Skill accepts optional user text and uses the same Dove persona with available and approved host file, coding, execution, writing, figure, and research tools directly.
- Bounded Skills do not create a document merely because they were invoked.
- `research` completes one bounded pass; `auto` is the explicit multi-round mode.
- Ambient routing never selects Auto.
- Status is read-only and treats a missing overview or broken link as a natural document fact.
- Experiment follows the actual request: a central experiment first serves a real problem, key uncertainty, or route decision; when that basis is missing, Dove pauses central design and inspects actual project material, relevant sources, or a smallest low-risk diagnostic instead of inventing a substitute experiment or merely stopping at the gap. Design-only work stops before execution, existing results are analyzed directly, retrospective records remain retrospective, and newly executed work writes a prospective plan before appending actual results to the same Experiment document when recording is needed.
- Review follows the requested direct reviewer-perspective critique, separate handoff preparation, faithful return import, or context inspection; any separate reviewer remains user-managed, scoped to declared artifacts, read-only, and Markdown-returning.
- Draft, Figure, Rebuttal, and substantive analysis create or revise ordinary project artifacts.
- Adapters are thin generated projections and contain no direct research service dependency, shell research fallback, or duplicate document schema.

## Research Document Contract

- `.dove/research/RESEARCH.md` is the concise overview and navigation document, not a machine index.
- Each research directory owns one human-maintained summary: `MISSIONS.md`, `EXPERIMENTS.md`, `SOURCES.md`, `REVIEWS.md`, `CLAIMS.md`, or `lessons/LESSONS.md`.
- Six package-managed built-in Lessons themes live under `lessons/`; update replaces each whole file with current package content. Each carries a plain notice directing project-specific guidance to a separately named Lesson linked from `lessons/LESSONS.md`.
- Other research files, including explicit-export `lessons/imported-lessons.md`, are researcher-owned and use human-readable names, useful prose, and ordinary links inside the corresponding directories.
- Missions may preserve bounded goals, substantive work, current conclusions, decisions, and next branches in a natural structure.
- Sources may preserve citation details and what was actually inspected and learned.
- Claims remain appropriately scoped prose, tables, or dedicated documents when useful; there is no Claim store.
- Do not require fixed headings, frontmatter, generated IDs, enums, hashes, an index file shape, or stored counts.

## Experiment Component

Follow the actual experiment request:

1. for design-only work, produce an executable plan and stop before execution;
2. before treating a new experiment as central, establish the real problem, key uncertainty, or route decision it should resolve; if that basis is missing, pause central experiment design and inspect the actual project material, relevant sources, or smallest low-risk diagnostic needed to investigate the problem rather than inventing a substitute experiment or stopping at the missing basis;
3. for a new experiment that will be executed, write what it tests and how the result will be judged, execute with normal host tools, and append the actual result and any deviation that changes its interpretation to that same document;
4. for analysis of existing results, work directly from those results; and
5. for retrospective recording, keep the record retrospective rather than reconstructing a prospective plan.

Use the result to continue, change, or stop the route.

## Review Component

Follow the requested Review operation:

1. before direct reviewer-perspective critique or separate handoff preparation, establish the external review context that can change the judgment: use current official venue sources for applicable formal requirements and inspect a small, discriminating set of relevant published work for novelty, positioning, evidence norms, experiment presentation, and reader expectations; distinguish material merely found from material retrieved, inspected, and actually used, and do not replace official rules with published practice or require a fixed paper count or checklist;
2. for direct critique, test the contribution, novelty, claims, evidence, method, experiment conditions, limitations, writing clarity, and likely reader confusion against that grounding, then return a scoped Markdown critique without claiming independent external review;
3. for separate handoff preparation, record purpose, relevant project-relative artifact paths, scope limits, the established grounding or access boundary, rubric, and a self-contained prompt, then return those materials for a separate reviewer chosen and managed by the user;
4. for import, locate the corresponding Review document and preserve the actual user-obtained Markdown faithfully with a clear boundary from existing text, without triggering external search merely because Review was invoked; and
5. for inspection, read and report existing Review context without creating a new document, handoff, or unnecessary external search.

Do not automatically mix author response or revision into import. Add author interpretation only when requested; substantive response and changes remain Rebuttal work. Dove does not package a native user-switchable reviewing role, does not launch or certify a separate reviewer, and does not treat direct reviewer-perspective critique as independent external review.

## Dove Agent Behavior

- Start from the real research question, current mainline, external context, user need, key uncertainty, and decision that matters.
- Use hunches and first impressions as hypotheses, not decisions, and treat user preferences as tradeoff signals rather than rigid rules.
- Bring research drive: do not stop at admitting limits; turn gaps into sharp hypotheses, discriminating evidence to seek, or concrete next moves that advance the mainline while keeping exploration aimed rather than diffuse.
- Treat rigor, novelty, experiments, validation, engineering, writing, review, documents, and preferences as layered means rather than equal goals.
- Act from evidence, task risk, user preference, and the research mainline without rushing into aggressive execution or over-defending.
- Do not let lower-level artifacts simulate higher-level research progress.
- For submission readiness, distinguish a promising scientific core from an actually submit-ready manuscript. Judge the whole paper and required materials against the target venue, treat major scientific or scholarly revision needs as blockers to a submit-ready verdict, and reopen an earlier verdict when broader evidence or grounded review contradicts it.

Passing checks, receiving a review, or writing a conclusion does not establish scientific correctness, completion, acceptance, or independence.

## Project Integration and Doctor

Claude Code remains the supported project initialization path. Generated adapters for other host formats are canonical projections, not a readiness guarantee.

Project initialization creates software integration, `.dove/install/manifest.json`, and the complete default research Markdown tree in one transaction; research paths are not manifest-managed resources. Claude integration also declares only `.mcp.json#/mcpServers/dove-paper-search` and a hidden support Skill for pinned external paper acquisition. Dove does not install its runtime, write credentials, or approve project trust. Optional ordinary `DOCTOR.md` feedback about Dove itself remains under `.dove/install/`; there is no Doctor JSON state, issue lifecycle, research telemetry, or scientific health score. Installation hashes protect managed bytes only.

Project update creates missing summaries, completes current standard navigation only in `RESEARCH.md` and `lessons/LESSONS.md`, replaces all six package-managed built-in Lessons themes with current package content, and deletes only the recognized deprecated package-managed Lessons artifacts `.dove/research/LESSONS.md` and `lessons/additional-lessons.md` without migration or fallback. It removes the Additional migrated Lessons link. Other research documents remain researcher-owned. Complete Reinstall is the confirmed destructive reset: its preview shows deletions and existing files that will be replaced, then it deletes custom Dove research and old archives and rebuilds the default tree while preserving ordinary project files. `export-research` is a separately authorized one-time legacy JSON research records-to-Markdown conversion with original-byte archival, output into an existing default tree, and no v1 or runtime fallback.

## Review Checklist

- Are Dove agent, Skill, adapter, document, project artifact, installation resource, Dove feedback, and archive terms used correctly?
- Does the host perform substantive work rather than only document maintenance?
- Is Status strictly read-only and tolerant of absent or broken navigation?
- Is Auto explicit-only, able to recover the current mainline from substantive context, conversation, and project artifacts, and unlikely to promote subordinate support work into the research direction?
- Does the same Experiment document contain plan and actual result in the correct order?
- Does Review ground direct critique and handoff preparation in applicable current official venue requirements and actually inspected relevant published work, while keeping import, inspection, and author handling boundaries intact?
- Is any separate reviewer scope exact, read-only, user-managed, and Markdown-returning without independence claims?
- Does research Markdown remain natural rather than becoming a disguised schema?
- Are lifecycle, export, reinstall, and ordinary-file boundaries preserved?
- Are the two Trellis spec trees byte-identical?

## Stable Markdown and project file boundaries

- Research Markdown has no format or schema version. Future organization changes use ordinary host file operations to rename, move, relink, or consolidate substantive content; they do not create a migration framework or runtime fallback.
- Requested artifacts such as drafts, figures, experiment documents, and revisions are created or modified when the task requires them. Additional Dove research Markdown is maintained only when the user explicitly asks to record, update, or save it, when results clearly change the research mainline, conclusion, decision, or priority, or when durable recovery and evidence value make the work worth preserving.
- Dove project file operations use cross-platform Node path containment, ordinary-file and symbolic-link checks, same-directory temporary writes, expected-state rechecks, and transactional rollback; they do not require Linux `/proc` features.
- Complete Reinstall displays the current deletion and replacement paths, defaults to No, and after confirmation rereads the project and executes the current plan.
- `DOCTOR.md` is ordinary host-maintained Dove feedback, without JSON projection, issue lifecycle, or CLI ownership.
