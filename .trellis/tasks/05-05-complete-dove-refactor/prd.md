# Complete Dove refactor after compatibility parity

## Goal

Finish the long-horizon Dove transition after the five-surface read-only compatibility layer is stable. The end state should be one coherent Dove system that can handle paper, engineering, experiment, review, and general research missions without weakening the existing `paper_factory` paper workflow.

## Current baseline

The compatibility layer is complete as of 2026-05-05:

- Five read-only Dove surfaces exist: `orchestrate`, `mission`, `board`, `audit`, and `return`.
- Core/MCP/CLI parity exists for all five surfaces.
- Optional OpenCode, Claude Code, Cursor, Codex, and shared agent adapters expose the same five Dove surfaces.
- Dove compatibility queries are proposal-only and no-write: they do not refresh durable mirrors, run tests, inspect git, execute autonomy, update boards, append handoffs, or materialize packets.
- `.paper/` remains the active durable root.
- `.dove/` remains a planned future migration decision, not an independent source of truth.
- Validation passed for targeted checks, full `npm run check`, package dry-run, and CLI smoke checks.

## Remaining refactor phases

### 1. Package and public-name decision

Decide whether the project should remain `paper_factory` with a Dove-facing alias, become `dove`, or use a staged dual-name period.

Questions to resolve:

- Should the npm package name change?
- Should `paper-factory` remain as a compatibility binary?
- What is the deprecation policy for `paper.*` commands if Dove commands become primary?
- Which docs should lead with Dove versus `paper_factory`?

Acceptance criteria:

- A clear package-name and binary-name decision is recorded.
- Backward compatibility expectations are explicit.
- No rename is implemented before the compatibility/deprecation policy is decided.

### 2. Durable-root migration design

Design a safe migration from `.paper/` to `.dove/`, if the rename decision requires it.

Constraints:

- Do not create dual authoritative durable roots.
- Do not let `.paper/` and `.dove/` diverge silently.
- Existing paper projects must remain readable and recoverable.
- Migration must be explicit, auditable, and reversible where possible.

Possible outcomes:

- Keep `.paper/` indefinitely as the internal durable root and treat Dove as product language.
- Add `.dove/` as a thin compatibility pointer/manifest only.
- Add an explicit one-time migration command with `.paper/` compatibility fallback.

Acceptance criteria:

- One durable-root strategy is selected.
- Migration risks and rollback behavior are documented.
- Tests cover fresh install, existing `.paper/` project, migrated project, and malformed/double-root cases.

### 3. Governed mutating Dove lifecycle surfaces

After package/root decisions, add Dove-native or Dove-wrapper mutating lifecycle surfaces only where they improve the product.

Candidate surfaces:

- `dove.plan` / mission design
- `dove.checklist` / mission checklist
- `dove.execute` or explicit materialization bridge
- `dove.audit` as read-only remains separate from any write-review command
- `dove.return` as read-only remains separate from any closure/write command

Constraints:

- Preserve planner / builder / reviewer separation.
- Preserve isolated reviewer handoff workflows.
- Preserve explicit bounded autonomy: no hidden daemon, hidden scheduler, hidden swarm, or unbounded queue drain.
- Every mutating surface must be classified in governance and covered by negative tests.
- Do not weaken paper-specific capabilities: claims, citations, rebuttal, versioning, review loops, experiments, and paper audit remain first-class.

Acceptance criteria:

- Mutating Dove surfaces either wrap existing paper-compatible core safely or use shared neutral core without forking behavior.
- Governance registry, MCP definitions, CLI, adapters, docs, and validation scripts are aligned.
- `npm run check` passes.

### 4. Internal terminology unification

Generalize internal names only where the concept is truly domain-neutral.

Good candidates:

- task packet → mission packet where the object is no longer paper-specific
- objective → goal where the API is mission-generic
- return/evidence/handoff vocabulary where it improves clarity

Do not erase paper-specific concepts:

- claim
- citation
- rebuttal
- reviewer concern
- paper audit
- experiment-to-claim bridge

Acceptance criteria:

- The code becomes easier to explain as Dove without reducing paper workflow clarity.
- Old public fields remain compatible or have explicit migration handling.
- Tests cover old and new field aliases where compatibility is required.

### 5. Final release validation

Before calling the entire Dove refactor complete:

- Run command validation.
- Run MCP validation.
- Run governance audit.
- Run all tests.
- Run package dry-run.
- Run install/sync/doctor checks for all host adapters.
- Run CLI smoke checks for paper and Dove surfaces.
- Review docs for stale claims about `.paper/`, `.dove/`, package naming, autonomy, and host adapters.

Acceptance criteria:

- `npm run check` passes.
- `npm run pack:dry-run` passes.
- Fresh install and migrated workspace checks pass.
- User-facing docs describe one coherent Dove system and clearly state compatibility boundaries.

## Non-goals until explicitly approved

- Do not rename the npm package from `paper-factory` to `dove` without a recorded package/deprecation decision.
- Do not make `.dove/` authoritative while `.paper/` is still authoritative.
- Do not create independent `.dove/` mission state.
- Do not add mutating Dove lifecycle wrappers before governance and migration decisions are clear.
- Do not hide autonomy behind daemons, schedulers, swarms, or background queue drains.

## Definition of done for the entire refactor

The whole Dove refactor is complete only when:

1. Dove is the clear product model, not just a compatibility alias.
2. The package/binary/documentation naming strategy is resolved.
3. Durable root strategy is resolved and implemented or explicitly deferred.
4. Paper workflows still work without capability loss.
5. Engineering and experiment work use the same mission lifecycle cleanly.
6. Planner, builder/author, and reviewer roles remain clear and isolated where needed.
7. All public surfaces, host adapters, MCP tools, CLI commands, governance registries, docs, and tests agree.
8. Full validation and packaging checks pass.
