import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { createDoveMission } from "../../src/core/mission-contracts.mjs";
import { ingestExecutionReceipt } from "../../src/core/execution-receipts.mjs";
import { runWithMutationContext } from "../../src/core/mutation-backend.mjs";
import { stableSnapshotSetHash } from "../../src/core/review-artifact-snapshot.mjs";
import { importReviewExchange, prepareReviewExchange, verifyExpectedReviewCoverage, verifyReviewCoverage } from "../../src/core/review-exchange.mjs";
import { dispatchTool } from "../../src/mcp/handlers.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

const ROOT = process.cwd();
const CLI = path.join(ROOT, "bin", "dove.mjs");

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
      else if (entry.isFile()) output[path.relative(root, fullPath).split(path.sep).join("/")] = fs.readFileSync(fullPath).toString("base64");
      else output[path.relative(root, fullPath).split(path.sep).join("/")] = `special:${entry.name}`;
    }
  };
  visit(root);
  return output;
}

function mutate(root, actionId, callback, mutationMode = "direct-process") {
  return runWithMutationContext(root, { actionId, mutationMode, hostId: "test" }, callback);
}

function setup(missionId = "review-mission") {
  const root = createTempRoot("dove-review-exchange-");
  const proposal = createDoveMission(root, {
    missionId,
    goal: "Review the current result.",
    targetArtifacts: ["outputs/result.md"],
    completionCriteria: ["The result is current."],
    evidenceRequirements: []
  });
  const mission = mutate(root, "create-dove-mission", () => createDoveMission(root, proposal.confirmation.confirmArgs)).mission;
  const artifacts = [
    ["outputs/plan.md", "# Final plan\n\nUse the declared method.\n", "document"],
    ["outputs/result.md", "# Final result\n\nCurrent mission result.\n", "report"],
    ["outputs/appendix.md", "# Appendix\n\nSupporting material.\n", "document"]
  ];
  for (const [artifactPath, content] of artifacts) write(root, artifactPath, content);
  mutate(root, "ingest-execution-receipt", () => ingestExecutionReceipt(root, {
    receiptId: "seed-review-artifacts",
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
    summary: "Own the review artifacts.",
    artifacts: artifacts.map(([artifactPath, , kind]) => ({ path: artifactPath, kind, sha256: sha256(root, artifactPath) })),
    validations: [],
    criteriaSatisfied: [{ criterionId: mission.completionCriterionIds[0], evidenceRefs: ["artifact:outputs/result.md"] }],
    producedAt: new Date().toISOString()
  }));
  return { root, mission };
}

function prepare(root, missionId, policy, overrides = {}) {
  const args = policy === "final-plan-results-only"
    ? { missionId, policy, finalPlanPaths: ["outputs/plan.md"], finalResultPaths: ["outputs/result.md"], ...overrides }
    : { missionId, policy, artifactPaths: ["outputs/result.md"], ...overrides };
  return mutate(root, "prepare-review-exchange", () => prepareReviewExchange(root, args));
}

function writeReturn(root, prepared, overrides = {}) {
  const report = overrides.report ?? "# Independent report\n\nThe result needs a clearer limitation.\n";
  write(root, prepared.reportPath, report);
  const workspaceId = JSON.parse(fs.readFileSync(path.join(root, ".dove/manifest.json"), "utf8")).workspaceId;
  const mission = JSON.parse(fs.readFileSync(path.join(root, `.dove/missions/${prepared.missionId}.json`), "utf8"));
  const handoff = {
    schemaVersion: 8,
    workspaceId,
    missionId: prepared.missionId,
    contractDigest: mission.contractDigest,
    exchangeId: prepared.exchangeId,
    reviewId: overrides.reviewId ?? "independent-review",
    policy: prepared.policy,
    scopeSha256: prepared.scopeSha256,
    status: "completed",
    verdict: "needs-revision",
    reviewerId: "external-reviewer",
    summary: "Clarify the limitation before finalization.",
    inputPath: prepared.inputPath,
    inputSha256: prepared.inputSha256,
    reportPath: prepared.reportPath,
    reportSha256: sha256(root, prepared.reportPath),
    reviewedArtifactPaths: prepared.reviewedArtifactPaths,
    findings: [{ findingId: "missing-limitation", severity: "medium", summary: "The limitation is not explicit.", linkedArtifactPaths: [prepared.reviewedArtifactPaths.at(-1)] }],
    actionItems: ["Add the limitation."],
    reviewedAt: new Date().toISOString(),
    ...overrides
  };
  delete handoff.report;
  write(root, prepared.handoffPath, `${JSON.stringify(handoff, null, 2)}\n`);
  return handoff.reviewId;
}

function importPrepared(root, prepared, reviewId, options = {}) {
  return runWithMutationContext(root, { actionId: "import-review-exchange", mutationMode: "direct-process", hostId: "test", ...options }, () => importReviewExchange(root, { missionId: prepared.missionId, exchangeId: prepared.exchangeId, reviewId }));
}

function assertFailurePreservesBytes(root, callback, expected) {
  const before = tree(root);
  assert.throws(callback, expected);
  assert.deepEqual(tree(root), before);
}

test("review import rejects a mission superseded after preparation without writing", () => {
  const { root, mission } = setup("review-superseded");
  const prepared = prepare(root, mission.missionId, "isolated-selected-artifacts");
  const reviewId = writeReturn(root, prepared, { reviewId: "late-review" });
  const proposal = createDoveMission(root, {
    missionId: "review-successor",
    goal: "Continue the reviewed work.",
    completionCriteria: ["The successor result is current."],
    evidenceRequirements: [],
    supersedesMissionId: mission.missionId
  });
  mutate(root, "create-dove-mission", () => createDoveMission(root, proposal.confirmation.confirmArgs));
  assertFailurePreservesBytes(root, () => importPrepared(root, prepared, reviewId), /superseded by review-successor.*read-only history/u);
  assert.equal(fs.existsSync(path.join(root, `.dove/reviews/${reviewId}.json`)), false);
});

test("four review policies define input scope only and local preflight is zero-write", () => {
  const { root, mission } = setup();
  const before = tree(root);
  const local = prepareReviewExchange(root, { missionId: mission.missionId, policy: "local-preflight", artifactPaths: ["outputs/result.md"] });
  assert.equal(local.status, "ready");
  assert.equal(local.zeroWrite, true);
  assert.equal(local.authority.authoritative, false);
  assert.deepEqual(local.reviewedArtifactPaths, ["outputs/result.md"]);
  assert.equal(local.inputBoundary, "read-only-current-workspace");
  assert.deepEqual(tree(root), before);

  const selected = prepare(root, mission.missionId, "isolated-selected-artifacts", { artifactPaths: ["outputs/appendix.md", "outputs/result.md"] });
  assert.deepEqual(selected.reviewedArtifactPaths, ["outputs/appendix.md", "outputs/result.md"]);
  assert.deepEqual(selected.packageArtifacts.map((item) => item.packagePath), [
    `${selected.artifactPackagePath}/artifact-0001.md`,
    `${selected.artifactPackagePath}/artifact-0002.md`
  ]);
  for (const mapping of selected.packageArtifacts) {
    assert.equal(mapping.sourceSha256, mapping.packageSha256);
    assert.equal(mapping.sourceSizeBytes, mapping.packageSizeBytes);
    assert.equal(sha256(root, mapping.sourcePath), sha256(root, mapping.packagePath));
  }
  const finalOnly = prepare(root, mission.missionId, "final-plan-results-only");
  const finalInput = JSON.parse(fs.readFileSync(path.join(root, finalOnly.inputPath), "utf8"));
  assert.deepEqual(finalInput.finalPlanPaths, ["outputs/plan.md"]);
  assert.deepEqual(finalInput.finalResultPaths, ["outputs/result.md"]);
  assert.deepEqual(finalInput.reviewedArtifactPaths, ["outputs/plan.md", "outputs/result.md"]);
  const external = prepare(root, mission.missionId, "external", { artifactPaths: ["outputs/plan.md"] });
  assert.deepEqual(external.reviewedArtifactPaths, ["outputs/plan.md"]);
  for (const prepared of [selected, finalOnly, external]) {
    const input = JSON.parse(fs.readFileSync(path.join(root, prepared.inputPath), "utf8"));
    assert.equal(input.schemaVersion, 8);
    assert.equal(input.policy, prepared.policy);
    assert.equal(input.preparationReceiptId, prepared.preparationReceiptId);
    const manifest = JSON.parse(fs.readFileSync(path.join(root, prepared.manifestPath), "utf8"));
    assert.equal(manifest.preparationReceiptId, prepared.preparationReceiptId);
    const preparationReceipt = JSON.parse(fs.readFileSync(path.join(root, `.dove/receipts/execution/${prepared.preparationReceiptId}.json`), "utf8"));
    assert.equal(preparationReceipt.producer.actionId, "prepare-review-exchange");
    assert.deepEqual(
      preparationReceipt.artifacts.map((item) => item.path).sort(),
      [prepared.inputPath, prepared.manifestPath, ...prepared.packageArtifacts.map((item) => item.packagePath)].sort()
    );
    assert.equal(input.inputBoundary, {
      "isolated-selected-artifacts": "selected-artifact-isolation",
      "final-plan-results-only": "classified-final-plan-results",
      external: "host-mediated-external-review"
    }[prepared.policy]);
    assert.equal(Object.hasOwn(input, "reviewerCommand"), false);
    assert.equal(Object.hasOwn(input, "session"), false);
    assert.equal(Object.hasOwn(input, "board"), false);
    assert.equal(Object.hasOwn(input, "runtime"), false);
  }
});

test("expected snapshot coverage is internal-only, exact, and zero-write", () => {
  const { root, mission } = setup("expected-coverage");
  const prepared = prepare(root, mission.missionId, "external");
  const reviewId = writeReturn(root, prepared, { reviewId: "expected-coverage-review" });
  importPrepared(root, prepared, reviewId);
  const expectedSnapshots = [{ path: "outputs/result.md", sizeBytes: fs.statSync(path.join(root, "outputs/result.md")).size, sha256: sha256(root, "outputs/result.md") }];
  const before = tree(root);
  const coverage = verifyExpectedReviewCoverage(root, { missionId: mission.missionId, expectedSnapshots });
  assert.equal(coverage.covered, true);
  assert.equal(coverage.requestedArtifactSetSha256?.length, 64);
  assert.deepEqual(tree(root), before);

  const stale = verifyExpectedReviewCoverage(root, {
    missionId: mission.missionId,
    expectedSnapshots: [{ ...expectedSnapshots[0], sha256: "0".repeat(64) }]
  });
  assert.equal(stale.covered, false);
  assert.ok(stale.failures.includes("current-exact-review-coverage-missing"));
  assert.throws(() => verifyReviewCoverage(root, { missionId: mission.missionId, expectedSnapshots }), /unknown input.*expectedSnapshots/u);
});

test("CLI and MCP expose prepare local-preflight and coverage without a legacy preflight tool", () => {
  const { root, mission } = setup();
  const before = tree(root);
  const cli = spawnSync(process.execPath, [CLI, "review", root, "--mission-id", mission.missionId, "--artifact", "outputs/result.md", "--preflight", "--json"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(cli.status, 0, cli.stderr || cli.stdout);
  const preflight = JSON.parse(cli.stdout);
  assert.equal(preflight.status, "ready");
  assert.equal(preflight.operation, "preflight");
  assert.match(preflight.nextAction.command, /--prepare .*--json/u);
  assert.deepEqual(tree(root), before);

  const mcp = dispatchTool(root, "prepare_review_exchange", { missionId: mission.missionId, policy: "local-preflight", artifactPaths: ["outputs/result.md"] });
  assert.notEqual(mcp.isError, true, mcp.content?.[0]?.text);
  assert.equal(JSON.parse(mcp.content[0].text).zeroWrite, true);
  assert.deepEqual(tree(root), before);
  assert.equal(dispatchTool(root, "preflight_review_exchange", {}).isError, true);

  const coverage = dispatchTool(root, "verify_review_coverage", { missionId: mission.missionId, artifactPaths: ["outputs/result.md"] });
  assert.notEqual(coverage.isError, true, coverage.content?.[0]?.text);
  const exactCoverage = JSON.parse(coverage.content[0].text);
  assert.equal(exactCoverage.status, "not-covered");
  assert.equal(exactCoverage.zeroWrite, true);
  assert.equal(exactCoverage.review.covered, false);
  assert.equal(exactCoverage.review.authoritative, false);
  const broadCoverage = verifyReviewCoverage(root, { missionId: mission.missionId });
  assert.equal(broadCoverage.status, "not-covered");
  assert.equal(broadCoverage.covered, false);
  assert.ok(broadCoverage.failures.includes("current-review-coverage-missing"));
  assert.deepEqual(tree(root), before);
});

test("prepare and import bind mission, policy, scope, artifacts, input, handoff, and report", () => {
  const { root, mission } = setup();
  const prepared = prepare(root, mission.missionId, "external");
  assert.equal(prepared.operation, "prepare");
  assert.equal(prepared.actionablePaths.input.path, prepared.inputPath);
  assert.equal(prepared.actionablePaths.manifest.path, prepared.manifestPath);
  assert.equal(prepared.actionablePaths.handoff.path, prepared.handoffPath);
  assert.equal(prepared.actionablePaths.report.path, prepared.reportPath);
  assert.match(prepared.importAction.command, /--import .*--json/u);
  const reviewId = writeReturn(root, prepared);
  const imported = importPrepared(root, prepared, reviewId);
  assert.equal(imported.status, "imported");
  assert.equal(imported.operation, "import");
  assert.equal(imported.actionablePaths.handoff.path, prepared.handoffPath);
  assert.equal(imported.actionablePaths.report.path, `.dove/reviews/${reviewId}.report.md`);
  assert.match(imported.nextAction.command, /--verify-coverage --json/u);
  assert.equal(imported.review.schemaVersion, 8);
  assert.equal(imported.review.exchangeId, prepared.exchangeId);
  assert.equal(imported.review.policy, "external");
  assert.equal(imported.authoritative, false);
  assert.equal(imported.review.authority.issuer, null);
  assert.equal(imported.review.authority.callerMayMintAuthority, false);
  assert.equal(fs.existsSync(path.join(root, `.dove/reviews/${reviewId}.json`)), true);
  assert.equal(fs.existsSync(path.join(root, `.dove/reviews/${reviewId}.report.md`)), true);
  const consumption = JSON.parse(fs.readFileSync(path.join(root, prepared.consumptionPath), "utf8"));
  assert.equal(consumption.exchangeId, prepared.exchangeId);
  assert.equal(consumption.reviewId, reviewId);
  const importReceipt = JSON.parse(fs.readFileSync(path.join(root, `.dove/receipts/execution/${imported.review.importReceiptId}.json`), "utf8"));
  assert.deepEqual(importReceipt.artifacts.map((item) => item.path).sort(), [
    prepared.handoffPath,
    prepared.reportPath,
    prepared.consumptionPath,
    `.dove/reviews/${reviewId}.report.md`,
    `.dove/reviews/${reviewId}.json`
  ].sort());

  const coverage = verifyReviewCoverage(root, { missionId: mission.missionId, artifactPaths: ["outputs/result.md"] });
  assert.equal(coverage.covered, true, JSON.stringify(coverage, null, 2));
  assert.equal(coverage.authoritative, false);
  assert.deepEqual(coverage.failures, []);
  const authoritative = verifyReviewCoverage(root, { missionId: mission.missionId, artifactPaths: ["outputs/result.md"], requireAuthoritative: true });
  assert.equal(authoritative.authoritative, false);
  assert.ok(authoritative.failures.includes("trusted-review-issuer-missing"));
});

test("import rejects artifact, input, handoff, report, set, and scope hash drift before writes", () => {
  const mutations = {
    artifact: ({ root }) => write(root, "outputs/result.md", "# Changed result\n"),
    input: ({ root, prepared }) => fs.appendFileSync(path.join(root, prepared.inputPath), " "),
    "handoff-input-hash": ({ root, prepared }) => writeReturn(root, prepared, { inputSha256: "0".repeat(64) }),
    report: ({ root, prepared }) => { writeReturn(root, prepared); fs.appendFileSync(path.join(root, prepared.reportPath), "changed\n"); },
    set: ({ root, prepared }) => writeReturn(root, prepared, { reviewedArtifactPaths: ["outputs/plan.md"] }),
    "manifest-content": ({ root, prepared }) => {
      const manifest = JSON.parse(fs.readFileSync(path.join(root, prepared.manifestPath), "utf8"));
      manifest.reviewedArtifactSetSha256 = "0".repeat(64);
      write(root, prepared.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    },
    "manifest-alias": ({ root, prepared }) => {
      const realManifest = path.join(root, prepared.manifestPath);
      const aliasTarget = path.join(path.dirname(realManifest), "manifest-real.json");
      fs.renameSync(realManifest, aliasTarget);
      fs.symlinkSync("manifest-real.json", realManifest);
    },
    "input-boundary": ({ root, prepared }) => {
      const manifest = JSON.parse(fs.readFileSync(path.join(root, prepared.manifestPath), "utf8"));
      const input = JSON.parse(fs.readFileSync(path.join(root, prepared.inputPath), "utf8"));
      manifest.inputBoundary = "selected-artifact-isolation";
      input.inputBoundary = "selected-artifact-isolation";
      const inputContent = `${JSON.stringify(input, null, 2)}\n`;
      manifest.inputSha256 = crypto.createHash("sha256").update(inputContent).digest("hex");
      write(root, prepared.inputPath, inputContent);
      write(root, prepared.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    },
    scope: ({ root, prepared }) => writeReturn(root, prepared, { scopeSha256: "0".repeat(64) })
  };
  for (const [label, apply] of Object.entries(mutations)) {
    const { root, mission } = setup();
    const prepared = prepare(root, mission.missionId, "external");
    if (!["handoff-input-hash", "report", "set", "scope"].includes(label)) writeReturn(root, prepared);
    apply({ root, prepared });
    assertFailurePreservesBytes(root, () => importPrepared(root, prepared, "independent-review"), /hash|changed|scope|policy input boundary|artifact set|artifact snapshot|exact frozen|canonical realpath|symbolic link/u);
  }
});

test("path traversal, external symlink, and internal aliases fail closed", () => {
  {
    const { root, mission } = setup();
    const before = tree(root);
    assert.throws(() => prepareReviewExchange(root, { missionId: mission.missionId, policy: "external", artifactPaths: ["../outside.md"] }), /unsafe path|escapes/u);
    assert.deepEqual(tree(root), before);
  }
  {
    const { root, mission } = setup();
    const outside = path.join(path.dirname(root), `${path.basename(root)}-outside.md`);
    write(root, "outputs/placeholder.md", "placeholder\n");
    fs.rmSync(path.join(root, "outputs/placeholder.md"));
    fs.writeFileSync(outside, "outside\n");
    fs.symlinkSync(outside, path.join(root, "outputs/placeholder.md"));
    const before = tree(root);
    assert.throws(() => prepareReviewExchange(root, { missionId: mission.missionId, policy: "external", artifactPaths: ["outputs/placeholder.md"] }), /real path escapes|not a registered/u);
    assert.deepEqual(tree(root), before);
    fs.rmSync(outside, { force: true });
  }
  {
    const { root, mission } = setup();
    fs.symlinkSync("result.md", path.join(root, "outputs/result-alias.md"));
    const before = tree(root);
    assert.throws(() => prepareReviewExchange(root, { missionId: mission.missionId, policy: "external", artifactPaths: ["outputs/result.md", "outputs/result-alias.md"] }), /internal alias/u);
    assert.deepEqual(tree(root), before);
  }
});

test("cross-mission and policy scope drift fail before import writes", () => {
  const { root, mission } = setup();
  const prepared = prepare(root, mission.missionId, "final-plan-results-only");
  writeReturn(root, prepared);
  const otherProposal = createDoveMission(root, { missionId: "other-mission", goal: "Other mission." });
  mutate(root, "create-dove-mission", () => createDoveMission(root, otherProposal.confirmation.confirmArgs));
  assertFailurePreservesBytes(root, () => mutate(root, "import-review-exchange", () => importReviewExchange(root, { missionId: "other-mission", exchangeId: prepared.exchangeId, reviewId: "independent-review" })), /mission binding/u);

  const input = JSON.parse(fs.readFileSync(path.join(root, prepared.inputPath), "utf8"));
  input.finalPlanPaths = ["outputs/result.md"];
  write(root, prepared.inputPath, `${JSON.stringify(input, null, 2)}\n`);
  assertFailurePreservesBytes(root, () => importPrepared(root, prepared, "independent-review"), /input hash|scope|drift/u);
});

test("duplicate import fails and coherent public import stays non-authoritative", () => {
  const { root, mission } = setup();
  const prepared = prepare(root, mission.missionId, "isolated-selected-artifacts");
  const reviewId = writeReturn(root, prepared, { verdict: "coherent", findings: [], actionItems: [], summary: "The exact frozen artifacts are coherent." });
  const imported = importPrepared(root, prepared, reviewId);
  assert.equal(imported.review.verdict, "coherent");
  assert.equal(imported.authoritative, false);
  assert.equal(Object.hasOwn(imported, "reviewProofRequired"), false);
  assertFailurePreservesBytes(root, () => importPrepared(root, prepared, reviewId), /already been consumed|already been imported/u);
});

test("an exchangeId is consumed once even when a second import uses a different reviewId", () => {
  const { root, mission } = setup("single-consumption");
  const prepared = prepare(root, mission.missionId, "external");
  const reviewId = writeReturn(root, prepared, { reviewId: "first-review" });
  importPrepared(root, prepared, reviewId);
  const handoff = JSON.parse(fs.readFileSync(path.join(root, prepared.handoffPath), "utf8"));
  handoff.reviewId = "second-review";
  write(root, prepared.handoffPath, `${JSON.stringify(handoff, null, 2)}\n`);
  assertFailurePreservesBytes(root, () => importPrepared(root, prepared, "second-review"), /already been consumed/u);
});

test("isolated package source, copy, and ownership drift fail before import writes", () => {
  for (const [label, tamper] of [
    ["package", ({ root, prepared }) => fs.appendFileSync(path.join(root, prepared.packageArtifacts[0].packagePath), "changed\n")],
    ["source", ({ root }) => fs.appendFileSync(path.join(root, "outputs/result.md"), "changed\n")]
  ]) {
    const { root, mission } = setup(`isolated-${label}-drift`);
    const prepared = prepare(root, mission.missionId, "isolated-selected-artifacts");
    const reviewId = writeReturn(root, prepared, { reviewId: `review-${label}-drift` });
    tamper({ root, prepared });
    assertFailurePreservesBytes(root, () => importPrepared(root, prepared, reviewId), /package|source|changed|ownership/u);
  }
});

test("failed import transaction leaves no consumption marker, imported records, receipt, or exchange lock", () => {
  const { root, mission } = setup("transactional-import");
  const prepared = prepare(root, mission.missionId, "external");
  const reviewId = writeReturn(root, prepared, { reviewId: "transactional-review" });
  const before = tree(root);
  let promotedImportFiles = 0;
  const fsOps = {
    ...fs,
    renameSync(from, to, metadata) {
      if ([prepared.consumptionPath, `.dove/reviews/${reviewId}.report.md`, `.dove/reviews/${reviewId}.json`].includes(metadata?.anchoredTo)) {
        promotedImportFiles += 1;
        if (promotedImportFiles === 2) throw new Error("injected review import promotion failure");
      }
      return fs.renameSync(from, to);
    }
  };
  assert.throws(() => importPrepared(root, prepared, reviewId, { fsOps }), /all staged changes were rolled back.*injected review import promotion failure/u);
  assert.deepEqual(tree(root), before);
  assert.equal(fs.existsSync(path.join(root, prepared.consumptionPath)), false);
  assert.equal(fs.existsSync(path.join(root, `.dove/reviews/${reviewId}.json`)), false);
  assert.equal(fs.existsSync(path.join(root, `.dove/reviews/${reviewId}.report.md`)), false);
  assert.equal(fs.existsSync(path.join(root, `.dove/reviews/exchanges/${prepared.exchangeId}/.exchange.lock`)), false);
});

test("review returns require actionable linkage and blocked or failed reviews remain durable but ineligible", () => {
  {
    const { root, mission } = setup("review-linkage");
    const prepared = prepare(root, mission.missionId, "external");
    const reviewId = writeReturn(root, prepared, { findings: [{ findingId: "unlinked", severity: "medium", summary: "Missing linkage.", linkedArtifactPaths: [] }] });
    assertFailurePreservesBytes(root, () => importPrepared(root, prepared, reviewId), /must contain at least 1 item/u);
  }
  for (const status of ["blocked", "failed"]) {
    const { root, mission } = setup(`review-${status}`);
    const prepared = prepare(root, mission.missionId, "external");
    const reviewId = writeReturn(root, prepared, { reviewId: `review-${status}`, status, verdict: "blocked", findings: [], actionItems: [] });
    const imported = importPrepared(root, prepared, reviewId);
    assert.equal(imported.review.status, status);
    const coverage = verifyReviewCoverage(root, { missionId: mission.missionId, artifactPaths: ["outputs/result.md"] });
    assert.equal(coverage.covered, false);
    assert.ok(coverage.reviews[0].failures.includes(`review-status-ineligible:${status}`));
    assert.ok(coverage.reviews[0].failures.includes("review-verdict-ineligible:blocked"));
  }
});

test("coverage detects input, handoff, exchange report, and imported report drift", () => {
  for (const [label, mutateReview] of Object.entries({
    input: ({ root, prepared }) => fs.appendFileSync(path.join(root, prepared.inputPath), " "),
    handoff: ({ root, prepared }) => fs.appendFileSync(path.join(root, prepared.handoffPath), " "),
    "exchange-report": ({ root, prepared }) => fs.appendFileSync(path.join(root, prepared.reportPath), "changed\n"),
    "imported-report": ({ root, reviewId }) => fs.appendFileSync(path.join(root, `.dove/reviews/${reviewId}.report.md`), "changed\n")
  })) {
    const { root, mission } = setup(`coverage-${label}`);
    const prepared = prepare(root, mission.missionId, "external");
    const reviewId = writeReturn(root, prepared, { reviewId: `review-${label}` });
    importPrepared(root, prepared, reviewId);
    assert.equal(verifyReviewCoverage(root, { missionId: mission.missionId, artifactPaths: ["outputs/result.md"] }).covered, true);
    const before = tree(root);
    mutateReview({ root, prepared, reviewId });
    const afterTamper = tree(root);
    const coverage = verifyReviewCoverage(root, { missionId: mission.missionId, artifactPaths: ["outputs/result.md"] });
    assert.equal(coverage.status, "not-covered", label);
    assert.equal(coverage.covered, false, label);
    assert.ok(coverage.reviews[0].failures.some((failure) => failure.includes("stale")), JSON.stringify(coverage, null, 2));
    assert.deepEqual(tree(root), afterTamper, `${label} coverage verification must be zero-write`);
    assert.notDeepEqual(afterTamper, before);
  }
});

test("coverage rejects an exact forged appendix added only to the imported review JSON", () => {
  const { root, mission } = setup("coverage-forged-appendix");
  const prepared = prepare(root, mission.missionId, "external");
  const reviewId = writeReturn(root, prepared, { reviewId: "review-forged-appendix" });
  importPrepared(root, prepared, reviewId);
  const reviewPath = path.join(root, `.dove/reviews/${reviewId}.json`);
  const review = JSON.parse(fs.readFileSync(reviewPath, "utf8"));
  const appendix = { path: "outputs/appendix.md", kind: "document", sha256: sha256(root, "outputs/appendix.md"), missionId: mission.missionId, contractDigest: mission.contractDigest, receiptId: "seed-outputs-appendix-md" };
  review.reviewedArtifacts = [...review.reviewedArtifacts, appendix].sort((left, right) => left.path.localeCompare(right.path));
  review.reviewedArtifactPaths = review.reviewedArtifacts.map((item) => item.path);
  review.reviewedArtifactSetSha256 = stableSnapshotSetHash(review.reviewedArtifacts);
  fs.writeFileSync(reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf8");
  const before = tree(root);
  const coverage = verifyReviewCoverage(root, { missionId: mission.missionId, artifactPaths: ["outputs/appendix.md", "outputs/result.md"] });
  assert.equal(coverage.covered, false);
  assert.ok(coverage.reviews[0].failures.some((failure) => ["imported-review-receipt-hash-stale", "reviewed-set-not-receipt-anchored"].includes(failure)), JSON.stringify(coverage, null, 2));
  assert.deepEqual(tree(root), before);
});

test("artifact modification makes previously current review coverage stale", () => {
  const { root, mission } = setup();
  const prepared = prepare(root, mission.missionId, "external");
  const reviewId = writeReturn(root, prepared);
  importPrepared(root, prepared, reviewId);
  assert.equal(verifyReviewCoverage(root, { missionId: mission.missionId, artifactPaths: ["outputs/result.md"] }).covered, true);
  write(root, "outputs/result.md", "# Result\n\nModified after review import.\n");
  const exact = verifyReviewCoverage(root, { missionId: mission.missionId, artifactPaths: ["outputs/result.md"] });
  assert.equal(exact.covered, false);
  assert.ok(exact.failures.some((failure) => failure.includes("changed since its latest ownership receipt")));
  const broad = verifyReviewCoverage(root, { missionId: mission.missionId });
  assert.equal(broad.covered, false);
  assert.ok(broad.reviews[0].failures.some((failure) => failure.includes("reviewed-artifact-changed")));
});

test("coverage seals imported authority and exchange metadata against caller minting or path substitution", () => {
  for (const [label, tamper, expectedFailure] of [
    ["authority", (review) => { review.authority.callerMayMintAuthority = true; }, "public-review-authority-invalid"],
    ["authority-extra", (review) => { review.authority.trusted = true; }, "public-review-authority-invalid"],
    ["exchange-extra", (review) => { review.exchange.scope = "broader"; }, "review-exchange-invalid"]
  ]) {
    const { root, mission } = setup(`coverage-sealed-${label}`);
    const prepared = prepare(root, mission.missionId, "external");
    const reviewId = writeReturn(root, prepared, { reviewId: `review-${label}` });
    importPrepared(root, prepared, reviewId);
    const reviewPath = path.join(root, `.dove/reviews/${reviewId}.json`);
    const review = JSON.parse(fs.readFileSync(reviewPath, "utf8"));
    tamper(review);
    fs.writeFileSync(reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf8");
    const before = tree(root);
    const coverage = verifyReviewCoverage(root, { missionId: mission.missionId });
    assert.equal(coverage.covered, false, label);
    assert.ok(coverage.reviews[0].failures.some((failure) => failure.includes(expectedFailure)), JSON.stringify(coverage, null, 2));
    assert.deepEqual(tree(root), before, `${label} coverage verification must remain zero-write`);
  }
});

test("coverage detects prepared manifest and reviewed artifact path substitution", () => {
  {
    const { root, mission } = setup("coverage-manifest");
    const prepared = prepare(root, mission.missionId, "external");
    const reviewId = writeReturn(root, prepared, { reviewId: "review-manifest" });
    importPrepared(root, prepared, reviewId);
    fs.appendFileSync(path.join(root, prepared.manifestPath), " ");
    const coverage = verifyReviewCoverage(root, { missionId: mission.missionId });
    assert.equal(coverage.covered, false);
    assert.ok(coverage.reviews[0].failures.includes("manifestSha256-stale"));
  }
  {
    const { root, mission } = setup("coverage-path-substitution");
    const prepared = prepare(root, mission.missionId, "external");
    const reviewId = writeReturn(root, prepared, { reviewId: "review-path-substitution" });
    importPrepared(root, prepared, reviewId);
    const resultPath = path.join(root, "outputs/result.md");
    const originalPath = path.join(root, "outputs/result-original.md");
    fs.renameSync(resultPath, originalPath);
    fs.symlinkSync("result-original.md", resultPath);
    const coverage = verifyReviewCoverage(root, { missionId: mission.missionId });
    assert.equal(coverage.covered, false);
    assert.ok(coverage.reviews[0].failures.some((failure) => failure.includes("reviewed-artifact-path-changed")), JSON.stringify(coverage, null, 2));
  }
});
