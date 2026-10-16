# Quality Guidelines

## Choose checks by impact

Dove is a research agent, not a security project. Check changed contracts and direct consumers without new defenses or unrelated gates. Documentation needs read-only terminology/link inspection, source/template byte comparison and scoped `git diff --check`. Prompt work can also use read-only rendering. Neither proves live adoption or scientific quality.

Use declared `package.json` commands. This ESM project has no separate lint or typecheck scripts; do not report them as passed. `node --check` checks syntax. If tests are authorized, inspect side effects before selecting existing cases with `node --test --test-name-pattern '<name>' <test-file>`.

| Changed surface | Relevant checks when authorized |
|---|---|
| Specs/templates | Byte comparison; existing mirror case in `tests/commands/03-ambient-docs-research-defaults.test.mjs` |
| Behavior, Skills and resources | Focused `01-agent-and-skills`, `02-generated-adapters` and `03-ambient-docs-research-defaults` cases under `tests/commands/`; `npm run commands:check` |
| Native agents | Read-only rendering for review and functional mentor-handoff checks, not prose-locking assertions; no model invocation |
| CLI | Relevant `04-cli-parser-renderers` and `05-interactive-setup` cases under `tests/commands/` |
| Lifecycle/hooks | Affected installation, uninstall and registered-project validators |
| Watch/topics/dashboard | Relevant `tests/paper-watch.test.mjs`, `tests/topic-selection.test.mjs`, `tests/dashboard.test.mjs` cases |
| Receipts/writes | Scoped `runs:validate` and `runtime:validate` after scratch/Git side-effect inspection |
| Behavior/release | `behavior:validate`, `build:check`, `check`, `release:check`, `pack:dry-run` only within scope |

Generation, build, installation and loading are separate operations. Leave projections to their assigned owner. Do not retain obsolete runtimes or compatibility behavior to satisfy stale assertions.

## Protect contracts, not incidental wording

[Component](./component-guidelines.md), [State](./state-management.md), [Hook](./hook-guidelines.md) and [Type](./type-safety.md) own their contracts. Tests check functional behavior, not exact prompt sentences, prose banlists, word or negation counts, or text-size ceilings. Replace superseded wording and merge repeated duties using natural full sentences; do not compress guidance into fragments to satisfy a length limit or add gates that block user requests. Software tests do not produce scientific PASS judgments.

Verify agreement on the affected behavior:

- Selection ends in user choice, not method closure. Ground value, strong-baseline failures and numbers; per axis, at most two gaps cite two body-read near-misses, deficiency and closure observation. Abstracts or absent precedent are insufficient; formal-deliverable gates do not block recommendations.
- Follow [Component](./component-guidelines.md#mainline-and-rounds) for sourced candidates and review. One round delivers the best 2–3 choices, or one without padding. Conflicting standards get one explanation plus recommendations, not static retries. Confirmation ends selection-only limits; ask once for separate resource authorization, then diagnose, design, experiment and write the proposal.
- Source reads with 1–5 questions and reuses cumulative, location-grounded Q&A. Abstract/summary-only material retains source and unread-full-text status. Draft groups the direction library and exports checked BibTeX without invented metadata; unknown publication kind uses `@misc`, not a venue-label guess.
- Chinese watch lines explain what papers do; pending lines stay visibly pending. Impact, direction and reading provenance survive into the library. Normal watch or explicit accumulation may write it; library/dashboard GET and exports remain read-only. Older-paper supplementation is off by default, bounded and nonrepeating, with original dates. Installation neither creates a library nor migrates research.
- Scale answers the question, pipeline connection is not core evidence, and engineering/evaluator repair stays with the executor. Method changes receive full evaluation and fresh unused tests after prior test use. Utility and attribution remain distinct.
- Mentor calls use the generated `dove mentor brief --project <root>` template plus the trigger in fresh contexts. Its five questions include core capability and contribution against the closest prior work. Authored opinions, raw paths and sourced user originals remain materials, not executor-written instructions; long or unsigned opinions are noted rather than rejected. Engineering failures count: two rounds need diagnosis, the third a user decision. Records follow State Management.
- Long-term intent comparison is due when notes lack a dated section or its date is strictly more than seven days old, not at exactly seven days. Consolidation preserves the latest section and date, issues already raised and their answers. Attribution distinguishes the user's own words from relays in `USER_ORIGINALS.md`; incomplete coverage does not mean the user never said something. Daily prewarming covers every registered project, including disabled paper-watch projects, with the existing scan budget and explicit Claude Code-only coverage, not DSH. The dashboard shows core capability and a collapsed latest intent section with its date.
- Every mentor checks tracking, unjudged impacts and overdue scans independently of rounds. The main session saves actual advice JSON and runs `dove watch configure --project <root> --mentor <建议.json> [--json]`, replacing only suggested fields and preserving `enabled`, `categories` and other settings. Verify the saved values and `source: mentor`; the latter means advice was saved, not that the user confirmed research direction. Without advice, draft configuration remains draft. Old judgments remain usable. Retrieval handles no-key Semantic Scholar, rate-limit backoff and relevance beyond one generic title term; errors are not empty successful searches.

The mentor can retrieve sources but cannot read execution conversation or private preferences, compute or edit. The paper reviewer reads only supplied current manuscript materials through Read/Grep/Glob, without network or transcript access. Missing sources limit provenance, not confirmed commitments. Native isolation needs no frozen copy, hashes or new exchange store.

Hooks retain the UTF-8-safe first 4096 card bytes and a source pointer. Verified guidance files, not overall `current` status, enable guidance despite reported statusLine/MCP differences. Default-off host migration registers software pending work only; hosts act at a quiet point without changing conclusions, interrupting jobs or repeating completed versions. Retired Stop checks preserve user hooks and ownership differences. Disk updates do not reload contexts.

## Authorization and evidence

Separate product development, consumer research and validation. Documentation checks are read-only: do not create test projects or fixtures, inspect private research conversations, invoke models, write test content into research or continue it for validation. In this absorption task, leave point1 and `runs/topic_selection_20261015/` untouched; observe any improvement only during its normal authorized progress.

Honor the authorized `TMPDIR`, not system `/tmp`. Other validation requires its own scope; retained artifacts belong in that authorized location, not consumer research. Never manufacture user confirmation.

Report actual and unrun checks separately. Distinguish source instructions, generated resources/bundles, installed files, loaded context, observed behavior and scientific results. A software pass, rendered card or successful installation does not prove model adoption, generalization, completion or mentor effectiveness. Report denials and incomplete actions at their actual scope.

Behavioral acceptance comes from normal authorized use, not a dedicated test project. Observation targets in `docs/development/FINAL_EXPECTATIONS.md` are pending until actually observed and remain separate from software checks.
