# dove.paper.wiki

Refresh the durable research memory.

## Goal

Update `.dove/wiki/index.md`, `.dove/wiki/query_pack.md`, `.dove/wiki/navigation.md`, `.dove/wiki/entities.json`, `.dove/wiki/relations.json`, and `.dove/workspace/index.json` so the paper's working memory survives across sessions.

## Workflow

1. Read `.dove/notes/index.json`, `.dove/evidence/index.json`, `.dove/reviews/REVIEW_STATE.json`, and `.dove/findings.md`.
2. If `dove` MCP is available, call `refresh_wiki`.
3. Promote only durable knowledge into the wiki: typed entities/relations, key evidence, reviewer concerns, open questions, unresolved verification items, and task/lineage/workspace navigation surfaces.
4. Keep the wiki concise, typed, and searchable.
