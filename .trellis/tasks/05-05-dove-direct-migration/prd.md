# PRD: Dove Direct Migration

## Summary

Make Dove the authoritative product, CLI, MCP identity, operator command model, and durable workspace root. This is a breaking migration: the goal is to preserve capabilities, not old `paper-factory` or `.paper` compatibility.

## Problem

The completed Dove refactor still treats `paper-factory`, `paper.*`, and `.paper/` as compatibility-authoritative. The user now wants a direct Dove system: one product, one root, one command language, and no dual-authority migration layer.

## Goals

- `dove` is the supported package/binary/operator identity.
- `.dove/` is the single authoritative durable root.
- Paper writing remains available as a Dove paper-domain workflow.
- Engineering missions, experiments, reviews, rebuttal/revision, claims/citations, autonomy, and isolated reviewer workflows keep working.
- Multi-host adapters remain available for OpenCode, Claude Code, Cursor, Codex, and shared agents.
- CLI, MCP, commands, docs, validators, tests, governance, and packaging all agree on Dove-direct behavior.

## Non-goals

- Preserve `paper-factory` as a public package or binary.
- Preserve `.paper/` as an authoritative or fallback root.
- Maintain `project:paper.*` compatibility command IDs.
- Auto-import old `.paper/` state at runtime.
- Add hidden daemons, hidden schedulers, or ungoverned autonomy.

## Acceptance Criteria

- Fresh install creates `.dove/` durable state and does not require `.paper/`.
- `dove doctor .` validates Dove authority and reports stale legacy roots as conflicts rather than reading them as state.
- Dove mission query/board/audit/return surfaces report `.dove` as authoritative.
- `dove launch` writes governed mission packets under `.dove/`.
- MCP server identity is Dove and validation passes.
- All host adapters use Dove CLI/MCP/root language.
- Paper-domain capabilities are still documented and tested under Dove.
- `npm run commands:validate`, `npm run mcp:validate`, `npm run governance:audit`, targeted tests, `npm run check`, and `npm run pack:dry-run` pass.
