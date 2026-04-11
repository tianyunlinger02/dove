# paper.citations

Audit citation hygiene for `$CITATION_SCOPE`.

## Goal

Keep `.paper/bibliography/citation-log.md` and `.paper/bibliography/references.bib` aligned with the sources and drafts.

## Workflow

1. Read `.paper/sources/index.json`, `.paper/bibliography/citation-log.md`, `.paper/bibliography/references.bib`, and the target drafts.
2. If `paper-factory` MCP is available, call `sync_citations`.
3. Never invent missing citations from memory.
4. Record unresolved citation gaps explicitly and point back to the source registry.
