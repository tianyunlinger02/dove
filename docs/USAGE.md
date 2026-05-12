# Usage

## Product model

Dove is a local-first task workflow system for paper, experiment, engineering, review, and general research work.

- **Commands** are the user-facing workflow surface and are generated from `src/core/command-manifest.mjs`.
- **MCP tools** provide deterministic file-backed queries and mutations.
- **`.dove/`** is the authoritative durable workspace root.
- **Task packets** under `.dove/task-packets/` bind every task-scoped write to one durable task before mutation.
- **Lessons** under `.dove/meta/operator-lessons.json` preserve explicit reusable experience without importing raw runtime traces.

## Public commands

Dove exposes one flat public command surface:

| Command | Use it for |
| --- | --- |
| `project:dove.init` | Create or update the single project-level goal, represented as the unique level-0 task. |
| `project:dove.mission` | Propose a task under init after Dove classifies stage, domain, dependencies, level, blockers, and expected evidence; create it only after explicit confirmation. |
| `project:dove.auto` | Start with mission-style intake, then after explicit confirmation run bounded automatic work until completion or a boundary. |
| `project:dove.status` | Inspect project state, init, task tree, blockers, review state, version state, and completion readiness. |
| `project:dove.kill` | Terminate a non-init task; when multiple tasks match, choose from the returned indexed list. |
| `project:dove.lessons` | Query or record global/task-bound lessons that future Dove work must obey. |
| `project:dove.version` | Snapshot a direction change and clear active non-init tasks while preserving init and required lessons. |
| `project:dove.source` | Organize external information such as papers, web findings, citations, and provenance. |
| `project:dove.note` | Organize internal information from the repository, `.dove/`, notes, and existing artifacts. |
| `project:dove.figure` | Describe the figure once; Dove gathers materials, prepares generation, imports output, captions, and validates QA. |
| `project:dove.experience` | Plan experiments, record results, audit them, and bridge evidence into claims. |
| `project:dove.draft` | Generate or revise paper draft sections from prompts, sources, notes, experiences, and review findings. |
| `project:dove.review` | Prepare/import an isolated audio review over final plan/results and explicit artifacts only. |
| `project:dove.review-loop` | Run bounded review + draft + experience iterations; the default max is 3 from Dove settings. |
| `project:dove.rebuttal` | Normalize reviewer issues, choose response strategy, and draft rebuttal responses. |

Older router, checklist, plan, audit, return, follow-through, onboarding, governance-audit, and paper-namespaced slash surfaces are not public commands. Their useful low-level capabilities remain internal MCP/core building blocks where needed.

## First 10 minutes with Dove

1. Install Dove and run `dove doctor` to check the package, adapters, MCP entrypoint, and workspace artifacts.
2. Run `project:dove.init` to establish the one global goal for the workspace.
3. Run `project:dove.mission` to get a concrete task proposal and confirm it, or `project:dove.auto` when you want Dove to continue after explicit confirmation.
4. Use preset commands as needed: `source`, `note`, `experience`, `figure`, `draft`, `review`, `review-loop`, and `rebuttal`.
5. Use `project:dove.status` to inspect blockers, task state, and completion readiness.
6. When a task yields reusable experience, record it with `project:dove.lessons`.

## Task model

Dove treats work as a tree rooted at one init task:

- There is exactly one level-0 init task.
- `/dove:mission` first returns a proposal-only task contract; explicit confirmation materializes it into `.dove/task-packets/`.
- User-created mission tasks default to level 3.
- System-created prerequisite/controller tasks may be level 1 or 2.
- Dove computes stage (`plan`, `execute`, `audit`) and domain (`paper`, `experiment`, `engineering`) from the request unless explicit values are supplied.
- Active task state, dependencies, blockers, killed tasks, artifacts, and linked lessons live in `.dove/task-packets/`.

Task-scoped writes must resolve to one durable packet before writing. A command or MCP call can provide `packetId`, `taskPacketId`, `missionPacketId`, or a natural-language target such as `target`, `packetTarget`, or `taskName`.

Ambiguous natural-language targets follow `.dove/state.json.settings.taskTargetResolution.autoSelect`. The default is `true`, so Dove selects the strongest packet candidate and records resolution evidence. Set it to `false` when you want ambiguous writes to stop and ask for a task/packet confirmation.

## Durable workspace

Important durable surfaces include:

- `.dove/state.json` — normalized settings and project goal metadata.
- `.dove/task-packets/index.json` — active task index, init id, active task ids, counts, and dependency health.
- `.dove/task-packets/packets/` — task packet files.
- `.dove/workspace/index.json` — resumable workspace overview.
- `.dove/context/` — optional role, phase, packet, artifact, and action context bundles.
- `.dove/sources/`, `.dove/notes/`, `.dove/experiments/`, `.dove/claims/`, `.dove/drafts/`, `.dove/figures/`, `.dove/reviews/`, `.dove/audio/reviews/`, `.dove/rebuttal/`, `.dove/versions/` — workflow artifacts.
- `.dove/meta/operator-lessons.json` — explicit lessons and retrospectives.
- `.dove/config.json`, `.dove/config.local.json`, `DOVE_CONFIG_PATH`, `DOVE_LANGUAGE`, and `DOVE_FIGURE_*` overrides — non-secret response-language and provider configuration; secrets should be referenced through environment-variable names such as `apiKeyEnv`.

Commands and skills provide behavior, but there is no hidden scheduler or swarm runtime. Optional MCP helpers mutate files deterministically; they do not replace `.dove/` as the source of truth.

## Language configuration

Dove supports two response-language values: `zh` for Chinese and `en` for English. The default is `zh`, so generated command adapters tell hosts to answer in Chinese unless the workspace or environment selects English.

Set the workspace preference in `.dove/config.json` or `.dove/config.local.json`:

```json
{
  "language": "zh"
}
```

`DOVE_LANGUAGE=en` or `DOVE_RESPONSE_LANGUAGE=en` overrides file configuration for the current process. `.dove/state.json.settings.responseLanguage` is the normalized durable-state mirror for hosts that read state before command execution.

## Preset workflows

### Source

Use `project:dove.source` to organize external information and provenance. Network/provider calls must be explicit or safely configured; Dove records durable source metadata rather than trusting memory.

### Note

Use `project:dove.note` to consolidate internal information from the repository, existing `.dove/` artifacts, notes, drafts, and review outputs.

### Experience

Use `project:dove.experience` for experiment ideas, experiment plans, results, audits, and result-to-claim bridging. The public UX is “experience”; underlying experiment and claim files remain durable internals.

### Figure

Use `project:dove.figure` by describing the figure you need and where it should help. Dove resolves the task packet, gathers linked materials, writes the figure plan, prepares a generation bundle, optionally imports safe provider output, writes caption/provenance, and validates `.dove/figures/qa.json`.

The user-facing flow is intent-first: you should not need to manually run material preparation, result import, or validation as separate daily commands.

### Draft

Use `project:dove.draft` to generate or revise sections from prompts, sources, notes, experiences, and review findings. Draft output should be as complete as possible; missing evidence should be explicit placeholders rather than fabricated support.

### Review and review-loop

Use `project:dove.review` to prepare an isolated audio review. Audio receives only the current task summary, final plan paths, final result paths, explicit artifact paths, artifact hashes, instructions, and the output contract. Dove does not share broad project context, writer private transcripts, orchestration board context, or reviewer private transcripts.

Use `project:dove.review-loop` when the task should iterate through review, draft update, and experience planning. The configured max iteration count defaults to 3.

### Rebuttal

Use `project:dove.rebuttal` to normalize reviewer issues, choose a response strategy, and draft response text backed by durable evidence.

## Lessons / retrospectives

Use `project:dove.lessons` when a task closes and the reusable experience is worth preserving. Lessons are manual and explicit: they are not generated from hidden chat history, imported from raw task traces, or applied as hidden work.

A lesson should include:

- `title`
- `problem`
- at least one `decisions` entry
- at least one `pitfalls` entry
- at least one `validation` entry
- at least one `nextTime` entry

Lessons may be global or task-bound. When multiple tasks exist, Dove should present an indexed task list before recording a task-specific lesson.

## Auto

`project:dove.auto` starts like `project:dove.mission`: it proposes or selects a task, classifies the request, reports applicable lessons, and requires explicit confirmation before task creation/selection proceeds into autonomous execution.

After confirmation, auto may internally call top-level Dove workflows such as source, note, experience, figure, draft, review, review-loop, rebuttal, lessons, and status. It stops at completed, blocked, killed, review/authority boundary, missing provider credentials, conflicting task target, or step-budget exhaustion.

This is still foreground, bounded, and durable. Dove writes runtime/task results under `.dove/runtime/` and task packets; it does not run as a daemon or hidden scheduler.

## MCP tools

The optional MCP layer exposes deterministic helpers for hosts and integrations. Public workflows use tools such as:

- `init_dove_goal`
- `create_dove_task`
- `run_dove_auto`
- `kill_dove_task`
- `reset_dove_version`
- `run_experience_workflow`
- `run_figure_workflow`
- `run_audio_review`
- `run_dove_review_loop`
- `register_source`
- `upsert_note`
- `upsert_draft`
- `normalize_rebuttal_issues`
- `build_rebuttal_strategy`
- `build_rebuttal`
- `query_dove_status`
- `query_operator_lessons`
- `record_operator_lesson`

Lower-level support tools remain available for internal composition, validation, import/export handoffs, and compatibility with durable artifacts. They are not necessarily public slash commands.

## Role model

The user-facing role model has three primary manual agents:

- `planner` owns direction, priority, governance, and autonomy boundaries.
- `builder` owns writing, research, experiments, results, revision, rebuttal drafting, implementation, and evidence work.
- `reviewer` owns independent concerns, weaknesses, evidence/method attacks, code review, QA, and verdicts.

Specialists such as researcher, experiment planner, revision/rebuttal lead, and version analyst are automatic subagents under those primary agents. They are useful for scoped context, but they should not be treated as peer manual identities.
