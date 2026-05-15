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
| `project:dove.mission` | Convert a natural-language demand into a task contract; after approval, materialize it and run one bounded foreground pass. |
| `project:dove.auto` | Convert demand or select a task; after approval, run bounded multi-round foreground iterations until completion, a boundary, or the configured limit. |
| `project:dove.status` | Inspect the live development situation, then show only actionable non-completed/non-killed mission status adjustments when present or requested. |
| `project:dove.operator` | Run one confirmed foreground pass over ready/in-progress work, splitting safe internal steps from host-pass-required work, and create pending blocker-investigation plan missions for blocked work. |
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
2. Pick the syntax for your host. The canonical command id is `dove.mission`; Claude Code users normally type `/dove:mission`, while OpenCode users commonly see `project:dove.mission`.
3. Start with a real demand, not a command inventory. For engineering work, use `/dove:mission 修复 doctor 报错并运行相关验证`; Dove should propose a task contract, ask for confirmation, then record the foreground pass result or clearly request missing host evidence. If no init goal exists, the same confirmation should show the proposed init and task before writing either one.
4. Use presets inside a selected or newly created task: `/dove:figure 画 pipeline overview`, `/dove:draft 修改 introduction`, or `/dove:experience 规划并记录 ablation 结果`. Presets should resolve one durable task packet or ask for confirmation instead of silently guessing.
5. Use `/dove:status` as the default read-only dashboard. It first reports the live host-visible development situation, then shows only adjustable Dove missions when there is something actionable; it does not print mission counts or completed/killed recaps.
6. Use `/dove:operator` when you want to preview and run one foreground pass over queued work; it must not claim host work happened without pass results or a safe internal workflow step.
7. When a task yields reusable operating knowledge, record it with `/dove:lessons`.

## Task model

Dove treats work as a tree rooted at one init task:

- There is exactly one level-0 init task.
- `/dove:mission` first converts the operator's natural-language demand into a proposal-only task contract; when the host supports interactive confirmation controls, the operator chooses approve conversion and run one pass, adjust conversion, or cancel before anything is materialized into `.dove/task-packets/`.
- `/dove:init` is the only level-0 creation path; `/dove:mission` creates work under that root.
- User-created mission tasks default to level 3 and may explicitly use level 1, 2, 3, or deeper when the operator supplies a level.
- `/dove:mission` can autonomously propose checklist/subtask packets, but they are materialized only after the same conversion approval as the parent mission.
- System-created checklist/subtask packets are children of their mission and must have `level > parent.level`, so they are always deeper than the user task they serve.
- After approval, `/dove:mission` immediately performs one bounded foreground pass and records its task status, evidence, blockers, and next action with `record_dove_mission_pass`.
- When a completed mission pass has stage `plan`, Dove converts supplied `plannedMissions`, `resultingMissions`, `missions`, `childMissions`, or `planConversion` output into pending durable missions. The default follow-up mission is level 3; child missions can be level 4, 5, or deeper.
- `/dove:status` first reports the live development situation from host-visible context, not from `.dove` internals, then only lists non-init missions that can be adjusted, excluding `completed` and `killed`; if there are no adjustable missions, it does not show a mission list or completed/killed recap. Hosts should ask at most one confirmation dialog for status changes, do nothing when the dialog does not provide clear `packetId -> status` adjustments, then call `apply_dove_status_adjustments` only after explicit confirmation. Status choices remain `pending`, `ready`, `in-progress`, `blocked`, `completed`, and `killed`.
- `/dove:operator` previews auto-runnable, host-pass-required, blocked, and pending queues before confirmation. Confirmed runs execute one safe internal step when available, otherwise require real foreground pass results, and create pending plan missions for blocked-task investigation.
- Dove computes stage (`plan`, `execute`, `audit`) and domain (`paper`, `experiment`, `engineering`) from the request unless explicit values are supplied.
- Active task state, dependencies, blockers, killed tasks, artifacts, and linked lessons live in `.dove/task-packets/`.

Task-scoped writes must resolve to one durable packet before writing. A command or MCP call can provide `packetId`, `taskPacketId`, `missionPacketId`, or a natural-language target such as `target`, `packetTarget`, or `taskName`.

Ambiguous natural-language targets follow `.dove/state.json.settings.taskTargetResolution.autoSelect`, but automatic selection is allowed only for a unique high-confidence candidate. If no explicit packet/target/artifact is supplied, or if multiple candidates share the top confidence, Dove must stop and ask for task/packet confirmation through the host confirmation UX before writing.

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

Dove supports two response-language values: `zh` for Chinese and `en` for English. The default is `zh`, so generated command adapters and runtime-generated user-facing task/checklist/status/operator/auto messages use Chinese unless args, workspace config, durable state, or environment selects English.

Set the workspace preference in `.dove/config.json` or `.dove/config.local.json`:

```json
{
  "language": "zh"
}
```

`DOVE_LANGUAGE=en` or `DOVE_RESPONSE_LANGUAGE=en` overrides file configuration for the current process. `.dove/state.json.settings.responseLanguage` is the normalized durable-state mirror for hosts that read state before command execution. Dove does not translate machine tokens or public API fields: statuses, stages, domains, command IDs, MCP tool names, JSON keys, file paths, outcome tokens, and token-like `stopReason` values stay English. Changing the preference affects newly generated text only; old artifacts are not migrated.

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

`project:dove.auto` uses the same demand-to-task intake as `project:dove.mission`: it returns a proposal-only auto contract for either a converted `proposedTask` or a selected durable `selectedTask`, classifies the request, reports applicable lessons, and requires explicit confirmation before task creation/selection proceeds into autonomous execution. When task selection is missing or ambiguous, hosts should present indexed choices through confirmation UX instead of guessing.

After confirmation, auto may internally call top-level Dove workflows such as source, note, experience, figure, draft, review, review-loop, rebuttal, lessons, and status. It runs only inside the current foreground call, records each iteration in `.dove/runtime/results.json`, and uses `.dove/state.json.settings.auto.maxIterations` as the default limit; the default is 3.

It stops at completed, blocked, killed, review/authority boundary, missing provider credentials, conflicting task target, or step-budget exhaustion. If the response ends before the task is complete, Dove does not secretly continue in the background; the next operator action must invoke another foreground command.

## MCP tools

The optional MCP layer exposes deterministic helpers for hosts and integrations. Public workflows use tools such as:

- `init_dove_goal`
- `create_dove_task`
- `record_dove_mission_pass`
- `apply_dove_status_adjustments`
- `run_dove_auto`
- `run_dove_operator`
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
