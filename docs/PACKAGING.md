# Packaging

## Delivery model

Dove is packaged as a host-neutral mission workflow system with optional host adapters. The public package identity, binary, and MCP server identity are all `dove`.

The packaged surface is:

- neutral CLI/MCP/core files: `bin/`, current public `docs/`, `mcp/`, `scripts/`, `src/`, and `README.md`
- the `dove` binary at `bin/dove.mjs`
- the stdio MCP wrapper at `mcp/dove-state-server.mjs`
- default OpenCode adapter files: `.opencode/commands/dove*.md`, `.opencode/skills/dove-*`, and `.opencode.json`
- optional Dove-only project adapter files for Codex, Cursor, and shared agent-skill hosts, generated from `src/core/command-manifest.mjs`; Claude Code uses a manifest-rendered user-level `/dove:*` command set written by `dove install/sync --host claude` instead of packaged project `.claude/commands/dove` files

The project-local `.dove/` directory is created or repaired at install time. It is not shipped as a package snapshot. OpenCode is the default adapter, and the canonical command manifest generates the flat Dove adapter set for every supported project-local host.

## Managed vs user-owned boundary

The packaged code surface is managed:

- neutral core: `bin/`, current public `docs/`, `mcp/`, `scripts/`, `src/`, `README.md`
- host adapters: `.opencode/commands/dove*.md`, `.opencode/skills/dove-*`, `.opencode.json`, `.codex/skills/dove-*`, `.cursor/commands/dove-*.md`, `.agents/skills/dove-*`, `AGENTS.md`

The project-local `.dove/` workspace is user-owned state. The installer may create missing starter artifacts and `.dove/manifest.json`, but pack updates should not overwrite evolving sources, notes, drafts, experiments, review logs, rebuttal issues, task packets, runtime state, program approvals, role manifests, or snapshots.

## Runtime claims

Dove is intentionally file-first and portable. Host adapters can expose richer ergonomics, but they do not change the source of truth: CLI, MCP, commands, and skills converge on `.dove/` artifacts.

Dove should not claim hidden runtime powers that only a host-specific harness could provide. Autonomy surfaces are explicit and foreground-bound. Mission launch materializes accepted guidance into `.dove/task-packets`; it does not execute the mission or silently run a background worker.

## Generated adapter and release checks

```bash
npm run commands:generate
npm run commands:check
npm run release:check
```

`commands:generate` rewrites checked-in host adapters from the canonical manifest. `commands:check` fails on adapter drift. `workflow-goals:validate` runs executable product-goal pressure scenarios, including no-fake-progress operator semantics. `release:check` is the full package gate: generated adapter drift, command validation, MCP validation, workflow-goal validation, governance audit, maturity audit, clean-install doctor validation, tests, and package dry-run.

## Dry-run packaging

```bash
npm pack --dry-run
```

This should include the neutral core, current public docs, Dove-only adapter surfaces, the MCP entrypoint, and the CLI installer. It should not include `.dove/` runtime snapshots, local development scaffolding, historical design notes, local reference repos, `node_modules`, `.env*`, `*.local.json`, or host-local settings.
