# Dove

Dove is a local-first research agent for papers, experiments, figures, reviews, revisions, and engineering work. It installs one complete Dove persona for the host to use directly, plus ten flat capability commands for explicit entry points.

Dove's job is to advance the user's real research decisions, not to replace research with workflow ceremony. It starts from the current research mainline and the decision that matters, treats hunches and user preferences as hypotheses or tradeoff signals, compares serious candidates with theory and real use conditions, and chooses the feasible action most likely to change or protect the decision.

Dove should bring research drive, not just cautious limitation reporting. It turns gaps into sharp hypotheses, discriminating evidence to seek, or concrete next moves that advance the mainline, while keeping exploration aimed rather than diffuse.

Dove treats rigor, novelty, experiments, validation, engineering, writing, review, documents, and preferences as layered means rather than equal goals. More Markdown, more checks, more experiments, more review, or more internal iteration is not progress unless it clarifies the real question, external context, evidence, or decision.

## First 10 minutes

Requirements:

- Node.js `>=22`
- npm
- Claude Code for the supported project initialization path

Install Dove once for the current user from a release channel that supplies an exact artifact and source revision, then initialize the target project explicitly. The formal npm identity is not frozen, and the bare public npm name `dove` belongs to an unrelated package. Use a packed tarball, exact Git/tag/commit specifier, or exact internal-registry specifier; never treat bare `npm install -g dove` or bare `npx dove` as trusted Dove entry points.

```bash
npm install --global <exact-dove-package-specifier>

cd <target-project>
dove
```

The user-level npm install only places `dove` on the current user's `PATH`; it does not write projects, shell RC files, or user/global host configuration. Project initialization writes `.dove/install/manifest.json`, the Claude project integration, the Dove agent surface, hidden intake support, and the default research Markdown tree.

Running bare `dove` in an interactive terminal opens a project-aware guided setup with Dove's pixel-art bird. It initializes an unconfigured Claude project, offers a safe update when the managed integration is older than the current user CLI, or shows connection diagnostics when integration is current. `NO_COLOR=1` removes styling while keeping the art readable. Piped output stays plain and compact; explicit `--json` or `--format json` modes remain machine-readable.

## Agent and command surface

Claude projects receive `.claude/agents/dove.md`, a direct Dove research-agent surface. Dove also exposes ten flat Skills:

| Skill | Purpose |
|---|---|
| `dove.research` | Complete one bounded pass of research, synthesis, or project investigation. |
| `dove.status` | Read the human-maintained research overview and summaries without writes. |
| `dove.source` | Discover, retrieve, read, verify, and document real sources that materially inform the research. |
| `dove.experiment` | Design, execute, analyze, or record an experiment that advances a research decision. |
| `dove.draft` | Write or revise ordinary project drafts from the available evidence. |
| `dove.figure` | Gather real materials and create or revise figures and captions. |
| `dove.review` | Prepare, import, or inspect a user-managed review in one readable document. |
| `dove.rebuttal` | Perform author-side rebuttal and revision from actual review findings and evidence. |
| `dove.lessons` | Read or maintain advisory Lessons themes and their summary. |
| `dove.auto` | Conduct explicit high-autonomy multi-round research within the documented current mainline. |

Claude Code exposes these as `/dove:*` commands. The OpenCode Dove agent, OpenCode commands, Codex, Cursor, and shared agent-skill files are generated package projections, not proof that those hosts are registered, initialized, or ready.

The commands are capability entrances, not separate personalities. Planning, authoring, and reviewing are not user-switchable Dove personas. Review separation remains user-managed: Dove can prepare or import a review document, but it does not prove reviewer identity, independence, authority, scientific validity, or acceptance.

## Ambient routing

The Claude prompt hook selects hidden `dove-intake` only when the original user prompt is a clear Dove research work request. Intake routing is zero-write, may choose no Dove Skill for contextual follow-ups or judgment-only prompts, and never selects Auto. Slash commands keep their explicit routing.

For prompts such as “现在怎么办”, “要不要继续”, or “should we continue”, Dove should answer directly from the research-agent persona: weigh current evidence, task risk, user preference, and the mainline; state useful hunches as hypotheses; give the judgment and stop unless the user explicitly asks to execute or record.

## Research Markdown

Research context is ordinary Markdown under `.dove/research/`, not a runtime database. The default tree contains:

- root `RESEARCH.md`;
- `missions/MISSIONS.md`, `experiments/EXPERIMENTS.md`, `sources/SOURCES.md`, `reviews/REVIEWS.md`, `claims/CLAIMS.md`, and `lessons/LESSONS.md`;
- six package-managed built-in Lessons themes under `lessons/`.

The overview and summaries are researcher-owned entrances and synthesis documents. The six built-in Lessons themes are replaced by `dove update` and carry a notice directing project-specific guidance to separate naturally named Lessons linked from `lessons/LESSONS.md`. Other topic documents remain naturally named, linked, and researcher-owned.

Dove does not require fixed headings, frontmatter, IDs, enums, hashes, indexes, stored counts, or a mandatory Markdown template. Additional research Markdown is maintained only when the user explicitly asks to record, update, or save it, or when results clearly change the research mainline, conclusion, decision, or priority.

## Source, experiment, figure, and review boundaries

- Search results are candidates until material is retrieved, inspected, and used.
- Figure generation runs on the host side; Dove gathers real materials, creates or revises the ordinary figure and caption, and records context only when useful.
- A central experiment must serve a real problem, key uncertainty, or route decision. If that basis is missing, Dove should investigate the problem or sources rather than inventing a substitute experiment.
- When newly executed central experiment work needs recording, one Experiment document contains the prospective plan and later actual results.
- Review preparation declares project-relative artifact paths and scope. The user manages the separate reviewer or review session. Import preserves the actual returned Markdown faithfully; substantive response and revision remain author-side Dove work.

## Host integration

Generated adapter artifacts exist for OpenCode, Codex, Cursor, shared agent-skill hosts, and Claude Code, but generation is not project readiness. This release supports and accepts Claude project initialization through:

```bash
dove init --host claude
```

Initialization:

- records the initialized host in `.dove/install/manifest.json`;
- registers the project `UserPromptSubmit` and `Stop` hooks;
- installs the project ambient rule, hidden intake skill, Dove agent, hidden paper-search support Skill, and generated project-local commands;
- declares the pinned external `dove-paper-search` MCP server in `.mcp.json` without approval, trust, credentials, or bundled Python source;
- minimally merges only Dove's hook entries into project `.claude/settings.json`;
- preserves unrelated project settings and hooks; and
- never reads or writes user/global host configuration or shell startup files.

Projects do not receive copied Dove runtime files under `bin/`, `dist/`, `mcp/`, or `scripts/`, and project config contains neither an absolute CLI path nor a fallback. Generated business adapters use host tools and stop if needed support is unavailable.

`dove update` refreshes only a project that already has a valid `.dove/install/manifest.json`, using the hosts recorded there. A missing or invalid manifest fails closed; update does not infer hosts from files or adapters. It also creates missing summaries, completes current standard navigation only in `RESEARCH.md` and `lessons/LESSONS.md`, replaces all six built-in Lessons themes, and leaves other researcher-owned documents unchanged.

`dove doctor` is read-only and distinguishes user CLI health, project integration, workspace state, host registration/readiness, and legacy copied runtime. An absent `.dove/research/` after project init is abnormal because the default tree is installed, but status and doctor still report missing content naturally rather than repairing it implicitly.

## Packaging and validation

The packaged CLI exposes:

```text
init, update, reinstall, doctor, export-research, hook
```

The package contains three standalone Node.js 22 ESM bundles:

- `dist/index.mjs`
- `bin/dove-package.mjs`
- `scripts/dove-user-prompt-submit-package.mjs`

It contains no Dove research MCP server bundle, research tool registry, MCP CLI command, or Research Format runtime. The optional paper-acquisition support is the pinned external `paper-search-mcp==0.1.4` project fragment for Claude.

From a source checkout:

```bash
npm run commands:check
npm run commands:validate
npm run check
npm run release:check
npm run pack:dry-run
```

Validation protects software boundaries, generated surface drift, package contents, and lifecycle safety. It does not prove scientific correctness, research completion, reproducibility, acceptance, independent review, or Dove's research quality. Dove's research quality must be judged from code logic, generated natural-language behavior, installed project surfaces, and real interactions with the research mainline rather than prompt counts, validator counts, document counts, checklist completion, or scores.

## Documentation

- [Installation](docs/INSTALL.md)
- [Usage](docs/USAGE.md)
- [Packaging](docs/PACKAGING.md)
- [Capability matrix](docs/CAPABILITY_MATRIX.md)
- [Safe command output samples](docs/DOVE_COMMAND_OUTPUT_SAMPLES.md)
