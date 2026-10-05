# Hook Guidelines

This file governs Dove's installed host integration, not this repository's Trellis development hooks. Sources and projections are mapped in [Directory Structure](./directory-structure.md).

## Host integration

Claude Code receives the Dove rule, nine flat Skills, author-side Dove agent, and two read-only subagents: `dove-mentor` and `dove-review`. DeepSeek Harness receives filesystem Skills only; do not imply that it has Claude's agents or hooks. Hosts enforce permissions. Guidance does not grant access.

Dove owns only manifest-listed fragments: paper-search and Exa MCP declarations, the built-in `WebFetch` deny entry, its hooks, and a `statusLine` installed only in an empty slot. Preserve unrelated settings and user status lines. Tool approval, trust, credentials, and runtime availability remain host/user responsibilities. Do not substitute shell retrieval for unavailable web tools.

## SessionStart and prompt context

- Invoke installed `dove` on `PATH`, not a copied runtime or installation-specific path.
- Inspect the initialized project's manifest read-only. Stale integration gets an explicit `dove update` suggestion; ambiguous state needs `dove doctor --json`. Hooks never install, migrate, normalize, or write research records.
- Startup and `/clear` ask the current main agent to personally read the short preference and quality essentials. Full companions are on demand. Compact/resume reuses that reading and presents the identity card and current-round reminder.
- `UserPromptSubmit` presents the current researcher-owned identity card when integration is current; otherwise it emits a nonblocking attention message. It does not classify prompts, choose work, grant permissions, or apply corrections itself.
- Cards over 4096 bytes retain their UTF-8-safe beginning and get a shortening reminder, never a false “missing card” message. Keep `Mainline`, `Current round`, and `Round status` near the beginning; read the full card when needed. Round details belong in `rounds/`, measurements in `EVAL.md`.
- Hook delivery is not proof of reading, behavior, or host-level reloading. Global installation may sync registered projects independently; SessionStart does not trigger that sync.

## One Stop reminder

The managed Stop hook blocks once only when the identity card points to an ongoing round and the current main-session turn has not called `dove-mentor`. `stop_hook_active: true` always passes. Its only message asks the executor to write the round result and call the mentor. If the user says “discussion only” or “stop”, the main session marks the round paused and ends normally.

The hook reads the card and current-session transcript event/tool metadata to recognize a mentor call, not to judge conversation content. It sends no transcript to either subagent and writes no tracking state. Missing or unreadable context passes. There is no scheduler, Cron wake, per-tool research gate, or persistent continuation service.

## Read-only status line

Install `dove hook statusline --project "$CLAUDE_PROJECT_DIR"` only when the slot is empty. Preserve the absolute project path and bounded no-shell Git branch lookup. Show only available native model/context/session facts, the card's confirmed Mainline, and current-round number when present; absent facts are omitted, not invented. The second line is the project path. A nonempty `NO_COLOR` disables color.

Keep rendering fast, offline, and read-only. Do not scan the research tree, infer the Mainline from Git or old records, or turn software/session facts into research progress. Doctor reports managed drift; lifecycle removal preserves user-modified fragments. See [State Management](./state-management.md) for historical preservation.
