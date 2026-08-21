# Usage

## Product model

Dove is a local-first research agent for paper, experiment, engineering, writing, figure, review, and revision work. It gives the host one complete Dove persona plus ten flat capability Skills.

Dove should advance the user's real work rather than replace it with workflow ceremony. It starts from the current research mainline and the decision that matters, uses hunches as hypotheses, treats user preferences as tradeoff signals, and chooses the feasible action most likely to change or protect the research decision.

Dove should bring research drive, not just cautious limitation reporting. It turns gaps into sharp hypotheses, discriminating evidence to seek, or concrete next moves that advance the mainline, while keeping exploration aimed rather than diffuse.

Rigor, novelty, experiments, validation, engineering, writing, review, documents, and preferences are layered means rather than equal goals. More internal iteration, Markdown, checks, review, or experiments is not progress unless it clarifies the real question, external context, evidence, or decision.

## Before daily use

Install the exact Dove artifact once for the current user, then run the guided entry inside the target project:

```bash
npm install --global <exact-dove-package-specifier>
cd <target-project>
dove
```

The bare public npm name `dove` is unrelated and is not a trusted installation specifier. Do not use bare `npm install -g dove`, bare `npx dove`, or `node ./bin/dove-package.mjs` as consumer paths.

Bare `dove` is a project-aware guide. Interactive terminals show Dove's pixel-art bird and offer the one relevant action: configure Claude Code, safely update an older managed integration, inspect connection status, or exit. Piped output is plain text and never waits for input; `--json` and `--format json` remain automation modes on explicit commands. Project setup creates `.dove/install/manifest.json`, Claude project integration, the Dove agent surface, hidden intake support, and the default research Markdown tree.

## Entry modes

### Dove agent

A Claude project receives `.claude/agents/dove.md`. Use that surface when the host supports direct agent switching and you want the complete Dove research persona rather than a single capability command.

The Dove agent can use normal host tools for reading, search, coding, experiments, writing, figures, and validation. It still follows the same boundaries: it does not treat Markdown as a database, does not create documents merely to show work happened, and does not enter multi-round autonomy unless Auto is explicitly requested.

### Ordinary non-slash request

For a normal non-slash request, the installed `UserPromptSubmit` hook selects hidden `dove-intake` only when the original prompt is a clear Dove research work request. Intake may route to the smallest suitable Dove Skill or choose no Skill and let the host answer directly. Routing is zero-write and never selects Auto.

Judgment-only prompts such as “现在怎么办”, “要不要继续”, or “should we continue” should not trigger Skill routing. In Dove or research context, answer directly from the Dove persona: weigh evidence, task risk, user preference, and the research mainline; state useful hunches as hypotheses; give the judgment and stop unless the user explicitly asks to execute or record.

### Explicit slash commands

Use `/dove:*` when a specific capability entrance is the requested action. Claude Code exposes ten flat Skills:

| Skill | Use it for |
|---|---|
| `dove.research` | One bounded pass of research framing, investigation, synthesis, or project work. |
| `dove.status` | Reading the current research overview and relevant summaries without writes. |
| `dove.source` | Discovering, retrieving, reading, verifying, and documenting real sources. |
| `dove.experiment` | Designing, executing when requested, analyzing, or recording an experiment. |
| `dove.draft` | Creating or revising ordinary draft artifacts. |
| `dove.figure` | Gathering materials, making or revising figures, and writing captions. |
| `dove.review` | Preparing, importing, or inspecting a user-managed review document. |
| `dove.rebuttal` | Author-side response and revision from actual review findings. |
| `dove.lessons` | Reading advisory Lessons or maintaining project-specific guidance when explicitly requested. |
| `dove.auto` | Explicit high-autonomy multi-round research inside the documented current mainline. |

The Skills are capability entrances, not separate personas. Planning, authoring, and reviewing are not user-switchable Dove agents. Review remains user-managed and scoped; a local host surface does not prove identity, independence, authority, scientific validity, or acceptance.

## Status

`/dove:status` is strictly read-only. It reports the current mainline, substantive progress, active problems, decisions, and next priorities from ordinary Markdown. It does not initialize, repair, migrate, execute commands, inspect git, or write refresh state.

Missing overviews or broken links are reported naturally rather than classified as database corruption.

## Research Markdown

Research context is ordinary Markdown under `.dove/research/`. The default tree contains:

- root `RESEARCH.md`;
- `missions/MISSIONS.md`, `experiments/EXPERIMENTS.md`, `sources/SOURCES.md`, `reviews/REVIEWS.md`, `claims/CLAIMS.md`, and `lessons/LESSONS.md`;
- six package-managed built-in Lessons themes under `lessons/`.

The overview and directory summaries are researcher-owned entrances and synthesis documents. `dove update` may complete current standard navigation only in `RESEARCH.md` and `lessons/LESSONS.md`. The six built-in Lessons themes are package-managed and replaced as a whole by update; project-specific guidance belongs in separate naturally named Lessons linked from `lessons/LESSONS.md`.

Dove does not require fixed headings, frontmatter, IDs, enums, hashes, indexes, stored counts, or a mandatory Markdown template. Mission, Source, Experiment, Review, and occasional Claim documents are readability conventions, not entity stores.

Additional Dove research Markdown is maintained only when the user explicitly asks to record, update, or save it, or when results clearly change the research mainline, conclusion, decision, or priority.

## Domain workflows

### Source

Network search is a retrieval helper. Search results are non-authoritative candidates until material is retrieved, inspected, and used. Useful source context may be recorded in natural Markdown; Dove does not generate source IDs, fingerprints, or a source database for ordinary research use.

### Experiment

Before treating an experiment as central, establish the real problem, key uncertainty, or route decision it should resolve. If that basis is missing, stop experiment design and identify the project material or relevant sources needed to investigate the problem; do not invent a substitute experiment.

When execution is requested and recording is useful for recovery, state what is being tested and how the result will be judged before running it. Append the actual procedure, result, and interpretation-changing deviation to the same Experiment document when the maintenance trigger is met. Design-only work stops before execution; existing results are analyzed directly; retrospective records remain retrospective.

### Draft and figure

Draft and figure work creates or revises ordinary project artifacts from actual project material. Figure work should gather real materials or data, produce the figure or caption, and check that labels, caption, and content agree with the actual material.

### Review and rebuttal

Review preparation, returned review import, and review-context inspection remain distinct. Preparing a new review creates one naturally named Review document only when requested, records the purpose and project-relative artifact scope, and returns a self-contained prompt for a separate reviewer chosen and managed by the user.

Import preserves the actual returned Markdown faithfully without reconstructing preparation or requiring verdict, severity, finding IDs, or a strict schema. Rebuttal remains author-side Dove work: read the review and artifacts, analyze material findings against evidence, write responses, and make requested revisions.

### Lessons

Lessons are advisory-only. They do not grant permission, establish authority, or satisfy completion evidence. Querying Lessons is read-only. Maintaining Lessons happens only when the user explicitly asks to remember, reflect, or preserve durable guidance. Project-specific guidance should go in researcher-owned Lessons documents, not package-managed built-in themes.

### Auto

Auto is explicit-only multi-round foreground work using the same Dove agent persona. It requires an existing `.dove/research/RESEARCH.md` mainline. If the overview is absent, materially incomplete, or evidence says the mainline must change, Dove reports that boundary and stops before autonomous work. It creates a saved recommendation artifact only when the user requested one; otherwise it returns the recommendation directly.

Auto continues without a default round count until the goal is achieved, budget ends, no feasible action is likely to change the research decision, a safety or mainline boundary is reached, or a required Review return is unavailable.

## Integration maintenance

From an initialized project, `dove update` refreshes only hosts recorded in `.dove/install/manifest.json`; a missing or invalid manifest fails closed. Claude Code is the supported initialization path; the OpenCode Dove agent and other generated projections do not by themselves establish host readiness. `dove doctor` is read-only and separately reports the user CLI, project integration, research state, host registration/readiness, and legacy copied runtime. Paper-search readiness depends on the declared `dove-paper-search` project MCP being approved and connected.

Project hook configuration invokes `dove hook user-prompt-submit --project ...` from the user's `PATH`; the paper-search MCP fragment launches the pinned external package through user-provided `uvx`. Projects do not contain copied Dove runtime, absolute CLI paths, or fallback commands. Legacy copied runtime is reported rather than migrated or deleted automatically.

## Source-checkout validation

These commands are maintainer-only and run from a Dove source checkout:

```bash
npm run commands:check
npm run commands:validate
npm run check
npm run release:check
npm run pack:dry-run
```

Validation protects software release behavior only. It does not prove scientific correctness, research completion, reproducibility, acceptance, independent review, or Dove research quality. Dove research quality must be judged by code logic, generated natural-language behavior, installed project surfaces, and real interaction with the research mainline, not by counts, scores, or checklist completion.
