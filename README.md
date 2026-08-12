# Dove

Dove 3.0.0 is a local-first research workflow for papers, engineering, experiments, figures, review, and revision. The host does the substantive work with its normal file, coding, execution, and research tools. Dove provides clear Skills, role boundaries, project integration, and a lightweight way to preserve research context as ordinary Markdown.

Dove keeps three responsibilities distinct:

- **Planner** frames the goal, scope, unknowns, evidence needs, and stop conditions.
- **Builder/Author** performs research, coding, experiments, writing, figure production, revision, and rebuttal.
- **Reviewer** reads an exact artifact scope in a separate exchange managed by the user and returns Markdown without editing the reviewed files.

Host output, tests, local checks, review returns, and written conclusions are bounded evidence. None alone proves scientific correctness, completion, acceptance, or reviewer independence.

## Dove 3.0 at a glance

Dove 3.0.0 contains:

- **10 flat Skills**: `research`, `status`, `source`, `experiment`, `draft`, `figure`, `review`, `rebuttal`, `lessons`, and explicit-only `auto`;
- **3 roles**: Planner, Builder/Author, and Reviewer;
- generated adapters for the supported host formats;
- a project lifecycle CLI and prompt hook; and
- **3 standalone bundles**: library, CLI, and prompt hook.

Dove 3.0 has no research MCP server, no public research MCP tools or registration step, and no Research Format runtime or research database. Skills use host file and research tools directly.

Generated adapters are canonical projections of Dove workflows. Their presence on disk does not prove host registration, project readiness, tool availability, or reviewer independence. Claude Code remains the supported project initialization path.

## Install and initialize

Requirements: Node.js `>=22`, npm, and Claude Code for the supported project path.

The bare public npm package named `dove` is unrelated. Install an exact trusted tarball, Git revision, or internal-registry version.

```bash
npm install --global <exact-dove-package-specifier>
cd <target-project>
dove init --host claude
```

Initialization installs the Claude-facing Skill adapters, role and ambient resources, prompt hook, and `.dove/install/manifest.json`. It does not start or register an MCP server and does not create research content. Re-enter Claude Code from the initialized project so the host can load the project integration.

Project installation metadata uses manifest revision `2.0`:

```json
{"revision":"2.0"}
```

`.dove/install/` is software metadata. It may also contain Doctor machine state and a readable `DOCTOR.md` with current problems and recent resolutions. Managed-file safety hashes stay internal to installation and file protection; they are not research evidence.

## Skills

| Skill | Purpose |
|---|---|
| `research` | Complete one bounded pass of research, synthesis, or project investigation. |
| `status` | Read the current research overview without writing. |
| `source` | Discover, inspect, compare, and document real sources. |
| `experiment` | Write a prospective plan, execute it with host tools, and append actual results to the same document. |
| `draft` | Create or revise an ordinary project draft from the available evidence. |
| `figure` | Gather real materials, create or revise a figure and caption, and validate them. |
| `review` | Prepare a user-managed review exchange and preserve its actual return in one Review document. |
| `rebuttal` | Perform author-side response and revision from real review findings. |
| `lessons` | Read or maintain the complete advisory Lessons document. |
| `auto` | Run explicit multi-round research within the documented current mainline. |

A direct Skill invocation may be written as, for example:

```text
/dove:research Compare the implementation with the documented design and identify the strongest unresolved question.
```

`auto` is explicit-only. Ambient routing never selects it.

## Research is ordinary Markdown

Research content lives under `.dove/research/` when a project chooses to preserve it. The recommended entry point is `RESEARCH.md`, a concise overview and navigation document. `LESSONS.md` is optional. Other files are human-named topic documents linked from the overview or from one another.

For example, a project might choose:

```text
.dove/research/
├── RESEARCH.md
├── LESSONS.md
├── missions/validate-noisy-data-hypothesis.md
├── experiments/benchmark-under-noise.md
├── reviews/results-section-review.md
└── sources/related-work-notes.md
```

This is an example organization, not a schema. Folders are optional. Dove does not require fixed headings, frontmatter, generated IDs, enums, a machine index, stored counts, or research hashes.

- `RESEARCH.md` should help a reader recover the current mainline, material progress, important conclusions and limits, linked work, and next priorities.
- A missing overview is normal. `status` reports that naturally and does not create one.
- Missing or broken Markdown links are reported as ordinary documentation problems, not as an invalid research state.
- Mission and Source material is recorded in readable natural documents when useful.
- Claims remain careful prose, tables, or linked documents when useful; there is no Claim store.
- Drafts, code, data, logs, figures, papers, and rebuttals remain ordinary project files.

### Experiments

Use one Experiment document throughout the work. Write the prospective question, hypotheses, comparisons, protocol, metrics, stop conditions, cost, risks, and expected artifacts before execution. Then run the experiment with host tools and append the actual procedure, observations, denominators, exclusions, deviations, failures, limitations, uncertainty, and implications to that same document.

Preserve positive, negative, null, mixed, failed, and stopped outcomes. Do not reconstruct a supposedly prospective plan after seeing the result.

### Review

Use one Review document for the whole exchange:

1. record the review purpose, exact project-relative artifact paths, scope limits, rubric, and self-contained reviewer prompt;
2. give only that declared scope and prompt to a separate reviewer session or person chosen and managed by the user;
3. require the reviewer to remain read-only and return Markdown;
4. when the user supplies the actual return, preserve it faithfully in the same Review document; and
5. add the author's interpretation, response, revisions, unresolved issues, and follow-up there or in the directly affected document.

The native Reviewer role supports role separation, but it does not prove reviewer identity or independence. Dove does not launch, impersonate, or certify the reviewer.

## Status and Auto boundaries

`status` is read-only. It reads `RESEARCH.md` when present and follows only the links needed to explain current direction, progress, failures, limits, uncertainty, and priorities. It does not repair files, infer a hidden database state, or write research documents.

`auto` requires an adequately documented current mainline. That mainline is a read-only boundary: Auto may advance work and maintain linked topic documents, but it must not silently redefine the mainline. If the overview is absent, materially incomplete, or evidence requires a mainline change, Auto records or returns a recommendation, reports the block, and stops. It is an explicit foreground workflow, not a daemon, scheduler, or background research service.

## CLI and lifecycle

The runtime CLI exposes:

```text
dove init
dove sync
dove upgrade
dove reinstall
dove doctor
dove export-research
dove hook user-prompt-submit --project <project-root>
```

There is no `dove mcp` command and no `dove migrate-research` command.

- `sync` and `upgrade` refresh recognized project integration without changing `.dove/research/` documents.
- `export-research` is an explicit one-time conversion from supported legacy JSON research state to Markdown. It archives the original legacy JSON bytes under `.dove/archive/...`. It does not convert v1, and normal Dove 3 operation has no runtime fallback to old JSON. Running a real export requires separate user authorization; it is not a routine validation step.
- Complete Reinstall displays the destructive project scope and defaults to No. After confirmation it deletes Dove research under `.dove/` and old Dove archives, then recreates project integration as applicable. Ordinary project files remain untouched.
- `doctor` reports software, installation, and local file-readability facts. Its state belongs under `.dove/install/`; it does not judge scientific quality.

## Documentation

- [Documentation index](docs/README.md)
- [Installation](docs/INSTALL.md)
- [Usage](docs/USAGE.md)
- [Packaging](docs/PACKAGING.md)
- [Capability matrix](docs/CAPABILITY_MATRIX.md)
- [Output samples](docs/DOVE_COMMAND_OUTPUT_SAMPLES.md)

## Source-checkout validation

Use `npm run check` for the regular software gate, `npm run release:check` before packaging, and `npm run pack:dry-run` to inspect the release archive. These checks validate software behavior and packaged artifacts only. They do not certify research claims, completion, or independent review.
