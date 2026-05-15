# dove-auto

Convert demand like mission intake, then after confirmation run multi-round foreground autonomy until completion or a boundary is reached.

## Daily use

- Use this when the user wants Dove to continue through bounded foreground iterations after the same demand-to-task intake as mission.
- Start from a new demand or an existing durable task; auto should propose concrete safe steps before consuming the iteration budget.
- Targeting: Selects an existing packet when the target is clear, otherwise proposes a new task contract.
- Confirmation: Require explicit approval of the selected/proposed task, max iteration budget, and concrete foreground steps.
- Outcome: Each foreground iteration is recorded in runtime results and stops at completion, blocker, review/provider boundary, or budget exhaustion.

## Contract

- Command id: `dove.auto`
- Domain: `generic`
- Category: `mutation`
- Policy: `explicit-approval`

## Guardrails

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Follow Dove's response language preference from `.dove/config.json`, `.dove/config.local.json`, or `.dove/state.json.settings.responseLanguage`; supported values are `zh` for Chinese and `en` for English, and the default is `zh`.
3. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/config.json`, `.dove/config.local.json`, `.dove/state.json`, `.dove/task-packets/index.json`, `.dove/runtime`, `.dove/meta/operator-lessons.json`.
4. Prefer the `run_dove_auto` MCP tool when available.
5. Require explicit operator approval before creating or changing durable workflow state or consuming bounded authority.
6. Use the same demand-to-task intake and classification model as `/dove:mission` before autonomous execution starts.
7. Allow `/dove:auto` to be invoked directly on a new user demand or an existing durable task; it does not require running `/dove:mission` first.
8. Return a proposal-only auto contract first: either a converted `proposedTask` with checklist proposal or a `selectedTask` from durable packet selection, plus confirmation args and max iteration budget.
9. Use interactive confirmation controls when the host supports them (for example Claude Code AskUserQuestion) before passing `confirmed: true`; options should approve and run bounded auto, adjust target/contract, or cancel.
10. When an existing task target is missing or ambiguous, present indexed packet choices through confirmation UX instead of guessing.
11. Require explicit operator confirmation before execution beyond task creation or selection.
12. Run in the current foreground call only; do not schedule background or daemon continuation after the response ends.
13. Use `.dove/state.json.settings.auto.maxIterations` as the default foreground iteration limit; the default is 3.
14. Record each foreground iteration and stop reason in `.dove/runtime/results.json`.
15. May internally call public Dove workflows such as source, note, experience, figure, draft, review, review-loop, rebuttal, lessons, and status as needed.
16. Stop at completed, blocked, killed, authority/review boundary, missing provider credentials, conflicting packet target, or step-budget exhaustion.
17. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
18. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
19. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
