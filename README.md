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

## Repository and published package layout

The source checkout keeps `src/`, the raw `bin/dove.mjs` and `mcp/dove-state-server.mjs` entrypoints, development scripts, tests, generated host adapters, and documentation. The npm package is intentionally smaller and ships only standalone runtime artifacts:

- `dist/index.mjs` — the public package-root API bundle
- `bin/dove-package.mjs` — the installed Dove CLI
- `mcp/dove-state-server-package.mjs` — the installed stdio MCP executable
- `scripts/doctor-mcp-probe-package.mjs` — the installed doctor probe
- the necessary public docs, `AGENTS.md`, host adapters, and `.opencode.json`

The installed package does not contain raw `src/` modules or raw development entry scripts. The package `exports` map controls legal package specifiers, but it is not a filesystem isolation boundary; physical omission of raw source is what prevents sibling-URL imports through `import.meta.resolve("dove")`.

The package installs managed code and generated adapter files. A target project's `.dove/` directory is user-owned workspace state: Dove may bootstrap missing starter artifacts, but package updates should not overwrite the user's evolving notes, drafts, claims, reviews, experiments, task packets, lessons, or runtime records.

## Requirements

- Node.js `>=22`
- npm for validation and packaging scripts
- A supported host if you want slash commands or skills exposed directly in an editor/agent environment

The CLI and MCP layer remain file-based, so Dove can still be inspected and validated without a specific host integration.

## First 10 minutes with Dove

1. Install the published package, then initialize and check the project from the project directory:

```bash
npm install --save-dev dove
npx dove install . --force
npx dove doctor .
```

If Dove runtime files have already been copied into the project, the equivalent installed-project commands are `node ./bin/dove-package.mjs install . --force` and `node ./bin/dove-package.mjs doctor .`.

2. Use the command syntax for your host. Dove's canonical command id is `dove.mission`; Claude Code should expose a single user-level `/dove:mission` entrypoint, while OpenCode commonly exposes project adapters as `project:dove.mission`. The examples below use Claude Code slash syntax.

3. Start with a real demand instead of a command inventory:

```text
/dove:mission Fix the doctor failure and run the relevant validation
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

Status is always read-only and optimized for the ordinary question “what should I do next?” It never bootstraps, refreshes, stages, or writes workspace state. The default human view is a small translation layer: one `Dove:` state line, one `Next:` action, one `Why:` explanation, and one `More:` expansion hint. It does not print packet ids, mission lists, boundary/gap codes, blocked counts, execution-gap counts, required-evidence blocks, mission counts, or completed/killed recaps unless you explicitly ask for missions, JSON, or full/debug detail. Status changes use the separate confirmed adjustment surface; a status query itself cannot apply them.

For CLI contract checks, `node ./bin/dove-package.mjs status /path/to/project --health` and `--contract-test` are read-only intent views. They check the compact contract, default operator surface, and full/debug expansion without treating project backlog work as the primary health-check action.

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
| `project:dove.mission` | Convert a natural-language demand into a compact task-card contract; after approval, materialize only that contract and hand off without executing work or granting execution authority. |
| `project:dove.auto` | Convert demand or select a task with compact task/auto cards; after separate approval, run bounded foreground iterations until completion or a boundary. |
| `project:dove.status` | Answer “what should I do next?” through an always-read-only, zero-write query with explicit mission/full/debug expansion paths. |
| `project:dove.operator` | Preview compact queue cards, then run one confirmed foreground pass; host work advances only from canonical `taskResults[]`. |
| `project:dove.lessons` | Query or record global/task-bound lessons that future work must obey. |
| `project:dove.version` | Snapshot a direction change and clear active tasks except init. |
| `project:dove.source` | Register external material as a packet-bound candidate; public source verification can reject but cannot issue positive verification. |
| `project:dove.note` | Synthesize internal findings, eligible verified sources, quotes, claims, or explicitly labeled open questions into task-bound notes. |
| `project:dove.figure` | Turn one figure request into material discovery, generation/import, captioning, and diagnostic QA; `validated` requires current final-SVG Reviewer proof. |
| `project:dove.experience` | Plan experiments, record results, audit them, and bridge evidence into claims. |
| `project:dove.draft` | Generate or revise paper drafts with explicit placeholders for gaps. |
| `project:dove.review` | Run an evidence-aware structural preflight; authoritative `coherent` requires current hash-bound independent Reviewer proof. |
| `project:dove.review-loop` | Run exactly one Reviewer pass; substantive findings require a separate Builder revision and any later review is another explicit call. |
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
- `/dove:status` uses the default compact `statusHome` result as a human translation layer: `headline`, one `nextStep`, `needsAttention`, `changes`, and `showMore`. Every status query is zero-write: it does not bootstrap, refresh, stage, or apply changes. Mission details stay optional/collapsed unless the operator explicitly asks for missions, JSON, or full/debug detail; expanded mission details start with a `Priority lane`, then show a compact `Queue summary` and short `Queue preview` instead of dumping the whole backlog. Complete mission lists remain available through full/debug JSON. Status changes use the separate `apply_dove_status_adjustments` mutation and require explicit confirmation with clear `packetId -> status` adjustments. Status choices remain `pending`, `ready`, `in-progress`, `blocked`, `completed`, and `killed`.
- Boundaries are first-class task/runtime metadata, not extra statuses. An open boundary records why work stopped, required inputs/actions, `ownerRole`, `nextRole`, and optional `handoff` so the next foreground command knows who should resume.
- `/dove:operator` previews compact cards for auto-runnable, host-pass-required, blocked, and pending queues. Confirmed host work advances only through canonical `taskResults[]`; a host-pass task with no matching result remains unchanged rather than gaining synthetic progress.
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

- **Source** registers retrieved external material as a candidate. Public `verify_source` can record rejection only; positive verification requires a trusted internal transition bound to captured material, source identity, and packet.
- **Note** consolidates substantive synthesis from repository material, eligible verified sources, quotes, claims, or explicitly labeled open questions. A candidate-backed note is context, not completion authority.
- **Experience** merges experiment planning, result recording, audit, and claim bridging.
- **Figure** lets the user describe a figure once; Dove gathers materials, prepares generation, imports safe output when present, and writes caption/provenance. Lexical and structural QA are diagnostics only; `validated` requires current authorized independent proof covering the final SVG hash.
- **Draft** writes or revises paper sections from prompts and durable evidence, with explicit placeholders for missing support.
- **Review** performs evidence-aware structural preflight over selected task materials. A clean scan is not authoritative `coherent`; current hash-bound independent Reviewer proof is required.
- **Review-loop** runs exactly one Reviewer pass. It never performs an implicit Reviewer → Builder → Reviewer cycle; Builder revision and any later review are separate explicit calls.
- **Rebuttal** handles submission revision and reviewer response drafting.

## Host adapters

Generated project adapters expose the same Dove concepts across supported project-local hosts:

- OpenCode commands and skills
- Codex skills and agent defaults
- Cursor commands
- shared `.agents/skills` surfaces

Claude Code uses one user-level `/dove:*` command set instead of project-local `.claude/commands/dove` files; `dove install/sync --host claude` renders that user command set from the same manifest while normal project installs keep Dove state in `.dove/` without creating duplicate Claude command entries.

In a Dove source checkout, maintainers regenerate and check adapter drift with `npm run commands:generate` and `npm run commands:check`. These development scripts are not part of an installed project.

## MCP

Dove includes a local stdio MCP server named `dove`:

```json
{
  "mcpServers": {
    "dove": {
      "type": "stdio",
      "command": "node",
      "args": ["./mcp/dove-state-server-package.mjs"]
    }
  }
}
```

MCP tools provide deterministic access to workspace state, task graphs, open questions, decisions, lineage, operator lessons, status `dailyHome`, actionable boundaries, compact confirmation cards, confirmed status adjustments, demand-to-task conversion, explicit execution result recording, operator passes, task reset, audio review, experience workflows, figures, drafts, rebuttal artifacts, role context, packet context, artifact context, and runtime event/result logs. MCP complements `.dove/`; it does not replace the file-backed source of truth.

MCP `tools/list` defaults to a compact operator surface with the common entry tools and short schemas. Callers that need the complete canonical registry must explicitly request `surface: "full"` or `surface: "debug"`; compact tool results include operator route/unblock guidance plus `writeIntent` and `rollbackEligible` so no-write checks are visibly distinct from proposed or applied mutations.

## Source-checkout development

The following commands are maintainer-only and must be run from a Dove source checkout. They are not available in a project that only contains the installed runtime bundle.

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
