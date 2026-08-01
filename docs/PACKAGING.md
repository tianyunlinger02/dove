# Packaging

## Delivery model

Dove is one host-neutral npm artifact that installs `dove` for the current user. Consumer projects invoke `dove` from `PATH`; they do not receive copied runtime bundles.

The bare public npm package named `dove` is unrelated. Release instructions use an exact tarball, Git revision, or internal-registry package/version.

## Exact public inventory

Every release preserves:

- **12 direct Skills**: `workspace`, `mission`, `status`, `lessons`, `source`, `note`, `experience`, `experiment`, `draft`, `figure`, `review`, and `rebuttal`;
- **14 canonical MCP tools**;
- **60 generated adapters**, 12 each for OpenCode, Codex, Cursor, shared-agent hosts, and Claude Code;
- **3 OpenCode responsibility Skills**: Planner, Builder/Author, and Reviewer;
- dedicated canonical Claude and OpenCode `dove-reviewer` agent definitions; and
- **3 generated Claude ambient resources**: one rule and two hidden Skills.

The 14 MCP tools are:

1. `manage_dove_workspace`
2. `manage_dove_mission`
3. `query_dove_status`
4. `manage_dove_sources`
5. `record_dove_experiment`
6. `record_dove_claims`
7. `record_dove_draft`
8. `record_dove_figure`
9. `manage_dove_review`
10. `record_dove_rebuttal`
11. `manage_dove_lessons`
12. `create_ambient_dove_mission`
13. `close_host_outcome`
14. `record_research_outcome`

Skill, tool, and durable-entity inventories are separate. A Skill may call several tools, and not every Skill creates a same-named durable entity.

## Generated surfaces

`scripts/generate-command-adapters.mjs` derives all adapters from `src/core/command-manifest.mjs`, primary role definitions from `src/core/role-definitions.mjs`, and Claude ambient resources from `src/core/ambient-policy.mjs`.

Canonical generated outputs are:

- `.opencode/commands/dove.*.md` — 12;
- `.codex/skills/dove-*/SKILL.md` — 12;
- `.cursor/commands/dove-*.md` — 12;
- `.agents/skills/dove-*/SKILL.md` — 12;
- `.claude/commands/dove/*.md` — 12;
- `.claude/rules/dove.md`;
- `.claude/skills/dove-intake/SKILL.md`;
- `.claude/skills/dove-lessons-intake/SKILL.md`;
- `.opencode/skills/dove-{planner,builder,reviewer}/SKILL.md`;
- `.claude/agents/dove-reviewer.md`; and
- `.opencode/agents/dove-reviewer.md`.

Adapters remain thin projections of canonical metadata. Adapter presence is not host registration or readiness.

## Standalone bundles

The package build produces five standalone Node.js 22 ESM bundles:

| Bundle | Source entrypoint |
|---|---|
| `dist/index.mjs` | `src/core/index.mjs` |
| `bin/dove-package.mjs` | `bin/dove.mjs` |
| `mcp/dove-state-server-package.mjs` | `mcp/dove-state-server.mjs` |
| `scripts/doctor-mcp-probe-package.mjs` | `scripts/doctor-mcp-probe.mjs` |
| `scripts/dove-user-prompt-submit-package.mjs` | `scripts/dove-user-prompt-submit.mjs` |

`scripts/build-package.mjs` is the canonical builder and reproducibility checker. Package contents include the runtime bundles, generated direct Skill adapters, OpenCode responsibility Skills, public docs, `.opencode.json`, and `AGENTS.md`. Project initialization additionally renders current Claude ambient integration from source; it never copies package runtime files into the project.

## Current architecture contracts

- `.dove/LESSONS.md` is the single canonical advisory Lessons document. Read/update uses one exact binding and complete Markdown replacement.
- `dove-intake` handles clear ordinary or research work; `dove-lessons-intake` handles natural read, remember, and reflect requests without a Mission.
- Source is external capture; Note is internal synthesis.
- Experience is conception/prevalidation; Experiment owns formal protocol/result recording.
- Draft, Figure, and Rebuttal archive host-produced project artifacts through Receipts and have no parallel mirrors.
- Review freezes scope, launches one isolated native Reviewer, and archives one structured return.
- Human output comes from `report`; `researchHandoff` and `hostControl` remain machine-only.
- Schema 18 is a clean current-only cutover. No migration, alias, compatibility root, or fallback runtime is packaged.

## Project integration boundary

`dove init --host claude` may write `.dove-install/manifest.json`, 12 Claude adapters, three ambient resources, project-local MCP registration, one managed hook fragment, and one MCP approval fragment. It does not create `.dove/`, copy runtime bundles, write global host configuration, or replace unrelated project files.

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

Release validation checks exact 12/14/60 inventories, generated drift, canonical Reviewer definitions, three Claude ambient resources, sealed tool schemas, documentation/spec consistency, package contents, and bundle reproducibility.
