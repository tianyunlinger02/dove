# Dove

Dove helps you move a research project forward. Tell it what you are trying to achieve; it can read sources, inspect project material, analyze results, design or run experiments, keep local run receipts, write and revise text, make figures, review the work, and help respond to criticism.

For a confirmed research goal, Dove keeps taking useful in-scope steps while the work can still move forward. It checks consequential plans and investments against that goal, grounds important research decisions proportionately, and asks when the next step needs your decision or permission or hits a real outside limit. Ordinary tasks with no research impact finish normally, without imposed research planning, grading, or records.

## Start

Install Dove from an exact trusted artifact, then initialize the target project:

```bash
npm install --global <exact-dove-package-specifier>
cd <target-project>
dove
```

For package trust, host setup, permissions, update, reinstall, uninstall, and Doctor details, see [Installation](docs/INSTALL.md).

## Ordinary conversation first

After initializing Claude integration, start ordinary `claude` in the project and describe the task. The project rule is the primary Dove entrance for relevant research, engineering, writing, and collaboration work. Neither `--agent dove` nor a Skill is required.

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

`claude --agent dove` is an optional explicit entrance for long author-side sessions, not a higher judgment authority; Skills likewise add no authority or permissions. The ordinary main session retains the full conversation, important clarification, and mainline ownership before and after bounded delegation. Separate context can help an investigation without creating another persona. DeepSeek Harness receives the nine project-local Skills; there is no Auto command. See [Usage](docs/USAGE.md) and [Installation](docs/INSTALL.md).

The short core uses two on-demand references: research quality criteria and author preferences. Neither is evidence or a Lesson; [Usage](docs/USAGE.md#short-core-and-two-on-demand-references) explains their separate roles. Participating in research, completing requested work, and making scientific progress are distinct: useful engineering or delivery can finish without establishing a new scientific result.

## Research notes

Dove keeps useful research context as ordinary Markdown under `.dove/research/`. Fresh initialization creates only `RESEARCH.md`; additional Mission, Source, Experiment, Review, Claim, and Lesson documents are optional and appear when they help future work.

Dove records notes when you ask, when the research direction or conclusion changes, or when saving evidence and continuation context is genuinely useful. Explicit update, reinstall, uninstall, and the read-only SessionStart inspection preserve existing `.dove/research/**` content, `.dove/reviews/**` review records, and `.dove/runs/**` local run receipts. Dove no longer installs `UserPromptSubmit`, hidden intake, or a replacement per-prompt hook. When the project has no existing user status line, Claude integration installs a read-only two-line Dove display: model/context facts, optional unlabeled cyan mainline text, Git branch, and current session duration on the first line; only the absolute project path on the second. The mainline comes solely from the root research overview's unique ordinary `Mainline: <text>` line through a bounded read, with no guessing or backfilling; only a nonempty `NO_COLOR` disables color. See [Usage](docs/USAGE.md#research-markdown) for maintenance boundaries. The branch is not a scientific-mainline claim and the duration is not cumulative research time. Explicit `dove update` replaces local edits to manifest-owned integration and tells you what was replaced; SessionStart only inspects and may suggest that explicit update. After compact/resume it supplies only a small read-only facts card, not a reconstructed research mainline; startup/clear gets no research card.

## Review

`/dove:review` can do author-side scientific self-check in the current Dove context. That is useful, but it is not independent external review.

`dove-review` uses the same research judgment in an isolated reviewer position, not a second persona. For a near-submission paper, Dove can run `dove review handoff` to freeze the current paper and listed submission materials for an isolated Claude Code reviewer context. The reviewer receives only frozen files and Read, so author-side venue or literature grounding must be included in the handoff when it matters. `dove review status --id <id>` compares the frozen material receipt with current project files read-only and publicly reports paths, safe size/existence/type/error facts, and `current`, `changed`, `missing`, or `unavailable` version relationships without exposing hash fields; later `resume` and `rerun` reuse the same reviewer session, and `import` preserves a user-provided return without claiming runtime provenance. The returned review is evidence for Dove's author side to analyze, rebut, or address.

## Run receipts

For explicit local experiments or diagnostics, Dove can use `dove run start [--seed <short text>] -- <command> [args...]` to launch a detached supervisor that writes `.dove/runs/<id>/run.jsonl`, `stdout.log`, and `stderr.log`. The command is spawned without a shell from the project root. The journal records the command, timing, outcome, metric and comparison basis, plus an explicitly declared seed and the minimum Git facts: commit and dirty `true`/`false`/`null`. It is not an environment inventory. Ordinary completion writes one `run.terminal`, and `resume` writes `run.reconciled` only for an interrupted record missing that terminal event. `dove run status` is read-only, `resume` never reruns work, `finalize` records one scalar metric after terminal completion, and `compare` ranks only compatible finalized runs using metric, budget, data, evaluator, and resource basis; Git commit/dirty remain facts and do not affect comparability or ranking. These receipts are execution evidence, not scientific conclusions by themselves.

## License

Dove 3.0.10 is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE) only for purposes that license permits. It is source-available software, not OSI-approved open-source software, and this project does not offer or advertise a commercial-license path.

Bundled third-party components remain under their own MIT or ISC terms. See [Third-Party Notices](THIRD_PARTY_NOTICES.md); Dove's PolyForm license does not replace or restrict those grants.

## Documentation

- [Installation](docs/INSTALL.md)
- [Usage](docs/USAGE.md)
- [Capability matrix](docs/CAPABILITY_MATRIX.md)
- [Output samples](docs/DOVE_COMMAND_OUTPUT_SAMPLES.md)
- [Packaging](docs/PACKAGING.md)
- [Development docs](docs/development/README.md)
