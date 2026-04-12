---
name: paper-factory-pipeline
description: Run the full paper_factory research-to-writing workflow using durable artifacts.
---

# paper-factory-pipeline

Use this skill when the user wants to move a paper forward end to end.

## Workflow order

1. Align the orchestration board and current role.
2. Register sources and refresh the research brief.
3. Capture notes.
4. Promote evidence-backed claims.
5. Update plan and outline.
6. Draft sections.
7. Plan experiments, record results, then persist experiment audits and result-to-claim bridge events.
8. Run the evidence-aware review loop.
9. Normalize rebuttal issues and snapshot versions around major changes.
10. Inspect task graph, open questions, decisions, lineage, and workspace index when the next step is unclear.
11. Execute revisions.

Always prefer durable files in `.paper/` over ephemeral chat memory.
Refresh task packets, phase/role manifests, workspace index, and session summaries as part of the normal file-first workflow.
