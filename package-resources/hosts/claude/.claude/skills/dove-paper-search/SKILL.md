---
name: dove-paper-search
description: Search, retrieve, and read academic papers through the approved dove-paper-search project MCP when scholarly material is relevant.
user-invocable: false
---

# Dove Paper Search

Use the `dove-paper-search` project MCP only when academic paper discovery, retrieval, or full-text reading materially helps the current request.

- Keep searches bounded and choose relevant scholarly sources instead of searching every provider by default.
- Download or read full text only when the task needs it. Distinguish material merely found, downloaded, or actually read, and report saved paths when useful.
- Prefer source-native open download and read tools. If `download_with_fallback` is needed, always pass `use_scihub: false` explicitly. Do not call Sci-Hub tools.
- Use only MCP tools already available and approved by the user. If approval is missing, `uvx` is unavailable, or the server fails, say so directly; do not install dependencies or substitute a CLI, shell, `curl`, or ad hoc fetch script for this MCP. Continue with any other approved route that can still advance the question, such as `WebSearch` discovery, Exa webpage reading, local project material, user-provided material, theory, experiment, or analysis, while clearly distinguishing those results from a paper retrieved or read through this MCP.
- Keep this path for scholarly papers. Use built-in `WebSearch` for discovery when appropriate, and use the project `exa` MCP for ordinary webpage bodies, documentation pages, venue pages, and known URLs outside the paper-acquisition path.
- Do not turn paper identifiers into Dove IDs, hashes, trust scores, ledgers, or database records.
