# Packaging

## Mature delivery model

`paper_factory` is meant to be packaged honestly as an OpenCode workflow pack.

That means the durable product surface is:

- `.opencode/commands/`
- `.opencode/skills/`
- `.opencode.json`
- `.paper/` starter artifacts
- `bin/paper-factory.mjs`

## Why this is not pretending to be more than it is

OpenCode can support richer features, but the heart of `paper_factory` is intentionally file-first and portable. The package should not claim hidden runtime powers that only a host-specific harness can provide.

## Dry-run packaging

```bash
npm pack --dry-run
```

This should include the command pack, skill pack, `.paper/` starter artifacts, the MCP entrypoint, and the CLI installer.
