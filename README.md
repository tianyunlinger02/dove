# Dove

Dove is a local-first research agent for papers, experiments, figures, reviews, revisions, and engineering work. It installs one complete Dove agent for the host to use directly. Users can tell Dove the goal in natural language, and nine optional specialist Skills provide explicit shortcuts when useful.

Dove's job is to advance the user's real research decisions, not to replace research with workflow ceremony. Autonomous multi-round research progression is the default for a confirmed goal: Dove anchors on the user-confirmed Workspace mainline, identifies the highest-level active limit, keeps candidate explanations explicit, chooses a discriminating action, absorbs the result, and continues while an effective in-scope action can still change or protect the decision.

Dove should bring research drive, not just cautious limitation reporting. It turns gaps into sharp hypotheses, discriminating evidence to seek, or concrete next moves that advance the mainline, while keeping exploration aimed rather than diffuse.

Across those decisions, contribution, mechanism, novelty, and positioning sit above method, evidence, experiment analysis, baselines, and failure analysis; those sit above argument, writing, and figures; delivery remains last. More Markdown, more checks, more experiments, more review, or more internal iteration is not progress unless it clarifies the real question, external context, evidence, or decision. A bounded task can finish its requested artifact or pass, but that completion must not masquerade as higher-level research progress. When a feasible high-level action exists, Dove does it before local cleanup or narrowing claims; it narrows claims only when evidence or a real boundary requires it, and asks the user before changing the confirmed mainline, contribution, or completion meaning. For submission readiness, a promising core result or a narrow claim correction is not enough: Dove judges the actual manuscript and required materials against the target venue, treats major scientific or scholarly revision needs as blockers to a submit-ready verdict, and reopens earlier conclusions when broader evidence contradicts them.

## First 10 minutes

Requirements:

- Node.js `>=22`
- npm
- Claude Code or DeepSeek Harness (`dsh`) for supported project integration

Install Dove once for the current user from a release channel that supplies an exact artifact and source revision, then initialize the target project explicitly. The formal npm identity is not frozen, and the bare public npm name `dove` belongs to an unrelated package. Use a packed tarball, exact Git/tag/commit specifier, or exact internal-registry specifier; never treat bare `npm install -g dove` or bare `npx dove` as trusted Dove entry points.

```bash
npm install --global <exact-dove-package-specifier>

cd <target-project>
dove
```

The user-level npm install only places `dove` on the current user's `PATH`; it does not write projects, shell RC files, or user/global host configuration. Project initialization writes `.dove/install/manifest.json`, the Claude project integration, the Dove agent surface, hidden intake support, and the minimal researcher-owned `.dove/research/RESEARCH.md` entry.

Running bare `dove` in an interactive terminal opens a project-aware guided setup with Dove's pixel-art bird. For an unconfigured Claude project it offers explicit initialization, for an out-of-date current integration or adoptable Markdown research tree it offers safe update, and for a current integration it shows connection diagnostics. `NO_COLOR=1` removes styling while keeping the art readable. Piped output stays plain and compact; explicit `--json` or `--format json` modes remain machine-readable.

## Agent and command surface

Claude projects receive `.claude/agents/dove.md`, a direct Dove research-agent surface. Users normally tell Dove the goal directly; the nine flat Skills are optional specialist shortcuts:

| Skill | Purpose |
|---|---|
| `dove.research` | Advance a confirmed research goal through Dove's default multi-round research progression. |
| `dove.status` | Read the research overview, relevant summaries, and necessary linked context without writes. |
| `dove.source` | Discover, retrieve when available, read, verify, and document useful sources that materially inform the research. |
| `dove.experiment` | Design, analyze, record, or explicitly execute an experiment that advances a research decision. |
| `dove.draft` | Draft, assess, or revise ordinary project text and artifacts from the available evidence. |
| `dove.figure` | Inspect or gather real materials, then create, revise, validate, or caption figures when requested. |
| `dove.review` | Use author-side self-check, delivery review, `dove-review`, returned-review import, or review-context inspection. |
| `dove.rebuttal` | Analyze review findings, draft author-side responses, and make requested evidence-backed revisions. |
| `dove.lessons` | Read advisory Lessons or maintain researcher-owned project Lessons when explicitly asked. |

Claude Code exposes these as `/dove:*` commands and a complete Dove agent. DeepSeek Harness receives the nine project-local filesystem Skills under `.dsh/skills/dove-*/SKILL.md`. Dove does not claim DSH slash commands, hooks, MCP, or a static agent surface without a future Cordis plugin. OpenCode, Codex, Cursor, and shared agent projections are no longer supported or packaged.

The Skills are capability entrances, not separate personalities, stages, or an autonomy switch. Planning, authoring, and reviewing are not user-switchable Dove agent behaviors. `dove-review` is a genuinely isolated, persistent external-review context used after a near-submission paper is frozen into a handoff. It reviews only the current submission-shaped materials for that round, carries its own review history across re-review, and remains separate from Dove's author-side revision and rebuttal work.

## Ambient routing

The Claude prompt hook selects hidden `dove-intake` only when the original user prompt is a clear Dove work request involving research, papers, sources, experiments, drafts, figures, reviews, rebuttals, lessons, or research-adjacent project work. Intake routing is zero-write, may choose no Skill for contextual follow-ups or pure judgment-only prompts, and leaves the Dove agent to choose its internal method. Before routing, the user-installed CLI may transactionally hot-sync package-managed project integration only; it never touches `.dove/research/`. Adoption is never hook-triggered; only explicit `dove update` may adopt a current Markdown research tree plus the legacy `.dove/manifest.json` marker. Slash commands keep their explicit routing.

For prompts such as “现在怎么办”, “要不要继续”, or “should we continue”, Dove should answer directly from the research-agent behavior: weigh current evidence, task risk, user preference, and the mainline; state useful hunches as hypotheses; give the judgment and useful next move, then stop before side effects unless the user asks to execute or record. A confirmed goal-shaped work request invokes Dove's default research progression without requiring a separate autonomy command.

## Research Markdown

Research context is ordinary Markdown under `.dove/research/`, not a runtime database. Fresh initialization creates only the researcher-owned root `RESEARCH.md` entry. Mission, Experiment, Source, Review, Claim, and Lesson summaries or topic documents are optional materials created naturally when the work needs them.

The overview, optional summaries, topic documents, and Lessons are researcher-owned entrances and synthesis documents. Dove update, hot sync, reinstall, and uninstall do not rewrite, complete, normalize, or delete existing `.dove/research/**` content.

Dove does not require fixed headings, frontmatter, IDs, enums, hashes, indexes, stored counts, or a mandatory Markdown template. Additional research Markdown is maintained when the user explicitly asks to record, update, or save it, when results clearly change the research mainline, conclusion, decision, or priority, or when preserving the work's evidence and continuation context is genuinely useful.

## Source, experiment, figure, and review boundaries

- Search results are candidates until material is retrieved, inspected, and used.
- Figure work runs on the host side; Dove inspects or gathers real materials, creates, revises, validates, or captions figures when requested, and records context only when useful.
- A central experiment must serve a real problem, key uncertainty, or route decision. If that basis is missing, Dove should pause central experiment design and investigate the problem, sources, or a smallest low-risk diagnostic rather than inventing a substitute experiment.
- When newly executed central experiment work needs recording, one Experiment document contains the prospective plan and later actual results.
- Review work may use Dove's read-only author-side scientific self-check or `dove-review`. `dove-review` starts only from a frozen near-submission handoff, sees only the submitted materials listed for that round, and persists as the same external-review context for later whole-paper re-review. Its findings are evidence for Dove's author context to analyze and act on; rebuttal and revision remain author-side work.

## Host integration

Dove supports exactly two project hosts:

```bash
dove init --host claude
dove init --host dsh
```

Claude Code receives the complete agent, commands, ambient hooks, status line, project-scoped WebFetch denial, the pinned paper-search MCP integration, and the Exa hosted MCP for ordinary webpage reading. DSH receives nine filesystem Skills only and no Claude permissions or MCP projection.

Initialization:

- records the initialized host in `.dove/install/manifest.json`;
- registers the project `SessionStart` and `UserPromptSubmit` hooks;
- installs the project ambient rule, hidden intake skill, Dove agent, hidden paper-search support Skill, hidden web-reader support Skill, and generated project-local commands;
- declares the pinned external `dove-paper-search` MCP server and the Exa hosted MCP in `.mcp.json` without approval, trust, credentials, or bundled Python source;
- minimally merges Dove's hook entries, a project-scoped WebFetch denial, and a project status line showing the absolute project directory into `.claude/settings.json`;
- preserves unrelated project settings and hooks; and
- never reads or writes user/global host configuration or shell startup files.

Projects do not receive copied Dove runtime files under `bin/`, `dist/`, `mcp/`, or `scripts/`, and project config contains neither an absolute CLI path nor a fallback. Built-in `WebSearch` remains available for web discovery; built-in `WebFetch` is denied in Claude project settings so ordinary webpage bodies and known URLs go through the approved Exa MCP, while scholarly papers continue through the pinned `dove-paper-search` MCP. Generated business adapters use host tools and stop if needed support is unavailable; they do not use CLI, shell, `curl`, or ad hoc fetch-script fallbacks.

After the user-level Dove package changes, `SessionStart` refreshes recognized package-managed integration from the `dove` command on `PATH`; projects initialized before this hook existed are bridged on their next `UserPromptSubmit`. This automatic hot sync is transactional, accepts only a valid same-package revision-2.0 manifest, never touches `.dove/research/`, and does not imply that Claude reloads changed commands, agents, rules, or Skills in the same running session. Stop never performs hot sync. Complete Reinstall is unrelated and always requires explicit confirmation.

`dove update` remains the explicit broader lifecycle command. It refreshes only a project that already has a valid `.dove/install/manifest.json`, or a current Markdown research tree plus the legacy `.dove/manifest.json` adoption marker. The adoption path creates the revision-2.0 installation manifest and safely merges only the current package-managed Claude hooks, WebFetch denial when Dove needs to add it, status line, `dove-paper-search` MCP declaration, and Exa MCP declaration; it preserves research bytes, DOCTOR notes, `.dove-archive`, old markers, private state, unrelated hooks, unrelated servers, and any pre-existing user-owned WebFetch deny. A missing or invalid manifest fails closed; update does not infer hosts from files or adapters. Existing `.dove/research/**` content is left untouched.

`dove uninstall` previews its exact removal scope, requires confirmation, removes Dove-owned host integration and the current installation manifest, and also removes a recognized retired `.dove/manifest.json` adoption marker when present. It preserves `.dove/research/**`, `.dove/install/DOCTOR.md`, unrecognized files at the legacy marker path, unrelated settings, hooks, MCP servers, and any WebFetch denial that existed before Dove adopted the project. A project retaining only current research Markdown is then reported as unconfigured rather than updateable. `dove doctor` is read-only and distinguishes user CLI health, project integration, workspace state, host registration/readiness, and legacy copied runtime. Missing research Markdown is reported naturally rather than repaired implicitly.

## Packaging and validation

The packaged CLI exposes:

```text
init, update, reinstall, uninstall, doctor, export-research, hook
```

The package contains three standalone Node.js 22 ESM bundles:

- `dist/index.mjs`
- `bin/dove-package.mjs`
- `scripts/dove-user-prompt-submit-package.mjs`

It contains no Dove research MCP server bundle, research tool registry, MCP CLI command, or Research Format runtime. Claude project support declares the pinned external `paper-search-mcp==0.1.4` fragment for scholarly papers and the Exa hosted remote MCP fragment for ordinary webpage bodies and known URLs.

From a source checkout:

```bash
npm run commands:check
npm run commands:validate
npm run check
npm run release:check
npm run pack:dry-run
```

Validation protects software boundaries, generated surface drift, package contents, and lifecycle safety. It does not prove scientific correctness, research completion, reproducibility, acceptance, `dove-review` independence, or Dove's research quality. Dove's research quality must be judged from code logic, generated natural-language behavior, installed project surfaces, and real interactions with the research mainline rather than prompt counts, validator counts, document counts, checklist completion, or scores.

## Documentation

- [Installation](docs/INSTALL.md)
- [Usage](docs/USAGE.md)
- [Packaging](docs/PACKAGING.md)
- [Capability matrix](docs/CAPABILITY_MATRIX.md)
- [Safe command output samples](docs/DOVE_COMMAND_OUTPUT_SAMPLES.md)
