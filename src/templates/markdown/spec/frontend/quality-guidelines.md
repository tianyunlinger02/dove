# Quality Guidelines

## Choose checks by impact

Dove is a research agent, not a security project. Check changed contracts and direct consumers without new defenses or unrelated gates. Documentation needs read-only terminology/link inspection, source/template byte comparison, length comparison and scoped `git diff --check`. Prompt work can also use read-only rendering. Neither proves live adoption or scientific quality.

Use declared `package.json` commands. This ESM project has no separate lint or typecheck scripts; do not report them as passed. `node --check` checks syntax. If tests are authorized, inspect side effects before selecting existing cases with `node --test --test-name-pattern '<name>' <test-file>`.

| Changed surface | Relevant checks when authorized |
|---|---|
| Specs/templates | Byte comparison; existing mirror case in `tests/commands/03-ambient-docs-research-defaults.test.mjs` |
| Behavior, Skills and resources | Focused `01-agent-and-skills`, `02-generated-adapters` and `03-ambient-docs-research-defaults` cases under `tests/commands/`; `npm run commands:check` |
| Native agents | Rendered boundaries, mentor handoff and reviewer instructions; no model invocation |
| CLI | Relevant `04-cli-parser-renderers` and `05-interactive-setup` cases under `tests/commands/` |
| Lifecycle/hooks | Affected installation, uninstall and registered-project validators |
| Watch/topics/dashboard | Relevant `tests/paper-watch.test.mjs`, `tests/topic-selection.test.mjs`, `tests/dashboard.test.mjs` cases |
| Receipts/writes | Scoped `runs:validate` and `runtime:validate` after scratch/Git side-effect inspection |
| Behavior/release | `behavior:validate`, `build:check`, `check`, `release:check`, `pack:dry-run` only within scope |

Generation, build, installation and loading are separate operations. Leave projections to their assigned owner. Do not retain obsolete runtimes or compatibility behavior to satisfy stale assertions.

## Protect contracts, not incidental wording

[Component](./component-guidelines.md), [State](./state-management.md), [Hook](./hook-guidelines.md) and [Type](./type-safety.md) own their contracts. Check relationships and consequential behavior, not exact-sentence regexes, prose banlists or automatic scientific PASS algorithms. Replace superseded sections and merge repeated duties; keep natural prose and nonincreasing total length.

Verify agreement on the affected behavior:

- Topic selection reads project standards and uses at most two gaps per challenge axis, each supported by at least two body-read near-miss papers, a named deficiency and observable closure evidence. Abstracts or absent prior work are not gap evidence. No universal method-only gate is introduced.
- Cross-field mechanism discovery uses 6–10 queries across at least three other subfields. Candidate fields expose sources, mapping, assumptions, nearest-work differences and main risk. Active novelty challenges return keep/revise/reject, one weakest revision focus, cited evidence and a strongest objection. Broad generation precedes assessment and 2–3 choices; no method implementation before user selection.
- Source reads with 1–5 questions and reuses cumulative, location-grounded Q&A. Abstract/summary-only material retains source and unread-full-text status. Draft groups the direction library and exports checked BibTeX without invented metadata; unknown publication kind uses `@misc`, not a venue-label guess.
- Chinese watch lines explain what papers do; pending lines stay visibly pending. Impact, direction and reading provenance survive into the library. Normal watch or explicit accumulation may write it; library/dashboard GET and exports remain read-only. Older-paper supplementation is off by default, bounded and nonrepeating, with original dates. Installation neither creates a library nor migrates research.
- Scale answers the question, pipeline connection is not core evidence, and engineering/evaluator repair stays with the executor. Method changes receive full evaluation and fresh unused tests after prior test use. Utility and attribution remain distinct.
- Mentor calls use `dove mentor brief --project <root>` in fresh contexts, not arbitrary executor task text. Only capped authored opinions, raw paths and sourced user originals supplement it; same-round repeats name their trigger. Engineering failures count: two rounds need diagnosis, the third a user decision. Records follow State Management.
- Every mentor checks tracking drafts, unjudged impacts and overdue scans independently of rounds. Old judgments remain usable. Retrieval handles no-key Semantic Scholar, rate-limit backoff and relevance beyond one generic title term; errors are not empty successful searches.

The mentor can retrieve sources but cannot read execution conversation or private preferences, compute or edit. The paper reviewer reads only supplied current manuscript materials through Read/Grep/Glob, without network or transcript access. Missing sources limit provenance, not confirmed commitments. Native isolation needs no frozen copy, hashes or new exchange store.

Hooks retain the UTF-8-safe first 4096 card bytes and a source pointer. Verified guidance files, not overall `current` status, enable guidance despite reported statusLine/MCP differences. Default-off host migration registers software pending work only; hosts act at a quiet point without changing conclusions, interrupting jobs or repeating completed versions. Retired Stop checks preserve user hooks and ownership differences. Disk updates do not reload contexts.

## Authorization and evidence

Separate product development, consumer research and validation. Documentation checks are read-only: do not create test projects or fixtures, inspect private research conversations, invoke models, write test content into research or continue it for validation. In this absorption task, leave point1 and `runs/topic_selection_20261015/` untouched; observe any improvement only during its normal authorized progress.

Honor the authorized `TMPDIR`, not system `/tmp`. Other validation requires its own scope; retained artifacts belong in that authorized location, not consumer research. Never manufacture user confirmation.

Report actual and unrun checks separately. Distinguish source instructions, generated resources/bundles, installed files, loaded context, observed behavior and scientific results. A software pass, rendered card or successful installation does not prove model adoption, generalization, completion or mentor effectiveness. Report denials and incomplete actions at their actual scope.

Behavioral acceptance comes from normal authorized use, not a dedicated test project. Observation targets in `docs/development/FINAL_EXPECTATIONS.md` are pending until actually observed and remain separate from software checks.
