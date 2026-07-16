# Component Guidelines

> User-facing command, skill, CLI, and MCP contracts for Dove schema 8.

---

## Overview

There are no browser components. Treat each generated adapter, primary responsibility skill, CLI command, and MCP tool as a small public component over the same schema 8 core.

- Generated adapters come from `src/core/command-manifest.mjs`.
- OpenCode responsibility skills are exactly Planner, Builder, and Reviewer.
- CLI parsing lives in `src/cli/command-parser.mjs` and execution in `bin/dove.mjs`.
- MCP schemas live in `src/mcp/tool-definitions.mjs`; dispatch lives in `src/mcp/handlers.mjs`.
- Core behavior must not be duplicated in prompts, CLI branches, or MCP handlers.

## Public Command Surface

Dove exposes exactly twelve flat commands: `dove.init`, `dove.mission`, `dove.status`, `dove.lessons`, `dove.version`, `dove.source`, `dove.note`, `dove.figure`, `dove.experience`, `dove.draft`, `dove.review`, and `dove.rebuttal`. MCP discovery exposes exactly 27 tools.

Do not add public aliases, hidden command tiers, or compatibility names.

## Surface Contracts

### Generated adapters

Define title, summary, required MCP tools, artifact context, constraints, and examples in `COMMAND_SURFACES`, then run `npm run commands:generate`. Adapters should name canonical schema 8 artifacts and explain whether the action is read-only, proposal-only, patch-plan, or direct-process.

### Lessons

`dove.lessons` combines two explicit operations over one advisory artifact family. Query is zero-write. Record is proposal-first and requires exact replay. Lessons always retain recording-mission provenance; `global` means broadly applicable guidance, while `mission` limits applicability to that mission. The only kinds are `preference`, `constraint`, `method`, `failure`, and `review-insight`.

Lessons never grant authority, satisfy completion, become mission target/output artifacts, or replace current evidence validation. Do not auto-capture, auto-recall, import transcripts, write Trellis state, or create runtime/host memory integration. Retired operator lesson storage and tool names must remain absent.

### Primary responsibility skills

- Planner frames mission contracts, priorities, dependencies, evidence requirements, and completion criteria.
- Builder produces substantive mission-owned artifacts using native host planning and tools.
- Reviewer independently assesses exact frozen artifact sets through review exchanges.
- Do not add skills that behave as a Dove scheduler, router, continuation engine, or compatibility layer.

### CLI

Keep CLI branches thin: parse sealed options, call shared core functions, and print deterministic JSON or concise human-readable output. Initialization and mission creation expose exact replay tokens and commands. Unknown retired commands fail without workspace writes.

### MCP

Expose one sealed tool registry. Every tool schema, including nested objects, rejects unknown properties. Mutating tools include `mutationMode`; read-only tools do not. Dispatch exact tool names to shared core functions, and classify each tool exactly once in governance.

## Contract Conventions

- Mission-bound mutations require explicit `missionId`.
- Reads are zero-write and never repair or refresh state.
- Exact replay mutations reject workspace, digest, contract, target, source-tree, or mutation-mode drift.
- Public source input cannot mint positive verification authority.
- Public review import cannot mint Reviewer authority.
- Provider execution and substantive host work remain outside Dove; imports require current hashes and evidence.
- Bookkeeping artifacts cannot satisfy mission target or evidence requirements.

## Review Exchange Scenario

`dove.review` supports policy-scoped preflight, preparation, import, and coverage verification.

- `local-preflight` is zero-write.
- Prepared exchanges freeze explicit mission-owned artifact paths and hashes.
- Independent reviewers or external processes operate outside Dove.
- Import accepts only canonical handoff/report files after identity, scope, path, and hash validation.
- Private writer and reviewer transcripts are not imported.
- Imported public review material remains non-authoritative without a trusted issuer.

## Common Mistakes

- Editing generated adapters by hand.
- Packaging stale role skills that name removed artifacts.
- Adding a tool without a handler or governance classification.
- Adding a CLI option that is absent from MCP and command contracts.
- Mentioning a durable path that is not declared by schema 8.
- Treating compact status or review diagnostics as execution authority.
- Reintroducing removed workflow state under a new name.
