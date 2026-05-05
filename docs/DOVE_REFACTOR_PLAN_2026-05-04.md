# Dove direct migration note — 2026-05-05

## Purpose

Dove is the unified local-first workflow system where AI agents can be launched toward a goal, perform bounded work, and return with auditable results, evidence, logs, and handoffs.

The project has moved to the direct Dove model:

- `dove` is the package name.
- `dove` is the public CLI binary.
- `dove` is the MCP server identity.
- `.dove/` is the single authoritative durable workspace root.
- Paper writing is a Dove mission domain, not the product identity.

Old `.paper/` state is legacy state. Dove may report it during health checks, but runtime operations do not import it or treat it as authority.

## Core metaphor

A Dove workflow behaves like a trained white dove:

1. The operator gives it a destination, constraints, and return protocol.
2. The agent flies out to perform bounded work.
3. The agent returns with concrete deliverables, evidence, and a handoff.
4. The system records the mission, route, checkpoint, review state, and acceptance outcome durably.

## Non-negotiable constraints

1. Preserve paper capabilities.
   - Paper writing, claim/evidence discipline, citation hygiene, review loops, isolated review, rebuttal, version comparison, paper audit, onboarding, and experiment integration remain first-class capabilities.
   - The Dove transition should strengthen paper workflows rather than dilute them.

2. Keep the system unified and simple.
   - Avoid separate product branches for paper, engineering, experiment, and review work.
   - Prefer one mission model with lightweight domain-specific fields.

3. Preserve multi-agent separation.
   - `planner`, `builder`, and `reviewer` are the primary roles.
   - Reviewer independence and isolated review handoff workflows remain available.
   - Specialists are subagents, not confusing peer manual roles.

4. Preserve durable file-first operation.
   - Mission state, handoffs, approvals, audits, results, and summaries live in `.dove/` files.
   - Private agent memory or chat transcript is not the source of truth.

5. Preserve explicit bounded autonomy.
   - No hidden daemon, hidden scheduler, hidden swarm, or unbounded queue drain.
   - Autonomy remains explicitly invoked, foreground-visible, approval-aware, and checkpointed.

## Target mental model

```text
Dove
├── one router: dove.orchestrate
├── one work unit: mission packet
├── one board: mission board
├── one lifecycle: goal → design → checklist → execution → audit → return
├── one durable root: .dove/
└── domain extensions: paper, engineering, experiment, review, general
```

The domain is a property of a mission, not a separate product branch.

Example:

```json
{
  "goal": "Reproduce the experiment and update the paper result section.",
  "domain": "paper",
  "stage": "execution",
  "artifacts": ["code", "results", "draft-section", "claim"],
  "acceptance": [
    "tests pass",
    "result is logged",
    "claim bridge is updated",
    "paper audit has no blocking finding"
  ]
}
```

## Unified lifecycle

| Paper concept | Dove generalized concept |
|---|---|
| objective | goal / requirement / destination |
| structure | design / architecture / work structure |
| campaign | mission series / program / milestone |
| work-unit | mission packet / task / ticket |
| concern | risk / bug / reviewer concern / blocker |
| audit | validation / review / regression check |
| knowledge | evidence / notes / docs / logs / references |

Major work should close through:

```text
goal → design → checklist → execution → audit → return
```

This keeps the paper `design → checklist → implementation → acceptance` discipline while making it usable for engineering work.

## Multi-agent model

| Role | Paper meaning | Engineering meaning |
|---|---|---|
| planner | PI / mentor / editor | tech lead / architect / project planner |
| builder | author / researcher / experiment worker | developer / implementer / operator |
| reviewer | independent paper reviewer | code reviewer / QA / security reviewer |

Role boundaries:

1. Planner decides destination, scope, constraints, priorities, and acceptance criteria.
2. Builder performs writing, coding, experiments, data analysis, revision, and implementation.
3. Reviewer independently criticizes outputs, finds gaps, audits evidence, reviews code, and checks acceptance.

Subagents remain grouped under these primary roles:

```text
planner
├── version analyst
├── priority planner
└── governance checker

builder
├── researcher
├── experiment planner
├── implementer
├── result analyst
└── revision / rebuttal helper

reviewer
├── claim critic
├── evidence auditor
├── code reviewer
├── test auditor
└── methodology critic
```

The reviewer must not silently share the builder's private transcript. Isolated reviewer workflows pass only explicit frozen inputs and returned handoff artifacts.

## Direct migration scope

The direct migration keeps capabilities while removing old public identity surfaces:

- package metadata points to Dove
- the public binary is `dove`
- MCP server identity is `dove`
- local durable state lives under `.dove/`
- workspace authority is recorded in `.dove/manifest.json`
- active command IDs use Dove language
- active roles use `planner`, `builder`, and `reviewer`
- paper workflows continue under Dove paper-domain commands

## Success criteria

The migration is successful only if all of the following remain true:

1. Existing paper workflows still work and are easier to explain.
2. Engineering tasks use the same mission lifecycle without needing a separate system.
3. Multi-agent separation is clearer than before.
4. Reviewer isolation remains available.
5. Every mission has a goal, bounded execution surface, return artifact, and acceptance/audit path.
6. `.dove/` is the only runtime authority.
7. The user sees one coherent Dove system, not fragmented modes.
