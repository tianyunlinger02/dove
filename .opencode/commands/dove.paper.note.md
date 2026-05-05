# dove.paper.note

Capture a structured note for `$NOTE_TITLE`.

## Goal

Write durable, source-linked notes into `.dove/notes/index.json` and keep the query pack current.

## Workflow

1. Read `.dove/sources/index.json`, `.dove/notes/index.json`, and `.dove/wiki/query_pack.md`.
2. If `dove` MCP is available, call `upsert_note`.
3. Record section intent, source IDs, summary, quotes, candidate claims, and open questions.
4. When the note should be created through bounded autonomy, carry the same payload through an approved program run with `allowedStepType: upsert-note` and existing `sourceIds` only.
