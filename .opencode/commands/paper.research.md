# paper.research

Advance the durable research brief, agenda, sources, and notes.

## Goal

Keep `.paper/research/brief.md`, `.paper/research/agenda.json`, `.paper/sources/index.json`, and `.paper/notes/index.json` aligned with the current paper objective.

## Workflow

1. Read `.paper/orchestration/board.json`, `.paper/research/brief.md`, `.paper/research/agenda.json`, `.paper/sources/index.json`, and `.paper/notes/index.json`.
2. If `paper-factory` MCP is available, use `update_research_brief`, `register_source`, and `upsert_note`.
3. Keep evidence gaps and comparison targets explicit rather than smoothing them over.
4. Return the strongest next claim-gate or experiment-planning action.
