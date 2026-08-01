# Hook Guidelines

> Reusable core helpers and bounded ambient entry.

---

## Overview

There are no React hooks. Hook-like abstractions are narrow helpers for Workspace access, contained mutation, evidence validation, ownership, lineage, and Mission-bound workflows.

The sole host-hook surface is the managed project-local Claude `UserPromptSubmit` ambient entry. Direct Skills remain explicit host workflows and are not routed through this hook.

## Helper Pipeline

A mutation helper should:

1. validate sealed public input;
2. classify the current Workspace;
3. load the selected root or child Mission context;
4. resolve current target and evidence references;
5. validate ownership, lineage, eligibility, and review coverage;
6. build the complete write set before mutation;
7. apply the contained write; and
8. return a result for shared public projection.

Read-only helpers stop before mutation. They do not initialize, repair, refresh, or convert state.

## Ambient Entry

Ambient entry applies only to selected non-slash prompts and has two hidden routes:

- `dove-intake` chooses `research` when work changes research understanding, experiments, evidence, or paper claims, otherwise `ordinary` for clear code, documentation, configuration, cleanup, or another bounded deliverable; it asks at most one zero-write clarification round, creates only through `create_ambient_dove_mission`, and resumes the original host task only after success.
- `dove-lessons-intake` handles explicit Lessons read, remember, or reflect requests through `manage_dove_lessons`, preserves the read binding for one full-document update, and creates no Mission.

A successful ambient Mission aligns with the current Workspace mainline. New independent work becomes a root Mission; continuation or follow-up uses explicit parent/child routing when the current request identifies existing work.

The hook keeps `researchHandoff` and `hostControl` machine-only. If a typed closure request is supplied, it invokes the fixed tool exactly once with every bound argument unchanged, required outcome fields supplied, and declared defaults applied.

The hook does not call direct Skill tools on the user's behalf, inspect durable files, echo the prompt, or replace normal host planning and execution.

## Domain Boundaries

- Source discovery and capture happen with host-native external retrieval before registration.
- Note work is internal synthesis into a normal artifact.
- Experience work is conception/prevalidation.
- Experiment recording begins at formal protocol freeze.

These boundaries do not create a ResearchTree, Note store, Experience sidecars, or another runtime route.

## Naming

- Core functions use verb-first camelCase.
- Normalizers use `normalize<Name>`.
- Validators use `validate<Name>` or `assert<Name>`.
- MCP tools use explicit snake_case task verbs.
- Public Skill IDs remain flat `dove.<surface>` names.
