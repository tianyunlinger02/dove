# Packaging

## Delivery model

Dove 3.2.6 is one host-neutral Node.js 22 npm artifact. It installs the `dove` executable for the current user. Consumer projects invoke `dove` from `PATH`; project initialization installs host-facing Markdown resources and software metadata, not copied runtime bundles. A global npm upgrade with lifecycle scripts enabled runs `postinstall` to safely refresh the package-owned integration of projects in the user's XDG config registry; it does not discover projects by scanning the home directory.

The bare public npm package named `dove` is unrelated. Release instructions must use an exact trusted tarball, Git revision, or internal-registry package version.

Dove 3.2.6 is source-available under the PolyForm Noncommercial License 1.0.0, not OSI-approved open-source software. Dove itself may be used only for purposes permitted by that license; this release does not offer or advertise a commercial-license path. Bundled third-party components retain their own MIT or ISC rights, recorded separately in `THIRD_PARTY_NOTICES.md`.

## Release inventory

Every Dove 3.2.6 release contains:

- **one Dove research agent** for supported agent hosts;
- **9 optional specialist Skills**: `research`, `status`, `source`, `experiment`, `draft`, `figure`, `review`, `rebuttal`, and `lessons`;
- generated adapters for the declared host formats;
- the project lifecycle CLI, explicit `dove review ...` runtime, local `dove run ...` execution receipts, plus the Claude SessionStart and short UserPromptSubmit re-anchor hooks;
- public documentation and the official root `dove.png` brand artwork;
- the Dove `LICENSE` and bundled-component `THIRD_PARTY_NOTICES.md`; and
- **2 standalone Node.js bundles**.

The root `dove.png` is the authoritative brand artwork shipped as an ordinary package asset and displayed by both README entry pages. The CLI preserves its hard pixel outline as a static Unicode rendering, with a cyan Dove and green branch in color terminals and no glow, so ordinary terminals need no image protocol or runtime decoder; the image is not copied into consumer projects or embedded as another bundle.

There is no Auto Skill or command, Dove research MCP server bundle, research tool registry, MCP CLI command, Research Format runtime, or separate Dove-managed planning, authoring, or reviewing agent. The explicit `dove review ...` runtime stores review exchange records under `.dove/reviews/**` and uses the user's installed Claude Code CLI for isolated read-only reviewer sessions; it is not a research database or proof of acceptance. The `dove run ...` helper stores local run receipts under `.dove/runs/**`; it records command execution evidence, not scientific conclusions or cross-host process control. The artifact contains hidden Claude guidance Skills and fixed project fragments for pinned `dove-paper-search` (`paper-search-mcp==0.1.4`) and hosted Exa; it does not contain third-party runtimes or credentials.

Ordinary Claude conversation is the primary Dove entrance through the project rule's shared judgment and author stance. `claude --agent dove` and the nine flat Skills are optional entrances with no higher judgment authority. The ordinary main session keeps full-conversation work, important clarification, and mainline ownership before and after bounded delegation. Isolated review uses the same researcher in a reviewer position, not another persona. There is no Auto command. Adapters project these roles into host formats; scoped behavior belongs in [Usage](USAGE.md#scope-plans-and-progress), not a separate packaging rubric.

## Generated host surfaces

Dove supports exactly two host projections:

- Claude Code: `.claude/agents/dove.md`, nine `.claude/commands/dove/*.md` optional Skill shortcuts, the shared Dove rule, SessionStart and UserPromptSubmit re-anchor hooks, paper-search MCP integration, and Exa integration;
- DeepSeek Harness: `.dsh/skills/dove-*/SKILL.md` for the nine filesystem Skills.

Both hosts declare two shared exclusive reference resources:

| Installed destination | Canonical source and role |
|---|---|
| `.dove/install/RESEARCH_QUALITY.md` | `src/core/dove-research-contract.mjs` renders substantive quality criteria and current-use joint conditions. |
| `.dove/install/AUTHOR_PREFERENCES.md` | `docs/AUTHOR_PREFERENCES.md` is the sole editable source for full author-side research, engineering, writing, and collaboration preferences. `src/core/dove-author-preferences-content.generated.mjs` preserves its Markdown for the bundled renderer; `src/core/dove-author-preferences.mjs` owns the reference path, renderer, and read trigger. |

Both references are installed once when both hosts are selected; no other `.dove/install` file becomes an exclusive integration resource. They are neither researcher-owned Lessons nor research evidence. Short host context links to quality guidance on demand and requires each fresh host main-agent context to personally read the full author-preference reference before substantive work; installation or hook delivery is not proof of that read. [Usage](USAGE.md#short-core-and-two-reference-read-contracts) owns applicability and read triggers. Isolated review receives only separate canonical quality guidance, not the author preference reference.

Release projections live under `package-resources/hosts/...`, outside host-recognized repository roots. Installation uses bundled renderers to write canonical resources into consumer projects, not disk copies of these projections. OpenCode, Codex, Cursor, and shared Agents projections are not packaged.

Claude support resources include the shared Dove rule, hidden Claude guidance Skills for pinned `dove-paper-search` and hosted Exa use, the managed SessionStart hook, and an optional managed `statusLine` fragment. The status line is installed only when the project has no existing line; it invokes the user-level CLI read-only. The managed `UserPromptSubmit` read-only verifies full managed integration against the installed CLI; only when current does it supply a bounded current short core and rule/reference fingerprints on every prompt, otherwise a nonblocking diagnostic. It does not classify, read or write research, decide permissions, or block submission. It adds no hidden intake, router, blocking Stop scheduler, or per-tool scientific approval; DSH remains Skills-only. The dormant compatibility `dove hook stop` command cannot infer the user's current request from a Stop event and emits no continuation output; ordinary installation does not register it. This prevents a bounded/read-only request from being spuriously prolonged, but does not enforce multi-round autonomy.

Adapters are generated from canonical Dove workflow sources. They carry the same Dove agent behavior into installed projects: for a confirmed goal, Dove keeps selecting, performing, and absorbing the overall-best feasible mainline action until the goal is achieved or a real blocker is established. They use only tools the current host exposes and current user/project permissions allow. Do not edit generated projections independently. Adapter presence does not establish installation, registration, tool availability, project readiness, reviewer identity, or `dove-review` independence. Claude's Review command can call `dove review handoff|status|resume|rerun|import`; DSH has no equivalent recoverable isolated Claude Code context in this package and should not present one as available.

Claude Code and DSH are the only supported project initialization paths. The packaged bare `dove` CLI presents both as a checkbox menu, with Claude selected initially and either or both concrete host IDs passed into the existing lifecycle. DSH support is intentionally limited to filesystem Skills; first-class DSH slash commands, hooks, MCP, or agent services would require a separate Cordis plugin.

## Runtime bundles

The package contains two standalone Node.js 22 ESM bundles:

| Bundle | Purpose |
|---|---|
| `dist/index.mjs` | Public library bundle. |
| `bin/dove-package.mjs` | Packaged `dove` CLI. |

The package contains no MCP server bundle, prompt-hook bundle, or third-party Python source. `commands:generate` first generates `src/core/dove-author-preferences-content.generated.mjs` from `docs/AUTHOR_PREFERENCES.md`, then writes declared host adapters and support resources, including quality and author-preference references and the Claude agent. `commands:check` checks the generated content module and those projections for drift. `build` writes only `dist/index.mjs` and `bin/dove-package.mjs` from the declared source entries; `build:check` compares temporary in-memory builds with those outputs. None of these build/check commands installs or synchronizes a consumer project. Consumer installation does not regenerate them; global npm `postinstall`, when enabled, may synchronize registered project integration, as may explicit `dove projects sync`.

## Project integration

For the supported path, `dove init --host claude` installs the Claude command adapters, Dove agent, shared Dove rule, hidden paper/web guidance Skills, SessionStart and UserPromptSubmit re-anchor hooks, `.dove/install/manifest.json`, a project-scoped `permissions.deny` entry for built-in `WebFetch`, and owned fragments at `.mcp.json#/mcpServers/dove-paper-search` and `.mcp.json#/mcpServers/exa`. If no `statusLine` already exists, it also installs the managed read-only command `dove hook statusline --project "$CLAUDE_PROJECT_DIR"`; any existing user or Trellis line is left unowned and unchanged. The prompt fragment is managed separately from exact retired prompt entries under the same ownership protections.

The `dove-paper-search` fragment launches the pinned external package through user-provided `uvx` for scholarly paper discovery, DOI metadata lookup, download, and full-text reading; direct DOI checks use `get_crossref_paper_by_doi` when exposed and permitted. The Exa fragment is the hosted remote MCP shape `{ "url": "https://mcp.exa.ai/mcp", "type": "http" }` for ordinary webpage bodies, documentation pages, venue pages, and known URLs. Built-in `WebSearch` remains available for search discovery, while built-in `WebFetch` is denied. Dove does not install or bundle Python source, write credentials, register a user-level server, approve project trust, or provide CLI/shell/`curl`/fetch-script substitutions for web retrieval. It also bootstraps only the minimal researcher-owned `.dove/research/RESEARCH.md` entry outside the installation manifest when no research tree exists. Existing `.dove/research/**` bytes remain researcher-owned.

The project installation manifest uses revision `2.0`. Optional ordinary `DOCTOR.md` feedback about Dove itself also lives under `.dove/install/`; there is no Doctor JSON state or issue lifecycle. Managed-file hashes are internal software safety data and are not exposed as research evidence.

Project paths and managed-resource parents must remain contained and unambiguous. Existing matching resources may be recognized without rewriting them. Explicit update replaces local edits only for valid manifest-owned Dove resources and reports `replacedLocalEdits`; automatic/bulk project sync instead blocks the whole project without writing if **any** owned resource has drifted, is missing, or conflicts (including the paper-search MCP fragment). Other registered projects can still be refreshed. SessionStart inspects integration read-only and may suggest explicit `dove update` through `systemMessage`; it writes no resources, shared configuration, or cleanup state. Shared configuration keeps unrelated fields and entries.

## Research Markdown ownership

Research context is ordinary Markdown under `.dove/research/`. Fresh project initialization creates only root `RESEARCH.md` as a researcher-owned entry. Mission, Source, Experiment, Review, Claim, and Lesson summaries or topic documents are optional researcher-owned materials created naturally when the work needs them. Local run receipts under `.dove/runs/**` are separate execution records and do not replace Experiment Markdown.

The isolated review prompt shares Dove's research judgment but uses the reviewer position: reconstruct and challenge the contribution rather than inherit the author's mainline. Whole-paper review asks whether the method answers the question, field judgment is correct, contribution and evidence fit the venue, and the strongest reasonable objection can be answered. The requested Markdown headings are `Verdict`, `Blocking issues`, `Grounding basis`, and `Author-side next actions`; the runtime does not parse them into an acceptance gate.

Each optional summary is a researcher-owned entrance and synthesis, not a generated index. Lessons are fallible reusable experience, not a carrier for package-default preferences or a replacement for either managed reference. Source explanations are useful when available but not mandatory.

The package does not define fixed headings, frontmatter, IDs, enums, machine indexes, stored counts, research hashes, a Research Spine schema/ledger, or a mandatory Markdown template. Mission, Source, Experiment, Review, and occasional Claim documents are conventions chosen for readability, not entity stores.

Research documents may use ordinary Markdown relative links and readable project-relative artifact paths for recovery, but the package does not parse links, audit backlinks, enforce a consistency matrix, or turn them into a database.

When newly executed central experiment work needs recording, the same Experiment document holds the prospective plan and later actual results. The corresponding Review document may preserve author-side scientific self-checks, `dove-review` handoff preparation, frozen materials, clarifications, rebuttals, and the actual reviewer Markdown return; author handling is added only when requested, and substantive response and revision remain author-side Dove work. Lessons are optional researcher-owned materials.

## CLI inventory and lifecycle

The packaged CLI exposes:

```text
init, update, reinstall, uninstall, doctor, projects, review, run, hook
```

Bare `dove` is the interactive lifecycle front door. It classifies the project, shows only safe state-appropriate operations, supports platform selection and platform changes through the existing init/update lifecycle, keeps technical Doctor output behind View details, and requires a real preview plus default-No confirmation before Complete Reinstall or uninstall. Building repository bundles does not refresh a copied user-level npm installation; release deployment must install the exact built artifact into the intended user prefix.

- `init` creates supported project integration and, only if the research directory is absent, the minimal researcher-owned `RESEARCH.md` entry in one transaction. Existing research directories are not read or repaired. Initialized projects register their exact roots in the user's XDG config registry for future global upgrades.
- `update` refreshes recognized integration without rewriting existing `.dove/research/**` content. It replaces local edits only for valid manifest-owned generated or existing Dove integration resources and reports `replacedLocalEdits` in JSON output. It installs the Dove status line when that setting is empty, preserves an unowned existing line, and does not create missing summaries or replace Lessons materials.
- `uninstall` displays the exact managed removal scope and defaults to No. After confirmation it removes manifest-owned Dove project integration, including the exact `.dove/install/RESEARCH_QUALITY.md` and `.dove/install/AUTHOR_PREFERENCES.md` references and an unchanged Dove-owned status line, while preserving `.dove/research/**`, `.dove/reviews/**`, `.dove/runs/**`, `.dove/install/DOCTOR.md`, all legacy markers and unknown installation files, unrelated settings, hooks, MCP servers, pre-existing or user-modified status lines, and ordinary files. A manifest-owned exact retired `UserPromptSubmit` setting is deleted only when still attributable.
- `reinstall` displays the deletion and replacement scope and defaults to No. A valid current installation manifest is required; no adoption, revision-1.0 migration, or unknown-file cleanup is performed. After confirmation it rebuilds integration while preserving `.dove/research/**`, `.dove/reviews/**`, `.dove/runs/**`, `.dove/install/DOCTOR.md`, and ordinary project files.
- `doctor` is a read-only developer diagnostic with integration states `uninitialized`, `current`, `needs-update`, and `blocked`; it does not judge science. Host-maintained `DOCTOR.md` feedback is separate and does not require this command.
- `projects import --project <root>... --sync` registers exact, explicitly supplied existing project roots and synchronizes the registered set; `projects sync` retries the registered set, and `projects status` inspects registration and the last sync report read-only. No whole-home scan, unknown-project adoption, or research/review/run writes occur. Global npm `postinstall` syncs only registered projects, only for global installs when lifecycle scripts run; `--ignore-scripts` skips cascading. npm may hide lifecycle output (`--foreground-scripts` shows it). After any project has committed, a later per-project failure is reported as partial success with exit zero to avoid npm rollback inconsistency; preflight failure before any commit may exit nonzero. A refreshed project still needs an active host session reload.
- `review handoff|status|resume|rerun|import` records explicit `.dove/reviews/<id>/review.json` metadata and per-round `snapshot.json`, `report.md`, and `backend.json`. `handoff` and `rerun` copy only the listed project-relative regular files into the external reviewer workspace, use the Claude Code CLI with Read-only tools, and preserve the real returned session id. The reviewer has no web or MCP access, so venue or literature grounding must be author-side material listed in the frozen handoff when needed. `status` is read-only and compares internal snapshot receipts with current project files as `current`, `changed`, `missing`, or `unavailable`; public CLI and JSON output expose paths plus safe size/existence/type/error facts without hash fields and do not parse report verdict text. `import` stores user-supplied Markdown as imported provenance and does not claim the runtime reviewer generated it.
- `run start|status|resume|finalize|compare` records explicit `.dove/runs/<id>/run.jsonl`, `stdout.log`, and `stderr.log` receipts. `start` launches a detached supervisor that directly spawns the target command from the project root without a shell, records command, timing, outcome, metric, budget, and basis, plus an explicitly declared seed and minimum Git commit/dirty facts rather than an environment inventory. Git facts do not affect comparison eligibility or ranking. `status` is read-only; `resume` never reruns work; `finalize` appends one scalar metric after terminal completion; `compare` ranks only compatible terminal finalized runs by metric, budget, data, evaluator, and resource basis.
- `hook session-start` inspects package-managed integration read-only. Non-current integration may prompt explicit `dove update`; unsupported state is blocked rather than migrated or reconstructed.
- Only compact/resume receives a read-only facts card: `RESEARCH.md` existence and absolute mtime; latest Review id, round, absolute `updatedAt`, and material currentness; latest Run id, absolute `startedAt`, status, and exit code. It reads metadata and run journals, and checks the latest review round's listed material bytes for currentness; it does not read research Markdown bodies, reports, or stdout/stderr logs or infer the mainline. Startup/clear receives no research card. Missing or unreadable facts remain `unavailable`.
- `hook` supports read-only `session-start` inspection and the managed `statusline` renderer. The renderer keeps native model/context facts, optional unlabeled cyan mainline text, Git branch and session duration on the first line, and only the explicit absolute project path on the second. Only a nonempty `NO_COLOR` disables color. It reads Git without a shell and only the first 64 KiB of the root `.dove/research/RESEARCH.md` for an ordinary `Mainline: <text>` line, even when the file is larger; uniqueness is checked in complete inspected lines, not the unread suffix. Unavailable or ambiguous mainlines in that prefix are omitted, never inferred from other prose or Mission/Run/Review. There are no research-tree scans or writes, and SessionStart is unchanged. `hook user-prompt-submit` emits the verified short guidance or a safe diagnostic described above, not the SessionStart facts card.
- SessionStart never writes files or configuration, cleans up legacy/unknown state, or invokes update or Complete Reinstall. Startup and `/clear` emit the small author-preference bootstrap even without warnings; compact/resume retains its bounded facts card plus continuity guidance without an unconditional full preference reread. For already-open Claude sessions with a registered working Dove prompt hook and a successfully refreshed project, the next prompt can deliver verified current short guidance, after which the main agent reads changed full references as needed without discarding its conversation. This does not reload the host rule registry, hooks, tools or permissions and cannot prove that the agent completed the read; sessions without the old hook still require a fresh host context for complete integration.
- Stop is not a managed lifecycle hook and does not perform synchronization, research continuation, tool calls, or writes.

There is no `mcp` command and no `migrate-research` command.

Review supplies `.dove-package/RESEARCH_QUALITY.md` as canonical package guidance, outside the listed user materials and their snapshots; it does not expand reviewer access. Frozen rounds and pending exchanges are saved before invocation. A failed post-call save cannot undo reviewer session history or recover an unsaved response; resume uses the original requested session and confirms it only from a matching response. Reports are not hashed or parsed into scientific verdict states. Run uses a supervisor only for start; resume/finalize append in the caller under a bounded directory lock. Occupied locks are reported by absolute path, not recovered using PID, age, or ownership metadata.

Reviewer workspaces use short runtime paths rather than embedding the consumer project's directory hierarchy. Keep those workspaces separate from durable review records; path layout alone does not prove isolation. Run budget metadata is a comparison basis, not prepayment or an automatically enforced spending cap. Explicit user limits, permissions, and timeout controls still apply.

## Research and review boundaries

- The host performs real retrieval, analysis, experiments, coding, writing, and figure production with tools the current host exposes and current user/project permissions allow.
- `status` is read-only; a missing overview is reported naturally, and broken links are reported naturally.
- Default Dove progression is foreground multi-round work for a confirmed goal; there is no Auto Skill, command, daemon, scheduler, or hidden session store.
- Review may use Dove's read-only author-side self-check, or start/resume `dove-review` from a frozen near-submission handoff. In Claude Code projects, the real runtime is `dove review handoff|resume|rerun|import|status`; it gives the reviewer only copied listed materials and stores round records under `.dove/reviews/**`.
- Local command experiments may use `dove run start|status|resume|finalize|compare`; run receipts are execution evidence only and do not claim reproducibility, statistical significance, or scientific correctness.
- A native role label, author-side self-check, or ordinary local session does not establish `dove-review` independence.
- Tests and packaged artifacts do not certify research claims or Dove research quality.

## Verification evidence

Keep these claims separate; none implies the next:

| Evidence | What it establishes |
|---|---|
| Canonical source instructions | Intended behavior encoded by the current source revision. |
| Generated host resources / built bundles | The inspected projections or bundles match their source owners, when the relevant drift checks actually ran. |
| Installed project resources | Managed disk bytes and configuration for that project, when inspected; generating or building alone does not install them. |
| Currently loaded host context | Only directly observed session loading facts; the CLI cannot infer these from installed bytes, version equality, or an explicit update. |
| Actual model behavior | What happened in the observed task and permitted context, not what the prompt says should happen. |
| Scientific outcomes | Claim-matched research evidence, not source changes, test passes, installation health, or a model's completion notice. |

These are evidence boundaries, not mandatory stages, a new state machine, or a requirement to run every check for every task. Documentation-only work can finish with static checks without claiming refreshed installation, live behavior, or scientific progress.

## Build and release validation

From a source checkout:

```bash
npm ci
npm run release:check
npm run pack:dry-run
```

`npm run check` is the regular software gate. Release validation protects the nine-Skill inventory, Dove agent surface, generated adapter drift, absence of retired MCP and prompt-hook runtimes, the two bundle entrypoints, CLI inventory, run receipt behavior, and package archive contents. When those paths change, exercise lifecycle behavior separately with isolated synthetic projects and XDG configuration. Realistic experience testing may observe an ordinary user request in an approved active consumer project, with a bounded observation and stopping point; record Dove's behavior and stop test-owned continuation at that boundary without treating the project's research as a release result. Approved user-level releases cascade only package-managed integration resources to registered projects. Review validation uses a fake Claude executable. Behavior validation is offline and does not initialize projects. Full Run validation initializes scratch projects and creates synthetic Git commits; use its `--receipts-only`, `--timeouts-only`, and `--comparisons-only` entrypoints when installation or commit creation is outside scope. `runtime:validate` covers synthetic JSON and transaction behavior without installation. Installation, uninstall, and package validators perform lifecycle operations and need suitable authorization. These checks can validate domain contracts and generated projection, but they cannot prove that Dove chose or performed the right research action, absorbed Review evidence, interpreted run receipts correctly, continued while useful work remained, or stopped at the correct product boundary.

These checks validate the software release only. They do not prove scientific correctness, research completion, reproducibility, acceptance, `dove-review` independence, or Dove research quality.

## Stable Markdown and project file boundaries

- Research Markdown has no format or schema version. Future organization changes use ordinary host file operations to rename, move, relink, or consolidate documents while preserving substantive content, failures, limitations, and uncertainty; they do not create a migration framework or runtime fallback.
- Requested artifacts such as drafts, figures, experiment documents, and revisions are created or modified when the task requires them. Additional Dove research Markdown is maintained when the user explicitly asks to record, update, or save it, when results clearly change the research mainline, conclusion, decision, or priority, or when preserving the work's evidence and continuation context is genuinely useful.
- Managed file transactions use cross-platform containment, ordinary-file/symlink checks, staging, expected-state rechecks, and rollback after caught promotion failures. If restoration fails, keep the transaction root and backups and report their absolute paths; do not claim rollback succeeded or overwrite a newly occupied target. This is not crash recovery, a filesystem-wide atomic transaction, or rollback of external session history. It does not require Linux `/proc` features.
- Complete Reinstall displays the current deletion and replacement paths, defaults to No, and after confirmation rereads the project and executes the current plan.
- `DOCTOR.md` is ordinary host-maintained feedback about Dove itself, without JSON projection, issue lifecycle, or CLI ownership.
