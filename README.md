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
- a **role model** with three manually switchable primary agents (`planner`, `author`, `reviewer`) plus automatic specialist subagents for research, experiments, revision/rebuttal, and version audit
- a **skill pack** for planner, author-side specialists, reviewer, and core workflow discipline
- an optional **`paper-factory` stdio MCP server** for deterministic state mutations
- a **CLI installer/doctor** at `bin/paper-factory.mjs`
- a durable **`.paper/` artifact model** for orchestration, handoffs, research briefs, isolated reviewer handoff runs, experiment audits, result-to-claim bridge logs, typed wiki/workspace indexes, rebuttal issues/strategy, version lineage/comparisons, figure artifact contracts, plus the classic paper-writing artifacts
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

### Onboard an existing paper project

```bash
# Proposal-only scan; writes nothing
node ./bin/paper-factory.mjs onboard .

# Persist only the reference map under .paper/workspace/artifact-map.json
node ./bin/paper-factory.mjs onboard . --write-map
```

`migrate` is an alias for the same proposal-first artifact mapping flow. It never moves, deletes, rewrites, or imports manuscript files.

### Run one explicit foreground autonomy pass

```bash
node ./bin/paper-factory.mjs autonomy-foreground . --max-steps 5
```

Multi-step program envelopes can now stop with durable closure states such as `achieved`, `accepted-risk`, `blocked`, or `completed` while still remaining explicit, foreground-only, and non-daemonized.

### Dry-run the package boundary

```bash
npm pack --dry-run
```

## Role model

`paper_factory` exposes three primary manual agents:

- `planner`: mentor/PI/editor role for direction, priority, handoff, governance, and autonomy boundaries.
- `author`: paper builder role for writing, revision, evidence work, experiments, result interpretation, and rebuttal drafting.
- `reviewer`: independent critic role for adversarial review, evidence/method attacks, concerns, and verdicts.

Specialized identities such as `researcher`, `experiment-planner`, `revision-lead`/`rebuttal-lead`, and `version-analyst` are automatic subagent capabilities under those primary agents rather than peer top-level manual roles. The reviewer remains independent; rebuttal/revision work stays author-side.

## Recommended workflow

`project:paper.orchestrate` is now a pure router: it reads `.paper/`, classifies the request by paper lifecycle family, and recommends one next command without updating the board or handoff log.

The lifecycle taxonomy is exposed through `.paper/workspace/index.json.lifecycle` and artifact context manifests:

- `objective`: research goal, thesis, venue strategy, and acceptance target
- `structure`: plan, outline, drafts, figures, checklists, and versions
- `campaign`: explicit foreground programs, campaigns, approvals, and runtime state
- `work-unit`: board, handoffs, task packets, workspace index, and context/action bundles
- `concern`: reviewer concerns, revision pressure, rebuttal items, and isolated review handoffs
- `audit`: inspections, experiment audits, figure QA, governance proof, and version comparisons
- `knowledge`: sources, notes, evidence, claims, bibliography, wiki, and long-horizon memory

Major paper changes should close through `design → checklist → implementation → acceptance`: use `project:paper.plan` for design, `project:paper.checklist` for executable steps and checks, scoped implementation commands for edits, and review/checklist/version commands for acceptance proof.

1. `project:paper.init`
2. `project:paper.orchestrate`
3. `project:paper.research`
4. `project:paper.claim-gate`
5. `project:paper.plan`
6. `project:paper.outline`
7. `project:paper.draft`
8. `project:paper.experiment-plan`
9. `project:paper.audit`
10. `project:paper.review-loop`
11. `project:paper.isolated-review`
12. `project:paper.rebuttal-strategy`
13. `project:paper.rebuttal`
14. `project:paper.version-snapshot`
15. `project:paper.version-compare`
16. `project:paper.task-graph`
17. `project:paper.open-questions`
18. `project:paper.decisions`
19. `project:paper.lineage`
20. `project:paper.meta-optimize`
21. `project:paper.checklist`

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
- `.paper/reviews/isolated/*/{input.json,manifest.json,handoff.json,report.md}`
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
- `.paper/workspace/artifact-map.json`
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
- **Per-role context manifests**: `.paper/context/roles/*.json` narrows the durable context surface for the primary planner/author/reviewer agents and compatibility specialist subagents.
- **Artifact-local guidance**: `.paper/context/artifacts/*.json` ties local rules and read-before-mutate guidance to real durable artifact paths.
- **Pre-action context bundles**: `.paper/context/actions/*.json` surfaces the exact files a command or operator should read before acting, without pretending OpenCode auto-loads them.
- **Session/workspace persistence**: `.paper/sessions/journal.json` and `.paper/sessions/LATEST_SUMMARY.md` preserve resumable workspace context.
- **Proposal-first onboarding**: `paper-factory onboard` / `migrate` scans existing manuscripts, bibliographies, figures, tables, results, notes, reviews, and submission files into a reference-only lifecycle map, and writes only `.paper/workspace/artifact-map.json` when `--write-map` is explicit.
- **Query/navigation surfaces**: `project:paper.task-graph`, `project:paper.open-questions`, `project:paper.decisions`, and `project:paper.lineage` expose file-backed navigation instead of lifecycle-only commands.
- **Safer pack updates**: install/sync now bootstrap `.paper/` without overwriting user-owned workspace data.

Additional phase-2 upgrades:

- **Intent + continuation discipline**: the board now persists `intentType`, `currentFocus`, `nextAction`, continuation checkpoints, and review-before-finalize status.
- **Board-enforced role-chain contract**: primary role ownership is enforced on board mutations and critical evidence/experiment/review/version writes, while specialist subagents inherit from their parent primary agent; manual repairs must use explicit handoffs or a traceable override reason.
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
