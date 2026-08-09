# Packaging

## Delivery model

Dove 0.7.0 is one host-neutral Node.js 22 npm artifact. It installs the `dove` executable for the current user. Consumer projects invoke `dove` from `PATH`; project initialization does not copy runtime bundles into the project.

The bare public npm package named `dove` is unrelated. Release instructions must use an exact trusted tarball, Git revision, or internal-registry package/version.

## Exact public inventory

Every 0.7.0 release contains:

- **9 flat Skills**: `research`, `status`, `source`, `experiment`, `draft`, `figure`, `review`, `rebuttal`, and `lessons`;
- **8 public MCP tools**;
- **45 generated adapters**, 9 each for OpenCode, Codex, Cursor, shared-agent hosts, and Claude Code;
- **7 runtime CLI commands**: `init`, `sync`, `upgrade`, `reinstall`, `doctor`, `mcp`, and `hook`;
- **3 OpenCode responsibility Skills**: Planner, Builder/Author, and Reviewer;
- dedicated Claude and OpenCode `dove-reviewer` definitions; and
- **3 generated Claude ambient resources**: one rule and two hidden Skills.

### Public MCP tools

1. `query_dove_research`
2. `manage_dove_workspace`
3. `manage_dove_missions`
4. `manage_dove_sources`
5. `manage_dove_experiments`
6. `manage_dove_claims`
7. `manage_dove_reviews`
8. `manage_dove_lessons`

A Skill is a host workflow. An MCP tool is a structured operation. A Research Format 1 entity is durable research context. An ordinary project artifact is the substantive file produced by the host. These inventories intentionally do not map one-to-one.

## Research Format 1 inventory

Every initialized project records managed integration in `.dove/install/manifest.json`. Research Format 1 is optional, is identified by `dove-research-v1` in `.dove/format.json`, and uses these sibling paths:

- `.dove/workspace.json`;
- `.dove/missions/*.json` and optional immutable Mission conclusion records;
- `.dove/sources/*.json`;
- `.dove/experiments/*.plan.json` and `*.result.json`;
- `.dove/claims/*.json`;
- `.dove/reviews/*.json`; and
- `.dove/LESSONS.md`.

The nine public query views are `overview`, `diagnosis`, `related-work`, `hypotheses`, `experiment-options`, `result-synthesis`, `claim-story`, `branch-synthesis`, and `reviews`.

Research Format 1 has no separate decision, work-return, transition, receipt, task ledger, artifact mirror, or gate database. Drafts, notes, figures, datasets, logs, code, papers, and rebuttals remain normal project files.

## Generated host surfaces

Canonical generated adapter outputs are:

- `.opencode/commands/dove.*.md` — 9;
- `.codex/skills/dove-*/SKILL.md` — 9;
- `.cursor/commands/dove-*.md` — 9;
- `.agents/skills/dove-*/SKILL.md` — 9;
- `.claude/commands/dove/*.md` — 9.

Additional generated role and ambient resources include:

- `.opencode/skills/dove-{planner,builder,reviewer}/SKILL.md`;
- `.claude/agents/dove-reviewer.md`;
- `.opencode/agents/dove-reviewer.md`;
- `.claude/rules/dove.md`;
- `.claude/skills/dove-intake/SKILL.md`; and
- `.claude/skills/dove-lessons-intake/SKILL.md`.

Adapters are thin projections of the canonical command manifest. Adapter presence is not host registration, MCP connectivity, readiness, reviewer independence, or scientific authority.

## Runtime bundles

The package contains five standalone Node.js 22 ESM bundles:

| Bundle | Source entrypoint |
|---|---|
| `dist/index.mjs` | `src/core/index.mjs` |
| `bin/dove-package.mjs` | `bin/dove.mjs` |
| `mcp/dove-state-server-package.mjs` | `mcp/dove-state-server.mjs` |
| `scripts/doctor-mcp-probe-package.mjs` | `scripts/doctor-mcp-probe.mjs` |
| `scripts/dove-user-prompt-submit-package.mjs` | `scripts/dove-user-prompt-submit.mjs` |

`scripts/build-package.mjs` is the canonical builder and reproducibility checker. Generated adapters and standalone bundles are checked release artifacts; consumer installation does not regenerate them.

## Project integration boundary

In 0.7.0, Claude Code is the only project-initializable host. `dove init --host claude` may install:

- 9 Claude command adapters;
- one Claude Reviewer definition;
- three Claude ambient resources;
- project-local MCP registration and approval fragments;
- one managed prompt-hook fragment; and
- `.dove/install/manifest.json`.

`dove sync` updates manifest-selected integration. The interactive lifecycle also exposes project-level Upgrade and Complete Reinstall. Neither operation installs, upgrades, uninstalls, or otherwise manages the user's npm installation.

Upgrade refreshes project integration while preserving current Research Format 1 bytes. It may consume and remove a valid legacy `.dove-install/manifest.json` and move a legacy `.dove-archive/` into `.dove/archive/`. Confirmed Complete Reinstall removes project integration, optional Research Format 1 state, both legacy roots, and recognized copied-runtime remnants, then recreates `.dove/install/manifest.json` and managed host integration. Routine initialization and synchronization do not create Research Format 1. No operation writes global host configuration or copies runtime bundles into the consumer project.

## Research and review boundaries

- The host performs actual search, capture, analysis, experiments, code execution, writing, and figure production.
- Dove records and projects research context; it does not execute an experiment or determine scientific meaning.
- Experiment records preserve positive, negative, null, mixed, failed, and stopped results with denominators and uncertainty.
- Claims require exact support and explicit cannot-say boundaries.
- Review uses a user-managed separate exchange. Dove prepares fingerprints, imports a return, and verifies current byte coverage; it never launches or impersonates a reviewer.
- Passing software checks does not prove scientific correctness or independent review.

## Version boundaries

The release validates independent boundaries:

1. **Package release** — `0.7.0`.
2. **Research state format** — `dove-research-v1`.
3. **Project integration** — `.dove/install/manifest.json` with manifest Schema `1`, integration version `2`, ownership version `2`, and runtime protocol `2`.
4. **MCP transport protocol** — negotiated independently with the host.
5. **Record contracts** — exact sealed fields for each Research Format 1 entity and operation.

No packaged layer migrates unsupported state or falls back to an older reader, alias root, copied runtime, shell path, or direct `.dove/` access.

## Build and release validation

From a source checkout:

```bash
npm ci
npm run build:check
npm run commands:check
npm run commands:validate
npm run research-constitution:validate
npm run mcp:validate
npm run workflow-goals:validate
npm run governance:audit
npm test
npm run check
npm run release:check
npm run pack:dry-run
```

Release checks verify software contracts, exact 9/8/45/7 inventories, generated drift, package contents, integration ownership, tool schemas, and bundle reproducibility. They do not certify research claims or establish an independent review process.
