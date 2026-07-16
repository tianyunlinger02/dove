import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
