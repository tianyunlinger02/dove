---
name: dove-web-reader
description: Read ordinary webpages and known URLs through the approved Exa hosted project MCP when webpage content is relevant.
user-invocable: false
---

# Dove Web Reader

Use the `exa` hosted project MCP only when ordinary webpage body retrieval, crawling, or a known URL materially helps the current request.

- Keep built-in `WebSearch` available for web discovery and search-result triage; do not substitute webpage retrieval for search.
- Use the pinned `dove-paper-search` project MCP for scholarly paper search, download, and full-text reading. Use `exa` for ordinary webpages, documentation pages, venue pages, and known URLs outside the paper-acquisition path.
- Do not use built-in `WebFetch`; Claude project permissions deny it so webpage body retrieval goes through `exa`.
- Use only MCP tools already available and approved by the user. If approval is missing, Exa is unavailable, or the server fails, say so directly; do not use CLI, shell, `curl`, Node/Python fetch scripts, or built-in `WebFetch` instead. Continue with any other approved route that can still advance the question, such as `WebSearch` discovery, the paper MCP, local project material, user-provided material, experiment, or analysis, while clearly distinguishing those results from an Exa webpage read.
- Do not turn URLs into Dove IDs, hashes, trust scores, ledgers, or database records.
