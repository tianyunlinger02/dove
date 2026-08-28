# State Management

> Research Markdown and project installation boundaries for Dove 3.0.0.

---

## Overview

Dove is file-first without treating research as machine-owned state. The host performs substantive work. Researchers preserve useful context in ordinary Markdown, and Dove-owned software metadata remains separate.

There is no Dove research-state MCP service, Research Format marker, entity database, hidden research state machine, or runtime fallback reader in Dove 3. The optional external paper MCP is project tooling and stores no Dove research state.

## Boundary Model

- The **Dove agent** is one complete research persona for host work.
- A **Skill** expresses a capability entrance and host workflow.
- A **research document** is ordinary researcher-owned Markdown. The overview, optional summaries, project-specific documents, and optional Lessons materials are researcher-owned.
- A **project artifact** holds substantive work in a normal project path.
- An **installation resource** belongs to Dove-managed project integration.
- **Dove feedback** is ordinary `.dove/install/DOCTOR.md` Markdown maintained by the host when the user explicitly comments on Dove or Dove itself actually fails during use.
- An **export archive** preserves original legacy JSON bytes under `.dove/archive/...` after explicit conversion.

Drafts, figures, code, data, logs, papers, review bundles, and rebuttals remain ordinary project artifacts rather than Dove stores.

## Installation State

`.dove/install/manifest.json` is software installation metadata at revision `2.0`. Package version, installation revision, and the content of research Markdown are separate concerns.

Optional `.dove/install/DOCTOR.md` is ordinary natural-language feedback, not a generated projection. It records explicit user feedback, corrections, complaints, improvement ideas, and actual failures of Dove Skills, hooks, routing, integration, document behavior, or guidance. It has no JSON state, IDs, severity, counters, statuses, or fixed template. Ordinary research uncertainty, project bugs, and external-tool failures stay out. Managed-file digests or hashes protect installation bytes and detect drift; they must never be cited as research evidence, source authority, review integrity, or scientific validation.

Claude Code remains the supported project initialization path. Project initialization installs the Dove agent surface, SessionStart/prompt hooks, the minimal researcher-owned `RESEARCH.md` bootstrap, and one pinned external paper-acquisition MCP fragment plus hidden support Skill. Dove does not register a research-state service, install the external runtime, approve project trust, write credentials, or claim that the minimal research entry is substantive research content.

## Research Documents

Research context lives under `.dove/research/`:

- root `RESEARCH.md` is the researcher-owned concise overview and navigation document;
- missions, experiments, sources, reviews, claims, and lessons may each have one researcher-owned directory summary when useful;
- `lessons/` contains optional researcher-owned advisory materials when they exist; and
- other files, including explicit-export `lessons/imported-lessons.md`, are researcher-owned human-named linked topic documents in the corresponding directory.

This is recommended organization, not a schema. Do not require fixed headings, frontmatter, generated IDs, enums, machine indexes, stored counts, fingerprints, or research hashes.

### Overview and links

- Keep `RESEARCH.md` useful for preserving the confirmed mainline, material progress, important conclusions and limits, linked work, and next priorities.
- Update it only for material changes, not as a run log.
- An absent overview is normal.
- A missing or broken link is an ordinary document problem. Report the path and affected context naturally; do not invalidate the whole research area.

### Topic documents

- Mission documents may preserve bounded goals, competing explanations, substantive work, current conclusions, decisions, and next branches in a natural structure.
- Source documents may preserve citations or URLs and what was actually inspected and learned.
- A central experiment serves a real problem, key uncertainty, or route decision. When that basis is missing, Dove pauses central design and inspects actual project material, relevant sources, or a smallest low-risk diagnostic instead of inventing a substitute experiment or stopping at the gap. When newly executed central work needs recording, one Experiment document holds the prospective plan and later actual execution and results; design-only work stops before execution, existing results are analyzed directly, and retrospective records remain retrospective.
- A Review document may preserve Direct Scientific Review self-check, independent Reviewer handoff purpose, frozen materials, explicit limits, prompt, clarification, rebuttal, and actual reviewer returns; author handling is added only when requested.
- Claims remain scoped prose, tables, or dedicated human-readable documents when useful. There is no Claim store.
- Lessons remain fallible advisory prose and are never evidence or a completion certificate.

## Mutation Rules

- Read only the documents needed for the task.
- Write only when the user explicitly asks to record, update, or save Dove research context, when results clearly change the research mainline, conclusion, decision, or priority, or when preserving the work's evidence and continuation context is genuinely useful.
- Prefer updating the existing relevant topic document over creating duplicates.
- Use new results to continue, change, or stop the research route.
- Never synthesize a prospective experiment plan after execution.
- Never fabricate a reviewer return or overwrite the original return with an author summary.
- Do not normalize researcher documents into a mandatory template.

Status performs no mutations. Ambient routing does not create research documents merely because a prompt was routed.

## Auto Boundary

Auto is explicit-only foreground multi-round autonomy. It reads the user-confirmed Workspace mainline from substantive research context, the current conversation, and actual project artifacts, and keeps that mainline stable. A short `/dove:auto` continues toward the confirmed mainline; if no mainline is confirmed, Dove asks the user before autonomous multi-round work.

Auto uses a mainline-evidence-action-outcome continuation cycle. It judges what was found, accessed, inspected, used, executed, verified, contradicted, or remains missing; then uses Explore, Execute, and Express as orthogonal action lenses rather than stages, roles, Skills, or a fixed order. Dove chooses the capability or help that best advances the current decision, performs the action, and compares the result with the mainline or immediate goal. A checkpoint is internal, not a default stopping point.

Auto asks only when a material direction, scope, or real boundary would change the work. It does not promote a recent audit, provenance task, validation result, document update, or old Review into the mainline merely because it is visible. For manuscript work, it uses LaTeX as the authoritative source and primary working format by default, verifies the actual compiled output, and uses another format only when the target venue officially does not provide or accept LaTeX. It identifies the required build path and venue-facing materials, judges whole-manuscript readiness against the target venue, and continues while another feasible in-scope action can matter. Direct Review and Figure are advisory capabilities used when they materially improve the next action, not mandatory stages. For a submission-completion goal, author-side sufficiency and a current independent Reviewer acceptability recommendation are both required evidence; the recommendation is not a score, enum, runtime gate, or authority over the Workspace mainline. Evidence work, provenance, validation, engineering, supplementary material, and research Markdown remain subordinate support unless they materially change the scientific judgment or deliverable. Auto stops only when the goal is achieved, a material blocker cannot be resolved within the confirmed mainline, or a user decision or explicit external boundary is required. Auto does not create a hidden session store, daemon, scheduler, or research service.

## Review Boundary

Review can be Direct Scientific Review self-check or an independent Reviewer exchange. Direct Scientific Review self-check tests the contribution, novelty, claims, evidence, method, experiment conditions, limitations, writing clarity, and likely reader confusion across the current full paper; it returns a natural-language author-side acceptability recommendation without claiming independent external review.

For an independent exchange, Auto or Review prepares a frozen handoff and uses a genuinely isolated host Reviewer context when the host actually provides one. The Reviewer context keeps its own review history across re-review rounds but never reads author private transcripts or unlisted materials. Each round receives the current full paper, explicit project-relative artifacts and scope limits, and any explicit rebuttal, clarification, or change notes; the Reviewer reads only that scope, makes no edits, and returns a whole-paper recommendation with scientific acceptability separate from delivery readiness. The actual return is preserved faithfully in the corresponding document, and author handling remains separate. A host label, same-context role prompt, or provenance statement does not prove independence.

## Lifecycle Behavior

- `init` creates supported software integration, the Dove agent surface, and the minimal researcher-owned `RESEARCH.md` bootstrap in one transaction.
- `update` refreshes recognized package-managed integration and preserves existing `.dove/research/**`; it does not create missing summaries, complete navigation, replace Lessons, or delete retired researcher-visible materials.
- Retired exact Dove-owned Stop hook fragments are removed during update and uninstall only when the array entry exactly matches the old managed fragment; user-owned or non-array Stop settings are preserved.
- `doctor` reports software and local readability facts without repairing research content; missing summaries are optional documentation, not corruption.
- `export-research` is a one-time supported legacy JSON research records-to-Markdown conversion. It archives the original legacy JSON bytes under `.dove/archive/...`, writes into the new directory structure even when the minimal bootstrap exists, preserves legacy `.dove/LESSONS.md` as `lessons/imported-lessons.md`, does not convert v1, and installs no runtime fallback. Real export requires separate user authorization.
- `reinstall` displays the deletion and replacement scope and defaults to No. After confirmation it rebuilds package-managed integration while preserving `.dove/research/**`, `.dove/install/DOCTOR.md`, and ordinary project files.

## Project File Safety

Project roots and Dove-managed paths must remain contained and unambiguous. Lifecycle operations reject unsafe traversal or symlink use where Dove owns the boundary, preserve ordinary files and unrelated shared-configuration fields, and stop on conflicting or changed managed content. Software changes should be staged and checked before promotion.

## Stable Markdown and project file boundaries

- Research Markdown has no format or schema version. Future organization changes use ordinary host file operations to rename, move, relink, or consolidate substantive content; they do not create a migration framework or runtime fallback.
- Requested artifacts such as drafts, figures, experiment documents, and revisions are created or modified when the task requires them. Additional Dove research Markdown is maintained only when the user explicitly asks to record, update, or save it, when results clearly change the research mainline, conclusion, decision, or priority, or when preserving the work's evidence and continuation context is genuinely useful.
- Dove project file operations use cross-platform Node path containment, ordinary-file and symbolic-link checks, same-directory temporary writes, expected-state rechecks, and transactional rollback; they do not require Linux `/proc` features.
- Complete Reinstall displays the current deletion and replacement paths, defaults to No, and after confirmation rereads the project and executes the current plan.
- `DOCTOR.md` is ordinary host-maintained Dove feedback, without JSON projection, issue lifecycle, or CLI ownership.
