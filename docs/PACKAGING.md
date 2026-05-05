# Packaging

## Mature delivery model

`paper_factory` is packaged as the compatibility delivery name for Dove: a host-neutral mission workflow pack with optional host adapters.

That means the durable product surface is:

- neutral CLI/MCP/core files: `bin/`, `docs/`, `mcp/`, `scripts/`, `src/`, and `README.md`, including `paper-factory` plus the limited Dove CLI alias for read-only inspection and governed launch
- default OpenCode adapter files: `.opencode/` and `.opencode.json`
- optional adapter files for Claude Code, Codex, Cursor, and shared agent-skill hosts
- `.paper/` workspace artifacts bootstrapped at install time, including `.paper/workspace/dove-root-manifest.json` as manifest-only Dove migration metadata, not shipped as a package snapshot

## Managed vs user-owned boundary

The packaged code surface is managed:

- neutral core: `bin/`, `docs/`, `mcp/`, `scripts/`, `src/`, `README.md`
- host adapters: `.opencode/`, `.opencode.json`, `.claude/commands`, `.claude/agents`, `.codex/agents`, `.codex/skills`, `.codex/config.toml`, `.cursor/commands`, `.agents/skills`, `AGENTS.md`

The project-local `.paper/` workspace is user-owned state. The installer may create missing starter artifacts and the Dove durable-root manifest, but pack updates should not overwrite evolving sources, notes, drafts, experiments, rebuttal issues, task packets, role manifests, or snapshots. The manifest records migration policy only; it does not make `.dove/` authoritative.

## Why this is not pretending to be more than it is

Host adapters can expose richer native ergonomics, but the heart of `paper_factory` is intentionally file-first and portable. The limited `dove` binary is a Dove-facing alias for read-only orchestrate, mission, board, audit, and return inspection plus governed `launch`; it is not a package rename. `dove launch` writes Dove mission packets through the existing `.paper/task-packets` materialization bridge, requires an accepted source and execution/review window, and does not execute autonomy. `.paper/` remains the active authoritative durable root, `.paper/workspace/dove-root-manifest.json` records the no-dual-root migration strategy, and `.dove/` remains planned migration metadata until an explicit breaking migration is approved. The package should not claim hidden runtime powers that only a host-specific harness can provide.

## Dry-run packaging

```bash
npm pack --dry-run
```

This should include the neutral core, safe adapter surfaces, the MCP entrypoint, and the CLI installer. It should not include `.paper/` runtime snapshots, local reference repos, `node_modules`, `.env*`, `*.local.json`, or host-local settings.
