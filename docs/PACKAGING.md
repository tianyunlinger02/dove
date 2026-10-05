# Packaging

## Delivery model

Dove is one host-neutral Node.js 22 npm artifact. It installs the user-level `dove` executable; projects invoke it from `PATH` and receive host-facing resources and software metadata, not copied runtime bundles. A global npm upgrade with lifecycle scripts enabled uses `postinstall` to refresh only registered projects, never a home-directory scan.

The bare public npm name `dove` is unrelated. Release instructions use an exact trusted tarball, Git revision, or internal-registry artifact. Dove is source-available under PolyForm Noncommercial License 1.0.0, not OSI-approved open-source software, with no advertised commercial-license path. Bundled third-party MIT/ISC rights remain separate in `THIRD_PARTY_NOTICES.md`.

## Release inventory

The package contains:

- one Dove research-agent identity, with an optional author-side agent and native fresh read-only `dove-mentor` / `dove-review` contexts;
- nine optional flat Skills: `research`, `status`, `source`, `experiment`, `draft`, `figure`, `review`, `rebuttal`, and `lessons`;
- generated adapters and declared support resources for Claude Code and DSH;
- project lifecycle commands, local `dove run` receipts, and Claude integration hooks;
- public documentation, root `dove.png`, `LICENSE`, and `THIRD_PARTY_NOTICES.md`; and
- two standalone Node.js bundles.

`dove.png` is the authoritative brand artwork shown by both READMEs. The CLI uses a static hard-outline Unicode rendering, cyan Dove and green branch when colored; no image protocol, decoder, copied consumer asset, or extra bundle is needed.

There is no Auto command, research-state MCP bundle/database, fallback runtime, or separate researcher persona. Native mentor/reviewer invocation uses the host's Agent tool, not a Dove model-launching CLI, frozen snapshot, project-external workspace, or socket launcher. Historical `.dove/reviews/**` is preserved without requiring the old runtime. Source, Draft, Figure, Rebuttal, and Lessons are unchanged by this structure.

Ordinary Claude conversation through the shared project rule is the complete primary entrance. Optional agent/Skills add no authority or permissions. The main session retains the full user conversation, clarification, execution, and result adoption; read-only subagents return judgments only. See [Usage](USAGE.md).

## Generated host surfaces

Only two host projections are packaged:

- **Claude Code** — `.claude/agents/dove.md`, `.claude/agents/dove-mentor.md`, `.claude/agents/dove-review.md`, nine `.claude/commands/dove/*.md` shortcuts, the shared rule, managed SessionStart/UserPromptSubmit/Stop fragments, conditional status line, and paper/web support.
- **DSH** — nine `.dsh/skills/dove-*/SKILL.md` filesystem Skills. No Claude agents, hooks, MCP declarations, permissions, or equivalent native agent service is projected.

The mentor and reviewer definitions expose only `Read`, `Grep`, and `Glob`. Each invocation uses a fresh native context with specified files, not previous conversation or reviewer history. The mentor reads identity/evaluation/recent rounds and actual changes; the reviewer reads current manuscript/cited results and supplied grounding. Both return the files actually read. Definition presence alone does not prove that an invocation occurred or was independent.

Both hosts share four exact exclusive files:

| Installed destination | Canonical source and role |
|---|---|
| `.dove/install/RESEARCH_QUALITY.md` | `src/core/dove-research-contract.mjs` renders short Chinese quality essentials. |
| `.dove/install/RESEARCH_QUALITY_FULL.md` | The same owner preserves full criteria and joint conditions. |
| `.dove/install/AUTHOR_PREFERENCES.md` | `src/core/dove-author-preferences.mjs` owns short preference essentials and the fresh-context read contract. |
| `.dove/install/AUTHOR_PREFERENCES_FULL.md` | `docs/AUTHOR_PREFERENCES.md` is the sole editable full source, preserved in `src/core/dove-author-preferences-content.generated.mjs` for bundled rendering. |

These are shared files, not ownership of `.dove/install/`. Fresh main contexts personally read the essentials; full companions are on demand. Installation and hook delivery do not prove reading. References are guidance, not evidence, permissions, or Lessons; reviewer/mentor read scope does not include author preferences. See [reference roles](USAGE.md#short-core-and-two-reference-read-contracts).

Release projections live under `package-resources/hosts/...`, outside host-recognized repository roots. Consumer installation uses bundled renderers, not disk copies of those release projections. Edit canonical sources, not generated adapters. OpenCode, Codex, Cursor, and shared Agents projections are not packaged.

## Runtime bundles

| Bundle | Purpose |
|---|---|
| `dist/index.mjs` | Public library bundle. |
| `bin/dove-package.mjs` | Packaged `dove` CLI. |

`commands:generate` first generates preference content from `docs/AUTHOR_PREFERENCES.md`, then declared adapters, native agent definitions, and support/reference resources. `commands:check` checks drift without writing. `build` writes the two bundles from declared entries; `build:check` compares in-memory builds with existing outputs. None installs a consumer project. Consumer installation does not regenerate artifacts; npm `postinstall` and explicit project sync can refresh registered integration.

No MCP server bundle, prompt-hook bundle, third-party Python source, credentials, or external model runtime is shipped.

## Project integration

`dove init --host claude` installs declared resources and owned settings fragments, a revision `2.0` manifest, project WebFetch denial, and `.mcp.json#/mcpServers/dove-paper-search` / `exa`. Existing status lines remain unowned; an empty setting receives the read-only `dove hook statusline --project "$CLAUDE_PROJECT_DIR"` renderer.

Paper search launches user-provided `uvx` with pinned `paper-search-mcp==0.1.4` and `mcp<2`. Hosted Exa uses `{ "url": "https://mcp.exa.ai/mcp", "type": "http" }`. These declarations provide scholarly and webpage-reading integration, not access approval or connectivity evidence. Built-in WebSearch stays available for discovery; WebFetch is denied. Dove does not install dependencies, approve project trust, write credentials, or substitute CLI/shell/`curl`/custom-fetch scripts.

SessionStart inspects integration read-only; startup/clear adds the two-essentials bootstrap, compact/resume the bounded card/continuity reminder. UserPromptSubmit verifies managed integration and presents the bounded identity/current guidance when current, otherwise a nonblocking diagnostic. Neither writes research, classifies prompts, grants permissions, or reloads an active host's configuration.

The managed Stop hook gives one round reminder only when the identity card says ongoing and no mentor was called in the current turn. `stop_hook_active: true` or unavailable transcript evidence allows stopping. It checks host tool-call events without analyzing or sending conversation content to a model, creates no tracking file, and writes nothing. Explicit discussion-only/stop requests cause the main session to mark the round paused. No background scheduler is added.

Owned paths/configuration remain contained and unambiguous. Explicit update may replace valid owned local edits and reports `replacedLocalEdits`; automatic/bulk sync blocks the entire project with zero writes for any owned drift/missing resource/conflict. Unrelated settings and files are preserved. Installed digests protect software ownership, not scientific claims. Exact protections belong in [Installation](INSTALL.md).

## Research Markdown ownership

Three researcher-owned records carry new core work:

- `IDENTITY.md` — stable Mainline, confirmed completion, constraints/recent corrections, and top-of-card `Current round` / `Round status: ongoing / paused / completed` within the first 4KB. Overlong presentation keeps the first 4KB and asks for shortening, not a false missing-card report.
- `EVAL.md` — the user-confirmed evaluator/dev-test split/metric columns, including generalization, and one actual row per round. After important results, the mentor supplies the eight-dimensional paper assessment here; the main session saves it without another self-rating.
- `rounds/NNN-brief.md` and `NNN-result.md` — mentor/user/external authored brief and a few-line result naming changes, measurements, and prediction versus actual. The main session saves mentor briefs verbatim. A real evaluation result, positive or negative, ends a round; a plan or smoke test does not.

`RESEARCH.md` is a short history index. Init still creates only that entry when the research directory is absent. Existing `missions/`, `experiments/`, and `claims/` remain in place without migration, deletion, or new entries; new experiment work is recorded in round results and linked real artifacts. Sources, actual reviewer returns, Lessons, `DOCTOR.md`, and Run receipts retain their distinct purposes. No research database, hash ledger, generated navigation, or migration framework is added.

Lifecycle operations preserve `.dove/research/**`, historical `.dove/reviews/**`, `.dove/runs/**`, `DOCTOR.md`, and ordinary files. They manage integration, not research; no missing overview or Lesson is synthesized by update. Repeated corrections across registered project cards prompt only a one-sentence suggestion about global `AUTHOR_PREFERENCES`, never an automatic global edit.

## CLI inventory and lifecycle

The CLI exposes `init`, `update`, `reinstall`, `uninstall`, `doctor`, `projects`, `run`, and `hook`. The old `review` CLI is removed; `/dove:review` remains one of the nine Skills. Native mentor and paper-review model calls belong to the host, not CLI lifecycle operations.

- Bare `dove` offers state-appropriate setup, host selection/changes, details, and default-No previews for Complete Reinstall/uninstall.
- `init` writes declared integration and only the absent-tree `RESEARCH.md` bootstrap; initialized roots register for future upgrades.
- `update` refreshes valid owned integration and reports replaced edits. `reinstall` rebuilds only known integration; neither adopts unknown state or changes research.
- `uninstall` removes still-owned resources/fragments after confirmation, preserving user-modified/unowned settings and all researcher-owned history.
- `doctor` is read-only software/readability inspection, not a scientific health score or live session probe.
- `projects import --project <root>... --sync`, `projects sync`, and read-only `projects status` use exact registered roots. Global npm lifecycle sync may cascade safe integration updates; `--ignore-scripts` disables it. Read per-project outcomes; partial success is not an all-project refresh.
- `run start|status|resume|finalize|compare` records local command facts under `.dove/runs/<id>/`. Start directly spawns a target without a shell; status is read-only; resume never reruns; finalize adds one scalar after terminal completion; compare ranks only compatible finalized runs. Seed and minimum Git commit/dirty facts do not prove reproducibility or affect ranking eligibility.
- `hook session-start|user-prompt-submit|statusline|stop` provides the narrow read-only integration surfaces above, not hidden intake, a router, scientific approval, or a scheduler.

There is no `mcp` or `migrate-research` command. Public inventory must match the parser, not preserve obsolete commands for documentation compatibility.

The statusline is a two-line native-facts display with optional Mainline and current round number from the bounded card; it does not scan the research tree or infer scientific progress from Git/session duration. Run budget metadata is a comparison basis, not prepaid resources or an enforced spending cap. Permissions, actual user limits, and timeout controls remain applicable; see [Run receipts](USAGE.md#run-receipts).

## Research and review boundaries

- The main session performs real retrieval, implementation, experiments, analysis, writing, figures, and authorized revision.
- Research executes the active brief through an evaluation result, then calls the mentor. Status reads identity, last evaluation rows, and brief without executing or filling missing evidence.
- The mentor may change methods within the confirmed goal; goal/completion changes, excess resources, and a wholly blocked mainline need the user's decision.
- Native `dove-review` reads the specified current version and returns grounded criticism/files read, not execution, scientific PASS, or external acceptance. Self-check remains distinct; unavailable native review is a limitation.
- Submission completion requires scientific sufficiency, a current independent review for the same complete version, and actual delivery readiness. Historical recommendations do not transfer to revised papers.
- Records and software checks cannot establish research quality by themselves.

## Verification evidence

Keep these claims separate; none implies the next:

| Evidence | What it establishes |
|---|---|
| Canonical source instructions | Intended behavior encoded by the inspected revision. |
| Generated resources / built bundles | Source/projection agreement when relevant drift checks actually ran. |
| Installed project resources | Managed disk/configuration facts for the inspected project; build alone does not install. |
| Currently loaded context | Directly observed host loading facts, not CLI inference from versions or disk refresh. |
| Actual model behavior | What happened in the observed authorized task/context. |
| Scientific outcomes | Claim-matched research evidence, not tests, installation health, or model completion notices. |

These are evidence boundaries, not mandatory stages. Documentation-only work can finish with static checks without regeneration, project initialization, real model invocation, or writes to consumer research.

## Build and release validation

Maintainer commands from a source checkout:

```bash
npm ci
npm run release:check
npm run pack:dry-run
```

`npm run check` is the software gate. Select checks by changed public contracts: nine Skills, native agent definitions, adapter drift, installation ownership, CLI surface, hooks, receipts, and package inventory. Inspect validator scope before running it; lifecycle operations and synthetic Git snapshots require suitable authorization. Build/check does not install a user-level artifact or reload a consumer context. Approved releases cascade only package-managed integration.

The mentor/round structure is assessed during authorized normal project use, not by creating a dedicated test project: do briefs predict measurable values, do later judgments compare with actual results, does generalization reveal case-specific fixes, and do rounds reach evaluation results rather than plans/smoke tests? Observe whether repeated “continue/what now/change it” corrections decrease. Software checks are not that acceptance evidence. Do not fabricate user confirmations, write tests into real research, or let test-owned continuation run beyond its evidence need.

## Stable Markdown and project file boundaries

Requested artifacts remain ordinary project files. New round records are lightweight Markdown, not a schema-versioned entity store; preserve their entering predictions and actual outcomes rather than rewriting history. Sources and Lessons keep their own maintenance criteria, and `DOCTOR.md` remains host-maintained feedback without a JSON issue lifecycle.

Managed transactions use containment checks, staging, expected-state rechecks, and rollback after caught promotion failures. Restoration failures retain backup/transaction paths for explicit inspection; no crash recovery, filesystem-wide atomicity, or rollback of external side effects is promised. Existing research history stays in place even when integration mechanisms are retired.
