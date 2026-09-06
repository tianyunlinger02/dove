# Dove

Dove helps you move a research project forward. Tell it what you are trying to achieve; it can read sources, inspect project material, analyze results, design or run experiments, keep local run receipts, write and revise text, make figures, review the work, and help respond to criticism.

For a confirmed goal, Dove keeps taking useful steps while the work can still move forward. Important route and central-experiment decisions start from proportionate theory or mechanism grounding, with exploratory diagnostics when foundations are missing. It asks when the next step would change the goal, require your decision, need permission, or hit a real outside limit.

## Start

Install Dove from an exact trusted artifact, then initialize the target project:

```bash
npm install --global <exact-dove-package-specifier>
cd <target-project>
dove
```

For package trust, host setup, permissions, update, reinstall, uninstall, and Doctor details, see [Installation](docs/INSTALL.md).

## Nine entrances

You can talk to Dove directly, or use `/dove:*` when you want a specific entrance.

| Skill | Use it for |
|---|---|
| `dove.research` | Advance a research goal and let Dove choose the next useful step. |
| `dove.status` | Read current research notes and next priorities without writing. |
| `dove.source` | Find, read, check, and use sources that matter to the question. |
| `dove.experiment` | Design, analyze, record, or explicitly run experiments and diagnostics. |
| `dove.draft` | Draft, assess, or revise text and project artifacts from real evidence. |
| `dove.figure` | Gather materials, draw or revise figures, check them in context, and caption them. |
| `dove.review` | Run author-side self-check, delivery review, `dove-review` handoff, review import, or review inspection. |
| `dove.rebuttal` | Analyze review findings, write responses, and make requested evidence-backed revisions. |
| `dove.lessons` | Read or maintain reusable lessons that can improve current or future work. |

In Claude Code, ordinary conversations share Dove's research judgment through the project rule. Start `claude --agent dove` for a full author-side research session. A bounded investigation that benefits from separate context may use Dove as a subagent; work needing the full conversation, important user clarification, or ongoing mainline ownership stays in the main session. The nine `/dove:*` commands remain flat shortcuts, with no Auto command. DeepSeek Harness receives the nine project-local Skills. See [Usage](docs/USAGE.md) and [Installation](docs/INSTALL.md) for details.

## Research notes

Dove keeps useful research context as ordinary Markdown under `.dove/research/`. Fresh initialization creates only `RESEARCH.md`; additional Mission, Source, Experiment, Review, Claim, and Lesson documents are optional and appear when they help future work.

Dove records notes when you ask, when the research direction or conclusion changes, or when saving evidence and continuation context is genuinely useful. Updates, SessionStart sync, reinstall, and uninstall preserve existing `.dove/research/**` content, `.dove/reviews/**` review records, and `.dove/runs/**` local run receipts. Dove no longer installs `UserPromptSubmit`, hidden intake, a replacement per-prompt hook, or a managed status line. Explicit `dove update` replaces local edits to manifest-owned integration and tells you what was replaced; SessionStart skips those edits, syncs the remaining safe resources, and reminds you. After compact/resume it supplies only a small read-only facts card, not a reconstructed research mainline; startup/clear gets no research card.

## Review

`/dove:review` can do author-side scientific self-check in the current Dove context. That is useful, but it is not independent external review.

`dove-review` uses the same research judgment in an isolated reviewer position, not a second persona. For a near-submission paper, Dove can run `dove review handoff` to freeze the current paper and listed submission materials for an isolated Claude Code reviewer context. The reviewer receives only frozen files and Read, so author-side venue or literature grounding must be included in the handoff when it matters. `dove review status --id <id>` compares the frozen material receipt with current project files read-only and publicly reports paths, safe size/existence/type/error facts, and `current`, `changed`, `missing`, or `unavailable` version relationships without exposing hash fields; later `resume` and `rerun` reuse the same reviewer session, and `import` preserves a user-provided return without claiming runtime provenance. The returned review is evidence for Dove's author side to analyze, rebut, or address.

## Run receipts

For explicit local experiments or diagnostics, Dove can use `dove run start [--seed <short text>] -- <command> [args...]` to launch a detached supervisor that writes `.dove/runs/<id>/run.jsonl`, `stdout.log`, and `stderr.log`. The command is spawned without a shell from the project root. The journal records the command, timing, outcome, metric and comparison basis, plus an explicitly declared seed and the minimum Git facts: commit and dirty `true`/`false`/`null`. It is not an environment inventory. Ordinary completion writes one `run.terminal`, and `resume` writes `run.reconciled` only for an interrupted record missing that terminal event. `dove run status` is read-only, `resume` never reruns work, `finalize` records one scalar metric after terminal completion, and `compare` ranks only compatible finalized runs using metric, budget, data, evaluator, and resource basis; Git commit/dirty remain facts and do not affect comparability or ranking. These receipts are execution evidence, not scientific conclusions by themselves.

## Documentation

- [Installation](docs/INSTALL.md)
- [Usage](docs/USAGE.md)
- [Capability matrix](docs/CAPABILITY_MATRIX.md)
- [Output samples](docs/DOVE_COMMAND_OUTPUT_SAMPLES.md)
- [Packaging](docs/PACKAGING.md)
- [Development docs](docs/development/README.md)
