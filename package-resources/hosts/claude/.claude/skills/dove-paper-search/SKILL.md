---
name: dove-paper-search
description: Search, retrieve, and read academic papers through the pinned dove-paper-search project MCP when scholarly material is relevant and the current host exposes it and current user/project permissions permit it.
user-invocable: false
---

# Dove Paper Search

Use the pinned `dove-paper-search` project MCP only when academic paper discovery, retrieval, or full-text reading materially helps the current request and the current host exposes that MCP and current user/project permissions permit it.

- Keep searches bounded and choose relevant scholarly sources instead of querying every available index or service by default.
- Download or read full text only when the task needs it. Distinguish material merely found, downloaded, or actually read, and report saved paths when useful.
- Prefer source-native open download and read tools. If `download_with_fallback` is needed, always pass `use_scihub: false` explicitly. Do not call Sci-Hub tools.
- Use only MCP tools that the current host actually exposes and current user/project permissions permit. If current user/project permissions do not permit it, `uvx` is unavailable, or the server fails, state that the academic paper discovery, download, or full text was not obtained through `dove-paper-search`, then choose any exposed and permitted material or action that can still advance the question: `WebSearch` discovery snippets, Exa ordinary webpage/documentation/venue/known-URL text when exposed, local project material, user-provided material, theory, experiment, or analysis. Do not install dependencies or substitute a CLI, shell, `curl`, or ad hoc fetch script for this MCP, and do not follow a fixed substitute sequence.
- Keep `dove-paper-search` for scholarly paper acquisition. Use built-in `WebSearch` for discovery when appropriate, and use the project `exa` MCP for ordinary webpage bodies, documentation pages, venue pages, and known URLs outside academic paper acquisition when Exa is exposed and current user/project permissions permit it.
- Do not turn paper identifiers into Dove IDs, hashes, trust scores, ledgers, or database records.
