# Directory Structure

Paths are relative to the repository root unless identified as consumer-project paths.

## Source map

| Responsibility | Canonical source |
|---|---|
| Scientific contract and quality references | `src/core/dove-research-contract.mjs` |
| Main agent stance, ordinary rule and response policy | `src/core/dove-agent-persona.mjs`, `src/core/ambient-policy.mjs`, `src/core/user-response-policy.mjs` |
| Native author, mentor and paper-review definitions | `src/core/dove-agent-definition.mjs` |
| Author preferences and fresh-context reading | `docs/AUTHOR_PREFERENCES.md` (sole full source, unchanged here), `src/core/dove-author-preferences.mjs` |
| Nine flat Skills | `src/core/command-manifest.mjs` |
| Host and retrieval integration | `src/core/host-registry.mjs`, `src/core/paper-search-integration.mjs`, `src/core/web-access-integration.mjs` |
| CLI parsing and presentation | `bin/dove.mjs`, `src/cli/` |
| Installation and ownership | `src/core/project-installation.mjs`, `src/core/project-installation-plan.mjs`, `src/core/project-installation-resources.mjs`, `src/core/project-installation-manifest.mjs` |
| Lifecycle, Doctor and context hooks | `src/core/dove-lifecycle.mjs`, `src/core/project-doctor.mjs`, `src/core/session-start-hook.mjs` |
| Rooted writes and transactions | `src/core/project-root.mjs`, `src/core/rooted-filesystem.mjs`, `src/core/file-set-transaction.mjs` |
| Research bootstrap and card presentation | `src/core/research-defaults.mjs`, `src/core/research-documents.mjs`, `src/core/identity-card.mjs` |
| Tracking, topic materials and dashboard data | `src/core/paper-watch.mjs`, `src/core/topic-selection.mjs`, `src/core/dashboard-data.mjs` |
| Execution receipts | `src/core/run-record.mjs`, `src/core/run-supervisor.mjs`, `src/core/run-environment.mjs` |
| Package identity | `package.json`, `src/core/package-metadata.mjs` |

## Projections and supporting directories

`scripts/generate-author-preferences.mjs` projects the full preference Markdown into `src/core/dove-author-preferences-content.generated.mjs`. Edit the owner, not the generated string; this restructuring does not change the full preferences.

`scripts/generate-command-adapters-cli.mjs` orchestrates preference and host-resource generation. The adapter generator projects canonical behavior into `package-resources/hosts/claude/.claude/` and `package-resources/hosts/dsh/.dsh/skills/`, plus each host's four exact `.dove/install/` references. `commands:check` checks drift without generating. Consumer installation uses bundled renderers rather than copying release projections.

`scripts/build-package.mjs` bundles `src/core/index.mjs` into `dist/index.mjs` and `bin/dove.mjs` into `bin/dove-package.mjs`. There is no research-state MCP bundle. Generation, build, installation, host loading and observed behavior are separate facts; see [Quality Guidelines](./quality-guidelines.md).

`docs/` contains public and development guidance. The seven `.trellis/spec/frontend/` files and matching `src/templates/markdown/spec/frontend/` copies must be byte-identical and written in English. These pairs are not generated host adapters. Repository `.claude/hooks/` and `.claude/agents/` support Trellis development, not packaged Dove integration. `tests/`, `scripts/validate-*.mjs` and `evals/behavior/` hold validation tooling, whose execution still requires the current task's scope.

## Consumer-project layout

```text
.dove/
  install/manifest.json           # software ownership metadata
  install/RESEARCH_QUALITY.md     # short quality guidance
  install/RESEARCH_QUALITY_FULL.md
  install/AUTHOR_PREFERENCES.md   # short author guidance
  install/AUTHOR_PREFERENCES_FULL.md
  install/DOCTOR.md               # host-maintained Dove feedback
  research/IDENTITY.md            # current card, at most 1200 characters
  research/EVAL.md                # method-version rows and current assessment
  research/MENTOR_NOTES.md        # mentor's own returned memory
  research/rounds/
    NNN-brief.md                 # one authored brief, at most 2000 characters
    NNN-result.md                # one result, at most 3000 characters
  research/watch/
    config.json
    DATE.md / DATE.json          # discovered papers
    impact-DATE.md               # new impact judgments, independent of rounds
    scan-DATE.md                 # sourced field scan
  research/topics/CRITERIA.md     # existing project topic-selection standards
  research/topics/cards/         # existing candidate materials
  research/RESEARCH.md            # short history index
  research/missions/             # preserved history
  research/experiments/
  research/claims/
  research/sources/               # optional supporting material
  research/reviews/
  research/lessons/
  reviews/                       # preserved review-runtime history
  runs/<run-id>/                 # run.jsonl, stdout.log, stderr.log
  archive/                       # existing user history
```

This map is not an instruction to create an empty tree. Init adds only the RESEARCH bootstrap when no research directory exists. Drafts, code, data, figures, logs and other attachments stay in ordinary project directories and are linked from rounds. Mentor/review isolation uses native contexts, not separate workspaces. Exact record fields, note consolidation and preservation rules belong in [State Management](./state-management.md).
