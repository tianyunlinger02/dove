# Dove

Dove is a host-neutral, file-first mission workflow system for papers, engineering work, experiments, review, and governed autonomy.

Dove is now the product, package, CLI, MCP identity, command language, and durable workspace authority. A project-local `.dove/` directory is the single source of truth for workflow state. Paper writing remains a first-class Dove domain; it is no longer the package identity.

Old `.paper/` state, if present in a workspace, is treated as stale legacy state. Dove reports those files during health checks, but runtime operations do not import or trust them automatically.

## What is included

- A neutral CLI/MCP/core runtime under `bin/`, `mcp/`, `scripts/`, and `src/`.
- Optional host adapters for OpenCode, Claude Code, Codex, Cursor, and shared agent-skill hosts, generated from `src/core/command-manifest.mjs`.
- A `dove` CLI with install, sync, doctor, onboarding, mission queries, governed launch, isolated review, and bounded autonomy commands.
- A stdio MCP server named `dove` exposed through `mcp/dove-state-server.mjs`.
- A durable `.dove/` artifact model for orchestration, handoffs, research, claims, citations, drafts, experiments, reviews, rebuttals, versions, figures, task packets, runtime state, programs, governance, and long-horizon workflow memory.
- A three-primary-role model: `planner`, `builder`, and `reviewer`, with specialist subagents grouped under those roles.
- A mission lifecycle shared by paper and engineering work: `goal → design → checklist → execution → audit → return`.
- Explicit, foreground-only autonomy surfaces; Dove does not claim a hidden daemon, scheduler, swarm, or unbounded background queue.

## Quick start

### Validate the repository

```bash
npm run commands:check
npm run commands:validate
npm run mcp:validate
npm test
npm run doctor:validate

# Full release/package gate
npm run release:check
```

### Install Dove into the current project

```bash
node ./bin/dove.mjs install . --force

# Optional multi-host adapters
node ./bin/dove.mjs install . --force --host claude,cursor
node ./bin/dove.mjs install . --force --host all
```

### Check workspace health

```bash
node ./bin/dove.mjs doctor .
```

The doctor verifies the Dove core, adapter inventory, JSON artifacts, MCP probe, `.dove/manifest.json` authority, and stale legacy `.paper/` conflicts.

### Onboard an existing paper project

```bash
# Proposal-only scan; writes nothing
node ./bin/dove.mjs onboard .

# Persist only the reference map
node ./bin/dove.mjs onboard . --write-map
```

`migrate` is an alias for the same proposal-first artifact mapping flow. It writes only `.dove/workspace/artifact-map.json` when explicitly requested; it never moves, deletes, rewrites, or imports manuscript files.

## Direct CLI surfaces

```bash
# Proposal-only routing; writes nothing, runs nothing, and inspects no git
node ./bin/dove.mjs orchestrate . --request "Ship cache safely" --domain engineering --stage execution

# Proposal-only mission framing
node ./bin/dove.mjs mission . --domain engineering --stage execution --artifact src/cache.mjs --acceptance-check "tests or validation output"

# As-read mission board inspection
node ./bin/dove.mjs board . --domain engineering

# Proposal-only audit and return-readiness checks
node ./bin/dove.mjs audit . --domain engineering --changed-file src/cache.mjs --test-evidence tests/cache.test.mjs --validation-output tmp/cache-test.log
node ./bin/dove.mjs return . --domain engineering --changed-file src/cache.mjs --test-evidence tests/cache.test.mjs --validation-output tmp/cache-test.log

# Governed launch after accepted guidance exists
node ./bin/dove.mjs launch . --source-type remediation-pack --source-id <pack-id> --execute-by 2099-01-01T00:00:00.000Z --review-after 2099-01-01T12:00:00.000Z --domain engineering --stage execution

# Explicit foreground autonomy
node ./bin/dove.mjs autonomy-foreground . --max-steps 5
```

Query commands are proposal-only: they do not create mission packets, update boards, append handoffs, refresh derived state, run tests, inspect git, or execute autonomy. `launch` is different: it is a governed mutation surface that materializes accepted guidance into `.dove/task-packets` without executing the work.

## Role model

Dove exposes three primary manual roles:

- `planner`: mentor, PI, editor, tech lead, or architect role for direction, priority, scope, governance, and autonomy boundaries.
- `builder`: worker role for writing, coding, research, experiments, result interpretation, revision, implementation, and rebuttal drafting.
- `reviewer`: independent critic role for adversarial review, evidence attacks, code review, QA, methodology critique, and verdicts.

Specialists such as `researcher`, `experiment-planner`, `revision-lead` / `rebuttal-lead`, and `version-analyst` are subagent capabilities under those primary roles. The reviewer remains independent; revision and rebuttal work stays builder-side.

## Recommended workflow

`project:dove.paper.orchestrate` is the paper-domain router. It reads `.dove/`, classifies the request by lifecycle family, and recommends one next command without mutating state.

Dove also exposes general mission surfaces:

- `project:dove.orchestrate` / `dove orchestrate`
- `project:dove.mission` / `dove mission`
- `project:dove.board` / `dove board`
- `project:dove.plan`
- `project:dove.checklist`
- `project:dove.task-graph`
- `project:dove.materialize`
- `project:dove.approvals`
- `project:dove.autonomy-operate`
- `project:dove.audit` / `dove audit`
- `project:dove.return` / `dove return`
- `project:dove.launch` / `dove launch`
- `project:dove.governance-audit`

Paper-domain workflow commands remain under `project:dove.paper.*` for init, research, notes, claim gating, paper planning, outlining, drafting, experiment planning, no-fix audit, review loop, isolated review, rebuttal, citations, version snapshots/comparisons, and figures. The same paper-domain command surface is generated for supported hosts, not only OpenCode. Shared mission-system commands are public Dove surfaces: `project:dove.plan`, `project:dove.task-graph`, `project:dove.checklist`, `project:dove.materialize`, `project:dove.approvals`, `project:dove.autonomy-operate`, and `project:dove.governance-audit`. `project:dove.paper.plan` and `project:dove.paper.approvals` are paper-domain views of the same plan/approval system where useful.

The paper lifecycle taxonomy remains useful inside the unified Dove model:

- `objective`: research goal, thesis, venue strategy, and acceptance target
- `structure`: plan, outline, drafts, figures, checklists, and versions
- `campaign`: explicit foreground programs, campaigns, approvals, and runtime state
- `work-unit`: board, handoffs, mission packets, workspace index, and context/action bundles
- `concern`: reviewer concerns, revision pressure, rebuttal items, and isolated review handoffs
- `audit`: inspections, experiment audits, figure QA, governance proof, and version comparisons
- `knowledge`: sources, notes, evidence, claims, bibliography, wiki, and long-horizon memory

Major work should close through `design → checklist → implementation → acceptance`: plan the change, turn it into executable checks, do scoped work, then return with evidence and review/audit status.

## Why `.dove/` matters

`.dove/` is the durable source of truth. It makes the system resumable and auditable even when chat context is lost:

- role transitions live in board and handoff files
- claims can be audited against sources and notes
- experiments and results can be tied back to claims
- reviewer concerns and rebuttal issues persist across rounds
- mission packets narrow context without hidden runtime memory
- isolated reviewer handoffs cross session boundaries only through explicit artifacts
- MCP, CLI, and prompt/skill surfaces converge on the same files

## Core artifacts

- `.dove/manifest.json`
- `.dove/state.json`
- `.dove/orchestration/board.json`
- `.dove/orchestration/handoffs.md`
- `.dove/task-packets/index.json`
- `.dove/task-packets/packets/*.json`
- `.dove/checklists/current.md`
- `.dove/context/roles/*.json`
- `.dove/context/phases/*.json`
- `.dove/context/packets/*.json`
- `.dove/context/artifacts/*.json`
- `.dove/context/actions/*.json`
- `.dove/sessions/journal.json`
- `.dove/sessions/LATEST_SUMMARY.md`
- `.dove/workspace/index.json`
- `.dove/workspace/artifact-map.json`
- `.dove/research/`, `.dove/sources/`, `.dove/notes/`, `.dove/evidence/`, `.dove/claims/`, `.dove/drafts/`
- `.dove/experiments/`, `.dove/reviews/`, `.dove/rebuttal/`, `.dove/revision-plans/`, `.dove/versions/`, `.dove/figures/`
- `.dove/runtime/`, `.dove/programs/`, `.dove/meta/`

## Package boundary

Install/sync may bootstrap missing `.dove/` starter artifacts, but `.dove/` is user-owned workspace state, not a packaged snapshot to overwrite. Pack updates manage code, scripts, MCP files, docs, and Dove-only adapter surfaces; repository-local development scaffolding and host settings are not part of the packaged Dove product boundary. Command adapters are generated by `scripts/generate-command-adapters.mjs` from the canonical manifest, and `npm run release:check` is the full pre-release gate.

## Docs

- `docs/INSTALL.md`
- `docs/USAGE.md`
- `docs/PACKAGING.md`
- `docs/CAPABILITY_MATRIX.md`
- `docs/DOVE_REFACTOR_PLAN_2026-05-04.md`
- `docs/PAPER_FACTORY_SYSTEM_ORIGINS.zh-CN.md`
- `docs/REFERENCE_ARCHITECTURES.zh-CN.md`
