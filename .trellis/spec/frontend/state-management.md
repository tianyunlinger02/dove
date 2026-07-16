# State Management

> Durable schema 7 state and strict read/write boundaries.

---

## Overview

Dove is file-first. Durable state exists only in explicit schema 7 `.dove/` artifacts. Native host planning and execution remain host responsibilities; Dove stores approved mission contracts and evidence, not a duplicate execution engine.

## Canonical State

- `.dove/manifest.json` and `.dove/project.json` identify the sealed workspace.
- `.dove/missions/` contains approved mission contracts.
- `.dove/lessons/` contains immutable advisory lessons with recording-mission provenance and mission or global applicability.
- `.dove/receipts/execution/` contains immutable receipts bound to current contract digests, paths, hashes, criteria, and evidence.
- `.dove/artifacts/ownership.json` and `.dove/artifacts/lineage.json` bind artifacts to missions and provenance.
- `.dove/sources/`, `.dove/notes/`, `.dove/claims/`, `.dove/experiments/`, `.dove/drafts/`, `.dove/figures/`, `.dove/reviews/`, `.dove/rebuttal/`, and `.dove/versions/` hold mission-bound domain artifacts.

`ARTIFACT_PATHS` in `src/core/schema.mjs` is the canonical registry.

## Workspace States

The strict opener classifies a workspace as absent, current healthy, current unhealthy, legacy, future, or invalid.

- Read-only queries may inspect absent or current state only as their contracts permit.
- Malformed, contradictory, legacy, and future state fails closed.
- A current manifest that coexists with removed state, packet, orchestration, runtime, workspace, mutation-ledger, program, meta, context, or wiki roots is contradictory.
- Archive-reset may identify and atomically archive an old `.dove/` tree, but it must not read, repair, convert, or import legacy business data.
- No read operation bootstraps, refreshes, normalizes, or repairs durable state.

## Mutation Model

- Proposal calls are zero-write.
- Exact confirmation replays the returned workspace identity, contract, digest, target identities, and mutation mode.
- `patch-plan` returns canonical contained operations for host-tracked application and performs no writes.
- `direct-process` writes through the contained mutation context and reports that host rollback is not automatically verified.
- Binary writes require `direct-process` except supported text-safe formats.
- Every domain mutation validates mission ownership, current paths, hashes, and evidence before its first write.

## Derived Assessment

`dove.status`, completion assessment, source eligibility, domain integrity, and review coverage derive answers from current canonical artifacts. They do not persist status, select work, route roles, refresh indexes, or create lifecycle mirrors.

## Server State

The MCP server has no database and no durable runtime of its own. It validates inputs and calls the same core functions as the CLI. Tool discovery exposes one sealed schema 7 registry rather than public/internal or operator tiers.

## Forbidden Patterns

- No fallback or compatibility state loaders.
- No task packet, board, route, queue, lease, campaign, continuation, mutation ledger, program-control, meta-optimizer, context-manifest, or navigation state.
- No daemon, scheduler, background loop, or hidden host hook.
- No mutable status mirror.
- No automatic lesson capture/recall, transcript memory, Trellis lesson mirror, runtime lesson state, or retired operator lesson store.
- No caller-minted source, lesson, or Reviewer authority.
- No install/sync mutation of user-owned `.dove/` data.
