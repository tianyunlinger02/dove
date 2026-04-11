# paper.source

Register a new source or update an existing one.

## Goal

Keep `.paper/sources/index.json` and `.paper/bibliography/citation-log.md` as the canonical source registry for the paper.

## Workflow

1. Read `.paper/sources/index.json` and `.paper/bibliography/citation-log.md`.
2. If `paper-factory` MCP is available, call `register_source`.
3. Store title, citation key, authors, year, locator, source type, and origin.
4. If any field is uncertain, record the uncertainty instead of hallucinating it.
