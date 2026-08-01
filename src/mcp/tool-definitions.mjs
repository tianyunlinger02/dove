import { DOVE_RESEARCH_SKILL_IDS } from "../core/schema.mjs";

const safeId = { type: "string", pattern: "^[a-z0-9][a-z0-9._-]{0,127}$" };
const publicNumber = { type: "integer", minimum: 1 };
const strings = { type: "array", items: { type: "string", minLength: 1 } };
const ambientEvidenceRequirements = {
  type: "array",
  items: {
    type: "string",
    pattern: "^(?:artifact|validation):.+$",
    description: "Use artifact:<project-relative-path> or validation:<project-relative-path>."
  }
};
const missionMode = { type: "string", enum: ["ordinary", "research"], description: "Use research only when the work changes research understanding, experiments, evidence, or paper claims; use ordinary for a clear code, documentation, configuration, cleanup, or other bounded deliverable." };
const lessonsUpdateProps = {
  binding: { type: "string", minLength: 1, description: "Pass the exact opaque binding returned by the immediately preceding Lessons read." },
  markdown: { type: "string", minLength: 1, description: "Pass the complete replacement Markdown document with all five stable sections." }
};

const missionArtifactSchema = {
  type: "object",
  properties: {
    path: { type: "string", minLength: 1 },
    required: { type: "boolean" },
    role: { type: "string", enum: ["output", "input-output", "supporting"] }
  },
  required: ["path", "required", "role"],
  additionalProperties: false
};
const missionContractProps = {
  requirements: strings,
  assumptions: strings,
  scope: strings,
  outOfScope: strings,
  artifacts: { type: "array", items: missionArtifactSchema },
  completionCriteria: strings,
  evidenceRequirements: ambientEvidenceRequirements
};
const ambientMissionProps = {
  mode: missionMode,
  goal: { type: "string", minLength: 1 },
  ...missionContractProps,
  mainlineAlignment: { type: "string", minLength: 1, description: "Explain how this bounded request advances the already established project research mainline." },
  changesWorkspaceMainline: { type: "boolean", description: "True only when the user requests changing the project's research direction itself; ordinary edits within that direction are false." }
};

const researchUsageSchema = {
  type: "object",
  properties: {
    actions: { type: "integer", minimum: 0, description: "Non-negative whole action count." },
    timeMinutes: { type: "integer", minimum: 0, description: "Non-negative whole minutes. Express any positive fractional limit or usage by rounding up to the next minute before submission." },
    costUnits: { type: "integer", minimum: 0, description: "Non-negative whole cost units. Express any positive fractional limit or usage by rounding up to the next unit before submission." }
  },
  required: ["actions", "timeMinutes", "costUnits"],
  additionalProperties: false
};
const researchOutcomeTimestamp = { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{3})?Z$" };
const publicHypothesisSchema = { type: "object", properties: { statement: { type: "string", minLength: 1 }, assessment: { type: "string", enum: ["unresolved", "supported", "weakened", "falsified"] }, supportingEvidence: strings, counterEvidence: strings, falsificationCondition: { type: "string", minLength: 1 } }, required: ["statement", "assessment", "supportingEvidence", "counterEvidence", "falsificationCondition"], additionalProperties: false };
const publicRouteSchema = { type: "object", properties: { summary: { type: "string", minLength: 1 }, disposition: { type: "string", enum: ["considered", "selected", "rejected"] }, rationale: { type: "string", minLength: 1 } }, required: ["summary", "disposition", "rationale"], additionalProperties: false };
const publicOpenQuestionSchema = { type: "object", properties: { question: { type: "string", minLength: 1 } }, required: ["question"], additionalProperties: false };
const publicResearchActionSchema = { type: "object", properties: { kind: { type: "string", enum: ["retrieval", "experiment", "analysis", "engineering"] }, description: { type: "string", minLength: 1 }, rationale: { type: "string", minLength: 1 }, targets: { type: "array", minItems: 1, items: { type: "string", pattern: "^(?:hypothesis|question):[1-9][0-9]*$", description: "Use hypothesis:<one-based-index> or question:<one-based-index> from this reevaluation input." } }, successConditions: { ...strings, minItems: 1 }, stopConditions: { ...strings, minItems: 1 }, expectedEvidence: { ...strings, minItems: 1 }, budget: researchUsageSchema }, required: ["kind", "description", "rationale", "targets", "successConditions", "stopConditions", "expectedEvidence", "budget"], additionalProperties: false };
const missionReplayProps = {
  operation: { type: "string", enum: ["start-skill", "create-root", "branch", "reevaluate-research-decision"] },
  skill: { type: "string", enum: DOVE_RESEARCH_SKILL_IDS, description: "The directly invoked public research Skill. The Slash invocation itself authorizes creation of this one bounded Skill Mission." },
  contextArtifactPaths: { ...strings, description: "Optional canonical project-relative artifact paths that all have the same current Mission owner. They may identify that owner as the parent when no explicit parentMissionNumber is supplied." },
  missionNumber: { ...publicNumber, description: "Exact one-based mission number shown by query_dove_status for work to reevaluate." },
  missionGoal: { type: "string", minLength: 1, description: "Optional exact visible goal confirming the mission selected by missionNumber; approximate matches are not used." },
  mode: missionMode,
  goal: { type: "string", minLength: 1 },
  ...missionContractProps,
  dependsOnMissionNumbers: { type: "array", items: publicNumber },
  parentMissionNumber: { ...publicNumber, description: "Optional exact one-based public parent hint shown by query_dove_status. It is never replaced by an implicit latest-Mission selection." },
  branchKind: { type: "string", enum: ["continuation", "alternative", "follow-up", "recovery"] },
  branchReason: { type: "string", minLength: 1 },
  stopParentReason: { type: "string", minLength: 1 },
  handoffArtifactPaths: strings,
  requestedDisposition: { type: "string", enum: ["continue", "stop-satisfied", "stop-low-return", "stop-budget", "reject", "block-needs-user"] },
  synthesis: { type: "string", minLength: 1 },
  hypotheses: { type: "array", items: publicHypothesisSchema },
  routes: { type: "array", items: publicRouteSchema },
  openQuestions: { type: "array", items: publicOpenQuestionSchema },
  evidenceRefs: { ...strings, description: "Current source, artifact, or validation references; use actual evidence rather than expected-evidence labels." },
  reasonCodes: { type: "array", items: safeId },
  nextAction: { anyOf: [publicResearchActionSchema, { type: "null" }] }
};
const receiptArtifactSchema = { type: "object", properties: { path: { type: "string" }, kind: { type: "string" }, sha256: { type: "string", pattern: "^[0-9a-f]{64}$" } }, required: ["path", "kind", "sha256"], additionalProperties: false };
const receiptValidationSchema = { type: "object", properties: { kind: { type: "string", enum: ["test-log", "typecheck-log", "lint-log", "build-log", "audit-log", "validation-log", "command-output"] }, result: { type: "string", enum: ["passed", "failed", "incomplete"] }, level: { type: "string", enum: ["static", "unit", "contract", "integration", "e2e"] }, producerKind: { type: "string", enum: ["host-observed"] }, producerOperation: { type: "string", const: "ingest-execution-receipt" }, observedExitStatus: { anyOf: [{ type: "integer", minimum: 0, maximum: 255 }, { type: "null" }] }, targetReference: { type: "string", pattern: "^(artifact|validation):.+" }, targetHash: { type: "string", pattern: "^[0-9a-f]{64}$" }, reference: { type: "string" }, outputHash: { type: "string", pattern: "^[0-9a-f]{64}$" } }, required: ["kind", "result", "level", "producerKind", "producerOperation", "observedExitStatus", "targetReference", "targetHash", "reference", "outputHash"], additionalProperties: false };
const hostFactSchema = { type: "object", properties: { statement: { type: "string", minLength: 1 }, criterionNumbers: { type: "array", items: publicNumber } }, required: ["statement", "criterionNumbers"], additionalProperties: false };
const experimentEvidenceSchema = { type: "object", properties: { experimentId: safeId, metric: { type: "string", minLength: 1 }, value: { type: "number" }, comparison: { type: ["string", "null"] } }, required: ["experimentId", "metric", "value", "comparison"], additionalProperties: false };
const claimContractProps = { experimentEvidence: { type: "array", items: experimentEvidenceSchema }, uncertainty: strings, unsupportedExtensions: strings, currentAssessment: { type: "string", enum: ["supported", "weakened", "refuted", "inconclusive", "blocked"] } };
const experimentProtocolSchema = { type: "object", properties: { question: { type: "string", minLength: 1 }, hypothesis: { type: "string", minLength: 1 }, procedure: { ...strings, minItems: 1 }, inputs: { ...strings, minItems: 1 }, comparisons: strings, metrics: { ...strings, minItems: 1 }, successConditions: { ...strings, minItems: 1 }, stopConditions: { ...strings, minItems: 1 }, constraints: strings, expectedArtifacts: { ...strings, minItems: 1 }, frozenAt: { type: "string", minLength: 1 } }, required: ["question", "hypothesis", "procedure", "inputs", "comparisons", "metrics", "successConditions", "stopConditions", "constraints", "expectedArtifacts", "frozenAt"], additionalProperties: false };
const experimentResultSchema = { type: "object", properties: { status: { type: "string", enum: ["completed", "stopped", "failed", "blocked"] }, outcome: { type: "string", minLength: 1 }, measurements: { type: "array", items: { type: "object", properties: { metric: { type: "string", minLength: 1 }, value: { type: "number" }, comparison: { type: ["string", "null"] } }, required: ["metric", "value", "comparison"], additionalProperties: false } }, artifactRefs: strings, validationRefs: strings, denominator: { type: "object", properties: Object.fromEntries(["total", "successful", "failed", "excluded"].map((field) => [field, { type: "integer", minimum: 0 }])), required: ["total", "successful", "failed", "excluded"], additionalProperties: false }, failures: { type: "array", items: { type: "object", properties: { failureId: safeId, count: { type: "integer", minimum: 1 }, reason: { type: "string", minLength: 1 }, evidenceRefs: strings }, required: ["failureId", "count", "reason", "evidenceRefs"], additionalProperties: false } }, deviations: strings, limitations: { ...strings, minItems: 1 }, recordedAt: { type: "string", minLength: 1 } }, required: ["status", "outcome", "measurements", "artifactRefs", "validationRefs", "denominator", "failures", "deviations", "limitations", "recordedAt"], additionalProperties: false };
const archiveProps = { missionNumber: publicNumber, artifactPath: { type: "string", minLength: 1 }, referencePaths: strings, qa: strings, findings: strings };
const reviewSnapshotSchema = { type: "object", properties: { path: { type: "string", minLength: 1 }, sizeBytes: { type: "integer", minimum: 1 }, sha256: { type: "string", pattern: "^[0-9a-f]{64}$" } }, required: ["path", "sizeBytes", "sha256"], additionalProperties: false };
const reviewScopeBindingSchema = { type: "object", properties: { schemaVersion: { type: "integer", const: 1 }, missionId: safeId, contractDigest: { type: "string", pattern: "^[0-9a-f]{64}$" }, reviewMissionBinding: { type: "string", pattern: "^review-mission-v1-[0-9a-f]{64}$" }, hostKind: { type: "string", enum: ["claude", "opencode"] }, reviewedArtifacts: { type: "array", minItems: 1, items: reviewSnapshotSchema }, reviewedArtifactSetSha256: { type: "string", pattern: "^[0-9a-f]{64}$" } }, required: ["schemaVersion", "missionId", "contractDigest", "reviewMissionBinding", "hostKind", "reviewedArtifacts", "reviewedArtifactSetSha256"], additionalProperties: false };
const reviewFindingSchema = { type: "object", properties: { findingId: safeId, severity: { type: "string", enum: ["low", "medium", "high"] }, summary: { type: "string", minLength: 1 }, linkedArtifactPaths: { ...strings, minItems: 1 } }, required: ["findingId", "severity", "summary", "linkedArtifactPaths"], additionalProperties: false };
const reviewProvenanceSchema = { type: "object", properties: { hostKind: { type: "string", enum: ["claude", "opencode"] }, reviewedAt: researchOutcomeTimestamp, provider: { type: "string", minLength: 1 }, model: { type: "string", minLength: 1 } }, required: ["hostKind", "reviewedAt"], additionalProperties: false };
const receiptCriterionSchema = { type: "object", properties: { criterionId: { type: "string" }, evidenceRefs: strings }, required: ["criterionId", "evidenceRefs"], additionalProperties: false };
function defineTool(name, description, properties, required = []) {
  return { name, description, inputSchema: { type: "object", properties, required, additionalProperties: false } };
}
const workspaceOperationSchemas = [
  { properties: { operation: { const: "set-mainline" } }, required: ["operation", "projectBrief", "mainline"], not: { anyOf: [{ required: ["changeReason"] }, { required: ["archiveReset"] }] } },
  { properties: { operation: { const: "initialize" } }, required: ["operation", "mainline"], not: { anyOf: [{ required: ["changeReason"] }, { required: ["archiveReset"] }] } },
  { properties: { operation: { const: "initialize" }, archiveReset: { const: true } }, required: ["operation", "mainline", "archiveReset"], not: { required: ["changeReason"] } }
];

function workspaceMutationTool() {
  return defineTool(
    "manage_dove_workspace",
    "Set the current project research mainline immediately for an explicit /dove:workspace request, preserving prior revisions when replacing it. Also supports explicit archive reset for unsupported workspace state.",
    {
      operation: { type: "string", enum: ["set-mainline", "initialize"], description: "Use set-mainline with mainline for the ordinary command; it initializes an absent workspace or revises a current one without confirmation. Initialize without archiveReset is the lower-level confirmed initialization surface; initialize with archiveReset=true archives unsupported state before creating a current workspace." },
      projectBrief: { type: "string", minLength: 1, maxLength: 1000, description: "Required for set-mainline. One brief user-visible prose introduction to the project's overall situation and structure; do not include evidence, risk, or choice lists." },
      mainline: { type: "string", minLength: 1, maxLength: 240, pattern: "^[^\\r\\n]+$", description: "Required for set-mainline and archive reset. For set-mainline, use one concise title-like line." },
      changeReason: { type: "string", minLength: 1, description: "Not accepted on the ordinary set-mainline surface; Dove records a service-owned revision reason." },
      archiveReset: { type: "boolean", description: "Set to true only with initialize when explicitly archiving an unsupported workspace before replacement." }
    }
  );
}

const researchDecisionFields = ["requestedDisposition", "synthesis", "hypotheses", "routes", "openQuestions", "evidenceRefs", "reasonCodes", "nextAction"];
const skillStartOnlyFields = ["skill", "contextArtifactPaths"];
const missionCreationFields = ["mode", "goal", "requirements", "assumptions", "scope", "outOfScope", "artifacts", "completionCriteria", "evidenceRequirements", "dependsOnMissionNumbers"];
const missionOperationSchemas = [
  {
    properties: { operation: { const: "start-skill" } },
    required: ["operation", "skill", "goal"],
    not: { anyOf: ["missionNumber", "missionGoal", "mode", "dependsOnMissionNumbers", "branchKind", "branchReason", "stopParentReason", "handoffArtifactPaths", ...researchDecisionFields].map((field) => ({ required: [field] })) }
  },
  {
    properties: { operation: { const: "reevaluate-research-decision" } },
    required: ["operation", "missionNumber", ...researchDecisionFields],
    not: { anyOf: [...missionCreationFields, "parentMissionNumber", ...skillStartOnlyFields, "branchKind", "branchReason", "stopParentReason", "handoffArtifactPaths"].map((field) => ({ required: [field] })) }
  },
  {
    properties: { operation: { const: "create-root" } },
    required: ["operation", "mode", "goal"],
    not: { anyOf: ["missionNumber", "missionGoal", "parentMissionNumber", ...skillStartOnlyFields, "branchKind", "branchReason", "stopParentReason", "handoffArtifactPaths", ...researchDecisionFields].map((field) => ({ required: [field] })) }
  },
  {
    properties: { operation: { const: "branch" } },
    required: ["operation", "mode", "goal", "parentMissionNumber", "branchKind", "branchReason"],
    not: { anyOf: ["missionNumber", "missionGoal", ...skillStartOnlyFields, ...researchDecisionFields].map((field) => ({ required: [field] })) }
  }
];

function missionMutationTool() {
  return defineTool(
    "create_dove_mission",
    "Create a root or child mission with explicit mode, or append one evidence-bound reevaluation to an existing research mission selected by its exact one-based mission number from query_dove_status. Use research when work changes research understanding, experiments, evidence, or paper claims; use ordinary for clear code, documentation, configuration, cleanup, or another bounded deliverable.",
    missionReplayProps
  );
}

export const toolDiscoveryInputSchema = { type: "object", properties: {}, additionalProperties: false };

const operationSchemaParts = [
  workspaceMutationTool(),
  missionMutationTool(),
  defineTool("create_ambient_dove_mission", "Create one focused mission with explicit mode. Research changes understanding, experiments, evidence, or paper claims; ordinary covers clear code, documentation, configuration, cleanup, or another bounded deliverable. Both must align with the current Workspace mainline. If supplied, evidenceRequirements entries use artifact:<path> or validation:<path>.", ambientMissionProps, ["mode", "goal", "mainlineAlignment", "changesWorkspaceMainline"]),
  defineTool("query_dove_mission", "Preview a proposed mission with explicit ordinary or research mode, requirements, scope, artifacts, completion conditions, evidence needs, and optional parent mission.", { mode: missionMode, goal: { type: "string", minLength: 1 }, ...missionContractProps, dependsOnMissionNumbers: { type: "array", items: publicNumber }, parentMissionNumber: publicNumber, branchKind: { type: "string", enum: ["continuation", "alternative", "follow-up", "recovery"] }, branchReason: { type: "string", minLength: 1 } }, ["mode", "goal"]),
  defineTool("query_dove_status", "Review current missions, requirements, research, outputs, evidence, reviews, and remaining gaps. Use missionNumber for details about one exact mission shown in status.", { missionNumber: publicNumber, detail: { type: "string", enum: ["compact", "full"] }, language: { type: "string", enum: ["zh", "en"] } }),
  defineTool("ingest_execution_receipt", "Add supplied outputs, checks, and completion evidence to one mission.", { receiptId: safeId, missionNumber: publicNumber, contractDigest: { type: "string", pattern: "^[0-9a-f]{64}$" }, summary: { type: "string", minLength: 1 }, artifacts: { type: "array", minItems: 1, items: receiptArtifactSchema }, validations: { type: "array", items: receiptValidationSchema }, criteriaSatisfied: { type: "array", items: receiptCriterionSchema }, producedAt: { type: "string", minLength: 1 } }, ["receiptId", "missionNumber", "contractDigest", "summary", "artifacts", "validations", "criteriaSatisfied", "producedAt"]),
  defineTool("close_host_outcome", "Record one explicitly identified attempt at ordinary work. Include substantive files when produced, or concrete execution facts explicitly bound to current completion criteria for a no-file outcome. Reusing the same attemptId is an exact immutable replay; use a new attemptId for a later retry.", { missionNumber: publicNumber, attemptId: safeId, status: { type: "string", enum: ["completed", "stopped", "blocked", "failed"] }, summary: { type: "string", minLength: 1 }, artifactPaths: { ...strings, description: "Optional substantive files produced or changed by the work." }, validationPaths: { ...strings, description: "Optional separate host-observed validation output files. Omit this field for in-place checks, and never repeat an artifactPaths entry. These are recorded as incomplete static observations and cannot substitute for independent review." }, facts: { type: "array", items: hostFactSchema, description: "Concrete execution observations with explicit one-based completion-criterion bindings. Required when artifactPaths is empty; do not use scientific conclusions." } }, ["missionNumber", "attemptId", "status", "summary"]),
  defineTool("record_research_outcome", "Record one explicitly identified research execution attempt as a single immutable receipt. The current research decision remains unchanged and must later consume the receipt through research reevaluation. This tool records execution facts only and does not interpret hypotheses, routes, or claims.", { missionNumber: publicNumber, decisionRevision: publicNumber, attemptId: safeId, status: { type: "string", enum: ["completed", "stopped", "aborted", "blocked", "failed"] }, performedActionCount: { type: "integer", minimum: 0 }, actualUsage: { ...researchUsageSchema, description: "Report non-negative integer usage within the closure request budget; actions must equal performedActionCount." }, evidenceReturned: { ...strings, description: "Use only the expected-evidence labels from the current closure request." }, artifactPaths: { ...strings, description: "Existing non-empty project-relative files produced or used as substantive returned artifacts." }, validationPaths: { ...strings, description: "Existing non-empty project-relative files containing separate validation output; do not repeat artifactPaths entries." }, facts: { ...strings, description: "Concrete execution observations only, one string per fact. Do not report scientific conclusions or encode evidence labels here." }, startedAt: { ...researchOutcomeTimestamp, description: "ISO-8601 UTC execution start within the current closure request time window." }, finishedAt: { ...researchOutcomeTimestamp, description: "ISO-8601 UTC execution finish within the current closure request time window and not before startedAt." } }, ["missionNumber", "decisionRevision", "attemptId", "status", "performedActionCount", "actualUsage", "evidenceReturned", "artifactPaths", "validationPaths", "facts", "startedAt", "finishedAt"]),
  defineTool("assess_mission_completion", "Check whether one mission meets its stated outputs, completion conditions, evidence needs, dependencies, and review requirements.", { missionNumber: publicNumber }, ["missionNumber"]),
  defineTool("query_sources", "Review source candidates or rejections for one mission and whether they are currently usable.", { missionNumber: publicNumber, sourceId: safeId, lifecycle: { type: "string", enum: ["candidate", "rejected"] }, limit: { type: "number" } }, ["missionNumber"]),
  defineTool("read_dove_lessons", "Read the complete canonical advisory Lessons Markdown document without writing.", {}),
  defineTool("update_dove_lessons", "Replace the complete canonical advisory Lessons Markdown document using the exact binding from a preceding read. Lessons are not evidence, scientific endorsement, or completion proof.", lessonsUpdateProps, ["binding", "markdown"]),
  defineTool("register_source", "Add a source candidate to one mission from real captured external material. Registration does not verify the source.", { missionNumber: publicNumber, sourceId: safeId, citationKey: { type: "string" }, title: { type: "string" }, authors: strings, year: { type: ["string", "number"] }, locator: { type: "string" }, sourceType: { type: "string" }, abstract: { type: "string" }, origin: { type: "string" }, capturePath: { type: "string", minLength: 1 } }, ["missionNumber", "sourceId", "capturePath"]),
  defineTool("verify_source", "Record why a source candidate must be rejected for one mission. This tool does not approve sources.", { missionNumber: publicNumber, sourceId: safeId, method: { type: "string", minLength: 1 }, checkedMaterial: { type: "string", minLength: 1 }, auditEvidence: { type: "array", minItems: 1, items: { type: "object", properties: { reference: { type: "string", minLength: 1 }, kind: { type: "string", minLength: 1 }, observation: { type: "string", minLength: 1 } }, required: ["reference", "kind", "observation"], additionalProperties: false } } }, ["missionNumber", "sourceId", "method", "checkedMaterial", "auditEvidence"]),
  defineTool("upsert_claims", "Record bounded claims using current Source, artifact, validation, or optional exact Experiment measurement evidence.", { missionNumber: publicNumber, claims: { type: "array", minItems: 1, items: { type: "object", properties: { claimId: safeId, text: { type: "string", minLength: 1 }, sourceIds: { type: "array", items: safeId }, artifactRefs: strings, validationRefs: strings, ...claimContractProps }, required: ["claimId", "text", "sourceIds", "artifactRefs", "validationRefs", ...Object.keys(claimContractProps)], additionalProperties: false } } }, ["missionNumber", "claims"]),
  defineTool("run_experience_workflow", "Freeze a general formal Experiment protocol, then record its immutable result with measurements, references, denominator, failures, deviations, and limitations. This endpoint does not run experiments or establish independent scientific endorsement.", { missionNumber: publicNumber, experimentId: safeId, title: { type: "string" }, protocol: experimentProtocolSchema, result: experimentResultSchema }, ["missionNumber", "experimentId", "protocol"]),
  defineTool("record_draft_archive", "Archive one current mission-owned project draft and its current references while keeping the substantive project artifact in place.", archiveProps, ["missionNumber", "artifactPath", "referencePaths", "qa", "findings"]),
  defineTool("record_figure_archive", "Archive one current mission-owned project figure, caption, references, QA, and findings while keeping the project artifact in place and without requiring Review coverage.", { ...archiveProps, caption: { type: "string", minLength: 1 } }, ["missionNumber", "artifactPath", "referencePaths", "qa", "findings", "caption"]),
  defineTool("scope_review_record", "Freeze an explicit current mission-readable artifact scope without writing, then return a machine-only request for one dedicated native Reviewer launch.", { missionNumber: publicNumber, reviewMissionBinding: { type: "string", pattern: "^review-mission-v1-[0-9a-f]{64}$", description: "Pass the exact opaque binding from the Review Skill start hostControl." }, hostKind: { type: "string", enum: ["claude", "opencode"] }, artifactPaths: { ...strings, minItems: 1 } }, ["missionNumber", "reviewMissionBinding", "hostKind", "artifactPaths"]),
  defineTool("archive_review_record", "Atomically archive one dedicated Reviewer's structured return for the exact frozen scope. The record is non-authoritative and its id is derived by Dove.", { missionNumber: publicNumber, scopeBinding: reviewScopeBindingSchema, status: { type: "string", enum: ["completed", "blocked", "failed"] }, verdict: { type: "string", enum: ["coherent", "needs-revision", "needs-evidence", "blocked"] }, summary: { type: "string", minLength: 1 }, findings: { type: "array", items: reviewFindingSchema }, actionItems: strings, report: { type: "string", minLength: 1 }, provenance: reviewProvenanceSchema }, ["missionNumber", "scopeBinding", "status", "verdict", "summary", "findings", "actionItems", "report", "provenance"]),
  defineTool("record_rebuttal_archive", "Archive one current mission-owned project rebuttal and preserved current finding references while keeping the project artifact in place and without claiming Reviewer agreement.", { ...archiveProps, findingRefs: { ...strings, minItems: 1 } }, ["missionNumber", "artifactPath", "referencePaths", "qa", "findings", "findingRefs"]),
];

const schemaPartByName = new Map(operationSchemaParts.map((tool) => [tool.name, tool]));

function schemaPart(name) {
  const part = schemaPartByName.get(name);
  if (!part) throw new Error(`Unknown internal operation schema part: ${name}`);
  return part;
}

function mergedProperties(names, operationValues = []) {
  return {
    ...Object.assign({}, ...names.map((name) => schemaPart(name).inputSchema.properties)),
    ...(operationValues.length > 0 ? { operation: { type: "string", enum: operationValues } } : {})
  };
}

function operationBranch(operation, required, allowed, allFields) {
  const forbidden = allFields.filter((field) => field !== "operation" && !allowed.includes(field));
  return {
    properties: { operation: { const: operation } },
    required: ["operation", ...required],
    ...(forbidden.length > 0 ? { not: { anyOf: forbidden.map((field) => ({ required: [field] })) } } : {})
  };
}

function canonicalTool(name, description, sourceNames, operations = null) {
  const properties = mergedProperties(sourceNames, operations?.map((entry) => entry.operation) ?? []);
  return defineTool(name, description, properties, operations ? [] : schemaPart(sourceNames[0]).inputSchema.required);
}

const missionPreviewFields = ["mode", "goal", ...Object.keys(missionContractProps), "dependsOnMissionNumbers", "parentMissionNumber", "branchKind", "branchReason"];
const missionAllFields = Object.keys({ operation: true, ...missionReplayProps });
const missionCanonicalSchemas = [
  operationBranch("query", ["mode", "goal"], missionPreviewFields, missionAllFields),
  ...missionOperationSchemas
];
const statusFields = ["missionNumber", "detail", "language"];
const sourceQueryFields = ["missionNumber", "sourceId", "lifecycle", "limit"];
const sourceRegisterFields = Object.keys(schemaPart("register_source").inputSchema.properties);
const sourceRejectFields = Object.keys(schemaPart("verify_source").inputSchema.properties);
const lessonReadFields = Object.keys(schemaPart("read_dove_lessons").inputSchema.properties);
const lessonUpdateFields = Object.keys(lessonsUpdateProps);
const reviewScopeFields = Object.keys(schemaPart("scope_review_record").inputSchema.properties);
const reviewArchiveFields = Object.keys(schemaPart("archive_review_record").inputSchema.properties);

export const toolDefinitions = [
  workspaceMutationTool(),
  canonicalTool("manage_dove_mission", "Query, start one directly invoked research Skill, create, branch, or reevaluate one Dove mission. Creation uses explicit mode: research covers changed understanding, experiments, evidence, or paper claims; ordinary covers code, documentation, configuration, cleanup, or another bounded deliverable. A Slash Skill start is directly authorized and creates a server-owned root or ordinary child without stopping its parent; explicit branch retains its stop and handoff behavior. Existing-work reevaluation uses the exact one-based mission number from query_dove_status.", ["create_dove_mission", "query_dove_mission"], missionCanonicalSchemas.map((schema, index) => ({ operation: ["query", "start-skill", "reevaluate-research-decision", "create-root", "branch"][index], schema }))),
  canonicalTool("query_dove_status", "Review current missions, requirements, research, outputs, evidence, reviews, and remaining gaps, or assess completion for one exact mission. Use missionNumber only for details about one mission shown in status.", ["query_dove_status", "assess_mission_completion"], [{ operation: "status" }, { operation: "completion" }]),
  canonicalTool("manage_dove_sources", "Query, register, or reject mission-bound captured source material. Registration creates a candidate; rejection never mints positive trust.", ["query_sources", "register_source", "verify_source"], [{ operation: "query" }, { operation: "register" }, { operation: "reject" }]),
  canonicalTool("record_dove_experiment", "Freeze a general formal experiment protocol or record its evidence-backed immutable result with measurements, the full denominator, failures, deviations, and limitations. This endpoint does not run experiments or substitute for independent review.", ["run_experience_workflow"]),
  canonicalTool("record_dove_claims", "Record bounded claims using current Source, artifact, validation, or optional exact Experiment measurement evidence.", ["upsert_claims"]),
  canonicalTool("record_dove_draft", "Archive a current mission-owned project draft and references while keeping the substantive project artifact in place.", ["record_draft_archive"]),
  canonicalTool("record_dove_figure", "Archive a current mission-owned project figure with caption, references, QA, and findings while keeping the project artifact in place and without requiring Review coverage.", ["record_figure_archive"]),
  canonicalTool("manage_dove_review", "Scope one exact frozen artifact boundary without writing, or atomically archive the structured return from one dedicated native fresh read-only Reviewer. Dove does not establish reviewer identity, authority, sign-off, or acceptance.", ["scope_review_record", "archive_review_record"], [{ operation: "scope" }, { operation: "archive" }]),
  canonicalTool("record_dove_rebuttal", "Archive a current mission-owned project rebuttal with preserved current findings and no claim of Reviewer agreement.", ["record_rebuttal_archive"]),
  canonicalTool("manage_dove_lessons", "Read or replace the complete canonical advisory Lessons Markdown document. Update requires the exact binding from a preceding read and does not create a Mission.", ["read_dove_lessons", "update_dove_lessons"], [{ operation: "read" }, { operation: "update" }]),
  schemaPart("create_ambient_dove_mission"),
  schemaPart("close_host_outcome"),
  schemaPart("record_research_outcome")
];

const operationSchemasByTool = new Map([
  ["manage_dove_workspace", workspaceOperationSchemas],
  ["manage_dove_mission", missionCanonicalSchemas],
  ["query_dove_status", [
    operationBranch("status", [], statusFields, ["operation", ...statusFields]),
    operationBranch("completion", ["missionNumber"], ["missionNumber"], ["operation", ...statusFields])
  ]],
  ["manage_dove_sources", [
    operationBranch("query", ["missionNumber"], sourceQueryFields, ["operation", ...new Set([...sourceQueryFields, ...sourceRegisterFields, ...sourceRejectFields])]),
    operationBranch("register", ["missionNumber", "sourceId", "capturePath"], sourceRegisterFields, ["operation", ...new Set([...sourceQueryFields, ...sourceRegisterFields, ...sourceRejectFields])]),
    operationBranch("reject", ["missionNumber", "sourceId", "method", "checkedMaterial", "auditEvidence"], sourceRejectFields, ["operation", ...new Set([...sourceQueryFields, ...sourceRegisterFields, ...sourceRejectFields])])
  ]],
  ["manage_dove_review", [
    operationBranch("scope", ["missionNumber", "reviewMissionBinding", "hostKind", "artifactPaths"], reviewScopeFields, ["operation", ...new Set([...reviewScopeFields, ...reviewArchiveFields])]),
    operationBranch("archive", ["missionNumber", "scopeBinding", "status", "verdict", "summary", "findings", "actionItems", "report", "provenance"], reviewArchiveFields, ["operation", ...new Set([...reviewScopeFields, ...reviewArchiveFields])])
  ]],
  ["manage_dove_lessons", [
    operationBranch("read", [], lessonReadFields, ["operation", ...lessonUpdateFields]),
    operationBranch("update", ["binding", "markdown"], lessonUpdateFields, ["operation", ...lessonUpdateFields])
  ]]
]);

export const TOOL_OPERATION_SCHEMAS = operationSchemasByTool;
export const TOOL_INPUT_SCHEMAS = new Map(toolDefinitions.map((tool) => [tool.name, tool.inputSchema]));
