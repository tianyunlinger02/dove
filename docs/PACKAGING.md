# Packaging

## Delivery model

Dove is published as a host-neutral npm package with optional generated host adapters. The public package identity, CLI binary, and MCP server identity are all `dove`.

The npm package uses build-time standalone ESM bundles for Node.js 22:

- `dist/index.mjs` — the package-root JavaScript API
- `bin/dove-package.mjs` — the `dove` CLI
- `mcp/dove-state-server-package.mjs` — the stdio MCP executable
- `scripts/doctor-mcp-probe-package.mjs` — the installed doctor probe
- current public docs, `README.md`, `AGENTS.md`, `.opencode.json`, and Dove-only generated adapters for all 12 command surfaces, including `dove.lessons`

The raw `src/` tree, raw source entrypoints, development scripts, tests, source maps, and chunks are not published. The package `exports` map limits legal package specifiers, but exports maps are not filesystem isolation. Omitting raw source from the tarball prevents an installed consumer from resolving sibling internal modules with URLs derived from `import.meta.resolve("dove")`.

## Source-checkout build contract

The following build and release commands are maintainer-only and must be run from a Dove source checkout. Installed projects receive the generated bundles and do not contain the raw build scripts or tests.

```bash
npm run build
npm run build:check
```

`build` uses the esbuild JavaScript API to produce four no-splitting, no-sourcemap Node 22 ESM bundles. Project-relative imports are inlined; only `node:*` imports may remain external. CLI and MCP bundles retain their Node shebangs.

`build:check` builds into a temporary directory, validates the exact output set, rejects maps/chunks and non-`node:*` externals, checks shebangs, and byte-compares the temporary output with the checked-in generated bundles without rewriting them. `prepack` runs this check only, so `npm pack` never regenerates tracked output.

## Managed vs user-owned boundary

The installer copies the four bundled runtime artifacts, necessary public docs, and selected host adapters. It does not require or copy shipped raw source. The standard installed MCP path is `mcp/dove-state-server-package.mjs`.

The project-local `.dove/` workspace remains user-owned state. Install and sync do not bootstrap or overwrite it. Explicit schema 7 mutations own advisory lessons, evolving sources, notes, claims, drafts, experiments, figures, rebuttal issues, receipts, ownership/lineage indexes, and immutable snapshots; legacy packet/runtime state is not imported or repaired.

## Generated adapters and release checks

```bash
npm run commands:generate
npm run commands:check
npm run check
npm run release:check
npm pack --dry-run --json
```

Generated adapters route installed projects to `bin/dove-package.mjs`, and generated MCP configuration routes to `mcp/dove-state-server-package.mjs`. The exact generated inventory is 48 checked-in project adapters across OpenCode, Codex, Cursor, and shared agents, plus 12 user-level Claude commands: 60 combined adapters. The package exposes exactly 12 commands and 27 MCP tools. `check` and `release:check` include bundle drift validation.

The lessons package surface contains `.dove/lessons` support, `query_dove_lessons`, `record_dove_lesson`, and generated `dove.lessons` adapters. It does not ship retired operator lesson storage or tools, automatic capture/recall hooks, transcript import, Trellis writes, runtime state, or compatibility aliases.
