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
- Use only MCP tools already available and approved by the user. If approval is missing, `uvx` is unavailable, or the server fails, say so directly; do not install dependencies or use a CLI or shell fallback for this MCP. This boundary does not forbid other already-approved host web/search tools, local PDFs, URLs, or user-provided material that can still support the source task.
- Do not turn paper identifiers into Dove IDs, hashes, trust scores, ledgers, or database records.
