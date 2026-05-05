# Dove refactor plan — 2026-05-04

## Purpose

`Dove` is the intended long-term product direction for `paper_factory`: a unified local-first workflow system where AI agents can be launched toward a goal, perform bounded work, and return with auditable results, evidence, logs, and handoffs.

The rename should not turn the system into a loose collection of unrelated profiles. Dove should remain one simple workflow system with a shared mission model that can handle paper writing, engineering work, experiments, review, and general research tasks.

## Core metaphor

A Dove workflow should behave like a trained white dove:

1. The operator gives it a destination, constraints, and return protocol.
2. The agent flies out to perform bounded work.
3. The agent returns with concrete deliverables, evidence, and a handoff.
4. The system records the mission, route, checkpoint, review state, and acceptance outcome durably.

## Non-negotiable constraints

1. Preserve existing `paper_factory` capabilities.
   - Paper writing, claim/evidence discipline, citation hygiene, review loops, rebuttal, version comparison, paper audit, onboarding, and experiment integration must remain first-class capabilities.
   - The Dove transition should strengthen paper workflows rather than dilute them.

2. Keep the system unified and simple.
   - Avoid building many separate branches such as independent paper, engineering, experiment, and review systems.
   - Prefer one mission model with lightweight domain-specific fields.

3. Preserve multi-agent separation.
   - Planner, builder/author, and reviewer remain stable primary roles.
   - Reviewer independence and isolated review handoff workflows must remain available.
   - Subagents may exist, but they should not become confusing manually switchable peer roles.

4. Preserve durable file-first operation.
   - Mission state, handoffs, approvals, audits, results, and summaries must live in durable files.
   - Private agent memory or chat transcript should not be the source of truth.

5. Preserve explicit bounded autonomy.
   - No hidden daemon, hidden scheduler, hidden swarm, or unbounded queue drain.
   - Autonomy remains explicit, foreground-visible, approval-aware, and checkpointed.

## Target mental model

Dove should expose one coherent workflow:

```text
Dove
├── one router: dove.orchestrate
├── one work unit: mission packet
├── one board: mission board
├── one lifecycle: goal → design → checklist → execution → audit → return
├── one durable root: .paper/ now; .paper/workspace/dove-root-manifest.json records .dove/ as planned
└── domain extensions: paper, engineering, experiment, review, general
```

The domain should be a property of a mission, not a separate product branch.

Example:

```json
{
  "goal": "Reproduce the experiment and update the paper result section.",
  "domain": "paper-experiment",
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

The current paper lifecycle should be generalized without losing its paper-specific power:

| Current paper concept | Dove generalized concept |
|---|---|
| objective | goal / requirement / destination |
| structure | design / architecture / work structure |
| campaign | mission series / program / milestone |
| work-unit | mission packet / task / ticket |
| concern | risk / bug / reviewer concern / blocker |
| audit | validation / review / regression check |
| knowledge | evidence / notes / docs / logs / references |

Major work should continue to close through:

```text
goal → design → checklist → execution → audit → return
```

This keeps the current `design → checklist → implementation → acceptance` discipline while making it usable for both papers and engineering work.

## Multi-agent model

Dove keeps three primary roles:

| Role | Paper meaning | Engineering meaning |
|---|---|---|
| planner | PI / mentor / editor | tech lead / architect / project planner |
| builder | author / researcher / experiment worker | developer / implementer / operator |
| reviewer | independent paper reviewer | code reviewer / QA / security reviewer |

Role boundaries:

1. Planner decides destination, scope, constraints, priorities, and acceptance criteria.
2. Builder performs the work: writing, coding, experiments, data analysis, revision, and implementation.
3. Reviewer independently criticizes outputs, finds gaps, audits evidence, reviews code, and checks acceptance.

Subagents should remain grouped under these primary roles:

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

The reviewer must not silently share the builder's private transcript. Isolated reviewer workflows should continue to pass only explicit frozen inputs and returned handoff artifacts.

## Migration strategy

### Phase 1 — Name the direction without breaking anything

- Keep `paper_factory`, `paper-factory`, `paper.*`, and `.paper/` working.
- Add documentation that describes Dove as the long-term unified workflow direction.
- Start using neutral concepts in new internal design language: mission, goal, return, flight, checkpoint, audit.

### Phase 2 — Introduce neutral aliases

- Add optional Dove-facing aliases for key surfaces, such as:
  - `dove.orchestrate`
  - `dove.mission`
  - `dove.board`
  - `dove.audit`
  - `dove.return`
- Current compatibility slice implements these as read-only command surfaces that frame, route, audit, or inspect return readiness while delegating execution to existing paper commands.
- Current core/MCP/CLI parity exposes all five read-only Dove surfaces through `query_dove_orchestrate`, `query_dove_mission`, `query_dove_mission_board`, `query_dove_audit`, `query_dove_return`, `paper-factory dove-<surface>`, nested `paper-factory dove <surface>`, and the limited `dove <surface>` alias.
- Current governed write parity adds `dove.launch`, `launch_dove_mission`, `paper-factory dove-launch`, nested `paper-factory dove launch`, and `dove launch` as a wrapper over accepted guidance materialization into Dove mission packets backed by `.paper/task-packets`; it requires `sourceType`, `sourceId`, `executeBy`, and `reviewAfter`, does not execute autonomy, and does not create `.dove` state.
- Current workspace metadata records the selected staged dual-name identity: Dove is the product model, `paper-factory` is the compatibility package/CLI, `.paper/` is still the active authoritative durable root, and `.dove/` remains a future migration target.
- Current durable-root migration metadata is manifest-only: `.paper/workspace/dove-root-manifest.json` records the no-dual-root invariant and blocks `.dove/` from becoming authoritative without explicit breaking-change approval.
- Optional Claude Code, Cursor, Codex, and shared agent adapters expose the same five read-only Dove compatibility surfaces plus the governed launch surface while preserving the no-refresh/no-test/no-git/no-autonomy contract.
- Keep paper commands as compatibility and paper-optimized entrypoints.
- Ensure Dove aliases call the same core logic rather than forking behavior.

### Phase 3 — Generalize internals carefully

- Gradually rename internal abstractions where they are truly domain-neutral:
  - task packet → mission packet
  - handoff → return artifact
  - autonomy run → flight
  - objective → goal
- Do not rename paper-specific concepts that should remain paper-specific:
  - claim
  - citation
  - rebuttal
  - reviewer concern
  - paper audit

### Phase 4 — Add engineering capability through the same model

- Represent engineering work as missions with design, checklist, execution, audit, and return fields.
- Current compatibility slice adds `engineering` domain guidance and explicit mission-packet domain hints (`doveDomain`, `missionDomain`, or `domain`) while keeping the same `.paper/task-packets` backing store and workspace index.
- Reuse the same board, packet, audit, approval, and review model.
- Add engineering-specific audit signals such as tests, code review, regressions, build output, and security findings.

### Phase 5 — Decide on `.dove/` migration

- Only consider an authoritative durable-root migration after compatibility is stable and a breaking migration is explicitly approved.
- Current implementation provides a manifest-only migration strategy at `.paper/workspace/dove-root-manifest.json`; it records `.paper/` as authoritative, `.dove/` as planned, and possible authoritative `.dove` workspace files as doctor-detected conflicts.
- Preserve `.paper/` compatibility for existing paper projects.

## Explicit non-goals

- Do not replace paper workflows with a generic task manager.
- Do not create disconnected paper/engineering/experiment products.
- Do not remove `paper.*` commands before mature Dove aliases exist.
- Do not weaken claim/evidence/citation/rebuttal/version functionality.
- Do not collapse planner, builder, and reviewer into one undifferentiated agent.
- Do not make autonomy hidden, background-only, or unbounded.

## Success criteria

The Dove refactor is successful only if all of the following remain true:

1. Existing paper workflows still work and are easier to explain.
2. Engineering tasks can use the same mission lifecycle without needing a separate system.
3. Multi-agent separation is clearer than before.
4. Reviewer isolation remains available.
5. Every mission has a goal, bounded execution surface, return artifact, and acceptance/audit path.
6. The user sees one coherent Dove system, not a collection of fragmented modes.
