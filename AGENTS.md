# Dove Agent Instructions

These instructions are for AI assistants working in a Dove workspace.

- Treat `.dove/` as the authoritative durable source of truth.
- Use public Dove surfaces for shared mission work: `dove.orchestrate`, `dove.mission`, `dove.status`, `dove.plan`, `dove.checklist`, `dove.follow-through`, `dove.launch`, `dove.approvals`, `dove.lessons`, `dove.onboard`, `dove.autonomy-operate`, `dove.audit`, `dove.return`, and `dove.governance-audit`.
- Use `dove.paper.*` only for paper-domain research, claims, citations, drafting, experiments, review, rebuttal, figures, and version workflows.
- Preserve the planner, builder, and reviewer separation; use handoff files instead of hidden context sharing.
- Keep autonomy explicit, foreground-only, bounded, approval-aware, and auditable.
- Do not treat local development scaffolding or raw runtime traces as packaged Dove product surfaces.
