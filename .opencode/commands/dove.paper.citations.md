# dove.paper.citations

Audit citation hygiene for `$CITATION_SCOPE`.

## Goal

Keep `.dove/bibliography/citation-log.md` and `.dove/bibliography/references.bib` aligned with the sources and drafts.

## Workflow

1. Read `.dove/sources/index.json`, `.dove/bibliography/citation-log.md`, `.dove/bibliography/references.bib`, and the target drafts.
2. If `dove` MCP is available, call `sync_citations`.
3. Never invent missing citations from memory.
4. Record unresolved citation gaps explicitly and point back to the source registry.
