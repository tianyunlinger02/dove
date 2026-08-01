import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { createDoveMission, startDoveSkillMission } from "../../src/core/mission-contracts.mjs";
import { ingestExecutionReceipt } from "../../src/core/execution-receipts.mjs";
import { runWithMutationContext } from "../../src/core/mutation-backend.mjs";
import { reviewMissionBinding } from "../../src/core/review-mission-binding.mjs";
import { archiveReviewRecord, queryReviewRecords, resolveCurrentReviewFinding, scopeReviewRecord } from "../../src/core/review-records.mjs";
import { openDoveWorkspace } from "../../src/core/workspace-schema.mjs";
import { dispatchTool } from "../../src/mcp/handlers.mjs";
import { initializeWorkspace } from "../helpers/current-schema-workspace.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

function write(root, relativePath, content) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}

function sha256(root, relativePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(path.join(root, relativePath))).digest("hex");
}

function tree(root) {
  const output = {};
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(fullPath);
      else output[path.relative(root, fullPath).split(path.sep).join("/")] = fs.readFileSync(fullPath).toString("base64");
    }
  };
  visit(root);
  return output;
}

function mutate(root, actionId, callback) {
  return runWithMutationContext(root, { actionId, mutationMode: "direct-process", hostId: "test" }, callback);
}

function setup(missionId = "review-mission") {
  const root = createTempRoot("dove-review-record-");
  initializeWorkspace(root);
  const proposal = createDoveMission(root, {
    mode: "research", missionId, goal: "Review the current result.",
    artifacts: [{ path: "outputs/result.md", required: true, role: "output" }],
    completionCriteria: ["The result is current."], evidenceRequirements: []
  });
  const mission = mutate(root, "create-dove-mission", () => createDoveMission(root, proposal.confirmation.confirmArgs)).mission;
  write(root, "outputs/result.md", "# Current result\n\nThe result preserves uncertainty.\n");
  write(root, "outputs/appendix.md", "# Appendix\n\nSupporting material.\n");
  mutate(root, "ingest-execution-receipt", () => ingestExecutionReceipt(root, {
    receiptId: "seed-review-artifacts", missionId: mission.missionId, contractDigest: mission.contractDigest,
    summary: "Own the review artifacts.",
    artifacts: ["outputs/result.md", "outputs/appendix.md"].map((artifactPath) => ({ path: artifactPath, kind: "document", sha256: sha256(root, artifactPath) })),
    validations: [], criteriaSatisfied: [], producedAt: new Date().toISOString()
  }));
  const binding = reviewMissionBinding(openDoveWorkspace(root), mission);
  return { root, mission, reviewMissionBinding: binding };
}

function childMission(root, parentMissionId, missionId) {
  const proposal = createDoveMission(root, {
    operation: "create-child", mode: "research", missionId, parentMissionId,
    branchKind: "follow-up", branchReason: "Create a bounded Review-related child.",
    goal: `Work in ${missionId}.`, completionCriteria: ["The bounded child work is recorded."], evidenceRequirements: []
  });
  return mutate(root, "create-dove-mission", () => createDoveMission(root, proposal.confirmation.confirmArgs)).mission;
}

function scope(root, missionId, artifactPaths = ["outputs/result.md"], hostKind = "claude") {
  const workspace = openDoveWorkspace(root);
  return scopeReviewRecord(root, { missionId, reviewMissionBinding: reviewMissionBinding(workspace, workspace.missions.get(missionId)), artifactPaths, hostKind });
}

function archiveArgs(scoped, overrides = {}) {
  return {
    missionId: scoped.scopeBinding.missionId,
    scopeBinding: scoped.scopeBinding,
    status: "completed",
    verdict: "needs-revision",
    summary: "The result needs a clearer limitation.",
    findings: [{ findingId: "missing-limitation", severity: "medium", summary: "The limitation is not explicit.", linkedArtifactPaths: ["outputs/result.md"] }],
    actionItems: ["Add the limitation."],
    report: "# Review report\n\nAdd the limitation.\n",
    provenance: { hostKind: scoped.scopeBinding.hostKind, reviewedAt: "2026-01-01T00:00:00.000Z" },
    ...overrides
  };
}

test("Review Skill start issues the exact opaque Mission binding required by scope", () => {
  const { root, mission } = setup("review-parent");
  const started = mutate(root, "create-dove-mission", () => startDoveSkillMission(root, {
    operation: "start-skill", skill: "review", parentMissionId: mission.missionId,
    goal: "Independently review the current result.", completionCriteria: ["The frozen scope receives one structured Reviewer return."], evidenceRequirements: []
  }));
  assert.match(started.reviewMissionBinding, /^review-mission-v1-[a-f0-9]{64}$/u);
  const scoped = scopeReviewRecord(root, {
    missionId: started.mission.missionId,
    reviewMissionBinding: started.reviewMissionBinding,
    hostKind: "claude",
    artifactPaths: ["outputs/result.md"]
  });
  assert.equal(scoped.zeroWrite, true);
  assert.throws(() => scopeReviewRecord(root, {
    missionId: started.mission.missionId,
    reviewMissionBinding: `review-mission-v1-${"0".repeat(64)}`,
    hostKind: "claude",
    artifactPaths: ["outputs/result.md"]
  }), /not bound.*Review Skill start/u);
});

test("scope is strict zero-write and returns a machine-only native launch contract", () => {
  const { root, mission } = setup();
  const before = tree(root);
  const result = scope(root, mission.missionId, ["outputs/result.md", "outputs/appendix.md"]);
  assert.equal(result.zeroWrite, true);
  assert.deepEqual(result.reviewedArtifactPaths, ["outputs/appendix.md", "outputs/result.md"]);
  assert.equal(result.reviewerLaunch.exactlyOnce, true);
  assert.equal(result.reviewerLaunch.freshContext, true);
  assert.equal(result.reviewerLaunch.readOnly, true);
  assert.equal(result.reviewerLaunch.synchronous, true);
  assert.equal(result.reviewerLaunch.mcpAgentLaunch, false);
  assert.deepEqual(tree(root), before);
});

test("scope rejects unsafe, unowned, aliased, and unsupported-host artifacts", () => {
  const { root, mission } = setup();
  assert.throws(() => scope(root, mission.missionId, ["../outside.md"]), /unsafe path|escapes/u);
  assert.throws(() => scope(root, mission.missionId, ["outputs/missing.md"]), /usable file|existing/u);
  write(root, "outputs/result-alias.md", "alias");
  fs.unlinkSync(path.join(root, "outputs/result-alias.md"));
  fs.symlinkSync("result.md", path.join(root, "outputs/result-alias.md"));
  assert.throws(() => scope(root, mission.missionId, ["outputs/result-alias.md"]), /canonical|alias|real path/u);
  write(root, "outputs/unowned.md", "not receipt-owned");
  assert.throws(() => scope(root, mission.missionId, ["outputs/unowned.md"]), /registered|owned/u);
  assert.throws(() => scope(root, mission.missionId, ["outputs/result.md", "outputs/result.md"]), /duplicates|duplicate|ambiguous/u);
  assert.throws(() => scope(root, mission.missionId, ["outputs/result.md"], "codex"), /dedicated native Reviewer/u);
  fs.appendFileSync(path.join(root, "outputs/result.md"), "drift\n");
  assert.throws(() => scope(root, mission.missionId), /changed since.*ownership receipt/u);
});

test("scope accepts ancestor ownership and rejects sibling ownership", () => {
  const { root, mission } = setup("parent-mission");
  const reviewChild = childMission(root, mission.missionId, "review-child");
  const sibling = childMission(root, mission.missionId, "sibling-child");
  assert.equal(scope(root, reviewChild.missionId).zeroWrite, true);
  write(root, "outputs/sibling.md", "Sibling-only artifact.\n");
  mutate(root, "ingest-execution-receipt", () => ingestExecutionReceipt(root, {
    receiptId: "seed-sibling-artifact", missionId: sibling.missionId, contractDigest: sibling.contractDigest,
    summary: "Own the sibling artifact.", artifacts: [{ path: "outputs/sibling.md", kind: "document", sha256: sha256(root, "outputs/sibling.md") }],
    validations: [], criteriaSatisfied: [], producedAt: new Date().toISOString()
  }));
  assert.throws(() => scope(root, reviewChild.missionId, ["outputs/sibling.md"]), /not.*ancestor|belongs to mission/u);
});

test("archive writes exactly Review JSON, report, and Receipt and never mints authority", () => {
  const { root, mission } = setup();
  const scoped = scope(root, mission.missionId);
  const result = mutate(root, "archive-review-record", () => archiveReviewRecord(root, archiveArgs(scoped)));
  assert.equal(result.status, "archived");
  assert.equal(result.review.authority, "not-established");
  assert.equal(Object.hasOwn(result.review, "issuer"), false);
  assert.equal(Object.hasOwn(result.review, "signoff"), false);
  assert.equal(Object.hasOwn(result.review, "authoritative"), false);
  assert.deepEqual(result.mutation.writesApplied ? result.mutation.paths.sort() : [], [result.reviewPath, result.reportPath, `.dove/receipts/execution/${result.review.receiptId}.json`].sort());
  assert.deepEqual(fs.readdirSync(path.join(root, ".dove/reviews")).filter((name) => name.startsWith("review-")).sort(), [path.basename(result.reportPath), path.basename(result.reviewPath)].sort());
});

test("archive validates status/verdict and finding links", () => {
  const { root, mission } = setup();
  const scoped = scope(root, mission.missionId);
  assert.throws(() => mutate(root, "archive-review-record", () => archiveReviewRecord(root, archiveArgs(scoped, { status: "completed", verdict: "blocked" }))), /completed review.*coherent|needs-revision|needs-evidence/u);
  assert.throws(() => mutate(root, "archive-review-record", () => archiveReviewRecord(root, archiveArgs(scoped, { verdict: "needs-evidence", findings: [], actionItems: [] }))), /requires at least one/u);
  assert.throws(() => mutate(root, "archive-review-record", () => archiveReviewRecord(root, archiveArgs(scoped, { findings: [{ findingId: "outside", severity: "high", summary: "bad", linkedArtifactPaths: ["outputs/other.md"] }] }))), /outside.*scope/u);
});

test("completed, blocked, and failed Reviewer returns archive with consistent verdicts", () => {
  for (const [suffix, status, verdict] of [["completed", "completed", "coherent"], ["blocked", "blocked", "blocked"], ["failed", "failed", "blocked"]]) {
    const { root, mission } = setup(`review-${suffix}`);
    const scoped = scope(root, mission.missionId);
    const result = mutate(root, "archive-review-record", () => archiveReviewRecord(root, archiveArgs(scoped, {
      status, verdict, findings: [], actionItems: [], summary: `${status} Reviewer return.`
    })));
    assert.equal(result.review.status, status);
    assert.equal(result.review.verdict, verdict);
    assert.equal(result.review.authority, "not-established");
  }
});

test("archive exact replay is zero-write and changed replay fails", () => {
  const { root, mission } = setup();
  const scoped = scope(root, mission.missionId);
  const first = mutate(root, "archive-review-record", () => archiveReviewRecord(root, archiveArgs(scoped)));
  const before = tree(root);
  const replay = archiveReviewRecord(root, archiveArgs(scoped));
  assert.equal(replay.status, "replayed");
  assert.equal(replay.zeroWrite, true);
  assert.deepEqual(tree(root), before);
  assert.throws(() => archiveReviewRecord(root, archiveArgs(scoped, { summary: "Changed return." })), /different immutable archive/u);
  assert.equal(first.review.reviewId, replay.review.reviewId);
});

test("archive rejects scope drift and current finding resolution ignores stale archives", () => {
  const { root, mission } = setup();
  const scoped = scope(root, mission.missionId);
  const archived = mutate(root, "archive-review-record", () => archiveReviewRecord(root, archiveArgs(scoped)));
  assert.throws(() => resolveCurrentReviewFinding(root, {
    missionId: mission.missionId,
    reviewPath: `.dove/reviews/../reviews/${path.posix.basename(archived.reviewPath)}`,
    findingId: "missing-limitation"
  }), /canonical Review archive path/u);
  fs.appendFileSync(path.join(root, "outputs/result.md"), "\nDrift.\n");
  assert.throws(() => archiveReviewRecord(root, archiveArgs(scoped)), /stale|current|changed/u);
  const queried = queryReviewRecords(root, { missionId: mission.missionId });
  assert.equal(queried.currentCount, 0);
  assert.equal(queried.staleCount, 1);
  assert.equal(resolveCurrentReviewFinding(root, { missionId: mission.missionId, reviewPath: ".dove/reviews/review-" + "0".repeat(24) + ".json", findingId: "missing-limitation" }), null);
});

test("MCP scope returns launch control without launching an agent", () => {
  const { root, mission, reviewMissionBinding: binding } = setup();
  const result = dispatchTool(root, "manage_dove_review", { operation: "scope", missionNumber: 1, reviewMissionBinding: binding, hostKind: "claude", artifactPaths: ["outputs/result.md"] });
  assert.equal(result.structuredContent.hostControl.reviewerLaunch.exactlyOnce, true);
  assert.equal(result.structuredContent.hostControl.reviewerLaunch.mcpAgentLaunch, false);
  assert.equal(Object.hasOwn(result.structuredContent.report, "scopeBinding"), false);
  assert.equal(result.structuredContent.hostControl.reviewerLaunch.scopeBinding.missionId, mission.missionId);
});

test("MCP archive is sealed, atomic, and preserves current findings for author-side reference", () => {
  const { root, mission } = setup();
  const scoped = scope(root, mission.missionId);
  const input = {
    operation: "archive", missionNumber: 1, scopeBinding: scoped.scopeBinding,
    status: "completed", verdict: "needs-revision", summary: "Clarify the limitation.",
    findings: [{ findingId: "mcp-finding", severity: "medium", summary: "The limitation is implicit.", linkedArtifactPaths: ["outputs/result.md"] }],
    actionItems: ["State the limitation."], report: "# MCP Review\n\nState the limitation.\n",
    provenance: { hostKind: "claude", reviewedAt: "2026-01-01T00:00:00.000Z" }
  };
  const archived = dispatchTool(root, "manage_dove_review", input);
  assert.equal(archived.isError, undefined);
  assert.equal(archived.structuredContent.report.review.authority, "not-established");
  assert.equal(Object.hasOwn(archived.structuredContent.hostControl, "reviewerLaunch"), false);
  const reviewPath = fs.readdirSync(path.join(root, ".dove/reviews")).find((name) => name.endsWith(".json"));
  const resolved = resolveCurrentReviewFinding(root, { missionId: mission.missionId, reviewPath: `.dove/reviews/${reviewPath}`, findingId: "mcp-finding" });
  assert.equal(resolved.finding.summary, "The limitation is implicit.");
  assert.equal(resolved.authority, "not-established");

  const before = tree(root);
  const rejected = dispatchTool(root, "manage_dove_review", { ...input, issuer: "caller" });
  assert.equal(rejected.isError, true);
  assert.deepEqual(tree(root), before);
});
