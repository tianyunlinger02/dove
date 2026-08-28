# Packaging

## Delivery model

Dove 3.0.0 is one host-neutral Node.js 22 npm artifact. It installs the `dove` executable for the current user. Consumer projects invoke `dove` from `PATH`; project initialization installs host-facing Markdown resources and software metadata, not copied runtime bundles.

The bare public npm package named `dove` is unrelated. Release instructions must use an exact trusted tarball, Git revision, or internal-registry package version.

## Release inventory

Every Dove 3.0.0 release contains:

- **one Dove research agent** for supported agent hosts;
- **10 flat Skills**: `research`, `status`, `source`, `experiment`, `draft`, `figure`, `review`, `rebuttal`, `lessons`, and explicit-only `auto`;
- generated adapters for the declared host formats;
- the project lifecycle CLI plus Claude SessionStart and prompt hooks;
- public documentation; and
- **3 standalone Node.js bundles**.

There is no Dove research MCP server bundle, research tool registry, MCP CLI command, Research Format runtime, or separate Dove-managed planning, authoring, or reviewing agent. The artifact does contain one hidden Claude support Skill and a fixed project fragment for the external `paper-search-mcp==0.1.4`; it does not contain that Python package.

A Skill is a capability entrance for the Dove agent. An adapter is a generated projection for a host format. Research documents are ordinary researcher-owned Markdown. These concepts intentionally do not map one-to-one.

## Generated host surfaces

Dove supports exactly two host projections:

- Claude Code: `.claude/agents/dove.md`, `.claude/commands/dove/*.md`, ambient resources, hooks, and paper-search MCP integration;
- DeepSeek Harness: `.dsh/skills/dove-*/SKILL.md` for the ten filesystem Skills.

Release copies live under `package-resources/hosts/...`, outside host-recognized repository roots. Installation writes their canonical destination paths into consumer projects. OpenCode, Codex, Cursor, and shared Agents projections are not packaged.

Ambient resources include the Claude ambient rule and hidden intake resources, the hidden `dove-paper-search` support Skill, and the managed SessionStart and prompt hooks.

Adapters are generated from canonical Dove workflow sources. They carry the same Dove agent persona into installed projects: start from the research mainline and decision that matters, use hunches as hypotheses, treat user preferences as tradeoff signals, turn gaps into discriminating evidence or concrete next moves, layer constraints and artifacts by whether they change or protect the mainline decision, and act from evidence and task risk without rushing into aggressive execution or over-defending. They use only tools actually available and approved in the host. Do not edit generated projections independently. Adapter presence does not establish installation, registration, tool availability, project readiness, reviewer identity, or reviewer independence.

Claude Code and DSH are the only supported project initialization paths. DSH support is intentionally limited to filesystem Skills; first-class DSH slash commands, hooks, MCP, or agent services would require a separate Cordis plugin.

## Three runtime bundles

The package contains three standalone Node.js 22 ESM bundles:

| Bundle | Purpose |
|---|---|
| `dist/index.mjs` | Public library bundle. |
| `bin/dove-package.mjs` | Packaged `dove` CLI. |
| `scripts/dove-user-prompt-submit-package.mjs` | Prompt-hook bundle. |

The package contains no MCP server bundle or third-party Python source. The canonical build checks generated adapters, the hidden paper support Skill, and these three bundles for drift. Consumer installation does not regenerate them.

## Project integration

For the supported path, `dove init --host claude` installs the Claude command adapters, Dove agent, ambient resources, SessionStart and prompt hooks, a project status line that shows the absolute project directory, `.dove/install/manifest.json`, and one owned fragment at `.mcp.json#/mcpServers/dove-paper-search`.

The fragment launches the pinned external package through user-provided `uvx`. Dove does not install or bundle Python source, write credentials, register a user-level server, or approve project trust. It also bootstraps only the minimal researcher-owned `.dove/research/RESEARCH.md` entry outside the installation manifest when no research tree exists. Existing `.dove/research/**` bytes remain researcher-owned.

The project installation manifest uses revision `2.0`. Optional ordinary `DOCTOR.md` feedback about Dove itself also lives under `.dove/install/`; there is no Doctor JSON state or issue lifecycle. Managed-file hashes are internal software safety data and are not exposed as research evidence.

Project paths and managed-resource parents must remain contained and unambiguous. Existing matching resources may be recognized without rewriting them. Conflicting or user-modified managed content blocks automatic replacement. Shared configuration keeps unrelated fields and entries.

## Research Markdown ownership

Research context is ordinary Markdown under `.dove/research/`. Fresh project initialization creates only root `RESEARCH.md` as a researcher-owned entry. Mission, Source, Experiment, Review, Claim, and Lesson summaries or topic documents are optional researcher-owned materials created naturally when the work needs them.

Each optional summary is a researcher-owned entrance and synthesis, not a generated index. Lessons are advisory materials and are not mandatory package-owned defaults. Source explanations are useful when available but not mandatory.

The package does not define fixed headings, frontmatter, IDs, enums, machine indexes, stored counts, research hashes, or a mandatory Markdown template. Mission, Source, Experiment, Review, and occasional Claim documents are conventions chosen for readability, not entity stores.

When newly executed central experiment work needs recording, the same Experiment document holds the prospective plan and later actual results. The corresponding Review document may preserve Direct Scientific Review self-checks, independent Reviewer handoff preparation, frozen materials, clarifications, rebuttals, and the actual reviewer Markdown return; author handling is added only when requested, and substantive response and revision remain author-side Dove work. Lessons are optional researcher-owned materials.

## CLI inventory and lifecycle

The packaged CLI exposes:

```text
init, update, reinstall, uninstall, doctor, export-research, hook
```

- `init` creates supported project integration and the minimal researcher-owned `RESEARCH.md` entry in one transaction.
- `update` refreshes recognized integration without rewriting existing `.dove/research/**` content. It does not create missing summaries or replace Lessons materials.
- `export-research` performs an explicit one-time conversion from supported legacy Dove JSON research records state to Markdown directories and archives the original bytes under `.dove/archive/...`. It keeps legacy `.dove/LESSONS.md` as researcher-owned `lessons/imported-lessons.md`, may add output to an existing tree when authorized, does not convert v1, and installs no runtime fallback. A real export requires separate user authorization.
- `uninstall` displays the exact managed removal scope and defaults to No. After confirmation it removes Dove project integration and a recognized retired `.dove/manifest.json` adoption marker when present, while preserving `.dove/research/**`, `.dove/install/DOCTOR.md`, unrecognized legacy-marker files, unrelated settings, hooks, MCP servers, and ordinary files.
- `reinstall` displays the deletion and replacement scope and defaults to No. After confirmation it rebuilds integration while preserving `.dove/research/**`, `.dove/install/DOCTOR.md`, and ordinary project files.
- `doctor` is a read-only developer diagnostic and does not judge science. Host-maintained `DOCTOR.md` feedback is separate and does not require this command.
- `hook session-start` transactionally hot-syncs recognized package-managed integration from the current user-level package and emits no research context.
- `hook user-prompt-submit` first validates the prompt event, then performs the same integration-only hot sync before conservative ambient routing. This bridges valid revision-2.0 projects created before SessionStart. Hidden intake may choose no Dove Skill for contextual follow-ups, explanations, confirmations, or pure judgment-only prompts.
- Hot sync never touches `.dove/research/**`, never migrates legacy state or invokes Complete Reinstall, and guarantees current managed files on disk rather than same-session host reload.
- Stop is not a managed lifecycle hook and does not perform hot sync, research continuation, tool calls, or writes.

There is no `mcp` command and no `migrate-research` command.

## Research and review boundaries

- The host performs real retrieval, analysis, experiments, coding, writing, and figure production with available and approved tools.
- `status` is read-only; a missing overview is reported naturally, and broken links are reported naturally.
- `auto` is explicit-only multi-round work that advances the user-confirmed Workspace mainline; it does not promote subordinate support work into the research direction and asks only when a material direction or real boundary would change the work.
- Review may use Dove's read-only Direct Scientific Review self-check, or declare a frozen handoff for an independent Reviewer when a genuinely isolated persistent host Agent context is available.
- A native role, direct Dove self-check, or local session does not establish independence.
- Tests and packaged artifacts do not certify research claims or Dove research quality.

## Build and release validation

From a source checkout:

```bash
npm ci
npm run release:check
npm run pack:dry-run
```

`npm run check` is the regular software gate. Release validation protects the ten-Skill inventory, Dove agent surface, generated adapter drift, absence of the retired MCP runtime, the three bundle entrypoints, CLI inventory, and package archive contents. Exercise lifecycle behavior separately through the real CLI in an isolated synthetic project when those paths change. These checks can validate canonical wording and generated projection, but they cannot prove that Auto chose or performed the right research action, absorbed Review evidence, continued while useful work remained, or stopped at the correct product boundary.

These checks validate the software release only. They do not prove scientific correctness, research completion, reproducibility, acceptance, independent review, or Dove research quality.

## Stable Markdown and project file boundaries

- Research Markdown has no format or schema version. Future organization changes use ordinary host file operations to rename, move, relink, or consolidate documents while preserving substantive content, failures, limitations, and uncertainty; they do not create a migration framework or runtime fallback.
- Requested artifacts such as drafts, figures, experiment documents, and revisions are created or modified when the task requires them. Additional Dove research Markdown is maintained when the user explicitly asks to record, update, or save it, when results clearly change the research mainline, conclusion, decision, or priority, or when preserving the work's evidence and continuation context is genuinely useful.
- Dove project file operations use cross-platform Node path containment, ordinary-file and symbolic-link checks, same-directory temporary writes, expected-state rechecks, and transactional rollback; they do not require Linux `/proc` features.
- Complete Reinstall displays the current deletion and replacement paths, defaults to No, and after confirmation rereads the project and executes the current plan.
- `DOCTOR.md` is ordinary host-maintained feedback about Dove itself, without JSON projection, issue lifecycle, or CLI ownership.
