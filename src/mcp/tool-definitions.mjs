const safeId = { type: "string", pattern: "^[a-z0-9][a-z0-9._-]{0,127}$" };
const strings = { type: "array", items: { type: "string", minLength: 1 } };
const lessonScopes = { type: "string", enum: ["global", "mission"] };
const lessonKinds = { type: "string", enum: ["preference", "constraint", "method", "failure", "review-insight"] };
const lessonRecordProps = {
  missionId: safeId,
  lessonId: safeId,
  scope: lessonScopes,
  kind: lessonKinds,
  summary: { type: "string", minLength: 1 },
  details: { type: "string", minLength: 1 },
  nextTimeGuidance: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
  sourceIds: { type: "array", items: safeId },
  noteIds: { type: "array", items: safeId },
  artifactRefs: strings,
  appliesToArtifactRefs: strings,
  tags: strings,
  supersedesLessonId: safeId
};

const researchTreeNodeUpdateSchema = {
  type: "object",
  properties: {
    nodeId: safeId,
    parentNodeId: { anyOf: [safeId, { type: "null" }] },
    workKind: { type: "string", enum: ["retrieval", "experiment", "analysis"] },
    questionOrHypothesis: { type: "string", minLength: 1 },
    workDescription: { type: "string", minLength: 1 },
    successOrStopCriterion: { type: "string", minLength: 1 },
    status: { type: "string", enum: ["pending", "completed", "blocked"] },
    outcomeSummary: { anyOf: [{ type: "string", minLength: 1 }, { type: "null" }] },
    outcomeEvidenceRefs: strings,
    blockedReasonCode: { anyOf: [safeId, { type: "null" }] }
  },
  required: [
    "nodeId",
    "parentNodeId",
    "workKind",
    "questionOrHypothesis",
    "workDescription",
    "successOrStopCriterion",
    "status",
    "outcomeSummary",
    "outcomeEvidenceRefs",
    "blockedReasonCode"
  ],
  additionalProperties: false
};

const missionReplayProps = {
  operation: { type: "string", enum: ["create", "reevaluate-research-tree"] },
  missionId: safeId,
  goal: { type: "string", minLength: 1 },
  scope: strings,
  outOfScope: strings,
  targetArtifacts: strings,
  expectedArtifacts: strings,
  completionCriteria: strings,
  evidenceRequirements: strings,
  dependsOnMissionIds: { type: "array", items: safeId },
  supersedesMissionId: safeId,
  requirement: { type: "string", minLength: 1 },
  nodeUpdates: { type: "array", minItems: 1, items: researchTreeNodeUpdateSchema }
};
const receiptArtifactSchema = { type: "object", properties: { path: { type: "string" }, kind: { type: "string" }, sha256: { type: "string", pattern: "^[0-9a-f]{64}$" } }, required: ["path", "kind", "sha256"], additionalProperties: false };
const receiptValidationSchema = { type: "object", properties: { kind: { type: "string" }, reference: { type: "string" }, outputHash: { type: "string", pattern: "^[0-9a-f]{64}$" } }, required: ["kind", "reference", "outputHash"], additionalProperties: false };
const receiptCriterionSchema = { type: "object", properties: { criterionId: { type: "string" }, evidenceRefs: strings }, required: ["criterionId", "evidenceRefs"], additionalProperties: false };
function mutationTool(name, description, properties, required = []) {
  return { name, description, inputSchema: { type: "object", properties, required, additionalProperties: false } };
}
function queryTool(name, description, properties, required = []) {
  return { name, description, inputSchema: { type: "object", properties, required, additionalProperties: false } };
}
function missionMutationTool() {
  return mutationTool(
    "create_dove_mission",
    "Create one minimal mission checkpoint or approve a mission-bound research decision update in the same tool call. Creation requires missionId and goal; research-tree reevaluation requires operation, missionId, requirement, and nodeUpdates.",
    missionReplayProps,
    ["missionId"]
  );
}

export const toolDiscoveryInputSchema = { type: "object", properties: {}, additionalProperties: false };

const baseToolDefinitions = [
  mutationTool("init_dove_goal", "Initialize Dove project records after one in-tool approval.", { goal: { type: "string", minLength: 1 }, archiveReset: { type: "boolean" } }, ["goal"]),
  missionMutationTool(),
  queryTool("query_dove_mission", "Preview one minimal schema 9 mission contract.", { missionId: safeId, goal: { type: "string", minLength: 1 }, scope: strings, outOfScope: strings, targetArtifacts: strings, expectedArtifacts: strings, completionCriteria: strings, evidenceRequirements: strings, dependsOnMissionIds: { type: "array", items: safeId }, supersedesMissionId: safeId }, ["goal"]),
  queryTool("query_dove_status", "Read minimal mission, receipt, source, evidence, review, and domain integrity without writes; missionId is optional, the only mission is selected when exactly one exists, and multiple missions require explicit selection.", { missionId: safeId, detail: { type: "string", enum: ["compact", "full"] }, language: { type: "string", enum: ["zh", "en"] } }),
  mutationTool("ingest_execution_receipt", "Ingest an immutable hash-bound execution receipt.", { receiptId: safeId, missionId: safeId, contractDigest: { type: "string", pattern: "^[0-9a-f]{64}$" }, summary: { type: "string", minLength: 1 }, artifacts: { type: "array", minItems: 1, items: receiptArtifactSchema }, validations: { type: "array", items: receiptValidationSchema }, criteriaSatisfied: { type: "array", items: receiptCriterionSchema }, producedAt: { type: "string", minLength: 1 } }, ["receiptId", "missionId", "contractDigest", "summary", "artifacts", "validations", "criteriaSatisfied", "producedAt"]),
  mutationTool("close_host_outcome", "Record current host-produced mission artifacts using server-generated outcome evidence.", { missionId: safeId, summary: { type: "string", minLength: 1 }, artifactPaths: strings, validationPaths: strings }, ["missionId", "summary", "artifactPaths"]),
  queryTool("assess_mission_completion", "Reassess mission completion from current evidence and review authority.", { missionId: safeId }, ["missionId"]),
  queryTool("search_network", "Search public candidate material without writing state.", { query: { type: "string", minLength: 1 }, kind: { type: "string", enum: ["scholarly", "web", "all"] }, limit: { type: "number" }, year: { type: ["string", "number"] }, domains: strings, fieldsOfStudy: strings, openAccessOnly: { type: "boolean" }, providerIds: strings, providers: strings, locale: { type: "string" } }, ["query"]),
  queryTool("query_network_search_providers", "Inspect read-only public search provider availability.", { kind: { type: "string", enum: ["scholarly", "web", "all"] }, providerIds: strings, providers: strings }),
  queryTool("query_sources", "Query mission-bound source candidates or rejections and current ineligibility.", { missionId: safeId, sourceId: safeId, lifecycle: { type: "string", enum: ["candidate", "rejected"] }, limit: { type: "number" } }, ["missionId"]),
  queryTool("query_dove_lessons", "Query explicit advisory lessons without writes, repair, refresh, automatic capture, automatic recall, transcript ingestion, or Trellis/runtime integration.", { lessonId: safeId, missionId: safeId, scope: lessonScopes, kind: lessonKinds, tags: strings, artifactRefs: strings, includeSuperseded: { type: "boolean" }, includeUnscoped: { type: "boolean" }, limit: { type: "number" } }),
  mutationTool("record_dove_lesson", "Record one explicitly requested mission-provenanced advisory lesson; global scope changes applicability, not provenance.", lessonRecordProps, ["missionId", "lessonId", "scope", "kind", "summary", "nextTimeGuidance", "sourceIds", "noteIds", "artifactRefs", "appliesToArtifactRefs", "tags"]),
  mutationTool("register_source", "Register one mission-bound source candidate. Registration never verifies it.", { missionId: safeId, sourceId: safeId, citationKey: { type: "string" }, title: { type: "string" }, authors: strings, year: { type: ["string", "number"] }, locator: { type: "string" }, sourceType: { type: "string" }, abstract: { type: "string" }, origin: { type: "string" }, capturePath: { type: "string" } }, ["missionId", "sourceId"]),
  mutationTool("verify_source", "Record a mission-bound source rejection. Public positive verification is unavailable.", { missionId: safeId, sourceId: safeId, method: { type: "string", minLength: 1 }, checkedMaterial: { type: "string", minLength: 1 }, auditEvidence: { type: "array", minItems: 1, items: { type: "object", properties: { reference: { type: "string", minLength: 1 }, kind: { type: "string", minLength: 1 }, observation: { type: "string", minLength: 1 } }, required: ["reference", "kind", "observation"], additionalProperties: false } } }, ["missionId", "sourceId", "method", "checkedMaterial", "auditEvidence"]),
  mutationTool("upsert_note", "Record substantive mission-bound synthesis from current mission artifacts; sourceIds remain ineligible until a trusted positive verifier exists.", { missionId: safeId, noteId: safeId, title: { type: "string" }, summary: { type: "string" }, quotes: strings, claims: strings, openQuestions: strings, sourceIds: { type: "array", items: safeId }, artifactRefs: strings }, ["missionId", "noteId"]),
  mutationTool("upsert_claims", "Record mission-bound evidence-backed claims.", { missionId: safeId, claims: { type: "array", minItems: 1, items: { type: "object", properties: { claimId: safeId, text: { type: "string", minLength: 1 }, sourceIds: { type: "array", items: safeId }, noteIds: { type: "array", items: safeId }, artifactRefs: strings, experimentResultIds: { type: "array", items: safeId }, gap: { type: "string" } }, required: ["claimId", "text"], additionalProperties: false } } }, ["missionId", "claims"]),
  mutationTool("run_experience_workflow", "Record experiment protocol, result evidence, audit, and optional claim bridge without scheduling execution.", { missionId: safeId, experimentId: safeId, title: { type: "string" }, goal: { type: "string", minLength: 1 }, hypothesis: { type: "string", minLength: 1 }, protocol: { type: "string", minLength: 1 }, successCriteria: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } }, comparisonTargets: strings, result: { type: "string" }, resultEvidenceRefs: strings, auditFindings: strings, integrityFlags: strings, claimId: safeId, bridgeReason: { type: "string" } }, ["missionId", "experimentId", "goal", "hypothesis", "protocol", "successCriteria"]),
  mutationTool("upsert_draft", "Write a real mission-bound draft body with evidence lineage.", { missionId: safeId, draftId: safeId, title: { type: "string" }, body: { type: "string", minLength: 1 }, summary: { type: "string" }, evidenceRefs: strings, artifactRefs: strings }, ["missionId", "draftId", "body"]),
  mutationTool("upsert_draft_metadata", "Write explicit metadata for an existing mission-bound draft.", { missionId: safeId, draftId: safeId, title: { type: "string" }, summary: { type: "string" }, evidenceRefs: strings, artifactRefs: strings }, ["missionId", "draftId"]),
  mutationTool("run_figure_workflow", "Prepare mission-bound figure materials and prompt, or import host-produced output with caption, provenance, QA, and final hash.", { missionId: safeId, figureId: safeId, intent: { type: "string", minLength: 1 }, purpose: { type: "string", minLength: 1 }, materials: { type: "array", minItems: 1, items: { type: "string" } }, prompt: { type: "string", minLength: 1 }, outputPath: { type: "string" }, outputSha256: { type: "string", pattern: "^[0-9a-f]{64}$" }, caption: { type: "string" }, qaFindings: strings }, ["missionId", "figureId", "intent", "purpose", "materials", "prompt"]),
  mutationTool("prepare_review_exchange", "Preflight or prepare one schema 9 policy-scoped mission review exchange without launching a reviewer.", { missionId: safeId, policy: { type: "string", enum: ["local-preflight", "isolated-selected-artifacts", "final-plan-results-only", "external"] }, artifactPaths: strings, finalPlanPaths: strings, finalResultPaths: strings }, ["missionId", "policy"]),
  mutationTool("import_review_exchange", "Import one canonical hash-bound schema 9 handoff and report as non-authoritative mission artifacts.", { missionId: safeId, exchangeId: safeId, reviewId: safeId }, ["missionId", "exchangeId", "reviewId"]),
  queryTool("verify_review_coverage", "Verify current exact artifact review coverage while Reviewer authority remains fail closed without a trusted issuer.", { missionId: safeId, artifactPaths: strings, requireAuthoritative: { type: "boolean" } }, ["missionId"]),
  mutationTool("normalize_rebuttal_issues", "Normalize author-side reviewer issues with finding and evidence lineage.", { missionId: safeId, issues: { type: "array", minItems: 1, items: { type: "object", properties: { issueId: safeId, summary: { type: "string", minLength: 1 }, findingRefs: strings, evidenceRefs: strings }, required: ["issueId", "summary"], additionalProperties: false } } }, ["missionId", "issues"]),
  mutationTool("build_rebuttal_strategy", "Record an author-side strategy for normalized mission-bound issues.", { missionId: safeId, strategy: { type: "string", minLength: 1 } }, ["missionId", "strategy"]),
  mutationTool("build_rebuttal", "Record evidence-linked author-side rebuttal responses.", { missionId: safeId, issues: { type: "array", items: { type: "object", properties: { issueId: safeId, summary: { type: "string", minLength: 1 }, findingRefs: strings, evidenceRefs: strings }, required: ["issueId", "summary", "findingRefs", "evidenceRefs"], additionalProperties: false } }, strategy: { type: "string" }, responses: { type: "array", minItems: 1, items: { type: "object", properties: { issueId: safeId, response: { type: "string", minLength: 1 }, evidenceRefs: { type: "array", minItems: 1, items: { type: "string" } } }, required: ["issueId", "response", "evidenceRefs"], additionalProperties: false } } }, ["missionId", "responses"]),
  mutationTool("create_version_snapshot", "Snapshot current mission artifacts with optional supersedes lineage.", { missionId: safeId, versionId: safeId, label: { type: "string" }, artifactRefs: { type: "array", minItems: 1, items: { type: "string" } }, supersedesVersionId: safeId }, ["missionId", "versionId", "artifactRefs"]),
  queryTool("compare_versions", "Compare two current mission-bound artifact snapshots immediately without writes and reject stale inputs.", { missionId: safeId, fromVersionId: safeId, toVersionId: safeId }, ["missionId", "fromVersionId", "toVersionId"])
];

const READ_ONLY_TOOL_NAMES = new Set([
  "query_dove_mission",
  "query_dove_status",
  "assess_mission_completion",
  "search_network",
  "query_network_search_providers",
  "query_sources",
  "query_dove_lessons",
  "verify_review_coverage",
  "compare_versions"
]);

export const MUTATING_TOOL_NAMES = new Set(baseToolDefinitions.map((tool) => tool.name).filter((name) => !READ_ONLY_TOOL_NAMES.has(name)));
export const toolDefinitions = baseToolDefinitions;
export const TOOL_INPUT_SCHEMAS = new Map(toolDefinitions.map((tool) => [tool.name, tool.inputSchema]));
export const TOOL_INPUT_PROPERTY_NAMES = new Map(toolDefinitions.map((tool) => [tool.name, new Set(Object.keys(tool.inputSchema.properties ?? {}))]));
