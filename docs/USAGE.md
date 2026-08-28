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

Bare `dove` is a project-aware guide. Interactive terminals show Dove's pixel-art bird and offer the one relevant action: configure Claude Code, safely update an out-of-date current integration or adoptable Markdown research tree, inspect connection status, or exit. Piped output is plain text and never waits for input; `--json` and `--format json` remain automation modes on explicit commands. Project setup creates `.dove/install/manifest.json`, Claude project integration, the Dove agent surface, hidden intake support, and the minimal researcher-owned `.dove/research/RESEARCH.md` entry.

## Entry modes

### Dove agent

A Claude project receives `.claude/agents/dove.md`. Use that surface when the host supports direct agent switching and you want the complete Dove research persona rather than a single capability command.

The Dove agent can use available and approved host tools for reading, search, coding, experiments, writing, figures, and validation. It still follows the same boundaries: it does not treat Markdown as a database, does not create documents merely to show work happened, and does not enter multi-round autonomy unless Auto is explicitly requested.

### Ordinary non-slash request

For a normal non-slash request, the installed `UserPromptSubmit` hook selects hidden `dove-intake` only when the original prompt is a clear Dove work request involving research, papers, sources, experiments, drafts, figures, reviews, rebuttals, lessons, or research-adjacent project work. Intake may route to the smallest suitable Dove Skill or choose no Skill and let the host answer directly. Routing is zero-write and never selects Auto. Before routing, the user-installed CLI may transactionally hot-sync package-managed project integration; this lifecycle bridge never touches `.dove/research/`.

Pure judgment-only prompts such as “现在怎么办”, “要不要继续”, or “should we continue” should not trigger Skill routing. In Dove or research context, answer directly from the Dove persona: weigh evidence, task risk, user preference, and the research mainline; state useful hunches as hypotheses; give the judgment and useful next move, then stop before side effects unless the user explicitly asks to execute or record. If the prompt asks Dove to judge and then perform the bounded action when useful, route that bounded work instead of treating it as pure judgment.

### Explicit slash commands

Use `/dove:*` when a specific capability entrance is the requested action. Claude Code exposes ten flat Skills:

| Skill | Use it for |
|---|---|
| `dove.research` | One bounded pass of research framing, investigation, synthesis, or project work. |
| `dove.status` | Reading the research overview, relevant summaries, and necessary linked context without writes. |
| `dove.source` | Discovering, retrieving when available, reading, verifying, and documenting useful sources. |
| `dove.experiment` | Designing, analyzing, recording, or explicitly executing experiments. |
| `dove.draft` | Drafting, assessing, or revising ordinary project text and artifacts. |
| `dove.figure` | Inspecting or gathering materials, then creating, revising, validating, or captioning figures. |
| `dove.review` | Using Direct Scientific Review self-check, delivery review, independent Reviewer Handoff, returned-review import, or review-context inspection. |
| `dove.rebuttal` | Analyzing review findings, drafting author-side responses, and making requested revisions. |
| `dove.lessons` | Reading advisory Lessons or maintaining researcher-owned project Lessons when explicitly requested. |
| `dove.auto` | Explicit foreground multi-round work that advances the user-confirmed Workspace mainline within the user's limits. |

The Skills are capability entrances, not separate personas. Planning, authoring, and reviewing are not user-switchable Dove agents. `/dove:review` may run read-only Direct Scientific Review self-check or prepare/import an independent Reviewer Handoff. Direct self-check can give a natural-language whole-paper acceptability recommendation, but it is author-side and not independent. Independent review requires a genuinely isolated persistent host Agent context, a frozen handoff, and a whole-paper recommendation with scientific acceptability separated from delivery readiness; if the host lacks that isolation, Dove reports the boundary rather than simulating it.

## Status

`/dove:status` is strictly read-only. It reports the current mainline, substantive progress, active problems, decisions, and next priorities from ordinary Markdown. It does not initialize, repair, migrate, execute commands, inspect git, or write refresh state.

Missing overviews or broken links are reported naturally rather than classified as database corruption.

## Research Markdown

Research context is ordinary Markdown under `.dove/research/`. Fresh initialization creates only the researcher-owned root `RESEARCH.md` entry. Mission, Source, Experiment, Review, Claim, and Lesson documents are optional materials created naturally when the work needs them.

The overview, optional summaries, and Lessons are researcher-owned entrances and synthesis documents. `dove update`, hot sync, reinstall, and uninstall do not rewrite, complete, normalize, or delete existing `.dove/research/**` content.

Dove does not require fixed headings, frontmatter, IDs, enums, hashes, indexes, stored counts, or a mandatory Markdown template. Mission, Source, Experiment, Review, and occasional Claim documents are readability conventions, not entity stores.

Additional Dove research Markdown is maintained when the user explicitly asks to record, update, or save it, when results clearly change the research mainline, conclusion, decision, or priority, or when preserving the work's evidence and continuation context is genuinely useful.

## Domain workflows

### Source

Network search is a retrieval helper. Search results are non-authoritative candidates until material is retrieved, inspected, and used. Useful source context may be recorded in natural Markdown; Dove does not generate source IDs, fingerprints, or a source database for ordinary research use.

### Experiment

Before treating an experiment as central, establish the real problem, key uncertainty, or route decision it should resolve. If that basis is missing, pause central experiment design and inspect the project material, relevant sources, or a smallest low-risk diagnostic needed to investigate the problem; do not invent a substitute experiment.

When execution is requested and recording is useful for recovery, state what is being tested and how the result will be judged before running it. Append the actual procedure, result, and interpretation-changing deviation to the same Experiment document when the maintenance trigger is met. Design-only work stops before execution; existing results are analyzed directly; retrospective records remain retrospective.

### Draft and figure

Draft and figure work drafts, assesses, creates, or revises ordinary project artifacts from actual project material when the requested deliverable requires it. Actual drawing, redrawing, figure revision, generation, captioning, or material figure validation should use the Figure capability. Figure first establishes the visual's evidence job and gathers the relevant data, selection metadata, source visuals, plotting or rendering logic, caption, nearby claim, and intended manuscript layout. It uses the best-suited tool: real data and reproducible plotting code for quantitative plots; an available specialized figure-generation model for method diagrams, conceptual illustrations, or visual abstracts when appropriate; and image, layout, SVG, or annotation tools for composition and repair. It validates the rendered figure in the real manuscript layout and at realistic final size; a standalone image or contact sheet is not enough. Generated visuals remain unverified until their text, structure, scientific relationships, caption, manuscript claim, source data, and selection logic agree. Scratch renders belong in repository-local `.claude/tmp/`, not system `/tmp`.

### Review and rebuttal

Direct Scientific Review self-check, independent Reviewer Handoff, returned review import, and review-context inspection remain distinct. Before direct self-check or handoff preparation, Dove establishes the external review context that can change the judgment: current official venue requirements where applicable, and a small, discriminating set of relevant published work for novelty, positioning, evidence norms, experiment presentation, and reader expectations. It distinguishes material merely found from material retrieved, inspected, and actually used; published papers never substitute for official venue rules, and there is no fixed paper count or checklist. For submission readiness, Direct Scientific Review self-check forms a fresh author-side judgment from the actual manuscript rather than inheriting Auto's verdict or package summary. It reconstructs the central contribution, traces the decisive claims to the evidence offered, identifies the strongest plausible falsifier or informed-reader objection, and gives a natural-language acceptability recommendation for the current full paper; later substantive review evidence reopens an earlier optimistic verdict instead of being reduced to cleanup. Scientific judgment comes before delivery-only package gaps: format, build, file validity, and author fields may block submission, but cannot establish or truncate manuscript readiness. Independent Reviewer Handoff requires a frozen handoff, a genuinely isolated persistent host Agent context, and a whole-paper recommendation with scientific acceptability separated from delivery readiness. The Reviewer may see only the listed materials for the current full paper. Image counts, caption presence, DOCX/PDF embedding, file validity, a contact sheet, or merely opening the images are not proof of quality. A submission-readiness Review cannot count as acceptable when a material figure was not inspected in context, was only superficially checked, or remains a plausible communication or data-agreement blocker. Preparing an independent Reviewer Handoff creates one naturally named Review document only when requested or when Auto reaches author-side submission readiness, records the purpose and frozen project-relative artifact scope, and invokes a genuinely isolated host Reviewer context with that self-contained prompt when the host provides one. The user may mediate between author and Reviewer, but the Reviewer never reads author private transcript, unstated materials, or hidden notes; cosmetic-only changes, selective evidence, hidden counterevidence, diff-only review, and restarting Reviewer context to escape objections are not acceptable.

Returned-review import and ordinary context inspection do not trigger venue or paper search merely because Review was invoked. Import preserves the actual returned Markdown faithfully without reconstructing preparation or requiring verdict, severity, finding IDs, or a strict schema. Rebuttal remains author-side Dove work: read the review and artifacts, analyze material findings against evidence, write responses, and make requested revisions.

### Lessons

Lessons are advisory-only. They do not grant permission, establish authority, or satisfy completion evidence. Querying Lessons is read-only and uses `lessons/LESSONS.md` only if it exists. Maintaining Lessons happens only when the user explicitly asks to remember, reflect, or preserve durable guidance. Lessons documents are researcher-owned optional materials, not mandatory package-owned defaults.

### Auto

Auto is explicit-only foreground multi-round work using the same Dove agent persona. It reads the user-confirmed Workspace mainline and current execution context from relevant research Markdown, the current conversation, and actual project artifacts. It keeps that mainline stable rather than reconstructing, replacing, or broadening it from recent tasks, old Reviews, summaries, or model inference. An Auto prompt suffix supplies an immediate in-scope goal; suffix-free `/dove:auto` continues toward the mainline's own completion condition. If the mainline has not been confirmed, Dove proposes a concise interpretation and asks the user before autonomous multi-round work.

For a paper submission-readiness mainline, Auto uses LaTeX as the authoritative manuscript source and primary working format by default and verifies the actual compiled output. It uses another format only when the target venue's official requirements do not provide or accept LaTeX. Auto distinguishes the manuscript source, scholarly basis, venue-facing materials, and build path; a convenient exporter or generated artifact does not decide the format or prove readiness. Review is an advisory capability used when a fresh adversarial judgment can materially improve the next action or readiness decision. Its findings and recommendations are evaluated and acted on, but no runtime Skill call, score, enum, schema, or earlier recommendation controls the Workspace mainline or completion. Figure and other capabilities are likewise used when they materially improve the next action, not as mandatory stages or gates. Stop is not a managed lifecycle hook and does not drive continuation.

Auto runs a mainline-evidence-action-outcome continuation cycle within the user's limits. It judges what was found, accessed, inspected, used, executed, verified, contradicted, or remains missing, then uses Explore, Execute, and Express as orthogonal action lenses rather than stages, roles, Skills, or a fixed sequence. Dove chooses the capability or specialized help that best advances the current decision, performs the action, and compares the result with the mainline or immediate goal. A checkpoint is internal, not a default stopping point; if another feasible action can still change the outcome, Auto performs it instead of ending with that action as a future next step. A hard context boundary preserves the exact unfinished action for resumption and is not completion or a scientific blocker.

It prioritizes the scientific problem, contribution and novelty, theory and method, experiments and result interpretation, argument, figures, writing, and reviewer risk; evidence, provenance, validation, engineering, supplementary material, and Markdown remain subordinate support unless they materially change the scientific judgment. Before calling a manuscript submit-ready, Auto distinguishes a promising scientific core or local wording fix from whole-manuscript readiness, judges the latest actual manuscript, evidence, and required materials against the target venue, treats material scientific or scholarly revision needs as active, and revises an earlier optimistic judgment when broader evidence or grounded Review contradicts it. Auto continues while another feasible in-scope action can advance or protect the confirmed mainline. It stops when the mainline or immediate goal is achieved, a material blocker cannot be resolved within it, or a user decision or explicit external boundary is required. Context interruption preserves the exact unfinished action for continuation rather than becoming completion or a scientific blocker.

## Integration maintenance

From an initialized project, `dove update` refreshes only hosts recorded in `.dove/install/manifest.json`. Its only absent-manifest adoption path is an explicit `dove update` on a project with a readable current `.dove/research/` Markdown tree and the old `.dove/manifest.json` workspace marker; adoption creates a revision-2.0 manifest, safely claims current package-managed Claude hooks and the `dove-paper-search` MCP declaration, and preserves research bytes, DOCTOR notes, archives, old markers, private state, unrelated hooks, and unrelated MCP servers. A missing or invalid manifest outside that state fails closed. Claude Code is the supported initialization path; the OpenCode Dove agent and other generated projections do not by themselves establish host readiness. `dove doctor` is read-only and separately reports the user CLI, project integration, research state, host registration/readiness, and legacy copied runtime. Paper-search readiness depends on the declared `dove-paper-search` project MCP being approved and connected.

Project hook configuration invokes `dove hook session-start --project ...` and `dove hook user-prompt-submit --project ...` from the user's `PATH`. These lifecycle entries automatically refresh recognized package-managed integration from the current user-level package; UserPromptSubmit bridges older revision-2.0 projects that do not yet contain SessionStart. Hot sync never touches `.dove/research/**`, never adopts absent-manifest projects, never invokes Complete Reinstall, and guarantees only the on-disk managed files—same-session Claude reload remains host-dependent. Dove does not install or expose a Stop hook. The paper-search MCP fragment launches the pinned external package through user-provided `uvx`. Projects do not contain copied Dove runtime, absolute CLI paths, or fallback commands. Legacy copied runtime is reported rather than migrated or deleted automatically.

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
