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

const taskTargetProps = {
  packetId: { type: "string", description: "Durable Dove task packet id that this task-scoped write must bind before mutating state." },
  taskPacketId: { type: "string", description: "Alias for the durable Dove task packet id." },
  missionPacketId: { type: "string", description: "Alias for the durable Dove mission packet id." },
  taskId: { type: "string", description: "Alias for the durable Dove task packet id." },
  target: { type: "string", description: "Natural-language task target used to resolve an existing durable packet." },
  packetTarget: { type: "string", description: "Natural-language packet target used to resolve an existing durable packet." },
  taskName: { type: "string", description: "Human task name used to resolve an existing durable packet." }
};

function withTaskTarget(properties = {}) {
  return { ...taskTargetProps, ...properties };
}

const planMissionProps = {
  id: { type: "string" },
  packetId: { type: "string" },
  taskPacketId: { type: "string" },
  goal: { type: "string" },
  objective: { type: "string" },
  title: { type: "string" },
  summary: { type: "string" },
  stage: { type: "string" },
  missionStage: { type: "string" },
  domain: { type: "string" },
  doveDomain: { type: "string" },
  missionDomain: { type: "string" },
  level: { type: "number" },
  taskLevel: { type: "number" },
  missionLevel: { type: "number" },
  status: { type: "string" },
  dependencies: { type: "array", items: { type: "string" } },
  dependencyIds: { type: "array", items: { type: "string" } },
  blockedBy: { type: "array", items: { type: "string" } },
  blockerIds: { type: "array", items: { type: "string" } },
  evidenceExpectations: { type: "array", items: { type: "string" } },
  evidenceLinks: { type: "array", items: { type: "string" } },
  artifactRefs: { type: "array", items: { type: "string" } },
  artifactPaths: { type: "array", items: { type: "string" } },
  currentFocus: { type: "string" },
  nextAction: { type: "string" },
  childMissions: { type: "array", items: { type: ["object", "string"] } },
  children: { type: "array", items: { type: ["object", "string"] } }
};

const operatorTaskResultProps = {
  id: { type: "string" },
  packetId: { type: "string" },
  taskPacketId: { type: "string" },
  taskId: { type: "string" },
  resultStatus: { type: "string" },
  taskStatus: { type: "string" },
  missionStatus: { type: "string" },
  completeTask: { type: "boolean" },
  complete: { type: "boolean" },
  completeOnSuccess: { type: "boolean" },
  blocked: { type: "boolean" },
  outcome: { type: "string" },
  summary: { type: "string" },
  resultSummary: { type: "string" },
  reason: { type: "string" },
  nextAction: { type: "string" },
  evidenceLinks: { type: "array", items: { type: "string" } },
  evidencePaths: { type: "array", items: { type: "string" } },
  artifactRefs: { type: "array", items: { type: "string" } },
  artifactPaths: { type: "array", items: { type: "string" } },
  startedAt: { type: "string" },
  completedAt: { type: "string" }
};

export const toolDefinitions = [
  { name: "ensure_workspace", description: "Ensure the canonical .dove workspace and starter artifacts exist.", inputSchema: { type: "object", properties: {} } },
  {
    name: "init_project",
    description: "Initialize or refresh project metadata and the research contract.",
    inputSchema: { type: "object", properties: { title: { type: "string" }, venue: { type: "string" }, objective: { type: "string" }, deadline: { type: "string" }, thesis: { type: "string" }, audience: { type: "string" }, strictMode: { type: "boolean" } } }
  },
  { name: "read_state", description: "Read the normalized Dove state.", inputSchema: { type: "object", properties: {} } },
  { name: "query_task_graph", description: "Refresh and read the durable task-packet graph.", inputSchema: { type: "object", properties: {} } },
  { name: "query_open_questions", description: "Refresh and read open questions across notes, review state, and task packets.", inputSchema: { type: "object", properties: {} } },
  { name: "query_decisions", description: "Refresh and read durable operational decisions and comparison decisions.", inputSchema: { type: "object", properties: {} } },
  { name: "query_lineage", description: "Refresh and read version lineage plus comparison targets.", inputSchema: { type: "object", properties: {} } },
  { name: "query_workspace_index", description: "Refresh and read the top-level workspace index for resumable state.", inputSchema: { type: "object", properties: {} } },
  { name: "query_meta_optimize", description: "Refresh and read the proposal-only meta-optimize frontier, taxonomy-aware grouped clusters, family-level operator playbooks, ranked recommendations, durable remediation packs, longer-horizon memory summaries, and report paths.", inputSchema: { type: "object", properties: {} } },
  { name: "query_governance_coverage_report", description: "Refresh and read the durable governance coverage proof report for guarded and exempt mutation paths.", inputSchema: { type: "object", properties: {} } },
  { name: "query_operator_lessons", description: "Read explicit distilled operator lessons and retrospectives without importing raw runtime traces or refreshing derived work surfaces.", inputSchema: { type: "object", properties: { domain: { type: "string" }, status: { type: "string" }, tag: { type: "string" }, actorRole: { type: "string" }, limit: { type: "number" } } } },
  { name: "query_operator_follow_through", description: "Refresh and read the proposal-only operator follow-through ledger for remediation, playbook, and execution-bridge decisions.", inputSchema: { type: "object", properties: {} } },
  { name: "query_paper_audit", description: "Run a strict audit-only paper inspection that reports findings without writing or repairing .dove artifacts.", inputSchema: { type: "object", properties: { scope: { type: "string" } } } },
  { name: "query_dove_onboarding", description: "Map project-local paper artifacts as a proposal-only Dove onboarding query without moving, rewriting, or persisting source assets.", inputSchema: { type: "object", properties: { maxDepth: { type: "number" }, maxFiles: { type: "number" }, excludeDirs: { type: "array", items: { type: "string" } }, writeMap: { type: "boolean" } } } },
  { name: "query_paper_pipeline", description: "Read the paper-domain lifecycle state from durable Dove artifacts without executing commands, running external processes, inspecting git, or writing state.", inputSchema: { type: "object", properties: {} } },
  { name: "query_dove_orchestrate", description: "Route one Dove mission to the next Dove command without writing, refreshing, running tests, or inspecting git.", inputSchema: { type: "object", properties: { request: { type: "string" }, userRequest: { type: "string" }, goal: { type: "string" }, domain: { type: "string" }, doveDomain: { type: "string" }, missionDomain: { type: "string" }, stage: { type: "string" }, missionStage: { type: "string" }, targetArtifacts: { type: "array", items: { type: "string" } }, artifacts: { type: "array", items: { type: "string" } }, artifactPaths: { type: "array", items: { type: "string" } }, acceptanceChecks: { type: "array", items: { type: "string" } }, allowAutonomy: { type: "boolean" } } } },
  { name: "query_dove_mission", description: "Frame one proposal-only Dove mission contract from the current authoritative .dove workspace without writing durable state.", inputSchema: { type: "object", properties: { goal: { type: "string" }, domain: { type: "string" }, doveDomain: { type: "string" }, missionDomain: { type: "string" }, stage: { type: "string" }, missionStage: { type: "string" }, targetArtifacts: { type: "array", items: { type: "string" } }, artifacts: { type: "array", items: { type: "string" } }, artifactPaths: { type: "array", items: { type: "string" } }, acceptanceChecks: { type: "array", items: { type: "string" } }, nextCommand: { type: "string" } } } },
  { name: "query_dove_mission_board", description: "Read the Dove mission board from authoritative .dove state without writing, refreshing, running tests, or inspecting git.", inputSchema: { type: "object", properties: { domain: { type: "string" }, doveDomain: { type: "string" }, missionDomain: { type: "string" }, stage: { type: "string" }, missionStage: { type: "string" }, packetId: { type: "string" }, packetIds: { type: "array", items: { type: "string" } }, missionPacketId: { type: "string" }, missionPacketIds: { type: "array", items: { type: "string" } }, status: { type: "string" }, statuses: { type: "array", items: { type: "string" } }, includeArchived: { type: "boolean" } } } },
  { name: "query_dove_status", description: "Read the authoritative Dove durable mission dashboard and proposal-only single-dialog status-adjustment contract without mutating durable state; adjustment items exclude completed and killed missions.", inputSchema: { type: "object", properties: { domain: { type: "string" }, doveDomain: { type: "string" }, missionDomain: { type: "string" }, stage: { type: "string" }, missionStage: { type: "string" }, packetId: { type: "string" }, packetIds: { type: "array", items: { type: "string" } }, status: { type: "string" }, statuses: { type: "array", items: { type: "string" } }, includeArchived: { type: "boolean" } } } },
  { name: "query_dove_audit", description: "Inspect Dove mission audit findings and return readiness without writing, refreshing, fixing, running tests, or inspecting git.", inputSchema: { type: "object", properties: { scope: { type: "string" }, goal: { type: "string" }, domain: { type: "string" }, doveDomain: { type: "string" }, missionDomain: { type: "string" }, stage: { type: "string" }, missionStage: { type: "string" }, targetArtifacts: { type: "array", items: { type: "string" } }, artifacts: { type: "array", items: { type: "string" } }, artifactPaths: { type: "array", items: { type: "string" } }, acceptanceChecks: { type: "array", items: { type: "string" } }, validationEvidencePaths: { type: "array", items: { type: "string" } }, validationEvidence: { type: "array", items: { type: "string" } }, evidencePaths: { type: "array", items: { type: "string" } }, changedFilePaths: { type: "array", items: { type: "string" } }, changedFiles: { type: "array", items: { type: "string" } }, changedPaths: { type: "array", items: { type: "string" } }, testEvidencePaths: { type: "array", items: { type: "string" } }, testPaths: { type: "array", items: { type: "string" } }, validationOutputPaths: { type: "array", items: { type: "string" } }, validationLogPaths: { type: "array", items: { type: "string" } }, testOutputPaths: { type: "array", items: { type: "string" } }, validationOutputs: { type: "array", items: { type: "string" } }, validationOutput: { type: "string" }, reviewEvidencePaths: { type: "array", items: { type: "string" } }, reviewEvidence: { type: "array", items: { type: "string" } } } } },
  { name: "query_dove_return", description: "Inspect Dove mission return readiness from durable .dove state without writing, fixing, running tests, or inspecting git.", inputSchema: { type: "object", properties: { goal: { type: "string" }, domain: { type: "string" }, doveDomain: { type: "string" }, missionDomain: { type: "string" }, stage: { type: "string" }, missionStage: { type: "string" }, scope: { type: "string" }, targetArtifacts: { type: "array", items: { type: "string" } }, artifacts: { type: "array", items: { type: "string" } }, artifactPaths: { type: "array", items: { type: "string" } }, acceptanceChecks: { type: "array", items: { type: "string" } }, validationEvidencePaths: { type: "array", items: { type: "string" } }, validationEvidence: { type: "array", items: { type: "string" } }, evidencePaths: { type: "array", items: { type: "string" } }, changedFilePaths: { type: "array", items: { type: "string" } }, changedFiles: { type: "array", items: { type: "string" } }, changedPaths: { type: "array", items: { type: "string" } }, testEvidencePaths: { type: "array", items: { type: "string" } }, testPaths: { type: "array", items: { type: "string" } }, validationOutputPaths: { type: "array", items: { type: "string" } }, validationLogPaths: { type: "array", items: { type: "string" } }, testOutputPaths: { type: "array", items: { type: "string" } }, validationOutputs: { type: "array", items: { type: "string" } }, validationOutput: { type: "string" }, reviewEvidencePaths: { type: "array", items: { type: "string" } }, reviewEvidence: { type: "array", items: { type: "string" } } } } },
  { name: "init_dove_goal", description: "Create or update the unique level-0 Dove init goal task.", inputSchema: { type: "object", properties: { id: { type: "string" }, goal: { type: "string" }, title: { type: "string" }, objective: { type: "string" }, summary: { type: "string" }, domain: { type: "string" }, doveDomain: { type: "string" }, status: { type: "string" }, artifactRefs: { type: "array", items: { type: "string" } } } } },
  { name: "create_dove_task", description: "Convert a user demand into a proposal-only mission contract; after approval, materialize the durable task for one foreground mission pass.", inputSchema: { type: "object", properties: { id: { type: "string" }, initId: { type: "string" }, initTitle: { type: "string" }, initObjective: { type: "string" }, initGoal: { type: "string" }, projectTitle: { type: "string" }, workspaceTitle: { type: "string" }, projectObjective: { type: "string" }, projectGoal: { type: "string" }, initDomain: { type: "string" }, projectDomain: { type: "string" }, initStatus: { type: "string" }, initArtifactRefs: { type: "array", items: { type: "string" } }, goal: { type: "string" }, objective: { type: "string" }, prompt: { type: "string" }, title: { type: "string" }, summary: { type: "string" }, stage: { type: "string" }, missionStage: { type: "string" }, domain: { type: "string" }, doveDomain: { type: "string" }, missionDomain: { type: "string" }, level: { type: "number" }, taskLevel: { type: "number" }, missionLevel: { type: "number" }, checklist: { type: ["boolean", "array"] }, autoChecklist: { type: "boolean" }, createChecklist: { type: "boolean" }, checklistItems: { type: "array", items: { type: ["object", "string"] } }, subtasks: { type: "array", items: { type: ["object", "string"] } }, creatorKind: { type: "string" }, dependencies: { type: "array", items: { type: "string" } }, dependencyIds: { type: "array", items: { type: "string" } }, blockedBy: { type: "array", items: { type: "string" } }, blockerIds: { type: "array", items: { type: "string" } }, evidenceExpectations: { type: "array", items: { type: "string" } }, evidenceLinks: { type: "array", items: { type: "string" } }, artifactRefs: { type: "array", items: { type: "string" } }, artifactPaths: { type: "array", items: { type: "string" } }, lessonIds: { type: "array", items: { type: "string" } }, contextPolicy: { type: "string" }, status: { type: "string" }, command: { type: "string" }, workflow: { type: "string" }, steps: { type: "array", items: { type: ["object", "string"] } }, runId: { type: "string" }, missionPass: { type: "object" }, passResult: { type: "object" }, result: { type: "object" }, resultStatus: { type: "string" }, taskStatus: { type: "string" }, missionStatus: { type: "string" }, completeTask: { type: "boolean" }, complete: { type: "boolean" }, completeOnSuccess: { type: "boolean" }, blocked: { type: "boolean" }, resultSummary: { type: "string" }, outcome: { type: "string" }, stopReason: { type: "string" }, evidencePaths: { type: "array", items: { type: "string" } }, validationEvidencePaths: { type: "array", items: { type: "string" } }, nextAction: { type: "string" }, startedAt: { type: "string" }, completedAt: { type: "string" }, plannedMissions: { type: "array", items: { type: ["object", "string"], properties: planMissionProps } }, resultingMissions: { type: "array", items: { type: ["object", "string"], properties: planMissionProps } }, missions: { type: "array", items: { type: ["object", "string"], properties: planMissionProps } }, childMissions: { type: "array", items: { type: ["object", "string"], properties: planMissionProps } }, confirmed: { type: "boolean" }, confirm: { type: "boolean" } } } },
  { name: "record_dove_mission_pass", description: "Record the result of one bounded foreground /dove:mission pass after resolving the durable task packet, converting completed plan outputs into pending missions when supplied.", inputSchema: { type: "object", properties: withTaskTarget({ id: { type: "string" }, runId: { type: "string" }, resultStatus: { type: "string" }, taskStatus: { type: "string" }, missionStatus: { type: "string" }, completeTask: { type: "boolean" }, complete: { type: "boolean" }, completeOnSuccess: { type: "boolean" }, blocked: { type: "boolean" }, resultSummary: { type: "string" }, summary: { type: "string" }, outcome: { type: "string" }, stopReason: { type: "string" }, evidenceLinks: { type: "array", items: { type: "string" } }, evidencePaths: { type: "array", items: { type: "string" } }, validationEvidencePaths: { type: "array", items: { type: "string" } }, artifactRefs: { type: "array", items: { type: "string" } }, artifactPaths: { type: "array", items: { type: "string" } }, command: { type: "string" }, workflow: { type: "string" }, preset: { type: "string" }, nextCommand: { type: "string" }, nextAction: { type: "string" }, startedAt: { type: "string" }, completedAt: { type: "string" }, convertPlanToMissions: { type: "boolean" }, planConversion: { type: "object", properties: { plannedMissions: { type: "array", items: { type: ["object", "string"] } }, resultingMissions: { type: "array", items: { type: ["object", "string"] } }, missions: { type: "array", items: { type: ["object", "string"] } }, childMissions: { type: "array", items: { type: ["object", "string"] } } } }, plannedMissions: { type: "array", items: { type: ["object", "string"], properties: planMissionProps } }, resultingMissions: { type: "array", items: { type: ["object", "string"], properties: planMissionProps } }, missions: { type: "array", items: { type: ["object", "string"], properties: planMissionProps } }, childMissions: { type: "array", items: { type: ["object", "string"], properties: planMissionProps } } }) } },
  { name: "apply_dove_status_adjustments", description: "Apply explicitly confirmed status choices to non-init Dove task packets only after the single /dove:status confirmation dialog yields clear packetId-to-status adjustments.", inputSchema: { type: "object", properties: { confirmed: { type: "boolean" }, confirm: { type: "boolean" }, adjustments: { type: "array", items: { type: "object", properties: { packetId: { type: "string" }, taskPacketId: { type: "string" }, taskId: { type: "string" }, id: { type: "string" }, status: { type: "string" }, taskStatus: { type: "string" }, missionStatus: { type: "string" }, reason: { type: "string" }, summary: { type: "string" }, nextAction: { type: "string" }, artifactRefs: { type: "array", items: { type: "string" } }, artifactPaths: { type: "array", items: { type: "string" } } } } }, statusAdjustments: { type: "array", items: { type: "object" } }, items: { type: "array", items: { type: "object" } } } } },
  {
    name: "run_dove_auto",
    description: "Run demand-to-task intake and, after explicit confirmation, bounded foreground iterations until completion or a boundary.",
    inputSchema: {
      type: "object",
      properties: withTaskTarget({
        id: { type: "string" },
        index: { type: "number" },
        confirmed: { type: "boolean" },
        confirm: { type: "boolean" },
        goal: { type: "string" },
        objective: { type: "string" },
        prompt: { type: "string" },
        title: { type: "string" },
        summary: { type: "string" },
        stage: { type: "string" },
        domain: { type: "string" },
        initId: { type: "string" },
        initTitle: { type: "string" },
        initObjective: { type: "string" },
        initGoal: { type: "string" },
        projectTitle: { type: "string" },
        workspaceTitle: { type: "string" },
        projectObjective: { type: "string" },
        projectGoal: { type: "string" },
        initDomain: { type: "string" },
        projectDomain: { type: "string" },
        initStatus: { type: "string" },
        initArtifactRefs: { type: "array", items: { type: "string" } },
        command: { type: "string" },
        workflow: { type: "string" },
        maxIterations: { type: "number" },
        maxSteps: { type: "number" },
        completeTask: { type: "boolean" },
        completeOnSuccess: { type: "boolean" },
        steps: { type: "array", items: { type: ["object", "string"] } },
        autoSteps: { type: "array", items: { type: ["object", "string"] } },
        runId: { type: "string" }
      })
    }
  },
  { name: "run_dove_operator", description: "After explicit confirmation, run one foreground operator pass across ready/in-progress missions and create pending blocker-investigation plan missions for blocked work.", inputSchema: { type: "object", properties: { confirmed: { type: "boolean" }, confirm: { type: "boolean" }, runId: { type: "string" }, taskResults: { type: "array", items: { type: "object", properties: operatorTaskResultProps } }, results: { type: "array", items: { type: "object", properties: operatorTaskResultProps } }, passResults: { type: "array", items: { type: "object", properties: operatorTaskResultProps } } } } },
  { name: "kill_dove_task", description: "Internal guarded capability to kill a non-init Dove task; public operators normally choose killed through /dove:status status adjustment UX.", inputSchema: { type: "object", properties: { packetId: { type: "string" }, taskPacketId: { type: "string" }, taskId: { type: "string" }, id: { type: "string" }, target: { type: "string" }, taskName: { type: "string" }, title: { type: "string" }, index: { type: "number" }, reason: { type: "string" }, killReason: { type: "string" } } } },
  { name: "reset_dove_version", description: "Create a direction-change snapshot and clear active tasks except the level-0 init task.", inputSchema: { type: "object", properties: { id: { type: "string" }, versionId: { type: "string" }, title: { type: "string" }, reason: { type: "string" }, summary: { type: "string" } } } },
  { name: "run_experience_workflow", description: "Plan, record, audit, and bridge experiment experience into claim state after resolving the durable task packet.", inputSchema: { type: "object", properties: withTaskTarget({ id: { type: "string" }, experimentId: { type: "string" }, goal: { type: "string" }, idea: { type: "string" }, title: { type: "string" }, methodology: { type: "string" }, method: { type: "string" }, successMetric: { type: "string" }, metric: { type: "string" }, comparisonTargets: { type: "array", items: { type: "string" } }, baselines: { type: "array", items: { type: "string" } }, claimId: { type: "string" }, result: { type: "object" }, resultId: { type: "string" }, outcome: { type: "string" }, summary: { type: "string" }, resultSummary: { type: "string" }, evidenceLinks: { type: "array", items: { type: "string" } }, artifactPaths: { type: "array", items: { type: "string" } } }) } },
  { name: "prepare_audio_review", description: "Prepare an isolated audio review input bundle containing only task summary, final plan/result paths, explicit artifacts, hashes, instructions, and output contract.", inputSchema: { type: "object", properties: withTaskTarget({ runId: { type: "string" }, instructions: { type: "string" }, finalPlanPaths: { type: "array", items: { type: "string" } }, planPaths: { type: "array", items: { type: "string" } }, finalResultPaths: { type: "array", items: { type: "string" } }, resultPaths: { type: "array", items: { type: "string" } }, artifactPaths: { type: "array", items: { type: "string" } }, reviewedArtifactPaths: { type: "array", items: { type: "string" } }, contextPolicy: { type: "string" } }) } },
  { name: "import_audio_review", description: "Import only a declared audio review handoff and optional report artifact back into Dove review ledgers.", inputSchema: { type: "object", properties: withTaskTarget({ runId: { type: "string" }, handoffPath: { type: "string" }, reportPath: { type: "string" } }) } },
  { name: "run_audio_review", description: "Prepare an isolated audio review and import a handoff if one is already present; otherwise return import instructions.", inputSchema: { type: "object", properties: withTaskTarget({ runId: { type: "string" }, instructions: { type: "string" }, finalPlanPaths: { type: "array", items: { type: "string" } }, finalResultPaths: { type: "array", items: { type: "string" } }, artifactPaths: { type: "array", items: { type: "string" } }, reviewedArtifactPaths: { type: "array", items: { type: "string" } }, handoffPath: { type: "string" }, reportPath: { type: "string" } }) } },
  { name: "run_dove_review_loop", description: "Run bounded audio review, draft, and experience iterations with the max iteration count from Dove settings by default.", inputSchema: { type: "object", properties: withTaskTarget({ runId: { type: "string" }, maxIterations: { type: "number" }, artifactPaths: { type: "array", items: { type: "string" } }, finalPlanPaths: { type: "array", items: { type: "string" } }, finalResultPaths: { type: "array", items: { type: "string" } }, draft: { type: "object" }, draftBody: { type: "string" }, sectionId: { type: "string" }, experience: { type: "object" }, experienceGoal: { type: "string" } }) } },
  { name: "launch_dove_mission", description: "Launch one governed Dove mission by materializing accepted proposal guidance into authoritative .dove mission packets without executing autonomy.", inputSchema: { type: "object", properties: withPolicy({ sourceType: { type: "string" }, sourceId: { type: "string" }, actorRole: { type: "string" }, workerRole: { type: "string" }, doveWorkerRole: { type: "string" }, goal: { type: "string" }, domain: { type: "string" }, doveDomain: { type: "string" }, missionDomain: { type: "string" }, stage: { type: "string" }, missionStage: { type: "string" }, targetArtifacts: { type: "array", items: { type: "string" } }, artifacts: { type: "array", items: { type: "string" } }, artifactPaths: { type: "array", items: { type: "string" } }, acceptanceChecks: { type: "array", items: { type: "string" } }, acceptanceCriteria: { type: "array", items: { type: "string" } }, returnProtocol: { type: "string" }, packetId: { type: "string" }, missionPacketId: { type: "string" }, followThroughId: { type: "string" }, selectedConversionPathKey: { type: "string" }, title: { type: "string" }, summary: { type: "string" }, phase: { type: "string" }, assignedRole: { type: "string" }, lifecycleStatus: { type: "string" }, currentFocus: { type: "string" }, nextAction: { type: "string" }, dependencies: { type: "array", items: { type: "string" } }, evidenceLinks: { type: "array", items: { type: "string" } }, outputPaths: { type: "array", items: { type: "string" } }, programId: { type: "string" }, programTitle: { type: "string" }, programObjective: { type: "string" }, programAgenda: { type: "array", items: { type: "string" } }, programEvidenceBacklog: { type: "array", items: { type: "string" } }, programRunId: { type: "string" }, approvalId: { type: "string" }, allowedStepType: { type: "string" }, decisionSummary: { type: "string" }, rationale: { type: "string" }, executeBy: { type: "string" }, reviewAfter: { type: "string" } }) } },
  { name: "query_program_approvals", description: "Read durable program approvals, runs, and review checkpoints.", inputSchema: { type: "object", properties: { programId: { type: "string" }, programRunId: { type: "string" }, status: { type: "string" } } } },
  { name: "query_campaigns", description: "Read durable multi-cycle campaign plans and their linked program/run state without executing work.", inputSchema: { type: "object", properties: { campaignId: { type: "string" }, status: { type: "string" } } } },
  { name: "query_boundary_report", description: "Read the workflow-pack boundary report for managed versus user-owned state.", inputSchema: { type: "object", properties: {} } },
  { name: "read_role_context_manifest", description: "Refresh and read a narrower per-role context manifest.", inputSchema: { type: "object", properties: { roleId: { type: "string" } } } },
  { name: "read_phase_context_manifest", description: "Refresh and read a phase-scoped context manifest.", inputSchema: { type: "object", properties: { phaseId: { type: "string" } } } },
  { name: "read_packet_context_manifest", description: "Refresh and read a packet-scoped context manifest with dependency and resume guidance.", inputSchema: { type: "object", properties: { packetId: { type: "string" } } } },
  { name: "read_artifact_context_manifest", description: "Refresh and read an artifact-scoped local context manifest tied to a durable path.", inputSchema: { type: "object", properties: { artifactPath: { type: "string" } } } },
  { name: "read_action_context_bundle", description: "Refresh and read an explicit pre-action local-context bundle for the current, role, phase, packet, or artifact scope.", inputSchema: { type: "object", properties: { scopeType: { type: "string" }, roleId: { type: "string" }, phaseId: { type: "string" }, packetId: { type: "string" }, artifactPath: { type: "string" } } } },
  { name: "summarize_session_journal", description: "Refresh and summarize durable session/workspace persistence surfaces.", inputSchema: { type: "object", properties: {} } },
  {
    name: "upsert_orchestration_board",
    description: "Update the canonical orchestration board under .dove/orchestration/board.json.",
    inputSchema: { type: "object", properties: withPolicy({ objective: { type: "string" }, phase: { type: "string" }, assignedRole: { type: "string" }, intentType: { type: "string" }, currentFocus: { type: "string" }, nextAction: { type: "string" }, continuationState: { type: "object" }, reviewRequiredBeforeFinalize: { type: "boolean" }, tasks: { type: "array", items: { type: "object" } }, blockers: { type: "array", items: { type: "object" } }, evidenceLinks: { type: "array", items: { type: "string" } }, experimentIds: { type: "array", items: { type: "string" } }, rebuttalIssueIds: { type: "array", items: { type: "string" } }, activeComparisonTargets: { type: "array", items: { type: "string" } }, versionLineage: { type: "object" } }) }
  },
  {
    name: "append_handoff",
    description: "Append a durable handoff entry and update the assigned role.",
    inputSchema: { type: "object", properties: withPolicy({ fromRole: { type: "string" }, toRole: { type: "string" }, phase: { type: "string" }, intentType: { type: "string" }, summary: { type: "string" }, currentFocus: { type: "string" }, nextAction: { type: "string" }, nextActions: { type: "array", items: { type: "string" } }, evidenceLinks: { type: "array", items: { type: "string" } }, blockerIds: { type: "array", items: { type: "string" } } }) }
  },
  {
    name: "update_research_brief",
    description: "Update the durable research brief and agenda artifacts. Task-scoped writes resolve to a durable packet first; missing or ambiguous targets require explicit packet confirmation unless there is one unique high-confidence autoSelect candidate.",
    inputSchema: { type: "object", properties: withTaskTarget({ objective: { type: "string" }, agenda: { type: "array", items: { type: "string" } }, evidenceBacklog: { type: "array", items: { type: "string" } }, phase: { type: "string" }, assignedRole: { type: "string" } }) }
  },
  {
    name: "register_source",
    description: "Register or update a provenance-aware source record. Task-scoped writes resolve to a durable packet first; missing or ambiguous targets require explicit packet confirmation unless there is one unique high-confidence autoSelect candidate.",
    inputSchema: { type: "object", properties: withTaskTarget({ sourceId: { type: "string" }, citationKey: { type: "string" }, title: { type: "string" }, authors: { type: "array", items: { type: "string" } }, year: { type: ["string", "number"] }, locator: { type: "string" }, sourceType: { type: "string" }, abstract: { type: "string" }, origin: { type: "string" } }) }
  },
  {
    name: "upsert_note",
    description: "Create or update a structured note linked to one or more sources. Task-scoped writes resolve to a durable packet first; missing or ambiguous targets require explicit packet confirmation unless there is one unique high-confidence autoSelect candidate.",
    inputSchema: { type: "object", properties: withTaskTarget({ noteId: { type: "string" }, title: { type: "string" }, sectionId: { type: "string" }, sourceIds: { type: "array", items: { type: "string" } }, summary: { type: "string" }, quotes: { type: "array", items: { type: "string" } }, claims: { type: "array", items: { type: "string" } }, openQuestions: { type: "array", items: { type: "string" } } }) }
  },
  {
    name: "upsert_claims",
    description: "Write claims derived from results into the evidence store; resolves a durable task packet before writing and requires the builder role, or its researcher subagent role unless a traceable override is provided.",
    inputSchema: { type: "object", properties: withPolicy(withTaskTarget({ claims: { type: "array", items: { type: "object", properties: { id: { type: "string" }, text: { type: "string" }, sectionId: { type: "string" }, sourceIds: { type: "array", items: { type: "string" } }, noteIds: { type: "array", items: { type: "string" } }, experimentIds: { type: "array", items: { type: "string" } }, evidenceLinks: { type: "array", items: { type: "string" } }, status: { type: "string" }, confidence: { type: "string" }, gap: { type: "string" } } } } })) }
  },
  {
    name: "upsert_plan",
    description: "Create or update the current plan artifact. Task-scoped writes resolve to a durable packet first; missing or ambiguous targets require explicit packet confirmation unless there is one unique high-confidence autoSelect candidate.",
    inputSchema: { type: "object", properties: withTaskTarget({ thesis: { type: "string" }, audience: { type: "string" }, sections: { type: "array", items: { type: "string" } }, evidenceGaps: { type: "array", items: { type: "string" } }, milestones: { type: "array", items: { type: "string" } }, figures: { type: "array", items: { type: "string" } }, notes: { type: "string" } }) }
  },
  {
    name: "upsert_outline",
    description: "Create or update the current section outline. Task-scoped writes resolve to a durable packet first; missing or ambiguous targets require explicit packet confirmation unless there is one unique high-confidence autoSelect candidate.",
    inputSchema: { type: "object", properties: withTaskTarget({ sections: { type: "array", items: { type: "object", properties: { id: { type: "string" }, title: { type: "string" }, status: { type: "string" }, goal: { type: "string" }, evidenceFocus: { type: "string" } } } } }) }
  },
  {
    name: "upsert_draft",
    description: "Create or update a section draft under .dove/drafts. Task-scoped writes resolve to a durable packet first; missing or ambiguous targets require explicit packet confirmation unless there is one unique high-confidence autoSelect candidate.",
    inputSchema: { type: "object", properties: withTaskTarget({ sectionId: { type: "string" }, title: { type: "string" }, body: { type: "string" }, status: { type: "string" }, summary: { type: "string" } }) }
  },
  {
    name: "upsert_experiment_plan",
    description: "Create or update a claim-driven experiment plan; resolves a durable task packet before writing and requires the builder role, or its experiment-planner subagent role unless a traceable override is provided.",
    inputSchema: { type: "object", properties: withPolicy(withTaskTarget({ id: { type: "string" }, title: { type: "string" }, claimId: { type: "string" }, hypothesis: { type: "string" }, methodology: { type: "string" }, successMetric: { type: "string" }, comparisonTargets: { type: "array", items: { type: "string" } }, status: { type: "string" }, owner: { type: "string" } })) }
  },
  {
    name: "upsert_experiment_result",
    description: "Create or update a durable experiment result entry; resolves a durable task packet before writing and requires the builder role, or its experiment-planner subagent role unless a traceable override is provided.",
    inputSchema: { type: "object", properties: withPolicy(withTaskTarget({ id: { type: "string" }, experimentId: { type: "string" }, claimId: { type: "string" }, outcome: { type: "string" }, summary: { type: "string" }, evidenceLinks: { type: "array", items: { type: "string" } }, comparisonTargets: { type: "array", items: { type: "string" } } })) }
  },
  {
    name: "run_experiment_audit",
    description: "Create or update a durable experiment audit record distinct from raw results; resolves a durable task packet before writing and requires resultId when an experiment has multiple results.",
    inputSchema: { type: "object", properties: withPolicy(withTaskTarget({ resultId: { type: "string" }, experimentId: { type: "string" }, reviewedArtifactRefs: { type: "array", items: { type: "string" } }, auditFindings: { type: "array", items: { type: "string" } }, integrityFlags: { type: "array", items: { type: "string" } }, confidence: { type: "string" }, outcomeMapping: { type: "string" } })) }
  },
  {
    name: "bridge_result_to_claim",
    description: "Persist an explicit result-to-claim bridge event and update claim state; resolves a durable task packet before writing and requires resultId when an experiment has multiple results.",
    inputSchema: { type: "object", properties: withPolicy(withTaskTarget({ resultId: { type: "string" }, experimentId: { type: "string" }, auditIds: { type: "array", items: { type: "string" } }, reason: { type: "string" } })) }
  },
  {
    name: "run_review_loop",
    description: "Run an evidence-aware review pass and generate a revision plan; resolves a durable task packet before writing and requires the reviewer role unless a traceable override is provided.",
    inputSchema: { type: "object", properties: withPolicy(withTaskTarget({ scope: { type: "string" }, stage: { type: "string" } })) }
  },
  {
    name: "append_review_log",
    description: "Append a structured manual review entry; resolves a durable task packet before writing and requires the reviewer role unless a traceable override is provided.",
    inputSchema: { type: "object", properties: withPolicy(withTaskTarget({ timestamp: { type: "string" }, stage: { type: "string" }, scope: { type: "string" }, verdict: { type: "string" }, summary: { type: "string" }, findings: { type: "array", items: { type: "object" } }, actionItems: { type: "array", items: { type: "string" } } })) }
  },
  {
    name: "prepare_isolated_review",
    description: "Prepare an isolated reviewer input bundle from explicit Dove artifacts after resolving the durable task packet target, without invoking an external reviewer process.",
    inputSchema: { type: "object", properties: withPolicy(withTaskTarget({ runId: { type: "string" }, scope: { type: "string" }, instructions: { type: "string" }, mediatorRole: { type: "string" }, reviewerRole: { type: "string" }, reviewedArtifactPaths: { type: "array", items: { type: "string" } }, artifactPaths: { type: "array", items: { type: "string" } } })) }
  },
  {
    name: "import_isolated_review",
    description: "Import only an isolated review handoff and report artifact back into Dove review state after resolving the durable task packet target.",
    inputSchema: { type: "object", properties: withPolicy(withTaskTarget({ runId: { type: "string" }, handoffPath: { type: "string" }, reportPath: { type: "string" } })) }
  },
  {
    name: "upsert_revision_plan",
    description: "Write a manual revision plan artifact; resolves a durable task packet before writing and requires the planner role unless a traceable override is provided.",
    inputSchema: { type: "object", properties: withPolicy(withTaskTarget({ summary: { type: "string" }, items: { type: "array", items: { type: "string" } }, updatedAt: { type: "string" } })) }
  },
  { name: "set_section_status", description: "Update the status and summary for a section after resolving the durable task packet target.", inputSchema: { type: "object", properties: withTaskTarget({ sectionId: { type: "string" }, status: { type: "string" }, summary: { type: "string" } }) } },
  { name: "sync_checklist", description: "Regenerate the checklist from current state and review findings.", inputSchema: { type: "object", properties: {} } },
  { name: "sync_citations", description: "Audit citations and regenerate references.bib plus the citation log.", inputSchema: { type: "object", properties: { citedOnly: { type: "boolean" } } } },
  { name: "refresh_wiki", description: "Regenerate the durable research wiki and typed wiki indexes from current sources, notes, claims, and review state.", inputSchema: { type: "object", properties: {} } },
  { name: "normalize_rebuttal_issues", description: "Normalize reviewer issues into a durable rebuttal issue board after resolving the durable task packet target; requires the reviewer role unless a traceable override is provided.", inputSchema: { type: "object", properties: withPolicy(withTaskTarget({ issues: { type: "array", items: { type: "object" } } })) } },
  { name: "build_rebuttal_strategy", description: "Generate the rebuttal strategy and response draft from normalized issues after resolving the durable task packet target; requires the builder role, or its revision/rebuttal subagent role unless a traceable override is provided.", inputSchema: { type: "object", properties: withPolicy(withTaskTarget({})) } },
  { name: "build_rebuttal", description: "Generate an artifact-backed rebuttal draft from review and evidence state after resolving the durable task packet target.", inputSchema: { type: "object", properties: withTaskTarget({}) } },
  { name: "create_version_snapshot", description: "Snapshot the current paper state and update version lineage after resolving the durable task packet target; requires the planner role, or its version-analyst audit subagent role unless a traceable override is provided.", inputSchema: { type: "object", properties: withPolicy(withTaskTarget({ versionId: { type: "string" }, label: { type: "string" }, parentVersionId: { type: "string" }, summary: { type: "string" } })) } },
  { name: "compare_versions", description: "Compare two durable paper snapshots and record the comparison after resolving the durable task packet target; requires the planner role, or its version-analyst audit subagent role unless a traceable override is provided.", inputSchema: { type: "object", properties: withPolicy(withTaskTarget({ fromVersionId: { type: "string" }, toVersionId: { type: "string" } })) } },
  { name: "list_artifacts", description: "List the expected Dove artifacts and whether they exist.", inputSchema: { type: "object", properties: {} } },
  { name: "upsert_figure_plan", description: "Write the figure backlog, linkage metadata, generation intent, and artifact contracts after resolving the durable task packet target.", inputSchema: { type: "object", properties: withTaskTarget({ items: { type: "array", items: { type: "object" } } }) } },
  { name: "run_figure_workflow", description: "Turn one user-described figure intent into a packet-scoped figure plan, material discovery, optional generation/import, caption/provenance, and QA status.", inputSchema: { type: "object", properties: withTaskTarget({ intent: { type: "string" }, description: { type: "string" }, name: { type: "string" }, title: { type: "string" }, figureId: { type: "string" }, id: { type: "string" }, purpose: { type: "string" }, captionIntent: { type: "string" }, targetClaimIds: { type: "array", items: { type: "string" } }, claimIds: { type: "array", items: { type: "string" } }, sourceSections: { type: "array", items: { type: "string" } }, sectionIds: { type: "array", items: { type: "string" } }, sourceArtifactPaths: { type: "array", items: { type: "string" } }, artifactPaths: { type: "array", items: { type: "string" } }, relatedExperimentIds: { type: "array", items: { type: "string" } }, experimentIds: { type: "array", items: { type: "string" } }, reviewConcernIds: { type: "array", items: { type: "string" } }, rebuttalIssueIds: { type: "array", items: { type: "string" } }, requiredVisualElements: { type: "array", items: { type: "string" } }, materialHints: { type: "array", items: { type: ["object", "string"] } }, materialRequirements: { type: "array", items: { type: "object" } }, providerId: { type: "string" }, executeProvider: { type: "boolean" }, allowMissingMaterials: { type: "boolean" }, runId: { type: "string" }, outputFormat: { type: "string" }, constraints: { type: "array", items: { type: "string" } }, outputManifestPath: { type: "string" }, finalSvgPath: { type: "string" }, svgContent: { type: "string" }, caption: { type: "string" }, captionDraft: { type: "string" }, captionId: { type: "string" } }) } },
  { name: "prepare_figure_generation", description: "Discover required figure materials and write a durable generation input bundle after resolving the durable task packet target.", inputSchema: { type: "object", properties: withTaskTarget({ figureId: { type: "string" }, id: { type: "string" }, runId: { type: "string" }, providerId: { type: "string" }, constraints: { type: "array", items: { type: "string" } }, outputFormat: { type: "string" }, materialHints: { type: "array", items: { type: ["object", "string"] } }, executeProvider: { type: "boolean" }, allowMissingMaterials: { type: "boolean" } }) } },
  { name: "import_figure_generation", description: "Import a declared generated figure output, validate SVG safety, write caption/provenance, and refresh figure QA after resolving the durable task packet target.", inputSchema: { type: "object", properties: withTaskTarget({ figureId: { type: "string" }, id: { type: "string" }, runId: { type: "string" }, outputManifestPath: { type: "string" }, caption: { type: "string" }, captionDraft: { type: "string" }, captionId: { type: "string" }, finalSvgPath: { type: "string" }, svgContent: { type: "string" } }) } },
  { name: "validate_figure_pipeline", description: "Regenerate durable figure material, generation, caption, and stage-validation QA outputs.", inputSchema: { type: "object", properties: {} } },
  { name: "record_operator_lesson", description: "Record one explicit distilled operator lesson with problem, decisions, pitfalls, validation, and next-time guidance; rejects raw runtime traces.", inputSchema: { type: "object", properties: withPolicy(withTaskTarget({ id: { type: "string" }, title: { type: "string" }, problem: { type: "string" }, decisions: { type: "array", items: { type: "string" } }, pitfalls: { type: "array", items: { type: "string" } }, validation: { type: "array", items: { type: "string" } }, nextTime: { type: "array", items: { type: "string" } }, domain: { type: "string" }, doveDomain: { type: "string" }, missionDomain: { type: "string" }, stage: { type: "string" }, missionStage: { type: "string" }, actorRole: { type: "string" }, tags: { type: "array", items: { type: "string" } }, sourceType: { type: "string" }, sourceId: { type: "string" }, sourceArtifacts: { type: "array", items: { type: "string" } }, artifactPaths: { type: "array", items: { type: "string" } }, sourceArtifactPath: { type: "string" }, relatedPacketIds: { type: "array", items: { type: "string" } }, packetIds: { type: "array", items: { type: "string" } }, taskPacketIds: { type: "array", items: { type: "string" } }, missionPacketIds: { type: "array", items: { type: "string" } }, taskIds: { type: "array", items: { type: "string" } }, recommendationIds: { type: "array", items: { type: "string" } }, playbookIds: { type: "array", items: { type: "string" } }, remediationPackIds: { type: "array", items: { type: "string" } }, status: { type: "string" } })) } }
  ,{ name: "record_operator_follow_through", description: "Record a proposal-only operator decision for a remediation pack, family playbook, or execution-bridge candidate.", inputSchema: { type: "object", properties: withPolicy({ sourceType: { type: "string" }, sourceId: { type: "string" }, status: { type: "string" }, actorRole: { type: "string" }, workerRole: { type: "string" }, programId: { type: "string" }, programRunId: { type: "string" }, approvalId: { type: "string" }, decisionSummary: { type: "string" }, rationale: { type: "string" }, selectedConversionPathKey: { type: "string" }, linkedTargetArtifact: { type: "string" }, linkedTargetId: { type: "string" }, plannedTarget: { type: "boolean" }, deferUntil: { type: "string" }, executeBy: { type: "string" }, reviewAfter: { type: "string" }, closureReason: { type: "string" }, closureArtifactPaths: { type: "array", items: { type: "string" } } }) } }
  ,{ name: "issue_program_approval", description: "Issue one explicit approval or bounded multi-step authority envelope for an existing packet-bound program run without executing work.", inputSchema: { type: "object", properties: { continuationFromRunId: { type: "string" }, packetId: { type: "string" }, programId: { type: "string" }, programRunId: { type: "string" }, approvalId: { type: "string" }, campaignId: { type: "string" }, campaignStepId: { type: "string" }, campaignStepNextAction: { type: "string" }, actorRole: { type: "string" }, workerRole: { type: "string" }, sourceType: { type: "string" }, sourceId: { type: "string" }, allowedStepType: { type: "string" }, autonomyPolicy: { type: "string" }, stepBudget: { type: "number" }, stepSequence: { type: "array", items: { type: "object", properties: { allowedStepType: { type: "string" }, stepPayload: { type: "object" } } } }, noteTitle: { type: "string" }, noteSectionId: { type: "string" }, noteSourceIds: { type: "array", items: { type: "string" } }, noteSummary: { type: "string" }, noteQuotes: { type: "array", items: { type: "string" } }, noteClaims: { type: "array", items: { type: "string" } }, noteOpenQuestions: { type: "array", items: { type: "string" } }, auditResultId: { type: "string" }, auditReviewedArtifactRefs: { type: "array", items: { type: "string" } }, bridgeResultId: { type: "string" }, bridgeAuditIds: { type: "array", items: { type: "string" } }, bridgeReason: { type: "string" }, reviewScope: { type: "string" }, reviewStage: { type: "string" }, programTitle: { type: "string" }, programObjective: { type: "string" }, programAgenda: { type: "array", items: { type: "string" } }, programEvidenceBacklog: { type: "array", items: { type: "string" } }, executeBy: { type: "string" }, reviewAfter: { type: "string" }, expiresAt: { type: "string" }, summary: { type: "string" }, rationale: { type: "string" }, followThroughId: { type: "string" } } } }
  ,{ name: "plan_campaign", description: "Record or update a planner-supervised multi-cycle campaign plan without approving or executing work.", inputSchema: { type: "object", properties: { campaignId: { type: "string" }, title: { type: "string" }, objective: { type: "string" }, status: { type: "string" }, phase: { type: "string" }, actorRole: { type: "string" }, programIds: { type: "array", items: { type: "string" } }, steps: { type: "array", items: { type: "object", properties: { id: { type: "string" }, title: { type: "string" }, status: { type: "string" }, programId: { type: "string" }, programRunId: { type: "string" }, approvalId: { type: "string" }, packetId: { type: "string" }, allowedStepType: { type: "string" }, objective: { type: "string" }, nextAction: { type: "string" }, evidenceLinks: { type: "array", items: { type: "string" } }, outputPaths: { type: "array", items: { type: "string" } }, executeBy: { type: "string" }, reviewAfter: { type: "string" } } } }, nextAction: { type: "string" }, reviewPolicy: { type: "string" }, explicitApprovalRequired: { type: "boolean" }, noHiddenRuntime: { type: "boolean" } } } }
  ,{ name: "revoke_program_approval", description: "Revoke one explicit program approval without executing work.", inputSchema: { type: "object", properties: { approvalId: { type: "string" }, actorRole: { type: "string" }, summary: { type: "string" }, revokeReason: { type: "string" } } } }
  ,{ name: "materialize_guidance_packet", description: "Create a durable task packet from accepted remediation guidance or a packet-type execution bridge candidate.", inputSchema: { type: "object", properties: withPolicy({ sourceType: { type: "string" }, sourceId: { type: "string" }, actorRole: { type: "string" }, workerRole: { type: "string" }, programId: { type: "string" }, programTitle: { type: "string" }, programObjective: { type: "string" }, programAgenda: { type: "array", items: { type: "string" } }, programEvidenceBacklog: { type: "array", items: { type: "string" } }, programRunId: { type: "string" }, approvalId: { type: "string" }, allowedStepType: { type: "string" }, noteTitle: { type: "string" }, noteSectionId: { type: "string" }, noteSourceIds: { type: "array", items: { type: "string" } }, noteSummary: { type: "string" }, noteQuotes: { type: "array", items: { type: "string" } }, noteClaims: { type: "array", items: { type: "string" } }, noteOpenQuestions: { type: "array", items: { type: "string" } }, auditResultId: { type: "string" }, auditReviewedArtifactRefs: { type: "array", items: { type: "string" } }, bridgeResultId: { type: "string" }, bridgeAuditIds: { type: "array", items: { type: "string" } }, bridgeReason: { type: "string" }, reviewScope: { type: "string" }, reviewStage: { type: "string" }, programApprovalSummary: { type: "string" }, selectedConversionPathKey: { type: "string" }, packetId: { type: "string" }, title: { type: "string" }, summary: { type: "string" }, phase: { type: "string" }, assignedRole: { type: "string" }, status: { type: "string" }, lifecycleStatus: { type: "string" }, currentFocus: { type: "string" }, nextAction: { type: "string" }, dependencies: { type: "array", items: { type: "string" } }, evidenceLinks: { type: "array", items: { type: "string" } }, outputPaths: { type: "array", items: { type: "string" } }, decisionSummary: { type: "string" }, rationale: { type: "string" }, executeBy: { type: "string" }, reviewAfter: { type: "string" } }) } }
  ,{ name: "run_autonomy_once", description: "Manually invoke one governed planner-supervised autonomous control-plane pass over at most one materialized packet or one planned target.", inputSchema: { type: "object", properties: { actorRole: { type: "string" } } } }
  ,{ name: "run_autonomy_foreground", description: "Run an explicit foreground autonomy pass that may continue one program-scoped bounded authority envelope or a same-lineage materialized-packet continuation until a stop condition is reached.", inputSchema: { type: "object", properties: { actorRole: { type: "string" }, maxSteps: { type: "number" }, packetId: { type: "string" }, programRunId: { type: "string" }, approvalId: { type: "string" } } } }
  ,{ name: "run_autonomy_operate", description: "Run the maximum-allowed explicit foreground research operating surface from an objective or existing proposal source through planning, materialization, bounded approval, execution, and durable stop summary.", inputSchema: { type: "object", properties: { objective: { type: "string" }, sourceType: { type: "string" }, sourceId: { type: "string" }, actorRole: { type: "string" }, workerRole: { type: "string" }, maxSteps: { type: "number" }, packetId: { type: "string" }, programId: { type: "string" }, programRunId: { type: "string" }, approvalId: { type: "string" }, campaignId: { type: "string" }, campaignStepId: { type: "string" }, executeBy: { type: "string" }, reviewAfter: { type: "string" }, expiresAt: { type: "string" }, stepSequence: { type: "array", items: { type: "object", properties: { allowedStepType: { type: "string" }, stepPayload: { type: "object" } } } }, reviewScope: { type: "string" }, reviewStage: { type: "string" }, title: { type: "string" }, summary: { type: "string" }, rationale: { type: "string" } } } }
];
