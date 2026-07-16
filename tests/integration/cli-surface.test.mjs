import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { createDoveMission } from "../../src/core/mission-contracts.mjs";
import { runWithMutationContext } from "../../src/core/mutation-backend.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

const ROOT = process.cwd();
const CLI = path.join(ROOT, "bin", "dove.mjs");

const DELETED_CLI_COMMANDS = [
  "auto",
  "operator",
  "review-loop",
  "launch",
  "orchestrate",
  "audit",
  "return"
];

test("plain proposal output shows the zero-write boundary and exact JSON confirmation command", () => {
  const workspace = createTempRoot("dove-cli-plain-proposal-");
  try {
    for (const args of [
      ["init", workspace, "--goal", "Initialize from plain output", "--mutation-mode", "direct-process"],
      ["mission", workspace, "--goal", "Propose from plain output", "--mutation-mode", "direct-process"]
    ]) {
      const result = spawnSync(process.execPath, [CLI, ...args], { cwd: ROOT, encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.match(result.stdout, /DOVE PROPOSAL: ZERO-WRITE BOUNDARY/u);
      assert.match(result.stdout, /Exact confirmation command:/u);
      assert.match(result.stdout, /--json/u);
      assert.equal(fs.existsSync(path.join(workspace, ".dove")), false);
    }
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("receipt CLI assesses only committed direct-process state and keeps patch plans null", () => {
  const workspace = createTempRoot("dove-cli-receipt-post-commit-");
  try {
    const artifactPath = "outputs/cli-receipt.md";
    const artifactFullPath = path.join(workspace, artifactPath);
    fs.mkdirSync(path.dirname(artifactFullPath), { recursive: true });
    fs.writeFileSync(artifactFullPath, "committed CLI receipt artifact\n", "utf8");
    const proposal = createDoveMission(workspace, {
      missionId: "cli-receipt-post-commit",
      goal: "Return current completion after CLI receipt commit.",
      targetArtifacts: [artifactPath],
      expectedArtifacts: [artifactPath],
      completionCriteria: ["The CLI artifact is current."],
      evidenceRequirements: [`artifact:${artifactPath}`]
    });
    const mission = runWithMutationContext(workspace, { actionId: "create-dove-mission", mutationMode: "direct-process", hostId: "test" }, () => createDoveMission(workspace, proposal.confirmation.confirmArgs)).mission;
    const receipt = {
      receiptId: "cli-receipt-current",
      missionId: mission.missionId,
      contractDigest: mission.contractDigest,
      summary: "Recorded the current CLI artifact.",
      artifacts: [{ path: artifactPath, kind: "document", sha256: crypto.createHash("sha256").update(fs.readFileSync(artifactFullPath)).digest("hex") }],
      validations: [],
      criteriaSatisfied: mission.completionCriterionIds.map((criterionId) => ({ criterionId, evidenceRefs: [`artifact:${artifactPath}`] })),
      producedAt: "2026-07-16T00:00:00.000Z"
    };
    const inputPath = path.join(workspace, "receipt-input.json");
    fs.writeFileSync(inputPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");

    const planned = spawnSync(process.execPath, [CLI, "receipt", workspace, "--input", "receipt-input.json", "--mutation-mode", "patch-plan", "--json"], { cwd: ROOT, encoding: "utf8" });
    assert.equal(planned.status, 0, planned.stderr || planned.stdout);
    const plannedPayload = JSON.parse(planned.stdout);
    assert.equal(plannedPayload.status, "ingest-planned");
    assert.equal(plannedPayload.completion.assessment, null);
    assert.equal(Object.hasOwn(plannedPayload, "postCommit"), false);
    assert.equal(fs.existsSync(path.join(workspace, ".dove", "receipts", "execution", `${receipt.receiptId}.json`)), false);

    const direct = spawnSync(process.execPath, [CLI, "receipt", workspace, "--input", "receipt-input.json", "--mutation-mode", "direct-process", "--json"], { cwd: ROOT, encoding: "utf8" });
    assert.equal(direct.status, 0, direct.stderr || direct.stdout);
    const directPayload = JSON.parse(direct.stdout);
    assert.equal(directPayload.status, "ingested");
    assert.equal(directPayload.completion.assessment.currentReceiptId, receipt.receiptId);
    assert.equal(directPayload.completion.assessment.complete, true);
    assert.equal(Object.hasOwn(directPayload, "postCommit"), false);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("deleted CLI commands fail as unknown without creating Dove state", () => {
  for (const command of DELETED_CLI_COMMANDS) {
    const workspace = createTempRoot(`dove-cli-deleted-${command}-`);
    try {
      const result = spawnSync(process.execPath, [CLI, command, workspace], {
        cwd: ROOT,
        encoding: "utf8"
      });
      assert.notEqual(result.status, 0, `${command} must fail`);
      assert.match(result.stdout, /Usage:/u, `${command} must fall through to unknown-command usage`);
      assert.equal(fs.existsSync(path.join(workspace, ".dove")), false, `${command} must not create workspace state`);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  }
});

test("lessons defaults to zero-write query and record requires exact token replay", () => {
  const workspace = createTempRoot("dove-cli-lessons-");
  try {
    const missionProposal = createDoveMission(workspace, {
      missionId: "cli-lessons",
      goal: "Exercise the public lesson CLI.",
      completionCriteria: [],
      evidenceRequirements: []
    });
    runWithMutationContext(workspace, { actionId: "create-dove-mission", mutationMode: "direct-process", hostId: "test" }, () => createDoveMission(workspace, missionProposal.confirmation.confirmArgs));

    const plainProposal = spawnSync(process.execPath, [CLI, "lessons", "record", workspace,
      "--mission-id", "cli-lessons", "--lesson-id", "cli-lesson-plain", "--scope", "mission", "--kind", "method",
      "--summary", "Keep plain lesson replay exact.", "--next-time-guidance", "Replay only the returned command."
    ], { cwd: ROOT, encoding: "utf8" });
    assert.equal(plainProposal.status, 0, plainProposal.stderr || plainProposal.stdout);
    assert.match(plainProposal.stdout, /DOVE PROPOSAL: ZERO-WRITE BOUNDARY/u);
    assert.match(plainProposal.stdout, /lessons record.*--json/u);
    assert.equal(fs.existsSync(path.join(workspace, ".dove", "lessons")), false);

    const beforeQuery = fs.readdirSync(path.join(workspace, ".dove"), { recursive: true }).map(String).sort();
    const query = spawnSync(process.execPath, [CLI, "lessons", workspace, "--mission-id", "cli-lessons", "--json"], { cwd: ROOT, encoding: "utf8" });
    assert.equal(query.status, 0, query.stderr || query.stdout);
    assert.equal(JSON.parse(query.stdout).status, "empty");
    assert.deepEqual(fs.readdirSync(path.join(workspace, ".dove"), { recursive: true }).map(String).sort(), beforeQuery);

    const proposal = spawnSync(process.execPath, [CLI, "lessons", "record", workspace,
      "--mission-id", "cli-lessons", "--lesson-id", "cli-lesson-one", "--scope", "mission", "--kind", "method",
      "--summary", "Keep lesson replay exact.", "--next-time-guidance", "Replay only the returned token.", "--json"
    ], { cwd: ROOT, encoding: "utf8" });
    assert.equal(proposal.status, 0, proposal.stderr || proposal.stdout);
    const payload = JSON.parse(proposal.stdout);
    assert.equal(payload.status, "needs-confirmation");
    assert.match(payload.confirmation.exactConfirmationCommand, /lessons record/u);
    assert.match(payload.confirmation.exactConfirmationCommand, /--json$/u);
    assert.equal(fs.existsSync(path.join(workspace, ".dove", "lessons")), false);

    const alias = spawnSync(process.execPath, [CLI, "lessons", "record", workspace, "--confirm"], { cwd: ROOT, encoding: "utf8" });
    assert.notEqual(alias.status, 0);
    assert.match(alias.stderr, /Unknown or unsupported CLI argument: --confirm/u);

    const confirmed = spawnSync("/bin/sh", ["-c", payload.confirmation.exactConfirmationCommand], { cwd: ROOT, encoding: "utf8" });
    assert.equal(confirmed.status, 0, confirmed.stderr || confirmed.stdout);
    assert.equal(fs.existsSync(path.join(workspace, ".dove", "lessons", "cli-lesson-one.json")), true);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
