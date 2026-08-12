# Hook Guidelines

> Reusable helper flows and ambient entry for Dove 3.0.0.

---

## Overview

There are no React hooks. Hook-like abstractions are narrow helpers for project discovery, ordinary Markdown reading and writing, contained paths, generated adapter projection, installation lifecycle, explicit export, and natural user-facing reporting.

The only host hook is the managed Claude `UserPromptSubmit` entry. It may synchronize recognized project integration before conservative routing. It does not run research through an MCP service, execute a direct Skill invisibly, or turn prompts into hidden research state.

## Research Read Flow

A research-document read helper or workflow should:

1. resolve the selected real project boundary;
2. look for `.dove/research/RESEARCH.md` only when research context is useful;
3. treat an absent overview as normal;
4. read only the linked topic documents relevant to the request;
5. report missing or broken links naturally, with the affected context;
6. inspect ordinary project artifacts and real external material when the task requires them; and
7. return evidence-bounded findings without inventing a database diagnosis.

Status uses this flow read-only. It does not repair links, create an overview, run validation, or infer hidden state.

## Research Write Flow

A document-maintenance helper or workflow should:

1. write only when the work creates durable research value;
2. prefer updating the existing relevant topic document;
3. otherwise create one human-named Markdown document whose structure fits the work;
4. preserve failures, adverse evidence, limitations, and uncertainty;
5. link related documents and ordinary artifacts when the link improves recovery; and
6. update `RESEARCH.md` only for a material mainline, conclusion, navigation, or priority change.

Do not insert mandatory headings, frontmatter, generated IDs, enums, hashes, a machine index, or stored counts. Do not create a document solely because a Skill ran.

## Experiment Flow

For a selected experiment:

1. choose or create one Experiment document;
2. write the prospective plan before execution;
3. execute that plan with normal host tools; and
4. append actual work, results, failures, deviations, denominators, limitations, uncertainty, and implications to the same document.

The workflow order matters. A helper must not reconstruct a prospective plan from a result.

## Review Flow

For a user-managed review:

1. choose or create one Review document;
2. record purpose, exact project-relative artifact paths, scope limits, rubric, and prompt;
3. return the declared scope and prompt to the user;
4. require the separate Reviewer to remain read-only and return Markdown;
5. accept only the actual return supplied by the user; and
6. preserve it faithfully in the same Review document before adding author handling.

The native Reviewer role does not establish identity or independence. No hook or helper may launch, impersonate, silently replace, or certify the Reviewer.

## Ambient Entry

Ambient entry applies only to selected non-slash prompts:

- `dove-intake` makes one conservative choice among the nine ambient-eligible Skills and the Planner, Builder/Author, and Reviewer responsibilities. Auto is explicit-only and cannot be selected. One clarification round is allowed only for material ambiguity.
- `dove-lessons-intake` handles explicit Lessons read, remember, or reflect requests by reading or maintaining `.dove/research/LESSONS.md`. It creates no unrelated research document.

After routing, the host continues the original task normally with host tools. Slash commands retain explicit routing. Ambient entry must not create a Mission document, emit a hidden handoff, invoke private controls, or route to Auto merely because research context exists.

The hook may refresh recognized software integration, but Sync behavior must not alter `.dove/research/` documents.

## Lifecycle Helper Flow

Project lifecycle helpers should inspect selected paths, reject escaping or ambiguous managed paths, preserve ordinary files and unrelated shared configuration, stop on conflicting or changed managed content, and stage the complete software change set before promotion.

- Sync and Upgrade never rewrite research Markdown.
- `export-research` requires separate authorization for real research, accepts supported legacy JSON research records only, archives original bytes under `.dove/archive/...`, and installs no fallback reader.
- Complete Reinstall requires a displayed default-No confirmation and deletes Dove research and old archives while preserving ordinary project files.
- Doctor reports software-facing facts and keeps its state under `.dove/install/`.

## Naming

- Core functions use verb-first camelCase.
- Normalizers use `normalize<Name>` where normalization is actually needed.
- Validators use `validate<Name>`, `assert<Name>`, or precise domain verbs for software boundaries.
- Research files use readable names and project-relative links rather than generated IDs.
- Public Skill IDs remain flat `dove.<surface>` names.
- User-facing failures use natural language and preserve actionable paths without exposing irrelevant internal transaction detail.
