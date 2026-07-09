# Usage

## Product model

Dove is a local-first task workflow system for paper, experiment, engineering, review, and general research work.

- **Commands** are the user-facing workflow surface and are generated from `src/core/command-manifest.mjs`.
- **MCP tools** provide deterministic file-backed queries and mutations.
- **`.dove/`** is the authoritative durable workspace root.
- **Task packets** under `.dove/task-packets/` bind every task-scoped write to one durable task before mutation.
- **Boundaries and handoffs** on task packets describe why work stopped, who owns it, who should resume, and what evidence is required.
- **Runtime events/results** under `.dove/runtime/` append foreground transitions, stop reasons, and resumable continuation hints.
- **Lessons** under `.dove/meta/operator-lessons.json` preserve explicit reusable experience without importing raw runtime traces.

Dove should advance the work, not replace it with workflow ceremony. A useful pass produces or inspects a substantive artifact such as literature synthesis, experiment execution, baseline comparison, result interpretation, claim-boundary stress testing, draft text, review findings, or verified code/test evidence; task packets, receipts, validators, and evidence ledgers record that progress after it exists.

## Public commands

Dove exposes one flat public command surface:

| Command | Use it for |
| --- | --- |
| `project:dove.init` | Create or update the single project-level goal, represented as the unique level-0 task. |
| `project:dove.mission` | Convert a natural-language demand into a durable work contract with scope, deliverables, evidence, done criteria, and recommended next routes; after approval, materialize it and hand off to the recommended next workflow. |
| `project:dove.auto` | Convert demand or select a task with compact task/auto cards; after approval, run bounded multi-round foreground iterations until completion, a boundary, or the configured limit. |
| `project:dove.status` | Answer “what should I do next?” with one-sentence state, one recommended action, and explicit mission/full/debug expansion paths. |
| `project:dove.operator` | Preview compact queue cards, then run one confirmed foreground pass over ready/in-progress work and blocker-investigation planning. |
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
2. Pick the syntax for your host. The canonical command id is `dove.mission`; Claude Code users should have one user-level `/dove:mission` entrypoint, while OpenCode users commonly see project adapters as `project:dove.mission`.
3. Start with a real demand, not a command inventory. For engineering work, use `/dove:mission 修复 doctor 报错并运行相关验证`; Dove should propose a task contract, ask for confirmation, then materialize the contract and hand off to the recommended next workflow. If no init goal exists, the same confirmation should show the proposed init and task before writing either one.
4. Use presets inside a selected or newly created task: `/dove:figure 画 pipeline overview`, `/dove:draft 修改 introduction`, or `/dove:experience 规划并记录 ablation 结果`. Presets should resolve one durable task packet or ask for confirmation instead of silently guessing.
5. Use `/dove:status` as the default read-only “what next?” surface. The default CLI/human view is intentionally small: `Dove:` says the current state in one sentence, `Next:` gives exactly one recommended action, `Why:` explains why that action matters, and `More:` points to `--missions`, `--json`, or `--full --json` when you want task or governance detail. The terminal `dove status` command prints the same four-line view by default; `dove status --missions` expands mission details with a `Priority lane`, then a compact `Queue summary` and short `Queue preview` instead of dumping the whole backlog. Use `--full --json` when you need the complete machine-readable mission list. `dove status --json` or `dove status --format json` returns compact JSON with `headline`, `nextStep`, `needsAttention`, `changes`, and `showMore`, while `dove status --full --json` or `dove status --detail full --json` returns the full machine-readable dashboard. Use `dove statusline .` for terminal status bars that need a one-line read-only mission summary.
6. Use `/dove:operator` when you want to preview and run one foreground pass over queued work; it must not claim host work happened without pass results or a safe internal workflow step.
7. When a task yields reusable operating knowledge, record it with `/dove:lessons`.

## Terminal statusline

`dove statusline .` prints a compact one-line mission summary for terminal status bars, tmux status commands, or explicit foreground polling:

```bash
dove statusline .
watch -n 5 'dove statusline .'
```

The output includes `open`, `todo`, `doing`, and `blocked` mission counts. It intentionally does not show the next action, so the persistent terminal line stays stable and does not compete with `/dove:status` for routing decisions. `dove statusline --json` returns the same compact summary as JSON. This command is read-only: it calls the status query path, does not refresh derived state, does not publish public status, does not start a server, and does not run a daemon, scheduler, hidden loop, or background continuation. `watch` is only an operator-owned foreground terminal command.

## Task model

Dove treats work as a tree rooted at one init task:

- There is exactly one level-0 init task.
- `/dove:mission` first converts the operator's natural-language demand into a proposal-only durable work contract with a compact task card. The contract names the purpose, in-scope deliverables, out-of-scope boundaries, evidence contract, done criteria, practical impact, and ranked recommended routes with copyable packet-target commands. When the host supports interactive confirmation controls, the operator chooses approve and materialize the contract, adjust conversion, or cancel before anything is materialized into `.dove/task-packets/`.
- `/dove:init` is the only level-0 creation path; `/dove:mission` creates work under that root.
- User-created mission tasks default to level 3 and may explicitly use level 1, 2, 3, or deeper when the operator supplies a level.
- `/dove:mission` can autonomously propose checklist/subtask packets, but they are materialized only after the same conversion approval as the parent mission.
- System-created checklist/subtask packets are children of their mission and must have `level > parent.level`, so they are always deeper than the user task they serve.
- After approval, `/dove:mission` only materializes the contract and returns recommended next routes; it does not record execution results.
- After a packet exists, `/dove:status` should route continuation to `/dove:auto --packet-id <id>` or a domain workflow such as `/dove:draft`, `/dove:source`, `/dove:note`, `/dove:experience`, `/dove:figure`, or `/dove:review`; `/dove:mission` is for converting a new demand into a contract, not for repeatedly continuing an existing packet.
- When later execution records a completed planning result, Dove converts only explicit `plannedMissions`, `resultingMissions`, `missions`, `childMissions`, or `planConversion` output into pending durable missions. Every plan-derived mission must include an executable `executionContract` with `action`, `implementation`, `convergence.criteria`, and `failureRoutes`; missing or non-executable child output is rejected as a boundary instead of being inferred from the parent title.
- `/dove:status` uses the default compact `statusHome` result as a human translation layer: `headline`, one `nextStep`, `needsAttention`, `changes`, and `showMore`. It should not make ordinary users read packet ids, mission lists, boundary/gap codes, blocked counts, execution-gap counts, or required-evidence blocks before they know the single next action. Mission details remain optional/collapsed and should be expanded only when the operator explicitly asks to inspect current missions; hosts should not request `detail: "full"` or read a saved full status result file unless the operator explicitly asks to expand/debug details. Hosts should ask at most one confirmation dialog with compact adjustment cards only when status changes are requested or clearly actionable, do nothing when the dialog does not provide clear `packetId -> status` adjustments, then call `apply_dove_status_adjustments` only after explicit confirmation. Status choices remain `pending`, `ready`, `in-progress`, `blocked`, `completed`, and `killed`.
- Boundary types such as `awaiting-host-pass`, `needs-review`, and `awaiting-provider-output` are first-class metadata, not task statuses. They keep the current machine status coarse while recording required inputs/actions, `ownerRole`, `nextRole`, and optional `handoff` metadata.
- `/dove:operator` previews compact cards for auto-runnable, host-pass-required, blocked, and pending queues before confirmation. Confirmed runs execute only safe internal steps, record explicit host-supplied task results, or create pending plan missions for blocked-task investigation; host-pass-required tasks without `taskResults` remain unchanged and return the required evidence/actions instead of pretending execution happened.
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
- `.dove/runtime/results.json` — append-only foreground run and iteration results.
- `.dove/runtime/events.json` — append-only lifecycle, boundary, handoff, and workflow events.
- `.dove/runtime/continuation.json` — explicit next-command hints for later foreground invocations.
- `.dove/mutations/index.json` — mutation provenance and rollback eligibility metadata; it records patch-plan/direct-process source facts and is not a restore ledger.
- `.dove/config.json`, `.dove/config.local.json`, `DOVE_CONFIG_PATH`, `DOVE_LANGUAGE`, and `DOVE_FIGURE_*` overrides — response-language, figure provider, public network search, and status-serving configuration. Figure/status provider secrets should be referenced through environment-variable names such as `apiKeyEnv` or `tokenEnv`; `networkSearch` is public no-key only and rejects credential fields such as `apiKey`, `token`, `Authorization`, `headers`, or `apiKeyEnv`.

For OpenAI image generation, explicitly select the built-in provider with `providerId: "gpt-image2"` or `DOVE_FIGURE_PROVIDER_ID=gpt-image2`. Dove uses model `gpt-image-2`, reads the API key from `OPENAI_API_KEY`, writes the returned raster image under `.dove/figures/runs/<runId>/`, wraps it in a local SVG for the existing import/QA pipeline, and never stores inline API keys in `.dove/config*.json`.

Commands and skills provide behavior, but there is no hidden scheduler or swarm runtime. Optional MCP helpers mutate files deterministically; they do not replace `.dove/` as the source of truth.

## Network search

Dove includes read-only MCP search helpers for everyday external checking and scholarly discovery. They are not exposed as a separate slash command: source, note, auto, mission, draft, experience, and review workflows can use them when current outside information matters.

- `search_network` runs a bounded foreground search over public no-key providers and returns candidate materials only.
- `query_network_search_providers` reports which public no-key providers are available or unavailable.
- Default scholarly providers are OpenAlex, Crossref, arXiv, and Europe PMC. The generic `public-web` provider is intentionally reported as unavailable until Dove has a stable no-key web search provider; Dove should not pretend a commercial/keyed provider exists.
- Search does not write `.dove/` and does not make evidence. Verify each useful candidate's title, locator, DOI/URL, source identity, and provenance before calling source workflows.
- Use source to register verified external material, note or document evidence to synthesize the findings, and claims only after they cite registered sources or reviewed experiment results. A search snippet by itself must not become a claim.
- Provider failures, unavailable providers, zero results, or blocked retrieval are visible blockers. Dove should change query/retrieval strategy or stop with a clear next action instead of marking the research done.

Workspace config can disable or narrow public search without adding credentials:

```json
{
  "networkSearch": {
    "enabled": true,
    "defaultProviderIds": ["openalex", "crossref", "arxiv", "europe-pmc"],
    "disabledProviderIds": [],
    "timeoutMs": 12000,
    "maxResults": 8,
    "providerSettings": {
      "openalex": { "enabled": true, "timeoutMs": 3000 }
    }
  }
}
```

Do not put API keys, bearer tokens, Authorization headers, password fields, or `apiKeyEnv` under `networkSearch`; this surface is intentionally limited to directly public providers.

## Global public status and Cloudflare serving

`dove publish-global-status --refresh` publishes a static global index from configured or explicit project `.dove/public/status.*` files. It writes only the global public output directory, does not scan the computer, and does not start an HTTP server, Cloudflare tunnel, daemon, scheduler, or refresh loop. Use `--mutation-mode patch-plan` only when the output directory stays inside the target project and the host will apply the returned file operations through tracked file edits; `--refresh` and external output directories remain direct-process behavior and are not declared host rollback-safe.

Configure the global index in `~/.config/dove/config.json`, `DOVE_CONFIG_PATH`, or workspace `.dove/config*.json`:

```json
{
  "globalStatus": {
    "outputDir": "~/.local/share/dove/public",
    "projects": [
      {
        "root": "/home/nvme01/paper_factory",
        "slug": "paper-factory",
        "title": "paper_factory"
      }
    ],
    "auth": {
      "enabled": true,
      "password": "<status-page-password>"
    },
    "cloudflare": {
      "enabled": true,
      "domain": "keli.eu.cc",
      "tunnelName": "dove-global-status",
      "originHost": "127.0.0.1",
      "originPort": 8787,
      "configPath": null,
      "credentialsFile": null,
      "tokenEnv": "DOVE_CLOUDFLARE_TUNNEL_TOKEN",
      "dnsResolverAddrs": ["1.1.1.1:53", "1.0.0.1:53"]
    }
  }
}
```

`dove serve-global-status --refresh` is the explicit foreground serving path. It publishes once, serves only the sanitized global public directory over loopback, enforces `auth` with a password-only login page when enabled, and then runs Cloudflare Tunnel visibly in the foreground. Stop it with Ctrl-C. The status-page password may be stored in local/global Dove config as `auth.password`, or referenced through `auth.passwordEnv` when you prefer environment injection. Cloudflare API tokens and tunnel tokens must not be stored inline in Dove config; use `tokenEnv` or cloudflared credentials instead. A `tokenEnv` tunnel is treated as already provisioned, so run it without `--configure-cloudflare`; configure the public hostname/DNS in Cloudflare Dashboard or use cloudflared login credentials with `--configure-cloudflare` when Dove should create the named tunnel and route DNS. Set `dnsResolverAddrs` when the host resolver cannot resolve Cloudflare Tunnel SRV records such as `_v2-origintunneld._tcp.argotunnel.com`.

Use `dove serve-global-status --dry-run --auth --cloudflare --domain keli.eu.cc` to inspect the planned auth summary, local URL, public URL, and `cloudflared` argv arrays without starting a server or changing Cloudflare DNS. If you use `auth.passwordEnv` instead of `auth.password`, pass `--auth-password-env DOVE_GLOBAL_STATUS_PASSWORD` or configure the same field in Dove config.

When `auth.passwordEnv` is used, set that environment variable before running the real foreground server. Dove uses the value only for the local server check and removes it from the `cloudflared` child environment.

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

Use `project:dove.source` to organize external information and source details. When current public information or scholarly material is needed, first use public no-key network search or visible retrieval to find candidates, then register only verified material. Network/provider calls must be explicit or safely configured; Dove records durable source metadata rather than trusting memory.

### Note

Use `project:dove.note` to consolidate internal information from the repository, existing `.dove/` artifacts, notes, drafts, review outputs, verified sources, and explicitly labeled search candidates or open questions.

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

`project:dove.auto` uses the same demand-to-task intake as `project:dove.mission`: it returns a proposal-only auto contract with compact task/auto cards for either a converted `proposedTask` or a selected durable `selectedTask`, classifies the request, reports applicable lessons, and requires explicit confirmation before task creation/selection proceeds into autonomous execution. When task selection is missing or ambiguous, hosts should present indexed choices through confirmation UX instead of guessing.

After confirmation, auto may internally call top-level Dove workflows such as source, note, experience, figure, draft, review, review-loop, rebuttal, lessons, and status. When the work depends on current outside information, provider/tool behavior, papers, or public documents, auto should run a visible public no-key search or retrieval step early, verify candidates, and then deposit verified sources plus synthesis rather than treating candidate snippets as evidence. It runs only inside the current foreground call, records each iteration in `.dove/runtime/results.json`, and uses `.dove/state.json.settings.auto.maxIterations` as the default limit; the default is 3.

It stops at completed, blocked, killed, review/authority boundary, missing provider credentials, conflicting task target, or step-budget exhaustion. When it stops because work cannot safely continue, it writes an explicit boundary instead of pretending host/code/provider work happened. If the response ends before the task is complete, Dove does not secretly continue in the background; the next operator action must invoke another foreground command.

## Workflow goal validation

`npm run workflow-goals:validate` runs executable product-goal pressure scenarios through the real MCP dispatch path. These scenarios are not just schema checks: they verify that Dove behavior satisfies named workflow objectives, acceptance criteria, and failure-reflection metadata.

The current gate includes the operator host-pass-only pressure test: if `/dove:operator` is confirmed without a safe internal step or explicit `taskResults`, the task must remain unchanged, no runtime result may be persisted, the response must return `needs-host-results`, and required host actions must be surfaced instead of claiming foreground execution. Each workflow goal contract also names the failure mode, regression artifacts, remediation targets, and the explicit `project:dove.lessons` ritual required when a goal fails.

`npm run check` and `npm run maturity:audit` both run this gate, so a workflow can no longer pass release checks solely because command schemas, adapters, and unit tests are structurally valid.

## MCP tools

The optional MCP layer exposes deterministic helpers for hosts and integrations, including compact `statusHome`/`dailyHome`, proposal-only action cards, compact confirmation cards, and operator-facing result contracts. Full status dashboard, task tree, runtime details, and the complete canonical tool registry are available only when callers explicitly request full or debug detail.

Default `tools/list` discovery returns a compact operator surface rather than every canonical helper. Common entry tools include:

- `query_dove_status`
- `query_dove_orchestrate`
- `query_document_ledger`
- `query_operator_lessons`
- `search_network`
- `query_network_search_providers`
- `create_dove_task`
- `run_dove_auto`
- `run_dove_operator`
- `register_source`
- `upsert_note`
- `upsert_draft`
- `record_document_evidence`
- `run_figure_workflow`
- `run_experience_workflow`
- `run_review_loop`
- `build_rebuttal_strategy`
- `query_dove_return`

Compact MCP results include `operatorRoute`, `operatorUnblock`, `writeIntent`, and `rollbackEligible` so callers can tell no-write checks from proposed patches or applied durable writes without reading a full diagnostic payload.

Lower-level support tools remain available for internal composition, validation, import/export handoffs, and compatibility with durable artifacts. They can still be called by canonical name when appropriate, but they are not part of default operator discovery and are not necessarily public slash commands.

## Role model

The user-facing role model has three primary manual agents:

- `planner` owns direction, priority, governance, and autonomy boundaries.
- `builder` owns writing, research, experiments, results, revision, rebuttal drafting, implementation, and evidence work.
- `reviewer` owns independent concerns, weaknesses, evidence/method attacks, code review, QA, and verdicts.

Specialists such as researcher, experiment planner, revision/rebuttal lead, and version analyst are automatic subagents under those primary agents. They are useful for scoped context, but they should not be treated as peer manual identities. Durable role handoff is packet/runtime metadata; Dove does not expose separate planner, builder, or reviewer slash commands.
