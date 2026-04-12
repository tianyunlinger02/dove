# Packaging

## Mature delivery model

`paper_factory` is meant to be packaged honestly as an OpenCode workflow pack.

That means the durable product surface is:

- `.opencode/commands/`
- `.opencode/skills/`
- `.opencode.json`
- `.paper/` starter artifacts
- `bin/paper-factory.mjs`

## Managed vs user-owned boundary

The packaged code surface is managed:

- `.opencode/`
- `.opencode.json`
- `bin/`, `docs/`, `mcp/`, `scripts/`, `src/`, `README.md`

The project-local `.paper/` workspace is user-owned state. The installer may create missing starter artifacts, but pack updates should not overwrite evolving sources, notes, drafts, experiments, rebuttal issues, task packets, role manifests, or snapshots.

## Why this is not pretending to be more than it is

OpenCode can support richer features, but the heart of `paper_factory` is intentionally file-first and portable. The package should not claim hidden runtime powers that only a host-specific harness can provide.

## Dry-run packaging

```bash
npm pack --dry-run
```

This should include the command pack, skill pack, `.paper/` starter artifacts, the MCP entrypoint, and the CLI installer.
