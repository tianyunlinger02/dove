# .paper workspace

This directory is the durable source of truth for `paper_factory`.

- Commands, skills, and MCP tools should all converge on these artifacts.
- `.paper/orchestration/board.json` and `.paper/orchestration/handoffs.md` are the canonical orchestration layer.
- `.paper/task-packets/`, `.paper/context/roles/`, and `.paper/sessions/` extend that orchestration layer with portable Trellis-inspired persistence.
- `.paper/meta/` is a proposal-only outer-loop surface for evidence-backed workflow recommendations.
- Research memory is stored as files, not hidden session state.
- Claims, experiments, rebuttal issues, and versions should stay linkable and machine-checkable.
- Review loops should leave behind durable revision plans.
