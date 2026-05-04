# Autonomy Operate Research OS

## Goal

Implement `autonomy-operate` as the maximum-allowed autonomous research operating surface for `paper_factory`: a durable, governed workflow that can plan, materialize, approve, execute, monitor, and stop research-oriented work in one explicit foreground invocation while preserving auditability, safety boundaries, and project conventions.

## What I already know

* The user requested: "实现完全自治研究操作系统" (implement a fully autonomous research operating system).
* The project already has recent commits related to governed autonomy, operator governance MCP handlers, lifecycle mirror debugging guidance, and campaign runtime loops.
* Existing public surfaces include `autonomy-once` and `autonomy-foreground` CLI commands, MCP tools `run_autonomy_once` and `run_autonomy_foreground`, and durable runtime/program/campaign artifacts under `.paper/runtime/` and `.paper/programs/`.
* Existing governance intentionally treats autonomy as explicitly invoked, foreground-only, planner-supervised, bounded by approvals, leases, runtime events/results, and durable continuation state.
* README and project quality guidelines explicitly forbid hidden daemons, hidden schedulers, host-level hook interception, and auto-applying proposal-only optimizer outputs.
* This is a complex, multi-surface task likely touching CLI/operator commands, MCP tools, durable state, command docs, governance classification, and validation tests.

## Assumptions (temporary)

* "完全自治" means maximum autonomy allowed by this repo's explicit governance model, not unrestricted or hidden execution.
* The desired system should build on existing governed autonomy patterns rather than replace them wholesale.
* MVP should prioritize a usable autonomous research operating surface with observability and operator control over broad speculative features.

## Open Questions

* None.

## Decision (ADR-lite)

**Context**: The current repo has explicit foreground autonomy, campaign planning, materialization, and approval primitives, but no single high-level operating-system entrypoint that accepts a research objective and composes those primitives.
**Decision**: Add a new `autonomy-operate` surface rather than overloading `autonomy-foreground` or relying on prompt-only orchestration.
**Consequences**: This creates a clearer maximum-autonomy contract, but requires aligned updates across core exports, CLI, MCP definitions/handlers, governance classification, validators/tests, and operator command docs.

## Requirements (evolving)

* MVP scope: maximum autonomy allowed by this repo's explicit governance model.
* `autonomy-operate` input contract is Hybrid: if `sourceType/sourceId` are provided, reuse the existing proposal source; otherwise accept an operator-provided `objective` and create/select an objective-derived proposal source before continuing.
* Starting from an operator-provided research objective or existing proposal source, the system should be able to generate or update a campaign/program plan, materialize packet-bound work, issue bounded approvals, run foreground autonomy, and stop at a declared durable stop condition.
* Reuse existing governed autonomy, campaign planning, approval, continuation, and runtime patterns where possible.
* Preserve auditability through durable artifacts and operator-visible state.
* Keep implementation aligned with Trellis/frontend package guidelines.
* Do not introduce hidden daemons, hidden schedulers, host-level hook interception, or auto-application of proposal-only meta recommendations.
* The autonomy remains explicitly invoked, foreground-only, bounded, planner-supervised, and durable.
* Objective-derived operation uses Safe defaults: when detailed payloads are missing, generate a bounded research/review sequence (`refresh-research-brief`, `refresh-wiki`, `run-review-loop`) and avoid placeholder note/claim/experiment mutations.

## Acceptance Criteria (evolving)

* [x] A clear MVP scope is agreed before implementation: maximum allowed autonomy within explicit governance constraints.
* [ ] Existing autonomy-related modules and command surfaces are inspected and reflected in the technical approach.
* [ ] The implementation includes tests/validation appropriate to changed surfaces.
* [ ] The result remains foreground-only, bounded, durable, and governance-auditable unless the project explicitly changes its safety stance.
* [ ] A single invocation can advance from objective/campaign intent through governed planning, bounded approval, foreground execution, and durable summary/stop state where inputs are sufficient.
* [ ] Objective-derived operation uses safe default steps and does not invent placeholder payloads for note, audit, bridge, or claim mutations.
* [ ] Source-first operation can reuse an existing proposal source and follow the same materialize/approve/run path.

## Definition of Done (team quality bar)

* Tests added/updated where appropriate.
* `npm run check` or relevant project checks pass.
* Docs/notes updated if behavior changes.
* Rollout/rollback and operator safety considered if risky.

## Out of Scope (explicit)

* Unbounded autonomous actions without explicit governance controls.
* Destructive external actions, mass targeting, or unsafe security behavior.

## Technical Notes

* Initial repo context indicates Node.js ESM runtime and operator surfaces in CLI, MCP, `.opencode/commands/`, and durable `.paper/` artifacts.
* `src/core/runtime.mjs` exposes `runAutonomyControlPlaneOnce` and `runAutonomyForeground`; foreground runs chain only `execute-materialized-packet` and `continue-program-envelope` continuations up to `maxSteps`.
* `src/core/navigation.mjs` exposes `planCampaign`, `issueProgramApproval`, `queryCampaigns`, `queryProgramApprovals`, `recordOperatorFollowThrough`, and `materializeGuidancePacket`.
* `bin/paper-factory.mjs` currently exposes `autonomy-once` and `autonomy-foreground`, but no one-shot high-level operating-system entrypoint that accepts an objective and performs plan/materialize/approve/run orchestration.
* `src/mcp/tool-definitions.mjs`, `src/mcp/handlers.mjs`, `tests/integration/mcp-tools.test.mjs`, and `scripts/validate-mcp.mjs` assert exact MCP tool surfaces.
* `scripts/validate-commands.mjs` asserts exact OpenCode command files and governance classification for command surfaces.
* Likely implementation path: add a shared core orchestration function that composes existing planning/materialization/approval/foreground primitives, then expose it through CLI/MCP and optionally an OpenCode command.
* Existing allowed autonomous step types are `refresh-research-brief`, `refresh-wiki`, `upsert-note`, `run-experiment-audit`, `bridge-result-to-claim`, and `run-review-loop`.
* Existing approval logic supports `autonomyPolicy: objective-aware-default`, deriving a bounded step sequence from objective/current phase when no explicit sequence is provided.
* Existing `materializeGuidancePacket` requires a known proposal source (`remediation-pack`, `operator-playbook`, or `execution-bridge-candidate`) plus `executeBy` and `reviewAfter`; `autonomy-operate` should select an existing source automatically when provided, or create an objective-derived `execution-bridge` packet candidate before materialization.
* Hybrid input contract decision: provided `sourceType/sourceId` are authoritative; otherwise `objective` creates a proposal-only execution bridge candidate under `.paper/meta/execution-bridge-candidates.json` and continues through the same materialization/approval/runtime path.

## Research Notes

### Constraints from comparable patterns already in this repo

* Proposal surfaces (`paper.meta-optimize`) must remain proposal-only until explicitly bridged.
* Campaign planning records intent but must not execute by itself.
* Approval issuance is governance bookkeeping and must be single-use / bounded.
* Foreground autonomy is allowed to chain bounded continuations, but not become a hidden scheduler.

### Feasible approaches here

**Approach A: Add `autonomy-operate` as a new maximum-autonomy entrypoint** (Recommended)

* How it works: add one core function, one CLI command, one MCP tool, and one OpenCode command that accepts objective/campaign parameters and composes plan -> materialize -> approve -> foreground run.
* Pros: clear new contract; avoids changing existing `autonomy-foreground` semantics; easiest to validate as an OS-level surface.
* Cons: adds a new public surface that must be classified in governance and validators.

**Approach B: Extend `autonomy-foreground` with objective/campaign flags**

* How it works: keep one runtime command and add flags such as `--objective`, `--campaign-id`, and `--auto-plan`.
* Pros: fewer command names; builds on existing user habit.
* Cons: blurs existing foreground semantics; higher risk of accidental behavior changes in tests and docs.

**Approach C: Prompt-only command that chains existing MCP tools**

* How it works: add only `.opencode/commands/paper.autonomous-research.md` that instructs the operator/agent to call existing MCP tools in sequence.
* Pros: smallest code change.
* Cons: not a deterministic package behavior; weaker tests; less like a real operating-system primitive.
