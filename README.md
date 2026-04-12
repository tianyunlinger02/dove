# paper_factory

`paper_factory` is a mature academic-paper-writing workflow pack for OpenCode.

It deliberately borrows two different kinds of strength:

- from **oh-my-openagent / oh-my-opencode**: packaging discipline, explicit role inventory, board-first orchestration, install/doctor ergonomics, and composable command surfaces
- from **ARIS**: staged research-to-writing flow, persistent research memory, claim-driven experiment planning, rebuttal issue handling, and paper version evolution/comparison

The result is not a fake clone of either project. It is an honest OpenCode-native package built around the surfaces OpenCode can really host well today:

- `.opencode/commands/`
- `.opencode/skills/`
- `.opencode.json` for optional MCP registration
- durable project artifacts in `.paper/`

## What is included

- a **command pack** for orchestration, research, notes, claim gating, planning, outlining, drafting, experiment planning, review, rebuttal strategy, citations, version snapshots/comparisons, figures, and pipeline execution
- a **skill pack** for planner, researcher, reviewer, rebuttal, experiment planning, version analysis, and core workflow discipline
- an optional **`paper-factory` stdio MCP server** for deterministic state mutations
- a **CLI installer/doctor** at `bin/paper-factory.mjs`
- a durable **`.paper/` artifact model** for orchestration, handoffs, research briefs, experiment audits, result-to-claim bridge logs, typed wiki/workspace indexes, rebuttal issues/strategy, version lineage/comparisons, figure artifact contracts, plus the classic paper-writing artifacts
- durable **task packets, role context manifests, session summaries, and navigation reports** that narrow context without inventing a hidden runtime
- an optional **strict mode** that prevents out-of-order drafting when evidence gates have not been satisfied

## Quick start

### Local development

```bash
npm run commands:validate
npm run mcp:validate
npm test
```

### Install the pack into the current project

```bash
node ./bin/paper-factory.mjs install . --force
```

### Check the workspace health

```bash
node ./bin/paper-factory.mjs doctor .
```

### Dry-run the package boundary

```bash
npm pack --dry-run
```

## Recommended workflow

1. `project:paper.init`
2. `project:paper.orchestrate`
3. `project:paper.research`
4. `project:paper.claim-gate`
5. `project:paper.plan`
6. `project:paper.outline`
7. `project:paper.draft`
8. `project:paper.experiment-plan`
9. `project:paper.review-loop`
10. `project:paper.rebuttal-strategy`
11. `project:paper.rebuttal`
12. `project:paper.version-snapshot`
13. `project:paper.version-compare`
14. `project:paper.task-graph`
15. `project:paper.open-questions`
16. `project:paper.decisions`
17. `project:paper.lineage`
18. `project:paper.checklist`

## Why `.paper/` matters

`paper_factory` treats `.paper/` as the durable source of truth. That means:

- you can resume a paper after session loss
- the orchestration board and handoffs make role transitions resumable
- review loops can be evidence-aware instead of memory-based
- claims can be audited against sources and notes
- experiment plans and results can be tied back to claims
- rebuttal issues and version comparisons stay durable instead of living only in prompt history
- task packets and role manifests make work decomposition resumable without widening everyone’s context window
- session journals and summaries preserve the workspace state in a portable, file-backed way
- the optional MCP server and the prompt/skill layer stay consistent because they touch the same files

## Core artifacts

- `.paper/state.json`
- `.paper/orchestration/board.json`
- `.paper/orchestration/handoffs.md`
- `.paper/task-packets/index.json`
- `.paper/task-packets/packets/*.json`
- `.paper/context/roles/*.json`
- `.paper/sessions/journal.json`
- `.paper/sessions/LATEST_SUMMARY.md`
- `.paper/research/brief.md`
- `.paper/research/agenda.json`
- `.paper/sources/index.json`
- `.paper/notes/index.json`
- `.paper/evidence/index.json`
- `.paper/experiments/plans.json`
- `.paper/experiments/results.json`
- `.paper/experiments/audits.json`
- `.paper/claims/CLAIMS_FROM_RESULTS.md`
- `.paper/claims/bridge-log.json`
- `.paper/plans/current-plan.md`
- `.paper/outline/current-outline.md`
- `.paper/drafts/*.md`
- `.paper/reviews/log.md`
- `.paper/reviews/concerns.json`
- `.paper/reviews/adversarial-state.json`
- `.paper/rebuttal/issues.json`
- `.paper/rebuttal/strategy.md`
- `.paper/versions/index.json`
- `.paper/versions/comparisons.json`
- `.paper/revision-plans/current-plan.md`
- `.paper/wiki/index.md`
- `.paper/wiki/entities.json`
- `.paper/wiki/relations.json`
- `.paper/wiki/navigation.md`
- `.paper/workspace/index.json`
- `.paper/bibliography/citation-log.md`

## Portable Trellis-inspired additions

This release absorbs the strongest portable Trellis-style ideas plus the highest-value phase-2 integrity upgrades without pretending OpenCode has Trellis-native hooks or a hidden scheduler:

- **Durable task packets**: work objects live under `.paper/task-packets/` and link tasks to experiments, rebuttal issues, and versions.
- **Per-role context manifests**: `.paper/context/roles/*.json` narrows the durable context surface for planner, researcher, reviewer, rebuttal, experiment, and version roles.
- **Session/workspace persistence**: `.paper/sessions/journal.json` and `.paper/sessions/LATEST_SUMMARY.md` preserve resumable workspace context.
- **Query/navigation surfaces**: `project:paper.task-graph`, `project:paper.open-questions`, `project:paper.decisions`, and `project:paper.lineage` expose file-backed navigation instead of lifecycle-only commands.
- **Safer pack updates**: install/sync now bootstrap `.paper/` without overwriting user-owned workspace data.

Additional phase-2 upgrades:

- **Intent + continuation discipline**: the board now persists `intentType`, `currentFocus`, `nextAction`, continuation checkpoints, and review-before-finalize status.
- **Adversarial review + experiment integrity**: `.paper/reviews/concerns.json`, `.paper/reviews/adversarial-state.json`, `.paper/experiments/audits.json`, and `.paper/claims/bridge-log.json` keep review memory, experiment audits, and result-to-claim transitions durable.
- **Typed wiki + workspace index**: `.paper/wiki/entities.json`, `.paper/wiki/relations.json`, and `.paper/workspace/index.json` make top-level state more queryable and resumable.
- **Figure artifact contracts**: `.paper/figures/briefs.json`, `segments.json`, `templates.json`, and `editable-index.json` provide staged figure artifacts without pretending the package ships a render/editor backend.

Intentionally out of scope:

- host-level hook interception
- hidden schedulers or background runtimes
- fake subagent interception semantics unsupported by OpenCode

## Docs

- `docs/INSTALL.md`
- `docs/USAGE.md`
- `docs/PACKAGING.md`
- `docs/CAPABILITY_MATRIX.md`
- `docs/PAPER_FACTORY_SYSTEM_ORIGINS.zh-CN.md`
