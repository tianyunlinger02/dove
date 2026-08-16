# Hook Guidelines

> Reusable helper flows and ambient entry for Dove 3.0.0.

---

## Overview

There are no React hooks. Hook-like abstractions are narrow helpers for project discovery, ordinary Markdown reading and writing, contained paths, generated adapter projection, installation lifecycle, explicit export, and natural user-facing reporting.

Claude project integration manages two host hooks. `UserPromptSubmit` conservatively adds one hidden `dove-intake` context for clear work requests, including clear Lessons requests. `Stop` requests one additional plain-language rendering after a non-empty assistant response and immediately allows the continuation when `stop_hook_active` is true. Both require an initialized manifest with Claude host integration, but neither runs a full integration or research-default health check on every call. Neither hook runs research through an MCP service or creates hidden research state.

## Research Read Flow

A research-document read helper or workflow should:

1. resolve the selected real project boundary;
2. when existing Dove context would materially help, read `.dove/research/RESEARCH.md`, the summary for the current document type, and only directly relevant linked topic documents;
3. otherwise work directly from the user's request and specified project materials;
4. never recursively scan the whole research tree;
5. report missing needed links naturally, with the affected context;
6. inspect ordinary project artifacts and real external material when the task requires them; and
7. return evidence-bounded findings without inventing a database diagnosis.

Status uses this flow read-only. It does not repair links, create an overview, run validation, or infer hidden state.

## Research Write Flow

A document-maintenance helper or workflow should:

1. write only when the work creates durable research value;
2. prefer updating the existing relevant topic document;
3. otherwise create one human-named Markdown document whose structure fits the work;
4. preserve failures, adverse evidence, limitations, and uncertainty;
5. link related documents and ordinary artifacts when the link improves recovery;
6. update the corresponding directory summary when a detail document is created or materially changed; and
7. update `RESEARCH.md` only for a material mainline, conclusion, navigation, or priority change.

Do not insert mandatory headings, frontmatter, generated IDs, enums, hashes, a machine index, or stored counts. Do not create a document solely because a Skill ran.

## Experiment Flow

For experiment work:

1. follow whether the user requested design, execution, analysis, or retrospective recording;
2. stop after an executable plan for design-only work;
3. for newly executed work, choose one Experiment document, write the prospective plan before execution, execute with normal host tools, and append actual work, results, failures, deviations, denominators, limitations, uncertainty, and implications to the same document;
4. analyze existing results directly from their actual provenance; and
5. label retrospective records honestly rather than reconstructing a prospective plan.

## Review Flow

For user-managed Review work:

1. prepare a new review only when requested, recording purpose, relevant artifact paths, scope limits, rubric, and prompt;
2. return the materials for a separate Reviewer chosen and managed by the user, who remains read-only and returns Markdown;
3. when importing, preserve only the actual return supplied by the user in the corresponding Review document without reconstructing preparation or starting author revision; and
4. when inspecting, remain read-only and do not create a new exchange.

Author handling is optional during import and substantive response remains Rebuttal work. The native Reviewer role does not establish identity or independence. No hook or helper may launch or replace the separate Reviewer.

## Ambient Entry

Ambient entry applies only to selected non-slash prompts:

- `dove-intake` selects the smallest suitable one of the nine ambient-eligible Skills, including `lessons` for clear Lessons read, remember, or reflect requests. Auto is explicit-only and cannot be selected. Ask only when material ambiguity blocks the work.
- Lessons reading remains zero-write, while durable Lessons maintenance occurs only when explicitly requested. The host follows `lessons/LESSONS.md` and only relevant linked themes without a second hidden intake Skill.

After routing, the host continues the original task normally with host tools. Slash commands retain explicit routing. Ambient entry must not create a Mission document, emit a hidden handoff, invoke private controls, or route to Auto merely because research context exists.

The project rule also provides a narrow Dove feedback channel. When the user clearly gives feedback, criticism, correction, or an improvement request about Dove itself, or when Dove's own Skill, hook, routing, integration, document behavior, or guidance actually fails, the host appends a concise natural-language note to `.dove/install/DOCTOR.md`. It preserves what happened, user impact, and useful context without IDs, statuses, severity, counters, frontmatter, or a fixed template. Ordinary research uncertainty, project bugs, external-tool failures, and general conversation are excluded.

The prompt hook is zero-write and does not update project integration or research defaults. Lifecycle synchronization is reported through ordinary setup and diagnostic surfaces rather than blocking each prompt. The Stop hook does not perform routing.

## Lifecycle Helper Flow

Project lifecycle helpers should inspect selected paths, reject escaping or ambiguous managed paths, preserve ordinary files and unrelated shared configuration, stop on conflicting or changed managed content, and stage the complete software change set before promotion.

- Project update synchronizes defaults additively: each missing default file is created from complete package content; existing defaults preserve their byte prefix and receive only exact missing canonical paragraphs or navigation lines, while ordinary topic documents remain unchanged. Literal matching intentionally does not provide semantic deduplication.
- A retired `.dove/research/LESSONS.md` is moved once to `lessons/additional-lessons.md`, linked from `lessons/LESSONS.md`, and deleted in the same transaction; runtime readers use only the new path.
- `export-research` requires separate authorization for real research, accepts supported legacy JSON research records only, archives original bytes under `.dove/archive/...`, preserves legacy `.dove/LESSONS.md` as `lessons/imported-lessons.md`, supports an existing default tree, and installs no fallback reader.
- Complete Reinstall displays deletion and replacement paths, requires a default-No confirmation, deletes custom Dove research and old archives, replaces existing default research files, and rebuilds the current default tree while preserving ordinary project files.
- `dove doctor` reports software-facing facts read-only; separate host-maintained feedback may live in `.dove/install/DOCTOR.md`.

## Naming

- Core functions use verb-first camelCase.
- Normalizers use `normalize<Name>` where normalization is actually needed.
- Validators use `validate<Name>`, `assert<Name>`, or precise domain verbs for software boundaries.
- Research files use readable names and project-relative links rather than generated IDs.
- Public Skill IDs remain flat `dove.<surface>` names.
- User-facing failures use natural language and preserve actionable paths without exposing irrelevant internal transaction detail.

## Stable Markdown and project file boundaries

- Research Markdown has no format or schema version. Future organization changes use ordinary host file operations to rename, move, relink, or consolidate documents while preserving substantive content, failures, limitations, and uncertainty; they do not create a migration framework or runtime fallback.
- Requested artifacts such as drafts, figures, experiment documents, and revisions are created or modified when the task requires them. Additional Dove research Markdown is maintained only when the workflow requires it or the work creates durable research value.
- Dove project file operations use cross-platform Node path containment, ordinary-file and symbolic-link checks, same-directory temporary writes, expected-state rechecks, and transactional rollback; they do not require Linux `/proc` features.
- Complete Reinstall displays the current deletion and replacement paths, defaults to No, and after confirmation rereads the project and executes the current plan.
- When the user clearly comments on Dove itself or Dove actually fails during use, the host may append concise natural-language feedback to `.dove/install/DOCTOR.md`; unrelated project and research problems are not recorded there.
