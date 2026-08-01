# Component Guidelines

> Direct Skill, MCP, role, CLI, and durable-entity contracts for Dove.

---

## Overview

There are no browser components. Treat each direct Skill, generated adapter, primary responsibility Skill, CLI surface, MCP tool, and public report as a small component over shared core behavior.

- `src/core/command-manifest.mjs` owns the 12 Skill definitions, user wording, adapter binding, and host policy.
- `src/core/operation-registry.mjs` owns interaction, checkpoint, continuation, closure, and retry metadata.
- `src/mcp/tool-definitions.mjs` owns the 14 sealed public MCP schemas.
- `src/mcp/handlers.mjs` owns tool dispatch and public selector resolution.
- `src/core/public-reports.mjs` owns `report`, optional `researchHandoff`, and `hostControl` projection.
- `scripts/generate-command-adapters.mjs` renders canonical Skill metadata into 60 adapters.

## Three Public Layers

Keep these layers distinct:

1. A **Skill** is a direct user-facing workflow invoked in the host, with optional text.
2. An **MCP tool** is a sealed structured operation used by one or more Skills, ambient intake, or typed closure handling.
3. A **durable entity** is validated current state persisted under `.dove/`.

The mapping is not one-to-one. A Skill may call several MCP tools, Skills may share a tool, and a Skill may create a normal project artifact rather than a same-named durable entity.

## Public Inventories

Dove exposes exactly 12 flat direct Skills:

- `dove.workspace`
- `dove.mission`
- `dove.status`
- `dove.lessons`
- `dove.source`
- `dove.note`
- `dove.experience`
- `dove.experiment`
- `dove.draft`
- `dove.figure`
- `dove.review`
- `dove.rebuttal`

Dove exposes exactly 14 canonical MCP tools and 60 generated adapters, 12 per host format for OpenCode, Codex, Cursor, shared agents, and Claude Code.

OpenCode has exactly three primary responsibility Skills: Planner, Builder/Author, and Reviewer.

## Direct Skill Contract

- Every Skill runs directly and accepts optional user text.
- A new independent goal routes to a root Mission.
- Continuation, narrowing, comparison, recovery, or follow-up routes to a child Mission with explicit parent provenance.
- Existing work uses the exact visible one-based Mission number.
- A project-wide research-direction change uses `dove.workspace`.
- Mission contracts remain proportional to the request.

Adapters are thin projections. They state purpose, examples, required MCP tools, Skill-specific notes, and the canonical host policy. They do not contain durable schemas, private identifiers, permission internals, direct state access, or alternative execution routes.

## Domain Semantics

- **Source** means external material discovered and captured with host-native tools before Dove registration.
- **Note** means internal synthesis written as a substantive project artifact; Dove has no Note durable entity.
- **Experience** means experimental conception and prevalidation before formal protocol freeze; Dove has no Experience sidecar entity.
- **Experiment** means the formal frozen protocol and later full-denominator result with failures, raw evidence, measured effects, and declared checks.

## Primary Responsibilities

- Planner defines goals, scope, dependencies, evidence needs, and completion conditions.
- Builder/Author performs substantive research, code, writing, experiments, figures, revisions, and author-side rebuttal.
- Reviewer independently assesses a frozen declared scope and returns findings only.

Dove core enforces safety, evidence, ownership, and authority boundaries. Prompts stay focused on user tasks.

## Output Contract

Human output comes from `report`. `researchHandoff` and `hostControl` remain machine-only. A supplied typed closure request fixes its tool and bound arguments and is invoked exactly once.

All public selection uses visible one-based Mission numbers. Durable IDs, hashes, paths, and integrity controls remain internal.

## Current Durable Model

Dove persists Workspace revisions, Missions, ResearchDecisions, execution Receipts, artifact handoffs, Sources, Claims, Experiments, Reviews, and one canonical `.dove/LESSONS.md` document. Draft, Figure, and Rebuttal bodies remain normal project artifacts; Dove archives their current paths through Receipts rather than mirrors.

Review freezes one scope, launches one isolated native Reviewer, and archives one structured non-authoritative return. Schema 18 is a clean current-only cutover with no state migration or fallback runtime.

## Review Checklist

- Are Skill, MCP, and durable-entity terms used correctly?
- Do all five host formats expose the same 12 Skills?
- Does every direct Skill preserve optional text and root/child Mission routing?
- Are the 14 MCP tools sealed and reachable through canonical operations?
- Are Source/Note and Experience/Experiment boundaries clear?
- Are machine channels kept out of user-facing prose?
