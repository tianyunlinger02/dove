# Hook Guidelines

> Reusable helper flows and ambient entry for Dove 3.0.0.

---

## Overview

There are no React hooks. Hook-like abstractions are narrow helpers for project discovery, ordinary Markdown reading and writing, contained paths, generated adapter projection, installation lifecycle, explicit export, and natural user-facing reporting.

Claude project integration manages two host hooks. `UserPromptSubmit` conservatively adds one hidden `dove-intake` context only for clear Dove/research work requests, including clear Lessons requests. Contextual follow-ups, explanations, confirmations, and judgment-only prompts do not need Dove routing. `Stop` requests one additional plain-language rendering after a non-empty assistant response and immediately allows the continuation when `stop_hook_active` is true. Both require an initialized manifest with Claude host integration, but neither runs a full integration or research-default health check on every call. Neither hook runs research through an MCP service or creates hidden research state.

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

1. write only when the user explicitly asks to record, update, or save Dove research context, or when results clearly change the research mainline, conclusion, decision, or priority;
2. prefer updating the existing relevant researcher-owned topic document;
3. otherwise create one human-named Markdown document whose structure fits the work; never put project-specific guidance into a package-managed built-in Lessons theme;
4. link related documents and ordinary artifacts when the link improves recovery;
5. update the corresponding directory summary only when its own links or synthesis materially change; and
6. update `RESEARCH.md` only for a material mainline, conclusion, navigation, or priority change.

Do not insert mandatory headings, frontmatter, generated IDs, enums, hashes, a machine index, or stored counts. Do not create a document solely because a Skill ran.

## Experiment Flow

For experiment work:

1. follow whether the user requested design, execution, analysis, or retrospective recording;
2. before treating a new experiment as central, establish the real problem, key uncertainty, or route decision it should resolve; if that basis is missing, stop experiment design and identify the project material, relevant sources, or smaller diagnostic needed to investigate the problem rather than inventing a substitute experiment or ending at the missing basis;
3. stop after an executable plan for design-only work;
4. for newly executed central work that needs recording, choose one Experiment document, write the prospective plan before execution, execute with normal host tools, and append the actual result and any deviation that changes its interpretation to the same document when the maintenance trigger is met;
5. analyze existing results directly; and
6. keep retrospective records retrospective rather than reconstructing a prospective plan.

## Review Flow

For user-managed Review work:

1. prepare a new review only when requested, recording purpose, relevant artifact paths, scope limits, rubric, and prompt;
2. return the materials for a separate reviewer chosen and managed by the user, who remains read-only and returns Markdown;
3. when importing, preserve only the actual return supplied by the user in the corresponding Review document without reconstructing preparation or starting author revision; and
4. when inspecting, remain read-only and do not create a new exchange.

Author handling is optional during import and substantive response remains Rebuttal work. No hook, helper, or packaged role may launch, replace, or certify the separate reviewer.

## Ambient Entry

Ambient entry applies only to selected non-slash prompts:

- `dove-intake` selects the smallest suitable one of the nine ambient-eligible Skills only for clear Dove/research work requests, including `lessons` for clear Lessons read, remember, or reflect requests. It may choose no Dove Skill and answer directly for contextual follow-ups, explanations, confirmations, or judgment-only prompts. Auto is explicit-only and cannot be selected. Ask only when material ambiguity blocks the work.
- Lessons reading remains zero-write, while durable Lessons maintenance occurs only when explicitly requested. The host follows `lessons/LESSONS.md` and only relevant linked themes without a second hidden intake Skill.

After routing, the host continues the original task normally with host tools. Slash commands retain explicit routing. Ambient entry must not create a Mission document, emit a hidden handoff, invoke private controls, or route to Auto merely because research context exists.

The project rule also provides a narrow Dove feedback channel. When the user clearly gives feedback, criticism, correction, or an improvement request about Dove itself, or when Dove's own Skill, hook, routing, integration, document behavior, or guidance actually fails, the host appends a concise natural-language note to `.dove/install/DOCTOR.md`. It preserves what happened, user impact, and useful context without IDs, statuses, severity, counters, frontmatter, or a fixed template. Ordinary research uncertainty, project bugs, external-tool failures, and general conversation are excluded.

The prompt hook is zero-write and does not update project integration or research defaults. Lifecycle synchronization is reported through ordinary setup and diagnostic surfaces rather than blocking each prompt. The Stop hook does not perform routing.

## Lifecycle Helper Flow

Project lifecycle helpers should inspect selected paths, reject escaping or ambiguous managed paths, preserve ordinary files and unrelated shared configuration, stop on conflicting or changed managed content, and stage the complete software change set before promotion.

- Project update creates missing summaries, completes current standard navigation only in `RESEARCH.md` and `lessons/LESSONS.md`, and replaces each of the six package-managed built-in Lessons themes with current package content. Each built-in theme carries a plain notice directing project-specific guidance to separately named Lessons linked from `lessons/LESSONS.md`; other research documents remain researcher-owned.
- Deprecated `.dove/research/LESSONS.md` and `lessons/additional-lessons.md` are directly deleted without migration or fallback, and the Additional migrated Lessons link is removed.
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

- Research Markdown has no format or schema version. Future organization changes use ordinary host file operations to rename, move, relink, or consolidate substantive content; they do not create a migration framework or runtime fallback.
- Requested artifacts such as drafts, figures, experiment documents, and revisions are created or modified when the task requires them. Additional Dove research Markdown is maintained only when the user explicitly asks to record, update, or save it, or when results clearly change the research mainline, conclusion, decision, or priority.
- Dove project file operations use cross-platform Node path containment, ordinary-file and symbolic-link checks, same-directory temporary writes, expected-state rechecks, and transactional rollback; they do not require Linux `/proc` features.
- Complete Reinstall displays the current deletion and replacement paths, defaults to No, and after confirmation rereads the project and executes the current plan.
- When the user clearly comments on Dove itself or Dove actually fails during use, the host may append concise natural-language feedback to `.dove/install/DOCTOR.md`; unrelated project and research problems are not recorded there.
