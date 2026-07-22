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

The installer copies the four bundled runtime artifacts, necessary public docs, and selected host adapters. It does not require or copy shipped raw source. Every declared managed package source is preflighted as a real file or directory with no symbolic-link or special-file descendants; a missing or unsafe source fails before the transaction starts. The standard installed MCP path is `mcp/dove-state-server-package.mjs`. Claude project registration also manages `.mcp.json` and `mcp/dove-claude-project.json`; both are outside `.dove/`, and the marker contains only fixed host/version metadata rather than workflow state. `.mcp.json` is parsed with duplicate-key rejection before valid unique-key content is merged, and the canonical entry plus `CLAUDE_PROJECT_DIR` root selection remain stable from project subdirectories.

The project-local `.dove/` workspace remains user-owned state. Install and sync do not bootstrap or overwrite it. Explicit schema 9 mutations own advisory lessons, evolving sources, notes, claims, drafts, experiments, figures, rebuttal issues, receipts, and immutable snapshots. Ownership and lineage are derived from the receipt ledger; legacy packet/runtime state is not imported or repaired.

## Generated adapters and release checks

```bash
npm run commands:generate
npm run commands:check
npm run check
npm run release:check
npm pack --dry-run --json
```

Generated adapters call the matching business MCP tools directly; they do not construct CLI `--json` commands or a shell fallback. The canonical project MCP entry routes to `mcp/dove-state-server-package.mjs`. The inventories are distinct: 12 host workflows; separately 16 top-level CLI subcommands, 28 MCP tools, and 60 adapters: 48 checked-in project adapters across OpenCode, Codex, Cursor, and shared agents plus 12 user-level Claude commands. Claude install/sync atomically writes those user command files, merges the canonical Dove entry into the target `.mcp.json`, and records a small project marker used only for doctor host detection. It leaves settings and shell files byte-identical and rejects conflicting, duplicate-key, or unsafe MCP configuration before writing. Doctor keeps static registration separate from Claude's pending/connected/failed state and, once connected, executes the installed package probe to verify the fixed 28-tool registry, `create_dove_mission`, one declined elicitation, and zero workspace writes. `check` and `release:check` include bundle drift validation.

The lessons package surface contains `.dove/lessons` support, `query_dove_lessons`, `record_dove_lesson`, and generated `dove.lessons` adapters. It does not ship retired operator lesson storage or tools, automatic capture/recall hooks, transcript import, Trellis writes, runtime state, or compatibility aliases.
