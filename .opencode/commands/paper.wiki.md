# paper.wiki

Refresh the durable research memory.

## Goal

Update `.paper/wiki/index.md`, `.paper/wiki/query_pack.md`, `.paper/wiki/navigation.md`, `.paper/wiki/entities.json`, `.paper/wiki/relations.json`, and `.paper/workspace/index.json` so the paper's working memory survives across sessions.

## Workflow

1. Read `.paper/notes/index.json`, `.paper/evidence/index.json`, `.paper/reviews/REVIEW_STATE.json`, and `.paper/findings.md`.
2. If `paper-factory` MCP is available, call `refresh_wiki`.
3. Promote only durable knowledge into the wiki: typed entities/relations, key evidence, reviewer concerns, open questions, unresolved verification items, and task/lineage/workspace navigation surfaces.
4. Keep the wiki concise, typed, and searchable.
