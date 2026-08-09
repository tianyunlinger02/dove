# Hook Guidelines

> Reusable core helpers and zero-write ambient entry.

---

## Overview

There are no React hooks. Hook-like abstractions are narrow helpers for Research Format access, contained mutation, evidence validation, semantic identifiers, Mission lineage, and review-exchange workflows.

The sole host-hook surface is the managed project-local Claude `UserPromptSubmit` ambient entry. Direct Skills remain explicit host workflows and are not executed by this hook.

## Helper Pipeline

A mutation helper should:

1. validate sealed public input;
2. classify the current Research Format state;
3. load the selected semantic entities by ID;
4. resolve current project artifacts and evidence references;
5. validate lineage, ownership, frozen protocol or exchange bindings, and overwrite eligibility;
6. build the complete write set before mutation;
7. apply the contained write; and
8. return data for safe public research projection.

Read-only helpers stop before mutation. They do not initialize, repair, refresh, migrate, archive, convert, or replace research state.

## Ambient Entry

Ambient entry applies only to selected non-slash prompts and has two hidden routes:

- `dove-intake` makes one conservative, zero-write routing judgment across the 9 flat Skills and the Planner, Builder/Author, and Reviewer responsibilities. It may ask one zero-write clarification round for material ambiguity, but it does not create a Mission or invoke a research mutation merely because the hook selected the prompt.
- `dove-lessons-intake` handles explicit Lessons read, remember, or reflect requests through `manage_dove_lessons` and creates no Mission. A replacement reads the complete document before one complete update.

After routing, the host continues the original task normally. It uses public MCP research tools only when durable research state is actually needed. Slash commands retain their explicit routing.

The hook does not invoke direct Skills on the user's behalf, inspect `.dove/`, call the CLI or shell as a fallback, emit private execution data, or perform completion bookkeeping.

## Domain Boundaries

- Source discovery and capture happen with host-native retrieval before Source registration.
- Internal synthesis remains a normal project artifact.
- Experiment planning freezes a protocol before host execution; result recording resumes the same semantic Experiment.
- Draft, Figure, and Rebuttal work produces ordinary project artifacts and does not automatically create another record.
- Review uses a user-managed separate exchange: local preflight, prepare, user-mediated external reviewer session, import, and coverage. Dove does not launch the reviewer.
- Host output, tests, local review, imported review, and recorded results remain bounded evidence rather than completion or scientific authority.

## Naming

- Core functions use verb-first camelCase.
- Normalizers use `normalize<Name>`.
- Validators use `validate<Name>` or `assert<Name>`.
- MCP tools use explicit snake_case research verbs.
- Public Skill IDs remain flat `dove.<surface>` names.
- Use semantic identifiers rather than positional selectors.
- Use `research` for the safe structured public projection; do not reintroduce retired private-protocol terminology.
