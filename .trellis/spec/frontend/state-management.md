# State Management

> Research Format 1 state and public read/write boundaries.

---

## Overview

Dove is file-first. The host plans and executes work; Dove stores a small validated research model for Workspace direction, Mission contracts and lineage, evidence, claims, experiment records, review exchanges, and Lessons.

## Layer Boundary

- A direct **Skill** expresses user intent and accepts optional text.
- An **MCP tool** validates and performs a structured research operation.
- A **semantic entity** records validated Research Format 1 state under `.dove/`.
- A **project artifact** holds substantive host-produced work in a normal project path.
- An **installation resource** belongs to managed project integration recorded by `.dove/install/manifest.json`.

Do not infer a semantic entity from a Skill name or project file. Draft, Figure, Rebuttal, and internal synthesis are workflows or project artifacts rather than same-named stores.

## Installation and Research State

`.dove/` is the single project-private root. `.dove/install/manifest.json` is Dove-managed installation state and records package identity, runtime protocol, proven hosts, managed resources, and ownership. Research Format 1 is an optional sibling contract under `.dove/`, not a separate root. Routine initialization and synchronization manage installation state only. Project Upgrade preserves current research bytes; confirmed project Complete Reinstall deletes optional research state before recreating installation state. Neither lifecycle operation manages user npm.

`.dove-install/` is recognized only as a legacy manifest root for Upgrade or Complete Reinstall cleanup. `.dove-archive/` is likewise a legacy project root that those lifecycle operations may move or remove. Neither is a current or compatibility research root.

Research Format 1 uses:

- `.dove/format.json` with format marker `dove-research-v1`;
- `.dove/workspace.json` for current Workspace direction and human-readable change history;
- `.dove/missions/` for immutable Mission contracts and optional immutable conclusions;
- `.dove/sources/` for captured Source records;
- `.dove/experiments/` for frozen plans and immutable results;
- `.dove/claims/` for evidence-bounded Claims;
- `.dove/reviews/` for imported structured Reviews tied to frozen artifact snapshots; and
- `.dove/LESSONS.md` for the canonical advisory Lessons document.

Mission parent and dependency links form the research tree. This lineage is derived from Mission entities and does not create a second authoritative store.

## Semantic Entity Rules

- The Workspace is mutable through explicit initialize or mainline update operations and retains concise change history.
- Mission contracts are immutable. A new independent goal is a root; a deliberate branch uses explicit parent provenance and may declare dependencies.
- Mission conclusions are separate immutable synthesis records preserving failures, limitations, uncertainty, evidence IDs, and recommended branches.
- A Source is immutable captured external material and may include a content fingerprint for a project-local capture.
- An Experiment plan is frozen before host execution. Its result is recorded separately and preserves all declared observations, measurements, denominator data, impacts, unexpected observations, failures, deviations, limitations, and uncertainty.
- A Claim is immutable and requires support references plus explicit cannot-say boundaries.
- A Review is imported from a user-managed separate reviewer session and binds to frozen artifact fingerprints. It remains non-authoritative.
- Lessons are advisory Markdown and are replaced as one complete document.

## Public Read/Write Boundary

Skills and MCP callers use semantic identifiers rather than positional numbers. They do not inspect or edit `.dove/` directly.

Reads are zero-write. Mutations validate the current format, complete input, entity references, Mission lineage, canonical project paths, frozen protocol or review bindings, and overwrite eligibility before the first write.

The safe public result includes human text and structured `research` data. Private write diagnostics, hashes, bindings, `.dove/` paths, and integrity internals are removed. There is no public completion callback or machine control envelope.

## Review Exchange

Review follows a user-mediated boundary:

1. `local-preflight` verifies the target Mission and declared project artifact paths without creating a Review.
2. `prepare` freezes the artifact snapshot and produces the exchange material.
3. The user obtains a return in a separate reviewer session outside Dove's execution.
4. `import` validates and records the structured return against the prepared exchange.
5. `coverage` reports current review coverage and artifact validity.

Dove never launches, impersonates, or silently substitutes for the separate reviewer. Importing a Review does not establish identity, independence, sign-off, acceptance, or scientific authority.

## Current-Only Runtime

Current research operations read and write only Research Format 1. Missing state may be initialized only through the Workspace operation. Legacy, unknown, malformed, or incomplete `.dove/` state is classified without repair and refused for mutation. There is no state migration, overlay upgrade, archive replacement, compatibility root, or fallback reader.

The CLI is runtime-only: it handles installation lifecycle, diagnosis, MCP serving, and prompt-hook forwarding. Research Skills use MCP and must not fall back to CLI, shell, or direct state access.
