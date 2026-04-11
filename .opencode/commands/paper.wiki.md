# paper.wiki

Refresh the durable research memory.

## Goal

Update `.paper/wiki/index.md` and `.paper/wiki/query_pack.md` so the paper's working memory survives across sessions.

## Workflow

1. Read `.paper/notes/index.json`, `.paper/evidence/index.json`, `.paper/reviews/REVIEW_STATE.json`, and `.paper/findings.md`.
2. If `paper-factory` MCP is available, call `refresh_wiki`.
3. Promote only durable knowledge into the wiki: key evidence, reviewer concerns, open questions, and unresolved verification items.
4. Keep the wiki concise and searchable.
