# Directory Structure

> Project-facing surface and current durable-model organization for Dove.

---

## Overview

This repository has no browser frontend. The Trellis `frontend` layer covers 12 direct Skills, 60 generated adapters, three primary responsibility Skills, CLI/project integration, 14 MCP tools, public documentation, and sealed `.dove/` state.

## Directory Layout

```text
.
├── .opencode/commands/       # 12 generated OpenCode Skill adapters
├── .opencode/skills/         # Planner, Builder/Author, and Reviewer
├── .cursor/commands/         # 12 generated Cursor Skill adapters
├── .codex/skills/            # 12 generated Codex Skill adapters
├── .agents/skills/           # 12 generated shared-agent Skill adapters
├── .claude/                  # 12 Claude Skill adapters plus ambient integration
├── .dove-install/            # Consumer-project managed integration manifest
├── bin/                      # CLI entrypoint and package bundle
├── docs/                     # User and maintainer documentation
├── mcp/                      # MCP server entrypoints
├── scripts/                  # Generators, bundles, and validation gates
├── src/
│   ├── core/                 # Workspace, Mission, evidence, domain, and review logic
│   ├── mcp/                  # MCP definitions, handlers, and server
│   └── templates/markdown/   # Installed Trellis documentation copies
└── tests/
    ├── integration/
    └── unit/
```

## Consumer Project Roots

- `.dove-install/` is Dove-managed project integration.
- `.dove/` is user-owned current research state established through the direct Workspace Skill.

Current `.dove/` state includes Workspace revisions, Missions, parent/child provenance, ResearchDecisions, execution Receipts, artifact handoffs, Sources, Claims, Experiments, Reviews, and one canonical `.dove/LESSONS.md` document.

Internal Note work is a normal substantive project artifact. Experience remains conception/prevalidation until a formal Experiment protocol is frozen. Draft, Figure, and Rebuttal bodies stay in project paths and are archived through Receipts without mirrors.

## Module Ownership

- Keep canonical paths and governance registries in `src/core/schema.mjs`.
- Keep strict Workspace classification in `src/core/workspace-schema.mjs`.
- Keep Workspace mainline mutation in Workspace modules.
- Keep direct Mission contracts and parent/child routing in Mission modules.
- Keep Mission-bound research judgment in ResearchDecision modules.
- Keep execution evidence in Receipt and artifact-handoff modules.
- Keep Source, Claim, Experiment, Draft, Figure, Review, Rebuttal, and Lesson behavior in their current domain modules.
- Keep all 14 public MCP schemas in `src/mcp/tool-definitions.mjs` and exact dispatch in `src/mcp/handlers.mjs`.
- Keep the 12 Skill definitions in `src/core/command-manifest.mjs` and render adapters from that source.
- Keep every Trellis frontend spec identical to its `src/templates/markdown/spec/frontend/` copy.

## Naming and Inventory

- Public Skill IDs are the 12 flat `dove.<surface>` names.
- Each Skill accepts optional text and preserves root/child Mission routing.
- The generator emits 60 adapters: 12 for each of five host formats.
- MCP tool names are snake_case; core functions are camelCase.
- Durable paths come from `ARTIFACT_PATHS`.
- Generated adapter presence does not establish host registration or readiness.

## Current Model

Research direction is represented by Mission-bound ResearchDecisions. Current runtime has no ResearchTree, Note store, Experience sidecars, state-migration path, compatibility root, or fallback execution path.
