# Packaging

## Delivery model

Dove 3.0.0 is one host-neutral Node.js 22 npm artifact. It installs the `dove` executable for the current user. Consumer projects invoke `dove` from `PATH`; project initialization installs host-facing Markdown resources and software metadata, not copied runtime bundles.

The bare public npm package named `dove` is unrelated. Release instructions must use an exact trusted tarball, Git revision, or internal-registry package version.

## Release inventory

Every Dove 3.0.0 release contains:

- **one Dove research agent** for supported agent hosts;
- **9 optional specialist Skills**: `research`, `status`, `source`, `experiment`, `draft`, `figure`, `review`, `rebuttal`, and `lessons`;
- generated adapters for the declared host formats;
- the project lifecycle CLI, explicit `dove review ...` runtime, local `dove run ...` execution receipts, plus Claude SessionStart and prompt hooks;
- public documentation; and
- **3 standalone Node.js bundles**.

There is no Auto Skill or command, Dove research MCP server bundle, research tool registry, MCP CLI command, Research Format runtime, or separate Dove-managed planning, authoring, or reviewing agent. The explicit `dove review ...` runtime stores review exchange records under `.dove/reviews/**` and uses the user's installed Claude Code CLI for isolated read-only reviewer sessions; it is not a research database or proof of acceptance. The `dove run ...` helper stores local run receipts under `.dove/runs/**`; it records command execution evidence, not scientific conclusions or cross-host process control. The artifact contains hidden Claude guidance Skills and fixed project fragments for pinned `dove-paper-search` (`paper-search-mcp==0.1.4`) and hosted Exa; it does not contain third-party runtimes or credentials.

A Skill is an optional specialist shortcut for the Dove agent. Users can tell Dove the goal directly; no Auto command is needed for multi-round progression. An adapter is a generated projection for a host format. Research documents are ordinary researcher-owned Markdown. These concepts intentionally do not map one-to-one.

## Generated host surfaces

Dove supports exactly two host projections:

- Claude Code: `.claude/agents/dove.md`, nine `.claude/commands/dove/*.md` optional Skill shortcuts, ambient resources, hooks, paper-search MCP integration, and Exa integration;
- DeepSeek Harness: `.dsh/skills/dove-*/SKILL.md` for the nine filesystem Skills.

Release copies live under `package-resources/hosts/...`, outside host-recognized repository roots. Installation writes their canonical destination paths into consumer projects. OpenCode, Codex, Cursor, and shared Agents projections are not packaged.

Ambient resources include the Claude ambient rule and hidden intake resources, hidden Claude guidance Skills for pinned `dove-paper-search` and hosted Exa use, and the managed SessionStart and prompt hooks.

Adapters are generated from canonical Dove workflow sources. They carry the same Dove agent behavior into installed projects: for a confirmed goal, Dove keeps selecting, performing, and absorbing the overall-best feasible mainline action until the goal is achieved or a real blocker is established. They use only tools the current host exposes and current user/project permissions allow. Do not edit generated projections independently. Adapter presence does not establish installation, registration, tool availability, project readiness, reviewer identity, or `dove-review` independence. Claude's Review command can call `dove review handoff|status|resume|rerun|import`; DSH has no equivalent recoverable isolated Claude Code context in this package and should not present one as available.

Claude Code and DSH are the only supported project initialization paths. The packaged bare `dove` CLI presents both as a checkbox menu, with Claude selected initially and either or both concrete host IDs passed into the existing lifecycle. DSH support is intentionally limited to filesystem Skills; first-class DSH slash commands, hooks, MCP, or agent services would require a separate Cordis plugin.

## Three runtime bundles

The package contains three standalone Node.js 22 ESM bundles:

| Bundle | Purpose |
|---|---|
| `dist/index.mjs` | Public library bundle. |
| `bin/dove-package.mjs` | Packaged `dove` CLI. |
| `scripts/dove-user-prompt-submit-package.mjs` | Prompt-hook bundle. |

The package contains no MCP server bundle or third-party Python source. The canonical build checks generated adapters, hidden Claude guidance Skills for pinned `dove-paper-search` and hosted Exa use, and these three bundles for drift. Consumer installation does not regenerate them.

## Project integration

For the supported path, `dove init --host claude` installs the Claude command adapters, Dove agent, ambient resources, SessionStart and prompt hooks, a project status line that shows the absolute project directory, `.dove/install/manifest.json`, a project-scoped `permissions.deny` entry for built-in `WebFetch`, and owned fragments at `.mcp.json#/mcpServers/dove-paper-search` and `.mcp.json#/mcpServers/exa`.

The `dove-paper-search` fragment launches the pinned external package through user-provided `uvx` for scholarly paper discovery, download, and full-text reading; the Exa fragment is the hosted remote MCP shape `{ "url": "https://mcp.exa.ai/mcp", "type": "http" }` for ordinary webpage bodies, documentation pages, venue pages, and known URLs. Built-in `WebSearch` remains available for search discovery, while built-in `WebFetch` is denied. Dove does not install or bundle Python source, write credentials, register a user-level server, approve project trust, or provide CLI/shell/`curl`/fetch-script substitutions for web retrieval. It also bootstraps only the minimal researcher-owned `.dove/research/RESEARCH.md` entry outside the installation manifest when no research tree exists. Existing `.dove/research/**` bytes remain researcher-owned.

The project installation manifest uses revision `2.0`. Optional ordinary `DOCTOR.md` feedback about Dove itself also lives under `.dove/install/`; there is no Doctor JSON state or issue lifecycle. Managed-file hashes are internal software safety data and are not exposed as research evidence.

Project paths and managed-resource parents must remain contained and unambiguous. Existing matching resources may be recognized without rewriting them. Conflicting or user-modified managed content blocks automatic replacement. Shared configuration keeps unrelated fields and entries.

## Research Markdown ownership

Research context is ordinary Markdown under `.dove/research/`. Fresh project initialization creates only root `RESEARCH.md` as a researcher-owned entry. Mission, Source, Experiment, Review, Claim, and Lesson summaries or topic documents are optional researcher-owned materials created naturally when the work needs them. Local run receipts under `.dove/runs/**` are separate execution records and do not replace Experiment Markdown.

Each optional summary is a researcher-owned entrance and synthesis, not a generated index. Lessons are advisory materials and are not mandatory package-owned defaults. Source explanations are useful when available but not mandatory.

The package does not define fixed headings, frontmatter, IDs, enums, machine indexes, stored counts, research hashes, or a mandatory Markdown template. Mission, Source, Experiment, Review, and occasional Claim documents are conventions chosen for readability, not entity stores.

Research documents may use ordinary Markdown relative links and readable project-relative artifact paths for recovery, but the package does not parse links, audit backlinks, enforce a consistency matrix, or turn them into a database.

When newly executed central experiment work needs recording, the same Experiment document holds the prospective plan and later actual results. The corresponding Review document may preserve author-side scientific self-checks, `dove-review` handoff preparation, frozen materials, clarifications, rebuttals, and the actual reviewer Markdown return; author handling is added only when requested, and substantive response and revision remain author-side Dove work. Lessons are optional researcher-owned materials.

## CLI inventory and lifecycle

The packaged CLI exposes:

```text
init, update, reinstall, uninstall, doctor, review, run, hook
```

Bare `dove` is the interactive lifecycle front door. It classifies the project, shows only safe state-appropriate operations, supports platform selection and platform changes through the existing init/update lifecycle, keeps technical Doctor output behind View details, and requires a real preview plus default-No confirmation before Complete Reinstall or uninstall. Building repository bundles does not refresh a copied user-level npm installation; release deployment must install the exact built artifact into the intended user prefix.

- `init` creates supported project integration and the minimal researcher-owned `RESEARCH.md` entry in one transaction.
- `update` refreshes recognized integration without rewriting existing `.dove/research/**` content. It does not create missing summaries or replace Lessons materials.
- `uninstall` displays the exact managed removal scope and defaults to No. After confirmation it removes Dove project integration and a recognized retired `.dove/manifest.json` adoption marker when present, while preserving `.dove/research/**`, `.dove/reviews/**`, `.dove/runs/**`, `.dove/install/DOCTOR.md`, unrecognized legacy-marker files, unrelated settings, hooks, MCP servers, and ordinary files.
- `reinstall` displays the deletion and replacement scope and defaults to No. After confirmation it rebuilds integration while preserving `.dove/research/**`, `.dove/reviews/**`, `.dove/runs/**`, `.dove/install/DOCTOR.md`, and ordinary project files.
- `doctor` is a read-only developer diagnostic and does not judge science. Host-maintained `DOCTOR.md` feedback is separate and does not require this command.
- `review handoff|status|resume|rerun|import` records explicit `.dove/reviews/<id>/review.json` metadata and per-round `snapshot.json`, `report.md`, and `backend.json`. `handoff` and `rerun` copy only the listed project-relative regular files into the external reviewer workspace, use the Claude Code CLI with Read-only tools, and preserve the real returned session id. `status` is read-only. `import` stores user-supplied Markdown as imported provenance and does not claim the runtime reviewer generated it.
- `run start|status|resume|finalize|compare` records explicit `.dove/runs/<id>/run.jsonl`, `stdout.log`, and `stderr.log` receipts. `start` launches a detached supervisor that directly spawns the target command from the project root without a shell and holds it to exit. `status` is read-only; `resume` never reruns work; `finalize` appends one scalar metric after terminal completion; `compare` ranks only compatible terminal finalized runs.
- `hook session-start` transactionally synchronizes recognized package-managed integration from the current user-level package and emits no research context.
- `hook user-prompt-submit` is zero-write: it validates the prompt event, then conservative ambient routing may add a thin hidden intake bridge only for clearly research-related non-slash requests. It does not synchronize, adopt, repair, select a Skill, or decide execution.
- SessionStart sync never touches `.dove/research/**`, `.dove/reviews/**`, or `.dove/runs/**`, never migrates legacy state or invokes Complete Reinstall, and guarantees current managed files on disk rather than same-session host reload.
- Stop is not a managed lifecycle hook and does not perform synchronization, research continuation, tool calls, or writes.

There is no `mcp` command and no `migrate-research` command.

## Research and review boundaries

- The host performs real retrieval, analysis, experiments, coding, writing, and figure production with tools the current host exposes and current user/project permissions allow.
- `status` is read-only; a missing overview is reported naturally, and broken links are reported naturally.
- Default Dove progression is foreground multi-round work for a confirmed goal; there is no Auto Skill, command, daemon, scheduler, or hidden session store.
- Review may use Dove's read-only author-side self-check, or start/resume `dove-review` from a frozen near-submission handoff. In Claude Code projects, the real runtime is `dove review handoff|resume|rerun|import|status`; it gives the reviewer only copied listed materials and stores round records under `.dove/reviews/**`.
- Local command experiments may use `dove run start|status|resume|finalize|compare`; run receipts are execution evidence only and do not claim reproducibility, statistical significance, or scientific correctness.
- A native role label, author-side self-check, or ordinary local session does not establish `dove-review` independence.
- Tests and packaged artifacts do not certify research claims or Dove research quality.

## Build and release validation

From a source checkout:

```bash
npm ci
npm run release:check
npm run pack:dry-run
```

`npm run check` is the regular software gate. Release validation protects the nine-Skill inventory, Dove agent surface, generated adapter drift, absence of the retired MCP runtime, the three bundle entrypoints, CLI inventory, run receipt behavior, and package archive contents. Exercise lifecycle behavior separately through the real CLI in an isolated synthetic project when those paths change. These checks can validate canonical wording and generated projection, but they cannot prove that Dove chose or performed the right research action, absorbed Review evidence, interpreted run receipts correctly, continued while useful work remained, or stopped at the correct product boundary.

These checks validate the software release only. They do not prove scientific correctness, research completion, reproducibility, acceptance, `dove-review` independence, or Dove research quality.

## Stable Markdown and project file boundaries

- Research Markdown has no format or schema version. Future organization changes use ordinary host file operations to rename, move, relink, or consolidate documents while preserving substantive content, failures, limitations, and uncertainty; they do not create a migration framework or runtime fallback.
- Requested artifacts such as drafts, figures, experiment documents, and revisions are created or modified when the task requires them. Additional Dove research Markdown is maintained when the user explicitly asks to record, update, or save it, when results clearly change the research mainline, conclusion, decision, or priority, or when preserving the work's evidence and continuation context is genuinely useful.
- Dove project file operations use cross-platform Node path containment, ordinary-file and symbolic-link checks, same-directory temporary writes, expected-state rechecks, and transactional rollback; they do not require Linux `/proc` features.
- Complete Reinstall displays the current deletion and replacement paths, defaults to No, and after confirmation rereads the project and executes the current plan.
- `DOCTOR.md` is ordinary host-maintained feedback about Dove itself, without JSON projection, issue lifecycle, or CLI ownership.
