# Packaging

## Delivery model

Dove is one host-neutral Node.js 22 npm artifact. It installs the user-level `dove` executable; projects invoke it from `PATH` and receive host-facing resources and software metadata, not copied runtime bundles. A global npm upgrade with lifecycle scripts enabled uses `postinstall` to refresh only registered projects, never a home-directory scan.

The bare public npm name `dove` is unrelated. Release instructions use an exact trusted tarball, Git revision, or internal-registry artifact. Dove is source-available under PolyForm Noncommercial License 1.0.0, not OSI-approved open-source software, with no advertised commercial-license path. Bundled third-party MIT/ISC rights remain separate in `THIRD_PARTY_NOTICES.md`.

## Release inventory

The package contains:

- one Dove research-agent identity, with an optional author-side agent and native fresh read-only `dove-mentor` / `dove-review` contexts;
- seven optional flat Skills: `research`, `status`, `source`, `experiment`, `draft`, `figure` and `review`;
- generated adapters and declared support resources for Claude Code;
- project lifecycle commands, the dashboard, paper tracking, a direct configured Images API client, and Claude integration hooks;
- public documentation, root `dove.png`, `LICENSE`, and `THIRD_PARTY_NOTICES.md`; and
- two standalone Node.js bundles.

`dove.png` is the authoritative brand artwork shown by both READMEs. The CLI uses a static hard-outline Unicode rendering, cyan Dove and green branch when colored; no image protocol, decoder, copied consumer asset, or extra bundle is needed.

There is no Auto command, research-state MCP bundle/database, fallback runtime, or separate researcher persona. Native mentor/reviewer invocation uses the host's Agent tool, not a Dove model-launching CLI, frozen snapshot, project-external workspace, or socket launcher. Historical `.dove/reviews/**` stays in place. Paper-reading notes and the topic-grouped literature library remain project research, not a copied reference repository or model runtime.

Ordinary Claude conversation through the shared project rule is the complete primary entrance. Optional agent/Skills add no authority or permissions. The main session retains the full user conversation, clarification, execution, and result adoption; read-only subagents return judgments only. See [Usage](USAGE.md).

## Generated host surfaces

One host projection is packaged:

- **Claude Code** — `.claude/agents/dove.md`, `.claude/agents/dove-mentor.md`, `.claude/agents/dove-review.md`, seven `.claude/commands/dove/*.md` shortcuts, the operating manual as the project rule, managed SessionStart/UserPromptSubmit/Stop hooks, conditional status line, and paper/web support.

DSH is no longer maintained; an adapter can be regenerated from the single source if needed.

Every mentor judgment uses a fresh context, reading specified user originals, the facts Dove computed, its own notes, recent records, artifacts and (weekly) tracking materials; paper/web retrieval is available. The reviewer uses only `Read`, `Grep` and `Glob` on the current complete manuscript and supplied grounding. Neither receives execution conversation or executes/edits. Both list materials actually read; definition presence does not prove invocation or independence.

The project rule and four exact exclusive reference files:

| Installed destination | Canonical source and role |
|---|---|
| `.claude/rules/dove.md` | `renderDoveOperatingManual` in `src/core/dove-research-contract.mjs`: the operating manual, the one place operating rules are written. |
| `.dove/install/RESEARCH_QUALITY.md` | `renderDoveResearchQualityReference` in the same file: the research standard (stance, from problem to method, eight dimensions, evidence, topic and novelty). |
| `.dove/install/AUTHOR_PREFERENCES.md` | `DOVE_USER_SAYINGS` in `src/core/dove-author-preferences.mjs`: the user's twelve most frequent sayings, verbatim with dates and what to do; the Stop prompts quote from the same list. |
| `.dove/install/AUTHOR_PREFERENCES_FULL.md` | `docs/AUTHOR_PREFERENCES.md` is the sole editable full source, preserved in `src/core/dove-author-preferences-content.generated.mjs` for bundled rendering. |
| `.dove/install/TOPIC_CRITERIA.md` | `docs/TOPIC_CRITERIA.md`. |

These are owned files, not ownership of `.dove/install/`. Installation and hook delivery do not prove reading. References are guidance, not evidence or permissions; reviewer/mentor read scope does not include author preferences. See [what the host reads](USAGE.md#what-the-host-reads-and-when).

Release projections live under `package-resources/hosts/...`, outside host-recognized repository roots. Consumer installation uses bundled renderers, not disk copies of those release projections. Figure's cross-domain guidance and adaptable model brief are owned by `src/core/command-manifest.mjs` and rendered into the Figure resource by `scripts/generate-command-adapters.mjs`. Edit canonical sources, not generated adapters. OpenCode, Codex, Cursor, and shared Agents projections are not packaged.

## Runtime bundles

| Bundle | Purpose |
|---|---|
| `dist/index.mjs` | Public library bundle. |
| `bin/dove-package.mjs` | Packaged `dove` CLI. |

`commands:generate` first generates preference content from `docs/AUTHOR_PREFERENCES.md`, then declared adapters, native agent definitions, and support/reference resources. `commands:check` checks drift without writing. `build` writes the two bundles from declared entries; `build:check` compares in-memory builds with existing outputs. None installs a consumer project. Consumer installation does not regenerate artifacts; npm `postinstall` and explicit project sync can refresh registered integration.

No MCP server bundle, prompt-hook bundle, third-party Python source, credentials, or external model runtime is shipped.

## Project integration

`dove init --host claude` installs declared resources and owned settings fragments, a revision `2.0` manifest, and `.mcp.json#/mcpServers/dove-paper-search` / `exa`. Pre-existing equivalent Exa declarations remain unowned and survive uninstall; conflicting unowned declarations still block initialization. Existing status lines remain unowned; an empty setting receives the read-only `dove hook statusline --project "$CLAUDE_PROJECT_DIR"` renderer.

Paper search launches user-provided `uvx` with pinned `paper-search-mcp==0.1.4` and `mcp<2`. Hosted Exa uses `{ "url": "https://mcp.exa.ai/mcp", "type": "http" }`. These declarations provide scholarly and webpage-reading integration, not connectivity evidence. Built-in WebSearch stays available for discovery. Dove no longer installs a WebFetch denial; paper/web integrations, WebFetch, APIs and direct downloads are available retrieval choices when permitted by the host and user. Dove does not approve project trust or write credentials.

SessionStart supplies bootstrap/continuity; UserPromptSubmit presents the version, the identity card and this round's situation computed by `src/core/round-state.mjs`, plus one notice per session after an update (remembered in `.dove/install/hook-state.json`). Stop quotes the user's words once per overrun or stall (`src/core/stop-hook.mjs`). With `hostMigration` on (default off), upgrades register versioned tasks and the hooks deliver them for idle-time host work; no hook rewrites research, interrupts jobs or reloads the host. `mentor brief` puts user-original excerpts, explicitly supplied raw text artifacts and the facts Dove computed before the host's records; it generates materials, not a model launch. It also refreshes `.dove/install/USER_ORIGINALS.md` and the activity counts, and the cross-project experience file; the resident dashboard prewarms these daily for every registered project (and rescans unfinished activity hourly). Collection uses only the complete project-root session directory and individually checked cwd values; unfinished work resumes on later calls.

Dove's Stop hook is registered beside any of the user's. Automatic sync preserves a locally modified or removed Dove Stop with its prior ownership and reports it; explicit update restores it. Unowned and user hooks remain untouched.

Owned paths/configuration remain contained and unambiguous. Explicit update may replace valid owned local edits and reports `replacedLocalEdits`; automatic/bulk sync preserves locally changed or removed owned items, reports `preservedLocalEdits`, and updates the rest. Preserved items retain their previous ownership record; integration that cannot be safely planned still blocks that project. Unrelated settings and files are preserved. Installed digests protect software ownership, not scientific claims. Exact protections belong in [Installation](INSTALL.md).

## Research Markdown ownership

Researcher-owned records use readable fixed formats and natural Chinese full sentences, not hard length limits. See [Usage](USAGE.md#research-markdown).

- `IDENTITY.md` carries Mainline, core capability, completion, sourced restrictions, corrections and a roughly 300-character plain-language research state written by the mentor. Hooks show that recorded state before the bounded card instead of losing it after a long prefix; they do not invent a summary. `Method design` points to the existing brief holding the current method's three-part rationale, displayed read-only on the dashboard. User responses need actual words and sources, not inferred approval.
- `EVAL.md` opens with the main metric line, then the eight-dimension trend table (one row per mentor judgment, ending with the bottleneck dimension) and the method-version table whose rows link result files. Engineering logs stay outside it.
- Each round has one brief and one result, linking ordinary artifacts. Briefs open with `Author:`, `对准：`, `见分晓：` and `规模：`, explain the round in `一句话：` and state `## 预期结果`; results open with `判定：` and compare expectations with actual measurements. Mentor briefs are saved verbatim.
- `MENTOR_NOTES.md` contains mentor-authored memory, including `可迁移：` lessons and `### 待用户决定`. A missing dated long-term intent section or one strictly more than seven days old prompts a new dated comparison; consolidation preserves the latest section and date, issues already raised and their answers. The dashboard shows core capability beneath the mainline and the latest intent comparison and date in a collapsed section. Dated watch impacts and scans stay separate from rounds. `papers/<id>.md` accumulates full-text Q&A, while `papers/library.json` / `.md` collect useful work by direction and support metadata-grounded BibTeX export.

`RESEARCH.md` is a short history index. Init still creates only that entry when the research directory is absent. Existing `missions/`, `experiments/`, and `claims/` remain in place without migration, deletion, or new entries; new experiment work is recorded in round results and linked real artifacts. Sources, actual reviewer returns and `DOCTOR.md` retain their distinct purposes. No research database, hash ledger, generated navigation, or migration framework is added.

Lifecycle operations preserve `.dove/research/**`, historical `.dove/reviews/**`, old `.dove/runs/**`, `DOCTOR.md`, and ordinary files. They manage integration, not research; no missing overview is synthesized by update. Recurring corrections are shown on the dashboard as input for Dove's development; the sayings change only with the user's agreement, never automatically.

## CLI inventory and lifecycle

The CLI exposes `init`, `update`, `reinstall`, `uninstall`, `doctor`, `dashboard`, `watch`, `topic`, `figure`, `settings`, `mentor brief`, `projects` and `hook`. The old `review` and `run` CLIs are removed; `/dove:review` remains one of the seven Skills. Native mentor and paper-review model calls belong to the host, not CLI lifecycle operations.

- Bare `dove` offers state-appropriate setup, host selection/changes, details, and default-No previews for Complete Reinstall/uninstall.
- `init` writes declared integration and only the absent-tree `RESEARCH.md` bootstrap; initialized roots register for future upgrades.
- `update` refreshes valid owned integration and reports replaced edits. `reinstall` rebuilds only known integration; neither adopts unknown state or changes research.
- `uninstall` removes still-owned resources/fragments after confirmation, preserving user-modified/unowned settings and all researcher-owned history.
- `doctor` is read-only software/readability inspection, not a scientific health score or live session probe.
- `figure --project <root> --prompt <text>` (or `--prompt-file <file>`) `[--image <file> ...] --output <file>` sends inputs to the image API/model in user `settings.figure`, using Node's built-in HTTP/multipart support. `--size`, `--quality` and `--background` pass through to the service; network failures, rate limits and server errors receive bounded retries, and rejected keys fall through to the next available key. The returned image format determines the extension; occupied output names receive numbered suffixes. `figure --tools` reports local PPT composition/export commands without invoking the image model. Host-native image tools remain direct main-session calls, not a CLI bridge. See [image configuration and protocol](USAGE.md#writing-figures-and-review).
- `projects import --project <root>... --sync`, `projects sync`, and read-only `projects status` use exact registered roots. Global npm lifecycle sync may cascade safe integration updates; `--ignore-scripts` disables it. Read per-project outcomes; partial success is not an all-project refresh.
- `settings [--host-migration on|off] [--stop-prompts on|off]` reads or changes the user-level host settings.
- `hook session-start|user-prompt-submit|stop|statusline` provides context, Stop prompts and display surfaces.

There is no `mcp` or `migrate-research` command. Public inventory must match the parser, not preserve obsolete commands for documentation compatibility.

The statusline has three lines: native session facts with optional Mainline last; the current round with its aim, due date, overrun or stall and the main metric, read from the records; the project path. It does not infer scientific progress from Git or session duration.

## Research and review boundaries

- The main session performs real retrieval, implementation, experiments, analysis, writing, figures, and authorized revision.
- Topic selection ends with the user's mainline choice. The first engineering task is a real development set, working official metrics and the strongest available external comparison. New methods or core modules need the three-part rationale shown to the user before implementation; fixes and evaluation repairs do not reopen this step. The rationale stays in the existing brief, not a new approval system.
- The mentor reads user originals and raw results before executor summaries. Its first answers state substantive progress and whether recent work tested the method or built/repaired infrastructure, then revisit the rationale and past corrections. Main-session judgment is not delegated to an expanding engineering fleet.
- On an overrun (a round past its due date by as long again as planned) or a stall (two consecutive missed verdicts with no method decision), Dove quotes the user's words once; the host answers, then stops and asks the user whether to continue the current method with reasons, change methods or change direction. Restrictions must cite the user's words; validation matches the decision, without routine research hashes or bitwise checks. The weekly mentor watch review checks tracking, unjudged papers and overdue scans. For draft or off-target tracking, the main session saves the mentor's actual suggested JSON and runs `dove watch configure --project <root> --mentor <建议.json> [--json]`. Only supplied `keywords`, `authors`, `venues`, `institutions` and `seedPapers` arrays are replaced; empty arrays clear those fields, while `enabled`, `categories` and other settings remain. Check saved values and `source: mentor` in the receipt: this means advice was saved, not that the user confirmed research direction. Without advice, keep the draft.
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

`npm run check` is the software gate. Select checks by changed public contracts: seven Skills, native agent definitions, adapter drift, installation ownership, CLI surface, hooks, round-state computation and package inventory. Tests check functional behavior, not fixed prompt wording, word or negation counts, or prose-length ceilings. Inspect validator scope before running it; lifecycle operations and synthetic Git snapshots require suitable authorization. Build/check does not install a user-level artifact or reload a consumer context. Approved releases cascade only package-managed integration.

Dove's effect is assessed in real use, not by a dedicated test project or a synthetic behavior suite: before a release, replay real decision points on copies of real projects and compare the host's choices under the old and new guidance; after it, watch whether the user's recurring corrections (the dashboard's 纠正 page) decrease, how often Stop prompts fire and what the host does next, whether method designs reach the user first, whether verdicts and aims are written, and whether mentor calls narrow to decision points. Software checks are not that acceptance evidence. Do not fabricate user confirmations, write tests into real research, or let test-owned continuation run beyond its evidence need.

## Stable Markdown and project file boundaries

Requested artifacts remain ordinary project files. New round records are lightweight Markdown, not a schema-versioned entity store; preserve their entering predictions and actual outcomes rather than rewriting history. Sources keep their own maintenance criteria, and `DOCTOR.md` remains host-maintained feedback without a JSON issue lifecycle.

Managed transactions use containment checks, staging, expected-state rechecks, and rollback after caught promotion failures. Restoration failures retain backup/transaction paths for explicit inspection; no crash recovery, filesystem-wide atomicity, or rollback of external side effects is promised. Existing research history stays in place even when integration mechanisms are retired.
