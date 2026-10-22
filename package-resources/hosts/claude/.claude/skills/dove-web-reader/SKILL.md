---
name: dove-web-reader
description: Read webpages and known URLs whose content matters to the current work, through the hosted Exa MCP when it is available and otherwise through WebFetch or a direct download.
user-invocable: false
---

# Dove Web Reader

Read the actual page when its content matters to the current work.

- Use `WebSearch` to find pages, then read the ones that matter. Use the `exa` MCP for page bodies when it is available; when it is missing, out of quota or failing, use `WebFetch`, and for PDFs or pages WebFetch cannot render, download them with `curl` or `wget` and read the file.
- For academic papers, prefer the `dove-paper-search` MCP; the same fallbacks apply when it fails.
- Say what you actually read: the full page, a downloaded PDF, or only a search snippet. A judgment that rests on a snippet or an abstract says so.
