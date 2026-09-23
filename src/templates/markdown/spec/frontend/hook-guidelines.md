# Hook Guidelines

This file governs **Dove product integration** in consumer projects, not this repository's Trellis development hooks or subagents. Canonical sources and packaged projections are mapped in [Directory Structure](./directory-structure.md).

## Host integration

Claude Code receives the complete Dove integration; DeepSeek Harness receives project-local filesystem Skills only, without Claude permissions, hooks, or MCP projection. Hosts route work and enforce permissions; the shared research rule is guidance, not a router or permission grant. Research/delegation responsibilities belong in [Component Guidelines](./component-guidelines.md).

Claude integration owns only the documented `.mcp.json#/mcpServers/dove-paper-search` and `.mcp.json#/mcpServers/exa` fragments, project-scoped `permissions.deny` for built-in `WebFetch`, and a `statusLine` fragment when that setting was empty at installation. Pinned paper search serves scholarly discovery, download, and full-text reading; hosted Exa serves ordinary webpages, documentation, venue pages, and known URLs. Built-in `WebSearch` remains available for discovery. Hidden guidance Skills and status display do not grant tool access. Runtime dependencies, project trust, tool approval, access, and credentials remain user-provided; do not substitute CLI/shell/`curl`/fetch scripts for unavailable web retrieval. These external tools are not Dove research-state services.

## Read-only product SessionStart

- Invoke user-installed `dove` on `PATH`, not a copied runtime or absolute installation path.
- Inspect the exact initialized project and same-package manifest revision `2.0` without writing files or shared configuration.
- If integration is not current, report a `systemMessage` suggesting explicit `dove update`; unsupported or ambiguous state needs `dove doctor --json` and manual resolution. Never update, adopt, migrate, clean up, or reinstall from the hook.
- Startup and `/clear` emit a small author-preference bootstrap after valid inspection, even without an integration warning. It requires the current host main agent—ordinary Claude or explicit Dove—to personally read the full installed reference before substantive work; it does not embed the body or delegate the read. Compact/resume may additionally emit the read-only facts below plus continuity guidance, without an unconditional full reread.
- Inspection and bootstrap delivery cannot verify reading or retroactively reload already-active Claude context. npm global `postinstall` may independently synchronize registered projects during an upgrade; SessionStart itself stays read-only and never triggers that sync.

## Compact/resume facts card

Only `compact` and `resume` emit these read-only facts:

1. `RESEARCH.md` existence and absolute mtime;
2. latest Review by `updatedAt`: id, current round, absolute update time, material currentness;
3. latest Run by `startedAt`: id, absolute start time, status, exit code.

Missing/unreadable facts stay `unavailable`. Startup/clear emits the separate author-preference bootstrap, not a research card; read-only integration warnings may also appear. Compact/resume continues using preferences already read in the same main context and only repairs a clearly missing bootstrap. Read review metadata and run journals; compare the latest round's listed project files with its snapshot receipt for currentness. Do not read research Markdown bodies, reports, or stdout/stderr logs, interpret verdicts, summarize research, choose actions, or infer the mainline. Latest means record time, not importance; visible conversation and relevant materials determine continuation.

## Read-only status line

- When a Claude project has no existing `statusLine`, install the manifest-owned command `dove hook statusline --project "$CLAUDE_PROJECT_DIR"`. A pre-existing user or Trellis line remains unchanged and unowned; an empty slot may be filled by a later explicit update.
- Preserve the explicit absolute project path. Consume only Claude Code's native status payload for model display name, total context capacity, remaining-context percentage, and current-session duration, and read the Git branch from that project root with a bounded no-shell command. Missing host facts are omitted rather than represented as zero.
- Keep the renderer fast, read-only, and offline. The first line keeps model/context/branch/session facts and replaces the project-path slot with the mainline text in cyan, without a label; only a nonempty `NO_COLOR` disables color. The second line is only the absolute project path. Read only the root `.dove/research/RESEARCH.md`, bounded to 64 KiB, for one ordinary top-level `Mainline: <text>` line; ignore frontmatter and fenced examples. Missing, empty, duplicate, oversized, or unreadable sources omit the mainline, with no placeholder or inference from other prose, Git, Mission, Run, or Review. Do not scan the research tree or access Review, Run, transcript, or durable timer content. Git branch remains an active work branch, not a confirmed scientific mainline; session duration is not cumulative research effort. This narrow display read does not change SessionStart.
- Doctor inspects managed drift read-only. Explicit update/reinstall may restore an edited manifest-owned line and report it; host removal/uninstall removes an unchanged owned line while preserving a user-modified one.

## Short per-prompt re-anchor

Claude's managed `UserPromptSubmit` emits a deterministic short re-anchor on every prompt. It does not classify prompts, read or write research material, make permission decisions, block submission, or call a model or tools to select work. Research judgment stays in the main agent under the shared rule; no Research Spine schema or ledger follows. SessionStart's inspection, bootstrap, and compact/resume facts card remain unchanged. DSH remains filesystem Skills only. After installation or update, reload an active host session to load changed integration; disk bytes do not establish live loading.

## Prohibited and retired product integration

Dove installs no hidden intake, ambient router, Stop scheduler, or per-tool scientific approval. Stop must not manufacture another research turn or write research state. Explicit lifecycle operations remove a retired prompt fragment only when still manifest-owned and digest-matching. Unowned legacy Stop/prompt entries and unknown files remain untouched; diagnostic recognition is not deletion authority.
