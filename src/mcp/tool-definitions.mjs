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

const canonicalBoundaryProps = {
  id: { type: "string" },
  type: { type: "string" },
  status: { type: "string" },
  packetId: { type: ["string", "null"] },
  runId: { type: ["string", "null"] },
  sourceSurface: { type: ["string", "null"] },
  command: { type: ["string", "null"] },
  reason: { type: "string" },
  summary: { type: "string" },
  requiredInputs: { type: "array", items: { type: "string" } },
  requiredActions: { type: "array", items: { type: "string" } },
  ownerRole: { type: "string" },
  nextRole: { type: "string" },
  createdAt: { type: ["string", "null"] },
  resolvedAt: { type: ["string", "null"] },
  resolution: { type: ["string", "null"] }
};

const canonicalBoundarySchema = {
  type: ["object", "null"],
  properties: canonicalBoundaryProps,
  additionalProperties: false
};

const canonicalHandoffProps = {
  id: { type: "string" },
  status: { type: "string" },
  fromRole: { type: "string" },
  toRole: { type: "string" },
  reason: { type: "string" },
  summary: { type: "string" },
  boundaryId: { type: ["string", "null"] },
  sourceRunId: { type: ["string", "null"] },
  requestedAt: { type: ["string", "null"] },
  acceptedAt: { type: ["string", "null"] },
  completedAt: { type: ["string", "null"] }
};

const canonicalHandoffSchema = {
  type: ["object", "null"],
  properties: canonicalHandoffProps,
  additionalProperties: false
};

const publicReceiptBoundaryProps = {
  type: { type: "string" },
  reason: { type: "string" },
  summary: { type: "string" },
  requiredInputs: { type: "array", items: { type: "string" } },
  requiredActions: { type: "array", items: { type: "string" } },
  nextAction: { type: "string" }
};

const boundaryProps = {
  boundary: {
    type: "object",
    properties: publicReceiptBoundaryProps,
    additionalProperties: false
  },
  boundaryType: { type: "string" },
  boundaryId: { type: "string" },
  requiredInputs: { type: "array", items: { type: "string" } },
  requiredActions: { type: "array", items: { type: "string" } },
  ownerRole: { type: "string" },
  nextRole: { type: "string" },
  handoff: {
    type: "object",
    properties: {
      reason: { type: "string" },
      summary: { type: "string" }
    },
    additionalProperties: false
  },
  handoffId: { type: "string" },
  blockedReason: { type: "string" }
};

const missionPassBoundaryProps = {
  boundary: boundaryProps.boundary,
  boundaryType: boundaryProps.boundaryType,
  boundaryId: boundaryProps.boundaryId,
  requiredInputs: boundaryProps.requiredInputs,
  requiredActions: boundaryProps.requiredActions,
  blockedReason: boundaryProps.blockedReason
};

const workContractRouteProps = {
  label: { type: "string" },
  title: { type: "string" },
  command: { type: "string" },
  nextAction: { type: "string" },
  workflow: { type: "string" },
  copyableCommand: { type: "string" },
  copyCommand: { type: "string" },
  packetId: { type: "string" },
  taskPacketId: { type: "string" },
  missionPacketId: { type: "string" },
  when: { type: "string" },
  reason: { type: "string" },
  role: { type: "string" },
  ownerRole: { type: "string" },
  evidenceRequired: { type: "array", items: { type: "string" } },
  evidenceContract: { type: "array", items: { type: "string" } },
  evidenceExpectations: { type: "array", items: { type: "string" } },
  doneCriteria: { type: "array", items: { type: "string" } },
  rank: { type: "number" }
};

const workContractRouteSchema = {
  type: "object",
  properties: workContractRouteProps,
  additionalProperties: false
};

const workContractProps = {
  purpose: { type: "string" },
  deliverables: { type: "array", items: { type: "string" } },
  outOfScope: { type: "array", items: { type: "string" } },
  outOfScopeItems: { type: "array", items: { type: "string" } },
  evidenceContract: { type: "array", items: { type: "string" } },
  doneCriteria: { type: "array", items: { type: "string" } },
  practicalImpact: { type: "string" },
  recommendedRoutes: { type: "array", items: workContractRouteSchema }
};

const executionFileSchema = {
  type: "object",
  properties: {
    path: { type: "string" },
    action: { type: "string" },
    target: { type: "string" },
    change: { type: "string" }
  },
  additionalProperties: false
};

const executionMaterialsSchema = {
  type: "object",
  properties: {
    requiredInputs: { type: "array", items: { type: "string" } },
    requiredArtifacts: { type: "array", items: { type: "string" } },
    sourceRefs: { type: "array", items: { type: "string" } },
    artifactRefs: { type: "array", items: { type: "string" } }
  },
  additionalProperties: false
};

const executionConvergenceSchema = {
  type: "object",
  properties: {
    criteria: { type: "array", items: { type: "string" } },
    verificationCommands: { type: "array", items: { type: "string" } },
    evidenceRequired: { type: "array", items: { type: "string" } },
    definitionOfDone: { type: "string" }
  },
  additionalProperties: false
};

const executionFailureRouteProps = {
  on: { type: "string" },
  boundaryType: { type: "string" },
  nextAction: { type: "string" },
  requiredActions: { type: "array", items: { type: "string" } }
};

const executionFailureRouteSchema = {
  type: "object",
  properties: executionFailureRouteProps,
  additionalProperties: false
};

const executionContractProps = {
  chainType: { type: "string" },
  roleSequence: { type: "array", items: { type: "string" } },
  readFirst: { type: "array", items: { type: "string" } },
  action: { type: "string" },
  implementation: { type: "array", items: { type: "string" } },
  files: { type: "array", items: executionFileSchema },
  materials: executionMaterialsSchema,
  convergence: executionConvergenceSchema,
  failureRoutes: { type: "array", items: executionFailureRouteSchema }
};

const workContractSchema = {
  type: "object",
  properties: workContractProps,
  additionalProperties: false
};

const executionContractSchema = {
  type: "object",
  properties: executionContractProps,
  additionalProperties: false
};

const missionChecklistItemProps = {
  id: { type: "string" },
  title: { type: "string" },
  summary: { type: "string" },
  level: { type: "number" },
  stage: { type: "string" },
  domain: { type: "string" },
  status: { type: "string" },
  dependencies: { type: "array", items: { type: "string" } },
  blockedBy: { type: "array", items: { type: "string" } },
  evidenceExpectations: { type: "array", items: { type: "string" } },
  artifactRefs: { type: "array", items: { type: "string" } },
  nextAction: { type: "string" },
  workContract: workContractSchema,
  executionContract: executionContractSchema
};

const missionReplayProps = {
  proposalVersion: { type: "number", enum: [1] },
  proposalWorkspace: { type: "string", description: "Canonical realpath identity bound to the local exact replay data." },
  mutationMode: {
    type: "string",
    enum: ["patch-plan", "direct-process"],
    description: "Mutation mode bound into the exact local proposal replay."
  },
  responseLanguage: { type: "string" },
  initId: { type: "string" },
  initTitle: { type: "string" },
  initObjective: { type: "string" },
  initDomain: { type: "string" },
  initStatus: { type: "string" },
  initArtifactRefs: { type: "array", items: { type: "string" } },
  id: { type: "string" },
  goal: { type: "string" },
  title: { type: "string" },
  summary: { type: "string" },
  stage: { type: "string" },
  domain: { type: "string" },
  level: { type: "number" },
  creatorKind: { type: "string" },
  status: { type: "string" },
  dependencies: { type: "array", items: { type: "string" } },
  blockedBy: { type: "array", items: { type: "string" } },
  ownerRole: { type: "string" },
  nextRole: { type: "string" },
  boundary: canonicalBoundarySchema,
  handoff: canonicalHandoffSchema,
  currentFocus: { type: "string" },
  nextAction: { type: "string" },
  evidenceExpectations: { type: "array", items: { type: "string" } },
  workContract: workContractSchema,
  executionContract: executionContractSchema,
  artifactRefs: { type: "array", items: { type: "string" } },
  contextPolicy: { type: "string" },
  lessonIds: { type: "array", items: { type: "string" } },
  checklist: {
    anyOf: [
      { type: "boolean" },
      {
        type: "array",
        items: {
          anyOf: [
            { type: "string" },
            {
              type: "object",
              properties: missionChecklistItemProps,
              additionalProperties: false
            }
          ]
        }
      }
    ]
  },
  autoChecklist: { type: "boolean" },
  createChecklist: { type: "boolean" },
  checklistItems: { type: "array", items: { type: "object", properties: missionChecklistItemProps, additionalProperties: false } },
  proposalDigest: { type: "string", pattern: "^[0-9a-f]{64}$", description: "Exact SHA-256 proposal digest returned with trusted-local replay data. It detects replay drift but is not proof of human approval or tamper-proof authentication." },
  confirmed: { type: "boolean" },
  confirm: { type: "boolean" }
};

const verifiedCriteriaItemProps = {
  criterion: { type: "string" },
  status: { type: "string" },
  evidencePaths: { type: "array", items: { type: "string" } }
};

const verifiedCriteriaItemSchema = {
  type: "object",
  properties: verifiedCriteriaItemProps,
  additionalProperties: false
};

const validationGateResultProps = {
  gate: { type: "string" },
  name: { type: "string" },
  status: { type: "string" },
  outcome: { type: "string" },
  summary: { type: "string" },
  evidencePaths: { type: "array", items: { type: "string" } },
  artifactPaths: { type: "array", items: { type: "string" } }
};

const experiencePlanProps = {
  id: { type: "string" },
  experimentId: { type: "string" },
  goal: { type: "string" },
  idea: { type: "string" },
  title: { type: "string" },
  methodology: { type: "string" },
  method: { type: "string" },
  successMetric: { type: "string" },
  metric: { type: "string" },
  comparisonTargets: { type: "array", items: { type: "string" } },
  baselines: { type: "array", items: { type: "string" } },
  claimId: { type: "string" }
};

const experienceResultProps = {
  id: { type: "string" },
  resultId: { type: "string" },
  experimentId: { type: "string" },
  claimId: { type: "string" },
  outcome: { type: "string" },
  summary: { type: "string" },
  resultSummary: { type: "string" },
  evidenceLinks: { type: "array", items: { type: "string" } },
  artifactPaths: { type: "array", items: { type: "string" } },
  comparisonTargets: { type: "array", items: { type: "string" } }
};

const rebuttalIssueProps = {
  id: { type: "string" },
  reviewer: { type: "string" },
  summary: { type: "string" },
  severity: { type: "string" },
  status: { type: "string" },
  evidenceLinks: { type: "array", items: { type: "string" } },
  claimIds: { type: "array", items: { type: "string" } },
  experimentIds: { type: "array", items: { type: "string" } },
  responseDirection: { type: "string" }
};

const rebuttalIssueSchema = {
  type: "object",
  properties: rebuttalIssueProps,
  additionalProperties: false
};

const manualReviewFindingSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    severity: { type: "string" },
    summary: { type: "string" },
    claimIds: { type: "array", items: { type: "string" } },
    experimentIds: { type: "array", items: { type: "string" } },
    responseOwnerRole: { type: "string" },
    reviewerAction: { type: "string" },
    linkedAuditIds: { type: "array", items: { type: "string" } },
    linkedBridgeIds: { type: "array", items: { type: "string" } },
    linkedArtifactPaths: { type: "array", items: { type: "string" } },
    methodologicalCategory: { type: ["string", "null"] }
  },
  additionalProperties: false
};

const figureMaterialItemProps = {
  id: { type: "string" },
  type: { type: "string" },
  label: { type: "string" },
  summary: { type: "string" },
  artifactPath: { type: "string" },
  path: { type: "string" }
};

const figureMaterialItemSchema = {
  type: "object",
  properties: figureMaterialItemProps,
  additionalProperties: false
};

const figureSemanticCoverageObservationProps = {
  observations: { type: "array", items: { type: "string" } },
  evidencePaths: { type: "array", items: { type: "string" } },
  artifactPaths: { type: "array", items: { type: "string" } }
};

const figureSemanticReviewObservationProps = {
  summary: { type: "string" },
  observations: { type: "array", items: { type: "string" } },
  evidencePaths: { type: "array", items: { type: "string" } },
  artifactPaths: { type: "array", items: { type: "string" } }
};

const executionReceiptProps = {
  receiptId: { type: "string" },
  runId: { type: "string" },
  packetId: { type: "string" },
  command: { type: "string" },
  surface: { type: "string" },
  actionType: { type: "string" },
  startedAt: { type: "string" },
  completedAt: { type: "string" },
  status: { type: "string" },
  outcome: { type: "string" },
  resultSummary: { type: "string" },
  publicSafeSummary: { type: "string" },
  nextAction: { type: "string" },
  lifecycleTransition: {
    type: "object",
    properties: { previousStatus: { type: "string" }, nextStatus: { type: "string" } },
    additionalProperties: false
  },
  artifactRefs: { type: "array", items: { type: "string" } },
  artifactPaths: { type: "array", items: { type: "string" } },
  evidenceLinks: { type: "array", items: { type: "string" } },
  evidencePaths: { type: "array", items: { type: "string" } },
  validationEvidencePaths: { type: "array", items: { type: "string" } },
  verificationEvidencePaths: { type: "array", items: { type: "string" } },
  verifiedCriteria: { type: "array", items: verifiedCriteriaItemSchema },
  criteriaCoverage: {
    type: "object",
    properties: {
      complete: { type: "boolean" },
      required: { type: "array", items: { type: "string" } },
      missing: { type: "array", items: { type: "string" } },
      verified: { type: "array", items: verifiedCriteriaItemSchema }
    },
    additionalProperties: false
  },
  validationGateResults: {
    type: "array",
    items: {
      type: "object",
      properties: validationGateResultProps,
      additionalProperties: false
    }
  },
  boundary: {
    type: "object",
    properties: publicReceiptBoundaryProps,
    additionalProperties: false
  }
};

const executionEvidenceProps = {
  executionContract: executionContractSchema,
  validationEvidencePaths: { type: "array", items: { type: "string" } },
  verificationEvidencePaths: { type: "array", items: { type: "string" } },
  verifiedCriteria: { type: "array", items: verifiedCriteriaItemSchema }
};

const executionVerificationProps = {
  ...executionEvidenceProps,
  executionReceipt: { type: "object", properties: executionReceiptProps, additionalProperties: false }
};

const statusAdjustmentItemProps = {
  index: { type: "number" },
  packetId: { type: "string" },
  taskPacketId: { type: "string" },
  taskId: { type: "string" },
  id: { type: "string" },
  status: { type: "string" },
  taskStatus: { type: "string" },
  missionStatus: { type: "string" },
  reason: { type: "string" },
  summary: { type: "string" },
  nextAction: { type: ["string", "null"] },
  evidenceLinks: { type: "array", items: { type: "string" } },
  evidencePaths: { type: "array", items: { type: "string" } },
  validationEvidencePaths: { type: "array", items: { type: "string" } },
  verificationEvidencePaths: { type: "array", items: { type: "string" } },
  verifiedCriteria: { type: "array", items: verifiedCriteriaItemSchema },
  executionReceipt: {
    anyOf: [
      { type: "null" },
      { type: "object", properties: executionReceiptProps, additionalProperties: false }
    ]
  },
  executionContract: {
    anyOf: [
      { type: "null" },
      executionContractSchema
    ]
  },
  artifactRefs: { type: "array", items: { type: "string" } },
  artifactPaths: { type: "array", items: { type: "string" } }
};

const statusAdjustmentItemSchema = {
  type: "object",
  properties: statusAdjustmentItemProps,
  additionalProperties: false
};

const autoStepFailureRouteSchema = {
  type: "object",
  properties: executionFailureRouteProps,
  additionalProperties: false
};

const contractAwareAutoStepProps = {
  completeTask: { type: "boolean" },
  requiredMaterials: { type: "array", items: { type: "string" } },
  outputArtifacts: { type: "array", items: { type: "string" } },
  convergenceChecks: { type: "array", items: { type: "string" } },
  failureRoutes: { type: "array", items: autoStepFailureRouteSchema },
  ...executionEvidenceProps
};

const autoSourceItemProps = {
  sourceId: { type: "string" },
  citationKey: { type: "string" },
  title: { type: "string" },
  authors: { type: "array", items: { type: "string" } },
  year: { type: ["string", "number"] },
  locator: { type: "string" },
  sourceType: { type: "string" },
  abstract: { type: "string" },
  origin: { type: "string" }
};

const autoStepArgsByCommand = {
  "dove.source": {
    ...autoSourceItemProps,
    sources: {
      type: "array",
      items: {
        type: "object",
        properties: autoSourceItemProps,
        additionalProperties: false
      }
    }
  },
  "dove.note": {
    noteId: { type: "string" },
    title: { type: "string" },
    sectionId: { type: "string" },
    sourceIds: { type: "array", items: { type: "string" } },
    summary: { type: "string" },
    quotes: { type: "array", items: { type: "string" } },
    claims: { type: "array", items: { type: "string" } },
    openQuestions: { type: "array", items: { type: "string" } }
  },
  "dove.experience": {
    id: { type: "string" },
    experimentId: { type: "string" },
    goal: { type: "string" },
    idea: { type: "string" },
    title: { type: "string" },
    methodology: { type: "string" },
    method: { type: "string" },
    successMetric: { type: "string" },
    metric: { type: "string" },
    comparisonTargets: { type: "array", items: { type: "string" } },
    baselines: { type: "array", items: { type: "string" } },
    claimId: { type: "string" },
    result: { type: "object", properties: experienceResultProps, additionalProperties: false },
    resultId: { type: "string" },
    outcome: { type: "string" },
    summary: { type: "string" },
    resultSummary: { type: "string" },
    evidenceLinks: { type: "array", items: { type: "string" } },
    artifactPaths: { type: "array", items: { type: "string" } },
    plan: { type: "object", properties: experiencePlanProps, additionalProperties: false }
  },
  "dove.figure": {
    intent: { type: "string" },
    description: { type: "string" },
    name: { type: "string" },
    title: { type: "string" },
    figureId: { type: "string" },
    id: { type: "string" },
    purpose: { type: "string" },
    captionIntent: { type: "string" },
    targetClaimIds: { type: "array", items: { type: "string" } },
    claimIds: { type: "array", items: { type: "string" } },
    sourceSections: { type: "array", items: { type: "string" } },
    sectionIds: { type: "array", items: { type: "string" } },
    sourceArtifactPaths: { type: "array", items: { type: "string" } },
    artifactPaths: { type: "array", items: { type: "string" } },
    relatedExperimentIds: { type: "array", items: { type: "string" } },
    experimentIds: { type: "array", items: { type: "string" } },
    reviewConcernIds: { type: "array", items: { type: "string" } },
    rebuttalIssueIds: { type: "array", items: { type: "string" } },
    requiredVisualElements: { type: "array", items: { type: "string" } },
    materialHints: { type: "array", items: { anyOf: [{ type: "string" }, figureMaterialItemSchema] } },
    materialRequirements: { type: "array", items: figureMaterialItemSchema },
    providerId: { type: "string" },
    executeProvider: { type: "boolean" },
    allowMissingMaterials: { type: "boolean" },
    runId: { type: "string" },
    outputFormat: { type: "string" },
    constraints: { type: "array", items: { type: "string" } },
    outputManifestPath: { type: "string" },
    sourceSvgPath: { type: "string" },
    targetFinalSvgPath: { type: "string" },
    svgContent: { type: "string" },
    caption: { type: "string" },
    captionDraft: { type: "string" },
    captionId: { type: "string" },
    semanticCoverage: { type: "object", properties: figureSemanticCoverageObservationProps, additionalProperties: false },
    semanticReview: { type: "object", properties: figureSemanticReviewObservationProps, additionalProperties: false }
  },
  "dove.draft": {
    sectionId: { type: "string" },
    title: { type: "string" },
    body: { type: "string" },
    status: { type: "string" },
    summary: { type: "string" }
  },
  "dove.review": {
    scope: { type: "string" },
    stage: { type: "string" },
    reviewer: { type: "string" }
  },
  "dove.review-loop": {
    runId: { type: "string" },
    scope: { type: "string" },
    instructions: { type: "string" },
    stage: { type: "string" },
    summary: { type: "string" },
    artifactPaths: { type: "array", items: { type: "string" } },
    reviewedArtifactPaths: { type: "array", items: { type: "string" } },
    responseLanguage: { type: "string" },
    language: { type: "string" }
  },
  "dove.rebuttal": {
    issues: { type: "array", items: rebuttalIssueSchema }
  },
  "dove.lessons": {},
  "dove.status": {}
};

const contractAwareAutoStepSchema = {
  type: "object",
  properties: {
    command: { type: "string", enum: Object.keys(autoStepArgsByCommand) },
    args: { type: "object" },
    ...contractAwareAutoStepProps
  },
  required: ["command"],
  additionalProperties: false,
  allOf: Object.entries(autoStepArgsByCommand).map(([command, argsProperties]) => ({
    if: {
      properties: { command: { const: command } },
      required: ["command"]
    },
    then: {
      properties: {
        args: {
          type: "object",
          properties: argsProperties,
          additionalProperties: false
        }
      }
    }
  }))
};

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
  workContract: workContractSchema,
  ...executionVerificationProps,
  ...boundaryProps,
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
  ...executionVerificationProps,
  ...boundaryProps,
  startedAt: { type: "string" },
  completedAt: { type: "string" }
};

const resultModeProperty = {
  type: "string",
  enum: ["compact", "full", "debug"],
  description: "MCP response expansion mode. compact returns the stable result contract only; full includes fullResult; debug includes fullResult plus diagnostics."
};

const mutationModeProperty = {
  type: "string",
  enum: ["patch-plan", "direct-process"],
  description: "Canonical Dove mutation mode. patch-plan returns declarative file operations for host-tracked application; direct-process writes from the Dove process and is not verified host rollback-safe. If omitted, host-facing MCP calls keep functional direct-process behavior and return hostRollbackIneligibleReason plus rollbackAdvice when writes are not host-rollback eligible."
};

const operatorSurfaceProperty = {
  type: "string",
  enum: ["operator", "compact", "full", "debug"],
  description: "Tool discovery surface. Use operator or compact for everyday Dove work; request expanded catalogs only when auditing or diagnosing."
};

export const OPERATOR_TOOL_NAMES = [
  "query_dove_status",
  "query_dove_orchestrate",
  "query_document_ledger",
  "query_operator_lessons",
  "search_network",
  "query_network_search_providers",
  "create_dove_task",
  "run_dove_auto",
  "run_dove_operator",
  "register_source",
  "verify_source",
  "upsert_note",
  "upsert_draft",
  "record_document_evidence",
  "run_figure_workflow",
  "run_experience_workflow",
  "run_review_loop",
  "build_rebuttal_strategy",
  "query_dove_return"
];

const OPERATOR_WORKFLOW_AREAS = {
  query_dove_status: "status",
  query_dove_orchestrate: "routing",
  query_document_ledger: "evidence",
  query_operator_lessons: "lessons",
  search_network: "search",
  query_network_search_providers: "search",
  create_dove_task: "mission",
  run_dove_auto: "auto",
  run_dove_operator: "operator",
  register_source: "source",
  verify_source: "source",
  upsert_note: "note",
  upsert_draft: "draft",
  record_document_evidence: "document",
  run_figure_workflow: "figure",
  run_experience_workflow: "experience",
  run_review_loop: "review",
  build_rebuttal_strategy: "rebuttal",
  query_dove_return: "verification"
};

const OPERATOR_SCHEMA_FIELDS = {
  query_dove_status: ["intent", "domain", "stage", "status", "detail", "view", "showMissions", "includeMissionDetails", "requestStatusAdjustment", "includeStatusAdjustmentPreview", "resultMode"],
  query_dove_orchestrate: ["request", "userRequest", "goal", "domain", "stage", "targetArtifacts", "acceptanceChecks", "allowAutonomy", "resultMode"],
  query_document_ledger: ["documentKind", "status", "evidenceScope", "publicSafe", "limit", "resultMode"],
  query_operator_lessons: ["domain", "status", "tag", "limit", "resultMode"],
  search_network: ["query", "kind", "limit", "year", "domains", "fieldsOfStudy", "openAccessOnly", "providerIds", "locale", "resultMode"],
  query_network_search_providers: ["kind", "providerIds", "resultMode"],
  create_dove_task: [...Object.keys(missionReplayProps), "objective", "prompt", "resultMode"],
  run_dove_auto: ["target", "goal", "prompt", "steps", "maxIterations", "maxSteps", "confirm", "confirmed", "completeTask", "completeOnSuccess", "resultMode"],
  run_dove_operator: ["confirm", "confirmed", "blockerInvestigationMode", "resultMode"],
  register_source: ["target", "citationKey", "title", "authors", "year", "locator", "sourceType", "abstract", "origin", "sources", "resultMode"],
  verify_source: ["target", "sourceId", "decision", "method", "checkedMaterial", "auditEvidence", "resultMode"],
  upsert_note: ["target", "title", "summary", "quotes", "claims", "openQuestions", "resultMode"],
  upsert_draft: ["target", "title", "body", "status", "summary", "resultMode"],
  record_document_evidence: ["target", "title", "documentKind", "status", "evidenceScope", "publicSafe", "visibility", "summary", "context", "reason", "claims", "createDocument", "appendDocument", "body", "content", "resultMode"],
  run_figure_workflow: ["target", "intent", "description", "name", "title", "purpose", "captionIntent", "requiredVisualElements", "materialHints", "allowMissingMaterials", "outputFormat", "constraints", "caption", "captionDraft", "resultMode"],
  run_experience_workflow: ["target", "goal", "idea", "title", "methodology", "method", "successMetric", "metric", "comparisonTargets", "baselines", "result", "outcome", "summary", "resultSummary", "resultMode"],
  run_review_loop: ["target", "scope", "stage", "resultMode"],
  build_rebuttal_strategy: ["target", "resultMode"],
  query_dove_return: ["goal", "domain", "stage", "scope", "targetArtifacts", "acceptanceChecks", "validationEvidence", "reviewEvidence", "resultMode"]
};

const OPERATOR_PUBLIC_TOOL_DESCRIPTIONS = {
  query_dove_status: "Show the current Dove situation in everyday language, with the next useful action and a note that detailed audit context can be requested.",
  query_dove_orchestrate: "Choose the Dove work surface that fits the user's request without changing project state.",
  query_document_ledger: "List recorded document and evidence summaries without showing document bodies.",
  query_operator_lessons: "Show reusable Dove lessons that may affect the next action.",
  search_network: "Find public no-key web or scholarly candidates without writing Dove state; verify useful results before recording sources, notes, evidence, or claims.",
  query_network_search_providers: "Show which public no-key network search providers are available or disabled without exposing raw provider internals.",
  create_dove_task: "Turn a user goal into a confirmable Dove mission contract, then materialize only its complete trusted-local exact replay data. The digest detects accidental drift but is not proof of human approval or tamper-proof authentication.",
  run_dove_auto: "Run confirmed foreground work that produces or inspects real materials; status/task panels alone are not progress, and missing materials return a clear boundary.",
  run_dove_operator: "Preview concrete required actions, then after explicit confirmation move one safe step only when real results or material are present.",
  register_source: "Record external source metadata as a candidate for the current task; registration alone never makes it claim-eligible.",
  verify_source: "Create an auditable independent verification or rejection record after checking the source material.",
  upsert_note: "Save synthesized writing or research notes for the current task.",
  upsert_draft: "Update a section draft when concrete draft text is provided.",
  record_document_evidence: "Record a document or evidence summary without exposing raw private material.",
  run_figure_workflow: "Prepare or update one figure: plan materials, optionally generate or import output, and report what is still missing.",
  run_experience_workflow: "Plan or record an experiment and connect reviewed results back to the claim they support.",
  run_review_loop: "Run an evidence-aware review pass and produce revision guidance.",
  build_rebuttal_strategy: "Organize reviewer concerns into a response strategy and draft language.",
  query_dove_return: "Check whether a mission has enough evidence to be considered returned."
};

const COMPACT_DISCOVERY_INTERNAL_KEY_PATTERN = /^(?:id|packetId|packetIds|taskPacketId|missionPacketId|taskId|runId|receiptId|boundary|boundaryId|boundaryType|implementationBoundaryType|implementationReason|ownerRole|nextRole|handoff|handoffId|handoffSuggestion|actorRole|providerId|providerStatus|providerError|apiKeyEnv|sourceSvgPath|targetFinalSvgPath|finalSvgPath|outputManifestPath|svgContent|qaPath|resultPath|documentPath|path|paths|artifactPath|artifactPaths|sourceArtifactPath|sourceArtifactPaths|evidencePaths|validationEvidencePaths|verificationEvidencePaths|reviewEvidencePaths|reviewedArtifactPaths|finalPlanPaths|planPaths|finalResultPaths|resultPaths|artifactRefs|sourceRefs|claimIds|sourceIds|noteIds|experimentIds|reviewConcernIds|rebuttalIssueIds|relatedExperimentIds|targetClaimIds|dependencyIds|blockerIds|lessonIds|command|workflow|preset|nextCommand|copyableCommand|operatorRoute|mutationMode|queueSummary|queuePreview|preActionGuidance|preActionGuidanceSummary|fullResult|diagnostics)$/u;

function isCompactDiscoveryInternalKey(key) {
  const text = String(key ?? "");
  return COMPACT_DISCOVERY_INTERNAL_KEY_PATTERN.test(text) || /(?:^|[A-Za-z])Ids?$/u.test(text);
}

function compactPublicSchema(schema) {
  if (Array.isArray(schema)) {
    return schema.map((item) => compactPublicSchema(item));
  }
  if (!schema || typeof schema !== "object") {
    return schema;
  }
  const next = {};
  const requiredProperties = new Set(Array.isArray(schema.required) ? schema.required : []);
  for (const [key, value] of Object.entries(schema)) {
    if (key === "properties" && value && typeof value === "object" && !Array.isArray(value)) {
      const properties = Object.fromEntries(Object.entries(value)
        .filter(([propertyName]) => requiredProperties.has(propertyName) || !isCompactDiscoveryInternalKey(propertyName))
        .map(([propertyName, propertySchema]) => [propertyName, compactPublicSchema(propertySchema)]));
      if (Object.keys(properties).length > 0) {
        next.properties = properties;
      }
      continue;
    }
    if (key === "description") {
      next.description = typeof value === "string" ? value.replace(/fullResult|preActionGuidanceSummary|preActionGuidance|resultCard|boundaryType|patch-plan|direct-process|providerId|\.dove\//gu, "details") : value;
      continue;
    }
    next[key] = compactPublicSchema(value);
  }
  return next;
}

export const toolDiscoveryInputSchema = {
  type: "object",
  properties: {
    surface: operatorSurfaceProperty,
    resultMode: resultModeProperty
  },
  additionalProperties: false
};

export const MUTATING_TOOL_NAMES = new Set([
  "ensure_workspace",
  "init_project",
  "publish_dove_status",
  "publish_dove_global_status",
  "record_document_evidence",
  "init_dove_goal",
  "create_dove_task",
  "record_dove_mission_pass",
  "apply_dove_status_adjustments",
  "run_dove_auto",
  "run_dove_operator",
  "kill_dove_task",
  "reset_dove_version",
  "run_experience_workflow",
  "prepare_audio_review",
  "import_audio_review",
  "run_audio_review",
  "run_dove_review_loop",
  "launch_dove_mission",
  "summarize_session_journal",
  "upsert_orchestration_board",
  "append_handoff",
  "update_research_brief",
  "register_source",
  "verify_source",
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
  "prepare_isolated_review",
  "import_isolated_review",
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
  "upsert_figure_plan",
  "run_figure_workflow",
  "prepare_figure_generation",
  "import_figure_generation",
  "validate_figure_pipeline",
  "record_operator_lesson",
  "record_operator_follow_through",
  "plan_campaign",
  "revoke_program_approval",
  "materialize_guidance_packet"
]);

function addMcpControlFields(tool) {
  const properties = {
    ...(tool.inputSchema?.properties ?? {}),
    resultMode: resultModeProperty
  };
  if (MUTATING_TOOL_NAMES.has(tool.name)) {
    properties.mutationMode = mutationModeProperty;
  }
  return {
    ...tool,
    inputSchema: {
      ...tool.inputSchema,
      properties,
      additionalProperties: false
    }
  };
}

const baseToolDefinitions = [
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
  { name: "query_operator_lessons", description: "Read explicit distilled operator lessons and retrospectives; action surfaces also recall applicable lessons automatically as read-only preActionGuidance without importing raw runtime traces or refreshing derived work surfaces.", inputSchema: { type: "object", properties: { domain: { type: "string" }, status: { type: "string" }, tag: { type: "string" }, actorRole: { type: "string" }, limit: { type: "number" } } } },
  { name: "search_network", description: "Run a bounded foreground public no-key network search for candidate materials only. This tool is read-only: it does not write .dove state, does not expose raw provider payloads or secrets, and verified candidates must be recorded through source, note, document evidence, or claim workflows before being treated as evidence.", inputSchema: { type: "object", properties: { query: { type: "string" }, kind: { type: "string", enum: ["scholarly", "web", "all"] }, limit: { type: "number" }, year: { type: ["string", "number"] }, domains: { type: "array", items: { type: "string" } }, fieldsOfStudy: { type: "array", items: { type: "string" } }, openAccessOnly: { type: "boolean" }, providerIds: { type: "array", items: { type: "string" } }, providers: { type: "array", items: { type: "string" } }, locale: { type: "string" } } } },
  { name: "query_network_search_providers", description: "Inspect public no-key Dove network search provider availability without writing state or exposing credentials, headers, raw provider payloads, or internal debug fields.", inputSchema: { type: "object", properties: { kind: { type: "string", enum: ["scholarly", "web", "all"] }, providerIds: { type: "array", items: { type: "string" } }, providers: { type: "array", items: { type: "string" } } } } },
  { name: "query_operator_follow_through", description: "Refresh and read the proposal-only operator follow-through ledger for remediation, playbook, and execution-bridge decisions.", inputSchema: { type: "object", properties: {} } },
  { name: "query_paper_audit", description: "Run a strict audit-only paper inspection that reports findings without writing or repairing .dove artifacts.", inputSchema: { type: "object", properties: { scope: { type: "string" } } } },
  { name: "query_dove_onboarding", description: "Map project-local paper artifacts as a proposal-only Dove onboarding query without moving, rewriting, or persisting source assets.", inputSchema: { type: "object", properties: { maxDepth: { type: "number" }, maxFiles: { type: "number" }, excludeDirs: { type: "array", items: { type: "string" } }, writeMap: { type: "boolean" } } } },
  { name: "query_paper_pipeline", description: "Read the paper-domain lifecycle state from durable Dove artifacts without executing commands, running external processes, inspecting git, or writing state.", inputSchema: { type: "object", properties: {} } },
  { name: "query_dove_orchestrate", description: "Route one Dove mission to the next Dove command without writing, refreshing, running tests, or inspecting git.", inputSchema: { type: "object", properties: { request: { type: "string" }, userRequest: { type: "string" }, goal: { type: "string" }, domain: { type: "string" }, doveDomain: { type: "string" }, missionDomain: { type: "string" }, stage: { type: "string" }, missionStage: { type: "string" }, targetArtifacts: { type: "array", items: { type: "string" } }, artifacts: { type: "array", items: { type: "string" } }, artifactPaths: { type: "array", items: { type: "string" } }, acceptanceChecks: { type: "array", items: { type: "string" } }, allowAutonomy: { type: "boolean" } } } },
  { name: "query_dove_mission", description: "Frame one proposal-only Dove mission contract from the current authoritative .dove workspace without writing durable state.", inputSchema: { type: "object", properties: { goal: { type: "string" }, domain: { type: "string" }, doveDomain: { type: "string" }, missionDomain: { type: "string" }, stage: { type: "string" }, missionStage: { type: "string" }, targetArtifacts: { type: "array", items: { type: "string" } }, artifacts: { type: "array", items: { type: "string" } }, artifactPaths: { type: "array", items: { type: "string" } }, acceptanceChecks: { type: "array", items: { type: "string" } }, nextCommand: { type: "string" } } } },
  { name: "query_dove_mission_board", description: "Read the low-level Dove mission board/debug view from authoritative .dove state without writing, refreshing, running tests, or inspecting git; ordinary mission-list prompts should use query_dove_status and expand statusHome.optionalMissionDetails instead.", inputSchema: { type: "object", properties: { domain: { type: "string" }, doveDomain: { type: "string" }, missionDomain: { type: "string" }, stage: { type: "string" }, missionStage: { type: "string" }, packetId: { type: "string" }, packetIds: { type: "array", items: { type: "string" } }, missionPacketId: { type: "string" }, missionPacketIds: { type: "array", items: { type: "string" } }, status: { type: "string" }, statuses: { type: "array", items: { type: "string" } }, includeArchived: { type: "boolean" } } } },
  { name: "query_dove_status", description: "Read the compact Dove status translator by default: the compact MCP result exposes summary/headline, nextStep, needsAttention, changes, and showMore so ordinary operators see one-sentence state, one recommended action, and explicit expansion paths instead of packet/mission/boundary/gap internals. `statusHome.durableContextNotice`, mutationRollbackModel, patch-plan plus host-tracked file-edit requirements, host checkpoint verification limits, unverified direct-process writes, statusHome.preActionGuidance, automatic read-only lesson recall, Planner/Builder/Reviewer role framing, blockers/reconciliation, project state, runtime/dashboard details, and raw action candidates are available only through resultMode: full/debug or detail/full expansion. Default compact status must not render a Missions panel, blocked counts, execution-gap counts, required-evidence blocks, or ask whether to modify mission statuses. Pass showMissions/includeMissionDetails (or detail/view: missions) only for explicit ordinary mission-list prompts; pass requestStatusAdjustment/includeStatusAdjustmentPreview only when the operator explicitly asks to change mission states after a fresh status read; host/context rollback must use mutationMode: patch-plan applied through host-tracked file edits, not git detection, not direct-process, and not reset_dove_version.", inputSchema: { type: "object", properties: { domain: { type: "string" }, doveDomain: { type: "string" }, missionDomain: { type: "string" }, stage: { type: "string" }, missionStage: { type: "string" }, packetId: { type: "string" }, packetIds: { type: "array", items: { type: "string" } }, status: { type: "string" }, statuses: { type: "array", items: { type: "string" } }, includeArchived: { type: "boolean" }, intent: { type: "string", enum: ["project-status", "health-check", "contract-test"] }, detail: { type: "string" }, view: { type: "string" }, resultMode: { type: "string" }, full: { type: "boolean" }, includeDetails: { type: "boolean" }, showMissions: { type: "boolean" }, includeMissionDetails: { type: "boolean" }, requestStatusAdjustment: { type: "boolean" }, includeStatusAdjustmentPreview: { type: "boolean" } } } },
  { name: "publish_dove_status", description: "Publish sanitized public Dove project progress artifacts to .dove/public/status.json, status.md, and index.html without exposing raw transcripts, secrets, runtime entries, or starting external tunnels.", inputSchema: { type: "object", properties: { includeArchived: { type: "boolean" }, responseLanguage: { type: "string" }, generatedAt: { type: "string" } } } },
  { name: "publish_dove_global_status", description: "Publish a single global static Dove status index from explicit or configured project .dove/public artifacts without scanning the computer, exposing local roots, or starting external tunnels.", inputSchema: { type: "object", properties: { projectRoots: { type: "array", items: { type: "string" } }, projects: { type: "array", items: { type: "object" } }, outputDir: { type: "string" }, refresh: { type: "boolean" }, includeConfig: { type: "boolean" }, includeArchived: { type: "boolean" }, responseLanguage: { type: "string" }, generatedAt: { type: "string" } } } },
  { name: "query_document_ledger", description: "Read the proposal-only Dove document/evidence ledger without writing state or exposing document bodies.", inputSchema: { type: "object", properties: { packetId: { type: "string" }, taskPacketId: { type: "string" }, missionPacketId: { type: "string" }, taskId: { type: "string" }, documentKind: { type: "string" }, status: { type: "string" }, evidenceScope: { type: "string" }, publicSafe: { type: "boolean" }, limit: { type: "number" } } } },
  { name: "record_document_evidence", description: "Record an explicit task-scoped Dove document/evidence ledger entry with Builder/researcher preActionGuidanceSummary, optionally creating or appending a .dove/documents archive document for internal summaries, pressure-test reports, and synthesized outputs while preserving source/artifact provenance; do not overwrite existing documents or capture raw transcripts/private reasoning.", inputSchema: { type: "object", properties: withTaskTarget({ id: { type: "string" }, documentId: { type: "string" }, title: { type: "string" }, documentTitle: { type: "string" }, documentPath: { type: "string" }, path: { type: "string" }, documentKind: { type: "string" }, kind: { type: "string" }, status: { type: "string" }, evidenceScope: { type: "string" }, scope: { type: "string" }, publicSafe: { type: "boolean" }, visibility: { type: "string" }, summary: { type: "string" }, context: { type: "string" }, reason: { type: "string" }, sourceRefs: { type: "array", items: { type: "string" } }, sourceIds: { type: "array", items: { type: "string" } }, artifactRefs: { type: "array", items: { type: "string" } }, artifactPaths: { type: "array", items: { type: "string" } }, evidenceLinks: { type: "array", items: { type: "string" } }, evidencePaths: { type: "array", items: { type: "string" } }, claimIds: { type: "array", items: { type: "string" } }, claims: { type: "array", items: { type: "string" } }, createDocument: { type: "boolean" }, appendDocument: { type: "boolean" }, body: { type: "string" }, content: { type: "string" }, createdBy: { type: "string" }, actorRole: { type: "string" } }) } },
  { name: "query_dove_audit", description: "Inspect Dove mission audit findings and return readiness without writing, refreshing, fixing, running tests, or inspecting git.", inputSchema: { type: "object", properties: { scope: { type: "string" }, goal: { type: "string" }, domain: { type: "string" }, doveDomain: { type: "string" }, missionDomain: { type: "string" }, stage: { type: "string" }, missionStage: { type: "string" }, targetArtifacts: { type: "array", items: { type: "string" } }, artifacts: { type: "array", items: { type: "string" } }, artifactPaths: { type: "array", items: { type: "string" } }, acceptanceChecks: { type: "array", items: { type: "string" } }, validationEvidencePaths: { type: "array", items: { type: "string" } }, validationEvidence: { type: "array", items: { type: "string" } }, evidencePaths: { type: "array", items: { type: "string" } }, changedFilePaths: { type: "array", items: { type: "string" } }, changedFiles: { type: "array", items: { type: "string" } }, changedPaths: { type: "array", items: { type: "string" } }, testEvidencePaths: { type: "array", items: { type: "string" } }, testPaths: { type: "array", items: { type: "string" } }, validationOutputPaths: { type: "array", items: { type: "string" } }, validationLogPaths: { type: "array", items: { type: "string" } }, testOutputPaths: { type: "array", items: { type: "string" } }, validationOutputs: { type: "array", items: { type: "string" } }, validationOutput: { type: "string" }, reviewEvidencePaths: { type: "array", items: { type: "string" } }, reviewEvidence: { type: "array", items: { type: "string" } } } } },
  { name: "query_dove_return", description: "Inspect Dove mission return readiness from durable .dove state without writing, fixing, running tests, or inspecting git.", inputSchema: { type: "object", properties: { goal: { type: "string" }, domain: { type: "string" }, doveDomain: { type: "string" }, missionDomain: { type: "string" }, stage: { type: "string" }, missionStage: { type: "string" }, scope: { type: "string" }, targetArtifacts: { type: "array", items: { type: "string" } }, artifacts: { type: "array", items: { type: "string" } }, artifactPaths: { type: "array", items: { type: "string" } }, acceptanceChecks: { type: "array", items: { type: "string" } }, validationEvidencePaths: { type: "array", items: { type: "string" } }, validationEvidence: { type: "array", items: { type: "string" } }, evidencePaths: { type: "array", items: { type: "string" } }, changedFilePaths: { type: "array", items: { type: "string" } }, changedFiles: { type: "array", items: { type: "string" } }, changedPaths: { type: "array", items: { type: "string" } }, testEvidencePaths: { type: "array", items: { type: "string" } }, testPaths: { type: "array", items: { type: "string" } }, validationOutputPaths: { type: "array", items: { type: "string" } }, validationLogPaths: { type: "array", items: { type: "string" } }, testOutputPaths: { type: "array", items: { type: "string" } }, validationOutputs: { type: "array", items: { type: "string" } }, validationOutput: { type: "string" }, reviewEvidencePaths: { type: "array", items: { type: "string" } }, reviewEvidence: { type: "array", items: { type: "string" } } } } },
  { name: "init_dove_goal", description: "Create or update the unique level-0 Dove init goal task.", inputSchema: { type: "object", properties: { id: { type: "string" }, goal: { type: "string" }, title: { type: "string" }, objective: { type: "string" }, summary: { type: "string" }, domain: { type: "string" }, doveDomain: { type: "string" }, status: { type: "string" }, artifactRefs: { type: "array", items: { type: "string" } } } } },
  { name: "create_dove_task", description: "Convert a user demand into a proposal-only mission work contract with compact task card and preActionGuidance; materialization must replay the complete returned confirmArgs as trusted-local exact replay data, including canonical proposalWorkspace, proposalVersion, exact id and proposalDigest, and the same mutationMode so a newly inferred, stale, cross-workspace, field-drifted, or mode-switched contract cannot be substituted. The local digest is exact replay data, not proof of human approval or tamper-proof authentication. Returns recommended handoff routes without executing or recording a pass.", inputSchema: { type: "object", properties: { ...missionReplayProps, objective: { type: "string" }, prompt: { type: "string" }, initGoal: { type: "string" }, projectTitle: { type: "string" }, workspaceTitle: { type: "string" }, projectObjective: { type: "string" }, projectGoal: { type: "string" }, projectDomain: { type: "string" }, missionStage: { type: "string" }, doveDomain: { type: "string" }, missionDomain: { type: "string" }, taskLevel: { type: "number" }, missionLevel: { type: "number" }, subtasks: { type: "array", items: { type: ["object", "string"] } }, systemTasks: { type: "array", items: { type: ["object", "string"] } }, dependencyIds: { type: "array", items: { type: "string" } }, blockerIds: { type: "array", items: { type: "string" } }, artifactPaths: { type: "array", items: { type: "string" } }, deliverables: { type: "array", items: { type: "string" } }, outOfScope: { type: "array", items: { type: "string" } }, outOfScopeItems: { type: "array", items: { type: "string" } }, evidenceContract: { type: "array", items: { type: "string" } }, doneCriteria: { type: "array", items: { type: "string" } }, practicalImpact: { type: "string" }, recommendedRoutes: { type: "array", items: { type: "object" } } } } },
  { name: "record_dove_mission_pass", description: "Explicitly record execution results for an existing durable mission/task after the work has already happened, converting completed plan outputs into pending missions when supplied, and returning a localized resultCard summary. This is not part of create_dove_task or /dove:mission materialization. When a host-side search/fetch/shell/MCP safety classifier or tool-availability failure prevents normal completion, record resultStatus blocked with boundaryType host-tool-blocked so the task is visibly blocked instead of left in-progress.", inputSchema: { type: "object", properties: withTaskTarget({ id: { type: "string" }, runId: { type: "string" }, resultStatus: { type: "string" }, taskStatus: { type: "string" }, missionStatus: { type: "string" }, completeTask: { type: "boolean" }, complete: { type: "boolean" }, completeOnSuccess: { type: "boolean" }, blocked: { type: "boolean" }, resultSummary: { type: "string" }, summary: { type: "string" }, reason: { type: "string" }, outcome: { type: "string" }, stopReason: { type: "string" }, evidenceLinks: { type: "array", items: { type: "string" } }, evidencePaths: { type: "array", items: { type: "string" } }, artifactRefs: { type: "array", items: { type: "string" } }, artifactPaths: { type: "array", items: { type: "string" } }, ...executionVerificationProps, command: { type: "string" }, workflow: { type: "string" }, preset: { type: "string" }, nextCommand: { type: "string" }, nextAction: { type: "string" }, ...missionPassBoundaryProps, startedAt: { type: "string" }, completedAt: { type: "string" }, convertPlanToMissions: { type: "boolean" }, planConversion: { type: "object", properties: { plannedMissions: { type: "array", items: { type: ["object", "string"], properties: planMissionProps } }, resultingMissions: { type: "array", items: { type: ["object", "string"], properties: planMissionProps } }, missions: { type: "array", items: { type: ["object", "string"], properties: planMissionProps } }, childMissions: { type: "array", items: { type: ["object", "string"], properties: planMissionProps } } } }, plannedMissions: { type: "array", items: { type: ["object", "string"], properties: planMissionProps } }, resultingMissions: { type: "array", items: { type: ["object", "string"], properties: planMissionProps } }, missions: { type: "array", items: { type: ["object", "string"], properties: planMissionProps } }, childMissions: { type: "array", items: { type: ["object", "string"], properties: planMissionProps } } }) } },
  { name: "apply_dove_status_adjustments", description: "Preview compact status adjustment cards and apply explicitly confirmed status choices to non-init Dove task packets only after the single /dove:status confirmation dialog yields clear packetId-to-status adjustments; confirmed calls return a localized resultCard.", inputSchema: { type: "object", properties: { confirmed: { type: "boolean" }, confirm: { type: "boolean" }, runId: { type: "string" }, adjustments: { type: "array", items: statusAdjustmentItemSchema }, statusAdjustments: { type: "array", items: statusAdjustmentItemSchema }, items: { type: "array", items: statusAdjustmentItemSchema } } } },
  {
    name: "run_dove_auto",
    description: "Run demand-to-task intake with compact task/auto cards and preActionGuidance, then after explicit confirmation run bounded foreground iterations until completion or a boundary. Source-research auto runs should collect concrete URLs/templates/guidelines and synthesis text in the foreground host pass, never claim source research succeeded when search/fetch returned zero results or safety errors, then call confirmed run_dove_auto once with explicit source and note steps; calling with only a packet id records a source-requires-host-provenance boundary and does not advance research. Missing source/note/draft/experience/review-loop material becomes an explicit blocked host-pass boundary instead of placeholder writes, and host-side safety classifier or tool-availability failures must be recorded as blocked host-tool-blocked mission results; no hidden continuation, scheduler, or daemon is started.",
    inputSchema: {
      type: "object",
      properties: withTaskTarget({
        ...missionReplayProps,
        index: { type: "number" },
        proposalKind: { type: "string", enum: ["selection", "demand"] },
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
        maxIterations: { type: "number" },
        maxSteps: { type: "number" },
        completeTask: { type: "boolean" },
        completeOnSuccess: { type: "boolean" },
        ...executionEvidenceProps,
        steps: { type: "array", items: contractAwareAutoStepSchema },
        runId: { type: "string" }
      })
    }
  },
  { name: "run_dove_operator", description: "Preview compact queue summary/cards with planner preActionGuidance and read-only lesson recall by default, optionally returning full queue details only when includeQueueDetails is true; after explicit confirmation run one foreground operator pass across safe internal steps and explicit host-supplied task results. Queue previews, task lists, and status panels are not progress. Host-pass work without taskResults remains unchanged and is returned with material-specific host-pass requiredActions, host-tool-blocked task results record host-side safety classifier or tool-availability failures, blocked work is proposal-only by default, and pending blocker-investigation plan missions are created only when blockerInvestigationMode is create or createBlockedInvestigations is true. Returns created/reused blocker counts and a localized resultCard; no scheduler or hidden runtime.", inputSchema: { type: "object", properties: { confirmed: { type: "boolean" }, confirm: { type: "boolean" }, includeQueueDetails: { type: "boolean" }, blockerInvestigationMode: { type: "string", enum: ["none", "propose", "create"] }, createBlockedInvestigations: { type: "boolean" }, runId: { type: "string" }, taskResults: { type: "array", items: { type: "object", properties: operatorTaskResultProps } }, results: { type: "array", items: { type: "object", properties: operatorTaskResultProps } }, passResults: { type: "array", items: { type: "object", properties: operatorTaskResultProps } } } } },
  { name: "kill_dove_task", description: "Internal guarded capability to kill a non-init Dove task; public operators normally choose killed through /dove:status status adjustment UX.", inputSchema: { type: "object", properties: { packetId: { type: "string" }, taskPacketId: { type: "string" }, taskId: { type: "string" }, id: { type: "string" }, target: { type: "string" }, taskName: { type: "string" }, title: { type: "string" }, index: { type: "number" }, reason: { type: "string" }, killReason: { type: "string" } } } },
  { name: "reset_dove_version", description: "Create a direction-change snapshot and clear active tasks except the level-0 init task. This is not a .dove rollback restore entrypoint; host/context rollback should use mutationMode: patch-plan applied through host-tracked file edits before relying on the host native checkpoint.", inputSchema: { type: "object", properties: { id: { type: "string" }, versionId: { type: "string" }, title: { type: "string" }, reason: { type: "string" }, summary: { type: "string" } } } },
  { name: "run_experience_workflow", description: "Plan, record, audit, and bridge experiment experience into claim state after resolving the durable task packet; every new experience requires a real experiment goal, title, idea, or experimentId, and missing objectives should become an explicit host-pass boundary instead of a placeholder plan. Returns Builder/experiment-planner preActionGuidance with read-only lesson recall, audit gate, and claim-bridge boundary.", inputSchema: { type: "object", properties: withTaskTarget({ id: { type: "string" }, experimentId: { type: "string" }, goal: { type: "string" }, idea: { type: "string" }, title: { type: "string" }, methodology: { type: "string" }, method: { type: "string" }, successMetric: { type: "string" }, metric: { type: "string" }, comparisonTargets: { type: "array", items: { type: "string" } }, baselines: { type: "array", items: { type: "string" } }, claimId: { type: "string" }, plan: { type: "object", properties: experiencePlanProps, additionalProperties: false }, result: { type: "object", properties: experienceResultProps, additionalProperties: false }, resultId: { type: "string" }, outcome: { type: "string" }, summary: { type: "string" }, resultSummary: { type: "string" }, evidenceLinks: { type: "array", items: { type: "string" } }, artifactPaths: { type: "array", items: { type: "string" } } }) } },
  { name: "prepare_audio_review", description: "Prepare an isolated audio review input bundle containing only task summary, final plan/result paths, explicit artifacts, canonical reviewed-artifact snapshots (path, sizeBytes, sha256), an exact-set hash, instructions, and output contract; result cards include Reviewer preActionGuidanceSummary and preserve the no-private-transcript boundary.", inputSchema: { type: "object", properties: withTaskTarget({ runId: { type: "string" }, instructions: { type: "string" }, finalPlanPaths: { type: "array", items: { type: "string" } }, planPaths: { type: "array", items: { type: "string" } }, finalResultPaths: { type: "array", items: { type: "string" } }, resultPaths: { type: "array", items: { type: "string" } }, artifactPaths: { type: "array", items: { type: "string" } }, reviewedArtifactPaths: { type: "array", items: { type: "string" } }, contextPolicy: { type: "string" } }) } },
  { name: "import_audio_review", description: "Import only a declared audio review handoff and report after verifying the prepared input hash, exact reviewed-artifact path set, and every current artifact size/hash before any review-state write; verification failure requires reprepare/review, the result returns Reviewer preActionGuidanceSummary, and private reviewer transcripts are never imported.", inputSchema: { type: "object", properties: withTaskTarget({ runId: { type: "string" }, handoffPath: { type: "string" }, reportPath: { type: "string" } }) } },
  { name: "run_audio_review", description: "Prepare an isolated audio review and import a handoff if one is already present; otherwise return import instructions plus a localized resultCard with Reviewer preActionGuidanceSummary and explicit handoff boundary.", inputSchema: { type: "object", properties: withTaskTarget({ runId: { type: "string" }, scope: { type: "string" }, instructions: { type: "string" }, finalPlanPaths: { type: "array", items: { type: "string" } }, finalResultPaths: { type: "array", items: { type: "string" } }, artifactPaths: { type: "array", items: { type: "string" } }, reviewedArtifactPaths: { type: "array", items: { type: "string" } }, handoffPath: { type: "string" }, reportPath: { type: "string" } }) } },
  { name: "run_dove_review_loop", description: "Run one independent local Reviewer pass over the resolved packet and its descendants. The call never edits draft or experience material and never performs an implicit Reviewer-to-Builder-to-Reviewer cycle. A non-coherent verdict returns an explicit Builder handoff; revisions and any later review require new explicit calls.", inputSchema: { type: "object", properties: withTaskTarget({ runId: { type: "string" }, scope: { type: "string" }, instructions: { type: "string" }, stage: { type: "string" }, summary: { type: "string" }, artifactPaths: { type: "array", items: { type: "string" } }, reviewedArtifactPaths: { type: "array", items: { type: "string" } }, responseLanguage: { type: "string" }, language: { type: "string" } }), additionalProperties: false } },
  { name: "launch_dove_mission", description: "Launch one governed Dove mission by materializing accepted proposal guidance into authoritative .dove mission packets without creating program authority or executing autonomy.", inputSchema: { type: "object", properties: { sourceType: { type: "string" }, sourceId: { type: "string" }, actorRole: { type: "string" }, workerRole: { type: "string" }, doveWorkerRole: { type: "string" }, goal: { type: "string" }, domain: { type: "string" }, doveDomain: { type: "string" }, missionDomain: { type: "string" }, stage: { type: "string" }, missionStage: { type: "string" }, targetArtifacts: { type: "array", items: { type: "string" } }, artifacts: { type: "array", items: { type: "string" } }, artifactPaths: { type: "array", items: { type: "string" } }, acceptanceChecks: { type: "array", items: { type: "string" } }, acceptanceCriteria: { type: "array", items: { type: "string" } }, returnProtocol: { type: "string" }, packetId: { type: "string" }, missionPacketId: { type: "string" }, followThroughId: { type: "string" }, selectedConversionPathKey: { type: "string" }, title: { type: "string" }, summary: { type: "string" }, phase: { type: "string" }, assignedRole: { type: "string" }, lifecycleStatus: { type: "string" }, currentFocus: { type: "string" }, nextAction: { type: "string" }, dependencies: { type: "array", items: { type: "string" } }, evidenceLinks: { type: "array", items: { type: "string" } }, outputPaths: { type: "array", items: { type: "string" } }, status: { type: "string" }, nextCommand: { type: "string" }, decisionSummary: { type: "string" }, rationale: { type: "string" }, executeBy: { type: "string" }, reviewAfter: { type: "string" } } } },
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
    inputSchema: { type: "object", properties: { objective: { type: "string" }, phase: { type: "string" }, assignedRole: { type: "string" }, intentType: { type: "string" }, currentFocus: { type: "string" }, nextAction: { type: "string" }, continuationState: { type: "object" }, tasks: { type: "array", items: { type: "object" } }, blockers: { type: "array", items: { type: "object" } }, evidenceLinks: { type: "array", items: { type: "string" } }, experimentIds: { type: "array", items: { type: "string" } }, rebuttalIssueIds: { type: "array", items: { type: "string" } }, activeComparisonTargets: { type: "array", items: { type: "string" } }, versionLineage: { type: "object" } } }
  },
  {
    name: "append_handoff",
    description: "Append a durable handoff entry and update the assigned role.",
    inputSchema: { type: "object", properties: { fromRole: { type: "string" }, toRole: { type: "string" }, phase: { type: "string" }, intentType: { type: "string" }, summary: { type: "string" }, currentFocus: { type: "string" }, nextAction: { type: "string" }, nextActions: { type: "array", items: { type: "string" } }, evidenceLinks: { type: "array", items: { type: "string" } }, blockerIds: { type: "array", items: { type: "string" } } } }
  },
  {
    name: "update_research_brief",
    description: "Update the durable research brief and agenda artifacts. Task-scoped writes resolve to a durable packet first; missing or ambiguous targets require explicit packet confirmation unless there is one unique high-confidence autoSelect candidate.",
    inputSchema: { type: "object", properties: withTaskTarget({ objective: { type: "string" }, agenda: { type: "array", items: { type: "string" } }, evidenceBacklog: { type: "array", items: { type: "string" } }, phase: { type: "string" }, assignedRole: { type: "string" } }) }
  },
  {
    name: "register_source",
    description: "Register or update one or more external source records as candidates with Builder/researcher preActionGuidanceSummary and packet binding. Registration always creates lifecycle candidate and cannot directly support claims or completion; final summaries must separate verified registered sources from candidate links. Use verify_source only after independently checking source material; caller-provided verified flags, verification fields, role strings, tokens, or capabilities are rejected. Use `sources: [...]` for batch venue/template/guideline/ranking intake; each new source must include a real title or locator. Do not register sources whose origin/abstract says search returned zero results, safe-domain verification failed, or fetch/retrieval was blocked; surface a host-tool-blocked boundary until verifiable source evidence exists. Final user-facing summaries must separate verified registered sources from candidate links and blocked retrieval candidates instead of putting unverified candidates under generic Sources. Internal pressure-test summaries or writing-preference synthesis belong in `upsert_note` or `record_document_evidence`, not source. Task-scoped writes resolve to a durable packet first; missing or ambiguous targets require explicit packet confirmation unless there is one unique high-confidence autoSelect candidate.",
    inputSchema: { type: "object", properties: withTaskTarget({ sourceId: { type: "string" }, citationKey: { type: "string" }, title: { type: "string" }, authors: { type: "array", items: { type: "string" } }, year: { type: ["string", "number"] }, locator: { type: "string" }, sourceType: { type: "string" }, abstract: { type: "string" }, origin: { type: "string" }, sources: { type: "array", items: { type: "object", properties: { sourceId: { type: "string" }, citationKey: { type: "string" }, title: { type: "string" }, authors: { type: "array", items: { type: "string" } }, year: { type: ["string", "number"] }, locator: { type: "string" }, sourceType: { type: "string" }, abstract: { type: "string" }, origin: { type: "string" } } } } }) }
  },
  {
    name: "verify_source",
    description: "Independently verify or reject one registered candidate source. This explicit operation writes a durable audit record bound to the source identity fingerprint; changing locator, DOI, URL, title, or authors invalidates prior verification. Requires method, checkedMaterial, and auditable evidence references. It does not accept caller-minted verified booleans, role strings, tokens, capabilities, or embedded verification records.",
    inputSchema: { type: "object", properties: withTaskTarget({ sourceId: { type: "string" }, decision: { type: "string", enum: ["verified", "rejected"] }, method: { type: "string" }, checkedMaterial: { type: "string" }, auditEvidence: { type: "array", minItems: 1, items: { type: "object", properties: { reference: { type: "string", minLength: 1 }, kind: { type: "string", enum: ["source", "capture"] }, observation: { type: "string", minLength: 1 } }, required: ["reference", "kind", "observation"], additionalProperties: false } } }), required: ["sourceId", "decision", "method", "checkedMaterial", "auditEvidence"] }
  },
  {
    name: "upsert_note",
    description: "Create or update a packet-bound structured note linked to one or more registered sources with Builder/researcher preActionGuidanceSummary and evidence guardrails. New notes require real synthesis content: summary, quote, claim, or open question; empty note requests should stop at a host-pass boundary. Use notes for internal synthesis, pressure-test findings, writing-style summaries, and reviewer-preference analysis after external provenance is registered as sources. Task-scoped writes resolve to a durable packet first; missing or ambiguous targets require explicit packet confirmation unless there is one unique high-confidence autoSelect candidate.",
    inputSchema: { type: "object", properties: withTaskTarget({ noteId: { type: "string" }, title: { type: "string" }, sectionId: { type: "string" }, sourceIds: { type: "array", items: { type: "string" } }, summary: { type: "string" }, quotes: { type: "array", items: { type: "string" } }, claims: { type: "array", items: { type: "string" } }, openQuestions: { type: "array", items: { type: "string" } } }) }
  },
  {
    name: "upsert_claims",
    description: "Write claims derived from results into the evidence store after resolving a durable task packet. Every referenced source must be lifecycle verified by a durable verification record whose fingerprint still matches the source identity; candidate, rejected, missing, or identity-mutated sources are rejected before any write. Returns Builder/researcher preActionGuidanceSummary.",
    inputSchema: { type: "object", properties: withTaskTarget({ claims: { type: "array", items: { type: "object", properties: { id: { type: "string" }, text: { type: "string" }, sectionId: { type: "string" }, sourceIds: { type: "array", items: { type: "string" } }, noteIds: { type: "array", items: { type: "string" } }, experimentIds: { type: "array", items: { type: "string" } }, evidenceLinks: { type: "array", items: { type: "string" } }, status: { type: "string" }, confidence: { type: "string" }, gap: { type: "string" } } } } }) }
  },
  {
    name: "upsert_plan",
    description: "Create or update the current plan artifact with Planner preActionGuidanceSummary and scope/gate guardrails. Task-scoped writes resolve to a durable packet first; missing or ambiguous targets require explicit packet confirmation unless there is one unique high-confidence autoSelect candidate.",
    inputSchema: { type: "object", properties: withTaskTarget({ thesis: { type: "string" }, audience: { type: "string" }, sections: { type: "array", items: { type: "string" } }, evidenceGaps: { type: "array", items: { type: "string" } }, milestones: { type: "array", items: { type: "string" } }, figures: { type: "array", items: { type: "string" } }, notes: { type: "string" } }) }
  },
  {
    name: "upsert_outline",
    description: "Create or update the current section outline with Planner preActionGuidanceSummary and draft gate guardrails. Task-scoped writes resolve to a durable packet first; missing or ambiguous targets require explicit packet confirmation unless there is one unique high-confidence autoSelect candidate.",
    inputSchema: { type: "object", properties: withTaskTarget({ sections: { type: "array", items: { type: "object", properties: { id: { type: "string" }, title: { type: "string" }, status: { type: "string" }, goal: { type: "string" }, evidenceFocus: { type: "string" } } } } }) }
  },
  {
    name: "upsert_draft",
    description: "Create or update a section draft under .dove/drafts with Builder/researcher preActionGuidanceSummary. Draft updates require body content; use set_section_status for metadata-only section updates, and stop at a host-pass boundary when no draft body is available. Task-scoped writes resolve to a durable packet first; missing or ambiguous targets require explicit packet confirmation unless there is one unique high-confidence autoSelect candidate.",
    inputSchema: { type: "object", properties: withTaskTarget({ sectionId: { type: "string" }, title: { type: "string" }, body: { type: "string" }, status: { type: "string" }, summary: { type: "string" } }) }
  },
  {
    name: "upsert_experiment_plan",
    description: "Create or update a claim-driven experiment plan after resolving a durable task packet; board role metadata records workflow routing but is not mutation authority.",
    inputSchema: { type: "object", properties: withTaskTarget({ id: { type: "string" }, title: { type: "string" }, claimId: { type: "string" }, hypothesis: { type: "string" }, methodology: { type: "string" }, successMetric: { type: "string" }, comparisonTargets: { type: "array", items: { type: "string" } }, status: { type: "string" }, owner: { type: "string" } }) }
  },
  {
    name: "upsert_experiment_result",
    description: "Create or update a durable experiment result entry after resolving a durable task packet; plan, claim, evidence, audit, bridge, and follow-through contracts govern the mutation rather than board role metadata.",
    inputSchema: { type: "object", properties: withTaskTarget({ result: { type: "object" }, id: { type: "string" }, experimentId: { type: "string" }, claimId: { type: "string" }, outcome: { type: "string" }, summary: { type: "string" }, evidenceLinks: { type: "array", items: { type: "string" } }, comparisonTargets: { type: "array", items: { type: "string" } } }) }
  },
  {
    name: "run_experiment_audit",
    description: "Create or update a durable experiment audit record distinct from raw results; resolves a durable task packet before writing, requires resultId when an experiment has multiple results, and returns Reviewer preActionGuidanceSummary for the audit gate.",
    inputSchema: { type: "object", properties: withTaskTarget({ resultId: { type: "string" }, experimentId: { type: "string" }, reviewedArtifactRefs: { type: "array", items: { type: "string" } }, auditFindings: { type: "array", items: { type: "string" } }, integrityFlags: { type: "array", items: { type: "string" } }, confidence: { type: "string" }, outcomeMapping: { type: "string" } }) }
  },
  {
    name: "bridge_result_to_claim",
    description: "Persist an explicit result-to-claim bridge event and update claim state with Builder/experiment-planner preActionGuidanceSummary; resolves a durable task packet before writing and requires resultId when an experiment has multiple results.",
    inputSchema: { type: "object", properties: withTaskTarget({ resultId: { type: "string" }, experimentId: { type: "string" }, auditIds: { type: "array", items: { type: "string" } }, reason: { type: "string" } }) }
  },
  {
    name: "run_review_loop",
    description: "Run an evidence-aware independent review pass and generate a revision plan after resolving a durable task packet; review artifact and follow-through contracts govern the mutation, while reviewer role metadata frames workflow routing and role-framed preActionGuidance.",
    inputSchema: { type: "object", properties: withTaskTarget({ scope: { type: "string" }, stage: { type: "string" }, artifactPaths: { type: "array", items: { type: "string" } }, reviewedArtifactPaths: { type: "array", items: { type: "string" } } }), additionalProperties: false }
  },
  {
    name: "append_review_log",
    description: "Append a structured manual review entry after resolving a durable task packet; verdict, summary, reviewed-artifact, report, boundary, and follow-through contracts govern the mutation rather than board role metadata.",
    inputSchema: { type: "object", properties: withTaskTarget({ timestamp: { type: "string" }, stage: { type: "string" }, scope: { type: "string" }, verdict: { type: "string" }, summary: { type: "string" }, findings: { type: "array", items: manualReviewFindingSchema }, actionItems: { type: "array", items: { type: "string" } } }) }
  },
  {
    name: "prepare_isolated_review",
    description: "Prepare an isolated reviewer input bundle from explicit Dove artifacts after resolving the durable task packet target, storing canonical reviewed-artifact snapshots (path, sizeBytes, sha256) and an exact-set hash without invoking an external reviewer process; returns Reviewer preActionGuidanceSummary and explicit isolation boundaries.",
    inputSchema: { type: "object", properties: withTaskTarget({ runId: { type: "string" }, scope: { type: "string" }, instructions: { type: "string" }, mediatorRole: { type: "string" }, reviewerRole: { type: "string" }, reviewedArtifactPaths: { type: "array", items: { type: "string" } }, artifactPaths: { type: "array", items: { type: "string" } } }) }
  },
  {
    name: "import_isolated_review",
    description: "Import only an isolated review handoff and report after verifying the prepared input hash, manifest/input snapshot equality, exact handoff path set, and current artifact size/hash before any review-state write; verification failure requires reprepare/review, the result returns Reviewer preActionGuidanceSummary, and private transcripts are never imported.",
    inputSchema: { type: "object", properties: withTaskTarget({ runId: { type: "string" }, handoffPath: { type: "string" }, reportPath: { type: "string" } }) }
  },
  {
    name: "upsert_revision_plan",
    description: "Write a manual revision plan artifact after resolving a durable task packet; board role metadata records the resulting workflow route but is not mutation authority.",
    inputSchema: { type: "object", properties: withTaskTarget({ summary: { type: "string" }, items: { type: "array", items: { type: "string" } }, updatedAt: { type: "string" } }) }
  },
  { name: "set_section_status", description: "Update the status and summary for a section after resolving the durable task packet target; returns Planner preActionGuidanceSummary with section gate context.", inputSchema: { type: "object", properties: withTaskTarget({ sectionId: { type: "string" }, status: { type: "string" }, summary: { type: "string" } }) } },
  { name: "sync_checklist", description: "Regenerate the checklist from current state and review findings; returns Planner preActionGuidanceSummary with status gate context.", inputSchema: { type: "object", properties: {} } },
  { name: "sync_citations", description: "Audit citations and regenerate references.bib plus the citation log; returns Builder/researcher preActionGuidanceSummary with citation and evidence guardrails.", inputSchema: { type: "object", properties: { citedOnly: { type: "boolean" }, preservePhase: { type: "boolean" } } } },
  { name: "refresh_wiki", description: "Regenerate the durable research wiki and typed wiki indexes from current sources, notes, claims, and review state; returns Planner preActionGuidanceSummary for reusable context refresh.", inputSchema: { type: "object", properties: {} } },
  { name: "normalize_rebuttal_issues", description: "Normalize reviewer issues into a durable rebuttal issue board after resolving the durable task packet target; issue and follow-through contracts govern the mutation, while reviewer role metadata only frames workflow routing and preActionGuidanceSummary.", inputSchema: { type: "object", properties: withTaskTarget({ issues: { type: "array", items: rebuttalIssueSchema } }) } },
  { name: "build_rebuttal_strategy", description: "Generate the rebuttal strategy and response draft only when the canonical normalized rebuttal issues index contains at least one real issue; otherwise return a no-write missing-required-materials boundary requiring review/import and issue normalization. Durable issue and follow-through contracts govern the mutation, with Builder/revision-lead metadata used for routing guidance.", inputSchema: { type: "object", properties: withTaskTarget({}) } },
  { name: "build_rebuttal", description: "Generate an artifact-backed rebuttal draft only when the canonical normalized rebuttal issues index contains at least one real issue; otherwise return a no-write missing-required-materials boundary requiring review/import and issue normalization.", inputSchema: { type: "object", properties: withTaskTarget({}) } },
  { name: "create_version_snapshot", description: "Snapshot the current paper state and update version lineage after resolving the durable task packet target; coherent-review and experiment-integrity finalization gates govern the mutation, while board role metadata records workflow routing.", inputSchema: { type: "object", properties: withTaskTarget({ versionId: { type: "string" }, label: { type: "string" }, parentVersionId: { type: "string" }, summary: { type: "string" } }) } },
  { name: "compare_versions", description: "Compare two durable paper snapshots and record the comparison after resolving the durable task packet target; snapshot existence, coherent-review, experiment-integrity, and follow-through gates govern the mutation rather than board role metadata.", inputSchema: { type: "object", properties: withTaskTarget({ fromVersionId: { type: "string" }, toVersionId: { type: "string" } }) } },
  { name: "list_artifacts", description: "List the expected Dove artifacts and whether they exist.", inputSchema: { type: "object", properties: {} } },
  { name: "upsert_figure_plan", description: "Write the figure backlog, linkage metadata, generation intent, and artifact contracts after resolving the durable task packet target; returns Builder preActionGuidanceSummary with provenance and QA gates.", inputSchema: { type: "object", properties: withTaskTarget({ items: { type: "array", items: { type: "object" } } }) } },
  { name: "run_figure_workflow", description: "Turn one user-described figure intent into a packet-scoped figure plan, material discovery, optional generation/import, caption/provenance, and QA status; returns Builder preActionGuidance with artifact-provenance and QA gates. Use providerId none for a first-class plan-only/manual-output path that records backlog, material bundle, generation prompt, and an awaiting-provider-output or missing-required-materials boundary without routing the operator to upsert_figure_plan. Use providerId gpt-image2 only for explicit foreground OpenAI image generation with OPENAI_API_KEY supplied through the environment, never as an inline secret.", inputSchema: { type: "object", properties: withTaskTarget({ intent: { type: "string" }, description: { type: "string" }, name: { type: "string" }, title: { type: "string" }, figureId: { type: "string" }, id: { type: "string" }, purpose: { type: "string" }, captionIntent: { type: "string" }, targetClaimIds: { type: "array", items: { type: "string" } }, claimIds: { type: "array", items: { type: "string" } }, sourceSections: { type: "array", items: { type: "string" } }, sectionIds: { type: "array", items: { type: "string" } }, sourceArtifactPaths: { type: "array", items: { type: "string" } }, artifactPaths: { type: "array", items: { type: "string" } }, relatedExperimentIds: { type: "array", items: { type: "string" } }, experimentIds: { type: "array", items: { type: "string" } }, reviewConcernIds: { type: "array", items: { type: "string" } }, rebuttalIssueIds: { type: "array", items: { type: "string" } }, requiredVisualElements: { type: "array", items: { type: "string" } }, materialHints: { type: "array", items: { anyOf: [{ type: "string" }, figureMaterialItemSchema] } }, materialRequirements: { type: "array", items: figureMaterialItemSchema }, providerId: { type: "string" }, executeProvider: { type: "boolean" }, allowMissingMaterials: { type: "boolean" }, runId: { type: "string" }, outputFormat: { type: "string" }, constraints: { type: "array", items: { type: "string" } }, outputManifestPath: { type: "string" }, sourceSvgPath: { type: "string" }, targetFinalSvgPath: { type: "string" }, svgContent: { type: "string" }, caption: { type: "string" }, captionDraft: { type: "string" }, captionId: { type: "string" } }) } },
  { name: "prepare_figure_generation", description: "Discover required figure materials and write a durable generation input bundle after resolving the durable task packet target; returns Builder preActionGuidanceSummary while keeping material provenance and provider boundaries explicit. providerId gpt-image2 selects the built-in OpenAI image provider only for explicit foreground execution with OPENAI_API_KEY supplied through the environment, never as an inline secret.", inputSchema: { type: "object", properties: withTaskTarget({ figureId: { type: "string" }, id: { type: "string" }, runId: { type: "string" }, providerId: { type: "string" }, constraints: { type: "array", items: { type: "string" } }, outputFormat: { type: "string" }, materialHints: { type: "array", items: { anyOf: [{ type: "string" }, figureMaterialItemSchema] } }, executeProvider: { type: "boolean" }, allowMissingMaterials: { type: "boolean" } }) } },
  { name: "import_figure_generation", description: "Import a declared generated figure output, validate SVG safety, write caption/provenance, refresh figure QA, and return Builder preActionGuidanceSummary with the artifact-provenance gate after resolving the durable task packet target.", inputSchema: { type: "object", properties: withTaskTarget({ figureId: { type: "string" }, id: { type: "string" }, runId: { type: "string" }, outputManifestPath: { type: "string" }, caption: { type: "string" }, captionDraft: { type: "string" }, captionId: { type: "string" }, sourceSvgPath: { type: "string" }, svgContent: { type: "string" } }) } },
  { name: "validate_figure_pipeline", description: "Regenerate durable figure material, generation, caption, and stage-validation QA outputs.", inputSchema: { type: "object", properties: {} } },
  { name: "record_operator_lesson", description: "Record one explicit distilled operator lesson with problem, decisions, pitfalls, validation, and next-time guidance; action surfaces auto-recall lessons read-only, but recording never happens implicitly and raw runtime traces are rejected.", inputSchema: { type: "object", properties: withTaskTarget({ id: { type: "string" }, title: { type: "string" }, problem: { type: "string" }, decisions: { type: "array", items: { type: "string" } }, pitfalls: { type: "array", items: { type: "string" } }, validation: { type: "array", items: { type: "string" } }, nextTime: { type: "array", items: { type: "string" } }, domain: { type: "string" }, doveDomain: { type: "string" }, missionDomain: { type: "string" }, stage: { type: "string" }, missionStage: { type: "string" }, actorRole: { type: "string" }, tags: { type: "array", items: { type: "string" } }, sourceType: { type: "string" }, sourceId: { type: "string" }, sourceArtifacts: { type: "array", items: { type: "string" } }, artifactPaths: { type: "array", items: { type: "string" } }, sourceArtifactPath: { type: "string" }, relatedPacketIds: { type: "array", items: { type: "string" } }, packetIds: { type: "array", items: { type: "string" } }, taskPacketIds: { type: "array", items: { type: "string" } }, missionPacketIds: { type: "array", items: { type: "string" } }, taskIds: { type: "array", items: { type: "string" } }, recommendationIds: { type: "array", items: { type: "string" } }, playbookIds: { type: "array", items: { type: "string" } }, remediationPackIds: { type: "array", items: { type: "string" } }, status: { type: "string" } }) } }
  ,{ name: "record_operator_follow_through", description: "Record a manual operator follow-through decision for a remediation pack, family playbook, or execution-bridge candidate; runtime/program linkage, retry/timing state, and runtime-owned statuses are never caller-controlled.", inputSchema: { type: "object", properties: { id: { type: "string" }, sourceType: { type: "string" }, sourceId: { type: "string" }, status: { type: "string", enum: ["acknowledged", "accepted-for-execution", "deferred", "accepted-risk"] }, actorRole: { type: "string" }, workerRole: { type: "string" }, decisionSummary: { type: "string" }, rationale: { type: "string" }, selectedConversionPathKey: { type: "string" }, linkedTargetArtifact: { type: "string" }, linkedTargetId: { type: "string" }, plannedTarget: { type: "boolean" }, deferUntil: { type: "string" }, executeBy: { type: "string" }, reviewAfter: { type: "string" } } } }
  ,{ name: "plan_campaign", description: "Record or update a planner-supervised multi-cycle campaign plan without approving or executing work.", inputSchema: { type: "object", properties: { campaignId: { type: "string" }, title: { type: "string" }, objective: { type: "string" }, status: { type: "string" }, phase: { type: "string" }, actorRole: { type: "string" }, programIds: { type: "array", items: { type: "string" } }, steps: { type: "array", items: { type: "object", properties: { id: { type: "string" }, title: { type: "string" }, status: { type: "string" }, programId: { type: "string" }, programRunId: { type: "string" }, approvalId: { type: "string" }, packetId: { type: "string" }, allowedStepType: { type: "string" }, objective: { type: "string" }, nextAction: { type: "string" }, evidenceLinks: { type: "array", items: { type: "string" } }, outputPaths: { type: "array", items: { type: "string" } }, executeBy: { type: "string" }, reviewAfter: { type: "string" } } } }, nextAction: { type: "string" }, reviewPolicy: { type: "string" }, explicitApprovalRequired: { type: "boolean" }, noHiddenRuntime: { type: "boolean" } } } }
  ,{ name: "revoke_program_approval", description: "Revoke one explicit program approval without executing work.", inputSchema: { type: "object", properties: { approvalId: { type: "string" }, actorRole: { type: "string" }, summary: { type: "string" }, revokeReason: { type: "string" } } } }
  ,{ name: "materialize_guidance_packet", description: "Create a durable task packet and follow-through record from accepted packet guidance without creating program authority or executing work.", inputSchema: { type: "object", properties: { sourceType: { type: "string" }, sourceId: { type: "string" }, actorRole: { type: "string" }, workerRole: { type: "string" }, selectedConversionPathKey: { type: "string" }, packetId: { type: "string" }, followThroughId: { type: "string" }, title: { type: "string" }, summary: { type: "string" }, phase: { type: "string" }, assignedRole: { type: "string" }, status: { type: "string" }, lifecycleStatus: { type: "string" }, currentFocus: { type: "string" }, nextAction: { type: "string" }, dependencies: { type: "array", items: { type: "string" } }, evidenceLinks: { type: "array", items: { type: "string" } }, outputPaths: { type: "array", items: { type: "string" } }, decisionSummary: { type: "string" }, rationale: { type: "string" }, executeBy: { type: "string" }, reviewAfter: { type: "string" }, domain: { type: "string" }, doveDomain: { type: "string" }, missionDomain: { type: "string" }, stage: { type: "string" }, missionStage: { type: "string" }, goal: { type: "string" }, missionGoal: { type: "string" }, objective: { type: "string" }, targetArtifacts: { type: "array", items: { type: "string" } }, artifacts: { type: "array", items: { type: "string" } }, artifactPaths: { type: "array", items: { type: "string" } }, acceptanceCriteria: { type: "array", items: { type: "string" } }, acceptanceChecks: { type: "array", items: { type: "string" } }, returnProtocol: { type: "string" } } } }
];

export const toolDefinitions = baseToolDefinitions.map(addMcpControlFields).map((tool) => ({
  ...tool,
  operatorTier: OPERATOR_TOOL_NAMES.includes(tool.name) ? "operator" : "advanced",
  workflowArea: OPERATOR_WORKFLOW_AREAS[tool.name] ?? "advanced",
  primaryEntry: OPERATOR_TOOL_NAMES.includes(tool.name),
  internalOnly: !OPERATOR_TOOL_NAMES.includes(tool.name)
}));

export const TOOL_INPUT_SCHEMAS = new Map(
  toolDefinitions.map((tool) => [
    tool.name,
    tool.inputSchema
  ])
);

export const TOOL_INPUT_PROPERTY_NAMES = new Map(
  toolDefinitions.map((tool) => [
    tool.name,
    new Set(Object.keys(tool.inputSchema?.properties ?? {}))
  ])
);

function compactOperatorToolSchema(tool) {
  const properties = tool.inputSchema?.properties ?? {};
  const fieldNames = OPERATOR_SCHEMA_FIELDS[tool.name] ?? Object.keys(properties);
  const compactProperties = Object.fromEntries(fieldNames
    .filter((fieldName) => properties[fieldName] && !isCompactDiscoveryInternalKey(fieldName))
    .map((fieldName) => [fieldName, compactPublicSchema(properties[fieldName])]));
  return compactPublicSchema({
    type: tool.inputSchema?.type ?? "object",
    properties: compactProperties,
    additionalProperties: false
  });
}

function compactOperatorTool(tool) {
  return {
    name: tool.name,
    description: OPERATOR_PUBLIC_TOOL_DESCRIPTIONS[tool.name] ?? "Use this Dove capability for everyday project work.",
    inputSchema: compactOperatorToolSchema(tool),
    discoverySurface: "operator",
    workflowArea: OPERATOR_WORKFLOW_AREAS[tool.name] ?? "workflow"
  };
}

export function toolDefinitionsForSurface(surface = "operator") {
  const normalized = typeof surface === "string" ? surface.trim().toLowerCase() : "operator";
  if (["full", "debug"].includes(normalized)) {
    return toolDefinitions.map((tool) => ({ ...tool, discoverySurface: normalized }));
  }
  return toolDefinitions
    .filter((tool) => OPERATOR_TOOL_NAMES.includes(tool.name))
    .map(compactOperatorTool);
}
