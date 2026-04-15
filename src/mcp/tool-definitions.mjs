const policyProps = {
  actorRole: { type: "string" },
  policyOverrideReason: { type: "string" },
  policyOverrideReasonCode: { type: "string" },
  policyOverrideEvidencePaths: { type: "array", items: { type: "string" } },
  policyOverrideTargetArtifact: { type: "string" },
  policyOverrideTargetId: { type: "string" },
  policyOverrideSourceId: { type: "string" },
  policyOverridePhase: { type: "string" },
  policyOverrideExpiresAt: { type: "string" }
};

function withPolicy(properties = {}) {
  return { ...properties, ...policyProps };
}

export const toolDefinitions = [
  { name: "ensure_workspace", description: "Ensure the canonical .paper workspace and starter artifacts exist.", inputSchema: { type: "object", properties: {} } },
  {
    name: "init_project",
    description: "Initialize or refresh project metadata and the research contract.",
    inputSchema: { type: "object", properties: { title: { type: "string" }, venue: { type: "string" }, objective: { type: "string" }, deadline: { type: "string" }, thesis: { type: "string" }, audience: { type: "string" }, strictMode: { type: "boolean" } } }
  },
  { name: "read_state", description: "Read the normalized paper_factory state.", inputSchema: { type: "object", properties: {} } },
  { name: "query_task_graph", description: "Refresh and read the durable task-packet graph.", inputSchema: { type: "object", properties: {} } },
  { name: "query_open_questions", description: "Refresh and read open questions across notes, review state, and task packets.", inputSchema: { type: "object", properties: {} } },
  { name: "query_decisions", description: "Refresh and read durable operational decisions and comparison decisions.", inputSchema: { type: "object", properties: {} } },
  { name: "query_lineage", description: "Refresh and read version lineage plus comparison targets.", inputSchema: { type: "object", properties: {} } },
  { name: "query_workspace_index", description: "Refresh and read the top-level workspace index for resumable state.", inputSchema: { type: "object", properties: {} } },
  { name: "query_meta_optimize", description: "Refresh and read the proposal-only meta-optimize frontier, taxonomy-aware grouped clusters, family-level operator playbooks, ranked recommendations, durable remediation packs, longer-horizon memory summaries, and report paths.", inputSchema: { type: "object", properties: {} } },
  { name: "query_governance_coverage_report", description: "Refresh and read the durable governance coverage proof report for guarded and exempt mutation paths.", inputSchema: { type: "object", properties: {} } },
  { name: "query_operator_follow_through", description: "Refresh and read the proposal-only operator follow-through ledger for remediation, playbook, and execution-bridge decisions.", inputSchema: { type: "object", properties: {} } },
  { name: "query_boundary_report", description: "Read the workflow-pack boundary report for managed versus user-owned state.", inputSchema: { type: "object", properties: {} } },
  { name: "read_role_context_manifest", description: "Refresh and read a narrower per-role context manifest.", inputSchema: { type: "object", properties: { roleId: { type: "string" } } } },
  { name: "read_phase_context_manifest", description: "Refresh and read a phase-scoped context manifest.", inputSchema: { type: "object", properties: { phaseId: { type: "string" } } } },
  { name: "read_packet_context_manifest", description: "Refresh and read a packet-scoped context manifest with dependency and resume guidance.", inputSchema: { type: "object", properties: { packetId: { type: "string" } } } },
  { name: "read_artifact_context_manifest", description: "Refresh and read an artifact-scoped local context manifest tied to a durable path.", inputSchema: { type: "object", properties: { artifactPath: { type: "string" } } } },
  { name: "read_action_context_bundle", description: "Refresh and read an explicit pre-action local-context bundle for the current, role, phase, packet, or artifact scope.", inputSchema: { type: "object", properties: { scopeType: { type: "string" }, roleId: { type: "string" }, phaseId: { type: "string" }, packetId: { type: "string" }, artifactPath: { type: "string" } } } },
  { name: "summarize_session_journal", description: "Refresh and summarize durable session/workspace persistence surfaces.", inputSchema: { type: "object", properties: {} } },
  {
    name: "upsert_orchestration_board",
    description: "Update the canonical orchestration board under .paper/orchestration/board.json.",
    inputSchema: { type: "object", properties: withPolicy({ objective: { type: "string" }, phase: { type: "string" }, assignedRole: { type: "string" }, intentType: { type: "string" }, currentFocus: { type: "string" }, nextAction: { type: "string" }, continuationState: { type: "object" }, reviewRequiredBeforeFinalize: { type: "boolean" }, tasks: { type: "array", items: { type: "object" } }, blockers: { type: "array", items: { type: "object" } }, evidenceLinks: { type: "array", items: { type: "string" } }, experimentIds: { type: "array", items: { type: "string" } }, rebuttalIssueIds: { type: "array", items: { type: "string" } }, activeComparisonTargets: { type: "array", items: { type: "string" } }, versionLineage: { type: "object" } }) }
  },
  {
    name: "append_handoff",
    description: "Append a durable handoff entry and update the assigned role.",
    inputSchema: { type: "object", properties: withPolicy({ fromRole: { type: "string" }, toRole: { type: "string" }, phase: { type: "string" }, intentType: { type: "string" }, summary: { type: "string" }, currentFocus: { type: "string" }, nextAction: { type: "string" }, nextActions: { type: "array", items: { type: "string" } }, evidenceLinks: { type: "array", items: { type: "string" } }, blockerIds: { type: "array", items: { type: "string" } } }) }
  },
  {
    name: "update_research_brief",
    description: "Update the durable research brief and agenda artifacts.",
    inputSchema: { type: "object", properties: { objective: { type: "string" }, agenda: { type: "array", items: { type: "string" } }, evidenceBacklog: { type: "array", items: { type: "string" } }, phase: { type: "string" }, assignedRole: { type: "string" } } }
  },
  {
    name: "register_source",
    description: "Register or update a provenance-aware source record.",
    inputSchema: { type: "object", properties: { sourceId: { type: "string" }, citationKey: { type: "string" }, title: { type: "string" }, authors: { type: "array", items: { type: "string" } }, year: { type: ["string", "number"] }, locator: { type: "string" }, sourceType: { type: "string" }, abstract: { type: "string" }, origin: { type: "string" } } }
  },
  {
    name: "upsert_note",
    description: "Create or update a structured note linked to one or more sources.",
    inputSchema: { type: "object", properties: { noteId: { type: "string" }, title: { type: "string" }, sectionId: { type: "string" }, sourceIds: { type: "array", items: { type: "string" } }, summary: { type: "string" }, quotes: { type: "array", items: { type: "string" } }, claims: { type: "array", items: { type: "string" } }, openQuestions: { type: "array", items: { type: "string" } } } }
  },
  {
    name: "upsert_claims",
    description: "Write claims derived from results into the evidence store; requires the researcher role unless a traceable override is provided.",
    inputSchema: { type: "object", properties: withPolicy({ claims: { type: "array", items: { type: "object", properties: { id: { type: "string" }, text: { type: "string" }, sectionId: { type: "string" }, sourceIds: { type: "array", items: { type: "string" } }, noteIds: { type: "array", items: { type: "string" } }, experimentIds: { type: "array", items: { type: "string" } }, evidenceLinks: { type: "array", items: { type: "string" } }, status: { type: "string" }, confidence: { type: "string" }, gap: { type: "string" } } } } }) }
  },
  {
    name: "upsert_plan",
    description: "Create or update the current plan artifact.",
    inputSchema: { type: "object", properties: { thesis: { type: "string" }, audience: { type: "string" }, sections: { type: "array", items: { type: "string" } }, evidenceGaps: { type: "array", items: { type: "string" } }, milestones: { type: "array", items: { type: "string" } }, figures: { type: "array", items: { type: "string" } }, notes: { type: "string" } } }
  },
  {
    name: "upsert_outline",
    description: "Create or update the current section outline.",
    inputSchema: { type: "object", properties: { sections: { type: "array", items: { type: "object", properties: { id: { type: "string" }, title: { type: "string" }, status: { type: "string" }, goal: { type: "string" }, evidenceFocus: { type: "string" } } } } } }
  },
  {
    name: "upsert_draft",
    description: "Create or update a section draft under .paper/drafts.",
    inputSchema: { type: "object", properties: { sectionId: { type: "string" }, title: { type: "string" }, body: { type: "string" }, status: { type: "string" }, summary: { type: "string" } } }
  },
  {
    name: "upsert_experiment_plan",
    description: "Create or update a claim-driven experiment plan; requires the experiment-planner role unless a traceable override is provided.",
    inputSchema: { type: "object", properties: withPolicy({ id: { type: "string" }, title: { type: "string" }, claimId: { type: "string" }, hypothesis: { type: "string" }, methodology: { type: "string" }, successMetric: { type: "string" }, comparisonTargets: { type: "array", items: { type: "string" } }, status: { type: "string" }, owner: { type: "string" } }) }
  },
  {
    name: "upsert_experiment_result",
    description: "Create or update a durable experiment result entry; requires the experiment-planner role unless a traceable override is provided.",
    inputSchema: { type: "object", properties: withPolicy({ id: { type: "string" }, experimentId: { type: "string" }, claimId: { type: "string" }, outcome: { type: "string" }, summary: { type: "string" }, evidenceLinks: { type: "array", items: { type: "string" } }, comparisonTargets: { type: "array", items: { type: "string" } } }) }
  },
  {
    name: "run_experiment_audit",
    description: "Create or update a durable experiment audit record distinct from raw results; requires the experiment-planner role unless a traceable override is provided.",
    inputSchema: { type: "object", properties: withPolicy({ resultId: { type: "string" }, experimentId: { type: "string" }, reviewedArtifactRefs: { type: "array", items: { type: "string" } }, auditFindings: { type: "array", items: { type: "string" } }, integrityFlags: { type: "array", items: { type: "string" } }, confidence: { type: "string" }, outcomeMapping: { type: "string" } }) }
  },
  {
    name: "bridge_result_to_claim",
    description: "Persist an explicit result-to-claim bridge event and update claim state; requires the experiment-planner role unless a traceable override is provided.",
    inputSchema: { type: "object", properties: withPolicy({ resultId: { type: "string" }, experimentId: { type: "string" }, auditIds: { type: "array", items: { type: "string" } }, reason: { type: "string" } }) }
  },
  {
    name: "run_review_loop",
    description: "Run an evidence-aware review pass and generate a revision plan; requires the reviewer role unless a traceable override is provided.",
    inputSchema: { type: "object", properties: withPolicy({ scope: { type: "string" }, stage: { type: "string" } }) }
  },
  {
    name: "append_review_log",
    description: "Append a structured manual review entry; requires the reviewer role unless a traceable override is provided.",
    inputSchema: { type: "object", properties: withPolicy({ timestamp: { type: "string" }, stage: { type: "string" }, scope: { type: "string" }, verdict: { type: "string" }, summary: { type: "string" }, findings: { type: "array", items: { type: "object" } }, actionItems: { type: "array", items: { type: "string" } } }) }
  },
  {
    name: "upsert_revision_plan",
    description: "Write a manual revision plan artifact; requires the planner role unless a traceable override is provided.",
    inputSchema: { type: "object", properties: withPolicy({ summary: { type: "string" }, items: { type: "array", items: { type: "string" } }, updatedAt: { type: "string" } }) }
  },
  { name: "set_section_status", description: "Update the status and summary for a section.", inputSchema: { type: "object", properties: { sectionId: { type: "string" }, status: { type: "string" }, summary: { type: "string" } } } },
  { name: "sync_checklist", description: "Regenerate the checklist from current state and review findings.", inputSchema: { type: "object", properties: {} } },
  { name: "sync_citations", description: "Audit citations and regenerate references.bib plus the citation log.", inputSchema: { type: "object", properties: { citedOnly: { type: "boolean" } } } },
  { name: "refresh_wiki", description: "Regenerate the durable research wiki and typed wiki indexes from current sources, notes, claims, and review state.", inputSchema: { type: "object", properties: {} } },
  { name: "normalize_rebuttal_issues", description: "Normalize reviewer issues into a durable rebuttal issue board; requires the reviewer role unless a traceable override is provided.", inputSchema: { type: "object", properties: withPolicy({ issues: { type: "array", items: { type: "object" } } }) } },
  { name: "build_rebuttal_strategy", description: "Generate the rebuttal strategy and response draft from normalized issues; requires the rebuttal-lead role unless a traceable override is provided.", inputSchema: { type: "object", properties: withPolicy({}) } },
  { name: "build_rebuttal", description: "Generate an artifact-backed rebuttal draft from review and evidence state.", inputSchema: { type: "object", properties: {} } },
  { name: "create_version_snapshot", description: "Snapshot the current paper state and update version lineage; requires the version-analyst role unless a traceable override is provided.", inputSchema: { type: "object", properties: withPolicy({ versionId: { type: "string" }, label: { type: "string" }, parentVersionId: { type: "string" }, summary: { type: "string" } }) } },
  { name: "compare_versions", description: "Compare two durable paper snapshots and record the comparison; requires the version-analyst role unless a traceable override is provided.", inputSchema: { type: "object", properties: withPolicy({ fromVersionId: { type: "string" }, toVersionId: { type: "string" } }) } },
  { name: "list_artifacts", description: "List the expected paper_factory artifacts and whether they exist.", inputSchema: { type: "object", properties: {} } },
  { name: "upsert_figure_plan", description: "Write the staged figure backlog, linkage metadata, and artifact contracts.", inputSchema: { type: "object", properties: { items: { type: "array", items: { type: "object" } } } } },
  { name: "validate_figure_pipeline", description: "Regenerate durable figure QA and stage-validation outputs.", inputSchema: { type: "object", properties: {} } }
  ,{ name: "record_operator_follow_through", description: "Record a proposal-only operator decision for a remediation pack, family playbook, or execution-bridge candidate.", inputSchema: { type: "object", properties: withPolicy({ sourceType: { type: "string" }, sourceId: { type: "string" }, status: { type: "string" }, actorRole: { type: "string" }, decisionSummary: { type: "string" }, rationale: { type: "string" }, selectedConversionPathKey: { type: "string" }, linkedTargetArtifact: { type: "string" }, linkedTargetId: { type: "string" }, deferUntil: { type: "string" }, executeBy: { type: "string" }, reviewAfter: { type: "string" }, closureReason: { type: "string" }, closureArtifactPaths: { type: "array", items: { type: "string" } } }) } }
];
