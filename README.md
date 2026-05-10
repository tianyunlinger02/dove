# Dove

Dove is a local-first mission workflow system for research papers, engineering projects, experiments, review, and governed autonomy.

It gives AI-assisted work a durable filesystem backbone: plans, handoffs, claims, evidence, review concerns, experiment records, task packets, distilled operator lessons, and operating state live in project-local `.dove/` files instead of disappearing into chat history.

## Dove philosophy

Dove is built around a simple operating metaphor: an agent should fly out with a clear mission, then return with evidence, results, and any reusable lesson. The important part is not just dispatching work; it is making the return explicit enough that another person or agent can inspect what changed, why it changed, how it was validated, and what should be remembered next time.

That is why Dove treats the filesystem as the contract. It does not depend on hidden chat memory, a background swarm, or a host-specific automation loop. Plans, checklists, task packets, review findings, return evidence, and lessons are written into `.dove/` so the workflow remains portable across tools and auditable after the session ends.

The intended rhythm is:

```text
goal → plan → checklist → execution → audit → return → lesson
```

Lessons stay manual and short. Dove can preserve reusable experience, but it does not auto-capture raw runtime traces or turn retrospectives into new work without an explicit governed action.

## Why Dove

AI coding and writing sessions are powerful, but they often lose continuity across roles, tools, and long-running work. Dove keeps the work portable and auditable by combining:

- **Durable mission state** in `.dove/`
- **Explicit lessons and retrospectives** for reusable task experience without raw runtime traces
- **Board-first orchestration** for deciding the next role-owned step
- **Planner / builder / reviewer separation** for direction, execution, and critique
- **Evidence-aware paper workflows** for sources, notes, claims, citations, drafts, experiments, reviews, rebuttals, and versions
- **Engineering mission workflows** for scoped implementation, declared evidence, audit, and return-readiness checks
- **Generated host adapters** for OpenCode, Claude Code, Codex, Cursor, and shared agent-skill hosts
- **Optional MCP tools** for deterministic reads and file-backed mutations
- **Explicit governed autonomy** that is foreground, bounded, approval-aware, and inspectable

Dove does not rely on hidden chat memory, a daemon, a scheduler, or a host-specific swarm. Raw runtime traces can stay local and ignored; reusable experience is captured deliberately as short `.dove/meta/operator-lessons.json` retrospectives. The files are the contract.

## What ships in this repository

- `bin/dove.mjs` — the Dove CLI
- `mcp/dove-state-server.mjs` — the local stdio MCP server
- `src/` — the core workflow, artifact, governance, and validation logic
- `scripts/` — adapter generation, validation, doctor, audit, and packaging checks
- `.opencode/`, `.claude/`, `.codex/`, `.cursor/`, `.agents/` — generated Dove adapter surfaces
- `docs/` — installation, usage, packaging, and capability documentation
- `tests/` — Node test coverage for the core package behavior

The package installs managed code and generated adapter files. A target project's `.dove/` directory is user-owned workspace state: Dove may bootstrap missing starter artifacts, but package updates should not overwrite the user's evolving notes, drafts, claims, reviews, experiments, task packets, or runtime records.

## Requirements

- Node.js `>=22`
- npm for validation and packaging scripts
- A supported host if you want slash commands or skills exposed directly in an editor/agent environment

The CLI and MCP layer remain file-based, so Dove can still be inspected and validated without a specific host integration.

## First 10 minutes with Dove

1. Install Dove into the project you want to run from:

```bash
node ./bin/dove.mjs install /path/to/project --force
```

2. Check the installed workspace:

```bash
node ./bin/dove.mjs doctor /path/to/project
```

3. Frame the first mission:

```bash
node ./bin/dove.mjs orchestrate /path/to/project \
  --request "Ship cache safely" \
  --domain engineering \
  --stage design
```

4. Use the host commands to turn that mission into work:

```text
project:dove.plan
project:dove.checklist
```

5. Return with declared evidence when the work is done:

```bash
node ./bin/dove.mjs return /path/to/project \
  --domain engineering \
  --changed-file src/cache.mjs \
  --test-evidence tests/cache.test.mjs \
  --validation-output tmp/cache-test.log
```

6. If the task produced reusable experience, record one short retrospective through `project:dove.lessons` or `record_operator_lesson`. This is explicit operator bookkeeping; Dove never captures raw runtime traces or turns lessons into work automatically.

## Quick start from a checkout

Install dependencies if needed, then validate the repository:

```bash
npm run check
npm run release:check
```

For a faster local sanity check during development:

```bash
npm run commands:check
npm run commands:validate
npm run mcp:validate
npm test
npm run doctor:validate
```

Run the CLI directly from the repository:

```bash
node ./bin/dove.mjs doctor .
node ./bin/dove.mjs orchestrate . --request "Ship cache safely" --domain engineering --stage execution
```

## Install Dove into a project

Install the neutral core plus the default OpenCode adapter:

```bash
node ./bin/dove.mjs install /path/to/project --force
```

Install selected host adapters:

```bash
node ./bin/dove.mjs install /path/to/project --force --host claude,cursor
node ./bin/dove.mjs install /path/to/project --force --host codex --host agents
```

Install every supported adapter surface:

```bash
node ./bin/dove.mjs install /path/to/project --force --host all
```

`sync` accepts the same `--host` flags when refreshing an existing installation.

After install, check the target workspace:

```bash
node ./bin/dove.mjs doctor /path/to/project
```

## Onboard an existing project

Dove can map existing paper or project artifacts before you decide what to adopt into the workflow:

```bash
# Proposal-only scan; writes nothing
node ./bin/dove.mjs onboard /path/to/project

# Persist only the proposed artifact map
node ./bin/dove.mjs onboard /path/to/project --write-map
```

The written map, when requested, lives at `.dove/workspace/artifact-map.json`. Onboarding does not move, delete, import, rewrite, or overwrite manuscript or project files.

## Core CLI surfaces

Most direct query commands are proposal-only: they inspect declared `.dove/` state and return structured guidance without running tests, inspecting git, repairing state, or mutating user source assets.

```bash
# Route a mission request without writing state
node ./bin/dove.mjs orchestrate . \
  --request "Prepare camera-ready revision" \
  --domain paper \
  --stage design

# Frame one mission contract without writing state
node ./bin/dove.mjs mission . \
  --domain engineering \
  --stage execution \
  --artifact src/cache.mjs \
  --acceptance-check "tests or validation output"

# Read current mission status, task packets, paper lifecycle, questions, decisions, and lineage
node ./bin/dove.mjs status . --domain engineering

# Inspect declared audit and return evidence
node ./bin/dove.mjs audit . \
  --domain engineering \
  --changed-file src/cache.mjs \
  --test-evidence tests/cache.test.mjs \
  --validation-output tmp/cache-test.log

node ./bin/dove.mjs return . \
  --domain engineering \
  --changed-file src/cache.mjs \
  --test-evidence tests/cache.test.mjs \
  --validation-output tmp/cache-test.log
```

`launch` is the guarded write surface. It materializes accepted guidance into `.dove/task-packets` and requires explicit execution and review windows; it does not execute the mission:

```bash
node ./bin/dove.mjs launch . \
  --source-type remediation-pack \
  --source-id <pack-id> \
  --execute-by 2099-01-01T00:00:00.000Z \
  --review-after 2099-01-01T12:00:00.000Z \
  --domain engineering \
  --stage execution
```

Bounded autonomy is also explicit and foreground-only. Use `dove.autonomy-operate` as the normal user-facing surface; `autonomy-once` and `autonomy-foreground` are lower-level CLI/MCP controls for a single control-plane delta or an existing bounded run envelope.

```bash
node ./bin/dove.mjs autonomy-operate . --objective "Close accepted remediation" --max-steps 5
```

## Workflow model

Dove uses one mission lifecycle across paper and engineering work:

```text
goal → design → checklist → execution → audit → return
```

The primary manual roles are:

- **planner** — direction, scope, priorities, governance, and autonomy boundaries
- **builder** — implementation, writing, research, experiments, revision, rebuttal drafting, and evidence work
- **reviewer** — independent critique, evidence attacks, methodology review, QA, and verdicts

Specialists such as researcher, experiment planner, rebuttal lead, revision lead, and version analyst are scoped subagent capabilities under those primary roles. The reviewer remains independent; revision and rebuttal work stay builder-side.

## Paper workflow

Paper-specific commands use the `dove.paper.*` surface for artifact workflows. Shared mission controls such as routing, status, planning, checklists, launch, approvals, autonomy, governance audit, audit, and return stay on `dove.*`. Paper-specific commands support:

- project initialization and research contracts
- source registration and note capture
- evidence-backed claim promotion
- outlining and drafting
- experiment planning, result logging, experiment audit, and result-to-claim bridging
- strict no-fix paper audit
- review loops and isolated reviewer handoffs
- rebuttal strategy and rebuttal drafting
- citation synchronization
- figure planning and QA contracts
- version snapshots, comparisons, lineage, and release readiness

For paper work, the recommended loop is:

```text
initialize → research → notes → claim gate → plan → checklist → draft/experiment/revise → review/audit → return
```

## Engineering workflow

Engineering missions use the general `dove.*` surfaces. A normal implementation flow is:

1. Use `dove orchestrate` or `dove mission` to frame scope, domain, stage, target artifacts, and acceptance checks.
2. Use `dove plan` and `dove checklist` to turn the mission into executable work.
3. Implement only the scoped changes.
4. Return declared changed files, test evidence, and validation output through `dove audit` and `dove return`.
5. Materialize accepted follow-up work through `dove materialize` or guarded `dove launch` when needed.

Dove does not infer correctness from hidden context. It asks for project-local file paths and explicit evidence so a reviewer can inspect what changed.

## Host adapters

The canonical command inventory lives in `src/core/command-manifest.mjs`. Generated adapters expose the same Dove concepts across supported hosts:

- OpenCode commands and skills
- Claude Code commands
- Codex skills and agent defaults
- Cursor commands
- shared `.agents/skills` surfaces

Regenerate and check adapter drift with:

```bash
npm run commands:generate
npm run commands:check
```

## MCP

Dove includes a local stdio MCP server named `dove`:

```json
{
  "mcpServers": {
    "dove": {
      "type": "stdio",
      "command": "node",
      "args": ["./mcp/dove-state-server.mjs"]
    }
  }
}
```

MCP tools provide deterministic access to workspace state, task graphs, open questions, decisions, lineage, operator lessons, audits, approvals, materialization, launch, bounded autonomy, role context, packet context, artifact context, and paper-domain workflow artifacts. MCP complements `.dove/`; it does not replace the file-backed source of truth.

## Development

Useful scripts:

```bash
npm run commands:generate   # rewrite generated host adapters
npm run commands:check      # fail on generated adapter drift
npm run commands:validate   # validate command surfaces
npm run mcp:validate        # validate MCP entrypoint behavior
npm run governance:audit    # check governance coverage
npm run maturity:audit      # check current release claims
npm test                    # run Node tests
npm run check               # standard development gate
npm run release:check       # package/release gate
npm run pack:dry-run        # inspect npm package contents
```

Before release-oriented changes, run:

```bash
npm run check
npm run release:check
npm run pack:dry-run
```

## Documentation

Start here for deeper documentation:

- [`docs/INSTALL.md`](docs/INSTALL.md) — install, sync, onboarding, doctor, validation, and MCP setup
- [`docs/USAGE.md`](docs/USAGE.md) — workflow model, commands, paper pipeline, autonomy, MCP tools, and roles
- [`docs/PACKAGING.md`](docs/PACKAGING.md) — package boundary, managed files, generated adapters, and release checks
- [`docs/CAPABILITY_MATRIX.md`](docs/CAPABILITY_MATRIX.md) — implemented, partial, and deferred capabilities
