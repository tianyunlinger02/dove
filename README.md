# Dove

Dove is a local-first research workflow toolkit for papers, experiments, engineering, and review-driven work.

It gives host agents a small durable layer for Workspace direction, Mission contracts, evidence, substantive outputs, Lessons, and independent Review findings. Planning and execution remain host work.

## Public model

Dove exposes exactly:

- **12 direct Skills**;
- **14 canonical MCP tools**; and
- **60 generated adapters**, 12 for each of OpenCode, Codex, Cursor, shared-agent hosts, and Claude Code.

Generated adapters are package artifacts. Their presence does not establish host registration or readiness.

The three primary responsibilities remain distinct:

- **Planner** defines the goal, scope, dependencies, evidence needs, and completion conditions.
- **Builder/Author** performs substantive research, code, writing, experiments, figures, revisions, and author-side rebuttal.
- **Reviewer** independently assesses one frozen declared artifact scope and returns findings without edits.

## Install and initialize

Requirements are Node.js `>=22`, npm, and Claude Code for the currently accepted project initialization path.

The bare public npm package named `dove` is unrelated. Install an exact Dove release artifact supplied by a trusted release channel:

```bash
npm install --global <exact-dove-package-specifier>
cd <target-project>
dove init --host claude
dove doctor
```

Project initialization writes managed integration under `.dove-install/` plus project-local Claude and MCP configuration. It does not create `.dove/` or a Mission. Re-enter Claude Code from the project, approve Dove MCP if prompted, then run:

```text
/dove:workspace
```

The Workspace Skill inspects the project, states its overall situation and structure, and immediately establishes or replaces one concise research mainline. An explicit archive reset is required for unsupported prior state.

## Direct Skills

Every Skill runs directly and accepts optional user text.

| Skill | Purpose |
|---|---|
| `dove.workspace` | Establish or replace the project research mainline. |
| `dove.mission` | Create a root or child Mission, or reevaluate current research judgment. |
| `dove.status` | Read current Workspace and Mission status without writes. |
| `dove.lessons` | Read or explicitly update the complete canonical Lessons document. |
| `dove.source` | Discover external material, register a captured candidate, or record rejection. |
| `dove.note` | Research and synthesize internal project material into a normal artifact. |
| `dove.experience` | Conceive and prevalidate experiments before protocol freeze. |
| `dove.experiment` | Freeze a formal protocol or record its full-denominator result. |
| `dove.draft` | Write or revise a project draft, then archive its current path and references. |
| `dove.figure` | Gather materials, draw a figure, and archive it with caption and QA. |
| `dove.review` | Freeze scope, run one isolated Reviewer, and archive its findings. |
| `dove.rebuttal` | Perform author-side revision and archive a response tied to current findings. |

A new independent goal creates a root Mission. Continuation, narrowing, comparison, recovery, or follow-up creates a child Mission with explicit parent provenance. Existing work is selected by the exact visible one-based Mission number shown by status.

## Lessons and ambient entry

Dove has one canonical advisory document: `.dove/LESSONS.md`. A read is zero-write. An explicit update reads the complete Markdown first, preserves its machine-only binding, and atomically replaces the complete document under its five stable sections. Lessons create no Mission and are not evidence, authority, or completion proof.

Claude installs two hidden non-slash routes:

- ordinary clear work uses `dove-intake`, chooses `ordinary` or `research`, creates through `create_ambient_dove_mission`, then resumes the original task only after success;
- natural Lessons requests such as “remember this experience” or “reflect on what we learned” use `dove-lessons-intake` and only `manage_dove_lessons`, without creating a Mission.

Both routes may ask one zero-write clarification round for material ambiguity. Slash commands retain explicit routing.

## Domain boundaries

- **Source** is external material discovered and visibly captured with host-native tools before registration. A registered Source is a candidate, not positive trust.
- **Note** is internal project research and synthesis. It is a normal project artifact, not a Dove Note store.
- **Experience** is experimental conception and prevalidation.
- **Experiment** begins at formal protocol freeze and records the real result with denominator, failures, deviations, limitations, and declared checks.
- **Draft**, **Figure**, and **Rebuttal** are thin archive workflows: the host produces the substantive artifact; Dove records its current project path, references, QA, and findings without a parallel mirror.
- **Review** starts one Review Skill Mission, freezes one exact current artifact scope without writes, launches exactly one fresh read-only native `dove-reviewer`, waits synchronously, and atomically archives its structured non-authoritative findings.

## Output and state

Human output comes from `report`. Optional `researchHandoff` and `hostControl` remain machine-only. When a typed closure request is supplied, the host invokes its fixed tool exactly once with bound arguments unchanged and declared outcome fields and defaults.

`.dove-install/` is managed project integration. `.dove/` is user-owned current research state. Dove 0.4.0 reads **Schema 18 only**: unsupported earlier state must be explicitly archived and replaced. There is no state migration, compatibility root, alias, or fallback runtime.

## Documentation

- [Installation](docs/INSTALL.md)
- [Usage](docs/USAGE.md)
- [Packaging](docs/PACKAGING.md)
- [Capability matrix](docs/CAPABILITY_MATRIX.md)
- [Safe output samples](docs/DOVE_COMMAND_OUTPUT_SAMPLES.md)

## Source-checkout validation

```bash
npm ci
npm run build:check
npm run commands:check
npm run commands:validate
npm run mcp:validate
npm run workflow-goals:validate
npm run governance:audit
npm test
npm run release:check
npm run pack:dry-run
```

Generated adapters and standalone bundles are checked release artifacts and are not regenerated during consumer installation.
