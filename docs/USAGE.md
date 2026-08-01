# Usage

## Start a project

Install an exact Dove release artifact, initialize Claude project integration, re-enter Claude Code, and establish the Workspace:

```bash
npm install --global <exact-dove-package-specifier>
cd <target-project>
dove init --host claude
dove doctor
```

```text
/dove:workspace
```

Initialization creates `.dove-install/` and managed host resources only. `/dove:workspace` is the explicit operation that creates or replaces user-owned `.dove/` state and its concise research mainline.

## Direct Skills and Mission routing

Dove exposes exactly 12 direct Skills. Each accepts optional text:

`workspace`, `mission`, `status`, `lessons`, `source`, `note`, `experience`, `experiment`, `draft`, `figure`, `review`, and `rebuttal`.

Use a root Mission for a new independent goal. Use a child Mission for continuation, narrowing, comparison, recovery, or follow-up. Select existing work by the exact visible one-based `missionNumber` returned by status; private durable identifiers are not public selectors.

`dove.workspace` changes the project-wide research mainline. `dove.mission` creates a proportional explicit contract or records one evidence-bound reevaluation. `dove.status` is strictly read-only and does not initialize, refresh, repair, or convert state.

## Two hidden ambient routes

Claude project integration installs one `UserPromptSubmit` hook and two hidden Skills.

### Work intake

For a clear non-slash work request, `dove-intake` makes a conservative second judgment:

- `research` changes research understanding, experiments, evidence, or paper claims;
- `ordinary` covers clear code, documentation, configuration, cleanup, or another bounded deliverable.

It may ask one zero-write clarification round for material ambiguity. Clear work creates only through `create_ambient_dove_mission`; the host resumes the original task only after successful creation. A supplied closure request is invoked exactly once with its binding unchanged.

### Lessons intake

Natural explicit requests such as “read our lessons,” “remember this experience,” or “reflect on what we learned” route to `dove-lessons-intake`. This route creates no Mission and uses only `manage_dove_lessons`.

Remember and reflect flows read the complete current `.dove/LESSONS.md`, preserve the returned machine-only binding, conservatively edit the complete Markdown under its five stable sections, and update once. Reflection first derives only supported reusable guidance from available context. Lessons are advisory and never evidence, authority, or completion proof.

Slash commands bypass ambient classification and retain their explicit Skill routing.

## Domain workflows

### Source and Note

Source is external-content research. Discover and visibly capture selected material with host-native retrieval before registering it. Registration creates a candidate; public verification may reject a candidate but cannot mint positive trust.

Note is internal-project research and synthesis using current files and context. Its output is a normal substantive artifact, not a Note durable entity or evidence by itself.

### Experience and Experiment

Experience covers experiment conception, feasibility, controls, measurements, risks, and prevalidation before formalization. It does not freeze a protocol or record a result.

Experiment freezes one complete protocol before execution. Result recording resumes that exact protocol Mission and preserves measurements, current evidence, full denominator, failures, deviations, and limitations. Claims are separate and must match current experiment evidence and evaluated scope.

### Draft, Figure, and Rebuttal

These are thin artifact workflows. The host writes, draws, revises, or responds in the normal project. Dove then archives the current Mission-owned path, references, QA, and findings through one Receipt. It does not copy the artifact into a same-named mirror.

Figure additionally records a caption. Rebuttal preserves current finding references and remains author-side; it cannot claim Reviewer agreement or sign-off.

### Review

Review follows one fixed lifecycle:

1. Start one Review Skill Mission.
2. Call `manage_dove_review` with `operation=scope` to freeze one explicit current artifact scope without writes.
3. Launch exactly one dedicated fresh read-only `dove-reviewer` through the supported native Claude or OpenCode agent surface and wait synchronously.
4. Call `manage_dove_review` with `operation=archive` once using the unchanged scope binding and the Reviewer's structured return.
5. Execute the original typed Review Mission closure exactly once.

The Reviewer reads only declared paths, makes no edits, launches no nested agent, and returns findings only. Archived findings are non-authoritative and do not establish identity, acceptance, sign-off, or scientific endorsement.

## Public output contract

Business results use one safe envelope:

- `report` is human-facing;
- `researchHandoff` is optional machine input for bounded host execution;
- `hostControl` carries machine-only presentation and typed closure instructions.

Present `report` only when directed. Never render the machine channels. A present `hostControl.closureRequest` fixes the callback tool, bound public arguments, required outcome fields, defaults, and exactly-once behavior; do not reconstruct it from prose or status.

## Current state boundary

`.dove-install/` is Dove-managed integration. `.dove/` is user-owned current research state containing Workspace revisions, Missions, ResearchDecisions, Receipts, artifact handoffs, Sources, Claims, Experiments, Reviews, and the canonical Lessons document. Draft, Figure, and Rebuttal bodies remain in normal project paths.

Dove reads Schema 18 only. Earlier, malformed, contradictory, or future state fails closed. There is no migration, compatibility alias, secondary state root, ResearchTree, Note store, Experience sidecar set, artifact mirror, or fallback execution route.

## Language

Human output defaults to Chinese and may be explicitly requested in English. Machine keys, Skill IDs, tool names, and status tokens remain English.
