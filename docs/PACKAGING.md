# Packaging

## Delivery model

Dove is packaged as a host-neutral mission workflow system with optional host adapters. The public package identity, binary, and MCP server identity are all `dove`.

The packaged surface is:

- neutral CLI/MCP/core files: `bin/`, `docs/`, `mcp/`, `scripts/`, `src/`, and `README.md`
- the `dove` binary at `bin/dove.mjs`
- the stdio MCP wrapper at `mcp/dove-state-server.mjs`
- default OpenCode adapter files: `.opencode/` and `.opencode.json`
- optional adapter files for Claude Code, Codex, Cursor, and shared agent-skill hosts

The project-local `.dove/` directory is created or repaired at install time. It is not shipped as a package snapshot.

## Managed vs user-owned boundary

The packaged code surface is managed:

- neutral core: `bin/`, `docs/`, `mcp/`, `scripts/`, `src/`, `README.md`
- host adapters: `.opencode/`, `.opencode.json`, `.claude/commands`, `.claude/agents`, `.codex/agents`, `.codex/skills`, `.codex/config.toml`, `.cursor/commands`, `.agents/skills`, `AGENTS.md`

The project-local `.dove/` workspace is user-owned state. The installer may create missing starter artifacts and `.dove/manifest.json`, but pack updates should not overwrite evolving sources, notes, drafts, experiments, review logs, rebuttal issues, task packets, runtime state, program approvals, role manifests, or snapshots.

## Runtime claims

Dove is intentionally file-first and portable. Host adapters can expose richer ergonomics, but they do not change the source of truth: CLI, MCP, commands, and skills converge on `.dove/` artifacts.

Dove should not claim hidden runtime powers that only a host-specific harness could provide. Autonomy surfaces are explicit and foreground-bound. Mission launch materializes accepted guidance into `.dove/task-packets`; it does not execute the mission or silently run a background worker.

## Dry-run packaging

```bash
npm pack --dry-run
```

This should include the neutral core, safe adapter surfaces, the MCP entrypoint, and the CLI installer. It should not include `.dove/` runtime snapshots, local reference repos, `node_modules`, `.env*`, `*.local.json`, or host-local settings.
