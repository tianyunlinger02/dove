import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  ARTIFACT_PATHS,
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
  sourceIdentityFingerprint,
  syncCitations,
  upsertClaims,
  upsertOrchestrationBoard,
  upsertDraft,
  upsertExperimentPlan,
  upsertExperimentResult,
  upsertFigurePlan,
  upsertNote,
  upsertOutline
} from "../../src/core/internal-api.mjs";
import { ensureTestWorkspace, runFixtureMutation } from "../helpers/mutation-fixture.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

function tempRoot() {
  return createTempRoot("dove-evidence-");
}

function writeVerifiedSources(root, items) {
  const normalized = items.map((item) => {
    const source = { ...item, lifecycle: "verified" };
    return { ...source, fingerprint: sourceIdentityFingerprint(source) };
  });
  fs.mkdirSync(path.join(root, ".dove", "sources"), { recursive: true });
  fs.writeFileSync(path.join(root, ".dove", "sources", "index.json"), JSON.stringify({ version: 2, items: normalized, updatedAt: null }, null, 2));
  fs.writeFileSync(path.join(root, ".dove", "sources", "verifications.json"), JSON.stringify({
    version: 1,
    items: normalized.map((source, index) => ({
      id: `fixture-verification-${index + 1}`,
      sourceId: source.id,
      fingerprint: source.fingerprint,
      decision: "verified",
      method: "test fixture inspected source metadata",
      checkedMaterial: "fixture title, authors, locator, and publication metadata",
      auditEvidence: [{ reference: source.locator, kind: "source", observation: `Verified fixture identity for ${source.id}.` }],
      checkedAt: new Date(0).toISOString()
    })),
    updatedAt: new Date(0).toISOString()
  }, null, 2));
}

function seedTaskPacket(root, packetId = "evidence-main-packet") {
  const timestamp = new Date(0).toISOString();
  const packet = {
    id: packetId,
    title: "Evidence integrity packet",
    summary: "Integration test packet for task-scoped writes.",
    sourceType: "test-task",
    sourceId: packetId,
    status: "pending",
    lifecycleStatus: "active",
    active: true,
    assignedRole: "builder",
    currentFocus: "Run the evidence integrity flow.",
    nextAction: "Continue the scoped evidence flow.",
    evidenceLinks: [],
    outputPaths: [],
    packetPath: `.dove/task-packets/packets/${packetId}.json`,
    packetContextPath: `.dove/context/packets/${packetId}.json`,
    updatedAt: timestamp
  };
  fs.mkdirSync(path.join(root, ".dove", "task-packets", "packets"), { recursive: true });
  fs.writeFileSync(path.join(root, packet.packetPath), `${JSON.stringify(packet, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(root, ".dove", "task-packets", "index.json"), `${JSON.stringify({ version: 3, items: [packet], lifecycleCounts: {}, dependencyHealth: {}, updatedAt: timestamp }, null, 2)}\n`, "utf8");
  return packetId;
}

test("upsertClaims rejects claims with unknown sources", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "upsertclaims-rejects-claims-with-unknown-sources", () => {
  ensureTestWorkspace(root);
  seedTaskPacket(root);
  fs.mkdirSync(path.join(root, ".dove", "sources"), { recursive: true });
  writeVerifiedSources(root, [{ id: "known-source", citationKey: "known-source", title: "Known source", authors: [], year: 2026 }]);
  upsertNote(root, {
    title: "note",
    sectionId: "introduction",
    sourceIds: ["known-source"],
    summary: "summary"
  });
  upsertOrchestrationBoard(root, { phase: "research", assignedRole: "researcher" });

  assert.throws(() => {
    upsertClaims(root, {
      claims: [{ id: "claim-1", text: "Unsupported", sectionId: "introduction", sourceIds: ["missing-source"] }]
    });
  }, /unknown sources/);
  });
});

test("strict mode blocks drafting before evidence exists", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "strict-mode-blocks-drafting-before-evidence-exists", () => {
  ensureTestWorkspace(root);
  initProject(root, { strictMode: true });
  seedTaskPacket(root);

  assert.throws(() => {
    upsertDraft(root, {
      sectionId: "introduction",
      body: "# Introduction\n\nPremature draft.\n"
    });
  }, /Strict mode requires an approved outline stage before drafting/);
  });
});

test("strict mode requires the real planning stage before outlining", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "strict-mode-requires-the-real-planning-stage-before-outlining", () => {
  ensureTestWorkspace(root);
  initProject(root, { strictMode: true });
  seedTaskPacket(root);

  assert.throws(() => {
    upsertOutline(root, {
      sections: [{ id: "introduction", title: "Introduction", status: "drafting", goal: "Goal" }]
    });
  }, /Strict mode requires planning before outlining/);
  });
});

test("upsertNote rejects unknown source references", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "upsertnote-rejects-unknown-source-references", () => {
  ensureTestWorkspace(root);
  seedTaskPacket(root);

  assert.throws(() => {
    upsertNote(root, {
      title: "bad note",
      sectionId: "introduction",
      sourceIds: ["missing-source"],
      summary: "summary"
    });
  }, /unknown sources/);
  });
});

test("upsertClaims merges claims instead of overwriting the full index", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "upsertclaims-merges-claims-instead-of-overwriting-the-full-index", () => {
  ensureTestWorkspace(root);
  seedTaskPacket(root);
  writeVerifiedSources(root, [
      { id: "source-a", citationKey: "source-a", title: "A", authors: [], year: 2024 },
      { id: "source-b", citationKey: "source-b", title: "B", authors: [], year: 2025 }
    ]);

  upsertOrchestrationBoard(root, { phase: "research", assignedRole: "researcher" });

  upsertClaims(root, {
    claims: [{ id: "claim-a", text: "Claim A", sectionId: "introduction", sourceIds: ["source-a"] }]
  });
  appendHandoff(root, {
    fromRole: "planner",
    toRole: "researcher",
    phase: "research",
    summary: "Route the next claim update to the researcher workflow.",
    nextActions: ["Merge the next claim"]
  });
  const merged = upsertClaims(root, {
    claims: [{ id: "claim-b", text: "Claim B", sectionId: "method", sourceIds: ["source-b"] }]
  });

  assert.equal(merged.claims.length, 2);
  assert.equal(loadBoard(root).currentPhase, "plan");
  });
});

test("board role metadata does not authorize evidence writes and retired overrides fail closed", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "board-role-metadata-does-not-authorize-evidence-writes-and-retired-overr", () => {
  ensureTestWorkspace(root);
  seedTaskPacket(root);
  writeVerifiedSources(root, [{ id: "source-a", citationKey: "source-a", title: "A", authors: [], year: 2024 }]);

  upsertOrchestrationBoard(root, { phase: "research", assignedRole: "builder" });
  const first = upsertClaims(root, {
    claims: [{ id: "claim-a", text: "Claim A", sectionId: "introduction", sourceIds: ["source-a"] }]
  });
  assert.equal(first.claims.length, 1);

  appendHandoff(root, {
    fromRole: "planner",
    toRole: "researcher",
    phase: "research",
    summary: "Record a different legal research routing role."
  });
  const second = upsertClaims(root, {
    claims: [{ id: "claim-b", text: "Claim B", sectionId: "method", sourceIds: ["source-a"] }]
  });
  assert.equal(second.claims.length, 2);

  assert.throws(() => upsertClaims(root, {
    claims: [{ id: "claim-c", text: "Claim C", sectionId: "results", sourceIds: ["source-a"] }],
    policyOverrideReason: "manual evidence maintenance after session recovery"
  }), /does not accept retired policy override fields/);
  });
});

test("experiment results reject unknown outcomes and mismatched claim links", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "experiment-results-reject-unknown-outcomes-and-mismatched-claim-links", () => {
  ensureTestWorkspace(root);
  seedTaskPacket(root);
  writeVerifiedSources(root, [{ id: "known-source", citationKey: "known-source", title: "Known", authors: [], year: 2026 }]);
  fs.writeFileSync(path.join(root, ".dove", "notes", "index.json"), JSON.stringify({
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
});

test("review loop flags unknown citations and draft-claim mismatches", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "review-loop-flags-unknown-citations-and-draft-claim-mismatches", () => {
  ensureTestWorkspace(root);
  seedTaskPacket(root);
  writeVerifiedSources(root, [{ id: "known-source", citationKey: "known-source", title: "Known", authors: [], year: 2026 }]);
  fs.writeFileSync(path.join(root, ".dove", "notes", "index.json"), JSON.stringify({
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
});

test("repeated review findings escalate a persistent concern while preserving reviewer-author separation", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "repeated-review-findings-escalate-a-persistent-concern-while-preserving-", () => {
  ensureTestWorkspace(root);
  seedTaskPacket(root);
  writeVerifiedSources(root, [{ id: "known-source", citationKey: "known-source", title: "Known", authors: [], year: 2026 }]);
  fs.writeFileSync(path.join(root, ".dove", "notes", "index.json"), JSON.stringify({
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
  let concerns = readJson(root, ".dove/reviews/concerns.json", { items: [] });
  const firstConcern = concerns.items.find((item) => item.summary.includes("weakly supported"));
  assert.ok(firstConcern);
  assert.equal(firstConcern.status, "awaiting-author-response");
  assert.equal(firstConcern.raisedByRole, "reviewer");
  assert.equal(firstConcern.responseOwnerRole, "researcher");

  runReviewLoop(root, { scope: "introduction", stage: "round-two" });
  concerns = readJson(root, ".dove/reviews/concerns.json", { items: [] });
  const escalatedConcern = concerns.items.find((item) => item.id === firstConcern.id);
  const reviewState = readJson(root, ".dove/reviews/REVIEW_STATE.json", {});
  assert.ok(escalatedConcern);
  assert.equal(escalatedConcern.status, "escalated");
  assert.equal(escalatedConcern.recurrenceCount, 2);
  assert.ok(reviewState.escalatedConcernIds.includes(escalatedConcern.id));
  assert.equal(reviewState.reviewerIndependence.separationMaintained, true);
  assert.ok(reviewState.reviewerIndependence.responseOwnerRoles.includes("researcher"));
  });
});

test("figure QA issues surface through the review loop and durable rebuttal surfaces", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "figure-qa-issues-surface-through-the-review-loop-and-durable-rebuttal-su", () => {
  ensureTestWorkspace(root);
  seedTaskPacket(root);
  writeVerifiedSources(root, [{ id: "known-source", citationKey: "known-source", title: "Known", authors: [], year: 2026 }]);
  fs.writeFileSync(path.join(root, ".dove/notes/index.json"), JSON.stringify({
    version: 1,
    items: [{ id: "intro-note", title: "Intro note", sectionId: "introduction", sourceIds: ["known-source"], summary: "summary" }],
    updatedAt: null
  }, null, 2));

  upsertOrchestrationBoard(root, { phase: "research", assignedRole: "researcher" });
  upsertClaims(root, {
    claims: [{ id: "claim-figure", text: "Claim with figure support", sectionId: "introduction", sourceIds: ["known-source"], noteIds: ["intro-note"] }]
  });
  upsertFigurePlan(root, {
    packetId: "evidence-main-packet",
    items: [{
      id: "broken-figure",
      name: "Broken Figure",
      sourceSections: ["missing-section"],
      targetClaimIds: [],
      reviewConcernIds: ["missing-concern"],
      rebuttalIssueIds: ["missing-issue"],
      templateSvgPath: "figures/outside.template.svg",
      finalSvgPath: ".dove/figures/broken-figure.final.svg",
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
  const concerns = readJson(root, ".dove/reviews/concerns.json", { items: [] });
  const rebuttalIssues = readJson(root, ".dove/rebuttal/issues.json", { items: [] });
  const qa = readJson(root, ".dove/figures/qa.json", { items: [], issues: [] });

  assert.equal(review.verdict, "needs-evidence");
  assert.ok(qa.issues.some((item) => item.code === "missing-claim-linkage"));
  assert.ok(qa.issues.some((item) => item.code === "non-portable-paths"));
  assert.ok(concerns.items.some((item) => item.summary.includes("has no linked target claims")));
  assert.ok(rebuttalIssues.items.some((item) => item.summary.includes("links to review or rebuttal context but has no durable review notes")));
  });
});

test("supporting results with blocked audits hold claim promotion for review", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "supporting-results-with-blocked-audits-hold-claim-promotion-for-review", () => {
  ensureTestWorkspace(root);
  seedTaskPacket(root);
  writeVerifiedSources(root, [{ id: "known-source", citationKey: "known-source", title: "Known", authors: [], year: 2026 }]);
  fs.writeFileSync(path.join(root, ".dove", "notes", "index.json"), JSON.stringify({
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
  const audits = readJson(root, ".dove/experiments/audits.json", { items: [] });
  const bridgeLog = readJson(root, ".dove/claims/bridge-log.json", { items: [] });
  const evidenceIndex = readJson(root, ".dove/evidence/index.json", { claims: [] });
  const audit = audits.items.find((item) => item.id === result.latestAuditId);
  const bridge = bridgeLog.items.find((item) => item.id === result.latestBridgeId);
  const claim = evidenceIndex.claims.find((item) => item.id === "claim-1");
  const evidence = evaluateEvidence(root);

  assert.equal(audit.auditVerdict, "blocked");
  assert.ok(audit.integrityFlags.includes("missing-evidence-links"));
  assert.ok(audit.integrityFlags.includes("missing-methodology"));
  assert.equal(bridge.mapping, "integrity-hold");
  assert.equal(bridge.bridgeStatus, "held-for-review");
  assert.equal(claim.status, "draft");
  assert.equal(claim.latestAuditVerdict ?? null, null);
  assert.equal(claim.bridgeStatus ?? null, null);
  assert.equal(claim.latestBridgeId ?? null, null);
  assert.ok(evidence.claimBridgeProblems.some((item) => item.reason === "bridge-held-for-review"));
  });
});



test("finalization is blocked while claim bridges remain held for review", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "finalization-is-blocked-while-claim-bridges-remain-held-for-review", () => {
  ensureTestWorkspace(root);
  const packetId = seedTaskPacket(root);
  writeVerifiedSources(root, [{ id: "known-source", citationKey: "known-source", title: "Known", authors: [], year: 2026 }]);
  fs.writeFileSync(path.join(root, ".dove/notes/index.json"), JSON.stringify({
    version: 1,
    items: [{ id: "intro-note", title: "Intro note", sectionId: "introduction", sourceIds: ["known-source"], summary: "summary" }],
    updatedAt: null
  }, null, 2));

  upsertOrchestrationBoard(root, { phase: "research", assignedRole: "researcher" });
  upsertClaims(root, {
    packetId,
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
    packetId,
    stage: "integrity-override",
    scope: "blocked bridge check",
    verdict: "coherent",
    summary: "Manually recorded coherent verdict to test finalize gating by claim bridges.",
    reviewedArtifactPaths: [ARTIFACT_PATHS.claims],
    autoGeneratedReviewReport: true,
    findings: [],
    actionItems: []
  });

  appendHandoff(root, {
    fromRole: "reviewer",
    toRole: "version-analyst",
    phase: "versions",
    summary: "Attempt to move to versioning after gated coherent review.",
    nextActions: ["Create blocked-version"]
  });

  assert.throws(() => {
    createVersionSnapshot(root, { packetId, versionId: "blocked-version" });
  }, /held for review|bridge|integrity/);
  });
});
test("citation sync writes references and wiki/rebuttal helpers create artifacts", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "citation-sync-writes-references-and-wiki-rebuttal-helpers-create-artifac", () => {
  ensureTestWorkspace(root);
  seedTaskPacket(root);
  writeVerifiedSources(root, [{ id: "known-source", citationKey: "known-source", title: "Known", authors: ["Doe"], year: 2026, sourceType: "paper" }]);
  fs.writeFileSync(path.join(root, ".dove", "notes", "index.json"), JSON.stringify({
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
  const bib = fs.readFileSync(path.join(root, ".dove", "bibliography", "references.bib"), "utf8");
  assert.match(bib, /@article\{known-source/);

  const wiki = refreshWiki(root);
  assert.equal(wiki.wikiPath, ".dove/wiki/index.md");
  });
});
