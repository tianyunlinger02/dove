# Dove

Dove is a local-first research context toolkit for papers, engineering work, experiments, figures, review, and revision. It helps hosts preserve a clear research direction, immutable Mission branches, sources, experiment evidence, bounded claims, review returns, and reusable Lessons without replacing the substantive work.

Dove keeps three responsibilities distinct:

- **Planner** frames the goal, scope, unknowns, evidence needs, and stop conditions.
- **Builder/Author** performs research, coding, experiments, writing, figure production, revision, and rebuttal.
- **Reviewer** returns findings on a frozen declared scope through a user-managed separate exchange.

Passing tests, host output, local review, or imported review are bounded evidence. They are not automatically completion, scientific correctness, independence, or authority.

## Current public inventory

Dove 0.7.0 exposes:

- **9 flat Skills**: `research`, `status`, `source`, `experiment`, `draft`, `figure`, `review`, `rebuttal`, and `lessons`;
- **8 public MCP tools**;
- **45 generated adapters**, nine for each of five host formats;
- **7 runtime CLI commands**: `init`, `sync`, `upgrade`, `reinstall`, `doctor`, `mcp`, and `hook`;
- **5 standalone package bundles**; and
- **7 Research Format 1 entities**: Workspace, Mission, Source, Experiment, Claim, Review, and Lessons.

Generated adapters do not prove project installation, MCP registration, connection, or readiness. Claude Code is the only host with a complete project initialization and registration path in this release.

## Install and initialize

Requirements: Node.js `>=22`, npm, and Claude Code for the supported project integration path.

Install an exact trusted Dove artifact for the current user. The bare public npm package named `dove` is unrelated, so do not treat bare `npm install -g dove` or bare `npx dove` as trusted release instructions.

```bash
npm install --global <exact-dove-package-specifier>
cd <target-project>
dove init --host claude
```

Current project integration is recorded at `.dove/install/manifest.json`. Initialization installs project-local Claude adapters, Reviewer definition, ambient resources, MCP registration, and the prompt hook. It does not initialize Research Format 1, create a Workspace, or create a Mission.

Leave and re-enter Claude Code after initialization so the host can load the project MCP registration. Then continue normal project work or invoke a Skill such as:

```text
/dove:research
/dove:status
/dove:experiment
/dove:draft
```

A Research Workspace is optional. `/dove:research` first requests a zero-write Dove projection. If no Workspace or relevant Mission exists, the host may inspect ordinary project material outside `.dove`—README, docs, source, tests, configuration, results, and existing artifacts—to form a provisional research frame. It does not initialize a Workspace or create a Mission automatically.

## Skills and real host work

| Skill | Responsibility |
|---|---|
| `research` | Read the smallest Dove projection, explore ordinary project material when durable context is absent, and perform bounded research work. |
| `status` | Read current research context without writes. |
| `source` | Discover, read, and verify real material with host tools; record only Sources actually used when durable citation context is needed. |
| `experiment` | Design and execute real experiments with host tools; preserve failures, denominators, deviations, and uncertainty; persist plans/results only when needed. |
| `draft` | Create or revise ordinary project draft files from current evidence. |
| `figure` | Gather materials, produce an ordinary figure artifact and caption, and validate labels and provenance. |
| `review` | Prepare a frozen scope, let the user manage a separate reviewer exchange, import the strict return, and inspect coverage. |
| `rebuttal` | Perform author-side response and revision work tied to actual findings and evidence. |
| `lessons` | Read or explicitly replace the complete advisory Markdown document while preserving its existing structure. |

Dove state is accessed only through public MCP tools. Ordinary project materials and artifacts are read, created, edited, and validated with normal host tools. Skills must never read or write `.dove` directly.

## Eight MCP tools

1. `query_dove_research`
2. `manage_dove_workspace`
3. `manage_dove_missions`
4. `manage_dove_sources`
5. `manage_dove_experiments`
6. `manage_dove_claims`
7. `manage_dove_reviews`
8. `manage_dove_lessons`

Each tool returns natural human text plus `structuredContent` with stable English machine keys. Every tool accepts an optional `language` of `zh` or `en`; otherwise Dove resolves project configuration, environment settings, and the default Chinese preference.

`query_dove_research` treats a completely absent Research Workspace and install-only `.dove` state as normal zero-write results with `status: "absent"`. A healthy Workspace with no Missions is also a successful empty overview. Unknown Missions, invalid input, unsupported formats, and blocked operations return stable safe categories without leaking absolute paths or raw storage errors. Legacy, unknown, malformed, and incomplete research formats continue to fail closed.

## Research Format 1

Current research state is identified by:

```json
{"format":"dove-research-v1"}
```

under `.dove/format.json`. The optional research siblings are:

- `.dove/workspace.json`
- `.dove/missions/*.json`
- `.dove/sources/*.json`
- `.dove/experiments/*.plan.json` and `*.result.json`
- `.dove/claims/*.json`
- `.dove/reviews/*.json`
- `.dove/LESSONS.md`

Drafts, notes, code, datasets, logs, papers, figures, and rebuttals remain ordinary project files. Research Format 1 has no Outcome, execution receipt, callback, handoff envelope, private host-control channel, mutable completion gate, or positional public selector.

`.dove-install/` and `.dove-archive/` are legacy project-lifecycle inputs only. Upgrade may converge valid legacy installation metadata while preserving current Research Format 1 bytes. Complete Reinstall deletes selected-project Dove state only after one explicit confirmation whose default is No. Neither lifecycle operation manages the user's npm installation.

## Reviewer boundary

Review is a user-managed separate exchange:

1. `local-preflight` checks an explicit artifact boundary without writes.
2. `prepare` freezes project-relative paths, sizes, and fingerprints.
3. The user gives that package to a separately selected reviewer session or person.
4. `import` accepts the strict object containing `status`, `verdict`, `summary`, `rubric`, `findings`, `actionItems`, `report`, `provenance`, `limitations`, and `reviewedAt`.
5. `coverage` checks whether reviewed bytes are still current.

Dove never launches or impersonates the reviewer. A prompt, agent definition, provenance string, or imported report does not establish independence, identity, authority, acceptance, or sign-off.

## Runtime CLI

```text
dove init
dove sync
dove upgrade
dove reinstall
dove doctor
dove mcp serve
dove hook user-prompt-submit
```

The runtime CLI manages integration, diagnosis, lifecycle, MCP serving, and the Claude prompt hook. Research business operations are MCP/Skill surfaces, not CLI commands.

## Documentation

- [Installation](docs/INSTALL.md)
- [Usage](docs/USAGE.md)
- [Packaging](docs/PACKAGING.md)
- [Capability matrix](docs/CAPABILITY_MATRIX.md)
- [Output samples](docs/DOVE_COMMAND_OUTPUT_SAMPLES.md)

## Source-checkout validation

```bash
npm run commands:check
npm run commands:validate
npm run mcp:validate
npm run check
npm run release:check
npm run pack:dry-run
```

These checks validate software contracts and generated artifacts. They do not certify research claims or establish independent review.
