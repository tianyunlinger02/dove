---
description: "Inspect the current project, formulate or accept one concise research mainline, and replace the current Workspace mainline immediately."
---

# dove.workspace

Inspect the current project, formulate or accept one concise research mainline, and replace the current Workspace mainline immediately.

## Use when

- Inspect the current project, briefly state its overall situation and structure, and write one title-like research mainline immediately.
- Use an explicit user-supplied mainline directly, or formulate one when omitted.

## Examples

- `/dove:workspace`
- `/dove:workspace Retrieval-Augmented Evidence Integrity for Autonomous Research Workflows`

## Workflow

- **The user invokes /dove:workspace, with or without a proposed mainline.**
  1. Call `query_dove_status`. Use operation=status to read the public Workspace state, then use normal host read-only exploration to inspect enough of the current project to briefly introduce its overall situation and structure. Do not produce evidence or risk lists and do not ask questions.
  2. Call `manage_dove_workspace`. Use operation=set-mainline. Pass one brief introduction to the project's overall situation and structure as projectBrief. Prefer an explicit user-supplied mainline; otherwise formulate one clean concise research mainline like a paper title from the inspected project. Apply it immediately. An absent Workspace is initialized; a current Workspace is replaced while internal revision history remains preserved.
- **An unsupported workspace must be explicitly archived before current records are created.**
  1. Call `manage_dove_workspace`. Pass operation=initialize with archiveReset=true and the selected mainline. The archive remains read-only history and is never imported into current runtime state.

## Command guidance

- Inspect the current project briefly, state its overall situation and structure, formulate one clean concise research mainline like a paper title, and call `manage_dove_workspace` immediately. Do not show an evidence list, risk list, choices, elicitation, or confirmation.

## Dove capsule

- Dove MCP tools: `query_dove_status`, `manage_dove_workspace`.
- Use the listed public Dove MCP tools. If they are unavailable, stop and ask the user to re-enter the project host; do not substitute CLI, shell, or direct state access.
- Present only the human `report` when directed. Keep machine channels internal and execute a supplied typed closure once with its binding unchanged.
- Respond concisely in Chinese by default: judgment, evidence or risk, and next action.
