# Hook Guidelines

This file governs Dove's installed host integration, not this repository's Trellis development hooks. Sources and projections are mapped in [Directory Structure](./directory-structure.md).

## Host integration

Claude Code receives the Dove rule, nine flat Skills, author-side Dove agent, and two read-only subagents: `dove-mentor` and `dove-review`. DeepSeek Harness receives filesystem Skills only; do not imply that it has Claude's agents or hooks. Hosts enforce permissions. Guidance does not grant access.

Dove owns only manifest-listed fragments: paper-search and Exa MCP declarations, the built-in `WebFetch` deny entry, SessionStart/UserPromptSubmit context hooks, and a `statusLine` installed only in an empty slot. Preserve unrelated settings and user hooks/status lines. Retired Stop cleanup follows [lifecycle ownership](./state-management.md#lifecycle-preservation), not a runtime hook. Tool approval, trust, credentials, and runtime availability remain host/user responsibilities. Do not substitute shell retrieval for unavailable web tools.

## SessionStart and prompt context

- Invoke installed `dove` on `PATH`, not a copied runtime or installation-specific path.
- Inspect the initialized project's manifest read-only. Stale integration gets an explicit `dove update` suggestion; ambiguous state needs `dove doctor --json`. Hooks never install, migrate, normalize, or write research records.
- Startup and `/clear` ask the current main agent to personally read the short preference and quality essentials. Full companions are on demand. Compact/resume reuses that reading and presents the identity card and current-round reminder.
- `UserPromptSubmit` verifies current guidance files and presents their version/fingerprints with the identity card; changed or missing guidance gets a nonblocking warning. Preserved local status-line or MCP configuration does not invalidate guidance. SessionStart and UserPromptSubmit expose only the host's `transcript_path` source pointer for mentor handoff; they do not copy history, classify intent, choose work, grant permissions or apply corrections.
- Cards over 4096 bytes retain their UTF-8-safe beginning and get a shortening reminder, never a false “missing card” message. Keep `Mainline`, `Current round`, and `Round status` near the beginning; read the full card when needed. Round details belong in `rounds/`, measurements in `EVAL.md`.
- With user-level `hostMigration` enabled (default off), upgrades register versioned pending tasks; both hooks deliver them read-only for the host to handle after current work, without stopping jobs or changing conclusions/user originals. Completion removes the pending file; the same version is not re-registered. Delivery proves neither completion nor live reloading.

## Original-user source handoff

The main session specifies the host transcript source path, last-read date/range and the current user's original text, which may not yet be persisted, to a fresh read-only mentor. When invoked, the mentor uses Grep/Read to select genuine user records: in date order at kickoff/takeover, or since the preceding round for a later judgment. Read only genuine user-authored bodies, not meta messages, subagent conversations, assistant/executor text, tool results, host/system injections or self-wake summaries, even if wrapped in a user event. This is scoped reading, not inheritance or automatic parsing of the full parent conversation; do not resume an old mentor context, harvest other transcripts or build a source ledger. Source, dates and the last-read/since-previous-round range live in the brief. Inaccessible sources mean unknown provenance, not permission to invent quotes, revoke confirmed restrictions or override host refusals. `dove-review` receives no transcript access.

Hooks expose a source pointer only; they do not interpret user intent, collect conversation copies or write research state. A mentor may suggest a user-initiated `/clear` when prohibitions dominate context, but neither mentor nor hook clears it automatically.

## Read-only status line

Install `dove hook statusline --project "$CLAUDE_PROJECT_DIR"` only when the slot is empty. Preserve the absolute project path and bounded no-shell Git branch lookup. Show only available native model/context/session facts, the card's confirmed Mainline, and current-round number when present; absent facts are omitted, not invented. The second line is the project path. A nonempty `NO_COLOR` disables color.

Keep rendering fast, offline, and read-only. Do not scan the research tree, infer the Mainline from Git or old records, or turn software/session facts into research progress. Doctor reports managed drift; lifecycle removal preserves user-modified fragments. See [State Management](./state-management.md) for historical preservation.
