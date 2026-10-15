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

Before mainline choice, read project standards. Find gaps on distinct challenge axes from full-text near misses, then search other subfields for transferable mechanisms. Parallel candidate cards name the gap, source, mapping, assumptions, closest-work difference and risk. Active counter-search yields keep, revise one weakness, or reject with evidence. Offer 2–3 recommendations for the user's choice; before it, only standards-allowed diagnostics, not method implementation. Confirmed mainlines are not reopened on takeover.

Researcher-owned Markdown under `.dove/research/` keeps current context short:

- **`IDENTITY.md`** holds the mainline, target tier, completion, sourced restrictions and current research state in fixed fields, within 1200 characters.
- **`EVAL.md`** has one row per method version, seven fixed columns and cells up to 200 characters. The executor repairs evaluation and recomputes comparable history. The mentor's current eight-dimensional assessment replaces the previous one below the table.
- **`rounds/`** has one authored brief up to 2000 characters and one result up to 3000 per round, linking ordinary artifacts. Results distinguish changes, measurements, predictions and factual objections.
- **`MENTOR_NOTES.md`** holds the mentor's own memory. Dated impacts and scans live in `watch/`; `papers/` keeps cumulative full-text Q&A and a direction-grouped JSON/Markdown library with Chinese takeaways and BibTeX export.

Existing missions, experiments and claims stay in place without migration or new entries. `RESEARCH.md` is a short history index; init creates only that bootstrap when the research tree is absent. Lifecycle operations preserve research. Optional `dove settings --host-migration on` registers upgrade tasks for the host to finish after current work, not a CLI rewrite; default is off. Status and bounded replies need no round.

## Mentor and independent paper review

Call the mentor at round end, after two no-science rounds, when the user corrects direction or questions the paper story, before route changes or when requested. Engineering and verification failures count; ask the user before further continuation by the third no-result round. Route changes name the old route, new route and reason.

Use `dove mentor brief --project <root>` for actual materials and four fixed questions, with only a bounded authored opinion and new raw-artifact paths appended. Each cross-round judgment uses a fresh context, its own notes and genuine user wording, not resumed execution conversation. Engineering, parameters and evaluator repairs remain the executor's responsibility. The mentor may retrieve paper/web sources but does not execute or edit. It also checks draft tracking, unjudged papers and overdue weekly scans independently of rounds.

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
