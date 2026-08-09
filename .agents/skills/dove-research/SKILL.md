---
name: dove-research
description: "Route workspace and mission research, internal synthesis, and bounded project work."
---

# Dove Research

Route workspace and mission research, internal synthesis, and bounded project work.

## Use when

- Route workspace and mission research, internal synthesis, and bounded project work.

## Examples

- `/dove:research`

## Workflow

- **The user requests research framing, investigation, synthesis, or bounded project work.**
  1. Call `query_dove_research` (read-only). Request the smallest zero-write projection, normally overview or a relevant view. Treat status=absent and an empty Mission inventory as normal branchable states. No durable Dove write is required.
  2. Use host tools (read-only; project-exploration). When the Workspace is absent, there are no Missions, or no relevant Mission exists, inspect only ordinary project material outside `.dove`—such as README, docs, source, tests, configuration, results, and existing artifacts—to form a provisional research frame. No durable Dove write is required.
  3. Use host tools (work; research-work). Continue the bounded research or project investigation with normal host tools, preserving uncertainty and recording actual evidence. Do not initialize a Workspace or create a Mission automatically. No durable Dove write is required.
  4. Call `manage_dove_workspace` (bounded). Initialize or update the research direction only when the user explicitly requests durable Workspace maintenance and provides the required research frame. Persist only when: explicit-workspace-maintenance.
  5. Call `manage_dove_missions` (bounded). Create, branch, or conclude a Mission only when the user explicitly needs a durable research node; otherwise leave Dove state unchanged. Persist only when: explicit-durable-mission.
  - Clarification: Explore first. Ask one brief clarification only if material ambiguity in the goal, boundary, or deliverable remains; otherwise continue within the requested boundary.

## Dove capsule

- Dove MCP tools: `query_dove_research`, `manage_dove_workspace`, `manage_dove_missions`.
- Use only the eight public Dove MCP research tools for durable Dove state; never read or write `.dove` directly.
- Use semantic IDs only when durable records are needed, and do not create a Workspace or Mission merely because a Skill was invoked.
- Treat tests, host output, local review, and imported review as bounded evidence rather than completion or scientific authority.
