# Dove documentation

This directory contains the product documentation for Dove. Treat `README.md` at the repository root as the quick-start entrypoint and this file as the map for the current install, usage, package, and capability contracts.

## Current operator docs

Read these first when installing, using, validating, or packaging Dove:

- [Installation](INSTALL.md) — host-neutral core install, optional multi-host adapters, schema initialization, doctor, and validation commands.
- [Usage](USAGE.md) — mission-bound workflow, durable schema 9 artifact model, explicit advisory lesson query/record, read-only status, sealed MCP tools, and responsibility boundaries.
- [Packaging](PACKAGING.md) — package boundary, generated adapter expectations, managed-vs-user-owned state, release checks, and dry-run packaging.
- [Capability matrix](CAPABILITY_MATRIX.md) — auditable current-release claims and deliberately deferred capabilities.

## Documentation governance

- Keep `.dove/` as the only authoritative runtime state root in user-facing docs.
- Describe ignored stale workspace artifacts as diagnostics only, not as compatibility authority.
- Describe OpenCode as the default adapter, not the only supported host.
- Treat generated host command adapters as generated outputs; do not document hand-edited per-host command inventories.
- Keep local development scaffolding separate from Dove product/package surfaces.
- When command, MCP, package, or governance contracts change, update the relevant docs and run the matching validation commands before release.
- Keep the inventories aligned but distinct: 12 host workflows; separately 16 top-level CLI subcommands, 28 MCP tools, and 60 generated adapters across the four checked-in project hosts plus Claude user commands.
- Describe lessons as mission-provenanced but optionally globally applicable, limited to five kinds and explicit query/record. They are advisory-only and never auto-captured, auto-recalled, transcript-derived, or written into Trellis/runtime state.

## Source-checkout release documentation checklist

The commands below are maintainer-only and must be run from a Dove source checkout; they are not shipped into an installed project.

Before publishing or pushing release-oriented changes, run:

```bash
npm run check
npm run release:check
npm run pack:dry-run
```

Use `npm run commands:generate` and `npm run commands:check` whenever command manifest metadata changes.
