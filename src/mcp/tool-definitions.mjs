const id = { type: "string", pattern: "^[a-z0-9][a-z0-9._-]{0,127}$" };
const text = { type: "string", minLength: 1 };
const strings = { type: "array", items: text };
const object = { type: "object", additionalProperties: true };

const language = { type: "string", enum: ["zh", "en"] };

function tool(name, description, properties, required = []) {
  return { name, description, inputSchema: { type: "object", properties: { ...properties, language }, required, additionalProperties: false } };
}

const reviewReturn = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["completed", "blocked", "failed"] },
    verdict: text,
    summary: text,
    rubric: { ...strings, minItems: 1 },
    findings: { type: "array", items: object },
    actionItems: strings,
    report: text,
    provenance: object,
    limitations: strings,
    reviewedAt: text
  },
  required: ["status", "verdict", "summary", "rubric", "findings", "actionItems", "report", "provenance", "limitations", "reviewedAt"],
  additionalProperties: false
};

export const toolDefinitions = [
  tool("query_dove_research", "Read one zero-write research projection by semantic identifiers.", {
    operation: { type: "string", enum: ["overview", "diagnosis", "related-work", "hypotheses", "experiment-options", "result-synthesis", "claim-story", "branch-synthesis", "reviews"] },
    missionId: id,
    branchMissionIds: { type: "array", items: id }
  }, ["operation"]),
  tool("manage_dove_workspace", "Initialize or update the current research direction without a revision ledger.", {
    operation: { type: "string", enum: ["initialize", "set-mainline"] },
    researchQuestion: text,
    mainline: text,
    contributionIntent: text,
    currentFocus: text,
    changeReason: text
  }, ["operation", "researchQuestion", "mainline", "contributionIntent", "currentFocus"]),
  tool("manage_dove_missions", "Query, create, branch, or conclude immutable research Missions using semantic identifiers.", {
    operation: { type: "string", enum: ["query", "create", "branch", "conclude"] },
    missionId: id,
    parentMissionId: id,
    dependsOnMissionIds: { type: "array", items: id },
    branchKind: text,
    branchReason: text,
    goal: text,
    requirements: strings,
    assumptions: strings,
    scope: strings,
    outOfScope: strings,
    evidenceRequirements: strings,
    competingHypotheses: strings,
    openQuestions: strings,
    contextRefs: strings,
    contributionRole: text,
    synthesis: text,
    failures: strings,
    limitations: strings,
    uncertainty: strings,
    sourceIds: { type: "array", items: id },
    experimentIds: { type: "array", items: id },
    claimIds: { type: "array", items: id },
    recommendedBranches: strings
  }, ["operation"]),
  tool("manage_dove_sources", "Query or record captured Source material and its related-work relationship.", {
    operation: { type: "string", enum: ["query", "record"] },
    missionId: id,
    sourceId: id,
    citationKey: { type: ["string", "null"] },
    title: { type: ["string", "null"] },
    authors: strings,
    year: { type: ["string", "number", "null"] },
    locator: { type: ["string", "null"] },
    sourceType: { type: ["string", "null"] },
    summary: text,
    conditions: strings,
    relationship: { type: "string", enum: ["consensus", "conflict", "condition-specific", "uncovered", "testable-gap"] },
    conflicts: strings,
    limitations: strings,
    capturePath: { type: ["string", "null"] },
    recordedAt: text
  }, ["operation", "missionId"]),
  tool("manage_dove_experiments", "Query, freeze, or record Experiment plans and full results. Dove does not execute experiments.", {
    operation: { type: "string", enum: ["query", "freeze", "record-result"] },
    view: { type: "string", enum: ["hypotheses", "experiment-options", "result-synthesis"] },
    missionId: id,
    experimentId: id,
    title: text,
    hypothesisRefs: strings,
    protocol: strings,
    inputs: strings,
    comparisons: strings,
    metrics: strings,
    discriminatingObservations: strings,
    successConditions: strings,
    stopConditions: strings,
    constraints: strings,
    expectedArtifacts: strings,
    cost: text,
    risk: text,
    failureValue: text,
    contributionRole: text,
    plannedAt: text,
    kind: { type: "string", enum: ["positive", "negative", "null", "mixed", "failed", "stopped"] },
    summary: text,
    observations: strings,
    measurements: { type: "array", items: object },
    denominator: object,
    hypothesisImpacts: { type: "array", items: object },
    claimImpacts: { type: "array", items: object },
    unexpectedObservations: strings,
    uncertainty: strings,
    artifactRefs: strings,
    failures: strings,
    deviations: strings,
    limitations: strings,
    recordedAt: text
  }, ["operation", "missionId"]),
  tool("manage_dove_claims", "Query or record Claims with support, counter-evidence, missing evidence, and explicit cannot-say boundaries.", {
    operation: { type: "string", enum: ["query", "record"] },
    missionId: id,
    claims: { type: "array", minItems: 1, items: {
      type: "object",
      properties: {
        claimId: id,
        statement: text,
        supportRefs: { ...strings, minItems: 1 },
        counterEvidenceRefs: strings,
        missingEvidence: strings,
        cannotSay: { ...strings, minItems: 1 },
        uncertainty: strings,
        assessment: { type: "string", enum: ["supported", "weakened", "refuted", "inconclusive", "blocked"] },
        storyRole: text,
        artifactRefs: strings,
        recordedAt: text
      },
      required: ["statement", "supportRefs", "counterEvidenceRefs", "missingEvidence", "cannotSay", "uncertainty", "assessment", "storyRole", "artifactRefs"],
      additionalProperties: false
    } }
  }, ["operation", "missionId"]),
  tool("manage_dove_reviews", "Run a user-managed review exchange: local-preflight, prepare, import, or coverage. Dove never launches a reviewer.", {
    operation: { type: "string", enum: ["local-preflight", "prepare", "import", "coverage"] },
    missionId: id,
    exchangeId: id,
    reviewId: id,
    artifactPaths: strings,
    review: reviewReturn
  }, ["operation", "missionId"]),
  tool("manage_dove_lessons", "Read or replace the complete advisory Lessons Markdown without creating a Mission.", {
    operation: { type: "string", enum: ["read", "replace"] },
    markdown: text
  }, ["operation"])
];

export const toolDiscoveryInputSchema = { type: "object", properties: {}, additionalProperties: false };
export const TOOL_INPUT_SCHEMAS = new Map(toolDefinitions.map((item) => [item.name, item.inputSchema]));
export const TOOL_OPERATION_SCHEMAS = new Map();
