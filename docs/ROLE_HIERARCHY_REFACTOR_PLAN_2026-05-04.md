# Role Hierarchy Refactor Plan

Timestamp: 2026-05-04T14:01:33+0800

## Goal

Refactor `paper_factory` role semantics from six peer-looking roles into three manually switchable primary agents with automatic subagents underneath.

The target model is:

```text
planner  -> mentor / PI / editor / orchestration owner
author   -> paper builder / writer / research and experiment worker
reviewer -> independent critic / external-review simulator
```

Specialized roles remain useful, but they should not appear as peer top-level identities. They become automatic subagents, modes, or capabilities owned by one of the three primary agents.

## Why

The current visible role set makes responsibilities feel unclear:

```text
planner
researcher
reviewer
rebuttal-lead
experiment-planner
version-analyst
```

Those entries are not actually the same layer:

- `planner` is a coordination role.
- `researcher` and `experiment-planner` are author-side production specialties.
- `reviewer` is an independent adversarial role.
- `rebuttal-lead` is author-side revision/response work.
- `version-analyst` is a diff/revision audit capability that mainly serves planner decisions.

The refactor should make this hierarchy explicit so manual role switching stays simple and reviewer isolation remains clean.

## Target Role Hierarchy

### Primary agents

| Primary agent | Human analogy | Responsibility | Must not do |
| --- | --- | --- | --- |
| `planner` | Mentor / PI / editor | Set direction, choose phase, prioritize tasks, coordinate handoffs, supervise governance/autonomy | Produce final paper content or issue independent review verdicts |
| `author` | Actual paper worker / builder | Write and revise the paper, gather evidence, plan experiments, interpret results, prepare responses | Pretend to be the independent reviewer or self-approve review verdicts |
| `reviewer` | External reviewer / critic | Attack claims, find evidence gaps, audit methods/results, issue concerns/verdicts | Write author-side rebuttals or repair the paper for the author |

### Automatic subagents / capabilities

```text
planner
  - task-planner
  - orchestration-manager
  - governance-checker
  - priority-ranker
  - version-analyst / revision-auditor

author
  - researcher
  - experiment-planner
  - result-analyst
  - paper-writer
  - revision-lead / rebuttal-helper

reviewer
  - claim-critic
  - evidence-auditor
  - experiment-auditor
  - methodology-critic
  - novelty-critic
```

## Compatibility Strategy

Do not remove all legacy role IDs in one step. Existing `.paper/` state, tests, command text, governance entries, and MCP policy descriptions still reference legacy role IDs.

Use a staged migration:

1. Add explicit primary-role and subagent metadata to `src/core/schema.mjs`.
2. Keep legacy subagent IDs valid for reading old artifacts and internal routing.
3. Change user-facing/manual ownership defaults toward `planner`, `author`, and `reviewer`.
4. Replace `rebuttal-lead` user-facing semantics with author-side `revision-lead`/`rebuttal-helper` wording.
5. Treat `version-analyst` as a planner-owned audit subagent rather than a manual top-level agent.
6. Update commands, skills, docs, MCP descriptions, and tests once code contracts stabilize.

## Initial Code Contract Direction

- Add constants:
  - `PRIMARY_ROLE_IDS = ["planner", "author", "reviewer"]`
  - `SUBAGENT_ROLE_IDS = ["researcher", "experiment-planner", "revision-lead", "rebuttal-lead", "version-analyst"]`
  - `ROLE_HIERARCHY` or equivalent metadata with parent ownership and manual-switchability.
- Preserve `ROLE_IDS` as the full accepted role universe during migration.
- Add helper semantics where useful:
  - primary/manual role validation should use primary roles.
  - durable legacy role validation can continue to accept subagent IDs.
- Update default board role roster to show three primary agents first and subagents as nested capabilities.
- Update phase ownership defaults:
  - author-side phases route to `author` unless a specialist is only used internally.
  - version/diff audit routes through `planner` while naming `version-analyst` as a subagent.
  - review remains `reviewer`.

## Refactor Boundaries

### In scope

- `src/core/schema.mjs` role constants, defaults, workflow boundaries, and role roster.
- `src/core/orchestration.mjs` phase ownership and guarded role expectations.
- `src/core/navigation.mjs` role context paths, ownership summaries, and role manifest generation.
- MCP tool descriptions and policy wording.
- OpenCode command/skill documentation that exposes role identity.
- Tests that assert old peer-role expectations.
- User docs explaining the role model.

### Out of scope for the first pass

- Deleting all old `.paper/context/roles/<legacy>.json` compatibility artifacts.
- Removing existing command names such as `paper.rebuttal` or `paper.version-compare`.
- Changing isolated reviewer privacy guarantees.
- Adding hidden daemons, hidden schedulers, or automatic background reviewer sessions.

## Safety Rules

- Reviewer remains independent and adversarial.
- Rebuttal/revision work belongs to the author side.
- Version analysis is an audit capability, preferably planner-owned, not a top-level manual identity.
- Existing paper state should load without forcing users to manually migrate JSON.
- Governance checks should remain explicit for mutating surfaces.

## Implementation Tasks

1. Record this plan with a timestamp.
2. Map existing role references and decide which are primary vs subagent vs legacy alias.
3. Add schema-level hierarchy metadata and compatibility helpers.
4. Update role ownership defaults in orchestration/navigation.
5. Update MCP descriptions and command/skill docs.
6. Update tests and validators.
7. Run focused tests, then `npm run check`.

## Expected Result

After the refactor, operators should understand the system as:

```text
planner decides
 author builds and revises
 reviewer criticizes
```

Specialists still exist, but as automatic subagents under these primary roles rather than confusing manually switchable peers.
