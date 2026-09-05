# Type Safety

> Software contracts, path safety, CLI boundaries, and research-document non-schema rules for Dove 3.0.0.

---

## Overview

Dove uses Node.js ESM JavaScript. Runtime safety applies to software-owned boundaries such as package metadata, CLI parsing, installation manifests, managed paths, lifecycle plans, generated inventories, isolated review material handoffs, and read-only legacy-data detection.

Research meaning is not a runtime type system. Ordinary Markdown must not acquire a replacement schema, DTO layer, typed research errors, generated IDs, or machine authority.

## Software Contract Sources

- `package.json` and package metadata define package identity and Node requirements.
- The project installation manifest implementation defines revision `2.0` and managed-resource metadata.
- CLI parsing defines the supported command and option inventory, including `dove review handoff|status|resume|rerun|import` and `dove run start|status|resume|finalize|compare`.
- Project installation and file-transaction modules enforce contained software writes and conflict handling.
- The canonical Dove agent definition and Skill workflow sources define workflow inventory for adapter generation.
- Build scripts define the library and CLI bundles.
- Review runtime modules define the explicit `.dove/reviews/**` record shape, material-copy boundary, reviewer workspace location, backend provenance, and session-id handling.
- Run runtime modules define the explicit `.dove/runs/**` JSONL journal, stdout/stderr log paths, supervisor writer boundary, target spawn boundary, one ordinary terminal event, missing-terminal reconcile/finalize events, and comparison compatibility rules.
- Legacy research-data detection is read-only: old data remains in place and Dove does not automatically convert, delete, or use it through a runtime fallback.

No research MCP definitions or Research Format schema belong in the Dove 3 contract surface.

## Required Software Validation

- Package name and release version are valid and explicit.
- Node.js `>=22` remains the supported runtime.
- CLI parsing accepts only `init`, `update`, `reinstall`, `uninstall`, `doctor`, `review`, `run`, and `hook` with their declared options and review/run subcommands.
- The CLI does not expose `mcp` or `migrate-research`.
- Installation manifests use revision `2.0` and reject unsupported or ambiguous software state.
- Project roots and Dove-managed paths reject traversal, escaping paths, and unsafe symlink use where Dove owns the boundary.
- Shared configuration preserves unrelated fields.
- Managed-resource digests detect changed installation bytes without becoming public research evidence.
- File-set changes verify preconditions and avoid partial promotion.
- Isolated review handoff accepts only canonical project-relative regular non-symlink material files, rejects private Dove/Claude/settings/research paths, copies only listed files, keeps internal path, size, and SHA-256 receipts, and exposes public review results without hash fields.
- Run ids are path-safe, run directories are atomically reserved, target argv is passed without a shell, new journals record only explicit seed plus Git commit/dirty facts beyond command, time, result, metric, budget, and basis fields, status is read-only, resume never reruns, finalize appends one scalar metric only after terminal completion, and compare ranks only compatible terminal finalized runs by metric, budget, data, evaluator, and resource basis.
- Generated adapters match the nine-Skill and Dove-agent canonical sources.
- Package output contains exactly the declared library and CLI runtime bundles.
- Hook parsing accepts `SessionStart` plus the retained `statusline` helper and rejects `UserPromptSubmit`; lifecycle sync validates the exact initialized project before writes, and retired exact Dove-owned `UserPromptSubmit` and Stop fragments are removed without rewriting user-owned prompt or Stop settings.
- Old legacy research data is reported in place rather than converted, deleted, or treated as current runtime research state.
- Complete Reinstall requires an explicit confirmed destructive plan whose default is No.

## Minimal runtime facts

- Ordinary Claude uses the shared rule; `--agent dove` owns the author-side main session. A Dove subagent is suitable for bounded independent research, not full-conversation work, important clarification, or ongoing mainline ownership.
- Explicit update replaces valid manifest-owned local edits with human and JSON notices. SessionStart skips them, continues safe resources, and emits `systemMessage`; unowned conflicts and unsafe transaction preconditions remain blocking.
- Compact/resume exposes only `RESEARCH.md` existence/absolute mtime, latest Review id/round/absolute `updatedAt`/currentness, and latest Run id/absolute `startedAt`/status/exit. Unknown facts stay `unavailable`. No Markdown body, review report, stdout/stderr log, inferred mainline, or next-action payload belongs in this card. Startup/clear emits no research card.
- Review human and CLI JSON projections omit SHA fields; internal JSON receipts and internal runtime metadata are not public research evidence. Use short reviewer workspace paths without relaxing containment or session checks.
- Run Git is only commit plus dirty `true`/`false`/`null`; seed is an explicit declaration, not proof the target used it. Do not add status counts, porcelain receipts, lockfile fingerprints, or platform/environment taxonomies. Git does not affect comparability or ranking.
- Budget metadata is a comparison basis, not prepayment or an automatically enforced spending cap. Explicit user limits and timeout controls still apply.
- `statusLine` is not installed or managed. The old helper is only for user-owned composition scripts; `UserPromptSubmit` and intake have no replacement per-prompt hook.

## Research Markdown Boundary

Research content under `.dove/research/` is ordinary UTF-8 Markdown. Software may enforce only genuine file-safety boundaries needed to read or write a selected project file. It must not validate research meaning through a fixed document shape.

Allowed conventions include:

- researcher-owned root `RESEARCH.md` overview and navigation;
- optional researcher-owned summaries in research directories;
- optional researcher-owned Lessons materials under `lessons/`; and
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
- author-side scientific self-check stays scoped and does not claim independent external review;
- review purpose, exact frozen path scope, limits, and prompt precede any `dove-review` exchange;
- a `dove-review` context remains a genuinely isolated persistent host-provided context, read-only, Markdown-returning, and backed only by a real recorded reviewer session id;
- `dove run` receipts remain local execution evidence: the supervisor is the journal writer, timeout termination scope is recorded, PID liveness is observation only, and interrupted reconciliation must not masquerade as a rerun;
- the actual user-obtained return is preserved in the corresponding Review document, and author handling is added only when requested;
- Default multi-round progression reads and preserves the user-confirmed Workspace mainline, continues while feasible in-scope actions can advance or protect it, and asks only when a material direction or real boundary changes the work; and
- Status performs no writes.

Protect these through canonical workflow order, generated-resource validation, real interface checks, and semantic review. Do not enforce them by inventing an entity database.

## Version and Lifecycle Boundaries

- Package release: `3.0.0`.
- Installation manifest revision: `2.0`.
- Legacy JSON research state: preserved in place and detected read-only.
- Runtime research source: ordinary Markdown only.
- Runtime fallback to old JSON: none.

Project update refreshes package-managed integration and preserves existing `.dove/research/**`, `.dove/reviews/**`, and `.dove/runs/**`; it does not create missing summaries, complete navigation, replace Lessons, or delete retired researcher-visible materials, review records, run receipts, or old legacy research data. Other research documents remain researcher-owned. Complete Reinstall previews deletions and replacements, then after default-No confirmation rebuilds package-managed integration while preserving `.dove/research/**`, `.dove/reviews/**`, `.dove/runs/**`, `.dove/install/DOCTOR.md`, and ordinary project files.

## Machine and Human Language

Final conversation policy defaults to natural Chinese unless the user requests another language or format. Source code names, CLI commands, package versions, manifest revisions, and project-relative paths remain exact where needed. Research documents use the language and structure appropriate to their human readers.

Validation output must stay software-scoped and must not imply scientific correctness, completion, reproducibility, acceptance, reviewer independence, or Dove research quality.

## Stable Markdown and project file boundaries

- Research Markdown has no format or schema version. Future organization changes use ordinary host file operations to rename, move, relink, or consolidate substantive content; they do not create a migration framework or runtime fallback.
- Requested artifacts such as drafts, figures, experiment documents, and revisions are created or modified when the task requires them. Additional Dove research Markdown is maintained only when the user explicitly asks to record, update, or save it, when results clearly change the research mainline, conclusion, decision, or priority, or when preserving the work's evidence and continuation context is genuinely useful.
- Dove project file operations use cross-platform Node path containment, ordinary-file and symbolic-link checks, same-directory temporary writes, expected-state rechecks, and transactional rollback; they do not require Linux `/proc` features.
- Complete Reinstall displays the current deletion and replacement paths, defaults to No, and after confirmation rereads the project and executes the current plan.
- `DOCTOR.md` is ordinary host-maintained feedback rather than typed Doctor state; it has no fixed schema, IDs, statuses, or counters.
