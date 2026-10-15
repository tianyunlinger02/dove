# Dove

<img src="./dove.png" alt="Dove pixel-art pigeon carrying a branch" width="320">

Dove helps move research forward: inspect sources, design methods, run experiments, interpret evidence, write papers, create figures, review the work and respond to criticism.

The main session owns the user conversation, execution and delivery. An isolated mentor judges direction rather than engineering. Work is scaled to answer the question, not to make the smallest possible change. Ordinary questions and bounded tasks retain their scope.

## Start

Install an exact trusted artifact, then initialize the project:

```bash
npm install --global <exact-dove-package-specifier>
cd <target-project>
dove
```

The bare public npm name `dove` is unrelated. Global upgrades with lifecycle scripts enabled refresh registered projects, never an arbitrary directory scan. Import older projects with `dove projects import --project <root>... --sync`; inspect `dove projects status`. Bulk sync preserves local owned edits while updating the rest; explicit `dove update` may replace valid owned edits. Research history is preserved. See [Installation](docs/INSTALL.md).

## Ordinary conversation first

Start ordinary `claude` in the initialized project. The project rule provides the complete primary entrance; `claude --agent dove` and nine flat Skills are optional shortcuts, not personas, stages or permissions. DSH receives filesystem Skills and shared references, not Claude agents or hooks. There is no Auto command.

| Skill | Use it for |
|---|---|
| `dove.research` | Explore parallel candidates for the user's choice, or advance a confirmed mainline. |
| `dove.status` | Report results, core evidence, blockers and current round without new work. |
| `dove.source` | Discover and inspect sources, verify citation identity and check claims. |
| `dove.experiment` | Develop, evaluate and analyze methods through fair comparisons. |
| `dove.draft` | Write evidence-grounded text and inspect the authoritative build/export. |
| `dove.figure` | Gather materials, create and inspect visuals, and deliver captions and editable sources. |
| `dove.review` | Distinguish author self-check, delivery checks and independent current-paper review. |
| `dove.rebuttal` | Verify review concerns, respond and make requested revisions. |
| `dove.lessons` | Read or preserve grounded transferable advice. |

Each fresh author main context personally reads the short Chinese quality and preference essentials; full companions are on demand. Installation and hooks do not prove reading or application.

## Research direction and records

Before the user chooses a mainline, read the project's topic-selection standards, establish a meaningful direction and generate a broad parallel candidate pool. Real searches assess and expand it. Offer 2–3 grounded recommendations for the user to choose; before that choice, do not implement candidate methods, and do only standards-allowed diagnostics. An already confirmed mainline is not reopened merely on takeover.

Researcher-owned Markdown under `.dove/research/` keeps current context short:

- **`IDENTITY.md`** holds the mainline, target tier, completion, sourced restrictions and current research state in fixed fields, within 1200 characters.
- **`EVAL.md`** has one row per method version, seven fixed columns and cells up to 200 characters. The executor repairs evaluation and recomputes comparable history. The mentor's current eight-dimensional assessment replaces the previous one below the table.
- **`rounds/`** has one authored brief up to 2000 characters and one result up to 3000 per round, linking ordinary artifacts. Results distinguish changes, measurements, predictions and factual objections.
- **`MENTOR_NOTES.md`** contains only the mentor's own returned memory, saved verbatim by the main session. Dated paper impacts and scans live separately in `watch/`.

Existing missions, experiments and claims stay in place without migration or new entries. `RESEARCH.md` is a short history index; init creates only that bootstrap when the research tree is absent. Lifecycle operations preserve research, reviews, receipts, Lessons and Doctor notes. Status and bounded replies need no completed round or record update merely to end the answer.

## Mentor and independent paper review

Call the mentor at round end, after two no-science rounds, when the user corrects direction or questions the paper story, before route changes or when requested. Engineering and verification failures count; ask the user before further continuation by the third no-result round. Route changes name the old route, new route and reason.

Each cross-round judgment uses a fresh context, its own notes, genuine user wording and actual materials—not resumed execution conversation or executor-framed verdict requests. The mentor asks whether direction follows the user, work builds capability rather than patches, what remains to the goal and target tier, and what should happen next. Engineering, parameters and evaluator repairs remain the executor's responsibility. The mentor may retrieve paper/web sources but does not execute or edit. It also checks draft tracking, unjudged papers and overdue weekly scans independently of rounds.

Independent `dove-review` uses only Read/Grep/Glob on the specified complete current manuscript, cited results and supplied grounding. It receives no author conversation or preferences, does not retrieve, execute or edit, and lists what it read. No frozen copy, hashes or external workspace is required. Author self-check is not independent review; submission completion needs scientific sufficiency, current independent review and actual delivery readiness. Software checks do not certify scientific correctness or acceptance.

## Run receipts

For authorized local work, optional `dove run start [--seed <short text>] -- <command> [args...]` directly launches a command without a shell and records timing, outcome, metric/comparison basis and minimum seed/Git facts. Status is read-only; resume never reruns; finalize adds a scalar after completion; compare ranks compatible finalized runs. Receipts are execution facts, not scientific conclusions.

## License

Dove is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE) only for purposes that license permits. It is source-available, not OSI-approved open-source software; no commercial-license path is offered. Bundled third-party components retain their MIT/ISC terms; see [Third-Party Notices](THIRD_PARTY_NOTICES.md).

## Documentation

- [Installation](docs/INSTALL.md)
- [Usage](docs/USAGE.md)
- [Capability matrix](docs/CAPABILITY_MATRIX.md)
- [Output samples](docs/DOVE_COMMAND_OUTPUT_SAMPLES.md)
- [Packaging](docs/PACKAGING.md)
- [Development docs](docs/development/README.md)
