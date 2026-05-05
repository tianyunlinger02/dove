# Role hierarchy refactor note — 2026-05-05

## Goal

Dove uses three manually switchable primary roles with specialist subagents underneath:

```text
planner  -> mentor / PI / editor / orchestration owner
builder  -> paper worker / implementation worker / research and experiment executor
reviewer -> independent critic / external-review simulator
```

Specialized roles remain useful, but they are not peer top-level manual identities. They are automatic subagents, modes, or capabilities owned by one of the three primary roles.

## Why

The older visible role set made responsibilities feel unclear:

```text
planner
researcher
reviewer
rebuttal-lead
experiment-planner
version-analyst
```

Those entries are not the same layer:

- `planner` is a coordination role.
- `researcher` and `experiment-planner` are builder-side production specialties.
- `reviewer` is an independent adversarial role.
- `rebuttal-lead` is builder-side revision/response work.
- `version-analyst` is a diff/revision audit capability that mainly serves planner decisions.

The hierarchy makes manual role switching simple while keeping reviewer isolation clean.

## Target role hierarchy

### Primary roles

| Primary role | Human analogy | Responsibility | Must not do |
|---|---|---|---|
| `planner` | Mentor / PI / editor / tech lead | Set direction, choose phase, prioritize tasks, coordinate handoffs, supervise governance/autonomy | Produce final paper content or issue independent review verdicts |
| `builder` | Actual worker / writer / implementer | Write and revise papers, gather evidence, plan experiments, interpret results, prepare responses, implement engineering work | Pretend to be the independent reviewer or self-approve review verdicts |
| `reviewer` | External reviewer / critic / QA | Attack claims, find evidence gaps, audit methods/results, review code, issue concerns/verdicts | Write builder-side rebuttals or repair the output for the builder |

### Automatic subagents / capabilities

```text
planner
  - task-planner
  - orchestration-manager
  - governance-checker
  - priority-ranker
  - version-analyst / revision-auditor

builder
  - researcher
  - experiment-planner
  - result-analyst
  - paper-writer
  - implementer
  - revision-lead / rebuttal-helper

reviewer
  - claim-critic
  - evidence-auditor
  - experiment-auditor
  - methodology-critic
  - novelty-critic
  - code-reviewer
```

## Final code contract

- `PRIMARY_ROLE_IDS = ["planner", "builder", "reviewer"]`.
- Subagent role IDs remain valid for scoped contexts and internal routing.
- User-facing/manual ownership defaults use `planner`, `builder`, and `reviewer`.
- Builder-side phases route to `builder` unless a specialist is only used internally.
- Version/diff audit routes through `planner` while naming `version-analyst` as a subagent.
- Review remains `reviewer`.
- Rebuttal/revision work belongs to the builder side.
- Isolated reviewer privacy guarantees remain unchanged.

## Implementation boundaries

In scope:

- `src/core/schema.mjs` role constants, defaults, workflow boundaries, and role roster.
- `src/core/orchestration.mjs` phase ownership and guarded role expectations.
- `src/core/navigation.mjs` role context paths, ownership summaries, and role manifest generation.
- MCP tool descriptions and policy wording.
- OpenCode command/skill documentation that exposes role identity.
- Tests that assert primary-role expectations.
- User docs explaining the role model.

Out of scope:

- Collapsing reviewer into builder.
- Removing isolated reviewer handoff guarantees.
- Adding hidden daemons, hidden schedulers, or automatic background reviewer sessions.

## Expected result

Operators should understand the system as:

```text
planner decides
builder builds and revises
reviewer criticizes
```

Specialists still exist, but as automatic subagents under these primary roles rather than confusing manually switchable peers.
