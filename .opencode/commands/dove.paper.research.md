# dove.paper.research

Advance the durable research brief, agenda, sources, and notes.

## Goal

Keep `.dove/research/brief.md`, `.dove/research/agenda.json`, `.dove/sources/index.json`, and `.dove/notes/index.json` aligned with the current paper objective.

## Workflow

1. Read `.dove/orchestration/board.json`, `.dove/research/brief.md`, `.dove/research/agenda.json`, `.dove/sources/index.json`, and `.dove/notes/index.json`.
2. If `dove` MCP is available, use `update_research_brief`, `register_source`, and `upsert_note`.
3. Keep evidence gaps and comparison targets explicit rather than smoothing them over.
4. Return the strongest next claim-gate or experiment-planning action.
