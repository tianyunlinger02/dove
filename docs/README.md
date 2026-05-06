# Dove documentation

This directory contains the product documentation for Dove. Treat `README.md` at the repository root as the quick-start entrypoint and this file as the map for deeper package, usage, and background material.

## Current operator docs

Read these first when installing, using, validating, or packaging Dove:

- [Installation](INSTALL.md) — host-neutral core install, optional multi-host adapters, onboarding, doctor, and validation commands.
- [Usage](USAGE.md) — slash-command workflow, durable `.dove/` workspace model, paper pipeline, query surfaces, bounded autonomy, MCP tools, and role model.
- [Packaging](PACKAGING.md) — package boundary, generated adapter expectations, managed-vs-user-owned state, release checks, and dry-run packaging.
- [Capability matrix](CAPABILITY_MATRIX.md) — auditable current-release claims and deliberately deferred capabilities.

## Architecture and history notes

These files explain why Dove has its current shape. They are useful context, but the current contracts above are authoritative for day-to-day operation:

- [Dove refactor plan](DOVE_REFACTOR_PLAN_2026-05-04.md) — direct Dove product model, mission lifecycle, role boundaries, and migration success criteria.
- [Role hierarchy refactor plan](ROLE_HIERARCHY_REFACTOR_PLAN_2026-05-04.md) — planner, builder, and reviewer as the three primary manual roles.
- [Paper Factory system origins](PAPER_FACTORY_SYSTEM_ORIGINS.zh-CN.md) — Chinese background on the paper-workflow origins and external inspirations.
- [Reference architectures](REFERENCE_ARCHITECTURES.zh-CN.md) — Chinese comparison of workflow-pack and research operating system references.

## Documentation governance

- Keep `.dove/` as the only authoritative runtime state root in user-facing docs.
- Describe old `.paper/` only as stale diagnostic state reported by health checks, not as a compatibility authority.
- Describe OpenCode as the default adapter, not the only supported host.
- Treat generated host command adapters as outputs from `src/core/command-manifest.mjs`; do not document hand-edited per-host command inventories.
- Keep repository-local development scaffolding separate from Dove product/package surfaces.
- When command, MCP, package, or governance contracts change, update the relevant docs and run the matching validation commands before release.

## Release documentation checklist

Before publishing or pushing release-oriented changes, run:

```bash
npm run check
npm run release:check
npm run pack:dry-run
```

Use `npm run commands:generate` and `npm run commands:check` whenever command manifest metadata changes.
