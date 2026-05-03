# paper_factory

`paper_factory` is a host-neutral, file-first, board-first academic workflow pack with optional multi-host adapters.

It deliberately borrows two different kinds of strength:

- from **oh-my-openagent / oh-my-opencode**: packaging discipline, explicit role inventory, board-first orchestration, install/doctor ergonomics, and composable command surfaces
- from **ARIS**: staged research-to-writing flow, persistent research memory, claim-driven experiment planning, rebuttal issue handling, and paper version evolution/comparison

The result is not a fake clone of either project. It is an honest host-neutral package with OpenCode as the default adapter and optional Claude Code, Codex, Cursor, and shared agent-skill adapters:

- host-neutral CLI/MCP/core runtime under `bin/`, `mcp/`, `scripts/`, and `src/`
- optional adapter surfaces such as `.opencode/`, `.claude/`, `.codex/`, `.cursor/`, and `.agents/skills/`
- durable project artifacts in `.paper/`

## What is included

- a **command pack** for orchestration, research, notes, claim gating, planning, outlining, drafting, experiment planning, review, rebuttal strategy, citations, version snapshots/comparisons, figures, and pipeline execution
- a **skill pack** for planner, researcher, reviewer, rebuttal, experiment planning, version analysis, and core workflow discipline
- an optional **`paper-factory` stdio MCP server** for deterministic state mutations
- a **CLI installer/doctor** at `bin/paper-factory.mjs`
- a durable **`.paper/` artifact model** for orchestration, handoffs, research briefs, experiment audits, result-to-claim bridge logs, typed wiki/workspace indexes, rebuttal issues/strategy, version lineage/comparisons, figure artifact contracts, plus the classic paper-writing artifacts
- durable **task packets, packet/role context manifests, session summaries, and navigation reports** that narrow context without inventing a hidden runtime
- a proposal-only **meta-optimize / outer-loop layer** that turns repeated repair and review patterns into grouped, ranked, evidence-backed recommendations plus longer-horizon workflow memory under `.paper/meta/`
- stronger **artifact-local and action-local context bundles** under `.paper/context/artifacts/` and `.paper/context/actions/` so commands can read the nearest guidance before mutating workflow state
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
# Optional multi-host adapters:
node ./bin/paper-factory.mjs install . --force --host claude,cursor
node ./bin/paper-factory.mjs install . --force --host all
```

### Check the workspace health

```bash
node ./bin/paper-factory.mjs doctor .
```

### Run one explicit foreground autonomy pass

```bash
node ./bin/paper-factory.mjs autonomy-foreground . --max-steps 5
```

Multi-step program envelopes can now stop with durable closure states such as `achieved`, `accepted-risk`, `blocked`, or `completed` while still remaining explicit, foreground-only, and non-daemonized.

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
18. `project:paper.meta-optimize`
19. `project:paper.checklist`

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
- `.paper/context/packets/*.json`
- `.paper/context/roles/*.json`
- `.paper/context/phases/*.json`
- `.paper/context/artifacts/*.json`
- `.paper/context/actions/*.json`
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
- `.paper/meta/events.json`
- `.paper/meta/long-horizon-memory.json`
- `.paper/meta/operator-playbooks.json`
- `.paper/meta/recommendations.json`
- `.paper/meta/optimizer-state.json`
- `.paper/meta/LATEST_OPTIMIZER_REPORT.md`
- `.paper/bibliography/citation-log.md`

## Portable Trellis-inspired additions

This release absorbs the strongest portable Trellis-style ideas plus the highest-value phase-2 integrity upgrades without pretending OpenCode has Trellis-native hooks or a hidden scheduler. The new `autonomy-foreground` surface is still an explicitly invoked, foreground-only runner: it may chain the already-approved same-lineage continuation once, but it is not a background runtime or daemon.

- **Durable task packets**: work objects live under `.paper/task-packets/` and link tasks to experiments, rebuttal issues, and versions.
- **Packet-scoped context manifests**: `.paper/context/packets/*.json` couples each packet to its dependency health, linked artifacts, and resume bundle.
- **Per-role context manifests**: `.paper/context/roles/*.json` narrows the durable context surface for planner, researcher, reviewer, rebuttal, experiment, and version roles.
- **Artifact-local guidance**: `.paper/context/artifacts/*.json` ties local rules and read-before-mutate guidance to real durable artifact paths.
- **Pre-action context bundles**: `.paper/context/actions/*.json` surfaces the exact files a command or operator should read before acting, without pretending OpenCode auto-loads them.
- **Session/workspace persistence**: `.paper/sessions/journal.json` and `.paper/sessions/LATEST_SUMMARY.md` preserve resumable workspace context.
- **Query/navigation surfaces**: `project:paper.task-graph`, `project:paper.open-questions`, `project:paper.decisions`, and `project:paper.lineage` expose file-backed navigation instead of lifecycle-only commands.
- **Safer pack updates**: install/sync now bootstrap `.paper/` without overwriting user-owned workspace data.

Additional phase-2 upgrades:

- **Intent + continuation discipline**: the board now persists `intentType`, `currentFocus`, `nextAction`, continuation checkpoints, and review-before-finalize status.
- **Board-enforced role-chain contract**: role ownership is enforced on board mutations and critical evidence/experiment/review/version writes; manual repairs must use explicit handoffs or a traceable override reason.
- **Adversarial review + experiment integrity**: `.paper/reviews/concerns.json`, `.paper/reviews/adversarial-state.json`, `.paper/experiments/audits.json`, and `.paper/claims/bridge-log.json` keep review memory, experiment audits, and result-to-claim transitions durable.
- **Typed wiki + workspace index**: `.paper/wiki/entities.json`, `.paper/wiki/relations.json`, and `.paper/workspace/index.json` make top-level state more queryable and resumable, including stronger relation taxonomy/family summaries, stronger queues, dependency health, ownership summaries, and handoff obligations.
- **Figure artifact contracts**: `.paper/figures/briefs.json`, `segments.json`, `templates.json`, `editable-index.json`, `final-index.json`, and `qa.json` provide staged figure artifacts plus durable QA/linkage outputs without pretending the package ships a render/editor backend.
- **Proposal-only meta-optimize layer**: `.paper/meta/events.json`, `long-horizon-memory.json`, `operator-playbooks.json`, `recommendations.json`, `optimizer-state.json`, and `LATEST_OPTIMIZER_REPORT.md` summarize repeated workflow weaknesses into grouped optimization clusters, explicit ranked recommendations, family-level operator playbooks, persisted frontier summaries, stable tie-break semantics, and longer-horizon recurrence trends without auto-applying any change.

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
- `docs/REFERENCE_ARCHITECTURES.zh-CN.md`
