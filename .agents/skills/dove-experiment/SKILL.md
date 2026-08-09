---
name: dove-experiment
description: "Design, freeze, execute with host tools, and record experiments and supported claims."
---

# Dove Experiment

Design, freeze, execute with host tools, and record experiments and supported claims.

## Use when

- Design, freeze, execute with host tools, and record experiments and supported claims.

## Examples

- `/dove:experiment`

## Workflow

- **The user requests experiment design, execution, analysis, or recording.**
  1. Call `query_dove_research` (read-only). Read hypotheses, experiment options, or result context when available. No durable Dove write is required.
  2. Use host tools (work; experiment-execution). Design the smallest discriminating experiment and execute it with normal host tools. Preserve raw outputs, failures, denominator accounting, deviations, bias, and uncertainty. No durable Dove write is required.
  3. Call `manage_dove_experiments` (bounded). Freeze a plan before execution and record the full result only when a durable experiment record is needed. Persist only when: durable-experiment-record.
  4. Call `manage_dove_claims` (bounded). Record or revise only claims supported by the observed evidence, including counter-evidence, missing evidence, and cannot-say boundaries. Persist only when: durable-claim-update.
  - Clarification: Explore first. Ask one brief clarification only if material ambiguity in the goal, boundary, or deliverable remains; otherwise continue within the requested boundary.

## Dove capsule

- Dove MCP tools: `query_dove_research`, `manage_dove_experiments`, `manage_dove_claims`.
- Use only the eight public Dove MCP research tools for durable Dove state; never read or write `.dove` directly.
- Use semantic IDs only when durable records are needed, and do not create a Workspace or Mission merely because a Skill was invoked.
- Treat tests, host output, local review, and imported review as bounded evidence rather than completion or scientific authority.
