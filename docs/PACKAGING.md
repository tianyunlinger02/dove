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

- **Claude Code** — `.claude/agents/dove.md`, `.claude/agents/dove-mentor.md`, `.claude/agents/dove-review.md`, nine `.claude/commands/dove/*.md` shortcuts, the shared rule, managed SessionStart/UserPromptSubmit context hooks, conditional status line, and paper/web support.
- **DSH** — nine `.dsh/skills/dove-*/SKILL.md` filesystem Skills. No Claude agents, hooks, MCP declarations, permissions, or equivalent native agent service is projected.

Every cross-round mentor judgment uses a fresh context, reading specified user originals, its own notes, recent records, artifacts and tracking materials; paper/web retrieval is available. The reviewer uses only `Read`, `Grep` and `Glob` on the current complete manuscript and supplied grounding. Neither receives execution conversation or executes/edits. Both list materials actually read; definition presence does not prove invocation or independence.

Both hosts share four exact exclusive files:

| Installed destination | Canonical source and role |
|---|---|
| `.dove/install/RESEARCH_QUALITY.md` | `src/core/dove-research-contract.mjs` renders Chinese quality essentials and both hosts' mentor note/tracking duties. |
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

New installations have no Dove Stop registration or CLI entry. Installation retains the exact retired selector only to remove an old manifest-owned Stop whose digest still matches. Automatic sync preserves locally modified or removed Stop items with their prior ownership and reports them; explicit update blocks on those differences. Unowned and user hooks remain untouched. Disk removal does not reload an existing host context.

Owned paths/configuration remain contained and unambiguous. Explicit update may replace valid owned local edits and reports `replacedLocalEdits`; automatic/bulk sync preserves locally changed or removed owned items, reports `preservedLocalEdits`, and updates the rest. Preserved items retain their previous ownership record; integration that cannot be safely planned still blocks that project. Unrelated settings and files are preserved. Installed digests protect software ownership, not scientific claims. Exact protections belong in [Installation](INSTALL.md).

## Research Markdown ownership

Researcher-owned records have fixed formats and caps, detailed in [Usage](USAGE.md#research-markdown):

- `IDENTITY.md` carries stable Mainline, target tier, completion, sourced restrictions, corrections and current research state within 1200 characters. Top-of-card round labels remain readable by hooks; overlong cards still present the first UTF-8-safe 4KB.
- `EVAL.md` has seven fixed columns, one row per method version, cells up to 200 characters and a replaceable current mentor assessment up to 1000 characters. Engineering logs stay outside it.
- Each round has one brief up to 2000 characters and one result up to 3000, linking ordinary artifacts. Briefs identify mentor/user/external authors; results state changes, measurements, prediction versus actual and objections/corrections. Mentor briefs are saved verbatim.
- `MENTOR_NOTES.md` contains only the mentor's own returned notes; the main session saves them without replacing independent memory with executor summaries. Dated `watch/impact-*.md` and `watch/scan-*.md` do not require a round.

`RESEARCH.md` is a short history index. Init still creates only that entry when the research directory is absent. Existing `missions/`, `experiments/`, and `claims/` remain in place without migration, deletion, or new entries; new experiment work is recorded in round results and linked real artifacts. Sources, actual reviewer returns, Lessons, `DOCTOR.md`, and Run receipts retain their distinct purposes. No research database, hash ledger, generated navigation, or migration framework is added.

Lifecycle operations preserve `.dove/research/**`, historical `.dove/reviews/**`, `.dove/runs/**`, `DOCTOR.md`, and ordinary files. They manage integration, not research; no missing overview or Lesson is synthesized by update. Repeated corrections across registered project cards prompt only a one-sentence suggestion about global `AUTHOR_PREFERENCES`, never an automatic global edit.

## CLI inventory and lifecycle

The CLI exposes `init`, `update`, `reinstall`, `uninstall`, `doctor`, `dashboard`, `watch`, `topic`, `projects`, `run` and `hook`. The old `review` CLI is removed; `/dove:review` remains one of the nine Skills. Native mentor and paper-review model calls belong to the host, not CLI lifecycle operations.

- Bare `dove` offers state-appropriate setup, host selection/changes, details, and default-No previews for Complete Reinstall/uninstall.
- `init` writes declared integration and only the absent-tree `RESEARCH.md` bootstrap; initialized roots register for future upgrades.
- `update` refreshes valid owned integration and reports replaced edits. `reinstall` rebuilds only known integration; neither adopts unknown state or changes research.
- `uninstall` removes still-owned resources/fragments after confirmation, preserving user-modified/unowned settings and all researcher-owned history.
- `doctor` is read-only software/readability inspection, not a scientific health score or live session probe.
- `projects import --project <root>... --sync`, `projects sync`, and read-only `projects status` use exact registered roots. Global npm lifecycle sync may cascade safe integration updates; `--ignore-scripts` disables it. Read per-project outcomes; partial success is not an all-project refresh.
- `run start|status|resume|finalize|compare` records local command facts under `.dove/runs/<id>/`. Start directly spawns a target without a shell; status is read-only; resume never reruns; finalize adds one scalar after terminal completion; compare ranks only compatible finalized runs. Seed and minimum Git commit/dirty facts do not prove reproducibility or affect ranking eligibility.
- `hook session-start|user-prompt-submit|statusline` provides read-only context and display surfaces.

There is no `mcp` or `migrate-research` command. Public inventory must match the parser, not preserve obsolete commands for documentation compatibility.

The statusline is a two-line native-facts display with optional Mainline and current round number from the bounded card; it does not scan the research tree or infer scientific progress from Git/session duration. Run budget metadata is a comparison basis, not prepaid resources or an enforced spending cap. Permissions, actual user limits, and timeout controls remain applicable; see [Run receipts](USAGE.md#run-receipts).

## Research and review boundaries

- The main session performs real retrieval, implementation, experiments, analysis, writing, figures, and authorized revision.
- Topic selection reads project standards, generates parallel candidates and offers recommendations for the user's choice before method implementation. Confirmed-mainline work uses a scale that can answer the question, not a default smallest change. Status remains read-only.
- The mentor judges direction at round end, after two no-science rounds, on user direction/story corrections and before route changes. It receives materials and fixed questions rather than executor framing. Engineering, parameters and evaluator repairs belong to the executor, including comparable-history recomputation.
- Engineering and verification failures count as no-science rounds; seek a user decision before further continuation by the third. Explain route changes plainly. Every mentor checks draft tracking, unjudged papers and overdue scans without waiting for a round.
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
