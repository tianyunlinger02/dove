# Dove

<img src="./dove.png" alt="Dove pixel-art pigeon carrying a branch" width="320">

Dove helps you move a research project forward: read sources, build methods, run experiments, interpret evidence, write and revise papers, make figures, review the work, and respond to criticism.

For a confirmed research goal, the main session executes a short round brief until its evaluation result, then asks a fresh read-only `dove-mentor` context to judge the result and propose the next round. The mentor can change methods within the goal; changing the goal, intended claim or deployment inputs/outputs, or exceeding your resources still needs your decision. Ordinary questions and bounded tasks finish within their scope.

## Start

Install Dove from an exact trusted artifact, then initialize the target project:

```bash
npm install --global <exact-dove-package-specifier>
cd <target-project>
dove
```

The bare public npm package name `dove` is unrelated. With npm lifecycle scripts enabled, a global Dove upgrade refreshes only registered projects. Import older projects once by exact paths with `dove projects import --project <root>... --sync`; retry with `dove projects sync` and inspect with read-only `dove projects status`. Automatic sync skips an entire project with owned integration drift or conflicts; explicit `dove update` can replace valid owned edits. Research history is preserved. See [Installation](docs/INSTALL.md).

## Ordinary conversation first

Start ordinary `claude` in the initialized project and describe the task. The project rule makes that main session the complete Dove entrance. `claude --agent dove` and Skills are optional shortcuts, not additional personas, permissions, or workflow stages. The main session owns the user conversation, clarification, execution, and adoption of delegated results.

### Nine optional Skills

| Skill | Use it for |
|---|---|
| `dove.research` | Start or continue the current round; ask the mentor when no round is active. |
| `dove.status` | Read the identity card, latest evaluation rows, and current brief; explain progress in four plain sentences. |
| `dove.source` | Find, read, check, and use sources that matter to the question. |
| `dove.experiment` | Develop and rerun experiments within a round; reserve frozen heldout evaluation for final confirmation. |
| `dove.draft` | Draft, assess, or revise text and project artifacts from real evidence. |
| `dove.figure` | Gather materials, draw or revise figures, check them in context, and caption them. |
| `dove.review` | Do author-side self-check, delivery review, native `dove-review`, or returned-review preservation and inspection. |
| `dove.rebuttal` | Analyze review findings, write responses, and make requested evidence-backed revisions. |
| `dove.lessons` | Read or maintain reusable lessons that can improve current or future work. |

Use `/dove:*` when a capability shortcut helps. There is no Auto command. DeepSeek Harness receives the same nine project-local filesystem Skills, not Claude agents or hooks. Source, Draft, Figure, Rebuttal, and Lessons are unchanged by the mentor/round structure. See [Usage](docs/USAGE.md).

Every fresh main-agent context personally reads the short Chinese quality and author-preference essentials; full detail stays in their `_FULL.md` companions for on-demand use. Installation and hook delivery do not prove that a model read or applied them.

## Three core research records

Research context is ordinary researcher-owned Markdown under `.dove/research/`:

- **`IDENTITY.md`** — the stable user-confirmed `Mainline`, completion standard, constraints, recent corrections, and a link to the current round. Keep `Current round: rounds/NNN-brief.md` and `Round status: ongoing / paused / completed` at the top, within the first 4KB.
- **`EVAL.md`** — the agreed evaluation script, dev/test split, key metrics, and one row per round. After one user-confirmed kickoff reconstruction, the mentor defines evaluation for all user metrics and generalization, correcting it with all historical rows recomputed; only a change to the goal's meaning needs renewed user confirmation. Reuse existing project evaluation. After important results, the mentor supplies the eight-dimensional paper-quality assessment here; its weakest decisive dimension informs the next brief.
- **`rounds/`** — `NNN-brief.md` states the hypothesis, why it may work, predicted evaluation values, and the result that ends the round. Its author is mentor, user, or external. The main session saves mentor briefs verbatim and writes `NNN-result.md` in a few lines: changed files, actual evaluation values, and prediction versus actual, plus one new `EVAL.md` row. Negative results count; a plan or smoke test does not.

`RESEARCH.md` is a short history index. Existing `missions/`, `experiments/`, and `claims/` stay in place without migration or deletion; new core work goes into rounds rather than new entries in those directories. Sources, Reviews, Lessons, `DOCTOR.md`, and local run receipts retain their distinct uses. Initialization still creates only the minimal `RESEARCH.md` entry when no research tree exists.

Claude presents the identity card on each valid prompt and after compact/resume. An overlong card shows its first 4KB with a reminder to shorten it, rather than being reported missing. The read-only Stop hook blocks once only when the card says a round is ongoing and no mentor has been called in the current turn; `stop_hook_active: true` prevents another block. If you say “discussion only” or “stop,” the main session marks the round paused and ends. Hooks do not write research or grant permissions.

When a correction repeats across registered projects, Dove asks in one sentence whether to add it to global `AUTHOR_PREFERENCES`; it never changes global preferences automatically. Update, reinstall, and uninstall preserve research, historical review records, and run receipts.

## Mentor and independent paper review

`dove-mentor` and `dove-review` are native Claude subagents with fresh contexts and only `Read`, `Grep`, and `Glob`. They do not inherit the execution conversation, resume previous reviewer history, run commands, or edit files. They return findings to the main session, which saves and applies them.

The mentor reads the identity card and recent corrections, evaluation table, recent round briefs/results, and their actual diffs or changed files. Its one-page return judges prediction versus actual, general capability versus case-specific patches, and the method family's remaining value, then proposes the next round or explains completion/a needed user decision.

`/dove:review` retains author-side self-check and independent paper review. `dove-review` reads the specified current manuscript and cited results, challenges the contribution from a reviewer position, and lists the files actually read. No frozen snapshot, external review workspace, socket launcher, or CLI-launched model session is required. Self-check is not independent review; neither model criticism nor software checks certify scientific correctness or acceptance.

## Run receipts

For authorized local experiments or diagnostics, `dove run start [--seed <short text>] -- <command> [args...]` launches a detached supervisor and writes `.dove/runs/<id>/run.jsonl`, `stdout.log`, and `stderr.log`. It directly spawns the command from the project root without a shell. Receipts record timing, outcome, metric and comparison basis, an explicitly declared seed, and minimum Git commit/dirty facts—not an environment inventory. `status` is read-only, `resume` never reruns work, `finalize` records one scalar metric after completion, and `compare` ranks only compatible finalized runs. These are execution facts, not scientific conclusions.

## License

Dove is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE) only for purposes that license permits. It is source-available software, not OSI-approved open-source software; no commercial-license path is offered or advertised. Bundled third-party components retain their MIT or ISC terms; see [Third-Party Notices](THIRD_PARTY_NOTICES.md).

## Documentation

- [Installation](docs/INSTALL.md)
- [Usage](docs/USAGE.md)
- [Capability matrix](docs/CAPABILITY_MATRIX.md)
- [Output samples](docs/DOVE_COMMAND_OUTPUT_SAMPLES.md)
- [Packaging](docs/PACKAGING.md)
- [Development docs](docs/development/README.md)
