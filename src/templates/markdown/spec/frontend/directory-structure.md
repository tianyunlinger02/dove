# Directory Structure

Paths below are relative to the repository root unless labeled as consumer-project paths.

## Source map

| Responsibility | Canonical source |
|---|---|
| Shared scientific judgment and stance rendering | `src/core/dove-research-contract.mjs`, `src/core/dove-agent-persona.mjs` |
| Dove agent, ordinary Claude rule, response policy | `src/core/dove-agent-definition.mjs`, `src/core/ambient-policy.mjs`, `src/core/user-response-policy.mjs` |
| Skill inventory and workflows | `src/core/command-manifest.mjs` |
| Host and external-tool integration | `src/core/host-registry.mjs`, `src/core/paper-search-integration.mjs`, `src/core/web-access-integration.mjs` |
| CLI entry, parsing and presentation | `bin/dove.mjs`, `src/cli/command-parser.mjs`, other `src/cli/` modules |
| Installation planning, resources and manifest | `src/core/project-installation.mjs`, `src/core/project-installation-plan.mjs`, `src/core/project-installation-resources.mjs`, `src/core/project-installation-manifest.mjs` |
| Lifecycle, diagnostics and product SessionStart | `src/core/dove-lifecycle.mjs`, `src/core/project-doctor.mjs`, `src/core/session-start-hook.mjs` |
| Project boundary and safe writes | `src/core/project-root.mjs`, `src/core/rooted-filesystem.mjs`, `src/core/file-set-transaction.mjs` |
| Research bootstrap and document helpers | `src/core/research-defaults.mjs`, `src/core/research-documents.mjs` |
| Isolated review | `src/core/review-runtime.mjs`, `src/core/review-snapshot.mjs`, `src/core/review-workspace.mjs`, `src/core/review-claude-backend.mjs` |
| Local execution receipts | `src/core/run-record.mjs`, `src/core/run-supervisor.mjs`, `src/core/run-environment.mjs` |
| Package identity and runtime requirements | `package.json`, `src/core/package-metadata.mjs` |

## Projections and supporting directories

- `scripts/generate-command-adapters.mjs` projects canonical behavior into `package-resources/hosts/claude/.claude/` (agent, commands, rule, hidden guidance Skills) and `package-resources/hosts/dsh/.dsh/skills/`.
- `scripts/build-package.mjs` bundles `src/core/index.mjs` into `dist/index.mjs` and `bin/dove.mjs` into `bin/dove-package.mjs`. There is no research-state MCP bundle.
- `tests/commands/`, `scripts/validate-*.mjs`, and `evals/behavior/` contain software checks and behavior-evaluation tooling.
- `docs/` contains public and development documentation. `.trellis/spec/` and `src/templates/markdown/spec/` are source/template spec pairs, not Dove host adapters.
- Repository `.claude/hooks/` and `.claude/agents/` support Trellis development; they are distinct from packaged Dove integration.

Change the owning source first; generated adapters and bundles are projections, not independent behavior definitions.

## Consumer-project layout

```text
.dove/
  install/manifest.json       # software installation metadata
  install/DOCTOR.md           # optional host-maintained Dove feedback
  research/RESEARCH.md        # researcher-owned overview
  research/missions/          # optional Mission documents
  research/experiments/       # optional Experiment documents
  research/sources/           # optional Source documents
  research/reviews/           # optional authored Review documents
  research/claims/            # optional Claim documents
  research/lessons/           # optional advisory Lessons
  reviews/<review-id>/        # runtime exchange records
    review.json
    rounds/<round>/           # snapshot.json, backend.json, report.md
  runs/<run-id>/              # run.jsonl, stdout.log, stderr.log
  archive/                   # legacy/user-owned material when present
```

Drafts, code, datasets, figures, source captures, and rebuttals stay in ordinary project locations. Reviewer workspaces are separate from durable exchange records. See [State Management](./state-management.md) for ownership and optional-document rules, and [Type Safety](./type-safety.md) for path constraints.
