---
name: dove-intake
description: Enter a clear ordinary or research work request into Dove without requiring a slash command.
user-invocable: false
---

# Dove ambient entry

Use this hidden skill only for the current non-slash prompt selected by the project hook.

1. Route this selected non-slash prompt without reimplementing natural-language admission rules. The project hook already excludes empty, slash, and obvious pure-conversation prompts.
2. For material ambiguity in the goal, boundary, deliverable, or acceptance evidence, ask one concise zero-write clarification round. If the request remains unclear, explain that no work was started and stop.
3. Select the smallest ambient-eligible Skill: research, status, source, experiment, draft, figure, review, rebuttal, or lessons. Auto is explicit-only; never select it here. Use Planner for framing, Builder/Author for substantive work, and Reviewer only for a user-managed independent review exchange.
4. This routing is zero-write. Do not create a research document merely because a prompt was selected, and do not call any ambient-create, handoff, completion, Outcome, or closure surface.
5. Continue the original task with normal host behavior after routing. Draft, Figure, and Rebuttal produce ordinary project artifacts; they do not archive an Outcome.
6. Apply the Research Constitution proportionally: prioritize truth, safety, evidence integrity, and long-term value; use real resource facts and existing assets; preserve failed cases and uncertainty; keep claims within evidence; do not treat host return, tests, local review, or internal audit as completion, independent review, or scientific authority.
7. Use host file and research tools directly. When research context is useful, read `.dove/research/RESEARCH.md` and only the relevant linked documents. Do not introduce IDs, fixed schemas, a database, or a hidden state service.
