# Quality Guidelines

> Documentation, package, and public-contract quality standards for Dove.

---

## Primary Gates

```bash
npm run build:check
npm run commands:check
npm run commands:validate
npm run mcp:validate
npm run workflow-goals:validate
npm run governance:audit
npm test
npm run check
npm run release:check
npm run pack:dry-run
```

Documentation-only work may use read-only inventory, consistency, and diff checks when code, tests, bundles, and generated adapters are outside the approved scope.

## Exact Public Contracts

Validation must preserve:

- 12 direct Skills;
- 14 canonical MCP tools;
- 60 generated adapters, 12 for each of five host formats;
- three generated Claude ambient resources;
- canonical Claude and OpenCode Reviewer definitions;
- three primary responsibility Skills;
- optional text on every direct Skill;
- root/child Mission routing and visible one-based selection;
- shared safe output projection; and
- identical Trellis frontend specs and template copies.

## Semantic Checks

Documentation, prompts, and adapters must distinguish:

- Skill versus MCP tool versus durable entity;
- external Source capture versus internal Note synthesis;
- Experience conception/prevalidation versus formal Experiment protocol/result recording;
- host return or internal validation versus Mission completion and independent authority; and
- adapter inventory versus host registration and readiness.

Current durable-state references must use Workspace, Mission, ResearchDecision, Receipt, artifact handoff, Source, Claim, Experiment, Draft, Figure, Review, Rebuttal, and Lesson concepts. They must not describe a ResearchTree, Note store, Experience sidecar set, state-migration path, or fallback runtime as current behavior.

## Required Patterns

- Keep public prose concise and task-oriented.
- Keep all Trellis documentation in English.
- Keep generated adapters thin and derived from canonical Skill metadata.
- Keep MCP schemas sealed and exact.
- Keep reads zero-write and mutations preflighted before the first write.
- Keep machine-only handoff, closure, identity, integrity, and path data out of human output.
- Keep failed, blocked, incomplete, and uncertain evidence visible.
- Keep claim scope bounded by current evidence.

## Review Checklist

- Do README, Usage, Install, Packaging, Capability Matrix, and samples agree on 12/14/60?
- Are all 12 Skill names and purposes consistent?
- Are all 14 MCP tool names accurate?
- Is direct invocation with optional text clear?
- Is root/child Mission routing clear?
- Are Source/Note and Experience/Experiment distinctions consistent?
- Do Trellis specs exactly match their template copies?
- Were code, tests, bundles, and generated adapters left unchanged when outside scope?
