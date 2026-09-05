# State Management

> Research Markdown and project installation boundaries for Dove 3.0.0.

---

## Overview

Dove is file-first without treating research as machine-owned state. The host performs substantive work. Researchers preserve useful context in ordinary Markdown, and Dove-owned software metadata remains separate.

There is no Dove research-state MCP service, Research Format marker, entity database, hidden research state machine, or runtime fallback reader in Dove 3. The pinned `dove-paper-search` MCP is optional Claude project tooling for scholarly paper discovery, download, and full-text reading, and hosted Exa is optional Claude project tooling for ordinary webpage bodies, documentation pages, venue pages, and known URLs; neither stores Dove research state.

## Boundary Model

- The **Dove agent** is one complete research agent for host work.
- A **Skill** expresses a capability entrance and host workflow.
- A **research document** is ordinary researcher-owned Markdown. The overview, optional summaries, project-specific documents, and optional Lessons materials are researcher-owned.
- A **project artifact** holds substantive work in a normal project path.
- An **installation resource** belongs to Dove-managed project integration.
- **Dove feedback** is ordinary `.dove/install/DOCTOR.md` Markdown maintained by the host when the user explicitly comments on Dove or Dove itself actually fails during use.
- A **review exchange record** under `.dove/reviews/...` preserves an explicit isolated reviewer handoff, copied-material snapshot, backend provenance, and returned Markdown.
- A **run receipt** under `.dove/runs/...` preserves a local execution JSONL journal plus stdout/stderr logs for an explicit experiment or diagnostic.
- **Preserved legacy data** remains user-owned and in place; Dove may detect it read-only but does not automatically convert or delete it.

Across the nine capabilities, Dove keeps a shared mainline anchor, identifies the highest-level active limit, keeps candidate explanations explicit, chooses a discriminating action, and counts progress only when the result materially changes or protects the decision.

Drafts, figures, code, data, logs, papers, review bundles, run outputs, and rebuttals remain ordinary project artifacts rather than Dove stores. `.dove/reviews/**` holds explicit exchange provenance for isolated review runtime rounds, and `.dove/runs/**` holds local execution receipts for experiments or diagnostics. Both are preserved across lifecycle operations.

## Installation State

`.dove/install/manifest.json` is software installation metadata at revision `2.0`. Package version, installation revision, `.dove/reviews/**` exchange records, `.dove/runs/**` run receipts, and the content of research Markdown are separate concerns.

Optional `.dove/install/DOCTOR.md` is ordinary natural-language feedback, not a generated projection. It records explicit user feedback, corrections, complaints, improvement ideas, and actual failures of Dove Skills, hooks, routing, integration, document behavior, or guidance. It has no JSON state, IDs, severity, counters, statuses, or fixed template. Ordinary research uncertainty, project bugs, and external-tool failures stay out. Managed-file digests or hashes protect installation bytes and detect drift; they must never be cited as research evidence, source authority, review integrity, or scientific validation.

Claude Code and DeepSeek Harness are the supported project initialization paths. Claude initialization installs the Dove agent surface, the SessionStart hook, the shared Dove rule, the minimal researcher-owned `RESEARCH.md` bootstrap, pinned `dove-paper-search` and hosted Exa MCP fragments plus hidden Claude guidance Skills for those tools, and a project-scoped `permissions.deny` entry for built-in `WebFetch` while preserving built-in `WebSearch`; DSH initialization installs project-local filesystem Skills only. Dove does not install `UserPromptSubmit`, hidden intake, a replacement per-prompt hook, register a research-state service, install external runtimes, approve project trust, write credentials, add CLI/shell/`curl`/fetch-script substitutions for web retrieval, or claim that the minimal research entry is substantive research content.

## Research Documents

Research context lives under `.dove/research/`:

- root `RESEARCH.md` is the researcher-owned concise overview and navigation document;
- missions, experiments, sources, reviews, claims, and lessons may each have one researcher-owned directory summary when useful;
- `lessons/` contains optional researcher-owned advisory materials when they exist; and
- other preserved legacy or user-owned files are researcher-owned human-named linked topic documents in the corresponding directory.

This is recommended organization, not a schema. Do not require fixed headings, frontmatter, generated IDs, enums, machine indexes, stored counts, fingerprints, or research hashes.

### Overview and links

- Keep `RESEARCH.md` useful for preserving the confirmed mainline, material progress, important conclusions and limits, linked work, and next priorities.
- Update it only for material changes, not as a run log.
- An absent overview is normal.
- A missing or broken link is an ordinary document problem. Report the path and affected context naturally; do not invalidate the whole research area.

### Topic documents

- Mission documents may preserve bounded goals, competing explanations, substantive work, current conclusions, decisions, and next branches in a natural structure.
- Source documents may preserve citations or URLs and what was actually inspected and learned.
- A central experiment serves a real problem, key uncertainty, or route decision. When that basis is missing, Dove pauses central design and inspects actual project material, relevant sources, or a smallest low-risk diagnostic instead of inventing a substitute experiment or stopping at the gap. When newly executed central work needs recording, one Experiment document holds the prospective plan and later actual execution and results; local command execution may also have `.dove/runs/<id>/` receipts, but those receipts do not replace the Experiment document. Design-only work stops before execution, existing results are analyzed directly, and retrospective records remain retrospective.
- A Review document may preserve author-side scientific self-check, `dove-review` handoff purpose, frozen materials, explicit limits, prompt, clarification, rebuttal, and actual reviewer returns; author handling is added only when requested.
- Claims remain scoped prose, tables, or dedicated human-readable documents when useful. There is no Claim store.
- Lessons remain fallible advisory prose and are never evidence or a completion certificate.

## Mutation Rules

- Read only the documents needed for the task.
- Write only when the user explicitly asks to record, update, or save Dove research context, when results clearly change the research mainline, conclusion, decision, or priority, or when preserving the work's evidence and continuation context is genuinely useful.
- Prefer updating the existing relevant topic document over creating duplicates.
- Use new results to continue, change, or stop the research route.
- Treat contribution, mechanism, novelty, and positioning above method, evidence, experiment analysis, baselines, and failure analysis; those above argument, writing, and figures; delivery last.
- Do not let bounded-task completion masquerade as Workspace mainline progress.
- Never synthesize a prospective experiment plan after execution.
- Preserve only actual reviewer returns; do not overwrite the original return with an author summary.
- Do not normalize researcher documents into a mandatory template.

Status performs no mutations. Ordinary host routing and the shared Dove rule do not create research documents merely because a prompt was routed.

## Default Progression Boundary

Default multi-round progression is foreground autonomous work. It reads the user-confirmed Workspace mainline from substantive research context, the current conversation, and actual project artifacts, and keeps that mainline stable. A short `/dove:research` continues toward the confirmed mainline. If no mainline is confirmed, open exploration may begin from an explicitly labeled provisional question or route; Dove asks only when a material direction, scope, completion meaning, or user boundary would change.

Default progression uses a mainline-evidence-action-outcome continuation cycle. It judges what was found, accessed, inspected, used, executed, verified, contradicted, or remains missing; then uses Explore, Execute, and Express as orthogonal action lenses rather than stages, roles, Skills, or a fixed order. Dove chooses the capability or help that best advances the current decision, performs the action, and compares the result with the mainline or immediate goal. A checkpoint is internal, not a default stopping point.

Dove asks only when a material direction, scope, or real boundary would change the work. It does not promote a recent audit, provenance task, validation result, document update, or old `dove-review` into the mainline merely because it is visible. For manuscript work, preserve the user's current authoritative format and actual venue requirements. New manuscripts default to LaTeX source only when the venue accepts it, with actual compiled-output inspection; otherwise use the required format. It identifies the required build path and venue-facing materials, judges whole-manuscript readiness against the target venue, and continues while another feasible in-scope action can matter. Direct Review and Figure are advisory capabilities used when they materially improve the next action, not mandatory stages. For a submission-completion goal, author-side sufficiency and a current `dove-review` acceptability recommendation are both required evidence; the recommendation is not a score, enum, runtime gate, or authority over the Workspace mainline. Evidence work, provenance, validation, engineering, supplementary material, and research Markdown remain subordinate support unless they materially change the scientific judgment or deliverable. Default progression stops only when the goal is achieved, a material blocker cannot be resolved within the confirmed mainline, or a user decision or explicit external boundary is required. Default progression does not create a hidden session store, daemon, scheduler, or research service.

## Review Boundary

Review can be author-side scientific self-check or a `dove-review` exchange. Whole-paper author-side scientific self-check asks whether the method answers the research question, whether the field judgment is correct, whether the contribution, evidence, scope, and expression fit the target venue and readers, and what the strongest reasonable objection is plus what evidence or revision would answer it; local paragraph, figure, citation, or method review does not force these full-paper questions. It returns a natural-language author-side acceptability recommendation without claiming independent external review.

For an isolated `dove-review` exchange, Dove prepares a frozen near-submission handoff and uses `dove review handoff|resume|rerun` to reach a genuinely isolated persistent Claude Code reviewer context when the runtime is available. The context keeps its own review history across re-review rounds but never reads author private transcripts or unlisted materials. Each runtime round receives the current full paper, authoritative LaTeX source and compiled output, actual submission appendices or supplements, and other listed venue-facing files copied into the isolated workspace; the reviewer reads only that round's frozen list with Read-only tools, makes no edits, asks the four full-paper questions, and returns Markdown under `Verdict`, `Blocking issues`, `Grounding basis`, and `Author-side next actions`. The runtime records the report and does not parse those headings. Author-side old Reviews, private transcripts, and unlisted project files are not supplied; the resumed reviewer session retains its own earlier review history. No web or MCP access is provided, so needed venue/literature grounding must be listed in the frozen handoff. Findings are evidence to analyze rather than direct rewrite or claim-narrowing triggers; feasible high-level author-side action comes first, narrowing requires evidence or a real boundary, and changes to the confirmed mainline, contribution, or completion meaning go to the user. The actual return is preserved faithfully in the corresponding document, and author handling remains separate. A host label, same-context role prompt, or provenance statement does not prove independence.

## Recovery facts and minimal receipts

Ordinary Claude conversations use the shared rule; `claude --agent dove` is the author-side main session. Bounded independent investigations may use a Dove subagent; full-conversation work, important user clarification, and ongoing mainline ownership stay in the main session. Isolated review shares research judgment from a reviewer position rather than inheriting the author's mainline.

Only compact/resume emits a read-only facts card: `RESEARCH.md` existence and absolute mtime; latest Review id, current round, absolute `updatedAt`, and material currentness; latest Run id, absolute `startedAt`, status, and exit code. Missing or unreadable facts remain `unavailable`. The card reads metadata and run journals and compares the latest review round's listed files with snapshot receipts. It does not read research Markdown bodies, review reports, or stdout/stderr logs, interpret verdicts, or infer the current mainline. Startup/clear emits no research card. Visible conversation and relevant project materials, not latest-record order, determine continuation.

Run receipts record command, timing, outcome, metric, budget, and comparison basis, plus an explicitly declared seed and minimum Git commit/dirty facts. They do not store status counts, porcelain receipts, lockfile fingerprints, or platform/environment taxonomies. Git facts do not change comparison eligibility or ranking. Budget metadata is not prepayment or an automatically enforced spending cap; explicit user limits and timeout controls remain binding.

Review SHA remains internal byte-comparison metadata; human and CLI JSON projections omit it. A current byte relationship is not a scientific verdict. Source may perform requested bounded bibliography DOI checks without a ledger; metadata identity is distinct from inspected content and claim support.

## Lifecycle Behavior

- `init` creates supported software integration, the Dove agent surface, and the minimal researcher-owned `RESEARCH.md` bootstrap in one transaction.
- `update` refreshes recognized package-managed integration and preserves existing `.dove/research/**`, `.dove/reviews/**`, and `.dove/runs/**`; it does not create missing summaries, complete navigation, replace Lessons, or delete retired researcher-visible materials, review records, or run receipts.
- Retired exact Dove-owned Stop hook fragments and old manifest-owned Dove `UserPromptSubmit` fragments are removed during lifecycle refresh only when the array entry exactly matches the old managed fragment; user-owned or non-array Stop and prompt settings are preserved.
- `doctor` reports software and local readability facts without repairing research content; missing summaries are optional documentation, not corruption.
- Old legacy research data is detected read-only, left in place, and not automatically converted, deleted, normalized into Markdown, or used through a runtime fallback.
- `reinstall` displays the deletion and replacement scope and defaults to No. After confirmation it rebuilds package-managed integration while preserving `.dove/research/**`, `.dove/reviews/**`, `.dove/runs/**`, `.dove/install/DOCTOR.md`, and ordinary project files.

Dove does not install or manage `statusLine`; the retained helper is only for user-owned composition scripts. Retirement removes the exact old Dove line and releases ownership while preserving user-modified lines. `UserPromptSubmit` and intake are retired without a replacement per-prompt hook.

## Project File Safety

Project roots and Dove-managed paths must remain contained and unambiguous. Lifecycle operations reject unsafe traversal or symlink use where Dove owns the boundary, preserve ordinary files and unrelated shared-configuration fields, and stop on unowned conflicts or changed transaction preconditions. Explicit update replaces valid manifest-owned local edits with a notice; SessionStart skips them and continues safe synchronization with a `systemMessage` reminder. Software changes should be staged and checked before promotion.

## Stable Markdown and project file boundaries

- Research Markdown has no format or schema version. Future organization changes use ordinary host file operations to rename, move, relink, or consolidate substantive content; they do not create a migration framework or runtime fallback.
- Requested artifacts such as drafts, figures, experiment documents, and revisions are created or modified when the task requires them. Additional Dove research Markdown is maintained only when the user explicitly asks to record, update, or save it, when results clearly change the research mainline, conclusion, decision, or priority, or when preserving the work's evidence and continuation context is genuinely useful.
- Dove project file operations use cross-platform Node path containment, ordinary-file and symbolic-link checks, same-directory temporary writes, expected-state rechecks, and transactional rollback; they do not require Linux `/proc` features.
- Complete Reinstall displays the current deletion and replacement paths, defaults to No, and after confirmation rereads the project and executes the current plan.
- `DOCTOR.md` is ordinary host-maintained Dove feedback, without JSON projection, issue lifecycle, or CLI ownership.
