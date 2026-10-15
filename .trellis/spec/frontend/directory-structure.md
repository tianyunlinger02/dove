# Directory Structure

Paths are repository-relative unless identified as consumer-project paths.

## Source map

| Responsibility | Canonical source |
|---|---|
| Scientific contract and quality references | `src/core/dove-research-contract.mjs` |
| Main stance, ordinary rule and responses | `src/core/dove-agent-persona.mjs`, `src/core/ambient-policy.mjs`, `src/core/user-response-policy.mjs` |
| Native author, mentor and reviewer | `src/core/dove-agent-definition.mjs` |
| Author preferences | `docs/AUTHOR_PREFERENCES.md` (sole full source), `src/core/dove-author-preferences.mjs` |
| Nine flat Skills | `src/core/command-manifest.mjs` |
| Host and retrieval integration | `src/core/host-registry.mjs`, `src/core/paper-search-integration.mjs`, `src/core/web-access-integration.mjs` |
| CLI | `bin/dove.mjs`, `src/cli/` |
| Installation and ownership | `src/core/project-installation.mjs`, `src/core/project-installation-plan.mjs`, `src/core/project-installation-resources.mjs`, `src/core/project-installation-manifest.mjs` |
| Lifecycle, Doctor and hooks | `src/core/dove-lifecycle.mjs`, `src/core/project-doctor.mjs`, `src/core/session-start-hook.mjs` |
| Rooted writes and transactions | `src/core/project-root.mjs`, `src/core/rooted-filesystem.mjs`, `src/core/file-set-transaction.mjs` |
| Research bootstrap and card | `src/core/research-defaults.mjs`, `src/core/research-documents.mjs`, `src/core/identity-card.mjs` |
| Tracking/library, topic cards and dashboard data | `src/core/paper-watch.mjs`, `src/core/topic-selection.mjs`, `src/core/dashboard-data.mjs` |
| Execution receipts | `src/core/run-record.mjs`, `src/core/run-supervisor.mjs`, `src/core/run-environment.mjs` |
| Package identity | `package.json`, `src/core/package-metadata.mjs` |

## Projections and supporting directories

`scripts/generate-author-preferences.mjs` projects the preference source into `src/core/dove-author-preferences-content.generated.mjs`; edit the owner, not the generated string.

`scripts/generate-command-adapters-cli.mjs` projects canonical behavior into `package-resources/hosts/claude/.claude/` and `package-resources/hosts/dsh/.dsh/skills/`, plus each host's four `.dove/install/` references. `commands:check` detects drift without generating. Installation uses bundled renderers rather than copying projections.

`scripts/build-package.mjs` bundles `src/core/index.mjs` into `dist/index.mjs` and `bin/dove.mjs` into `bin/dove-package.mjs`. There is no research-state MCP bundle. Generation, build, installation, host loading and behavior are separate facts.

`docs/` holds public/development guidance. Keep all seven `.trellis/spec/frontend/` filenames unchanged and English, byte-identical to `src/templates/markdown/spec/frontend/` mirrors. These are not host adapters. Repository `.claude/hooks/` and `.claude/agents/` support Trellis, not packaged Dove. Validation tooling in `tests/`, `scripts/validate-*.mjs` and `evals/behavior/` remains subject to [Quality Guidelines](./quality-guidelines.md) and task scope.

## Consumer-project layout

```text
.dove/
  install/manifest.json           # software ownership
  install/RESEARCH_QUALITY.md     # quality essentials
  install/RESEARCH_QUALITY_FULL.md
  install/AUTHOR_PREFERENCES.md   # author essentials
  install/AUTHOR_PREFERENCES_FULL.md
  install/DOCTOR.md               # Dove feedback
  research/IDENTITY.md            # current card, 1200 characters
  research/EVAL.md                # version rows and current assessment
  research/MENTOR_NOTES.md        # mentor-authored memory
  research/rounds/
    NNN-brief.md                 # one brief, 2000 characters
    NNN-result.md                # one result, 3000 characters
  research/papers/
    <id>.md                     # cumulative body-grounded Q&A
    library.json                # direction-grouped judged literature
    library.md                  # readable literature list
  research/watch/
    config.json
    DATE.md / DATE.json          # discoveries, Chinese lines and provenance
    impact-DATE.md               # impact, reason, direction and Chinese line
    scan-DATE.md                 # sourced field scan
  research/topics/CRITERIA.md     # project selection standards
  research/topics/cards/         # grounded candidate cards
  research/RESEARCH.md            # short history index
  research/missions/             # preserved history
  research/experiments/
  research/claims/
  research/sources/               # other supporting material
  research/reviews/
  research/lessons/
  reviews/                       # preserved review-runtime history
  runs/<run-id>/                 # run.jsonl, stdout.log, stderr.log
  archive/                       # user history
```

Init adds only RESEARCH, not an empty tree. Q&A and library files belong to researchers; watch or explicit accumulation saves the library, never dashboard reads/exports. Default-off `hostMigration` lets updates register software pending tasks under install; the host, not CLI, later reorganizes research without changing conclusions or interrupting jobs. Ordinary artifacts remain linked from rounds. Isolation uses native contexts, not workspaces. See [State Management](./state-management.md).
