# Usage

## Collaboration defaults

Unless the user requests another language or format, Dove-facing host work should respond in natural, clear Chinese. Internal terms, paths, and machine identifiers should appear only when they improve precision and should be explained plainly. Response structure follows the task rather than a fixed report template. Explicit user requirements and local machine-readable contracts take priority.

Durable Dove state is accessed only through the eight public MCP tools. Ordinary project files are handled with normal host tools. Never read or write `.dove` directly.

## Daily entry

After installing and initializing the project, enter or re-enter Claude Code from the project. You may issue a normal request or invoke one of nine Skills.

For example:

```text
/dove:research Compare the current implementation with the documented design and identify the strongest unresolved question.
```

The Research Skill first requests the smallest zero-write Dove projection. These are normal states:

- no `.dove` research state at all;
- install-only `.dove/install/manifest.json` with no Research Workspace;
- a healthy Workspace with zero Missions; or
- a healthy Workspace with no Mission relevant to the request.

In those cases, the host may inspect ordinary project material outside `.dove`, including README, docs, source, tests, configuration, results, and existing artifacts. That read-only exploration forms a provisional research frame. The host asks one brief clarification only if material ambiguity in the goal, boundary, or deliverable remains after exploration. Otherwise it continues bounded work.

A Skill invocation never initializes a Workspace or creates a Mission automatically. Durable records are added only when the user explicitly needs them and the required semantic content is available.

## Nine Skills

### Research

Use `research` for framing, investigation, synthesis, or bounded project research. The host explores and performs substantive work; Dove projects or records durable context only when needed.

### Status

Use `status` for a zero-write projection. It does not browse ordinary project files, run tests, repair state, or infer scientific meaning.

### Source

The host discovers, retrieves, reads, and verifies real materials. Record a Source only when material was actually used and needs a durable citation or evidence relationship. Preserve conditions, conflicts, and limitations.

### Experiment

The host designs and executes experiments with normal project tools. If a durable record is needed, freeze the protocol before execution and record the complete result afterward. Preserve:

- positive, negative, null, mixed, failed, and stopped outcomes;
- raw observations and measurements;
- denominator accounting;
- failures, exclusions, and deviations;
- unexpected observations;
- limitations and uncertainty; and
- bounded Claim impacts.

### Draft

Read the target and surrounding project materials, then create or revise the ordinary draft artifact. Run appropriate validation and state unsupported claims, citation gaps, and uncertainty. Dove does not store the draft body as a separate workflow object.

### Figure

Gather actual materials and data, create or revise the ordinary figure artifact and caption, and validate labels, denominators, provenance, legibility, and agreement with underlying evidence.

### Review

Review uses a user-managed separate exchange:

1. Run `local-preflight` on explicit project-relative artifact paths.
2. Run `prepare` to freeze paths, sizes, and SHA-256 fingerprints.
3. Give the package to a separate reviewer session or person selected and managed by the user.
4. Import the returned strict review object.
5. Run `coverage` to verify reviewed bytes remain current.

Dove does not launch or impersonate a reviewer. Reviewer output must include exactly these top-level fields:

```json
{
  "status": "completed",
  "verdict": "coherent",
  "summary": "Concise assessment.",
  "rubric": ["Correctness and coherence"],
  "findings": [],
  "actionItems": [],
  "report": "# Review\n\nComplete report.\n",
  "provenance": {"hostKind": "claude"},
  "limitations": ["Review covered only the declared files."],
  "reviewedAt": "2026-08-09T00:00:00.000Z"
}
```

The schema is sealed. A successful import does not prove reviewer independence, identity, authority, acceptance, or scientific correctness.

### Rebuttal

Rebuttal and revision remain author-side. Analyze each finding against the actual artifact and evidence, write the response, make ordinary project revisions, and verify that every response maps to a finding without overstating evidence.

### Lessons

Lessons are one advisory Markdown document. `read` is zero-write. `replace` requires the complete replacement document. Preserve the existing document structure and integrate conservatively; if no structure exists, organize it naturally for the content. Lessons are not evidence, authority, completion proof, or scientific judgment.

## MCP result contract

Every tool returns:

```json
{
  "content": [{"type": "text", "text": "Natural human message"}],
  "structuredContent": {
    "status": "ok",
    "operation": "query_dove_research",
    "research": {}
  }
}
```

Machine keys and semantic identifiers remain English. Human text follows the resolved language. Every tool accepts optional `language: "zh" | "en"`; otherwise Dove uses project configuration, environment variables, and the default Chinese preference.

Known conditions have safe, stable machine categories:

- absent Workspace: `status: "absent"`, `reason: "research-workspace-not-initialized"`, `zeroWrite: true`;
- unknown Mission: `reason: "unknown-mission"`;
- invalid public input: `reason: "invalid-input"`;
- unsupported legacy or future format: `reason: "unsupported-format"`;
- invalid research state: `reason: "invalid-research-state"`; and
- safety boundary: `reason: "blocked"`.

Human text does not repeat internal status tokens, raw exceptions, absolute paths, private fields, or storage details. Unknown failures return a localized generic message.

## Research Format 1 entities

### Workspace

Records the research question, mainline, intended contribution, current focus, and concise change history.

### Mission

An immutable research-tree node with semantic IDs, parent and dependency links, assumptions, competing hypotheses, open questions, evidence needs, and contribution role. Conclusion is a separate immutable synthesis record.

### Source

Records actual captured material, its research relationship, conditions, conflicts, limitations, and optional project-relative capture fingerprint.

### Experiment

A frozen plan plus an optional full result. Dove records; the host executes.

### Claim

Carries exact support references, counter-evidence, missing evidence, cannot-say boundaries, uncertainty, assessment, and story role.

### Review

Stores the strict imported review return and reviewed artifact fingerprints.

### Lessons

Stores one free-form advisory Markdown document.

## Nine zero-write views

`query_dove_research` supports:

1. `overview`
2. `diagnosis`
3. `related-work`
4. `hypotheses`
5. `experiment-options`
6. `result-synthesis`
7. `claim-story`
8. `branch-synthesis`
9. `reviews`

Views project exact records and relationships. They do not authorize work, rank candidates, browse ordinary project files, or determine scientific meaning.

## Runtime CLI

The CLI exposes exactly seven commands:

```text
init, sync, upgrade, reinstall, doctor, mcp, hook
```

- `init` establishes project integration.
- `sync` refreshes manifest-selected integration.
- `upgrade` refreshes project integration while preserving current Research Format 1 bytes and may converge valid legacy lifecycle inputs.
- `reinstall` removes selected-project Dove state only after one explicit default-No confirmation, then recreates integration.
- `doctor` is read-only.
- `mcp serve` runs the project MCP server.
- `hook user-prompt-submit` supports Claude ambient routing.

Research operations are not CLI business commands.

## State and lifecycle boundaries

`.dove/` is the single current project-private root. `.dove/install/manifest.json` is current integration state. Research Format 1 siblings are optional.

`.dove-install/` and `.dove-archive/` are legacy Upgrade or Complete Reinstall inputs only. They are not current roots, fallback readers, or compatibility authorities.

Unsupported legacy, future, malformed, symlinked, or incomplete research formats fail closed. Dove does not silently migrate, repair, alias, or replace them. Complete Reinstall may delete them only after explicit confirmation.

## Maintainer validation

```bash
npm run commands:check
npm run commands:validate
npm run mcp:validate
npm run check
npm run release:check
npm run pack:dry-run
```

These checks establish software behavior only, not scientific completion or independent review.
