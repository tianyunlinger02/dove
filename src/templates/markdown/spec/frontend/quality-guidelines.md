# Quality Guidelines

## Choose checks by impact

Use the smallest checks that exercise the changed contract and its direct consumers. Add a focused real-interface check for runtime changes when authorized; a documentation-only change may need only link/terminology checks, mirror comparison, and scoped `git diff --check`. Do not run unrelated full gates by default. Current commands are declared in `package.json`; there are no separate lint/typecheck scripts to claim as passed.

| Changed surface | Relevant verification entry |
|---|---|
| Frontend specs/templates | Registered `Trellis frontend specs match installed Markdown templates` case in `tests/commands/03-ambient-docs-research-defaults.test.mjs`; it calls `assertTrellisSpecMirrors()` in `tests/commands/ambient-docs.mjs` |
| Guide index or workflow | Affected relative links and script references; compare guide source/template filenames and bytes |
| Research behavior, Skills, generated adapters | Focused cases in `tests/commands/01-agent-and-skills.test.mjs`, `02-generated-adapters.test.mjs`, `03-ambient-docs-research-defaults.test.mjs`; `npm run commands:check` |
| CLI parsing/presentation | `tests/commands/04-cli-parser-renderers.test.mjs`; setup behavior in `05-interactive-setup.test.mjs` |
| Lifecycle, managed files, Dove product hooks | `npm run hot-sync:validate`, `npm run uninstall:validate`, selecting affected coverage |
| Isolated review runtime | `npm run review-runtime:validate` exercises the CLI with a fake Claude executable, not real Claude |
| Local run receipts | `npm run runs:validate` exercises local command lifecycle receipts |
| Behavior evaluation tooling | `npm run behavior:validate`; live `behavior:eval` needs separate authorization and budget |
| Bundle/build contract | `npm run build:check` and relevant source-build tests |
| Authorized installation/release candidate | `npm run check`, `npm run release:check`, `npm run pack:dry-run` as applicable |

Select a registered Node test with `node --test --test-name-pattern '<name>' <test-file>` rather than running its whole suite for an unrelated edit. Validation scripts may create scratch files, execute commands, or build temporary outputs; inspect their scope before running them.

## Protect semantics, not incidental wording

Use the owning [Component](./component-guidelines.md), [Hook](./hook-guidelines.md), [State](./state-management.md), or [Type](./type-safety.md) contract to select assertions; do not duplicate their full checklists here. For research-prompt changes, verify reachable Claude rule + command, agent + command, and standalone DSH contexts, not only exported constants. Preserve shared judgment and workflow order without demanding every capability repeat the common contract. Avoid whole-sentence regexes, mandatory research templates, scientific PASS algorithms, and tests that merely freeze another owner's prose.

Review the affected semantics read-only after focused checks, especially permission boundaries and whether a simplification changes research judgment. Counts and inventory equality can protect sealed software surfaces or mirrors; they are not research progress measures.

## Authorization and evidence

Install/sync and dogfood only in the user-approved `paper-template` workspace unless another location is explicitly approved. Use approved repository-local scratch locations for validation, not root `/tmp` by default. Do not drive real task/research state, run real Claude, or inspect private transcripts just to validate documentation or developer hooks.

Report which checks actually ran and what remains unverified. Separate raw observations, parser output, manual review, software checks, and scientific outcomes; interrupted or budget-limited live cases are not passes. Validators, generated projections, receipts, and real-interface checks establish bounded software evidence only. They do not prove scientific correctness, research completion, reproducibility, acceptance, reviewer independence, or Dove research quality. Healthy disk integration does not prove the intended judgment happened in a host session.
