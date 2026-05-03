import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { ensureWorkspace, initProject, upsertDraft, upsertOrchestrationBoard } from "../../src/core/index.mjs";

const ROOT = process.cwd();
const CLI = path.join(ROOT, "bin", "paper-factory.mjs");

function tempRoot(prefix = "paper-factory-isolated-review-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeFakeReviewer(dir) {
  const scriptPath = path.join(dir, "fake-reviewer.mjs");
  fs.writeFileSync(scriptPath, `import fs from "node:fs";\nimport path from "node:path";\nconst args = process.argv.slice(2);\nconst flag = (name) => args[args.indexOf(name) + 1];\nconst inputPath = flag("--input");\nconst handoffPath = flag("--handoff");\nconst reportPath = flag("--report");\nconst runId = flag("--run-id");\nconst input = JSON.parse(fs.readFileSync(inputPath, "utf8"));\nfs.mkdirSync(path.dirname(handoffPath), { recursive: true });\nfs.writeFileSync(path.join(path.dirname(handoffPath), "private-transcript.md"), "PRIVATE REVIEWER CHAIN SHOULD NOT BE IMPORTED\\n", "utf8");\nfs.writeFileSync(reportPath, "# Isolated report\\n\\nThe method claim needs direct source support.\\n", "utf8");\nfs.writeFileSync(handoffPath, JSON.stringify({\n  version: 1,\n  runId,\n  status: "completed",\n  verdict: "needs-revision",\n  reviewerId: "fake-isolated-reviewer",\n  reviewerSessionId: "parallel-session-1",\n  timestamp: "2026-05-03T00:00:00.000Z",\n  summary: "The draft needs direct source support before finalization.",\n  inputPath,\n  inputSha256: input.inputSha256 ?? process.env.PAPER_FACTORY_ISOLATED_REVIEW_INPUT_SHA256,\n  reportPath,\n  reviewedArtifactPaths: input.reviewedArtifactPaths,\n  findings: [{\n    id: "method-needs-source",\n    severity: "high",\n    summary: "The method claim needs direct source support.",\n    responseOwnerRole: "researcher",\n    linkedArtifactPaths: [".paper/drafts/method.md"]\n  }],\n  actionItems: ["Add direct source support for the method claim."]\n}, null, 2) + "\\n", "utf8");\n`, "utf8");
  return scriptPath;
}

test("isolated-review CLI imports only handoff and report from external reviewer", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, {
    title: "Isolated Review Paper",
    venue: "ICLR",
    objective: "Validate isolated review handoffs.",
    thesis: "Reviewer isolation improves critique quality.",
    audience: "reviewers"
  });
  upsertOrchestrationBoard(root, {
    phase: "draft",
    assignedRole: "planner",
    actorRole: "planner",
    policyOverrideReason: "Prepare isolated review test board state."
  });
  upsertDraft(root, {
    sectionId: "method",
    content: "# Method\n\nWe claim the isolated reviewer improves rigor. TODO[citation]\n",
    actorRole: "planner",
    policyOverrideReason: "Seed draft fixture for isolated review test."
  });

  const reviewerScript = writeFakeReviewer(root);
  const result = spawnSync("node", [
    CLI,
    "isolated-review",
    root,
    "--run-id",
    "test-review-1",
    "--reviewer-command",
    `node ${reviewerScript}`,
    "--scope",
    "current draft"
  ], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.status, "completed");
  assert.equal(payload.verdict, "needs-revision");
  assert.equal(payload.privateTranscriptImported, false);
  assert.match(payload.handoffPath, /\.paper\/reviews\/isolated\/test-review-1\/handoff\.json/);
  assert.match(payload.reportPath, /\.paper\/reviews\/isolated\/test-review-1\/report\.md/);

  const runDir = path.join(root, ".paper", "reviews", "isolated", "test-review-1");
  assert.ok(fs.existsSync(path.join(runDir, "input.json")));
  assert.ok(fs.existsSync(path.join(runDir, "handoff.json")));
  assert.ok(fs.existsSync(path.join(runDir, "report.md")));
  assert.ok(fs.existsSync(path.join(runDir, "private-transcript.md")));

  const input = JSON.parse(fs.readFileSync(path.join(runDir, "input.json"), "utf8"));
  assert.equal(input.privacyBoundary.writerPrivateTranscriptShared, false);
  assert.equal(input.privacyBoundary.reviewerPrivateTranscriptShouldReturn, false);
  assert.ok(input.reviewedArtifactPaths.includes(".paper/drafts/method.md"));

  const reviewLog = fs.readFileSync(path.join(root, ".paper", "reviews", "log.md"), "utf8");
  assert.match(reviewLog, /isolated-review/);
  assert.match(reviewLog, /The method claim needs direct source support/);
  assert.doesNotMatch(reviewLog, /PRIVATE REVIEWER CHAIN/);

  const concerns = JSON.parse(fs.readFileSync(path.join(root, ".paper", "reviews", "concerns.json"), "utf8"));
  assert.ok(concerns.items.some((item) => item.id === "isolated-test-review-1-method-needs-source"));

  const handoffs = fs.readFileSync(path.join(root, ".paper", "orchestration", "handoffs.md"), "utf8");
  assert.match(handoffs, /Isolated reviewer fake-isolated-reviewer returned needs-revision/);
});

test("isolated-review-import rejects mismatched input hashes", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  const prepare = spawnSync("node", [CLI, "isolated-review-prepare", root, "--run-id", "bad-hash-review"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert.equal(prepare.status, 0, prepare.stderr || prepare.stdout);
  const prepared = JSON.parse(prepare.stdout);
  fs.writeFileSync(path.join(root, ".paper", "reviews", "isolated", "bad-hash-review", "handoff.json"), JSON.stringify({
    runId: "bad-hash-review",
    status: "completed",
    verdict: "coherent",
    reviewerId: "fake-reviewer",
    summary: "Bad hash should fail.",
    inputPath: prepared.inputPath,
    inputSha256: "wrong-hash",
    findings: [],
    actionItems: []
  }, null, 2), "utf8");

  const imported = spawnSync("node", [CLI, "isolated-review-import", root, "--run-id", "bad-hash-review"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert.notEqual(imported.status, 0);
  assert.match(imported.stderr || imported.stdout, /input hash mismatch/);
});
