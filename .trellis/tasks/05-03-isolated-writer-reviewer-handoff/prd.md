# brainstorm: isolated writer/reviewer handoff

## Goal

Design a physically isolated writer/reviewer workflow for `paper_factory` so the main process can delegate evaluation to a separate background process whose private conversational context is not shared back to the main process. The only intended exchange should be through explicit handoff artifact paths, simulating a real writing/review process where the author and reviewer do not share private memory.

## What I already know

* The user wants stronger isolation than role prompts or shared `.paper/` state can provide.
* The concern is "既当裁判，又当选手": the same model/session drafting and reviewing can self-justify.
* Desired model: main process dispatches a background evaluator process; evaluator private memory is not shared to main process; results come back only through a handoff path.
* Existing `paper_factory` already has durable `.paper/orchestration/handoffs.md`, `.paper/reviews/*`, `.paper/context/*`, and explicit foreground autonomy surfaces.
* Existing design intentionally avoids hidden schedulers/daemons; any isolation workflow should remain explicit and auditable.

## Assumptions (temporary)

* The MVP should use local filesystem artifacts for exchange rather than hidden in-process memory.
* The reviewer should read an allowlisted artifact bundle, write a review report/handoff file, and not mutate drafts directly.
* The main process may launch or instruct a separate process, but should not ingest the reviewer's full private transcript.

## Open Questions

* Where should the default reviewer command be configured so slash-command usage does not require passing a long command every time?

## Requirements (evolving)

* Provide a workflow where writer and reviewer communicate only through explicit handoff paths.
* Expose the primary UX as a slash command, not as a CLI-first workflow.
* The slash command should trigger the isolated reviewer run in the background or subprocess, wait for completion for the current invocation, then return the review result summary to the user.
* Use a generic external reviewer command protocol for the MVP, not a Claude/OpenCode-specific launcher.
* Support a parallel-session isolation model: writer/main session and reviewer session are separate contexts that do not see each other's private transcripts.
* The user may act as editor/mediator and explicitly coordinate the sessions, but coordination should happen through declared handoff artifacts or recorded mediator notes rather than hidden transcript sharing.
* Main process writes an isolated input bundle under `.paper/reviews/isolated/<run-id>/input.json`.
* Input bundles should be treated as frozen review submissions unless the mediator explicitly records a clarification/amendment artifact for the reviewer.
* External reviewer receives declared input/output paths and writes `.paper/reviews/isolated/<run-id>/handoff.json` plus an optional `report.md`.
* Main/writer session imports only declared handoff/report artifacts, not reviewer private transcript or conversational context.
* Preserve review provenance: input bundle path, output report path, reviewer identity, timestamp, reviewed artifact paths, verdict, status, and action items.
* Preserve tamper evidence for the review exchange: input manifest/hash at prepare time, handoff/output hash at import time, and importer checks that the handoff references the expected run/input.
* Avoid reviewer direct edits to draft/source/claim artifacts in the MVP.

## Acceptance Criteria (evolving)

* [ ] A user can invoke a slash command to request an isolated review for a draft/workspace bundle.
* [ ] The slash command triggers the underlying isolated review runner and returns a concise completion summary with verdict, top concerns, report path, and handoff path.
* [ ] The reviewer receives only a declared input bundle path or allowlisted files.
* [ ] The main process receives only the declared output/handoff artifact, not the reviewer's private transcript.
* [ ] Review output is durable under `.paper/reviews/isolated/<run-id>/` and visible through normal review/handoff surfaces after import.
* [ ] The reviewer command protocol is host-neutral and can be tested with a fake local reviewer command.
* [ ] Existing non-isolated review-loop behavior remains available.

## Decision (ADR-lite)

**Context**: The user wants physical writer/reviewer isolation so the same main session does not act as both author and judge through shared private context.

**Decision**: Use Approach A, an artifact-only external reviewer contract, adapted for parallel isolated sessions. The main/writer session creates an input bundle, invokes or addresses a configured external reviewer session with explicit input/output paths, and imports only the handoff/report artifacts written by that reviewer.

**Consequences**: This gives a host-neutral boundary and avoids sharing reviewer private transcript with the writer/main session while still allowing the user to mediate between sessions explicitly. It requires a reviewer command/protocol and should not claim cryptographic sandboxing; isolation is by session/process and file handoff boundary.

## Definition of Done (team quality bar)

* Tests added/updated (unit/integration where appropriate)
* Validation scripts and `npm run check` pass
* Docs updated if behavior changes
* Failure behavior and cleanup are explicit

## Out of Scope (explicit)

* Hidden daemon or always-on scheduler.
* Reviewer directly modifying `.paper/drafts/*` in the MVP.
* Claiming cryptographic sandboxing unless actually implemented.

## Research Notes

### What the repo already supports

* `paper.review-loop` calls `runReviewLoop`, which is a same-process deterministic review over `.paper` artifacts.
* Review state is already durable: `.paper/reviews/log.md`, `.paper/reviews/concerns.json`, `.paper/reviews/adversarial-state.json`, `.paper/revision-plans/current-plan.md`, and `.paper/rebuttal/issues.json`.
* Handoffs already exist through `.paper/orchestration/handoffs.md`, and board state is canonical in `.paper/orchestration/board.json`.
* Existing autonomy is explicit foreground execution, not a hidden scheduler; any reviewer process should preserve that explicitness.
* Current CLI already uses `spawnSync` for deterministic probes, so adding a one-shot subprocess bridge is aligned with existing style.

### Constraints from the project

* `.paper/` must remain the durable exchange surface.
* The reviewer should not mutate draft/source/claim files directly in the MVP.
* The main process should not ingest a reviewer transcript if we want private memory isolation.
* The feature should be host-neutral where possible, with host-specific launchers kept as adapters.

### Feasible approaches here

**Approach A: Artifact-only external reviewer contract** (Recommended)

* How it works: main process writes an isolated input bundle under `.paper/reviews/isolated/<run-id>/input.json`, launches a configured command with only input/output path arguments, and later imports only `.paper/reviews/isolated/<run-id>/handoff.json` plus `report.md`.
* Pros: strongest host-neutral boundary; reviewer private prompt/transcript can stay outside the main process; easy to test with a fake reviewer command; matches the user's handoff-path requirement.
* Cons: needs user/config-provided reviewer command for real LLM evaluation; subprocess isolation is process/file boundary, not cryptographic sandboxing.

**Approach B: Claude/OpenCode-specific isolated reviewer adapter**

* How it works: add a host-specific command that starts a fresh Claude Code/OpenCode reviewer session using an input bundle and tells it to write only the handoff output path.
* Pros: closer to the user's “后台评估进程” mental model with a real independent LLM session.
* Cons: less host-neutral; harder to validate consistently; host CLI behavior and permissions vary.

**Approach C: Deterministic subprocess reviewer only**

* How it works: run existing deterministic review logic in a separate Node process and write the same handoff artifact.
* Pros: simple, testable, no private LLM memory leakage.
* Cons: does not provide a genuinely independent semantic reviewer; mostly process isolation around existing logic.

## Technical Approach

Implement a minimal host-neutral isolated-review pipeline with these layers:

1. Core module `src/core/isolated-review.mjs` owns run IDs, input bundle creation, handoff validation/import, report rendering, hash/tamper evidence, and durable review/handoff writes.
2. CLI command `paper-factory isolated-review <target> --reviewer-command <cmd...>` exposes the one-shot slash-command backend path: prepare input bundle, invoke external reviewer command with explicit paths, import handoff/report, return JSON summary.
3. OpenCode slash surface `.opencode/commands/paper.isolated-review.md` is the primary operator UX; it reads action/review context, prefers CLI/MCP runner, and emphasizes parallel-session isolation through files only.
4. Tests use a fake local reviewer command to prove the main process imports only `handoff.json`/`report.md`, not private transcript files.
5. Governance and command validators classify `paper.isolated-review` as a guarded mutation surface because it writes review/handoff artifacts.

## Technical Notes

* Relevant existing artifacts include `.paper/orchestration/handoffs.md`, `.paper/reviews/log.md`, `.paper/reviews/concerns.json`, `.paper/context/actions/*`, `.paper/runtime/*`, and `.paper/programs/*`.
* New public surfaces need CLI + command docs + tests + governance binding because they mutate durable review/handoff state.
* Avoid shell execution for reviewer commands. Parse the configured command into argv and pass input/output paths as explicit arguments.
