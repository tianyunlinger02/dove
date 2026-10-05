# Quality Guidelines

## Choose checks by impact

Dove is a research agent, not a security project. Check changed contracts and direct consumers; do not add hypothetical defenses or run unrelated full gates. Documentation changes usually need terminology/link checks, source/template byte comparison and scoped `git diff --check`. Prompt changes additionally need read-only rendering of the actual rule, adapters and relevant agent definitions. Software checks do not establish research quality or live adoption.

Use commands actually declared in `package.json`. This ESM project has no separate lint/typecheck scripts; do not claim they passed. `node --check` can check syntax. Select registered tests with `node --test --test-name-pattern '<name>' <test-file>` and inspect side effects before executing validators.

| Changed surface | Relevant entry |
|---|---|
| Specs/templates | `Trellis specs match their installed Markdown templates` in `tests/commands/03-ambient-docs-research-defaults.test.mjs` |
| Behavior, Skills and generated resources | Focused command tests in `tests/commands/01-agent-and-skills.test.mjs`, `02-generated-adapters.test.mjs`, `03-ambient-docs-research-defaults.test.mjs`; `npm run commands:check` after generation |
| Agent definitions and review behavior | Read-only checks of clean-context tool/material boundaries and rendered briefs/review instructions; no real model invocation needed |
| CLI parsing/presentation | `tests/commands/04-cli-parser-renderers.test.mjs`; setup in `05-interactive-setup.test.mjs` |
| Installation, lifecycle and product hooks | Affected cases in `npm run installation:validate` and `npm run uninstall:validate` |
| Run receipts | `npm run runs:validate -- --receipts-only`, `--timeouts-only`, `--comparisons-only`; full validation creates scratch projects/Git snapshots and needs appropriate scope |
| Runtime writes/transactions | `npm run runtime:validate` |
| Behavior tooling | `npm run behavior:validate`; live `behavior:eval` needs separate authorization and budget |
| Bundle/build | `npm run build:check` |
| Authorized installation/release work | `npm run check`, `npm run release:check`, `npm run pack:dry-run` as applicable |

The removed review runtime, frozen snapshots and route/design CLI are not validation targets to preserve. Update their direct consumers/tests to the mentor and read-only reviewer contracts rather than retaining compatibility code. Generation/build and disk installation are separate operations; leave projections to their owner when work is divided.

## Protect the core, not incidental wording

Tests serve core functionality and valid producer/consumer contracts. Keep direct protection of public surfaces, important domain invariants and consequential failures. Distinguish a stale assertion from a real regression; do not weaken valid checks merely for green output or use the implementation to manufacture expected results. Delete obsolete, duplicate or ownerless tests within authorized scope instead of rescuing coverage appearance. If another agent owns tests, report affected cases without editing them.

Use the owning [Component](./component-guidelines.md), [State](./state-management.md), [Hook](./hook-guidelines.md) and [Type](./type-safety.md) contracts. Check the ordinary Claude rule alone, rule + command, rule + optional agent + command and standalone DSH where relevant. Verify actual relationships rather than full-sentence regexes, prose banlists, word-deletion probes, mandatory scientific templates or automatic PASS algorithms.

For mentor rounds, check that the card/EVAL/current brief drive continuation, round completion means an evaluation result, authorship is retained and the mentor supplies important-result quality assessments. Status reads those materials and answers four plain sentences without new research. Experiment allows development truth access/reruns and reserves freeze, prospective registration and one-use heldout for final confirmation. Historical missions/experiments/claims stay in place without new entries or migration. New briefs/results must not be fabricated in real projects for a software check.

For isolated judgment, check a clean read-only context, specified materials, no execution conversation, no author edits and honest limits on missing grounding. Paper review lists actual files read and distinguishes a current complete-version judgment from historical recommendations. No SHA, frozen gate, persistent session or runtime exchange store is required. Mentor and reviewer definitions are independently scoped, not another researcher identity.

For hook changes, check the exact host event contract. Identity presentation must not mistake an overlong card for a missing one; its first 4096 UTF-8-safe bytes include top-of-card round fields. The one-shot Stop reminder must not loop or continue an explicit pause. SessionStart and Statusline do not repair research or reload rules. Host metadata inspection, if used for the reminder, is not mentor evidence or a durable ledger. Do not schedule Cron or invoke a real model just to validate prompts.

## Authorization and evidence

Keep three contexts distinct:

- **Product development:** `paper_factory` owns canonical source, generated resources, bundles and software checks. Its historical research notes are not consumer research or release evidence.
- **Consumer research:** the explicitly selected project owns its code, results, manuscript and research tree. Integration updates affect only owned software resources.
- **Product validation:** do not create a test project or write test content in real research projects for this change. Use read-only render/import checks and authorized software fixtures when necessary. Realistic or live validation needs its own authorized scope; never invent a user confirmation or inspect private research conversations to obtain it.

Honor TMPDIR and inspect its resolved location before creating scratch material; do not silently fall back to system `/tmp`. Use authorized project-local or configured scratch locations. Retained validation artifacts belong in `runs/` when requested, not real research state. No real Claude run, private transcript inspection or research continuation is needed for documentation validation.

Report actual checks and gaps. Distinguish source instructions, generated resources/bundles, installed disk resources, currently loaded host context and observed model behavior. Drift checks prove projection consistency, not installation or reload; software passes do not prove scientific correctness, generalization, research completion, acceptance or the mentor's effectiveness. Observed research outcomes need their own evidence. Permission denials and incomplete actions remain explicit facts, not concealed by a summary success label.
