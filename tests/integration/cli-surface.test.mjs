import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { ingestExecutionReceipt } from "../../src/core/execution-receipts.mjs";
import { createDoveMission } from "../../src/core/mission-contracts.mjs";
import { runWithMutationContext } from "../../src/core/mutation-backend.mjs";
import { createVersionSnapshot } from "../../src/core/retained-domain-workflows.mjs";
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

test("plain proposal output keeps init human-readable and mission replay explicit", () => {
  const workspace = createTempRoot("dove-cli-plain-proposal-");
  try {
    const init = spawnSync(process.execPath, [CLI, "init", workspace, "--goal", "Initialize from plain output", "--mutation-mode", "direct-process"], { cwd: ROOT, encoding: "utf8" });
    assert.equal(init.status, 0, init.stderr || init.stdout);
    assert.match(init.stdout, /No files have been created or changed/u);
    assert.match(init.stdout, /Create minimal Dove project records/u);
    assert.match(init.stdout, /Create Dove project records for this project\?/u);
    assert.doesNotMatch(init.stdout, /schema|workspace-[a-z0-9-]+|[0-9a-f]{64}|proposal-token|exact confirmation|\.dove\//iu);

    const mission = spawnSync(process.execPath, [CLI, "mission", workspace, "--goal", "Propose from plain output", "--mutation-mode", "direct-process"], { cwd: ROOT, encoding: "utf8" });
    assert.equal(mission.status, 0, mission.stderr || mission.stdout);
    assert.match(mission.stdout, /No files have been created or changed/u);
    assert.match(mission.stdout, /Return control to the host to continue the requested work/u);
    assert.match(mission.stdout, /Create this mission checkpoint and continue the requested work\?/u);
    assert.doesNotMatch(mission.stdout, /schema|workspace-[a-z0-9-]+|[0-9a-f]{64}|proposal-token|exact confirmation|\.dove\//iu);
    assert.equal(fs.existsSync(path.join(workspace, ".dove")), false);
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
    assert.deepEqual(directPayload.completion.assessment.contributingReceiptIds, [receipt.receiptId]);
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

test("source query is explicit, zero-write, and the default source operation", () => {
  const workspace = createTempRoot("dove-cli-source-query-");
  try {
    const missionProposal = createDoveMission(workspace, { missionId: "cli-source-query", goal: "Query sources without writes.", completionCriteria: [], evidenceRequirements: [] });
    runWithMutationContext(workspace, { actionId: "create-dove-mission", mutationMode: "direct-process", hostId: "test" }, () => createDoveMission(workspace, missionProposal.confirmation.confirmArgs));
    const before = fs.readdirSync(path.join(workspace, ".dove"), { recursive: true }).map(String).sort();
    for (const action of [[], ["query"]]) {
      const result = spawnSync(process.execPath, [CLI, "source", ...action, workspace, "--mission-id", "cli-source-query", "--json"], { cwd: ROOT, encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.equal(JSON.parse(result.stdout).status, "empty");
      assert.deepEqual(fs.readdirSync(path.join(workspace, ".dove"), { recursive: true }).map(String).sort(), before);
    }
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("version comparison CLI is an immediate zero-write query", () => {
  const workspace = createTempRoot("dove-cli-version-query-");
  try {
    const missionProposal = createDoveMission(workspace, { missionId: "cli-version-query", goal: "Compare snapshots without writes.", completionCriteria: [], evidenceRequirements: [] });
    const mission = runWithMutationContext(workspace, { actionId: "create-dove-mission", mutationMode: "direct-process", hostId: "test" }, () => createDoveMission(workspace, missionProposal.confirmation.confirmArgs)).mission;
    const own = (receiptId, relativePath, content) => {
      const fullPath = path.join(workspace, relativePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content, "utf8");
      runWithMutationContext(workspace, { actionId: "ingest-execution-receipt", mutationMode: "direct-process", hostId: "test" }, () => ingestExecutionReceipt(workspace, {
        receiptId,
        missionId: mission.missionId,
        contractDigest: mission.contractDigest,
        summary: `Own ${relativePath}.`,
        artifacts: [{ path: relativePath, kind: "document", sha256: crypto.createHash("sha256").update(fs.readFileSync(fullPath)).digest("hex") }],
        validations: [],
        criteriaSatisfied: [],
        producedAt: "2026-07-21T00:00:00.000Z"
      }));
    };
    own("cli-version-first", "outputs/first.md", "First.\n");
    runWithMutationContext(workspace, { actionId: "create-version-snapshot", mutationMode: "direct-process", hostId: "test" }, () => createVersionSnapshot(workspace, { missionId: mission.missionId, versionId: "v1", artifactRefs: ["outputs/first.md"] }));
    own("cli-version-second", "outputs/second.md", "Second.\n");
    runWithMutationContext(workspace, { actionId: "create-version-snapshot", mutationMode: "direct-process", hostId: "test" }, () => createVersionSnapshot(workspace, { missionId: mission.missionId, versionId: "v2", artifactRefs: ["outputs/second.md"] }));
    const before = fs.readdirSync(path.join(workspace, ".dove"), { recursive: true }).map(String).sort();

    const result = spawnSync(process.execPath, [CLI, "version", workspace, "--mission-id", mission.missionId, "--from-version-id", "v1", "--to-version-id", "v2", "--json"], { cwd: ROOT, encoding: "utf8" });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.status, "compared");
    assert.equal(payload.zeroWrite, true);
    assert.deepEqual(payload.comparison.added, ["outputs/second.md"]);
    assert.deepEqual(payload.comparison.removed, ["outputs/first.md"]);
    assert.deepEqual(fs.readdirSync(path.join(workspace, ".dove"), { recursive: true }).map(String).sort(), before);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("CLI optional workflow inputs are omitted instead of passed as null", () => {
  const workspace = createTempRoot("dove-cli-omission-");
  try {
    const missionProposal = createDoveMission(workspace, { missionId: "cli-omission", goal: "Exercise omitted optional CLI fields.", completionCriteria: [], evidenceRequirements: [] });
    runWithMutationContext(workspace, { actionId: "create-dove-mission", mutationMode: "direct-process", hostId: "test" }, () => createDoveMission(workspace, missionProposal.confirmation.confirmArgs));
    const protocol = spawnSync(process.execPath, [CLI, "experience", workspace, "--mission-id", "cli-omission", "--experiment-id", "protocol-only", "--goal", "Measure the behavior", "--hypothesis", "The behavior is stable", "--protocol", "Run the bounded protocol", "--success-criterion", "The measurement is recorded", "--mutation-mode", "patch-plan", "--json"], { cwd: ROOT, encoding: "utf8" });
    assert.equal(protocol.status, 0, protocol.stderr || protocol.stdout);
    assert.equal(JSON.parse(protocol.stdout).plan.protocol, "Run the bounded protocol");
    const status = spawnSync(process.execPath, [CLI, "status", workspace, "--detail", "compact", "--json"], { cwd: ROOT, encoding: "utf8" });
    assert.equal(status.status, 0, status.stderr || status.stdout);
    for (const retired of ["--full", "--missions", "--result-mode"]) {
      const rejected = spawnSync(process.execPath, [CLI, "status", workspace, retired], { cwd: ROOT, encoding: "utf8" });
      assert.notEqual(rejected.status, 0);
    }
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
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
