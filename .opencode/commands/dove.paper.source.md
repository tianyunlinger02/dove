# dove.paper.source

Register a new source or update an existing one.

## Goal

Keep `.dove/sources/index.json` and `.dove/bibliography/citation-log.md` as the canonical source registry for the paper.

## Workflow

1. Read `.dove/sources/index.json` and `.dove/bibliography/citation-log.md`.
2. If `dove` MCP is available, call `register_source`.
3. Store title, citation key, authors, year, locator, source type, and origin.
4. If any field is uncertain, record the uncertainty instead of hallucinating it.
