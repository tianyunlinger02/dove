# State Management

> Durable state and public read/write boundaries.

---

## Overview

Dove is file-first. The host plans and executes work; Dove stores the minimum validated state needed for Mission contracts, research judgment, evidence, substantive outputs, lessons, and review accountability.

## Three-Layer Boundary

- A direct **Skill** expresses user intent and accepts optional text.
- An **MCP tool** validates and performs a structured operation.
- A **durable entity** records current validated state under `.dove/`.

Do not infer a storage entity from a Skill name. Note and Experience are Skill semantics, not durable stores.

## Integration and Research State

`.dove-install/` is managed project integration. `.dove/` is user-owned current research state established by the direct Workspace Skill.

Current durable state includes:

- Workspace revisions;
- root and child Missions with explicit parent provenance;
- Mission-bound ResearchDecisions for research work;
- execution Receipts and artifact handoffs;
- Sources and Claims;
- formal Experiment protocols and results;
- immutable non-authoritative Reviews; and
- one canonical `.dove/LESSONS.md` document.

Research direction uses ResearchDecisions, not a ResearchTree. Note synthesis and Draft, Figure, and Rebuttal bodies remain normal project artifacts; the latter are archived through Receipts without mirrors. Experimental conception/prevalidation remains Experience Skill work until a formal Experiment exists.

## Public Read/Write Boundary

Direct Skills and MCP callers use visible one-based Mission numbers. They do not inspect or edit `.dove/` directly.

Reads are zero-write. Mutations validate the complete write set, current Mission, parent/child relationship, ownership, evidence, canonical paths, and overwrite eligibility before the first write.

Status and completion are derived live from current records. Host return, tests, and internal checks remain evidence inputs and do not automatically establish completion or independent authority.

## Mission Routing

- A new independent goal creates a root Mission.
- Continuation, narrowing, comparison, recovery, and follow-up create a child Mission.
- A child records its parent and does not silently rewrite or inherit completion from that parent.
- A project-wide mainline change is a Workspace operation.

## Output State

Public results expose `report`, optional `researchHandoff`, and `hostControl`. Durable identity, hashes, paths, and mutation controls stay private. A typed closure request is the only callback route and is applied exactly once with its binding unchanged.

## Current-Only Runtime

Current runtime reads only current `.dove/` state. It has no ResearchTree, Note store, Experience sidecar set, secondary authoritative root, state-migration path, or fallback execution path.
