# Dove

Dove is a local-first task workflow system for research papers, engineering projects, experiments, review, and bounded autonomous work.

It gives AI-assisted work a durable filesystem backbone: goals, task packets, evidence, notes, sources, drafts, figures, experiment records, review concerns, rebuttal artifacts, versions, lessons, and runtime summaries live in project-local `.dove/` files instead of disappearing into chat history.

## Dove philosophy

Dove is built around a simple operating metaphor: an agent should fly out toward a clear goal, then return with evidence, results, and any reusable lesson. The important part is not just dispatching work; it is making the outcome explicit enough that another person or agent can inspect what changed, why it changed, how it was validated, and what should be remembered next time.

That is why Dove treats the filesystem as the contract. It does not depend on hidden chat memory, a background swarm, or a host-specific automation loop. Task packets, review findings, evidence, and lessons are written into `.dove/` so the workflow remains portable across tools and auditable after the session ends.

The intended rhythm is:

```text
init goal → mission task or auto task → preset work → status/review → lesson
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
- **Generated host adapters** for OpenCode, Claude Code, Codex, Cursor, and shared agent-skill hosts
- **Optional MCP tools** for deterministic reads and file-backed mutations
- **Bounded foreground auto work** that requires confirmation and stops at explicit boundaries

Dove does not rely on hidden chat memory, a daemon, a scheduler, or a host-specific swarm. Raw runtime traces can stay local and ignored; reusable experience is captured deliberately as short `.dove/meta/operator-lessons.json` retrospectives. The files are the contract.

## What ships in this repository

- `bin/dove.mjs` — the Dove CLI for install, sync, doctor, and package workflows
- `mcp/dove-state-server.mjs` — the local stdio MCP server
- `src/` — core workflow, artifact, governance, command-manifest, MCP, and validation logic
- `scripts/` — adapter generation, validation, doctor, audit, and packaging checks
- `.opencode/`, `.claude/`, `.codex/`, `.cursor/`, `.agents/` — generated Dove adapter surfaces
- `docs/` — installation, usage, packaging, and capability documentation
- `tests/` — Node test coverage for the core package behavior

The package installs managed code and generated adapter files. A target project's `.dove/` directory is user-owned workspace state: Dove may bootstrap missing starter artifacts, but package updates should not overwrite the user's evolving notes, drafts, claims, reviews, experiments, task packets, lessons, or runtime records.

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

3. Create the global goal:

```text
project:dove.init
```

4. Create the first concrete task, or let Dove continue after confirmation:

```text
project:dove.mission
project:dove.auto
```

5. Use the preset commands for the kind of work you need:

```text
project:dove.source
project:dove.note
project:dove.experience
project:dove.figure
project:dove.draft
project:dove.review
project:dove.review-loop
project:dove.rebuttal
```

6. Inspect and close the loop:

```text
project:dove.status
project:dove.lessons
```

Use `project:dove.kill` to terminate a non-init task and `project:dove.version` to snapshot a direction change and clear active non-init tasks.

## Public command surface

Dove exposes one flat user-facing command set:

| Command | Purpose |
| --- | --- |
| `project:dove.init` | Create/update the unique level-0 project goal. |
| `project:dove.mission` | Create a task under init after classification and dependency analysis. |
| `project:dove.auto` | Confirm a task, then run bounded automatic work until completion or a boundary. |
| `project:dove.status` | Show project, init, task tree, blockers, review, version, lessons, and readiness state. |
| `project:dove.kill` | Kill a non-init task; returns indexed choices when the target is ambiguous. |
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
- User-created mission tasks default to level 3.
- System-created prerequisite/controller tasks may be level 1 or 2.
- Dove computes task stage (`plan`, `execute`, `audit`) and domain (`paper`, `experiment`, `engineering`) from the request unless the caller supplies explicit values.
- Task-scoped writes must resolve to one durable `.dove/task-packets` packet before mutation.
- Ambiguous natural-language task targeting follows `.dove/state.json.settings.taskTargetResolution.autoSelect`.

## Language configuration

Dove generated commands follow the workspace response-language preference. Supported values are `zh` for Chinese and `en` for English, with `zh` as the default.

```json
{
  "language": "zh"
}
```

Put that in `.dove/config.json` or `.dove/config.local.json`; `DOVE_LANGUAGE` and `DOVE_RESPONSE_LANGUAGE` can override it for a process.

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

MCP tools provide deterministic access to workspace state, task graphs, open questions, decisions, lineage, operator lessons, status, task creation, task reset, audio review, experience workflows, figures, drafts, rebuttal artifacts, role context, packet context, and artifact context. MCP complements `.dove/`; it does not replace the file-backed source of truth.

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
