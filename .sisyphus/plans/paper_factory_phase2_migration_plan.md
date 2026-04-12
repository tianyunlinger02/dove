# paper_factory Phase 2 Migration Plan

## Goal

Close the highest-value remaining gaps after the first OMO + ARIS + Trellis + AutoFigure-Edit migration wave, while keeping `paper_factory`:

- OpenCode-native
- file-first
- board-first
- deterministic at the MCP layer
- honest about host/runtime limits

This phase is explicitly **not** a clone of OMO, ARIS, Trellis, or AutoFigure-Edit. It is a second-wave migration of the strongest **portable** ideas that still materially increase capability.

---

## Non-goals

The following remain out of scope for phase 2:

1. Hidden schedulers or daemon-style autonomous background runtimes
2. Host-level hook interception or subagent interception semantics that depend on a custom harness
3. Full ARIS parity, including external reviewer runtimes and GPU execution bridges
4. Full Trellis parity, including required worktree automation and hook-driven context injection
5. Full AutoFigure-Edit parity, including embedded SVG editing UI, SAM3 integration, RMBG integration, and full multimodal render stack

---

## Research-backed phase 2 priorities

### Priority A — behavior and integrity control plane

Highest leverage because it improves nearly every workflow step.

1. **OMO-style intent gate and behavior discipline**
   - Add request classification and execution discipline before deep workflow execution.
   - Prevent “do something vague” from collapsing into premature drafting or review.

2. **Continuation enforcement and completion pressure**
   - Ensure unfinished packet/board work is visible and resumed intentionally.
   - Make current focus and next action durable instead of implied.

3. **ARIS-style adversarial review and experiment integrity**
   - Add a stronger, persisted reviewer memory / unresolved-concern layer.
   - Add experiment audit outputs that are distinct from execution results.
   - Keep audit/adversarial review file-first, not hidden-runtime based.

### Priority B — richer structured state

Needed so the control plane has something stronger to operate on.

4. **Typed research wiki / result-to-claim bridge**
   - Upgrade wiki from mostly synthesized markdown into typed durable records with relationships.
   - Make result-to-claim promotion more explicit and reviewable.

5. **Trellis-style richer packet graph and lifecycle**
   - Add parent/child task packets, dependency semantics, current focus, next action, and packet phase context.
   - Add stronger workspace/session indexing.

6. **Safer update discipline**
   - Move beyond boundary declarations into reconciliation/version/hash-aware managed artifacts where feasible.

### Priority C — adjacent but valuable expansion

7. **AutoFigure-inspired staged figure artifact pipeline**
   - Still keep this at the artifact-contract level, not a full rendering service.
   - Add method-text → figure-brief → segmentation placeholders → SVG template plan → final editable artifact contract.

---

## Implementation order

### Phase 2.1 — plan + discipline layer

#### Deliverables

- Intent gate classification surface
- Current-focus and next-action durability
- Stronger continuation semantics
- Review-before-finalize discipline for high-risk workflow stages

#### Files to modify

- `src/core/schema.mjs`
- `src/core/orchestration.mjs`
- `src/core/navigation.mjs`
- `src/core/workspace.mjs`
- `.opencode/commands/paper.orchestrate.md`
- `.opencode/commands/paper.pipeline.md`
- `.opencode/skills/paper-factory-pipeline/SKILL.md`
- new/updated tests under `tests/integration/`

#### Concrete changes

1. Add orchestration-intent fields to state and/or board:
   - `intentType`
   - `currentFocus`
   - `nextAction`
   - `continuationState`
   - `reviewRequiredBeforeFinalize`

2. Add deterministic helpers:
   - classify workflow intent
   - set current focus
   - set next action
   - mark continuation checkpoints

3. Make navigation/task graph show:
   - current focus
   - next action
   - unresolved blockers by role

4. Add command-level policy language that forces:
   - planning before implementation where needed
   - packet/board refresh before finalization
   - explicit verification step before completion claims

#### Acceptance criteria

- Board and packets show current focus and next action durably
- Pipeline command can explain “what should happen next” from files only
- Tests prove unfinished work remains visible after resume

#### Phase 2.1 verification

1. Run targeted tests for continuation and focus semantics:
   - `npm test -- --test-name-pattern="continuation|focus|next action|task graph"`
   - Expected result: new or updated tests for orchestration focus/continuation pass.
2. Run command/MCP validation:
   - `npm run commands:validate`
   - `npm run mcp:validate`
   - Expected result: any new intent/continuation command or tool surfaces are registered and validated.
3. Manual doctor check after local changes:
   - `node ./bin/paper-factory.mjs doctor .`
   - Expected result: workspace remains healthy after schema/board changes.

---

### Phase 2.2 — adversarial review + experiment audit

#### Deliverables

- Reviewer memory ledger
- Multi-round adversarial review artifact model
- Experiment audit artifact model
- Stronger result-to-claim bridge

#### Files to modify

- `src/core/reviews.mjs`
- `src/core/evidence.mjs`
- `src/core/orchestration.mjs`
- `src/core/schema.mjs`
- `src/core/artifacts.mjs`
- `src/mcp/tool-definitions.mjs`
- `src/mcp/handlers.mjs`
- `.opencode/commands/paper.review-loop.md`
- `.opencode/commands/paper.review.md`
- possibly new command(s): `paper.experiment-audit`, `paper.result-bridge`
- reviewer-related skills

#### New artifacts

- `.paper/reviews/concerns.json`
- `.paper/reviews/debate-log.md`
- `.paper/reviews/adversarial-state.json`
- `.paper/experiments/audits.json`
- `.paper/claims/bridge-log.json`

#### Concrete changes

1. Extend review model to store:
   - persistent concerns
   - concern status (`open`, `contested`, `resolved`, `retired`)
   - reviewer rationale
   - author rebuttal summary
   - ruling outcome

2. Add experiment audit records:
   - experiment id
   - reviewed files / artifact refs
   - audit findings
   - integrity flags
   - confidence

3. Add result-to-claim bridge logic:
   - claim confidence updates
   - explicit experiment support/refute/inconclusive mapping
   - persisted bridge events instead of implicit side effects only

4. Update review loop so failed/refuted experiments and bridge failures become board blockers and reviewer concerns.

#### Acceptance criteria

- Review loop can persist reviewer concerns across rounds
- Experiment audit findings are stored separately from raw experiment results
- Claim state changes are traceable to bridge records

#### Phase 2.2 verification

1. Run targeted integrity/review tests:
   - `npm test -- --test-name-pattern="review|audit|claim|experiment"`
   - Expected result: review-loop, audit, and bridge-specific tests pass.
2. Run MCP validation to prove new deterministic audit/bridge tools work:
   - `npm run mcp:validate`
   - Expected result: audit and bridge tools are callable and return valid file-backed results.
3. Run full command validation if new commands were added:
   - `npm run commands:validate`
   - Expected result: new review or experiment-related commands/skills exist and validate.

---

### Phase 2.3 — typed wiki and richer Trellis-style packet semantics

#### Deliverables

- Typed research wiki index
- Parent/child packet graph
- Packet lifecycle expansion
- Per-role + per-phase manifests
- Workspace index

#### Files to modify

- `src/core/schema.mjs`
- `src/core/navigation.mjs`
- `src/core/artifacts.mjs`
- `src/core/workspace.mjs`
- `src/core/index.mjs`
- `src/mcp/tool-definitions.mjs`
- `src/mcp/handlers.mjs`
- `.opencode/commands/paper.task-graph.md`
- `.opencode/commands/paper.open-questions.md`
- `.opencode/commands/paper.decisions.md`
- `.opencode/commands/paper.lineage.md`
- `.opencode/commands/paper.wiki.md`

#### New artifacts

- `.paper/wiki/entities.json`
- `.paper/wiki/relations.json`
- `.paper/workspace/index.json`
- optional `.paper/context/phases/*.json`

#### Concrete changes

1. Extend packet schema with:
   - `parentPacketId`
   - `childPacketIds`
   - `phaseContextId`
   - `currentFocus`
   - `nextAction`
   - richer lifecycle statuses

2. Add typed wiki entities/relations:
   - paper
   - idea
   - experiment
   - claim
   - review concern
   - decision
   - question

3. Add workspace index that summarizes:
   - active packets
   - active roles
   - unresolved concerns
   - most recent sessions
   - latest versions and comparisons

4. Update navigation queries to read from typed structures first and markdown summaries second.

#### Acceptance criteria

- Task graph can show packet hierarchy and dependencies
- Open questions and decisions are queryable both from packets and typed wiki entities
- Workspace index provides a resumable top-level overview

#### Phase 2.3 verification

1. Run targeted navigation/wiki tests:
   - `npm test -- --test-name-pattern="task graph|open questions|decisions|lineage|wiki|workspace"`
   - Expected result: new typed wiki and packet-hierarchy tests pass.
2. Run MCP validation:
   - `npm run mcp:validate`
   - Expected result: query/navigation and manifest tools succeed against the updated typed structures.
3. Manual spot-check of generated artifacts after tests or fixture setup:
   - inspect `.paper/wiki/*`, `.paper/task-packets/*`, `.paper/workspace/*`
   - Expected result: generated files reflect hierarchy, relations, and workspace summary/index state.

---

### Phase 2.4 — safer workflow-pack evolution

#### Deliverables

- Stronger managed artifact reconciliation
- Update-safe writes for bootstrap-managed files
- Better doctor reporting for boundary drift

#### Files to modify

- `src/core/workspace.mjs`
- `src/core/schema.mjs`
- `bin/paper-factory.mjs`
- `scripts/doctor-mcp-probe.mjs`
- install/sync tests

#### Concrete changes

1. Add managed artifact metadata where useful:
   - revision id
   - template hash
   - generated-by version

2. Ensure sync/install distinguishes:
   - managed replaceable files
   - bootstrap-only files
   - user-owned files

3. Surface boundary and drift information in `doctor` output.

#### Acceptance criteria

- sync does not overwrite user-owned artifacts
- doctor reports boundary policy state clearly
- managed files have clearer reconciliation metadata where introduced

#### Phase 2.4 verification

1. Run install/sync/doctor flow on a temp directory:
   - `tmpdir=$(mktemp -d) && node ./bin/paper-factory.mjs install "$tmpdir" --force && node ./bin/paper-factory.mjs sync "$tmpdir" --force && node ./bin/paper-factory.mjs doctor "$tmpdir"`
   - Expected result: install and sync succeed; doctor reports healthy boundary state.
2. Run targeted CLI/install tests:
   - `npm test -- --test-name-pattern="CLI|doctor|sync|install|boundary"`
   - Expected result: user-owned artifact preservation and boundary drift tests pass.
3. If reconciliation metadata is added, inspect bootstrap-managed artifacts manually.
   - Expected result: managed metadata is present only where intended and does not leak into user-owned files.

---

### Phase 2.5 — AutoFigure-inspired artifact contract

#### Deliverables

- Figure pipeline artifacts without embedding the full rendering stack
- Better figure planning semantics linked to method sections and claims

#### Files to modify

- `src/core/schema.mjs`
- `src/core/artifacts.mjs`
- `src/mcp/tool-definitions.mjs`
- `src/mcp/handlers.mjs`
- `.opencode/commands/paper.figure.md`
- figure tests and docs

#### New artifacts

- `.paper/figures/briefs.json`
- `.paper/figures/segments.json`
- `.paper/figures/templates.json`
- `.paper/figures/editable-index.json`

#### Concrete changes

1. Add figure brief structure:
   - source section(s)
   - target claim(s)
   - narrative intent
   - required visual elements

2. Add segmentation/template placeholders as durable records, not generated SVG UI.

3. Add final editable artifact contract fields:
   - `templateSvgPath`
   - `finalSvgPath`
   - `reviewNotes`

#### Acceptance criteria

- Figure pipeline can be planned and reviewed as durable artifact stages
- No claim is made that paper_factory ships the full render/editor backend

#### Phase 2.5 verification

1. Run figure-focused tests:
   - `npm test -- --test-name-pattern="figure|template|editable"`
   - Expected result: figure artifact contract tests pass.
2. Run command validation:
   - `npm run commands:validate`
   - Expected result: any enhanced figure command surface validates.
3. Manual artifact inspection:
   - inspect `.paper/figures/*`
   - Expected result: figure brief, placeholder/template, and editable-artifact contract files serialize correctly without implying a render backend exists.

---

## Verification plan

Every phase should maintain these checks:

1. `npm run commands:validate`
2. `npm run mcp:validate`
3. `npm test`
4. `npm run check`
5. `npm pack --dry-run`
6. `node ./bin/paper-factory.mjs doctor .`
7. fresh install + sync + doctor on temp directory

Additional phase-specific tests should be added for:

- continuation semantics
- concern persistence across review rounds
- experiment audit persistence
- claim bridge records
- packet hierarchy and phase manifests
- workspace index generation
- managed artifact boundary drift
- figure artifact contract serialization

### Mapping of global checks to phases

- **Phase 2.1** is complete when continuation/focus tests pass and the updated orchestration surfaces validate via `commands:validate` and `mcp:validate`.
- **Phase 2.2** is complete when review/audit/bridge tests pass and MCP validation proves the new deterministic audit/bridge tools operate correctly.
- **Phase 2.3** is complete when navigation/wiki tests pass and typed packet/wiki/workspace artifacts can be regenerated and queried successfully.
- **Phase 2.4** is complete when install/sync/doctor tests and temp-directory flows prove boundary-safe behavior.
- **Phase 2.5** is complete when figure artifact contract tests pass and the generated figure-stage artifacts are inspectable and coherent.

---

## Prioritization rationale

Why this order:

1. **Behavior and integrity first** because richer outputs are useless if the workflow still exits too early or cannot prove trustworthiness.
2. **Structured state second** because adversarial review, typed wiki, and richer packet graphs need durable schemas to sit on.
3. **Update safety third** because phase 2 increases schema and artifact count, so migration and sync discipline become more important.
4. **Figure contract last** because it is valuable but less central than the orchestration / review / evidence control plane.

---

## Success criteria for phase 2 completion

Phase 2 is complete when all of the following are true:

1. The board, packets, claims, experiments, reviews, and versions form a tighter durable control plane rather than loosely related artifacts.
2. Intent, continuation, adversarial review, and result-to-claim logic are all visible in persisted files, not just prompt wording.
3. The task graph is more hierarchical and more actionable.
4. The wiki is more typed and queryable.
5. Install/sync/doctor explain and enforce update boundaries more clearly.
6. Figure workflow has a meaningful staged artifact contract.
7. Docs and capability matrices are updated honestly.
8. Verification is green and Oracle agrees the new claims are defensible.
