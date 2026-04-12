import test from "node:test";
import assert from "node:assert/strict";

import { toolDefinitions } from "../../src/mcp/tool-definitions.mjs";

test("MCP tool definitions include the mature workflow tools", () => {
  const names = toolDefinitions.map((tool) => tool.name);
  assert.deepEqual(names, [
    "ensure_workspace",
    "init_project",
    "read_state",
    "query_task_graph",
    "query_open_questions",
    "query_decisions",
    "query_lineage",
    "query_workspace_index",
    "query_boundary_report",
    "read_role_context_manifest",
    "summarize_session_journal",
    "upsert_orchestration_board",
    "append_handoff",
    "update_research_brief",
    "register_source",
    "upsert_note",
    "upsert_claims",
    "upsert_plan",
    "upsert_outline",
    "upsert_draft",
    "upsert_experiment_plan",
    "upsert_experiment_result",
    "run_experiment_audit",
    "bridge_result_to_claim",
    "run_review_loop",
    "append_review_log",
    "upsert_revision_plan",
    "set_section_status",
    "sync_checklist",
    "sync_citations",
    "refresh_wiki",
    "normalize_rebuttal_issues",
    "build_rebuttal_strategy",
    "build_rebuttal",
    "create_version_snapshot",
    "compare_versions",
    "list_artifacts",
    "upsert_figure_plan"
  ]);
});
