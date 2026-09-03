# Dove

Dove helps you move a research project forward. Tell it what you are trying to achieve; it can read sources, inspect project material, analyze results, design or run experiments, keep local run receipts, write and revise text, make figures, review the work, and help respond to criticism.

For a confirmed goal, Dove keeps taking useful steps while the work can still move forward. It asks when the next step would change the goal, require your decision, need permission, or hit a real outside limit.

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

Claude Code receives the full Dove agent and `/dove:*` commands. DeepSeek Harness receives the nine project-local Skills. Literature and webpage tool details are covered in [Usage](docs/USAGE.md) and [Installation](docs/INSTALL.md).

## Research notes

Dove keeps useful research context as ordinary Markdown under `.dove/research/`. Fresh initialization creates only `RESEARCH.md`; additional Mission, Source, Experiment, Review, Claim, and Lesson documents are optional and appear when they help future work.

Dove records notes when you ask, when the research direction or conclusion changes, or when saving evidence and continuation context is genuinely useful. Updates, SessionStart sync, reinstall, and uninstall preserve existing `.dove/research/**` content, `.dove/reviews/**` review records, and `.dove/runs/**` local run receipts. `UserPromptSubmit` is zero-write: it only validates the hook event and routes hidden intake when the prompt is clearly research-related.

## Review

`/dove:review` can do author-side scientific self-check in the current Dove context. That is useful, but it is not independent external review.

`dove-review` is separate: for a near-submission paper, Dove can run `dove review handoff` to freeze the current paper and listed submission materials for an isolated Claude Code reviewer context. Later `resume` and `rerun` reuse the same reviewer session; `import` preserves a user-provided return without claiming runtime provenance. The returned review is evidence for Dove's author side to analyze, rebut, or address.

## Run receipts

For explicit local experiments or diagnostics, Dove can use `dove run start -- <command> [args...]` to launch a detached supervisor that writes `.dove/runs/<id>/run.jsonl`, `stdout.log`, and `stderr.log`. The command is spawned without a shell from the project root. The journal records the explicit argv and comparison basis; ordinary completion writes one `run.terminal`, and `resume` writes `run.reconciled` only for an interrupted record missing that terminal event. `dove run status` is read-only, `resume` never reruns work, `finalize` records one scalar metric after terminal completion, and `compare` ranks only compatible finalized runs. These receipts are execution evidence, not scientific conclusions by themselves.

## Documentation

- [Installation](docs/INSTALL.md)
- [Usage](docs/USAGE.md)
- [Capability matrix](docs/CAPABILITY_MATRIX.md)
- [Output samples](docs/DOVE_COMMAND_OUTPUT_SAMPLES.md)
- [Packaging](docs/PACKAGING.md)
- [Development docs](docs/development/README.md)
