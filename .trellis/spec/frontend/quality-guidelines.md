# Quality Guidelines

> Documentation, package, and public-contract quality standards for Dove Research Format 1.

---

## Primary Gates

```bash
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

Documentation-only work may use read-only inventory, pairwise consistency, language, and diff checks when code, tests, bundles, and generated adapters are outside the approved scope.

## Exact Public Contracts

Validation must preserve:

- 9 direct Skills;
- 8 canonical MCP tools;
- 45 generated adapters, 9 for each of five host formats;
- managed Claude ambient resources;
- three primary responsibilities;
- optional text on every direct Skill;
- semantic-ID selection when durable records are needed;
- zero-write ambient routing;
- user-managed Review exchange;
- safe human text plus structured research projection;
- runtime-only CLI integration; and
- identical Trellis frontend specs and template copies.

## Semantic Checks

Documentation, prompts, and adapters must distinguish:

- Skill versus MCP tool versus semantic entity versus project artifact versus installation resource;
- Workspace and Mission direction versus evidence entities;
- Mission parent/dependency lineage versus a second research-tree store;
- immutable Mission contract versus optional Mission conclusion;
- external Source capture versus internal synthesis;
- frozen Experiment plan versus immutable Experiment result;
- evidence-bounded Claim versus completion or scientific authority;
- user-managed Review exchange versus an internally launched or impersonated reviewer;
- zero-write ambient routing versus Mission creation;
- research MCP operations versus runtime CLI integration; and
- adapter inventory versus host registration and readiness.

Current research-state references must use Workspace, Mission, Mission conclusion, Source, Experiment plan/result, Claim, Review, and Lessons concepts. Draft, Figure, Rebuttal, and internal synthesis are project artifacts. Do not describe retired revision, execution-bookkeeping, private-protocol, positional-selection, or duplicate-tree models as current behavior.

## Installation and Runtime Checks

Documentation must describe one current project-private root: `.dove/install/manifest.json` for managed installation state plus optional Research Format 1 siblings under `.dove/`. It must describe:

- the user-installed `dove` executable as the runtime entry, not a lifecycle mutation target;
- `init`, manifest-driven `sync`, project Upgrade, confirmed project Complete Reinstall, read-only `doctor`, `mcp serve`, and prompt-hook forwarding;
- Upgrade preserving current Research Format 1 bytes while cleaning a valid legacy `.dove-install/` root;
- Complete Reinstall deleting selected-project Dove state only after exact default-No confirmation and recreating `.dove/install/manifest.json`;
- neither Upgrade nor Complete Reinstall installing, upgrading, uninstalling, or otherwise managing user npm;
- no copied runtime bundles in consumer projects; and
- no CLI, shell, or direct-state fallback for Skills.

`.dove-install/` may appear only as legacy Upgrade or Complete Reinstall cleanup input. Legacy or unknown research formats may be diagnosed read-only, but current documentation must not promise research-format migration, overlay upgrade, replacement, recovery, or fallback execution.

## Format Checks

- Package release is `0.7.0`.
- Current research format is Research Format 1 with marker `dove-research-v1`.
- Package semver, research format, and installation-manifest contracts are separate boundaries.
- Legacy numbered workspace schemas are rejection-only context, not current version boundaries or compatibility paths.

## Required Patterns

- Keep public prose concise and task-oriented.
- Keep all Trellis documentation in English.
- Keep generated adapters thin and derived from canonical Skill metadata.
- Keep MCP schemas sealed and exact.
- Keep reads and ambient routing zero-write.
- Preflight every mutation before the first write.
- Keep integrity hashes, bindings, write diagnostics, and `.dove/` paths out of human-facing output.
- Preserve failed, blocked, negative, null, incomplete, and uncertain evidence.
- Keep claim scope bounded by current evidence and explicit cannot-say limits.
- Never equate host return, tests, local review, imported review, Mission conclusion, or internal audit with completion, independence, or scientific authority.

## Review Checklist

- Do public docs agree on 9 Skills, 8 tools, and 45 adapters?
- Are all 9 Skill names and purposes consistent?
- Are all 8 MCP tool names and operation families accurate?
- Is direct invocation with optional text clear?
- Are semantic IDs used instead of positional Mission numbers?
- Is zero-write ambient routing explicit?
- Are Research Format 1 paths and semantic entities accurate?
- Are Source, synthesis, Experiment, Claim, and project-artifact distinctions consistent?
- Is Review a user-managed separate exchange with prepare, import, and coverage?
- Is `.dove/` the only current project-private root, with `.dove/install/manifest.json` and optional Research Format 1 siblings clearly separated?
- Is `.dove-install/` mentioned only in legacy Upgrade or Complete Reinstall cleanup context?
- Are Upgrade and Complete Reinstall explicitly project-level and outside user npm management?
- Is the CLI described as runtime integration rather than a research fallback?
- Do Trellis specs exactly match their template copies?
- Were code, tests, bundles, and generated adapters left unchanged when outside scope?
