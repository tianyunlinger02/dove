---
name: dove-lessons
description: "Read or replace the complete canonical advisory Lessons document."
---

# Dove Lessons

Read or replace the complete canonical advisory Lessons document.

## Use when

- Read the complete current Lessons document.
- For an explicit change, read first and update the complete Markdown once with the exact returned binding.

## Examples

- `/dove:lessons`
- `/dove:lessons Remember that failed cases must remain visible`

## Workflow

- **Read is the default.**
  1. Call `manage_dove_lessons`. Use operation=read and return the complete human Markdown report. Keep the returned document control in hostControl private.
- **The user explicitly asks to preserve or revise reusable experience.**
  1. Call `manage_dove_lessons`. Use operation=read. Preserve the complete Markdown and exact hostControl.lessonsDocument.binding.
  2. Call `manage_dove_lessons`. Use operation=update with the exact binding unchanged and the complete replacement Markdown containing the five stable sections. Create no Mission and do not treat Lessons as evidence, scientific endorsement, or completion proof.
  - Clarify only if needed: Ask once only if the intended reusable guidance is materially ambiguous.

## Command guidance

- Read the complete canonical Lessons document by default. For an explicit update, read first, preserve the exact machine-only binding, edit the complete Markdown under the five stable sections, and update once without creating a Mission.

## Dove capsule

- Dove MCP tools: `manage_dove_lessons`.
- Use the listed public Dove MCP tools. If they are unavailable, stop and ask the user to re-enter the project host; do not substitute CLI, shell, or direct state access.
- Present only the human `report` when directed. Keep machine channels internal and execute a supplied typed closure once with its binding unchanged.
- Respond concisely in Chinese by default: judgment, evidence or risk, and next action.
