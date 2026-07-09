# Dove

Dove is a local-first task workflow system for research papers, engineering projects, experiments, review, and bounded autonomous work.

It gives AI-assisted work a durable filesystem backbone: goals, task packets, evidence, notes, sources, drafts, figures, experiment records, review concerns, rebuttal artifacts, versions, lessons, runtime results, and runtime events live in project-local `.dove/` files instead of disappearing into chat history.

## Dove philosophy

Dove is built around a simple operating metaphor: an agent should fly out toward a clear goal, then return with evidence, results, and any reusable lesson. The important part is not just dispatching work; it is making the outcome explicit enough that another person or agent can inspect what changed, why it changed, how it was validated, and what should be remembered next time.

That is why Dove treats the filesystem as the contract. It does not depend on hidden chat memory, a background swarm, or a host-specific automation loop. Task packets, review findings, evidence, and lessons are written into `.dove/` so the workflow remains portable across tools and auditable after the session ends.

The intended rhythm is:

```text
init goal → demand-to-task mission or auto run → preset work → status/operator/review → lesson
```

Lessons stay manual and short. Dove can preserve reusable experience, but it does not auto-capture raw runtime traces or turn retrospectives into new work without an explicit governed action.

## Why Dove

AI coding and writing sessions are powerful, but they often lose continuity across roles, tools, and long-running work. Dove keeps the work portable and auditable by combining:

- **Durable task state** in `.dove/`
- **One global init goal** with task packets underneath it
- **Automatic task classification** across plan/execute/audit and paper/experiment/engineering domains
- **Planner / builder / reviewer separation** for direction, execution, and critique
- **Evidence-aware paper workflows** for sources, notes, claims, drafts, experiments, figures, reviews, rebuttals, and versions
- **Engineering workflows** for scoped implementation and declared evidence
- **Explicit lessons and retrospectives** for reusable task experience without raw runtime traces
- **First-class boundaries and role handoffs** for work that needs host input, review, provider output, or missing materials
- **Append-only runtime events/results** for auditable foreground transitions and stop reasons
- **Generated project host adapters** for OpenCode, Codex, Cursor, and shared agent-skill hosts
- **Optional MCP tools** for deterministic reads and file-backed mutations
- **Bounded foreground auto work** that requires confirmation and stops at explicit boundaries

Dove does not rely on hidden chat memory, a daemon, a scheduler, or a host-specific swarm. Raw runtime traces can stay local and ignored; reusable experience is captured deliberately as short `.dove/meta/operator-lessons.json` retrospectives. The files are the contract.

## What ships in this repository

- `bin/dove.mjs` — the Dove CLI for install, sync, doctor, and package workflows
- `mcp/dove-state-server.mjs` — the local stdio MCP server
- `src/` — core workflow, artifact, governance, command-manifest, MCP, and validation logic
- `scripts/` — adapter generation, validation, doctor, audit, and packaging checks
- `.opencode/`, `.codex/`, `.cursor/`, `.agents/` — generated project-local Dove adapter surfaces
- `docs/` — installation, usage, packaging, and capability documentation
- `tests/` — Node test coverage for the core package behavior

The package installs managed code and generated adapter files. A target project's `.dove/` directory is user-owned workspace state: Dove may bootstrap missing starter artifacts, but package updates should not overwrite the user's evolving notes, drafts, claims, reviews, experiments, task packets, lessons, or runtime records.

## Requirements

- Node.js `>=22`
- npm for validation and packaging scripts
- A supported host if you want slash commands or skills exposed directly in an editor/agent environment

The CLI and MCP layer remain file-based, so Dove can still be inspected and validated without a specific host integration.

## First 10 minutes with Dove

1. Install Dove into the project you want to run from and check the workspace:

```bash
node ./bin/dove.mjs install /path/to/project --force
node ./bin/dove.mjs doctor /path/to/project
```

2. Use the command syntax for your host. Dove's canonical command id is `dove.mission`; Claude Code should expose a single user-level `/dove:mission` entrypoint, while OpenCode commonly exposes project adapters as `project:dove.mission`. The examples below use Claude Code slash syntax.

3. Start with a real demand instead of a command inventory:

```text
/dove:mission 修复 doctor 报错并运行相关验证
```

Dove should convert the demand into a task contract, ask for confirmation, then materialize the contract and return the recommended next workflow route. If the workspace has no init goal yet, the confirmation should make the proposed init goal explicit before anything is written.

4. Use presets inside the selected or newly created task:

```text
/dove:figure 画一张 pipeline overview，用于 introduction 和方法图
/dove:draft 修改 introduction，让它衔接最新实验结果
/dove:experience 规划并记录 ablation 结果，然后桥接到 claim
```

Preset workflows should resolve or ask for the durable task packet instead of silently guessing. `dove.experience` is the experiment/evidence workflow; reusable operating lessons belong in `dove.lessons`.

5. Check where things stand:

```text
/dove:status
```

Status is read-only by default and optimized for the ordinary question “what should I do next?” The default human view is a small translation layer: one `Dove:` state line, one `Next:` action, one `Why:` explanation, and one `More:` expansion hint. It does not print packet ids, mission lists, boundary/gap codes, blocked counts, execution-gap counts, required-evidence blocks, mission counts, or completed/killed recaps unless you explicitly ask for missions, JSON, or full/debug detail.

For CLI contract checks, `node ./bin/dove.mjs status /path/to/project --health` and `--contract-test` are read-only intent views. They check the compact contract, default operator surface, and full/debug expansion without treating project backlog work as the primary health-check action.

6. Close durable learning only when there is a reusable lesson:

```text
/dove:lessons
```

Use `dove.version` to snapshot a direction change and clear active non-init tasks; killing a mission remains a guarded status choice, not a separate public command.

## Public command surface

Dove exposes one flat user-facing command set:

| Command | Purpose |
| --- | --- |
| `project:dove.init` | Create/update the unique level-0 project goal. |
| `project:dove.mission` | Convert a natural-language demand into a compact task-card contract; after approval, materialize it and hand off to the recommended next workflow. |
| `project:dove.auto` | Convert demand or select a task with compact task/auto cards; after approval, run bounded multi-round foreground iterations until completion or a boundary. |
| `project:dove.status` | Answer “what should I do next?” with one-sentence state, one recommended action, and explicit mission/full/debug expansion paths. |
| `project:dove.operator` | Preview compact queue cards, then run one confirmed foreground pass over ready/in-progress work and blocker-investigation planning. |
| `project:dove.lessons` | Query or record global/task-bound lessons that future work must obey. |
| `project:dove.version` | Snapshot a direction change and clear active tasks except init. |
| `project:dove.source` | Organize external information and provenance. |
| `project:dove.note` | Organize internal repository and `.dove/` information. |
| `project:dove.figure` | Turn one figure request into material discovery, generation/import, captioning, and QA. |
| `project:dove.experience` | Plan experiments, record results, audit them, and bridge evidence into claims. |
| `project:dove.draft` | Generate or revise paper drafts with explicit placeholders for gaps. |
| `project:dove.review` | Run an isolated audio review over final plan/results and explicit artifacts. |
| `project:dove.review-loop` | Iterate review, draft, and experience up to the configured max, default 3. |
| `project:dove.rebuttal` | Normalize reviewer issues and draft evidence-backed responses. |

Older router, plan, checklist, audit, return, follow-through, onboarding, governance-audit, and paper-namespaced slash commands are not public surfaces. Useful low-level capabilities remain internal MCP/core building blocks where they are still needed.

## Task model

Dove uses one task tree across paper, experiment, and engineering work:

- There is exactly one level-0 init task.
- `/dove:mission` first converts the operator's natural-language demand into a proposal-only task contract with a compact task card; when the host supports interactive confirmation controls, the operator chooses approve and materialize the contract, adjust conversion, or cancel before anything is materialized into `.dove/task-packets/`.
- `/dove:init` is the only level-0 creation path; `/dove:mission` creates work under that root.
- User-created mission tasks default to level 3 and may explicitly use level 1, 2, 3, or deeper when the operator supplies a level.
- `/dove:mission` can autonomously propose checklist/subtask packets, but they are materialized only after the same confirmation as the parent mission.
- System-created checklist/subtask packets are children of their mission and must have `level > parent.level`, so they are always deeper than the user task they serve.
- Dove computes task stage (`plan`, `execute`, `audit`) and domain (`paper`, `experiment`, `engineering`) from the request unless the caller supplies explicit values.
- Task-scoped writes must resolve to one durable `.dove/task-packets` packet before mutation.
- After approval, `/dove:mission` only materializes the task contract and returns recommended next routes; execution continues through `/dove:auto`, `/dove:operator`, domain workflows, or explicit tools.
- When later execution records a completed planning result, Dove converts supplied plan outputs into pending durable missions: the default follow-up mission is level 3, and optional child missions can be level 4, 5, or deeper.
- `/dove:status` uses the default compact `statusHome` result as a human translation layer: `headline`, one `nextStep`, `needsAttention`, `changes`, and `showMore`. It should not make ordinary users read packet ids, mission lists, boundary/gap codes, blocked counts, execution-gap counts, or required-evidence blocks before they know the single next action. Mission details stay optional/collapsed unless the operator explicitly asks for missions, JSON, or full/debug detail; expanded mission details start with a `Priority lane`, then show a compact `Queue summary` and short `Queue preview` instead of dumping the whole backlog. Complete mission lists remain available through full/debug JSON. Hosts should ask at most one confirmation dialog with compact adjustment cards only when status changes are requested, do nothing when the dialog does not provide clear `packetId -> status` adjustments, and call `apply_dove_status_adjustments` only after explicit confirmation. Status choices remain `pending`, `ready`, `in-progress`, `blocked`, `completed`, and `killed`.
- Boundaries are first-class task/runtime metadata, not extra statuses. An open boundary records why work stopped, required inputs/actions, `ownerRole`, `nextRole`, and optional `handoff` so the next foreground command knows who should resume.
- `/dove:operator` previews compact cards for auto-runnable, host-pass-required, blocked, and pending queues; after confirmation it runs one safe internal step when available, otherwise waits for real host pass results, records an awaiting boundary, and turns `blocked` missions into pending plan missions that investigate the blocker reason.
- `/dove:auto` can start directly from a new demand or an existing task, confirms compact task/auto cards before execution, runs only in the foreground call, records each iteration in `.dove/runtime/results.json`, appends lifecycle/boundary events in `.dove/runtime/events.json`, and uses `.dove/state.json.settings.auto.maxIterations` with default 3.
- Ambiguous natural-language task targeting follows `.dove/state.json.settings.taskTargetResolution.autoSelect`, but missing targets or tied top candidates must stop for explicit task confirmation instead of guessing.

## Language configuration

Dove generated commands and runtime-generated user-facing task/checklist/status/operator/auto messages follow the response-language preference. Supported values are `zh` for Chinese and `en` for English, with `zh` as the default.

```json
{
  "language": "zh"
}
```

Put that in `.dove/config.json` or `.dove/config.local.json`; `DOVE_LANGUAGE` and `DOVE_RESPONSE_LANGUAGE` can override it for a process. Machine tokens and public API fields stay in English, including statuses, stages, domains, command IDs, MCP tool names, JSON keys, file paths, outcome tokens, and token-like stop reasons. Existing artifacts are not migrated when the preference changes.

## Workflow presets

- **Source** records external information and source provenance.
- **Note** consolidates internal information from the repository and `.dove/`.
- **Experience** merges experiment planning, result recording, audit, and claim bridging.
- **Figure** lets the user describe a figure once; Dove gathers materials, prepares generation, imports safe output when present, writes caption/provenance, and validates QA.
- **Draft** writes or revises paper sections from prompts and durable evidence, with explicit placeholders for missing support.
- **Review** prepares/imports an isolated audio review without sharing full project context or private transcripts.
- **Review-loop** runs bounded review + draft + experience iterations.
- **Rebuttal** handles submission revision and reviewer response drafting.

## Host adapters

The canonical command inventory lives in `src/core/command-manifest.mjs`. Generated project adapters expose the same Dove concepts across supported project-local hosts:

- OpenCode commands and skills
- Codex skills and agent defaults
- Cursor commands
- shared `.agents/skills` surfaces

Claude Code uses one user-level `/dove:*` command set instead of project-local `.claude/commands/dove` files; `dove install/sync --host claude` renders that user command set from the same manifest while normal project installs keep Dove state in `.dove/` without creating duplicate Claude command entries.

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

MCP tools provide deterministic access to workspace state, task graphs, open questions, decisions, lineage, operator lessons, status `dailyHome`, actionable boundaries, compact confirmation cards, confirmed status adjustments, demand-to-task conversion, explicit execution result recording, operator passes, task reset, audio review, experience workflows, figures, drafts, rebuttal artifacts, role context, packet context, artifact context, and runtime event/result logs. MCP complements `.dove/`; it does not replace the file-backed source of truth.

MCP `tools/list` defaults to a compact operator surface with the common entry tools and short schemas. Callers that need the complete canonical registry must explicitly request `surface: "full"` or `surface: "debug"`; compact tool results include operator route/unblock guidance plus `writeIntent` and `rollbackEligible` so no-write checks are visibly distinct from proposed or applied mutations.

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

- [`docs/INSTALL.md`](docs/INSTALL.md) — install, sync, doctor, validation, and MCP setup
- [`docs/USAGE.md`](docs/USAGE.md) — workflow model, commands, task model, autonomy, MCP tools, and roles
- [`docs/PACKAGING.md`](docs/PACKAGING.md) — package boundary, managed files, generated adapters, and release checks
- [`docs/CAPABILITY_MATRIX.md`](docs/CAPABILITY_MATRIX.md) — implemented, partial, and deferred capabilities
