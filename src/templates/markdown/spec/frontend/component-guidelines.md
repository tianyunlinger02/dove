# Component Guidelines

> Direct Skill, MCP, role, CLI, and semantic-entity contracts for Dove.

---

## Overview

There are no browser components. Treat each direct Skill, generated adapter, primary responsibility, runtime CLI surface, MCP tool, research projection, and semantic entity as a small component over shared core behavior.

- `src/core/command-manifest.mjs` owns the 9 Skill definitions, user wording, adapter binding, and host policy.
- `src/mcp/tool-definitions.mjs` owns the 8 sealed public MCP schemas.
- `src/mcp/research-adapter.mjs` maps public operations to Research Format 1 core behavior.
- `src/mcp/handlers.mjs` owns exact tool dispatch and safe public projection.
- `scripts/generate-command-adapters.mjs` renders canonical Skill metadata into 45 adapters.
- Project-installation modules own installation state and must not become research-operation components.

## Public Layers

Keep these layers distinct:

1. A **Skill** is a direct user-facing workflow invoked in the host, with optional text.
2. An **MCP tool** is a sealed structured research operation used by one or more Skills.
3. A **semantic entity** is validated Research Format 1 state persisted under `.dove/`.
4. A **project artifact** is substantive host-produced work in a normal project path.
5. An **installation resource** is Dove-managed host integration recorded by `.dove/install/manifest.json` under the single project-private root.

The mapping is intentionally many-to-many. A Skill may call several tools, Skills may share a tool, and work such as Draft, Figure, Rebuttal, or internal synthesis may produce a project artifact without a same-named semantic entity.

## Public Inventories

Dove exposes exactly 9 flat direct Skills:

- `dove.research`
- `dove.status`
- `dove.source`
- `dove.experiment`
- `dove.draft`
- `dove.figure`
- `dove.review`
- `dove.rebuttal`
- `dove.lessons`

Dove exposes exactly 8 canonical MCP tools:

- `query_dove_research`
- `manage_dove_workspace`
- `manage_dove_missions`
- `manage_dove_sources`
- `manage_dove_experiments`
- `manage_dove_claims`
- `manage_dove_reviews`
- `manage_dove_lessons`

The generator emits 45 adapters, 9 per host format for OpenCode, Codex, Cursor, shared agents, and Claude Code. OpenCode also has exactly three primary responsibility Skills: Planner, Builder/Author, and Reviewer.

## Direct Skill Contract

- Every Skill runs directly and accepts optional user text.
- Skills route work and select the smallest necessary MCP operation; they do not create a Mission merely because they were invoked.
- Durable selection uses semantic IDs such as `missionId`, `sourceId`, `experimentId`, `claimId`, `exchangeId`, and `reviewId`.
- `dove.research` covers Workspace and Mission research, internal synthesis, and bounded project work.
- `dove.status` is read-only.
- Draft, Figure, and Rebuttal produce or revise ordinary project artifacts and register research state only when needed.
- Mission contracts remain proportional to the request.

Adapters are thin projections. They state purpose, examples, required MCP tools, Skill-specific notes, and canonical host policy. They do not contain durable schemas, direct state access, private control protocols, CLI or shell fallback routes, or installation mutations.

## Domain Semantics

- **Source** is captured external material registered with its relationship, conditions, conflicts, and limitations.
- **Internal synthesis** is host work in a normal project artifact; Research Format 1 has no Note entity.
- **Experiment** freezes a plan before host execution and later records the full result, including denominator, failures, deviations, limitations, uncertainty, and expected or unexpected observations.
- **Claim** is a separate semantic entity bounded by support, counter-evidence, missing evidence, uncertainty, assessment, and explicit cannot-say limits.
- **Review** is a user-managed separate exchange. Dove preflights and freezes declared artifact paths, prepares the exchange, imports a structured return obtained by the user in another reviewer session, and reports coverage. Dove never launches or impersonates the reviewer.

## Primary Responsibilities

- Planner defines goals, scope, dependencies, evidence needs, and completion conditions.
- Builder/Author performs substantive research, code, writing, experiments, figures, revisions, and author-side rebuttal.
- Reviewer assesses only the frozen declared scope in a separate user-managed exchange and returns findings without edits.

Dove core enforces safety, evidence, ownership, and authority boundaries. Prompts stay focused on the user's task.

## Output Contract

MCP results return human text plus a structured `research` projection. The projection removes private write diagnostics, hashes, bindings, `.dove/` paths, and other integrity internals. No private execution protocol is part of the public result.

A host return, test result, local review, imported review, Mission conclusion, or recorded result remains bounded evidence. None alone establishes completion, independence, acceptance, or scientific authority.

## Research Format 1 Model

Dove persists one Workspace, root and child Mission contracts, optional Mission conclusions, Sources, Experiment plans and results, Claims, Reviews, and one canonical `.dove/LESSONS.md`. The Mission tree is lineage over Mission records, not a second store. Normal project artifacts remain outside `.dove/`.

Unsupported or unknown `.dove/` formats are recognized without mutation and refused for writes. Research Format 1 has no migration, overlay upgrade, archive replacement, or fallback runtime.

## Project Integration

`.dove/` is the single project-private root. `.dove/install/manifest.json` owns managed installation state, while Research Format 1 siblings are optional research state. `init` establishes host integration, `sync` refreshes recorded hosts, Upgrade refreshes project integration while preserving current research bytes, Complete Reinstall deletes and recreates project-private Dove state after exact preview and default-No confirmation, and `doctor` reports installation and research health separately. Upgrade and Complete Reinstall never manage user npm. `.dove-install/` appears only as a legacy cleanup source for those two project-level lifecycle operations.

## Review Checklist

- Are Skill, MCP tool, semantic entity, project artifact, and installation resource terms used correctly?
- Do all five host formats expose the same 9 Skills?
- Are the 8 MCP tools sealed and reachable through canonical operations?
- Do Skills avoid automatic Mission creation and positional selectors?
- Are Source, internal synthesis, Experiment, Claim, and artifact boundaries clear?
- Is Review described as a user-managed separate exchange rather than an internally launched reviewer?
- Is ambient routing zero-write?
- Is the runtime CLI kept separate from research operations and direct state access?
- Is `.dove/` the single current root, with installation and optional research contracts clearly separated?
- Is `.dove-install/` mentioned only for Upgrade or Complete Reinstall legacy cleanup?
- Are project lifecycle operations explicitly separate from user npm management?
