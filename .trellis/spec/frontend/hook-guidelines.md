# Hook Guidelines

This file governs **Dove product integration** in consumer projects, not this repository's Trellis development hooks or subagents. Canonical sources and packaged projections are mapped in [Directory Structure](./directory-structure.md).

## Host integration

Claude Code receives the complete Dove integration; DeepSeek Harness receives project-local filesystem Skills only, without Claude permissions, hooks, or MCP projection. Hosts route work and enforce permissions; the shared research rule is guidance, not a router or permission grant. Research/delegation responsibilities belong in [Component Guidelines](./component-guidelines.md).

Claude integration owns only the documented `.mcp.json#/mcpServers/dove-paper-search` and `.mcp.json#/mcpServers/exa` fragments, plus project-scoped `permissions.deny` for built-in `WebFetch`. Pinned paper search serves scholarly discovery, download, and full-text reading; hosted Exa serves ordinary webpages, documentation, venue pages, and known URLs. Built-in `WebSearch` remains available for discovery. Hidden guidance Skills do not grant tool access. Runtime dependencies, project trust, tool approval, access, and credentials remain user-provided; do not substitute CLI/shell/`curl`/fetch scripts for unavailable web retrieval. These external tools are not Dove research-state services.

## Product SessionStart synchronization

- Invoke user-installed `dove` on `PATH`, not a copied runtime or absolute installation path.
- Validate the exact initialized project and same-package manifest revision `2.0` before planning writes.
- Skip manifest-owned local edits, retain their ownership metadata, synchronize other safe resources, and report skipped paths through `systemMessage`. Do not claim skipped files are current.
- Unsafe synchronization errors stop writes and return a `systemMessage` where possible. Apply the [transaction rules](./type-safety.md); preserve all [research and project records](./state-management.md). Do not adopt legacy state or perform Complete Reinstall.
- Disk synchronization does not reload already-active Claude context.

## Compact/resume facts card

Only `compact` and `resume` emit these read-only facts:

1. `RESEARCH.md` existence and absolute mtime;
2. latest Review by `updatedAt`: id, current round, absolute update time, material currentness;
3. latest Run by `startedAt`: id, absolute start time, status, exit code.

Missing/unreadable facts stay `unavailable`. Startup/clear emits no research card, though synchronization notices may appear. Read review metadata and run journals; compare the latest round's listed project files with its snapshot receipt for currentness. Do not read research Markdown bodies, reports, or stdout/stderr logs, interpret verdicts, summarize research, choose actions, or infer the mainline. Latest means record time, not importance; visible conversation and relevant materials determine continuation.

## Retired product integration

Dove installs no `UserPromptSubmit`, hidden intake, replacement per-prompt hook, or Stop scheduler. Stop must not manufacture another research turn or write research state. Lifecycle refresh removes only array entries exactly matching retired Dove-owned prompt/Stop fragments, preserving unrelated user/Trellis hooks and non-array settings.

Dove does not install/manage `statusLine`. The retained `dove hook statusline` helper is only for user-owned composition scripts. Retirement releases old ownership and removes an exact old Dove line while preserving user-modified lines. Read-only Doctor may identify exact attributable retired remnants by location/reason; it must not expand deletion authority, scan global settings, or certify custom hooks clean.
