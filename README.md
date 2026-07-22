# Dove

Dove is a local-first mission workflow system for research papers, engineering projects, experiments, and review-driven revision.

It gives AI-assisted work a durable filesystem backbone: mission contracts, captured sources, evidence notes, claims, drafts, figures, experiment records, advisory lessons, rebuttal artifacts, immutable versions, canonical execution receipts, ownership, and lineage live in project-local `.dove/` files instead of disappearing into chat history.

## Dove philosophy

Dove is built around a simple operating metaphor: an agent should fly out toward a clear goal, then return with evidence, results, and any reusable lesson. The important part is not just dispatching work; it is making the outcome explicit enough that another person or agent can inspect what changed, why it changed, how it was validated, and what should be remembered next time.

That is why Dove treats the filesystem as the contract. It does not depend on hidden chat memory, a background swarm, or a host-specific automation loop. Mission contracts, real research artifacts, receipts, ownership, lineage, and review-linked rebuttal evidence are written into `.dove/` so the workflow remains portable across tools and auditable after the session ends.

The intended rhythm is:

```text
init goal → confirmed mission → substantive domain artifacts → live integrity status → immutable version
```

## Why Dove

AI coding and writing sessions are powerful, but they often lose continuity across roles, tools, and long-running work. Dove keeps the work portable and auditable by combining:

- **Durable mission contracts** in `.dove/missions/`
- **Research decision trees** in `.dove/research-trees/` keep only bounded retrieval, experiment, and analysis decisions. New nodes start pending; completed and blocked outcomes require current mission-owned evidence. Blocked directions also create an advisory failure lesson, but Dove never pivots automatically.
- **Explicit advisory lessons** in `.dove/lessons/`, with mission provenance and mission or global applicability
- **Explicit mission-bound domain writes** for sources, notes, claims, drafts, experiments, figures, rebuttals, and versions
- **Planner / builder / reviewer separation** for direction, execution, and critique
- **Evidence-aware completion gates** over current hashes, typed evidence, and authoritative review requirements
- **Canonical execution receipts, artifact ownership, and lineage** for every durable domain result
- **Host-side provider execution** with Dove importing and hashing declared outputs
- **Strict first-write preflight** for material, evidence, finding, result, and artifact references
- **Generated project host adapters** for OpenCode, Codex, Cursor, and shared agent-skill hosts
- **MCP-first host integration** for deterministic reads, one-step checkpoint approval, and file-backed mutations without exposing replay controls

Dove does not rely on hidden chat memory, a daemon, a scheduler, or a host-specific swarm. Schema 9 keeps mission artifacts and their integrity evidence as the complete durable workflow contract.

## Repository and published package layout

The source checkout keeps `src/`, the raw `bin/dove.mjs` and `mcp/dove-state-server.mjs` entrypoints, development scripts, tests, generated host adapters, and documentation. The npm package is intentionally smaller and ships only standalone runtime artifacts:

- `dist/index.mjs` — the public package-root API bundle
- `bin/dove-package.mjs` — the installed Dove CLI
- `mcp/dove-state-server-package.mjs` — the installed stdio MCP executable
- `scripts/doctor-mcp-probe-package.mjs` — the installed doctor probe
- the necessary public docs, `AGENTS.md`, host adapters, and `.opencode.json`

The installed package does not contain raw `src/` modules or raw development entry scripts. The package `exports` map controls legal package specifiers, but it is not a filesystem isolation boundary; physical omission of raw source is what prevents sibling-URL imports through `import.meta.resolve("dove")`.

The package installs managed code and generated adapter files. A target project's `.dove/` directory is user-owned workspace state: install and sync never initialize, repair, convert, or overwrite it. Only explicitly confirmed schema 9 workflows create or update mission, advisory lesson, receipt, source, note, claim, experiment, draft, figure, review, rebuttal, ownership, lineage, and version artifacts.

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

Dove converts the demand into one minimal mission contract, asks for confirmation, and remains strictly zero-write until the exact proposal is replayed. Confirmation persists the contract under `.dove/missions/` and, when needed, initializes the sealed schema 9 workspace manifest, project identity, and required directories; ownership and lineage are derived from later execution receipts; the host then continues naturally with its native plan, subagents, and tools without calling another Dove route.

4. Use mission-bound domain workflows after the mission is confirmed:

```text
/dove:figure 画一张 pipeline overview，用于 introduction 和方法图
/dove:draft 修改 introduction，让它衔接最新实验结果
/dove:experience 规划并记录 ablation 结果，然后桥接到 claim
```

Every domain workflow requires an explicit `missionId` and writes substantive mission-owned artifacts rather than creating a packet, board, runtime record, or hidden workflow refresh. `dove.experience` is the canonical experiment/evidence workflow.

5. Check where things stand:

```text
/dove:status
```

Status is always read-only and opens schema 9 through `.dove/manifest.json`. It never bootstraps, refreshes, repairs, converts, stages, or writes workspace state. If `.dove` is absent, status returns a zero-write needs-init result. If legacy, malformed, contradictory, or future schema state exists, status fails closed. With zero missions it reports none; with one mission it scopes completion/source/domain/review checks to that mission; with multiple missions it never selects an implicit latest mission and asks for explicit `missionId`.

6. Use `dove.version` to create immutable copies of current mission artifacts and compare two snapshots against current hashes with a zero-write query.

## Public command surface

Dove exposes exactly 12 flat host workflows. Separately, the CLI has 16 top-level subcommands; the remaining public inventory is 28 MCP tools and 60 generated adapters:

| Command | Purpose |
| --- | --- |
| `project:dove.init` | Propose and exactly confirm schema 9 initialization; use explicit direct-process `--archive-reset` for legacy or invalid `.dove` state. |
| `project:dove.mission` | Propose one minimal mission contract; after exact approval, persist that contract and initialize the minimal schema 9 identity when needed. |
| `project:dove.status` | Read schema 9 health, mission/receipt counts, and live completion integrity; absent is zero-write needs-init and legacy/invalid state fails closed. |
| `project:dove.lessons` | Explicitly query advisory lessons or explicitly propose and exactly confirm one mission-provenanced lesson. Global scope means broadly applicable guidance, not provenance detached from the recording mission. |
| `project:dove.version` | Create immutable mission snapshots and compare current copies against their recorded hashes without writing comparison state. |
| `project:dove.source` | Import external material as a mission-bound candidate; public source verification can reject but cannot issue positive verification. |
| `project:dove.note` | Write substantive mission-bound evidence notes after rechecking current source trust and hashes. |
| `project:dove.figure` | Bind materials, import host-generated output, hash it, and write caption/provenance plus diagnostic QA for independent review. |
| `project:dove.experience` | Atomically record protocol, result evidence, audit, and evidence-backed claim bridge. |
| `project:dove.draft` | Write a substantive mission-bound draft body or explicit metadata for an existing draft. |
| `project:dove.review` | Run a zero-write local preflight, prepare a frozen schema 9 mission review exchange, or import its canonical hash-bound handoff/report without minting Reviewer authority. |
| `project:dove.rebuttal` | Normalize specific review findings and write author-side evidence-backed strategy and responses. |

Older router, plan, checklist, audit, return, follow-through, onboarding, governance-audit, auto, operator, and paper-namespaced slash commands are removed rather than retained as hidden public or internal callable surfaces. Retired operator lesson storage and tool names are also absent.

`dove.lessons` supports exactly five kinds: `preference`, `constraint`, `method`, `failure`, and `review-insight`. Query and record are explicit operations. Query is always zero-write; record is proposal-first and accepts only the exact returned confirmation token. Every lesson remains advisory-only: it grants no authority, cannot satisfy mission completion, and cannot replace current evidence checks. Dove never captures lessons automatically, recalls them from another command, imports transcripts, or writes Trellis, runtime, workflow-control, or hidden memory state.

## Mission contract model

The public mission surface is a minimal schema 9 contract:

- `/dove:init` first returns a zero-write proposal. Exact confirmation creates workspace schema 9 with `.dove/manifest.json`, `.dove/project.json`, and only the required directories. Ownership and lineage are derived from immutable execution receipts; persisted `ownership.json` and `lineage.json` mirrors are invalid.
- Existing legacy or invalid `.dove` state is never imported, normalized, repaired, or automatically converted. `dove init --archive-reset` binds the source directory identity and tree digest, then direct-process confirmation atomically renames the whole tree under `.dove-archive/` before creating a clean schema; patch-plan archive-reset fails closed because it cannot represent atomic rename and rollback.
- `/dove:mission` accepts `goal`, `scope`, `outOfScope`, `targetArtifacts`, `expectedArtifacts`, `completionCriteria`, `evidenceRequirements`, optional `dependsOnMissionIds`, and optional `supersedesMissionId`. Generated MCP adapters also create one private safe mission identity, pass it with the checkpoint, retain it only for the current continuation, and never ask the operator to copy it from output.
- Proposal and unconfirmed requests are strictly zero-write. The proposal digest binds the canonical workspace, mutation mode, project identity snapshot, target artifact identities, proposal version, and exact contract fields.
- Exact confirmation persists one contract at `.dove/missions/<missionId>.json`. It does not create a legacy packet, checklist, child mission, runtime record, orchestration state, hidden workflow state, route, role, or lifecycle status.
- Core and low-level results include a nonpersisted execution handoff for explicit consumers. Ordinary MCP public projection does not expose mission identity, contract identity, receipt templates, or replay data; generated hosts reuse the private identity they supplied rather than recovering it from Dove output.
- After confirmation, the host continues with its native planning, subagents, and tools rather than invoking another Dove command.
- Execution can return one sealed receipt through core/MCP `ingest_execution_receipt` or the low-level `dove receipt` CLI. Each receipt binds `missionId` and the current `contractDigest`, and may record partial artifact, validation, or criterion progress. Completion aggregates only current ownership and hash-bound criterion evidence across the ledger. Core ingestion stages only a sealed post-commit assessment descriptor; direct-process CLI and MCP dispatch resolve it only after the receipt transaction commits, while patch-plan results remain planned with `completion.assessment: null` and the separate `assess_mission_completion` query remains available.
- Successful ingestion writes only `.dove/receipts/execution/<receiptId>.json`. Current ownership and lineage are derived from that ledger; ingestion never writes ownership/lineage mirrors, mission lifecycle, routes, legacy packets, `nextAction`, or legacy runtime results.
- `assess_mission_completion` is a pure live query: it rechecks the current contract, receipt schema, file hashes, criterion coverage, eligible typed source evidence, review requirements, and direct mission dependencies. A dependent mission cannot complete until every dependency is currently complete. Artifact drift makes an earlier receipt stale; the query never persists `mission.status`.
- Supersession is derived from the mission graph rather than stored as mutable lifecycle state. Once a successor mission supersedes an older mission, the older mission remains readable with its historical receipts and evidence, reports `status: superseded` and `complete: false`, and rejects new public receipts or internal domain writes.
- Evidence requirements use exact typed strings such as `artifact:<path>`, `validation:<path>`, `source:<id>`, `note:<id>`, or `review:authoritative`; arbitrary prose is not fuzzy-matched. Reviewer authority is fail-closed and no public positive authority issuer exists.
- Public domain workflows require explicit `missionId` and never convert a mission into a legacy packet or write board, runtime, hidden workflow state, route, role, or lifecycle mirrors.
- `/dove:status` remains strictly read-only and shows only high-level schema, mission, receipt, and live integrity context. It never falls back to legacy packet state; legacy or invalid workspaces require explicit archive-reset.

## Language configuration

Dove generated commands and runtime-generated user-facing status and workflow messages follow the response-language preference. Supported values are `zh` for Chinese and `en` for English, with `zh` as the default.

```json
{
  "language": "zh"
}
```

Put that in `.dove/config.json` or `.dove/config.local.json`; `DOVE_LANGUAGE` and `DOVE_RESPONSE_LANGUAGE` can override it for a process. Machine tokens and public API fields stay in English, including statuses, stages, domains, command IDs, MCP tool names, JSON keys, file paths, outcome tokens, and token-like stop reasons. Existing artifacts are not migrated when the preference changes.

## Workflow presets

- **Source** follows `search_network` → visible host capture → `register_source` with `capturePath` / `--capture-path` → `query_sources`. Search returns only a non-authoritative registration draft with `captureRequiredForEvidence`; registration imports the captured material as a mission-bound candidate. Public `verify_source` can record rejection only.
- **Note** can synthesize substantive content from current mission-owned artifacts or current mission notes. `sourceIds` remain unavailable as eligible evidence because schema 9 has no trusted positive source verifier; candidate and rejected sources cannot authorize note writes or completion.
- **Experience** records protocol, result evidence, audit, and claim bridge through one canonical atomic workflow.
- **Figure** binds declared materials and imports host-generated output; Dove records hashes, caption/provenance, and diagnostic QA. clean QA reaches `ready-for-independent-review`; Dove does not issue `validated` state.
- **Draft** writes or revises substantive paper text from current typed evidence, with explicit placeholders for unsupported gaps.
- **Review** uses review-exchange format v8 inside a schema 9 workspace. Results explicitly distinguish preflight, prepare, and import. Prepare returns canonical input/manifest/handoff/report paths plus the import action; import returns canonical imported paths plus the existing coverage action. `local-preflight` is zero-write; `isolated-selected-artifacts`, `final-plan-results-only`, and `external` freeze only their declared mission-owned input scope under `.dove/reviews/exchanges/<exchangeId>/`. Each policy seals a distinct input boundary (`read-only-current-workspace`, `selected-artifact-isolation`, `classified-final-plan-results`, or `host-mediated-external-review`) into the scope hash. Import validates canonical exchange leaves and all manifest, snapshot, set, input, handoff, report, scope, mission, and contract hashes before writing. Coverage verification is read-only, and public imports are always non-authoritative.
- **Rebuttal** links every issue and response to a concrete review artifact finding.
- **Version** copies current mission artifacts into immutable snapshots and compares them against recorded hashes with a strictly zero-write query.

## Host adapters

Generated project adapters expose the same Dove concepts across supported project-local hosts:

- OpenCode commands and skills
- Codex skills and agent defaults
- Cursor commands
- shared `.agents/skills` surfaces

Claude Code uses one user-level `/dove:*` command set instead of project-local `.claude/commands/dove` files. `dove install/sync --host claude` renders that user command set from the same manifest and atomically registers the project-scoped `dove` server in the target project's `.mcp.json`. Existing top-level fields and other MCP servers are preserved; duplicate JSON object keys, an existing conflicting `mcpServers.dove` entry, malformed JSON, missing managed package sources, or a symbolic-link configuration fail closed before the first write. The canonical entry uses Claude Code's project-root expansion, and the server also resolves its workspace from `CLAUDE_PROJECT_DIR`, so launching Claude from a project subdirectory does not retarget Dove. The installer does not inspect or modify Claude settings, shell startup files, Fast mode, model/context/compact/output configuration, environment variables, or project trust. Doctor observes registration separately from pending approval, connection, and failure, then runs the installed package probe only after Claude reports the server connected.

In a Dove source checkout, maintainers regenerate and check adapter drift with `npm run commands:generate` and `npm run commands:check`. These development scripts are not part of an installed project.

## MCP

Dove includes a local stdio MCP server named `dove`. Claude install/sync writes this canonical entry to the target project's `.mcp.json`; other hosts may register the same local server through their native project configuration:

```json
{
  "mcpServers": {
    "dove": {
      "type": "stdio",
      "command": "node",
      "args": ["${CLAUDE_PROJECT_DIR:-.}/mcp/dove-state-server-package.mjs"]
    }
  }
}
```

MCP exposes exactly 28 sealed schema 9 tools for initialization, mission contracts, read-only mission/status queries, explicit lesson query/record, network search, mission-bound sources, notes, claims, experiments, drafts, figures, review prepare/import/coverage verification, rebuttals, immutable versions, low-level receipt ingestion, on-demand host outcome closure, and live completion assessment. Generated mission adapters supply and privately retain the safe mission identity needed by the resumed host turn; the ordinary public result does not reveal it. The host-only closure accepts only that retained mission identity, a summary, real workspace artifact paths, and optional validation-output paths; Dove generates receipt metadata and fingerprints internally, skips without writing when no uncovered artifact remains, and never creates a thirteenth host command. Checkpoint tools handle proposal, one host approval, and exact application inside one MCP call; control data stays private. Ordinary domain writes are authorized by the explicit invocation and do not ask for a redundant second confirmation. Workspace file inputs may use a canonical relative path or a canonical absolute path inside the selected workspace; the MCP boundary converts accepted absolute paths to POSIX workspace-relative paths and continues to reject aliases, traversal, missing files, directories, symbolic links, special files, and paths outside the workspace. Lesson tools are exactly `query_dove_lessons` and `record_dove_lesson`; the old operator lesson tool names are absent. Review uses only `prepare_review_exchange`, `import_review_exchange`, and `verify_review_coverage`; `local-preflight` is the zero-write prepare policy. Every input object rejects unknown fields; domain mutations require explicit `missionId`. Packet, board, runtime, hidden workflow state, review-loop, role, lifecycle, and policy-override tools are not public MCP surfaces. MCP complements `.dove/`; it does not replace the file-backed source of truth.

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
- [`docs/USAGE.md`](docs/USAGE.md) — workflow model, commands, mission contracts, MCP tools, and roles
- [`docs/PACKAGING.md`](docs/PACKAGING.md) — package boundary, managed files, generated adapters, and release checks
- [`docs/CAPABILITY_MATRIX.md`](docs/CAPABILITY_MATRIX.md) — implemented, partial, and deferred capabilities
