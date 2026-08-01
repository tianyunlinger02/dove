import test from "node:test";
import assert from "node:assert/strict";

import { operationForTool } from "../../src/core/operation-registry.mjs";
import { classifyInvocationOutcome } from "../../src/core/operational-outcome.mjs";
import { publicErrorMessage, publicResult as createPublicEnvelope, renderPublicReport } from "../../src/core/public-reports.mjs";
import { toolDefinitions } from "../../src/mcp/tool-definitions.mjs";

const INTERNAL_TEXT = /\.dove\/|\/home\/|\b[0-9a-f]{64}\b|\b(?:workspaceId|contractDigest|receiptId|criterionId|actionId|decisionId|envelopeId|seal|ledgerSequence|proposalDigest|proposalToken|confirmArgs|exactReplay|mutationMode|MutationContext)\b|\bthe selected (?:item|path)\b/iu;
const INTERNAL_KEYS = /^(?:workspaceId|missionId|sourceId|claimId|experimentId|figureId|reviewId|exchangeId|lessonId|receiptId|criterionId|actionId|decisionId|envelopeId|seal|ledgerSequence|contractDigest|sha256|.*Sha256|.*Digest|.*Token|confirmation|mutation|diagnostics|writes|paths)$/u;

function assertPublic(value, location = "root") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertPublic(item, `${location}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      assert.doesNotMatch(key, INTERNAL_KEYS, `${location} leaked ${key}`);
      assertPublic(item, `${location}.${key}`);
    }
    return;
  }
  if (typeof value === "string") assert.doesNotMatch(value, INTERNAL_TEXT, `${location} leaked ${value}`);
}

const CALLBACK_PROJECTION_OPTIONS = Object.freeze({
  callbackResolvers: Object.freeze({
    missionNumber: () => 2
  })
});

const PROJECTOR_TOOL = Object.freeze({
  create_dove_mission: "manage_dove_mission",
  query_dove_mission: "manage_dove_mission",
  assess_mission_completion: "query_dove_status",
  query_sources: "manage_dove_sources",
  read_dove_lessons: "manage_dove_lessons",
  update_dove_lessons: "manage_dove_lessons",
  register_source: "manage_dove_sources",
  verify_source: "manage_dove_sources",
  upsert_claims: "record_dove_claims",
  run_experience_workflow: "record_dove_experiment",
  record_draft_archive: "record_dove_draft",
  record_figure_archive: "record_dove_figure",
  scope_review_record: "manage_dove_review",
  archive_review_record: "manage_dove_review",
  record_rebuttal_archive: "record_dove_rebuttal"
});

function projectorOperation(name) {
  return operationForTool(PROJECTOR_TOOL[name] ?? name);
}

function publicResult(name, data, options = {}) {
  const operation = projectorOperation(name);
  return createPublicEnvelope(name, data, classifyInvocationOutcome(data, operation), { ...CALLBACK_PROJECTION_OPTIONS, operation, ...options }).report;
}

function publicEnvelope(name, data, options = {}) {
  const operation = projectorOperation(name);
  return createPublicEnvelope(name, data, classifyInvocationOutcome(data, operation), { ...CALLBACK_PROJECTION_OPTIONS, operation, ...options });
}

const fixtures = {
  manage_dove_workspace: { status: "initialized", summary: "Initialized workspace-raw-id.", workspaceId: "workspace-raw-id", projectBrief: "This repository contains a sealed Dove core, MCP service, generated host adapters, and focused tests.", workspaceRevision: { mainline: "Evidence-Grounded Research Workflows for Reliable Autonomous Systems" } },
  create_dove_mission: { status: "materialized", summary: "The mission checkpoint is ready.", missionId: "mission-raw-id", mission: { missionId: "mission-raw-id" }, executionHandoff: null, confirmation: { confirmArgs: { missionId: "mission-raw-id", proposalDigest: "b".repeat(64) } }, contractDigest: "a".repeat(64) },
  create_ambient_dove_mission: { status: "materialized", missionId: "mission-ambient-raw-id", mission: { missionId: "mission-ambient-raw-id", mode: "ordinary" }, contractDigest: "a".repeat(64) },
  query_dove_mission: { status: "proposal", mission: { mode: "ordinary", goal: "Write report", requirements: ["Preserve the bounded report scope."], assumptions: [], scope: ["public"], outOfScope: [], artifacts: [{ path: "report.md", required: true, role: "output" }], completionCriteria: [{ criterion: "Report complete" }], evidenceRequirements: [{ requirement: "artifact:report.md" }] } },
  query_dove_status: { status: "ok", detail: "full", summary: "Current schema is healthy.", currentContext: { missionCount: 1, missionScope: "only-mission", receiptCount: 3, sourceCount: 2, integrityAssessment: { status: "incomplete", complete: false, incompleteReasons: ["receipt-schema-invalid"] }, reviewValidity: { authority: "not-established", currentCount: 0, staleCount: 1, failures: ["review-report-stale"] }, narrativeState: "unavailable", narrativeKind: null, researchNarrative: null }, needsAttention: { status: "incomplete", reasons: ["contract-digest-stale"], stableGaps: { completion: ["receipt-schema-invalid"], domain: ["report.md", ".dove/private.json"], review: ["review-receipt-missing"], research: [] } } },
  ingest_execution_receipt: { status: "ingested", receipt: { receiptId: "receipt-raw-id", artifacts: [{ path: "report.md", kind: "report", sha256: "a".repeat(64) }, { path: ".dove/private.json", kind: "data", sha256: "b".repeat(64) }], validations: [{ kind: "test-log", result: "passed", level: "integration", producerKind: "host-observed", producerOperation: "ingest-execution-receipt", observedExitStatus: 0, targetReference: "artifact:report.md", targetHash: "a".repeat(64), reference: "test.log", outputHash: "c".repeat(64) }] }, completion: { assessment: { status: "incomplete", complete: false, incompleteReasons: ["criteria-coverage-missing"], artifactCoverage: [{ path: "report.md", covered: true }], criterionCoverage: [], evidenceRequirements: [], operationalIntegrity: { hostActionReturned: false, receiptRecorded: true, completionEvidenceSatisfied: false, lifecycleClosed: false } } } },
  close_host_outcome: { status: "ingested", outcomeStatus: "completed", outcomeMode: "artifact-backed", receipt: { receiptId: "receipt-host-outcome-raw-id", summary: "The host produced the report.", artifacts: [{ path: "report.md", kind: "other", sha256: "a".repeat(64) }], validations: [{ kind: "validation-log", result: "incomplete", level: "static", producerKind: "host-observed", producerOperation: "close-host-outcome", observedExitStatus: null, targetReference: "artifact:report.md", targetHash: "a".repeat(64), reference: "test.log", outputHash: "c".repeat(64) }], producer: { kind: "public-execution", actionId: "close-host-outcome" }, ordinaryHostOutcome: { mode: "artifact-backed", status: "completed", facts: [{ factId: "fact-111111111111111111111111", statement: "The report file was produced." }], callbackDigest: "d".repeat(64) } }, completion: { assessment: { status: "incomplete", complete: false, incompleteReasons: ["criteria-coverage-missing"], artifactCoverage: [{ path: "report.md", covered: true }], criterionCoverage: [], evidenceRequirements: [], ordinaryHostReturn: { present: true, current: { mode: "artifact-backed", status: "completed", summary: "The host produced the report.", facts: [{ factId: "fact-111111111111111111111111", statement: "The report file was produced." }] }, history: [] }, operationalIntegrity: { hostActionReturned: true, receiptRecorded: true, completionEvidenceSatisfied: false, lifecycleClosed: false } } }, researchNarrative: { researchDirection: "Deliver the bounded report.", currentUnderstanding: ["The requested report has been produced."], evidence: ["The report file is current."], unknowns: ["Independent review remains open."], currentValueJudgment: "The produced report is useful, while one review condition still needs confirmation.", nextStep: "Confirm the remaining review condition.", stopReason: null, rejectedDirections: [], applicableLessons: [] } },
  record_research_outcome: { status: "recorded", accepted: true, evidenceComplete: true, missingRequiredEvidence: [], scopeDeviation: false, scopeDeviationReasons: [], outcomeStatus: "completed", performedActionCount: 1, awaitingReevaluation: true, receipt: { receiptId: "receipt-research-private", artifacts: [{ path: "report.md", kind: "other", sha256: "a".repeat(64) }], validations: [] }, decision: { disposition: "continue" } },
  assess_mission_completion: { status: "incomplete", complete: false, missionId: "mission-raw-id", contractDigest: "a".repeat(64), incompleteReasons: ["execution-receipt-missing"], artifactCoverage: [{ path: "report.md", covered: false, reason: "artifact-current-owner-missing", receiptId: null }], criterionCoverage: [{ criterionId: "criterion-raw-id", criterion: "Write report", covered: false }], evidenceRequirements: [{ requirementId: "requirement-raw-id", requirement: "artifact:report.md", satisfied: false, reason: "required-artifact-not-current" }], operationalIntegrity: { hostActionReturned: false, receiptRecorded: false, completionEvidenceSatisfied: false, lifecycleClosed: false }, diagnostics: { missionPath: ".dove/missions/mission-raw-id.json" } },
  query_sources: { status: "ok", items: [{ sourceId: "source-raw-id", missionId: "mission-raw-id", contractDigest: "a".repeat(64), title: "Source", authors: ["A"], year: 2026, locator: "https://example.org", sourceType: "web", abstract: "Abstract", lifecycle: "candidate", eligibility: { eligible: false, reason: "source-candidate" }, capturedMaterial: { path: ".dove/sources/materials/raw", sha256: "b".repeat(64) } }] },
  read_dove_lessons: { status: "ok", markdown: "# Dove Lessons\n\n## 研究方向与方法\n\n- 保留失败案例。\n", lessonsBinding: "private-opaque-binding", currentHash: "a".repeat(64), zeroWrite: true, advisoryOnly: true, authority: false, completionEligible: false, writes: [] },
  update_dove_lessons: { status: "updated", markdown: "# Dove Lessons\n\n## 研究方向与方法\n\n- 保留失败案例。\n", currentHash: "b".repeat(64), advisoryOnly: true, authority: false, completionEligible: false, mutation: { paths: [".dove/LESSONS.md"] } },
  register_source: { status: "recorded", summary: "Registered source candidate source-raw-id.", source: { sourceId: "source-raw-id", capturedMaterial: { path: ".dove/source" } } },
  verify_source: { status: "recorded", summary: "Rejected source source-raw-id.", source: { sourceId: "source-raw-id" } },
  upsert_claims: { status: "recorded", summary: "Recorded 2 evidence-backed claim(s).", artifacts: [{ path: ".dove/claims/claim-one.json" }] },
  run_experience_workflow: { status: "recorded", summary: "Recorded experiment result.", result: { resultId: "experiment-raw-id", status: "failed", outcome: "Accuracy did not meet the threshold.", denominator: { total: 2, successful: 1, failed: 1, excluded: 0 }, failures: [{ failureId: "failure-one", count: 1, reason: "Invalid output.", evidenceRefs: [] }], deviations: [], limitations: ["One failure remains."], measurements: [], artifactRefs: ["artifact:report.md"], validationRefs: [] } },
  record_draft_archive: { status: "recorded", summary: "Archived project draft.", artifact: { path: "paper/draft.md", kind: "document" }, findings: [], qa: [] },
  record_figure_archive: { status: "recorded", summary: "Archived project figure.", artifact: { path: "figures/result.svg", kind: "figure" }, caption: "Visible caption.", findings: ["Label overlaps."], qa: ["Caption checked."] },
  scope_review_record: { status: "scoped", zeroWrite: true, reviewedArtifactPaths: ["report.md"], scopeBinding: { schemaVersion: 1, missionId: "mission-raw-id", contractDigest: "a".repeat(64), reviewMissionBinding: `review-mission-v1-${"d".repeat(64)}`, hostKind: "claude", reviewedArtifacts: [{ path: "report.md", sizeBytes: 10, sha256: "b".repeat(64) }], reviewedArtifactSetSha256: "c".repeat(64) }, reviewerLaunch: { kind: "native-reviewer", hostKind: "claude", agent: "dove-reviewer", exactlyOnce: true, freshContext: true, readOnly: true, synchronous: true, mcpAgentLaunch: false } },
  archive_review_record: { status: "archived", review: { status: "completed", verdict: "needs-revision", summary: "Strengthen the baseline.", reviewedArtifacts: [{ path: "report.md", sizeBytes: 10, sha256: "b".repeat(64) }], findings: [{ findingId: "finding-raw-id", severity: "high", summary: "Baseline is weak.", linkedArtifactPaths: ["report.md"] }], actionItems: ["Add a baseline."], authority: "not-established" } },
  record_rebuttal_archive: { status: "recorded", summary: "Archived project rebuttal.", artifact: { path: "paper/rebuttal.md", kind: "document" }, findings: ["One issue remains."], qa: [], reviewerSignoff: false }
};

test("public projection covers every canonical MCP tool without internal identifiers or paths", () => {
  const representativeFixture = {
    manage_dove_workspace: "manage_dove_workspace",
    manage_dove_mission: "create_dove_mission",
    query_dove_status: "query_dove_status",
    manage_dove_sources: "query_sources",
    record_dove_experiment: "run_experience_workflow",
    record_dove_claims: "upsert_claims",
    record_dove_draft: "record_draft_archive",
    record_dove_figure: "record_figure_archive",
    manage_dove_review: "archive_review_record",
    record_dove_rebuttal: "record_rebuttal_archive",
    manage_dove_lessons: "read_dove_lessons",
    create_ambient_dove_mission: "create_ambient_dove_mission",
    close_host_outcome: "close_host_outcome",
    record_research_outcome: "record_research_outcome"
  };
  assert.equal(toolDefinitions.length, 14);
  assert.deepEqual(new Set(Object.keys(representativeFixture)), new Set(toolDefinitions.map((tool) => tool.name)));
  for (const tool of toolDefinitions) {
    const fixtureName = representativeFixture[tool.name];
    const envelope = publicEnvelope(fixtureName, fixtures[fixtureName]);
    assert.deepEqual(Object.keys(envelope).sort(), ["hostControl", "report"]);
    assertPublic(envelope.report, `${tool.name}.report`);
    assert.equal(typeof envelope.report.message, "string", `${tool.name} needs a useful message`);
    assert.notEqual(envelope.report.message, "compact", `${tool.name} returned a display mode as its message`);
    assert.notEqual(envelope.report.message, "full", `${tool.name} returned a display mode as its message`);
  }
});

test("Review Skill binding stays machine-only for the exact scope call", () => {
  const binding = `review-mission-v1-${"e".repeat(64)}`;
  const envelope = publicEnvelope("create_dove_mission", {
    status: "materialized",
    operation: "start-skill",
    skill: "review",
    reviewMissionBinding: binding,
    mission: { missionId: "mission-review-private", mode: "research" },
    executionHandoff: null
  });
  assert.equal(envelope.hostControl.reviewMission.binding, binding);
  assert.equal(Object.hasOwn(envelope.report, "reviewMissionBinding"), false);
  assert.doesNotMatch(JSON.stringify(envelope.report), /review-mission-v1/u);
});

test("Lessons projection exposes complete Markdown while keeping binding and hash machine-only", () => {
  const envelope = publicEnvelope("read_dove_lessons", fixtures.read_dove_lessons);
  assert.equal(envelope.report.markdown, fixtures.read_dove_lessons.markdown);
  assert.equal(renderPublicReport(envelope.report, { language: "zh" }), fixtures.read_dove_lessons.markdown);
  assert.equal(Object.hasOwn(envelope.report, "lessonsBinding"), false);
  assert.equal(Object.hasOwn(envelope.report, "currentHash"), false);
  assert.deepEqual(envelope.hostControl.lessonsDocument, {
    binding: fixtures.read_dove_lessons.lessonsBinding,
    currentHash: fixtures.read_dove_lessons.currentHash
  });
  assert.equal(Object.isFrozen(envelope.hostControl.lessonsDocument), true);
  const human = JSON.stringify(envelope.report);
  assert.doesNotMatch(human, /private-opaque-binding|[0-9a-f]{64}/u);

  const updated = publicEnvelope("update_dove_lessons", fixtures.update_dove_lessons);
  assert.equal(updated.report.markdown, fixtures.update_dove_lessons.markdown);
  assert.equal(Object.hasOwn(updated.hostControl, "lessonsDocument"), false);
  assert.equal(Object.hasOwn(updated.report, "currentHash"), false);
});

test("research outcome projection explains the next judgment without exposing internal decision enums", () => {
  const projected = publicResult("record_research_outcome", {
    ...fixtures.record_research_outcome,
    scopeDeviation: true,
    scopeDeviationReasons: ["budget-exceeded:costUnits", "undeclared-budget-dimension:tokens", "unexpected-evidence:private-evidence-id"]
  });
  assert.match(projected.research.nextJudgment, /review.*execution facts.*evidence.*scientific judgment/iu);
  assert.equal(projected.research.receiptRecorded, true);
  assert.equal(projected.research.decisionUnchanged, true);
  assert.equal(projected.outcome.deviationReasons.length, 3);
  assert.match(projected.outcome.deviationReasons[0], /exceeded.*budget/iu);
  assert.match(projected.outcome.deviationReasons[1], /undeclared budget dimension/iu);
  assert.match(projected.outcome.deviationReasons[2], /evidence.*did not match.*(?:research action|execution request)/iu);
  const renderedEn = renderPublicReport(projected, { language: "en" });
  const renderedZh = renderPublicReport(projected, { language: "zh" });
  assert.doesNotMatch(renderedEn, /continue-direction|stop-budget|block-needs-user|stop-low-return/u);
  assert.match(renderedZh, /检查.*执行事实和证据.*科学判断/u);
  assert.doesNotMatch(renderedZh, /Continue the current research direction|stop-budget/u);
  assertPublic(projected, "record_research_outcome.judgment");
  assertPublic(renderedEn, "record_research_outcome.judgment.en");
  assertPublic(renderedZh, "record_research_outcome.judgment.zh");
});

test("research outcome errors explain exact evidence labels without exposing control vocabulary", () => {
  const nodeMessage = publicErrorMessage("record_research_outcome", new Error("The selected research item binding is stale; refresh current research status before recording the outcome."));
  assert.equal(nodeMessage, "The selected research item binding is stale; refresh current research status before recording the outcome.");
  assertPublic(nodeMessage, "record_research_outcome.node-error");

  const evidenceMessage = publicErrorMessage("record_research_outcome", new Error("Returned evidence does not match the current research handoff."));
  assert.match(evidenceMessage, /evidenceReturned.*exact labels.*outcomeContract.*artifactPaths.*validationPaths.*facts/isu);
  assertPublic(evidenceMessage, "record_research_outcome.evidence-error");

  const sanitized = publicErrorMessage("query_sources", new Error("host outcome closureRequest boundArgs exactly once"));
  assert.doesNotMatch(sanitized, /host outcome|closureRequest|boundArgs|exactly once/iu);
  assertPublic(sanitized, "public-error.control-vocabulary");
});

test("workspace mainline projection renders only the newly current title-like mainline", () => {
  const projected = publicResult("manage_dove_workspace", fixtures.manage_dove_workspace);
  assert.equal(projected.mainline, "Evidence-Grounded Research Workflows for Reliable Autonomous Systems");
  assert.equal(projected.message, projected.mainline);
  assert.equal(projected.projectBrief, "This repository contains a sealed Dove core, MCP service, generated host adapters, and focused tests.");
  assert.equal(renderPublicReport(projected, { language: "en" }), `${projected.projectBrief}\n\n${projected.mainline}`);
  assert.equal(renderPublicReport(projected, { language: "zh" }), `${projected.projectBrief}\n\n${projected.mainline}`);
  assertPublic(projected, "manage_dove_workspace.mainline");
});

test("public envelope is frozen and keeps machine channels outside the human report", () => {
  const envelope = publicEnvelope("create_ambient_dove_mission", fixtures.create_ambient_dove_mission);
  assert.equal(Object.isFrozen(envelope), true);
  assert.equal(Object.isFrozen(envelope.report), true);
  assert.equal(Object.hasOwn(envelope, "researchHandoff"), false);
  assert.equal(Object.isFrozen(envelope.hostControl), true);
  assert.equal(Object.isFrozen(envelope.hostControl.classification), true);
  assert.equal(Object.isFrozen(envelope.hostControl.presentation), true);
  assert.equal(Object.isFrozen(envelope.hostControl.closureRequest), true);
  assert.equal(Object.isFrozen(envelope.hostControl.closureRequest.boundArgs), true);
  assert.equal(Object.isFrozen(envelope.hostControl.closureRequest.requiredOutcomeFields), true);
  assert.equal(Object.isFrozen(envelope.hostControl.closureRequest.defaults), true);
  assert.equal(Object.isFrozen(envelope.hostControl.closureRequest.defaults.artifactPaths), true);
  assert.equal(Object.isFrozen(envelope.hostControl.closureRequest.defaults.validationPaths), true);
  assert.equal(Object.isFrozen(envelope.hostControl.closureRequest.defaults.facts), true);
  const visitReport = (value) => {
    if (Array.isArray(value)) return value.forEach(visitReport);
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value)) {
      assert.notEqual(key, "researchHandoff");
      assert.notEqual(key, "hostControl");
      visitReport(item);
    }
  };
  visitReport(envelope.report);
});

test("ambient creation routes ordinary and research machine channels by persisted mission mode", () => {
  const envelope = publicEnvelope("create_ambient_dove_mission", fixtures.create_ambient_dove_mission);
  assert.deepEqual(Object.keys(envelope), ["report", "hostControl"]);
  assert.deepEqual(envelope.hostControl.presentation, { mode: "silent", reason: "ambient-create-succeeded" });
  assert.deepEqual(envelope.hostControl.closureRequest, {
    tool: "close_host_outcome",
    mode: "host-outcome",
    exactlyOnce: true,
    boundArgs: { missionNumber: 2 },
    requiredOutcomeFields: ["attemptId", "status", "summary"],
    defaults: { artifactPaths: [], validationPaths: [], facts: [] }
  });
  const researchData = {
    ...fixtures.create_ambient_dove_mission,
    mission: { missionId: "mission-ambient-raw-id", mode: "research" },
    executionHandoff: { missionId: "mission-ambient-raw-id", contractDigest: "a".repeat(64), decisionDigest: "b".repeat(64), actionId: "bounded-analysis", actionDigest: "c".repeat(64), budget: { actions: 1, timeMinutes: 60, costUnits: 1 }, expectedEvidence: ["bounded-analysis"], issuedAt: "2026-07-29T00:00:00.000Z", expiresAt: "2026-07-29T04:00:00.000Z" },
    currentResearchDecision: { missionId: "mission-ambient-raw-id", revision: 1, nextAction: { kind: "analysis", description: "Analyze the bounded request before concrete host execution.", rationale: "The canonical research decision authorizes one bounded analysis step.", successConditions: ["Return a concrete bounded result."], stopConditions: ["Stop after this single bounded action."] } }
  };
  const researchEnvelope = publicEnvelope("create_ambient_dove_mission", researchData);
  assert.equal(researchEnvelope.researchHandoff.actionKind, "analysis");
  assert.deepEqual(researchEnvelope.hostControl.closureRequest, {
    tool: "record_research_outcome",
    mode: "research-outcome",
    exactlyOnce: true,
    boundArgs: { missionNumber: 2, decisionRevision: 1 },
    requiredOutcomeFields: ["attemptId", "status", "performedActionCount", "actualUsage", "evidenceReturned", "artifactPaths", "validationPaths", "facts", "startedAt", "finishedAt"],
    defaults: {},
    outcomeContract: {
      evidenceReturned: { allowedValues: ["bounded-analysis"], exactLabelsOnly: true, allExpectedForEvidenceComplete: true },
      actualUsageLimits: {
        actions: 1,
        timeMinutes: 60,
        costUnits: 1,
        fieldTypes: { actions: "integer", timeMinutes: "integer", costUnits: "integer" },
        positiveFractions: "round-up-before-reporting",
        serverCoercion: false
      },
      timestampWindow: {
        startedAtNotBefore: "2026-07-29T00:00:00.000Z",
        finishedAtBefore: "2026-07-29T04:00:00.000Z",
        acceptedUtcFormats: ["YYYY-MM-DDTHH:mm:ssZ", "YYYY-MM-DDTHH:mm:ss.sssZ"],
        canonicalFormat: "YYYY-MM-DDTHH:mm:ss.sssZ"
      },
      facts: { itemType: "string", executionObservationsOnly: true, scientificJudgmentAllowed: false },
      artifactPaths: { projectRelativeExistingFiles: true },
      validationPaths: { projectRelativeExistingSeparateFiles: true }
    }
  });
  for (const field of ["disposition", "execution", "outcomeClosure", "continuation", "closure", "retry", "terminal", "presentation", "closureRequest", "tool", "mode", "exactlyOnce", "boundArgs", "requiredOutcomeFields", "defaults", "missionNumber", "researchItemNumber", "decisionRevision"]) assert.equal(Object.hasOwn(envelope.report, field), false);
  const rendered = renderPublicReport(envelope.report, { language: "en" });
  const renderedZh = renderPublicReport(envelope.report, { language: "zh" });
  assert.match(rendered, /recorded the work entry.*requested work has not been completed/iu);
  assert.match(renderedZh, /已记录工作入口.*实际工作尚未完成/u);
  assert.doesNotMatch(rendered, /Authorized execution|Success condition|Stop condition|Evidence to return|host outcome|closure|retry|terminal/iu);
  assert.doesNotMatch(renderedZh, /已授权执行|成功条件|停止条件|应返回证据|host outcome|closure|retry|terminal/iu);
  assertPublic(envelope.report, "create_ambient_dove_mission.report");
  assertPublic(researchEnvelope.researchHandoff, "create_ambient_dove_mission.researchHandoff");
  assertPublic(rendered, "create_ambient_dove_mission.rendered");
  assertPublic(renderedZh, "create_ambient_dove_mission.rendered.zh");
});

test("presentation policy is canonical, public, private-safe, and frozen", () => {
  const ambient = publicEnvelope("create_ambient_dove_mission", fixtures.create_ambient_dove_mission);
  const ordinary = publicEnvelope("record_draft_archive", fixtures.record_draft_archive);
  const failedAmbient = createPublicEnvelope("create_ambient_dove_mission", { status: "blocked", summary: "The request needs clarification." }, {
    kind: "failed",
    category: "invalid-input",
    phase: "validation",
    blocking: true,
    userAction: "clarify-input",
    terminal: true,
    continuation: "terminal",
    closure: "none",
    retry: "explicit-request",
    reason: "invalid-input"
  });

  assert.deepEqual(ambient.hostControl.presentation, { mode: "silent", reason: "ambient-create-succeeded" });
  assert.deepEqual(ordinary.hostControl.presentation, { mode: "show", reason: "operation-result" });
  assert.deepEqual(failedAmbient.hostControl.presentation, { mode: "show", reason: "failure" });
  for (const envelope of [ambient, ordinary, failedAmbient]) {
    assert.equal(Object.isFrozen(envelope.hostControl.presentation), true);
    assertPublic(envelope.hostControl.presentation, "hostControl.presentation");
    assert.equal(Object.hasOwn(envelope.report, "presentation"), false);
  }
});

test("status briefing preserves decision information, evidence separation, and privacy without fixing section wording", () => {
  const internal = {
    ...fixtures.query_dove_status,
    currentContext: {
      ...fixtures.query_dove_status.currentContext,
      receiptCount: 1,
      integrityAssessment: { status: "incomplete", complete: false, incompleteReasons: ["review-evidence-unavailable"] },
      reviewValidity: { authority: "not-established", currentCount: 0, staleCount: 1, failures: ["review-report-stale"] }
    },
    durableStatus: {
      state: "current",
      workspaceGraph: {
        bounded: true,
        missions: { totalCount: 1, truncated: false, items: [{ displayIndex: 0, missionId: "mission-secret", goal: "Visible goal", status: "incomplete", complete: false, dependencyDisplayIndices: [], requirementDisplayIndices: [0], gapCodes: ["review-evidence-unavailable"] }] },
        requirements: { totalCount: 1, truncated: false, items: [{ displayIndex: 0, missionDisplayIndex: 0, requirementId: "requirement-secret", kind: "goal", description: "Visible requirement" }] },
        workItems: { totalCount: 1, truncated: false, items: [{ displayIndex: 0, missionDisplayIndex: 0, workItemId: "work-secret", label: "Visible work", kind: "writing", status: "completed", dependencyDisplayIndices: [] }] },
        researchItems: { totalCount: 0, truncated: false, items: [] },
        receipts: { totalCount: 1, truncated: false, items: [{ displayIndex: 0, receiptId: "receipt-secret", missionDisplayIndex: 0, summary: "Draft produced.", artifactCount: 1, validationCount: 1 }] },
        artifacts: { totalCount: 1, truncated: false, items: [{ displayIndex: 0, path: "README.md", missionDisplayIndex: 0, kind: "draft" }] },
        validations: { totalCount: 1, truncated: false, items: [{ displayIndex: 0, missionDisplayIndex: 0, kind: "test" }] },
        gaps: { totalCount: 1, truncated: false, items: [{ displayIndex: 0, kind: "mission-completion", code: "review-evidence-unavailable", missionDisplayIndex: 0 }] }
      }
    }
  };
  const projected = publicResult("query_dove_status", internal);
  assertPublic(projected, "query_dove_status.briefing");
  assert.equal(Object.hasOwn(projected, "durable"), false);
  assert.equal(Object.hasOwn(projected, "technicalAppendix"), false);
  assert.equal(projected.workStatus.state, "work-produced");
  assert.deepEqual(projected.workStatus.currentOutputs, ["README.md"]);
  assert.equal(projected.evidenceStatus.state, "current-with-gaps");
  assert.equal(projected.evidenceStatus.review.required, false);
  assert.equal(projected.evidenceStatus.review.authority, "not-established");
  assert.equal(projected.evidenceStatus.review.staleCount, 1);
  assert.match(projected.workStatus.summary, /work products|output/iu);
  assert.match(projected.evidenceStatus.summary, /evidence/iu);
  assert.ok(Array.isArray(projected.risksAndBlockers));
  assert.equal(projected.risksAndBlockers.length > 0, true);
  for (const risk of projected.risksAndBlockers) {
    assert.equal(typeof risk.whatHappened, "string");
    assert.equal(typeof risk.whyItMatters, "string");
    assert.equal(Object.hasOwn(risk, "recommendedAction"), false);
    assertPublic(risk, "query_dove_status.risk");
  }

  const withAppendix = publicResult("query_dove_status", internal, { includeTechnicalAppendix: true });
  assertPublic(withAppendix, "query_dove_status.appendix");
  assert.equal(withAppendix.technicalAppendix.bounded, true);
  assert.equal(withAppendix.technicalAppendix.workstreams.items[0].number, 1);
  assert.equal(withAppendix.technicalAppendix.workstreams.items[0].goal, "Visible goal");
  assert.equal(withAppendix.technicalAppendix.outputs.items[0].path, undefined);

  const rendered = renderPublicReport(projected, { language: "zh" });
  assert.equal(Object.hasOwn(projected, "briefing"), false);
  assert.doesNotMatch(JSON.stringify(projected), /\p{Script=Han}/u);
  assert.match(rendered, /README\.md/u);
  assert.match(rendered, /工作|成果/u);
  assert.match(rendered, /证据|复核/u);
  assert.match(rendered, /独立复核|审查/u);
  assert.doesNotMatch(rendered, /Useful work|Current work|Independent review|workstream|evidence is|completion condition/iu);
  assertPublic(rendered, "query_dove_status.rendered");
});

test("status briefing groups three workstreams by actionable gap and keeps output presence separate from closure evidence", () => {
  const missions = [
    {
      displayIndex: 0,
      goal: "完成背景调研摘要",
      complete: false,
      declaredOutputs: [{ path: "BACKGROUND_SUMMARY.md", present: false }],
      uncoveredOutputs: ["BACKGROUND_SUMMARY.md"],
      uncoveredCompletionCriteria: ["摘要覆盖主要背景和关键引用。"],
      unmetEvidenceRequirements: ["artifact:BACKGROUND_SUMMARY.md"],
      gapCodes: ["execution-receipt-missing", "mission-artifact-coverage-missing", "criteria-coverage-missing", "evidence-requirements-unmet"]
    },
    {
      displayIndex: 1,
      goal: "整理实验设置说明",
      complete: false,
      declaredOutputs: [{ path: "EXPERIMENT_SETUP.md", present: false }],
      uncoveredOutputs: ["EXPERIMENT_SETUP.md"],
      uncoveredCompletionCriteria: ["实验设置可复现。"],
      unmetEvidenceRequirements: ["artifact:EXPERIMENT_SETUP.md"],
      gapCodes: ["execution-receipt-missing", "mission-artifact-coverage-missing", "criteria-coverage-missing", "evidence-requirements-unmet"]
    },
    {
      displayIndex: 2,
      goal: "核对 README 项目定位并记录明确结论",
      complete: false,
      declaredOutputs: [{ path: "POSITIONING_ASSESSMENT.md", present: true }],
      uncoveredOutputs: ["POSITIONING_ASSESSMENT.md"],
      uncoveredCompletionCriteria: ["文档存在且包含明确结论。"],
      unmetEvidenceRequirements: ["artifact:POSITIONING_ASSESSMENT.md", "validation:POSITIONING_ASSESSMENT.md"],
      gapCodes: ["execution-receipt-missing", "mission-artifact-coverage-missing", "criteria-coverage-missing", "evidence-requirements-unmet"]
    }
  ];
  const projected = publicResult("query_dove_status", {
    status: "ok",
    detailsAvailable: true,
    currentContext: {
      missionCount: 3,
      missionScope: "workspace",
      receiptCount: 0,
      sourceCount: 0,
      integrityAssessment: null,
      reviewValidity: { authority: "not-established", currentCount: 0, staleCount: 0, failures: [] }    },
    needsAttention: {
      reasons: ["execution-receipt-missing", "mission-artifact-coverage-missing", "criteria-coverage-missing", "evidence-requirements-unmet"],
      stableGaps: { completion: ["execution-receipt-missing", "mission-artifact-coverage-missing", "criteria-coverage-missing", "evidence-requirements-unmet"], review: [], research: [] }
    },
    durableStatus: {
      state: "current",
      workspaceGraph: {
        bounded: true,
        missions: { totalCount: 3, truncated: false, items: missions },
        workItems: { totalCount: 0, truncated: false, items: [] },
        artifacts: { totalCount: 0, truncated: false, items: [] }
      }
    }
  });

  assert.equal(projected.workStatus.state, "work-produced");
  assert.deepEqual(projected.workStatus.currentOutputs, ["POSITIONING_ASSESSMENT.md"]);
  assert.equal(projected.evidenceStatus.state, "evidence-recording-missing");
  assert.ok(projected.risksAndBlockers.length >= 2);
  const riskText = projected.risksAndBlockers.map((risk) => Object.values(risk).filter((value) => typeof value === "string").join(" ")).join("\n");
  assert.match(riskText, /工作 1、2|BACKGROUND_SUMMARY\.md|EXPERIMENT_SETUP\.md/u);
  assert.match(riskText, /摘要覆盖主要背景和关键引用|实验设置可复现/u);
  assert.match(riskText, /工作 3|POSITIONING_ASSESSMENT\.md/u);
  assert.match(riskText, /文档存在且包含明确结论/u);
  assert.match(riskText, /do not repeat it as a validation output|separate validation output/iu);
  const rendered = renderPublicReport(projected, { language: "zh" });
  assert.equal(Object.hasOwn(projected, "briefing"), false);
  assert.match(rendered, /BACKGROUND_SUMMARY\.md|EXPERIMENT_SETUP\.md|工作 1、2/u);
  assert.match(rendered, /POSITIONING_ASSESSMENT\.md|工作 3/u);
  assert.match(rendered, /文档存在且包含明确结论/u);
  assert.doesNotMatch(rendered, /the selected (?:item|path)|mission-|requirement-|receipt-|\/home\/|\.dove\//iu);
  assertPublic(projected, "query_dove_status.three-workstream-closure-failure");
});

test("technical appendix numbers research items from one within each workstream", () => {
  const projected = publicResult("query_dove_status", {
    ...fixtures.query_dove_status,
    durableStatus: {
      state: "current",
      workspaceGraph: {
        bounded: true,
        missions: {
          totalCount: 2,
          truncated: false,
          items: [
            { displayIndex: 0, goal: "First workstream", status: "incomplete", complete: false, dependencyDisplayIndices: [], requirementDisplayIndices: [], gapCodes: [] },
            { displayIndex: 1, goal: "Second workstream", status: "incomplete", complete: false, dependencyDisplayIndices: [], requirementDisplayIndices: [], gapCodes: [] }
          ]
        },
        researchItems: {
          totalCount: 3,
          truncated: false,
          items: [
            { displayIndex: 0, missionResearchDisplayIndex: 0, missionDisplayIndex: 0, questionOrHypothesis: "First mission item", status: "pending" },
            { displayIndex: 1, missionResearchDisplayIndex: 0, missionDisplayIndex: 1, questionOrHypothesis: "Second mission first item", status: "pending" },
            { displayIndex: 2, missionResearchDisplayIndex: 1, missionDisplayIndex: 1, questionOrHypothesis: "Second mission second item", status: "pending" }
          ]
        }
      }
    }
  }, { includeTechnicalAppendix: true });

  assert.deepEqual(projected.technicalAppendix.researchItems.items.map((item) => item.number), [1, 1, 2]);
  assert.deepEqual(projected.technicalAppendix.researchItems.items.map((item) => item.workstreamNumber), [1, 2, 2]);
});

test("ordinary operation DTOs render deterministically as human-readable text", () => {
  const projected = publicResult("run_experience_workflow", fixtures.run_experience_workflow);
  const first = renderPublicReport(projected, { language: "en" });
  const second = renderPublicReport(projected, { language: "en" });
  assert.equal(first, second);
  assert.match(first, /failed and is incomplete/iu);
  assert.match(first, /Accuracy did not meet the threshold/u);
  assertPublic(first, "operation.rendered");
});

test("Chinese operation rendering uses natural Chinese body text", () => {
  const recorded = publicResult("record_draft_archive", fixtures.record_draft_archive);
  const rendered = renderPublicReport(recorded, { language: "zh" });
  assert.match(rendered, /请求的内容已记录/u);
  assert.doesNotMatch(rendered, /Recorded draft|Status|Outcome|Completion|Review|Next/iu);
  assertPublic(rendered, "operation.rendered.zh");
});

test("approval cards render in ordinary language without replay controls", () => {
  const projected = publicResult("create_dove_mission", {
    status: "needs-confirmation",
    zeroWrite: true,
    approval: {
      required: true,
      noChangesApplied: true,
      summary: "Dove can save this work checkpoint.",
      effects: ["Save the approved goal.", "Save the expected outcomes."],
      question: "Create this work checkpoint?"
    },
    confirmation: {
      proposalToken: "private-token",
      confirmArgs: { confirmed: true }
    }
  });
  const rendered = renderPublicReport(projected, { language: "en" });
  const renderedZh = renderPublicReport(projected, { language: "zh" });
  assert.match(rendered, /No files have been created or changed/u);
  assert.match(rendered, /If approved, Dove will/u);
  assert.match(rendered, /Create this work checkpoint\?/u);
  assert.doesNotMatch(rendered, /proposal|token|confirmArgs|confirmed/iu);
  assert.match(renderedZh, /需要确认后才能继续/u);
  assert.match(renderedZh, /尚未应用任何更改/u);
  assert.doesNotMatch(renderedZh, /Dove can save|Save the approved|Create this work checkpoint|If approved/iu);
  assertPublic(projected, "approval.projected");
  assertPublic(rendered, "approval.rendered");
  assertPublic(renderedZh, "approval.rendered.zh");
});

test("completion, review, experiment, and figure projections retain business outcomes", () => {
  const completion = publicResult("assess_mission_completion", fixtures.assess_mission_completion);
  assert.equal(completion.completion.complete, false);
  assert.equal(completion.completion.gaps.length, 1);
  assert.deepEqual(completion.completion.artifacts.map((item) => item.path), ["report.md"]);
  assert.deepEqual(completion.operationalIntegrity, {
    hostActionReturned: false,
    receiptRecorded: false,
    completionEvidenceSatisfied: false,
    lifecycleClosed: false
  });

  const unavailable = publicResult("close_host_outcome", {
    ...fixtures.close_host_outcome,
    status: "partial-commit-failure",
    writesApplied: true,
    partialCommit: {
      receiptRecorded: true,
      completionAssessmentFailed: true,
      repeatClosureAllowed: false,
      zeroWriteRetryAllowed: false,
      nextAction: "assess-mission-completion-read-only"
    },
    completion: {
      assessment: null,
      assessmentUnavailable: true,
      reassessWith: "assess_mission_completion",
      reassessmentReadOnly: true
    },
    assessmentFailure: "/home/private/.dove/missions/secret malformed"
  });
  assert.equal(unavailable.completion.status, "unavailable");
  assert.deepEqual(unavailable.verification, [{ path: "test.log", kind: "validation-log" }]);
  assert.deepEqual(unavailable.outcome, {
    status: "completed",
    kind: "files",
    summary: "The host produced the report.",
    facts: ["The report file was produced."]
  });
  assert.deepEqual(unavailable.operationalIntegrity, {
    hostActionReturned: true,
    receiptRecorded: true,
    completionEvidenceSatisfied: false,
    lifecycleClosed: false
  });
  assert.deepEqual(unavailable.partialCommit, {
    committed: true,
    reassessmentRequired: true,
    repeatClosureAllowed: false,
    zeroWriteRetryAllowed: false,
    nextAction: "Reassess completion using the read-only completion check."
  });
  assert.equal(Object.hasOwn(unavailable, "assessmentFailure"), false);
  assert.equal(unavailable.researchNarrative.researchDirection, "Deliver the bounded report.");
  const finalZh = renderPublicReport(unavailable, { language: "zh" });
  assert.doesNotMatch(finalZh, /^已完成/u);
  assert.match(finalZh, /结果已返回|成果证据已记录/u);
  assert.match(finalZh, /完成评估.*失败|只读.*重新评估/u);
  assert.match(finalZh, /目前的认识是/u);
  assert.doesNotMatch(finalZh, /mission|closure|receipt|callback|hostControl|\.dove|[0-9a-f]{64}|private/u);

  const archived = publicResult("archive_review_record", fixtures.archive_review_record);
  assert.equal(archived.review.verdict, "needs-revision");
  assert.equal(archived.review.findings[0].summary, "Baseline is weak.");
  assert.deepEqual(archived.review.actionItems, ["Add a baseline."]);
  assert.equal(archived.review.authority, "not-established");

  const experiment = publicResult("run_experience_workflow", fixtures.run_experience_workflow);
  assert.equal(experiment.outcome.summary, "Accuracy did not meet the threshold.");
  assert.equal(experiment.verification.status, "failed");
  assert.equal(experiment.verification.humanReviewAuthority, false);

  const figure = publicResult("record_figure_archive", fixtures.record_figure_archive);
  assert.equal(figure.outcome.caption, "Visible caption.");
  assert.deepEqual(figure.findings, ["Label overlaps."]);
  assert.equal(Object.hasOwn(figure, "verification"), false);
});

test("host completed status never renders overall completion by itself", () => {
  const projected = publicResult("close_host_outcome", fixtures.close_host_outcome);
  assert.equal(projected.outcome.status, "completed");
  assert.equal(projected.completion.complete, false);
  for (const language of ["en", "zh"]) {
    const rendered = renderPublicReport(projected, { language });
    assert.doesNotMatch(rendered, language === "zh" ? /^已完成/u : /^Completed:/u);
    assert.match(rendered, language === "zh" ? /主机动作已返回|结果已返回/u : /host action returned/iu);
    assert.match(rendered, language === "zh" ? /生命周期已关闭：否/u : /lifecycle closed: no/iu);
  }
});

test("source projection does not expose or synthesize retired innovation coverage", () => {
  const projected = publicResult("query_sources", {
    ...fixtures.query_sources,
    items: [{
      ...fixtures.query_sources.items[0],
      innovationCoverage: { unresolvedCollisions: ["Retired synthetic unknown."] }
    }]
  });
  assert.equal(Object.hasOwn(projected.sources[0], "innovationCoverage"), false);
  assert.deepEqual(projected.unknowns, []);
  assert.doesNotMatch(JSON.stringify(projected), /Retired synthetic unknown/u);
});

test("human reports preserve benign research vocabulary that overlaps control terminology", () => {
  const sourceFixture = {
    ...fixtures.query_sources,
    items: [{
      ...fixtures.query_sources.items[0],
      title: "Closure properties and terminal velocity",
      abstract: "Retry methods are compared in a scientific context."
    }]
  };
  const projected = publicResult("query_sources", sourceFixture);
  assert.equal(projected.sources[0].title, "Closure properties and terminal velocity");
  assert.equal(projected.sources[0].abstract, "Retry methods are compared in a scientific context.");
});

test("invocation classification is isolated in HostControl and preserves stable machine reason codes", () => {
  const envelope = createPublicEnvelope("record_draft_archive", fixtures.record_draft_archive, {
    kind: "failed",
    category: "invalid-input",
    phase: "validation",
    blocking: true,
    userAction: "clarify-input",
    terminal: true,
    continuation: "terminal",
    closure: "none",
    retry: "explicit-request",
    reason: "invalid-input",
    internalTrace: "must-not-copy"
  });
  assert.equal(Object.hasOwn(envelope.report, "disposition"), false);
  assert.deepEqual(envelope.hostControl.classification, {
    outcome: "failed",
    category: "invalid-input",
    phase: "validation",
    blocking: true,
    userAction: "clarify-input",
    terminal: true,
    continuation: "terminal",
    closure: "none",
    retry: "explicit-request",
    reason: "invalid-input"
  });
  assert.deepEqual(envelope.hostControl.presentation, { mode: "show", reason: "failure" });
  assert.equal(envelope.hostControl.closureRequest, null);
});

test("public errors redact internal paths, digests, replay controls, and tool identifiers", () => {
  const errors = [
    ["record_draft_archive", "record_draft_archive failed at paper/draft.md for mission-secret."],
    ["create_dove_mission", `proposalDigest ${"a".repeat(64)} and confirmArgs no longer match /home/user/project/.dove/missions/mission-secret.json.`],
    ["ingest_execution_receipt", "receiptId receipt-secret has contractDigest mismatch in MutationContext."],
    ["record_research_outcome", "actionId action-secret decisionId decision-secret envelopeId envelope-secret seal and ledgerSequence are invalid."],
    ["verify_source", "Unknown source: source-secret."],
    ["query_dove_status", "Mission mission-secret does not exist."]
  ];
  for (const [name, raw] of errors) {
    const message = publicErrorMessage(name, new Error(raw));
    assertPublic(message, name);
    assert.doesNotMatch(message, new RegExp(name, "u"));
  }
  const retiredFlag = publicErrorMessage("query_sources", new Error("Unknown or unsupported CLI argument: --mission-id."));
  assert.match(retiredFlag, /--mission-id/u);
  assert.doesNotMatch(retiredFlag, /the selected item/u);

  const credentialError = publicErrorMessage("query_sources", new Error(
    "Authorization: Bearer private.jwt.token failed for https://user:password@example.org/source?refresh_token=private-token&password=private-password."
  ));
  assert.doesNotMatch(credentialError, /private\.jwt\.token|user:password|private-token|private-password/u);
  assert.match(credentialError, /\[REDACTED\]/u);

  const pathError = publicErrorMessage("query_sources", new Error(
    "Reading /mnt/private-work/source.txt or C:\\Projects\\private-work\\source.txt failed."
  ));
  assert.doesNotMatch(pathError, /\/mnt\/private-work|C:\\Projects/u);
  assert.match(pathError, /a private path/u);
  assert.doesNotMatch(pathError, /the selected (?:item|path)/iu);

  const replayError = publicErrorMessage("create_dove_mission", new Error(
    "Use exact replay data from proposal review."
  ));
  assert.doesNotMatch(replayError, /exact replay/iu);
  assert.match(replayError, /confirmation details/u);

  const inconsistentMission = publicErrorMessage("create_dove_mission", new Error(
    "alignment.missionGoalRequirementIds references unknown requirement requirement-goal."
  ));
  assert.match(inconsistentMission, /internally inconsistent/u);
  assert.match(inconsistentMission, /only the goal/u);
  assert.doesNotMatch(inconsistentMission, /requirement-goal|missionGoalRequirementIds/u);
  assert.match(renderPublicReport({ message: inconsistentMission, disposition: { outcome: "failed" } }, { language: "zh" }), /任务详情内部不一致/u);

  const duplicateClosurePath = publicErrorMessage("close_host_outcome", new Error(
    "Host outcome artifact and validation paths must be canonically distinct."
  ));
  assert.match(duplicateClosurePath, /Omit validationPaths.*separate validation output file/isu);
  assert.match(
    renderPublicReport({ message: duplicateClosurePath, disposition: { outcome: "failed", category: "invalid-input" } }, { language: "zh" }),
    /省略 validationPaths.*独立验证输出文件/isu
  );
});
