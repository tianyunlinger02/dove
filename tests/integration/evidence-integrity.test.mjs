import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  appendHandoff,
  appendReviewLog,
  createVersionSnapshot,
  ensureWorkspace,
  evaluateEvidence,
  initProject,
  loadBoard,
  readJson,
  refreshWiki,
  runReviewLoop,
  syncCitations,
  upsertClaims,
  upsertOrchestrationBoard,
  upsertDraft,
  upsertExperimentPlan,
  upsertExperimentResult,
  upsertFigurePlan,
  upsertNote,
  upsertOutline
} from "../../src/core/index.mjs";

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "paper-factory-evidence-"));
}

test("upsertClaims rejects claims with unknown sources", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  upsertNote(root, {
    title: "note",
    sectionId: "introduction",
    summary: "summary"
  });

  assert.throws(() => {
    upsertClaims(root, {
      claims: [{ id: "claim-1", text: "Unsupported", sectionId: "introduction", sourceIds: ["missing-source"] }]
    });
  }, /unknown sources/);
});

test("strict mode blocks drafting before evidence exists", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { strictMode: true });

  assert.throws(() => {
    upsertDraft(root, {
      sectionId: "introduction",
      body: "# Introduction\n\nPremature draft.\n"
    });
  }, /Strict mode requires an approved outline stage before drafting/);
});

test("strict mode requires the real planning stage before outlining", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { strictMode: true });

  assert.throws(() => {
    upsertOutline(root, {
      sections: [{ id: "introduction", title: "Introduction", status: "drafting", goal: "Goal" }]
    });
  }, /Strict mode requires planning before outlining/);
});

test("upsertNote rejects unknown source references", () => {
  const root = tempRoot();
  ensureWorkspace(root);

  assert.throws(() => {
    upsertNote(root, {
      title: "bad note",
      sectionId: "introduction",
      sourceIds: ["missing-source"],
      summary: "summary"
    });
  }, /unknown sources/);
});

test("upsertClaims merges claims instead of overwriting the full index", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  fs.writeFileSync(path.join(root, ".paper", "sources", "index.json"), JSON.stringify({
    version: 1,
    items: [
      { id: "source-a", citationKey: "source-a", title: "A", authors: [], year: 2024 },
      { id: "source-b", citationKey: "source-b", title: "B", authors: [], year: 2025 }
    ],
    updatedAt: null
  }, null, 2));

  upsertOrchestrationBoard(root, { phase: "research", assignedRole: "researcher" });

  upsertClaims(root, {
    claims: [{ id: "claim-a", text: "Claim A", sectionId: "introduction", sourceIds: ["source-a"] }]
  });
  appendHandoff(root, {
    fromRole: "planner",
    toRole: "researcher",
    phase: "research",
    summary: "Return ownership to the researcher for the next claim update.",
    nextActions: ["Merge the next claim"]
  });
  const merged = upsertClaims(root, {
    claims: [{ id: "claim-b", text: "Claim B", sectionId: "method", sourceIds: ["source-b"] }]
  });

  assert.equal(merged.claims.length, 2);
  assert.equal(loadBoard(root).currentPhase, "plan");
});

test("role-bound evidence writes require ownership unless an override reason is supplied", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  fs.writeFileSync(path.join(root, ".paper", "sources", "index.json"), JSON.stringify({
    version: 1,
    items: [{ id: "source-a", citationKey: "source-a", title: "A", authors: [], year: 2024 }],
    updatedAt: null
  }, null, 2));

  assert.throws(() => {
    upsertClaims(root, {
      claims: [{ id: "claim-a", text: "Claim A", sectionId: "introduction", sourceIds: ["source-a"] }]
    });
  }, /requires board role researcher/);

  const overridden = upsertClaims(root, {
    claims: [{ id: "claim-a", text: "Claim A", sectionId: "introduction", sourceIds: ["source-a"] }],
    policyOverrideReason: "manual evidence maintenance after session recovery"
  });

  assert.equal(overridden.claims.length, 1);
  assert.equal(loadBoard(root).assignedRole, "planner");
});

test("experiment results reject unknown outcomes and mismatched claim links", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  fs.writeFileSync(path.join(root, ".paper", "sources", "index.json"), JSON.stringify({
    version: 1,
    items: [{ id: "known-source", citationKey: "known-source", title: "Known", authors: [], year: 2026 }],
    updatedAt: null
  }, null, 2));
  fs.writeFileSync(path.join(root, ".paper", "notes", "index.json"), JSON.stringify({
    version: 1,
    items: [{ id: "intro-note", title: "Intro note", sectionId: "introduction", sourceIds: ["known-source"], summary: "summary" }],
    updatedAt: null
  }, null, 2));
  upsertOrchestrationBoard(root, { phase: "research", assignedRole: "researcher" });
  upsertClaims(root, {
    claims: [{ id: "claim-1", text: "Claim 1", sectionId: "introduction", sourceIds: ["known-source"], noteIds: ["intro-note"] }]
  });
  appendHandoff(root, {
    fromRole: "planner",
    toRole: "experiment-planner",
    phase: "experiments",
    summary: "Move into experiment planning.",
    nextActions: ["Write the experiment plan"]
  });
  upsertExperimentPlan(root, {
    id: "exp-1",
    title: "Experiment 1",
    claimId: "claim-1",
    methodology: "Method",
    successMetric: "Metric"
  });
  const preservedPlan = upsertExperimentPlan(root, {
    id: "exp-1",
    status: "in-progress"
  });
  assert.equal(preservedPlan.claimId, "claim-1");

  assert.throws(() => {
    upsertExperimentResult(root, {
      experimentId: "exp-1",
      claimId: "claim-1",
      outcome: "mystery"
    });
  }, /invalid outcome/);

  assert.throws(() => {
    upsertExperimentResult(root, {
      experimentId: "exp-1",
      claimId: "claim-2",
      outcome: "supports"
    });
  }, /unknown claim/);

  assert.throws(() => {
    upsertExperimentResult(root, {
      experimentId: "exp-1",
      outcome: "supports"
    });
  }, /must include claimId/);
});

test("review loop flags unknown citations and draft-claim mismatches", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  fs.writeFileSync(path.join(root, ".paper", "sources", "index.json"), JSON.stringify({
    version: 1,
    items: [{ id: "known-source", citationKey: "known-source", title: "Known", authors: [], year: 2026 }],
    updatedAt: null
  }, null, 2));
  fs.writeFileSync(path.join(root, ".paper", "notes", "index.json"), JSON.stringify({
    version: 1,
    items: [{ id: "intro-note", title: "Intro note", sectionId: "introduction", sourceIds: ["known-source"], summary: "summary" }],
    updatedAt: null
  }, null, 2));

  upsertOrchestrationBoard(root, { phase: "research", assignedRole: "researcher" });

  upsertClaims(root, {
    claims: [{ id: "claim-1", text: "Claim 1", sectionId: "introduction", sourceIds: ["known-source"], noteIds: ["intro-note"] }]
  });
  upsertDraft(root, {
    sectionId: "introduction",
    body: "# Introduction\n\nThis section cites [cite:unknown-source].\n"
  });

  const evidence = evaluateEvidence(root);
  assert.equal(evidence.missingCitationRefs.length, 1);
  assert.equal(evidence.draftClaimMismatches.length, 1);

  appendHandoff(root, {
    fromRole: "researcher",
    toRole: "reviewer",
    phase: "review",
    summary: "Move into review after drafting.",
    nextActions: ["Run the review loop"]
  });
  const review = runReviewLoop(root, { scope: "introduction" });
  assert.equal(review.verdict, "needs-evidence");
});

test("repeated review findings escalate a persistent concern while preserving reviewer-author separation", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  fs.writeFileSync(path.join(root, ".paper", "sources", "index.json"), JSON.stringify({
    version: 1,
    items: [{ id: "known-source", citationKey: "known-source", title: "Known", authors: [], year: 2026 }],
    updatedAt: null
  }, null, 2));
  fs.writeFileSync(path.join(root, ".paper", "notes", "index.json"), JSON.stringify({
    version: 1,
    items: [{ id: "intro-note", title: "Intro note", sectionId: "introduction", sourceIds: ["known-source"], summary: "summary" }],
    updatedAt: null
  }, null, 2));

  upsertOrchestrationBoard(root, { phase: "research", assignedRole: "researcher" });
  upsertClaims(root, {
    claims: [{ id: "claim-weak", text: "Claim 1", sectionId: "introduction", sourceIds: ["known-source"], noteIds: ["intro-note"] }]
  });

  appendHandoff(root, {
    fromRole: "planner",
    toRole: "reviewer",
    phase: "review",
    summary: "Move into review after the initial claim pass.",
    nextActions: ["Run the review loop twice to verify persistence"]
  });

  runReviewLoop(root, { scope: "introduction", stage: "round-one" });
  let concerns = readJson(root, ".paper/reviews/concerns.json", { items: [] });
  const firstConcern = concerns.items.find((item) => item.summary.includes("weakly supported"));
  assert.ok(firstConcern);
  assert.equal(firstConcern.status, "awaiting-author-response");
  assert.equal(firstConcern.raisedByRole, "reviewer");
  assert.equal(firstConcern.responseOwnerRole, "researcher");

  appendHandoff(root, {
    fromRole: "rebuttal-lead",
    toRole: "reviewer",
    phase: "review",
    summary: "Return to reviewer for the next review round.",
    nextActions: ["Re-run the review loop and escalate persistent concerns"]
  });

  runReviewLoop(root, { scope: "introduction", stage: "round-two" });
  concerns = readJson(root, ".paper/reviews/concerns.json", { items: [] });
  const escalatedConcern = concerns.items.find((item) => item.id === firstConcern.id);
  const reviewState = readJson(root, ".paper/reviews/REVIEW_STATE.json", {});
  assert.ok(escalatedConcern);
  assert.equal(escalatedConcern.status, "escalated");
  assert.equal(escalatedConcern.recurrenceCount, 2);
  assert.ok(reviewState.escalatedConcernIds.includes(escalatedConcern.id));
  assert.equal(reviewState.reviewerIndependence.separationMaintained, true);
  assert.ok(reviewState.reviewerIndependence.responseOwnerRoles.includes("researcher"));
});

test("figure QA issues surface through the review loop and durable rebuttal surfaces", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  fs.writeFileSync(path.join(root, ".paper/sources/index.json"), JSON.stringify({
    version: 1,
    items: [{ id: "known-source", citationKey: "known-source", title: "Known", authors: [], year: 2026 }],
    updatedAt: null
  }, null, 2));
  fs.writeFileSync(path.join(root, ".paper/notes/index.json"), JSON.stringify({
    version: 1,
    items: [{ id: "intro-note", title: "Intro note", sectionId: "introduction", sourceIds: ["known-source"], summary: "summary" }],
    updatedAt: null
  }, null, 2));

  upsertOrchestrationBoard(root, { phase: "research", assignedRole: "researcher" });
  upsertClaims(root, {
    claims: [{ id: "claim-figure", text: "Claim with figure support", sectionId: "introduction", sourceIds: ["known-source"], noteIds: ["intro-note"] }]
  });
  upsertFigurePlan(root, {
    items: [{
      id: "broken-figure",
      name: "Broken Figure",
      sourceSections: ["missing-section"],
      targetClaimIds: [],
      reviewConcernIds: ["missing-concern"],
      rebuttalIssueIds: ["missing-issue"],
      templateSvgPath: "figures/outside.template.svg",
      finalSvgPath: ".paper/figures/broken-figure.final.svg",
      requiredVisualElements: ["overview panel"]
    }]
  });

  appendHandoff(root, {
    fromRole: "planner",
    toRole: "reviewer",
    phase: "review",
    summary: "Move into review to inspect figure QA surfaces.",
    nextActions: ["Run the review loop"]
  });

  const review = runReviewLoop(root, { scope: "figure qa" });
  const concerns = readJson(root, ".paper/reviews/concerns.json", { items: [] });
  const rebuttalIssues = readJson(root, ".paper/rebuttal/issues.json", { items: [] });
  const qa = readJson(root, ".paper/figures/qa.json", { items: [], issues: [] });

  assert.equal(review.verdict, "needs-evidence");
  assert.ok(qa.issues.some((item) => item.code === "missing-claim-linkage"));
  assert.ok(qa.issues.some((item) => item.code === "non-portable-paths"));
  assert.ok(concerns.items.some((item) => item.summary.includes("has no linked target claims")));
  assert.ok(rebuttalIssues.items.some((item) => item.summary.includes("links to review or rebuttal context but has no durable review notes")));
});

test("supporting results with blocked audits hold claim promotion for review", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  fs.writeFileSync(path.join(root, ".paper", "sources", "index.json"), JSON.stringify({
    version: 1,
    items: [{ id: "known-source", citationKey: "known-source", title: "Known", authors: [], year: 2026 }],
    updatedAt: null
  }, null, 2));
  fs.writeFileSync(path.join(root, ".paper", "notes", "index.json"), JSON.stringify({
    version: 1,
    items: [{ id: "intro-note", title: "Intro note", sectionId: "introduction", sourceIds: ["known-source"], summary: "summary" }],
    updatedAt: null
  }, null, 2));

  upsertOrchestrationBoard(root, { phase: "research", assignedRole: "researcher" });
  upsertClaims(root, {
    claims: [{ id: "claim-1", text: "Claim 1", sectionId: "introduction", sourceIds: ["known-source"], noteIds: ["intro-note"] }]
  });
  appendHandoff(root, {
    fromRole: "planner",
    toRole: "experiment-planner",
    phase: "experiments",
    summary: "Move into experiment planning.",
    nextActions: ["Record a result with missing audit provenance"]
  });
  upsertExperimentPlan(root, {
    id: "exp-integrity",
    title: "Experiment integrity hold",
    claimId: "claim-1"
  });

  const result = upsertExperimentResult(root, {
    experimentId: "exp-integrity",
    claimId: "claim-1",
    outcome: "supports"
  });
  const audits = readJson(root, ".paper/experiments/audits.json", { items: [] });
  const bridgeLog = readJson(root, ".paper/claims/bridge-log.json", { items: [] });
  const evidenceIndex = readJson(root, ".paper/evidence/index.json", { claims: [] });
  const audit = audits.items.find((item) => item.id === result.latestAuditId);
  const bridge = bridgeLog.items.find((item) => item.id === result.latestBridgeId);
  const claim = evidenceIndex.claims.find((item) => item.id === "claim-1");
  const evidence = evaluateEvidence(root);

  assert.equal(audit.auditVerdict, "blocked");
  assert.ok(audit.integrityFlags.includes("missing-evidence-links"));
  assert.ok(audit.integrityFlags.includes("missing-methodology"));
  assert.equal(bridge.mapping, "integrity-hold");
  assert.equal(bridge.bridgeStatus, "held-for-review");
  assert.equal(claim.status, "needs-review");
  assert.equal(claim.latestAuditVerdict, "blocked");
  assert.equal(claim.bridgeStatus, "held-for-review");
  assert.ok(evidence.claimBridgeProblems.some((item) => item.reason === "bridge-held-for-review"));
});



test("finalization is blocked while claim bridges remain held for review", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  fs.writeFileSync(path.join(root, ".paper/sources/index.json"), JSON.stringify({
    version: 1,
    items: [{ id: "known-source", citationKey: "known-source", title: "Known", authors: [], year: 2026 }],
    updatedAt: null
  }, null, 2));
  fs.writeFileSync(path.join(root, ".paper/notes/index.json"), JSON.stringify({
    version: 1,
    items: [{ id: "intro-note", title: "Intro note", sectionId: "introduction", sourceIds: ["known-source"], summary: "summary" }],
    updatedAt: null
  }, null, 2));

  upsertOrchestrationBoard(root, { phase: "research", assignedRole: "researcher" });
  upsertClaims(root, {
    claims: [{ id: "claim-1", text: "Claim 1", sectionId: "introduction", sourceIds: ["known-source"], noteIds: ["intro-note"] }]
  });

  appendHandoff(root, {
    fromRole: "planner",
    toRole: "experiment-planner",
    phase: "experiments",
    summary: "Move into experiment planning for blocked bridge check.",
    nextActions: ["Record experiment result with blocked audit"]
  });

  upsertExperimentPlan(root, {
    id: "exp-blocked",
    title: "Blocked integrity experiment",
    claimId: "claim-1"
  });

  upsertExperimentResult(root, {
    experimentId: "exp-blocked",
    claimId: "claim-1",
    outcome: "supports"
  });

  appendHandoff(root, {
    fromRole: "experiment-planner",
    toRole: "reviewer",
    phase: "review",
    summary: "Reviewer signoff requested, then versioning should be blocked by held bridges.",
    nextActions: ["Run a coherent review entry to exercise finalize gate path"]
  });

  appendReviewLog(root, {
    stage: "integrity-override",
    scope: "blocked bridge check",
    verdict: "coherent",
    summary: "Manually recorded coherent verdict to test finalize gating by claim bridges.",
    findings: [],
    actionItems: [],
    reviewRequiredBeforeFinalize: true
  });

  appendHandoff(root, {
    fromRole: "reviewer",
    toRole: "version-analyst",
    phase: "versions",
    summary: "Attempt to move to versioning after gated coherent review.",
    nextActions: ["Create blocked-version"]
  });

  assert.throws(() => {
    createVersionSnapshot(root, { versionId: "blocked-version" });
  }, /held for review|bridge|integrity/);
});
test("citation sync writes references and wiki/rebuttal helpers create artifacts", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  fs.writeFileSync(path.join(root, ".paper", "sources", "index.json"), JSON.stringify({
    version: 1,
    items: [{ id: "known-source", citationKey: "known-source", title: "Known", authors: ["Doe"], year: 2026, sourceType: "paper" }],
    updatedAt: null
  }, null, 2));
  fs.writeFileSync(path.join(root, ".paper", "notes", "index.json"), JSON.stringify({
    version: 1,
    items: [{ id: "intro-note", title: "Intro note", sectionId: "introduction", sourceIds: ["known-source"], summary: "summary" }],
    updatedAt: null
  }, null, 2));

  upsertDraft(root, {
    sectionId: "introduction",
    body: "# Introduction\n\nSupported text [cite:known-source].\n"
  });

  const citations = syncCitations(root, { citedOnly: true });
  assert.equal(citations.missingKeys.length, 0);
  const bib = fs.readFileSync(path.join(root, ".paper", "bibliography", "references.bib"), "utf8");
  assert.match(bib, /@article\{known-source/);

  const wiki = refreshWiki(root);
  assert.equal(wiki.wikiPath, ".paper/wiki/index.md");
});
