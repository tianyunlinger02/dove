import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  ARTIFACT_PATHS,
  ensureWorkspace,
  initProject,
  queryMetaOptimize,
  readJson,
  refreshWiki,
  registerSource,
  upsertNote,
  upsertFigurePlan,
  queryWorkspaceIndex,
  validateFigurePipeline,
  writeJson
} from "../../src/core/index.mjs";

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "paper-factory-phase6-"));
}

test("ensureWorkspace reconciles managed artifact metadata and structure for boundaries and workspace index", () => {
  const root = tempRoot();
  ensureWorkspace(root);

  fs.writeFileSync(path.join(root, ARTIFACT_PATHS.workflowBoundaries), JSON.stringify({
    version: 1,
    managedPaths: "bad-shape",
    userOwnedPaths: [".paper/drafts"],
    managedArtifacts: {
      workflowBoundaries: { revisionId: "legacy" }
    },
    notes: ["legacy note"]
  }, null, 2));
  fs.writeFileSync(path.join(root, ARTIFACT_PATHS.workspaceIndex), JSON.stringify({
    version: 1,
    currentFocus: "Legacy focus",
    workQueues: { ready: "bad-shape" },
    managed: { revisionId: "legacy-workspace" }
  }, null, 2));

  ensureWorkspace(root);

  const boundaries = JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.workflowBoundaries), "utf8"));
  const workspaceIndex = JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.workspaceIndex), "utf8"));

  assert.equal(boundaries.version, 3);
  assert.equal(boundaries.managedArtifacts.workflowBoundaries.revisionId, "schema-v5:bootstrap-only");
  assert.equal(boundaries.managedArtifacts.workspaceIndex.path, ".paper/workspace/index.json");
  assert.deepEqual(boundaries.managedPaths, [".opencode", ".opencode.json", "README.md", "bin", "docs", "mcp", "scripts", "src"]);
  assert.deepEqual(boundaries.notes, ["legacy note"]);

  assert.equal(workspaceIndex.version, 5);
  assert.equal(workspaceIndex.managed.revisionId, "schema-v5:bootstrap-only");
  assert.equal(workspaceIndex.currentFocus, "Legacy focus");
  assert.deepEqual(workspaceIndex.workQueues.ready, []);
  assert.deepEqual(workspaceIndex.resumeGuidance.prioritizedPacketIds, []);
  assert.equal(workspaceIndex.behaviorDiscipline.explicitOnly, true);
  assert.equal(workspaceIndex.repairFrontier.count, 0);
  assert.equal(workspaceIndex.metaOptimize.proposalOnly, true);
  assert.equal(workspaceIndex.metaOptimize.reportPath, ".paper/meta/LATEST_OPTIMIZER_REPORT.md");
});

test("queryMetaOptimize builds proposal-only recommendations from durable review, audit, bridge, and repair signals", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Meta Frontier", objective: "Surface optimizer recommendations from durable signals." });

  writeJson(root, ARTIFACT_PATHS.reviewConcerns, {
    version: 2,
    items: [{
      id: "review-gap-1",
      summary: "Reviewer concern keeps recurring.",
      severity: "high",
      status: "escalated",
      responseOwnerRole: "researcher",
      recurrenceCount: 3,
      linkedAuditIds: ["audit-1"],
      linkedBridgeIds: ["bridge-1"],
      linkedArtifactPaths: [ARTIFACT_PATHS.reviewLog],
      updatedAt: new Date(0).toISOString()
    }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.adversarialReviewState, {
    version: 2,
    round: 3,
    unresolvedConcernIds: ["review-gap-1"],
    escalatedConcernIds: ["review-gap-1"],
    pendingAuthorResponseIds: [],
    pendingReviewerRulingIds: [],
    concernStatusCounts: { escalated: 1 },
    escalationThresholds: { high: 1, medium: 2, low: 3 },
    lastAuditIds: ["audit-1"],
    lastBridgeIds: ["bridge-1"],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.reviewState, {
    version: 3,
    lastVerdict: "needs-work",
    lastReviewedAt: new Date(0).toISOString(),
    history: [],
    openItems: ["Repair the recurring review concern."],
    unresolvedConcernIds: ["review-gap-1"],
    escalatedConcernIds: ["review-gap-1"],
    pendingAuthorResponseIds: [],
    pendingReviewerRulingIds: [],
    reviewRound: 3,
    reviewerIndependence: { reviewerRole: "reviewer", responseOwnerRoles: ["researcher"], separationMaintained: true }
  });
  writeJson(root, ARTIFACT_PATHS.experimentAudits, {
    version: 1,
    items: [{
      id: "audit-1",
      experimentId: "exp-1",
      resultId: "result-1",
      integrityFlags: ["missing-reviewed-artifact-refs"],
      auditVerdict: "blocked",
      confidence: "low",
      reviewedArtifactRefs: []
    }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.claimBridgeLog, {
    version: 1,
    items: [{
      id: "bridge-1",
      experimentId: "exp-1",
      resultId: "result-1",
      claimId: "claim-1",
      auditIds: ["audit-1"],
      auditVerdict: "blocked",
      integrityFlags: ["missing-reviewed-artifact-refs"],
      bridgeStatus: "held-for-review",
      reason: "Audit is blocked."
    }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.figureQa, {
    version: 1,
    items: [],
    issues: [{
      id: "figure-issue-1",
      figureId: "figure-1",
      code: "missing-final-svg",
      severity: "high",
      summary: "Final SVG is missing.",
      artifactPaths: [ARTIFACT_PATHS.figureQa]
    }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.versionComparisons, {
    version: 1,
    items: [{
      id: "v1-vs-v2",
      fromVersionId: "v1",
      toVersionId: "v2",
      unresolvedConcernsAdded: ["review-gap-1"],
      unresolvedConcernsRemoved: []
    }],
    activeTargets: ["v1", "v2"],
    updatedAt: null
  });

  const result = queryMetaOptimize(root);
  const recommendations = readJson(root, ARTIFACT_PATHS.metaRecommendations, { version: 1, items: [], summary: {}, updatedAt: null });
  const optimizerState = readJson(root, ARTIFACT_PATHS.metaOptimizerState, { version: 1, frontier: {}, updatedAt: null });
  const report = fs.readFileSync(path.join(root, ARTIFACT_PATHS.metaOptimizerReport), "utf8");
  const workspaceIndex = readJson(root, ARTIFACT_PATHS.workspaceIndex, { version: 5 });

  assert.equal(result.proposalOnly, true);
  assert.ok(result.recommendations.some((item) => item.category === "review-discipline"));
  assert.ok(result.recommendations.some((item) => item.category === "experiment-integrity"));
  assert.ok(result.recommendations.some((item) => item.category === "claim-bridge"));
  assert.ok(result.recommendations.some((item) => item.category === "artifact-health"));
  assert.ok(recommendations.summary.criticalCount >= 1);
  assert.equal(optimizerState.proposalOnly, true);
  assert.equal(optimizerState.frontier.reportPath, ARTIFACT_PATHS.metaOptimizerReport);
  assert.match(report, /Proposal only: true/);
  assert.match(report, /Evidence-backed recommendations/);
  assert.equal(workspaceIndex.metaOptimize.proposalOnly, true);
  assert.equal(workspaceIndex.metaOptimize.recommendationCount, recommendations.items.length);
});

test("refreshWiki records typed relation integrity failures and exposes them through the workspace repair frontier", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Relation Frontier", objective: "Track degraded typed wiki relations." });

  registerSource(root, { citationKey: "relation-source", title: "Relation Source", authors: ["Lee"], year: 2026 });
  upsertNote(root, { noteId: "note-main", title: "Frontier note", sectionId: "introduction", sourceIds: ["relation-source"], summary: "Source-backed note." });
  writeJson(root, ARTIFACT_PATHS.sources, {
    version: 1,
    items: [{ id: "experiment-bad-exp", citationKey: "bad-exp-source", title: "Wrong endpoint type", authors: [], year: 2026, sourceType: "paper", abstract: "", origin: "manual", addedAt: new Date(0).toISOString() }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.evidence, {
    version: 3,
    claims: [{
      id: "claim-frontier",
      text: "Relation integrity should surface repair work.",
      sectionId: "introduction",
      status: "supported",
      confidence: "medium",
      sourceIds: ["missing-source"],
      noteIds: ["missing-note"],
      experimentIds: ["bad-exp"]
    }],
    updatedAt: null
  });

  refreshWiki(root);

  const relations = readJson(root, ARTIFACT_PATHS.wikiRelations, { version: 2, items: [], summary: {}, updatedAt: null });
  const workspaceIndex = queryWorkspaceIndex(root);
  const degradedRelation = relations.items.find((item) => item.id === "claim-frontier-tested-by-bad-exp");
  const degradedReasonCodes = new Set(relations.items.flatMap((item) => (item.integrity?.reasons ?? []).map((reason) => reason.code)));

  assert.equal(relations.version, 2);
  assert.equal(relations.summary.degradedCount > 0, true);
  assert.equal(degradedRelation.integrity.status, "degraded");
  assert.equal(degradedRelation.semantics.expectedToEntityType, "experiment");
  assert.equal(degradedRelation.toEntityType, "source");
  assert.ok(degradedReasonCodes.has("dangling-to-entity"));
  assert.ok(degradedReasonCodes.has("invalid-to-entity-type"));
  assert.equal(workspaceIndex.repairFrontier.relationIssueCount > 0, true);
  assert.ok(workspaceIndex.repairFrontier.prioritizedItems.some((item) => item.frontierType === "typed-wiki-relation"));
});

test("figure QA records missing staged files and source artifacts in qa.json", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  writeJson(root, ARTIFACT_PATHS.evidence, {
    version: 3,
    claims: [{ id: "claim-main", text: "Main claim" }],
    updatedAt: null
  });

  fs.writeFileSync(path.join(root, ".paper", "figures", "main-figure.template.svg"), "<svg />\n", "utf8");

  upsertFigurePlan(root, {
    items: [{
      id: "main-figure",
      sourceSections: ["introduction"],
      sourceArtifactPaths: [ARTIFACT_PATHS.findings, ".paper/research/missing-source.md"],
      targetClaimIds: ["claim-main"],
      templateSvgPath: ".paper/figures/main-figure.template.svg",
      editableSvgPath: ".paper/figures/main-figure.editable.svg",
      finalSvgPath: ".paper/figures/main-figure.final.svg"
    }]
  });

  const qa = readJson(root, ARTIFACT_PATHS.figureQa, { version: 1, items: [], issues: [], updatedAt: null });
  const issueCodes = new Set(qa.issues.map((issue) => issue.code));

  assert.ok(issueCodes.has("missing-editableSvgPath-file"));
  assert.ok(issueCodes.has("missing-finalSvgPath-file"));
  assert.ok(issueCodes.has("missing-source-artifact-2"));
  assert.equal(qa.items[0].fileChecks.stagedArtifacts.templateSvgPath.exists, true);
  assert.equal(qa.items[0].fileChecks.stagedArtifacts.editableSvgPath.exists, false);
  assert.equal(qa.items[0].fileChecks.sourceArtifacts[0].exists, true);
  assert.equal(qa.items[0].fileChecks.sourceArtifacts[1].exists, false);
});

test("validateFigurePipeline catches colliding stage paths and malformed stage contract drift", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  writeJson(root, ARTIFACT_PATHS.evidence, {
    version: 3,
    claims: [{ id: "claim-shared", text: "Shared claim" }],
    updatedAt: null
  });

  fs.writeFileSync(path.join(root, ".paper", "figures", "shared.svg"), "<svg />\n", "utf8");

  upsertFigurePlan(root, {
    items: [{
      id: "figure-a",
      sourceSections: ["introduction"],
      targetClaimIds: ["claim-shared"],
      templateSvgPath: ".paper/figures/shared.svg",
      editableSvgPath: ".paper/figures/shared.svg",
      finalSvgPath: ".paper/figures/shared.svg"
    }]
  });

  writeJson(root, ARTIFACT_PATHS.figureTemplates, {
    version: 1,
    items: [{
      ...readJson(root, ARTIFACT_PATHS.figureTemplates, { version: 1, items: [], updatedAt: null }).items[0],
      finalSvgPath: ".paper/figures/drifted.final.svg"
    }],
    updatedAt: null
  });

  validateFigurePipeline(root);

  const qa = readJson(root, ARTIFACT_PATHS.figureQa, { version: 1, items: [], issues: [], updatedAt: null });
  const issueCodes = new Set(qa.issues.map((issue) => issue.code));

  assert.ok(issueCodes.has("colliding-stage-paths"));
  assert.ok(issueCodes.has("inconsistent-template-stage-paths"));
});

test("validateFigurePipeline records malformed stage paths instead of throwing on non-string values", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  writeJson(root, ARTIFACT_PATHS.evidence, {
    version: 3,
    claims: [{ id: "claim-malformed", text: "Malformed path claim" }],
    updatedAt: null
  });

  upsertFigurePlan(root, {
    items: [{
      id: "figure-malformed",
      sourceSections: ["introduction"],
      targetClaimIds: ["claim-malformed"],
      templateSvgPath: ".paper/figures/figure-malformed.template.svg",
      editableSvgPath: ".paper/figures/figure-malformed.editable.svg",
      finalSvgPath: ".paper/figures/figure-malformed.final.svg"
    }]
  });

  const figuresIndex = readJson(root, ARTIFACT_PATHS.figuresIndex, { version: 1, items: [], updatedAt: null });
  figuresIndex.items[0].templateSvgPath = null;
  writeJson(root, ARTIFACT_PATHS.figuresIndex, figuresIndex);

  assert.doesNotThrow(() => validateFigurePipeline(root));

  const qa = readJson(root, ARTIFACT_PATHS.figureQa, { version: 1, items: [], issues: [], updatedAt: null });
  const issueCodes = new Set(qa.issues.map((issue) => issue.code));
  assert.ok(issueCodes.has("malformed-templateSvgPath"));
});

test("validateFigurePipeline records malformed non-array figure linkage fields instead of throwing", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  writeJson(root, ARTIFACT_PATHS.evidence, {
    version: 3,
    claims: [{ id: "claim-array", text: "Array claim" }],
    updatedAt: null
  });

  upsertFigurePlan(root, {
    items: [{
      id: "figure-array-malformed",
      sourceSections: ["introduction"],
      targetClaimIds: ["claim-array"],
      templateSvgPath: ".paper/figures/figure-array-malformed.template.svg",
      editableSvgPath: ".paper/figures/figure-array-malformed.editable.svg",
      finalSvgPath: ".paper/figures/figure-array-malformed.final.svg"
    }]
  });

  const figuresIndex = readJson(root, ARTIFACT_PATHS.figuresIndex, { version: 1, items: [], updatedAt: null });
  figuresIndex.items[0].sourceSections = "introduction";
  figuresIndex.items[0].targetClaimIds = { bad: true };
  figuresIndex.items[0].reviewConcernIds = "review-1";
  writeJson(root, ARTIFACT_PATHS.figuresIndex, figuresIndex);

  assert.doesNotThrow(() => validateFigurePipeline(root));

  const qa = readJson(root, ARTIFACT_PATHS.figureQa, { version: 1, items: [], issues: [], updatedAt: null });
  const issueCodes = new Set(qa.issues.map((issue) => issue.code));
  assert.ok(issueCodes.has("malformed-sourceSections"));
  assert.ok(issueCodes.has("malformed-targetClaimIds"));
  assert.ok(issueCodes.has("malformed-reviewConcernIds"));
});
