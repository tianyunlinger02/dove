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

A global Dove upgrade with npm lifecycle scripts enabled refreshes registered projects, without scanning your home directory. Import older projects once by exact paths with `dove projects import --project <root>... --sync`; use `dove projects sync` to retry and read-only `dove projects status` to inspect results. Automatic sync skips a project with any owned integration drift or conflict while continuing others; explicit `dove update` can replace valid owned edits. `--ignore-scripts` disables the cascade; an already-registered Claude prompt hook can deliver verified current guidance on the next message without discarding the conversation, but complete host rule/config loading may still need a fresh context. See [Installation](docs/INSTALL.md) for package trust, setup, npm output, and lifecycle details.

## Ordinary conversation first

After initializing Claude integration, start ordinary `claude` in the project and describe the task. The project rule makes that main session the complete Dove entrance for relevant research, engineering, writing, and collaboration work; it can use the same capability methods naturally without a command. `--agent dove` and Skills are optional shortcuts, not prerequisites, routers, permissions, or workflow stages. If its existing Dove prompt hook is still registered and the project sync succeeded, the open session can receive the updated CLI's short guidance on the next user prompt, then read the current rule and short essentials, with relevant full detail on demand, in the same conversation. This is not host rule hot reload; without a working old hook or for complete host configuration loading, use a fresh context. Disk installation alone is not live loading.

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

Each fresh host main-agent context personally reads the short Chinese research-quality and author-preference essentials before substantive work; full detail stays in their `_FULL.md` companions and is consulted only for the decision at hand. Claude startup and `/clear` deliver the bootstrap; DSH applies it on first author-side Skill use if not already read in that context. These four exact resources are package guidance, not evidence or Lessons; [Usage](docs/USAGE.md#short-core-and-two-reference-read-contracts) explains the boundaries. Participating in research, completing requested work, and making scientific progress are distinct: useful engineering or delivery can finish without establishing a new scientific result.

## Research notes

Dove keeps useful research context as ordinary Markdown under `.dove/research/`. Fresh initialization creates only `RESEARCH.md`; additional Mission, Source, Experiment, Review, Claim, and Lesson documents are optional and appear when they help future work.

Dove records notes when you ask, when the research direction or conclusion changes, or when saving evidence and continuation context is genuinely useful. Explicit update, reinstall, uninstall, and the read-only SessionStart inspection preserve existing `.dove/research/**` content, `.dove/reviews/**` review records, and `.dove/runs/**` local run receipts. Claude's `UserPromptSubmit` checks managed integration read-only; when current, it presents the short project-owned `.dove/research/IDENTITY.md` card and current guidance, otherwise a nonblocking integration warning. The card uses a few hundred words of plain user language, not internal abbreviations, keeps the stable `Mainline` field in your wording, and leaves process detail in history. The hook does not classify prompts, write research, decide permissions, or block the user. It is not hidden intake, a router, a Stop scheduler, or per-tool scientific approval. When the project has no existing user status line, Claude integration installs a read-only two-line Dove display: model/context facts, optional unlabeled cyan mainline text, Git branch, and current session duration on the first line; only the absolute project path on the second. The mainline comes solely from the short identity card's unique ordinary `Mainline: <text>` line through a bounded read, with no guessing or backfilling; only a nonempty `NO_COLOR` disables color. See [Usage](docs/USAGE.md#research-markdown) for maintenance boundaries. The branch is not a scientific-mainline claim and the duration is not cumulative research time. Explicit `dove update` replaces local edits to manifest-owned integration and tells you what was replaced; SessionStart inspects read-only, may suggest that explicit update, and on startup or `/clear` requires the current main agent to personally read both short installed essentials. After compact/resume it presents the short identity card and continuity guidance, not a timestamp-based research reconstruction or an unconditional full reread; startup/clear gets no research card.

## Review

`/dove:review` can do author-side scientific self-check in the current Dove context. That is useful, but it is not independent external review.

`dove-review` uses the same Dove role in a separate Read-only Claude session, not a second persona or Skill. The existing `dove review handoff --project P --scope route|design --material path... --json` supports clean-context route and design review. Both directly read the exact `.dove/research/IDENTITY.md` and supplied artifacts. Route uses this stretch's cumulative candidate/change/prediction/result sequence to judge the method family's remaining value and shared failure causes, not just the latest candidate; design reads a one-page design for a new or replacement main method, not ordinary variants. No process conversation is supplied, and every runtime call—including resume/rerun—starts a brand-new session. Material findings change the actual next step or rework invalid patches, with rejected approaches retained in the card. Missing runtime is a stated limitation, not self-check relabeled as isolated review.

Default paper review is unchanged: freeze the current complete near-submission paper and listed submission/grounding materials; resume/rerun retain the paper reviewer's own history. All scopes receive separate quality essentials and full detail, not author preferences, web, MCP, shell, or unlisted files. This is session/tool/material isolation, not an OS sandbox. Paper `status` compares frozen receipts read-only without exposing hashes, and `import` preserves a supplied return without runtime provenance. Findings are reasoned criticism, not scientific PASS or execution permission. See [Usage](docs/USAGE.md#review) for triggers, one-page design, and author-side adoption.

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
