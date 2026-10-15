# Quality Guidelines

## Choose checks by impact

Dove is a research agent, not a security project. Check changed contracts and direct consumers without adding speculative defenses or unrelated gates. Documentation work needs terminology/link inspection, source/template byte comparison, length comparison and scoped `git diff --check`. Prompt work also benefits from read-only rendering of the affected rule, Skills and agent definitions. Neither establishes live adoption or scientific quality.

Use commands actually declared in `package.json`. This ESM project has no separate lint or typecheck scripts; do not report either as passed. `node --check` checks syntax. Where tests are authorized, select existing cases with `node --test --test-name-pattern '<name>' <test-file>` after inspecting side effects.

| Changed surface | Relevant checks when authorized |
|---|---|
| Specs/templates | Direct byte comparison; the existing mirror case in `tests/commands/03-ambient-docs-research-defaults.test.mjs` |
| Behavior, Skills and resources | Focused cases in `tests/commands/01-agent-and-skills.test.mjs`, `02-generated-adapters.test.mjs` and `03-ambient-docs-research-defaults.test.mjs`; `npm run commands:check` for projections |
| Native agents | Rendered material/tool boundaries, mentor handoff and reviewer instructions; no model invocation is needed |
| CLI | Affected parser/renderer cases in `tests/commands/04-cli-parser-renderers.test.mjs` and setup cases in `05-interactive-setup.test.mjs` |
| Lifecycle and hooks | Relevant installation/uninstall validators and registered-project cases |
| Watch, topics and dashboard | Relevant existing cases in `tests/paper-watch.test.mjs`, `tests/topic-selection.test.mjs` and `tests/dashboard.test.mjs` |
| Receipts and writes | Scoped `runs:validate` options and `runtime:validate`; inspect scratch/Git side effects first |
| Behavior tooling and release | `behavior:validate`, `build:check`, `check`, `release:check` or `pack:dry-run` only within their authorized scope |

Generation, build, installation and host loading are separate operations. Leave projections to their owner when work is divided. Do not retain obsolete review runtimes or compatibility behavior just to satisfy stale assertions.

## Protect contracts, not incidental wording

Use [Component](./component-guidelines.md), [State](./state-management.md), [Hook](./hook-guidelines.md) and [Type](./type-safety.md) as the owning specifications. Check relationships and consequential behavior, not full-sentence regexes, prose banlists or automatic scientific PASS algorithms. A structural rewrite should remove superseded sections and duplicated duties, use complete sentences and reduce total length rather than append compressed rules.

For this research contract, verify that the affected surfaces agree on:

- User confirmation, not a card entry, ends topic selection. Existing standards are mandatory; broad parallel generation precedes assessment, real searches expand candidates, and 2–3 recommendations go to the user before method implementation. Only standards-allowed diagnostics precede selection.
- Scale and change answer the actual question. Pipeline connection is not proof of a designed and tested core mechanism. Engineering, parameters and evaluator repairs belong to the executor, with full comparable-history recomputation.
- Mentor calls occur at round end, two no-science rounds, user direction/story corrections and before route changes. Engineering/verification failures count; the third no-science round needs a user decision before more work. New rounds use new contexts, while 2–3 clarifications may stay within one judgment. Handoffs contain materials and four fixed questions, with opinions labeled separately.
- Card field order, record caps, one method-version row, current rather than logged assessment, verbatim mentor notes and ordinary linked attachments follow State Management. Preserve original-versus-relayed and long-term-versus-task provenance.
- Every mentor checks draft tracking configuration, unjudged impacts and absent/overdue weekly scans without waiting for a round. New dated impact files and existing brief judgments remain readable. Retrieval checks cover no-key Semantic Scholar behavior, rate-limit backoff and relevance beyond one generic title term.
- Method changes get full applicable evaluation and genuinely fresh tests after prior test use. External utility and internal attribution remain distinct. Status and bounded replies need no handoff or record merely to end the reply.

The mentor reads specified genuine user bodies, its own notes and quality guidance, and may retrieve paper/web sources. It does not read execution conversation or author preferences, compute or edit. The paper reviewer reads only listed current manuscript materials and supplied grounding through Read/Grep/Glob, with no transcript or network access. Missing sources mean unknown provenance, not revoked user commitments. Native isolation needs no frozen copy, SHA snapshot, persistent session or new exchange store.

Hook checks retain the UTF-8-safe first 4096 bytes of an overlong card and supply a user-source pointer rather than transcript contents. Retired Stop checks cover unchanged owned removal, preservation of modified/missing ownership and unowned hooks, and repeat-sync behavior. Disk changes do not reload an existing context.

## Authorization and evidence

Keep product development, consumer research and product validation separate. This repository owns software; the selected consumer project owns its research. For this restructuring, do not create test projects, fixtures or test content in real research, inspect private research conversations, invoke models or continue research for validation. Documentation checks are read-only and need none of those actions. Other validation requires its own scope; never manufacture a user confirmation.

When scratch work is authorized elsewhere, inspect and honor `TMPDIR` rather than silently using system `/tmp`. Retained validation artifacts belong in an authorized location such as `runs/`, not consumer research state.

Report actual checks and unrun checks separately. Distinguish source instructions, generated resources/bundles, installed disk resources, loaded host context, observed model behavior and scientific outcomes. A software pass is not generalization, completion, acceptance or mentor effectiveness. Report permission denials and incomplete actions at their actual scope.

Behavioral acceptance comes from authorized normal use in the projects that exposed the problem, not a dedicated test project. The observation targets are in `docs/development/FINAL_EXPECTATIONS.md`; report those outcomes separately from software checks. Installation or an updated prompt alone does not establish improvement.
