# Dove documentation

This directory contains the product documentation for Dove. Treat `README.md` at the repository root as the quick-start entrypoint and this file as the map for the current install, usage, package, and capability contracts.

## Current operator docs

Read these first when installing, using, validating, or packaging Dove:

- [Installation](INSTALL.md) — host-neutral core install, optional multi-host adapters, onboarding, doctor, and validation commands.
- [Usage](USAGE.md) — slash-command workflow, durable `.dove/` workspace model, paper pipeline, query surfaces, bounded autonomy, MCP tools, and role model.
- [Packaging](PACKAGING.md) — package boundary, generated adapter expectations, managed-vs-user-owned state, release checks, and dry-run packaging.
- [Capability matrix](CAPABILITY_MATRIX.md) — auditable current-release claims and deliberately deferred capabilities.

## Documentation governance

- Keep `.dove/` as the only authoritative runtime state root in user-facing docs.
- Describe ignored stale workspace artifacts as diagnostics only, not as compatibility authority.
- Describe OpenCode as the default adapter, not the only supported host.
- Treat generated host command adapters as outputs from `src/core/command-manifest.mjs`; do not document hand-edited per-host command inventories.
- Keep local development scaffolding separate from Dove product/package surfaces.
- When command, MCP, package, or governance contracts change, update the relevant docs and run the matching validation commands before release.

## Release documentation checklist

Before publishing or pushing release-oriented changes, run:

```bash
npm run check
npm run release:check
npm run pack:dry-run
```

Use `npm run commands:generate` and `npm run commands:check` whenever command manifest metadata changes.
