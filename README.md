# Dove

<img src="./dove.png" alt="Dove pixel-art pigeon carrying a branch" width="320">

Dove helps you move a research project forward. Tell it what you are trying to achieve; it can read sources, inspect project material, analyze results, design or run experiments, keep local run receipts, write and revise text, make figures, review the work, and help respond to criticism.

For a confirmed research goal, Dove keeps taking useful in-scope steps while the work can still move forward. It seeks the shortest total path from problem through method to an evidence-supported contribution—not the fewest local steps—and checks consequential plans and investments against that goal, grounds important research decisions proportionately, and asks when the next step needs your decision or permission or hits a real outside limit. An interface, available data, supplied solution, mature implementation, or past effort does not define the scientific problem or justify a contribution by itself: Dove reconstructs the independent need and allows simpler existing solutions or no remaining research contribution. Once the scientific contract is clear enough, it translates the mechanism and distinguishing prediction into the necessary producer-consumer behavior and claim-matched evidence, then implements the authorized core path without waiting for exhaustive search or prior positive results. Ordinary tasks with no research impact finish normally, without imposed research planning, grading, or records.

## Start

Install Dove from an exact trusted artifact, then initialize the target project:

```bash
npm install --global <exact-dove-package-specifier>
cd <target-project>
dove
```

A global Dove upgrade with npm lifecycle scripts enabled refreshes registered projects, without scanning your home directory. Import older projects once by exact paths with `dove projects import --project <root>... --sync`; use `dove projects sync` to retry and read-only `dove projects status` to inspect results. Automatic sync skips a project with any owned integration drift or conflict while continuing others; explicit `dove update` can replace valid owned edits. `--ignore-scripts` disables the cascade; reload active host sessions after disk changes. See [Installation](docs/INSTALL.md) for package trust, setup, npm output, and lifecycle details.

## Ordinary conversation first

After initializing Claude integration, start ordinary `claude` in the project and describe the task. The project rule makes that main session the complete Dove entrance for relevant research, engineering, writing, and collaboration work; it can use the same capability methods naturally without a command. `--agent dove` and Skills are optional shortcuts, not prerequisites, routers, permissions, or workflow stages. After installing or updating integration in an active session, reload the host session to load the changed resources; disk installation alone is not live loading.

### Nine optional Skills

Use `/dove:*` when a specific capability shortcut helps.

| Skill | Use it for |
|---|---|
| `dove.research` | Advance a research goal and let Dove choose the next useful step. |
| `dove.status` | Read current research notes and next priorities without writing. |
| `dove.source` | Find, read, check, and use sources that matter to the question. |
| `dove.experiment` | Design, run when authorized, analyze, or record exploration, diagnostics, confirmation, reproduction, and delivery checks. |
| `dove.draft` | Draft, assess, or revise text and project artifacts from real evidence. |
| `dove.figure` | Gather materials, draw or revise figures, check them in context, and caption them. |
| `dove.review` | Run author-side self-check, delivery review, `dove-review` handoff, review import, or review inspection. |
| `dove.rebuttal` | Analyze review findings, write responses, and make requested evidence-backed revisions. |
| `dove.lessons` | Read or maintain reusable lessons that can improve current or future work. |

`claude --agent dove` is an optional explicit entrance for long author-side sessions, not a higher judgment authority; Skills likewise add no authority or permissions. The ordinary main session retains the full conversation, important clarification, mainline ownership, and adoption of scoped capability or delegated returns. Material findings must change affected claims, dependencies, investment, artifacts, or next action—or explain why no change follows—without automatically invoking another capability. Separate context can help an investigation without creating another persona. DeepSeek Harness receives the nine project-local Skills; there is no Auto command. See [Usage](docs/USAGE.md) and [Installation](docs/INSTALL.md).

The short core uses two references with different read contracts: research quality criteria are consulted at consequential decision triggers, while each fresh host main-agent context must personally read the complete author preferences before substantive work. Claude startup and `/clear` deliver that bootstrap to the current main agent—ordinary Claude or explicit Dove; DSH performs it on first author-side Skill use if not already completed in that context. Neither reference is evidence or a Lesson; [Usage](docs/USAGE.md#short-core-and-two-reference-read-contracts) explains the boundaries. Participating in research, completing requested work, and making scientific progress are distinct: useful engineering or delivery can finish without establishing a new scientific result.

## Research notes

Dove keeps useful research context as ordinary Markdown under `.dove/research/`. Fresh initialization creates only `RESEARCH.md`; additional Mission, Source, Experiment, Review, Claim, and Lesson documents are optional and appear when they help future work.

Dove records notes when you ask, when the research direction or conclusion changes, or when saving evidence and continuation context is genuinely useful. Explicit update, reinstall, uninstall, and the read-only SessionStart inspection preserve existing `.dove/research/**` content, `.dove/reviews/**` review records, and `.dove/runs/**` local run receipts. Claude's `UserPromptSubmit` delivers a deterministic short re-anchor on every prompt: no classification, research reads or writes, permission decisions, or blocking. It is not hidden intake, a router, a Stop scheduler, or per-tool scientific approval. When the project has no existing user status line, Claude integration installs a read-only two-line Dove display: model/context facts, optional unlabeled cyan mainline text, Git branch, and current session duration on the first line; only the absolute project path on the second. The mainline comes solely from the root research overview's unique ordinary `Mainline: <text>` line through a bounded read, with no guessing or backfilling; only a nonempty `NO_COLOR` disables color. See [Usage](docs/USAGE.md#research-markdown) for maintenance boundaries. The branch is not a scientific-mainline claim and the duration is not cumulative research time. Explicit `dove update` replaces local edits to manifest-owned integration and tells you what was replaced; SessionStart inspects read-only, may suggest that explicit update, and on startup or `/clear` requires the current main agent to personally read the full installed author preferences. After compact/resume it supplies only a small read-only facts card plus preference-continuity guidance, not a reconstructed research mainline or an unconditional full reread; startup/clear gets no research card.

## Review

`/dove:review` can do author-side scientific self-check in the current Dove context. That is useful, but it is not independent external review.

`dove-review` uses the same research judgment in an isolated reviewer position, not a second persona. For a near-submission paper, Dove can run `dove review handoff` to freeze the current paper and listed submission materials for an isolated Claude Code reviewer context. The reviewer receives only frozen files and Read, so author-side venue or literature grounding must be included in the handoff when it matters. `dove review status --id <id>` compares the frozen material receipt with current project files read-only and publicly reports paths, safe size/existence/type/error facts, and `current`, `changed`, `missing`, or `unavailable` version relationships without exposing hash fields; later `resume` and `rerun` reuse the same reviewer session, and `import` preserves a user-provided return without claiming runtime provenance. The returned review is evidence for Dove's author side to analyze, rebut, or address.

## Run receipts

For explicit local experiments or diagnostics, Dove can use `dove run start [--seed <short text>] -- <command> [args...]` to launch a detached supervisor that writes `.dove/runs/<id>/run.jsonl`, `stdout.log`, and `stderr.log`. The command is spawned without a shell from the project root. The journal records the command, timing, outcome, metric and comparison basis, plus an explicitly declared seed and the minimum Git facts: commit and dirty `true`/`false`/`null`. It is not an environment inventory. Ordinary completion writes one `run.terminal`, and `resume` writes `run.reconciled` only for an interrupted record missing that terminal event. `dove run status` is read-only, `resume` never reruns work, `finalize` records one scalar metric after terminal completion, and `compare` ranks only compatible finalized runs using metric, budget, data, evaluator, and resource basis; Git commit/dirty remain facts and do not affect comparability or ranking. These receipts are execution evidence, not scientific conclusions by themselves.

## License

Dove 3.2.6 is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE) only for purposes that license permits. It is source-available software, not OSI-approved open-source software, and this project does not offer or advertise a commercial-license path.

Bundled third-party components remain under their own MIT or ISC terms. See [Third-Party Notices](THIRD_PARTY_NOTICES.md); Dove's PolyForm license does not replace or restrict those grants.

## Documentation

- [Installation](docs/INSTALL.md)
- [Usage](docs/USAGE.md)
- [Capability matrix](docs/CAPABILITY_MATRIX.md)
- [Output samples](docs/DOVE_COMMAND_OUTPUT_SAMPLES.md)
- [Packaging](docs/PACKAGING.md)
- [Development docs](docs/development/README.md)
