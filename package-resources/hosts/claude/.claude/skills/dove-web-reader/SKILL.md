---
name: dove-web-reader
description: Read ordinary webpages and known URLs through the hosted Exa project MCP when webpage content is relevant and the current host exposes it and current user/project permissions permit it.
user-invocable: false
---

# Dove Web Reader

Use the `exa` hosted project MCP only when ordinary webpage body retrieval, documentation page reading, venue page reading, crawling, or a known URL materially helps the current request and the current host exposes Exa and current user/project permissions permit it.

- Keep built-in `WebSearch` available for web discovery and search-result triage; do not substitute webpage retrieval for search.
- Use the pinned `dove-paper-search` project MCP for academic paper discovery, download, and full-text reading when that MCP is exposed and current user/project permissions permit it. Use `exa` for ordinary webpage bodies, documentation pages, venue pages, and known URLs outside academic paper acquisition when Exa is exposed and current user/project permissions permit it.
- Do not use built-in `WebFetch`; Claude project permissions deny it so webpage body retrieval goes through `exa`.
- Use only MCP tools that the current host actually exposes and current user/project permissions permit. If current user/project permissions do not permit it, Exa is unavailable, or the server fails, state that the ordinary webpage body, documentation page, venue page, or known URL was not obtained through Exa, then choose any exposed and permitted material or action that can still advance the question: `WebSearch` discovery snippets, `dove-paper-search` academic paper discovery/download/full text when exposed, local project material, user-provided material, theory, experiment, or analysis. Do not use CLI, shell, `curl`, Node/Python fetch scripts, or built-in `WebFetch` instead, and do not follow a fixed substitute sequence.
- Do not turn URLs into Dove IDs, hashes, trust scores, ledgers, or database records.
