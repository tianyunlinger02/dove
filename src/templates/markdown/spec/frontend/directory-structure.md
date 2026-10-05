# Directory Structure

Paths below are relative to the repository root unless labeled as consumer-project paths.

## Source map

| Responsibility | Canonical source |
|---|---|
| Shared scientific judgment, quality reference and stance rendering | `src/core/dove-research-contract.mjs`, `src/core/dove-agent-persona.mjs` |
| Author-preference essentials, full detail and fresh-context read contract | `docs/AUTHOR_PREFERENCES.md` (unchanged sole full source), `src/core/dove-author-preferences.mjs` (paths, essentials/full renderers, bootstrap) |
| Dove agent, ordinary Claude rule, response policy | `src/core/dove-agent-definition.mjs`, `src/core/ambient-policy.mjs`, `src/core/user-response-policy.mjs` |
| Skill inventory and workflows | `src/core/command-manifest.mjs` |
| Host and external-tool integration | `src/core/host-registry.mjs`, `src/core/paper-search-integration.mjs`, `src/core/web-access-integration.mjs` |
| CLI entry, parsing and presentation | `bin/dove.mjs`, `src/cli/command-parser.mjs`, other `src/cli/` modules |
| Installation planning, resources and manifest | `src/core/project-installation.mjs`, `src/core/project-installation-plan.mjs`, `src/core/project-installation-resources.mjs`, `src/core/project-installation-manifest.mjs` |
| Lifecycle, diagnostics and product SessionStart | `src/core/dove-lifecycle.mjs`, `src/core/project-doctor.mjs`, `src/core/session-start-hook.mjs` |
| Project boundary and safe writes | `src/core/project-root.mjs`, `src/core/rooted-filesystem.mjs`, `src/core/file-set-transaction.mjs` |
| Research bootstrap and document helpers | `src/core/research-defaults.mjs`, `src/core/research-documents.mjs` |
| Fresh read-only mentor and paper reviewer | `src/core/dove-agent-definition.mjs`, `src/core/dove-agent-persona.mjs` |
| Identity-card presentation and one Stop reminder | `src/core/identity-card.mjs`, `src/core/stop-hook.mjs` |
| Local execution receipts | `src/core/run-record.mjs`, `src/core/run-supervisor.mjs`, `src/core/run-environment.mjs` |
| Package identity and runtime requirements | `package.json`, `src/core/package-metadata.mjs` |

## Projections and supporting directories

- `scripts/generate-author-preferences.mjs` turns the full `docs/AUTHOR_PREFERENCES.md` into `src/core/dove-author-preferences-content.generated.mjs`; edit the Markdown owner, not the generated string module.
- `scripts/generate-command-adapters-cli.mjs` orchestrates preference-content and host-resource generation. `scripts/generate-command-adapters.mjs` projects canonical behavior into `package-resources/hosts/claude/.claude/` (agent, commands, primary ordinary-conversation rule, hidden guidance Skills), `package-resources/hosts/dsh/.dsh/skills/`, and each host's four exact `.dove/install/` projections: `RESEARCH_QUALITY.md`, `RESEARCH_QUALITY_FULL.md`, `AUTHOR_PREFERENCES.md`, and `AUTHOR_PREFERENCES_FULL.md`. `commands:check` checks drift without generating.
- Consumer installation uses bundled renderers to write canonical destinations, not disk copies of release projections. Generation, build, installation, active loading, and live behavior are separate facts; see [Quality Guidelines](./quality-guidelines.md).
- `scripts/build-package.mjs` bundles `src/core/index.mjs` into `dist/index.mjs` and `bin/dove.mjs` into `bin/dove-package.mjs`. There is no research-state MCP bundle.
- `tests/commands/`, `scripts/validate-*.mjs`, and `evals/behavior/` contain software checks and behavior-evaluation tooling.
- `docs/` contains public and development documentation. `.trellis/spec/` and `src/templates/markdown/spec/` are source/template spec pairs, not Dove host adapters.
- Repository `.claude/hooks/` and `.claude/agents/` support Trellis development; they are distinct from packaged Dove integration.

Change the owning source first; generated adapters and bundles are projections, not independent behavior definitions.

## Consumer-project layout

```text
.dove/
  install/manifest.json       # software installation metadata
  install/RESEARCH_QUALITY.md # short Chinese quality essentials
  install/RESEARCH_QUALITY_FULL.md # preserved full quality detail
  install/AUTHOR_PREFERENCES.md # short Chinese preference essentials
  install/AUTHOR_PREFERENCES_FULL.md # preserved full preferences
  install/DOCTOR.md           # optional host-maintained Dove feedback
  research/IDENTITY.md        # short researcher-owned plain-language card
  research/EVAL.md            # agreed evaluation and per-round measurements
  research/rounds/            # NNN-brief.md (named author), NNN-result.md
  research/RESEARCH.md        # short index to history
  research/missions/          # preserved historical Mission documents
  research/experiments/       # preserved historical Experiment documents
  research/sources/           # optional Source documents
  research/reviews/           # optional authored Review documents
  research/claims/            # preserved historical Claim documents
  research/lessons/           # optional advisory Lessons
  reviews/                   # preserved historical review-runtime exchanges
  runs/<run-id>/              # run.jsonl, stdout.log, stderr.log
  archive/                   # legacy/user-owned material when present
```

Drafts, code, datasets, figures, source captures, and rebuttals stay in ordinary project locations. Mentor and review use host-native read-only contexts, not separate filesystem workspaces. See [State Management](./state-management.md) for ownership and optional-document rules, and [Type Safety](./type-safety.md) for path constraints.
