import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { checkGeneratedAdapters, writeClaudeUserCommandAdapters, writeGeneratedAdapters } from "../../scripts/generate-command-adapters.mjs";
import { createMcpStdioClient } from "../../scripts/mcp-stdio-client.mjs";
import { PROJECT_HOST_IDS, commandAdapterPathsForHost } from "../../src/core/command-manifest.mjs";
import { initDoveGoal } from "../../src/core/mission-contracts.mjs";
import { runWithMutationContext } from "../../src/core/mutation-backend.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

const ROOT = process.cwd();
const CLI = path.join(ROOT, "bin", "dove-package.mjs");
const DOVE_HOST_PATHS = Object.fromEntries(PROJECT_HOST_IDS.map((hostId) => [hostId, commandAdapterPathsForHost(hostId)]));
const SECRET_VALUE_PATTERN = /(?:ANTHROPIC_API_KEY|ANTHROPIC_AUTH_TOKEN)\s*[:=]\s*["']?[^"'\s,}]+|sk-[A-Za-z0-9_-]{16,}/iu;

function assertNoSecretValues(output) {
  assert.doesNotMatch(output, SECRET_VALUE_PATTERN);
}

function createClaudeHostTestEnv() {
  const claudeConfigRoot = createTempRoot("dove-claude-config-");
  const shellRoot = createTempRoot("dove-claude-shell-");
  const claudeShellRc = path.join(shellRoot, ".bashrc");
  return {
    claudeConfigRoot,
    claudeShellRc,
    env: {
      ...process.env,
      DOVE_CLAUDE_CONFIG_DIR: claudeConfigRoot,
      DOVE_CLAUDE_SHELL_RC: claudeShellRc
    }
  };
}

function assertDoveHostPaths(target, hostIds) {
  for (const hostId of hostIds) {
    for (const relativePath of DOVE_HOST_PATHS[hostId]) {
      assert.ok(fs.existsSync(path.join(target, relativePath)), `missing ${relativePath}`);
    }
  }
}

function bootstrapLegacyWorkspace(target) {
  const doveRoot = path.join(target, ".dove");
  fs.mkdirSync(doveRoot, { recursive: true });
  fs.writeFileSync(path.join(doveRoot, "manifest.json"), `${JSON.stringify({ version: 1, status: "authoritative" }, null, 2)}\n`, "utf8");
}

function bootstrapCurrentWorkspace(target, goal = "Doctor current schema test") {
  const proposal = initDoveGoal(target, { goal, mutationMode: "direct-process" });
  return runWithMutationContext(target, {
    actionId: "init-dove-goal",
    mutationMode: "direct-process",
    hostId: "test"
  }, () => initDoveGoal(target, proposal.confirmation.confirmArgs));
}

function snapshotTreeBytes(target) {
  const output = {};
  if (!fs.existsSync(target)) return output;
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = path.relative(target, absolutePath).split(path.sep).join("/");
      if (entry.isDirectory()) visit(absolutePath);
      else if (entry.isSymbolicLink()) output[relativePath] = `symlink:${fs.readlinkSync(absolutePath)}`;
      else output[relativePath] = fs.readFileSync(absolutePath).toString("base64");
    }
  };
  visit(target);
  return output;
}

function snapshotInstalledDurableState(target) {
  const doveRoot = path.join(target, ".dove");
  const snapshot = {};
  if (!fs.existsSync(doveRoot)) {
    return snapshot;
  }
  const stack = [doveRoot];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
      } else {
        snapshot[path.relative(target, absolutePath).split(path.sep).join("/")] = fs.readFileSync(absolutePath, "utf8");
      }
    }
  }
  return snapshot;
}

test("public package docs distinguish installed commands from source-checkout development", () => {
  const publicDocPaths = ["README.md", "docs/README.md", "docs/INSTALL.md", "docs/USAGE.md", "docs/PACKAGING.md", "docs/CAPABILITY_MATRIX.md", "docs/DOVE_COMMAND_OUTPUT_SAMPLES.md"];
  for (const relativePath of publicDocPaths) {
    const text = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
    assert.doesNotMatch(text, /\/home\/nvme01\/paper_factory/);
  }
  const samples = fs.readFileSync(path.join(ROOT, "docs", "DOVE_COMMAND_OUTPUT_SAMPLES.md"), "utf8");
  assert.match(samples, /"newSchemaVersion": 8/);
  assert.match(samples, /"mission"[\s\S]{0,600}"contractDigest": "<64 lowercase hex>"/);
  assert.match(samples, /"scope"[\s\S]{0,500}"currentContext"[\s\S]{0,800}"stableGaps"/);
  assert.doesNotMatch(samples, /"schema": \{ "state": "current", "version": 8 \}/);
  assert.doesNotMatch(samples, /"zeroWrite": true/);
  const installText = fs.readFileSync(path.join(ROOT, "docs", "INSTALL.md"), "utf8");
  assert.match(installText, /npx dove install \. --force/);
  assert.match(installText, /raw `bin\/dove\.mjs` entrypoint exists only in a Dove source checkout/);
  assert.doesNotMatch(installText, /From the repository root:[\s\S]{0,600}node \.\/bin\/dove-package\.mjs install/);
  for (const relativePath of ["README.md", "docs/README.md", "docs/INSTALL.md", "docs/USAGE.md", "docs/PACKAGING.md", "docs/CAPABILITY_MATRIX.md", "docs/DOVE_COMMAND_OUTPUT_SAMPLES.md"]) {
    const text = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
    for (const command of ["npm run commands:generate", "npm run commands:check", "npm run workflow-goals:validate", "npm run build", "npm run check", "npm run release:check"]) {
      if (text.includes(command)) {
        assert.match(text, /source checkout|source-checkout|maintainer-only/i, `${relativePath} must scope ${command} to source development`);
      }
    }
  }
  for (const relativePath of publicDocPaths) {
    const text = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
    assert.doesNotMatch(text, /\.dove\/meta\/operator-lessons\.json|query_operator_lessons|record_operator_lesson/u, `${relativePath} exposes retired lesson surfaces`);
  }
});

test("npm package dry-run includes Dove-only adapters and current public docs", () => {
  const result = spawnSync("npm", ["pack", "--dry-run", "--json"], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const [pack] = JSON.parse(result.stdout);
  const packagedPaths = new Set(pack.files.map((file) => file.path));
  for (const hostPaths of Object.values(DOVE_HOST_PATHS)) {
    for (const relativePath of hostPaths) {
      assert.ok(packagedPaths.has(relativePath), `missing packaged adapter ${relativePath}`);
    }
  }
  for (const publicDocPath of [
    "docs/README.md",
    "docs/INSTALL.md",
    "docs/USAGE.md",
    "docs/PACKAGING.md",
    "docs/CAPABILITY_MATRIX.md",
    "docs/DOVE_COMMAND_OUTPUT_SAMPLES.md"
  ]) {
    assert.ok(packagedPaths.has(publicDocPath), `missing public doc ${publicDocPath}`);
  }
  for (const publicCommand of ["init", "mission", "status", "lessons", "version", "source", "note", "figure", "experience", "draft", "review", "rebuttal"]) {
    assert.ok(packagedPaths.has(`.opencode/commands/dove.${publicCommand}.md`), `missing public command ${publicCommand}`);
  }
  for (const removedPath of [
    ".opencode/commands/dove.auto.md",
    ".opencode/commands/dove.operator.md",
    ".opencode/commands/dove.review-loop.md",
    ".opencode/commands/dove.orchestrate.md",
    ".opencode/commands/dove.plan.md",
    ".opencode/commands/dove.checklist.md",
    ".opencode/commands/dove.audit.md",
    ".opencode/commands/dove.autonomy-operate.md",
    ".opencode/commands/dove.return.md",
    ".opencode/commands/dove.follow-through.md",
    ".opencode/commands/dove.governance-audit.md",
    ".opencode/commands/dove.onboard.md",
    ".opencode/commands/dove.launch.md",
    ".opencode/commands/dove.approvals.md",
    ".opencode/commands/dove.kill.md",
    ".opencode/commands/dove.paper.experiment.md",
    ".opencode/commands/dove.paper.version.md",
    ".opencode/commands/dove.paper.figure.md",
    ".claude/commands/dove/paper/draft.md",
    ".codex/skills/dove-paper-approvals/SKILL.md",
    ".agents/skills/dove-paper-orchestrate/SKILL.md",
    "src/core/runtime.mjs"
  ]) {
    assert.equal(packagedPaths.has(removedPath), false, `packaged removed adapter ${removedPath}`);
  }
  for (const roleSkill of ["dove-planner", "dove-builder", "dove-reviewer"]) {
    assert.ok(packagedPaths.has(`.opencode/skills/${roleSkill}/SKILL.md`));
  }
  for (const removedSkill of ["dove-pipeline", "dove-researcher", "dove-rebuttal-strategist", "dove-experiment-planning", "dove-version-analyst", "dove-claim-gate", "dove-citation-discipline", "dove-rebuttal", "dove-review-loop"]) {
    assert.equal(packagedPaths.has(`.opencode/skills/${removedSkill}/SKILL.md`), false);
  }
  assert.equal(packagedPaths.has(".agents/skills/dove-lessons/SKILL.md"), true);
  for (const forbiddenPath of [
    ".codex/config.toml",
    ".codex/skills/parallel/SKILL.md",
    ".agents/skills/start/SKILL.md",
    ".opencode/commands/trellis/start.md",
    ".claude/commands/trellis/start.md",
    ".cursor/commands/trellis-start.md",
    "docs/DOVE_REFACTOR_PLAN_2026-05-04.md",
    "docs/ROLE_HIERARCHY_REFACTOR_PLAN_2026-05-04.md",
    "docs/PAPER_FACTORY_SYSTEM_ORIGINS.zh-CN.md",
    "docs/REFERENCE_ARCHITECTURES.zh-CN.md"
  ]) {
    assert.equal(packagedPaths.has(forbiddenPath), false, `packaged internal artifact ${forbiddenPath}`);
  }
});

test("packed package exposes only standalone public surfaces to an installed consumer", async () => {
  const target = createTempRoot("dove-npm-consumer-");
  const packDir = path.join(target, "pack");
  const consumerDir = path.join(target, "consumer");

  try {
    fs.mkdirSync(packDir, { recursive: true });
    fs.mkdirSync(consumerDir, { recursive: true });
    const packed = spawnSync("npm", ["pack", "--json", "--pack-destination", packDir], { cwd: ROOT, encoding: "utf8" });
    assert.equal(packed.status, 0, packed.stderr || packed.stdout);
    const [packResult] = JSON.parse(packed.stdout);
    const tarball = path.join(packDir, packResult.filename);
    const packagedPaths = packResult.files.map((file) => file.path);
    for (const expected of [
      "dist/index.mjs",
      "bin/dove-package.mjs",
      "mcp/dove-state-server-package.mjs",
      "scripts/doctor-mcp-probe-package.mjs"
    ]) {
      assert.ok(packagedPaths.includes(expected), `missing package bundle ${expected}`);
    }
    for (const packagedPath of packagedPaths) {
      assert.doesNotMatch(packagedPath, /^src\//u, `raw source shipped: ${packagedPath}`);
      assert.doesNotMatch(packagedPath, /(?:\.map$|\/[^/]*chunk[^/]*\.[cm]?js$)/iu, `map or chunk shipped: ${packagedPath}`);
    }
    for (const forbidden of [
      "bin/dove.mjs",
      "mcp/dove-state-server.mjs",
      "scripts/doctor-mcp-probe.mjs",
      "scripts/build-package.mjs",
      "scripts/generate-command-adapters.mjs",
      "scripts/generate-command-adapters-cli.mjs"
    ]) {
      assert.equal(packagedPaths.includes(forbidden), false, `raw source shipped: ${forbidden}`);
    }

    fs.writeFileSync(path.join(consumerDir, "package.json"), `${JSON.stringify({ name: "dove-package-consumer-regression", private: true, type: "module" }, null, 2)}\n`);
    const installed = spawnSync("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball], { cwd: consumerDir, encoding: "utf8" });
    assert.equal(installed.status, 0, installed.stderr || installed.stdout);

    const probeSource = `
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const rootApi = await import("dove");
for (const name of [
  "createMutationContext",
  "runWithMutationContext",
  "currentMutationContext",
  "isPatchPlanMode",
  "ensureWorkspace",
  "saveBoard",
  "writeJson",
  "writeText",
  "appendText",
  "saveState",
  "initProject",
  "queryProgramApprovals"
]) {
  assert.equal(name in rootApi, false, \`forbidden root export \${name}\`);
}
for (const name of ["queryDoveStatus", "createDoveMission", "queryDoveLessons", "recordDoveLesson", "registerSource", "upsertNote", "runExperienceWorkflow", "runFigureWorkflow", "createVersionSnapshot"]) {
  assert.equal(typeof rootApi[name], "function", \`missing public root export \${name}\`);
}
const rootEntryUrl = import.meta.resolve("dove");
for (const moduleName of [
  "workspace.mjs",
  "mutation-backend.mjs",
  "runtime-state.mjs",
  "navigation.mjs",
  "artifacts.mjs",
  "orchestration.mjs",
  "reviews.mjs",
  "runtime-authorization.mjs",
  "program-operating-state.mjs",
  "schema.mjs",
  "task-workflow.mjs"
]) {
  await assert.rejects(import(new URL(\`./\${moduleName}\`, rootEntryUrl)), (error) => error?.code === "ERR_MODULE_NOT_FOUND");
}
for (const relativePath of ["../src/core/workspace.mjs", "../src/mcp/server.mjs"]) {
  await assert.rejects(import(new URL(relativePath, rootEntryUrl)), (error) => error?.code === "ERR_MODULE_NOT_FOUND");
}
`;
    const probe = spawnSync(process.execPath, ["--input-type=module", "-e", probeSource], { cwd: consumerDir, encoding: "utf8" });
    assert.equal(probe.status, 0, probe.stderr || probe.stdout);

    const installedCliPath = path.join(consumerDir, "node_modules", ".bin", "dove");
    const installedCli = spawnSync(installedCliPath, ["--help"], { cwd: consumerDir, encoding: "utf8" });
    assert.equal(installedCli.status, 0, installedCli.stderr || installedCli.stdout);

    const installedProject = path.join(target, "installed-project");
    fs.mkdirSync(installedProject, { recursive: true });
    const installProject = spawnSync(installedCliPath, ["install", installedProject, "--force", "--host", "opencode"], { cwd: consumerDir, encoding: "utf8" });
    assert.equal(installProject.status, 0, installProject.stderr || installProject.stdout);
    assert.equal(fs.existsSync(path.join(installedProject, ".dove")), false, "install must not bootstrap project workflow state");

    const initAdapter = fs.readFileSync(path.join(installedProject, ".opencode", "commands", "dove.init.md"), "utf8");
    assert.match(initAdapter, /node \.\/bin\/dove-package\.mjs init \. --goal "<project goal>" --mutation-mode direct-process --json/);
    const adapterInit = spawnSync("node", ["./bin/dove-package.mjs", "init", ".", "--goal", "Installed adapter smoke", "--mutation-mode", "direct-process", "--json"], { cwd: installedProject, encoding: "utf8" });
    assert.equal(adapterInit.status, 0, adapterInit.stderr || adapterInit.stdout);
    const initPayload = JSON.parse(adapterInit.stdout);
    assert.equal(fs.existsSync(path.join(installedProject, ".dove")), false, "init proposal must be zero-write");
    const initReplay = spawnSync("/bin/sh", ["-c", initPayload.confirmation.exactConfirmationCommand], { cwd: installedProject, encoding: "utf8" });
    assert.equal(initReplay.status, 0, initReplay.stderr || initReplay.stdout);
    const projectIdentity = JSON.parse(fs.readFileSync(path.join(installedProject, ".dove", "project.json"), "utf8"));
    assert.match(JSON.stringify(projectIdentity), /Installed adapter smoke/);
    assert.equal(fs.existsSync(path.join(installedProject, ".dove", "state.json")), false);

    const beforeMissionProposal = snapshotInstalledDurableState(installedProject);
    const missionProposal = spawnSync("node", ["./bin/dove-package.mjs", "mission", ".", "--goal", "Verify installed exact mission replay", "--mutation-mode", "direct-process", "--json"], { cwd: installedProject, encoding: "utf8" });
    assert.equal(missionProposal.status, 0, missionProposal.stderr || missionProposal.stdout);
    const missionPayload = JSON.parse(missionProposal.stdout);
    assert.match(missionPayload.confirmation.exactConfirmationCommand, /bin\/dove-package\.mjs/);
    assert.doesNotMatch(missionPayload.confirmation.exactConfirmationCommand, /bin\/dove\.mjs/);
    assert.match(missionPayload.confirmation.exactConfirmationCommand, /--mutation-mode 'direct-process' --json$/);
    assert.deepEqual(snapshotInstalledDurableState(installedProject), beforeMissionProposal, "mission proposal must be zero-write");
    const missionReplay = spawnSync("/bin/sh", ["-c", missionPayload.confirmation.exactConfirmationCommand], { cwd: installedProject, encoding: "utf8" });
    assert.equal(missionReplay.status, 0, missionReplay.stderr || missionReplay.stdout);
    assert.doesNotMatch(`${missionReplay.stderr}\n${missionReplay.stdout}`, /MODULE_NOT_FOUND/);
    assert.equal(fs.existsSync(path.join(installedProject, ".dove", "missions", `${missionPayload.mission.missionId}.json`)), true);
    assert.equal(fs.existsSync(path.join(installedProject, ".dove", "task-packets")), false);

    const receiptArtifactPath = "outputs/installed-receipt.md";
    const receiptArtifactFullPath = path.join(installedProject, receiptArtifactPath);
    fs.mkdirSync(path.dirname(receiptArtifactFullPath), { recursive: true });
    fs.writeFileSync(receiptArtifactFullPath, "installed receipt artifact\n", "utf8");
    const receiptMissionProposal = spawnSync("node", ["./bin/dove-package.mjs", "mission", ".", "--mission-id", "installed-receipt-current", "--goal", "Verify installed receipt post-commit assessment", "--target-artifact", receiptArtifactPath, "--expected-artifact", receiptArtifactPath, "--completion-criterion", "The installed receipt artifact is current.", "--evidence-requirement", `artifact:${receiptArtifactPath}`, "--mutation-mode", "direct-process", "--json"], { cwd: installedProject, encoding: "utf8" });
    assert.equal(receiptMissionProposal.status, 0, receiptMissionProposal.stderr || receiptMissionProposal.stdout);
    const receiptMissionProposalPayload = JSON.parse(receiptMissionProposal.stdout);
    const receiptMissionReplay = spawnSync("/bin/sh", ["-c", receiptMissionProposalPayload.confirmation.exactConfirmationCommand], { cwd: installedProject, encoding: "utf8" });
    assert.equal(receiptMissionReplay.status, 0, receiptMissionReplay.stderr || receiptMissionReplay.stdout);
    const receiptMission = JSON.parse(fs.readFileSync(path.join(installedProject, ".dove", "missions", "installed-receipt-current.json"), "utf8"));
    const makeReceipt = (receiptId) => ({
      receiptId,
      missionId: receiptMission.missionId,
      contractDigest: receiptMission.contractDigest,
      summary: "Recorded installed receipt artifact.",
      artifacts: [{ path: receiptArtifactPath, kind: "document", sha256: crypto.createHash("sha256").update(fs.readFileSync(receiptArtifactFullPath)).digest("hex") }],
      validations: [],
      criteriaSatisfied: receiptMission.completionCriterionIds.map((criterionId) => ({ criterionId, evidenceRefs: [`artifact:${receiptArtifactPath}`] })),
      producedAt: "2026-07-16T00:00:00.000Z"
    });
    const cliReceiptPath = path.join(installedProject, "cli-receipt-input.json");
    fs.writeFileSync(cliReceiptPath, `${JSON.stringify(makeReceipt("installed-cli-receipt"), null, 2)}\n`, "utf8");
    const installedReceiptPlan = spawnSync("node", ["./bin/dove-package.mjs", "receipt", ".", "--input", "cli-receipt-input.json", "--mutation-mode", "patch-plan", "--json"], { cwd: installedProject, encoding: "utf8" });
    assert.equal(installedReceiptPlan.status, 0, installedReceiptPlan.stderr || installedReceiptPlan.stdout);
    const installedReceiptPlanPayload = JSON.parse(installedReceiptPlan.stdout);
    assert.equal(installedReceiptPlanPayload.completion.assessment, null);
    assert.equal(Object.hasOwn(installedReceiptPlanPayload, "postCommit"), false);
    const installedReceipt = spawnSync("node", ["./bin/dove-package.mjs", "receipt", ".", "--input", "cli-receipt-input.json", "--mutation-mode", "direct-process", "--json"], { cwd: installedProject, encoding: "utf8" });
    assert.equal(installedReceipt.status, 0, installedReceipt.stderr || installedReceipt.stdout);
    const installedReceiptPayload = JSON.parse(installedReceipt.stdout);
    assert.equal(installedReceiptPayload.completion.assessment.currentReceiptId, "installed-cli-receipt");
    assert.equal(installedReceiptPayload.completion.assessment.complete, true);
    assert.equal(Object.hasOwn(installedReceiptPayload, "postCommit"), false);

    const lockPath = path.join(installedProject, ".dove", ".receipt-ledger-append.lock");
    fs.writeFileSync(lockPath, "occupied\n", "utf8");
    const failedReceiptPath = path.join(installedProject, "failed-receipt-input.json");
    fs.writeFileSync(failedReceiptPath, `${JSON.stringify(makeReceipt("installed-failed-receipt"), null, 2)}\n`, "utf8");
    const failedReceipt = spawnSync("node", ["./bin/dove-package.mjs", "receipt", ".", "--input", "failed-receipt-input.json", "--mutation-mode", "direct-process", "--json"], { cwd: installedProject, encoding: "utf8" });
    assert.equal(failedReceipt.status, 1, failedReceipt.stderr || failedReceipt.stdout);
    const failedReceiptPayload = JSON.parse(failedReceipt.stdout);
    assert.equal(failedReceiptPayload.status, "blocked");
    assert.equal(Object.hasOwn(failedReceiptPayload, "completion"), false);
    assert.equal(fs.existsSync(path.join(installedProject, ".dove", "receipts", "execution", "installed-failed-receipt.json")), false);
    fs.rmSync(lockPath);

    const installedMcp = createMcpStdioClient({ args: [path.join(consumerDir, "node_modules", "dove", "mcp", "dove-state-server-package.mjs")], cwd: installedProject });
    try {
      await installedMcp.call("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "installed-receipt-regression", version: "1" } });
      installedMcp.notify("notifications/initialized");
      const mcpPlanResult = await installedMcp.call("tools/call", { name: "ingest_execution_receipt", arguments: { ...makeReceipt("installed-mcp-planned"), mutationMode: "patch-plan", resultMode: "full" } });
      const mcpPlanPayload = JSON.parse(mcpPlanResult.content[0].text);
      assert.equal(mcpPlanPayload.completion.assessment, null);
      assert.equal(Object.hasOwn(mcpPlanPayload, "postCommit"), false);
      const mcpDirectResult = await installedMcp.call("tools/call", { name: "ingest_execution_receipt", arguments: { ...makeReceipt("installed-mcp-receipt"), mutationMode: "direct-process", resultMode: "full" } });
      assert.notEqual(mcpDirectResult.isError, true, mcpDirectResult.content?.[0]?.text);
      const mcpDirectPayload = JSON.parse(mcpDirectResult.content[0].text);
      assert.equal(mcpDirectPayload.completion.assessment.currentReceiptId, "installed-mcp-receipt");
      assert.equal(mcpDirectPayload.completion.assessment.complete, true);
      assert.equal(Object.hasOwn(mcpDirectPayload, "postCommit"), false);
    } finally {
      installedMcp.kill();
    }

    const beforeLessonQuery = snapshotInstalledDurableState(installedProject);
    const lessonQuery = spawnSync("node", ["./bin/dove-package.mjs", "lessons", "query", ".", "--mission-id", missionPayload.mission.missionId, "--json"], { cwd: installedProject, encoding: "utf8" });
    assert.equal(lessonQuery.status, 0, lessonQuery.stderr || lessonQuery.stdout);
    assert.equal(JSON.parse(lessonQuery.stdout).status, "empty");
    assert.deepEqual(snapshotInstalledDurableState(installedProject), beforeLessonQuery, "installed lesson query must be zero-write");

    const lessonProposal = spawnSync("node", ["./bin/dove-package.mjs", "lessons", "record", ".", "--mission-id", missionPayload.mission.missionId, "--lesson-id", "installed-lesson", "--scope", "global", "--kind", "method", "--summary", "Keep installed lesson replay exact.", "--next-time-guidance", "Replay only the returned token.", "--json"], { cwd: installedProject, encoding: "utf8" });
    assert.equal(lessonProposal.status, 0, lessonProposal.stderr || lessonProposal.stdout);
    const lessonPayload = JSON.parse(lessonProposal.stdout);
    assert.equal(lessonPayload.status, "needs-confirmation");
    assert.equal(fs.existsSync(path.join(installedProject, ".dove", "lessons")), false);
    const lessonReplay = spawnSync("/bin/sh", ["-c", lessonPayload.confirmation.exactConfirmationCommand], { cwd: installedProject, encoding: "utf8" });
    assert.equal(lessonReplay.status, 0, lessonReplay.stderr || lessonReplay.stdout);
    assert.equal(fs.existsSync(path.join(installedProject, ".dove", "lessons", "installed-lesson.json")), true);

    const beforeDeletedCommands = snapshotInstalledDurableState(installedProject);
    for (const deletedCommand of ["auto", "operator", "review-loop", "launch", "orchestrate", "audit", "return"]) {
      const rejected = spawnSync("node", ["./bin/dove-package.mjs", deletedCommand, "."], { cwd: installedProject, encoding: "utf8" });
      assert.equal(rejected.status, 1, rejected.stderr || rejected.stdout);
      assert.match(rejected.stdout, /Usage:/u);
      assert.deepEqual(snapshotInstalledDurableState(installedProject), beforeDeletedCommands);
    }
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test("generated adapter writers reject symlinked destinations", () => {
  const root = createTempRoot("dove-generated-adapter-symlink-");
  const outside = createTempRoot("dove-generated-adapter-symlink-outside-");
  fs.mkdirSync(path.join(root, ".opencode"), { recursive: true });
  fs.symlinkSync(outside, path.join(root, ".opencode", "commands"), "dir");

  assert.throws(() => writeGeneratedAdapters(root), /must not contain symbolic links/);
  assert.deepEqual(fs.readdirSync(outside), []);
});

test("Claude adapter writer preflights its full write set before a later symlink failure", () => {
  const root = createTempRoot("dove-claude-adapter-atomic-");
  fs.mkdirSync(path.join(root, "commands", "dove"), { recursive: true });
  fs.writeFileSync(path.join(root, "commands", "dove", "init.md"), "keep init bytes\n", "utf8");
  const outside = createTempRoot("dove-claude-adapter-atomic-outside-");
  fs.symlinkSync(outside, path.join(root, "commands", "dove", "status.md"));
  const before = snapshotTreeBytes(root);
  assert.throws(() => writeClaudeUserCommandAdapters(root), /must not contain symbolic links/);
  assert.deepEqual(snapshotTreeBytes(root), before);
  assert.deepEqual(fs.readdirSync(outside), []);
});

test("generated adapter check reports stale managed adapter files", () => {
  const target = createTempRoot("dove-generated-adapters-");

  try {
    writeGeneratedAdapters(target);
    assert.deepEqual(checkGeneratedAdapters(target), []);

    const staleRelativePath = ".claude/commands/dove/paper-stale.md";
    const staleAbsolutePath = path.join(target, staleRelativePath);
    fs.mkdirSync(path.dirname(staleAbsolutePath), { recursive: true });
    fs.writeFileSync(staleAbsolutePath, "# stale\n", "utf8");

    const drift = checkGeneratedAdapters(target);
    assert.ok(
      drift.some((item) => item.relativePath === staleRelativePath && item.reason === "stale"),
      JSON.stringify(drift)
    );
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test("release and maturity checks keep doctor validation independent from release health", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const maturityText = fs.readFileSync(path.join(ROOT, "scripts", "validate-maturity.mjs"), "utf8");
  const doctorValidationText = fs.readFileSync(path.join(ROOT, "scripts", "validate-doctor.mjs"), "utf8");

  assert.equal(packageJson.scripts["doctor:validate"], "node ./scripts/validate-doctor.mjs");
  assert.match(packageJson.scripts["release:check"], /npm run maturity:audit/);
  assert.doesNotMatch(packageJson.scripts["release:check"], /npm run doctor(?!:validate)/);
  assert.doesNotMatch(maturityText, /doctor:validate|\["node", \["\.\/bin\/dove\.mjs", "doctor", "\."\]\]/);
  assert.match(doctorValidationText, /createTempWorkspace\("dove-doctor-"\)/);
  assert.match(doctorValidationText, /createTempWorkspace\("dove-claude-config-"\)/);
  assert.match(doctorValidationText, /createTempWorkspace\("dove-claude-shell-"\)/);
  assert.match(doctorValidationText, /DOVE_CLAUDE_SHELL_RC/);
  assert.match(doctorValidationText, /"install", target, "--force", "--host", "claude"/);
  assert.match(doctorValidationText, /"doctor", target/);
});

test("CLI install leaves a pre-existing symlinked .dove path untouched", () => {
  const target = createTempRoot("dove-install-symlink-");
  const outside = createTempRoot("dove-install-symlink-outside-");
  fs.symlinkSync(outside, path.join(target, ".dove"), "dir");

  const result = spawnSync("node", [CLI, "install", target, "--force"], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(fs.readdirSync(outside), []);
  assert.equal(fs.realpathSync.native(path.join(target, ".dove")), fs.realpathSync.native(outside));
});

test("CLI install preflights the full project write set before a later symlink failure", () => {
  const target = createTempRoot("dove-install-nested-symlink-");
  const outside = createTempRoot("dove-install-nested-symlink-outside-");
  fs.mkdirSync(path.join(target, "docs"), { recursive: true });
  fs.writeFileSync(path.join(target, "README.md"), "keep project bytes\n", "utf8");
  fs.symlinkSync(outside, path.join(target, "docs", "README.md"));
  const before = snapshotTreeBytes(target);

  const result = spawnSync("node", [CLI, "install", target, "--force"], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.match(result.stderr || result.stdout, /must not contain symbolic links/);
  assert.deepEqual(snapshotTreeBytes(target), before);
  assert.deepEqual(fs.readdirSync(outside), []);
});

test("CLI install copies runtime and adapters without bootstrapping workflow state", () => {
  const target = createTempRoot("dove-install-");
  const result = spawnSync("node", [CLI, "install", target, "--force"], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  for (const publicCommand of ["init", "mission", "status", "lessons", "version", "source", "note", "figure", "experience", "draft", "review", "rebuttal"]) {
    assert.ok(fs.existsSync(path.join(target, ".opencode", "commands", `dove.${publicCommand}.md`)), `missing installed public command ${publicCommand}`);
  }
  for (const removedCommand of ["auto", "operator", "review-loop", "approvals", "launch", "kill", "plan", "orchestrate", "audit", "return", "autonomy-operate", "follow-through", "onboard"]) {
    assert.equal(fs.existsSync(path.join(target, ".opencode", "commands", `dove.${removedCommand}.md`)), false);
  }
  assert.equal(fs.existsSync(path.join(target, ".opencode", "commands", "dove.paper.experiment.md")), false);
  assert.equal(fs.existsSync(path.join(target, ".opencode", "commands", "dove.paper.version.md")), false);
  for (const roleSkill of ["dove-planner", "dove-builder", "dove-reviewer"]) {
    assert.ok(fs.existsSync(path.join(target, ".opencode", "skills", roleSkill, "SKILL.md")));
  }
  for (const removedSkill of ["dove-pipeline", "dove-researcher", "dove-rebuttal-strategist", "dove-experiment-planning", "dove-version-analyst", "dove-claim-gate", "dove-citation-discipline", "dove-rebuttal", "dove-review-loop"]) {
    assert.equal(fs.existsSync(path.join(target, ".opencode", "skills", removedSkill)), false);
  }
  assert.equal(fs.existsSync(path.join(target, ".opencode", "agents")), false);
  assert.equal(fs.existsSync(path.join(target, ".opencode", "plugins")), false);
  assert.equal(fs.existsSync(path.join(target, ".dove")), false);
  assert.ok(fs.existsSync(path.join(target, "dist", "index.mjs")));
  assert.ok(fs.existsSync(path.join(target, "bin", "dove-package.mjs")));
  assert.ok(fs.existsSync(path.join(target, "mcp", "dove-state-server-package.mjs")));
  assert.ok(fs.existsSync(path.join(target, "scripts", "doctor-mcp-probe-package.mjs")));
  assert.equal(fs.existsSync(path.join(target, "bin", "dove.mjs")), false);
  assert.equal(fs.existsSync(path.join(target, "mcp", "dove-state-server.mjs")), false);
  assert.equal(fs.existsSync(path.join(target, "src")), false);
  for (const internalDoc of [
    "DOVE_REFACTOR_PLAN_2026-05-04.md",
    "ROLE_HIERARCHY_REFACTOR_PLAN_2026-05-04.md",
    "PAPER_FACTORY_SYSTEM_ORIGINS.zh-CN.md",
    "REFERENCE_ARCHITECTURES.zh-CN.md"
  ]) {
    assert.equal(fs.existsSync(path.join(target, "docs", internalDoc)), false);
  }
  const config = JSON.parse(fs.readFileSync(path.join(target, ".opencode.json"), "utf8"));
  assert.equal(Object.hasOwn(config, "$schema"), false);
});

test("CLI install can install optional host adapters without local unsafe files", () => {
  const target = createTempRoot("dove-install-hosts-");
  const result = spawnSync("node", [CLI, "install", target, "--force", "--host", "cursor", "--host", "agents"], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.deepEqual(payload.hosts, ["cursor", "agents"]);
  assert.equal(fs.existsSync(path.join(target, ".claude", "commands", "dove")), false);
  assert.ok(fs.existsSync(path.join(target, ".cursor", "commands")));
  assert.ok(fs.existsSync(path.join(target, ".agents", "skills")));
  assert.ok(fs.existsSync(path.join(target, "AGENTS.md")));
  assertDoveHostPaths(target, ["cursor", "agents"]);
  assert.equal(fs.existsSync(path.join(target, ".cursor", "commands", "trellis-start.md")), false);
  assert.equal(fs.existsSync(path.join(target, ".agents", "skills", "start", "SKILL.md")), false);
  assert.equal(fs.existsSync(path.join(target, ".claude", "settings.local.json")), false);
  assert.equal(fs.existsSync(path.join(target, ".opencode", "node_modules")), false);
});

test("CLI install preflights project and Claude writes before a Claude symlink failure", () => {
  const target = createTempRoot("dove-install-claude-symlink-");
  const { claudeConfigRoot, claudeShellRc, env } = createClaudeHostTestEnv();
  const outside = createTempRoot("dove-install-claude-symlink-outside-");
  const settings = '{"fastMode":false}\n';
  const shell = "# user shell\n";
  fs.writeFileSync(path.join(target, "README.md"), "keep project bytes\n", "utf8");
  fs.writeFileSync(path.join(claudeConfigRoot, "settings.json"), settings, "utf8");
  fs.writeFileSync(claudeShellRc, shell, "utf8");
  fs.mkdirSync(path.join(claudeConfigRoot, "commands"), { recursive: true });
  fs.symlinkSync(outside, path.join(claudeConfigRoot, "commands", "dove"), "dir");
  const projectBefore = snapshotTreeBytes(target);
  const claudeBefore = snapshotTreeBytes(claudeConfigRoot);

  const adapterResult = spawnSync("node", [CLI, "install", target, "--force", "--host", "claude"], { cwd: ROOT, encoding: "utf8", env });
  assert.equal(adapterResult.status, 1, adapterResult.stderr || adapterResult.stdout);
  assert.match(adapterResult.stderr || adapterResult.stdout, /must not contain symbolic links/);
  assert.deepEqual(snapshotTreeBytes(target), projectBefore);
  assert.deepEqual(snapshotTreeBytes(claudeConfigRoot), claudeBefore);
  assert.equal(fs.readFileSync(path.join(claudeConfigRoot, "settings.json"), "utf8"), settings);
  assert.equal(fs.readFileSync(claudeShellRc, "utf8"), shell);
  assert.deepEqual(fs.readdirSync(outside), []);
});

test("CLI install writes only Claude user commands and keeps settings and shell byte-identical", () => {
  const target = createTempRoot("dove-install-claude-user-");
  const { claudeConfigRoot, claudeShellRc, env } = createClaudeHostTestEnv();
  const settings = `${JSON.stringify({ theme: "dark", fastMode: false, env: { EXISTING_ENV: "kept" } }, null, 2)}\n`;
  const shell = '# user shell\n[ -z "$PS1" ] && return\nexport AFTER_RETURN=1\n';
  fs.writeFileSync(path.join(claudeConfigRoot, "settings.json"), settings, "utf8");
  fs.writeFileSync(claudeShellRc, shell, "utf8");

  const result = spawnSync("node", [CLI, "install", target, "--force", "--host", "claude", "--json"], { cwd: ROOT, encoding: "utf8", env });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.deepEqual(payload.hosts, ["claude"]);
  assert.equal(Object.hasOwn(payload, "claudeCodeGateway"), false);
  assert.equal(fs.existsSync(path.join(target, ".claude", "commands", "dove")), false);
  assert.ok(fs.existsSync(path.join(claudeConfigRoot, "commands", "dove", "status.md")));
  assert.equal(fs.readFileSync(path.join(claudeConfigRoot, "settings.json"), "utf8"), settings);
  assert.equal(fs.readFileSync(claudeShellRc, "utf8"), shell);

  const second = spawnSync("node", [CLI, "sync", target, "--force", "--host", "claude", "--json"], { cwd: ROOT, encoding: "utf8", env });
  assert.equal(second.status, 0, second.stderr || second.stdout);
  assert.equal(fs.readFileSync(path.join(claudeConfigRoot, "settings.json"), "utf8"), settings);
  assert.equal(fs.readFileSync(claudeShellRc, "utf8"), shell);

  const statusCommand = fs.readFileSync(path.join(claudeConfigRoot, "commands", "dove", "status.md"), "utf8");
  assert.match(statusCommand, /node \.\/bin\/dove-package\.mjs status \. --json/);
  assert.match(statusCommand, /never selects an implicit latest mission/);
});

test("CLI install all host adapters skips unsafe local artifacts", () => {
  const target = createTempRoot("dove-install-all-hosts-");
  const { claudeConfigRoot, claudeShellRc, env } = createClaudeHostTestEnv();
  const result = spawnSync("node", [CLI, "install", target, "--force", "--host", "all"], {
    cwd: ROOT,
    encoding: "utf8",
    env
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.deepEqual(payload.hosts, ["opencode", "codex", "cursor", "agents", "claude"]);
  assert.ok(fs.existsSync(path.join(target, ".opencode", "commands", "dove.status.md")));
  assert.equal(fs.existsSync(path.join(target, ".claude", "commands", "dove")), false);
  assert.ok(fs.existsSync(path.join(claudeConfigRoot, "commands", "dove", "status.md")));
  assert.equal(fs.existsSync(path.join(claudeConfigRoot, "settings.json")), false);
  assert.equal(fs.existsSync(claudeShellRc), false);
  assert.equal(Object.hasOwn(payload, "claudeCodeGateway"), false);
  assert.equal(fs.existsSync(path.join(target, ".codex", "agents")), false);
  assert.equal(fs.existsSync(path.join(target, ".codex", "config.toml")), false);
  assert.ok(fs.existsSync(path.join(target, ".cursor", "commands")));
  assert.ok(fs.existsSync(path.join(target, ".agents", "skills")));
  assertDoveHostPaths(target, ["opencode", "cursor", "codex", "agents"]);
  assert.equal(fs.existsSync(path.join(target, ".codex", "skills", "parallel", "SKILL.md")), false);
  assert.equal(fs.existsSync(path.join(target, ".opencode", "node_modules")), false);
  assert.equal(fs.existsSync(path.join(target, ".claude", "settings.local.json")), false);
});

test("CLI sync preserves user-owned .dove workspace state and .dove-archive state", () => {
  const target = createTempRoot("dove-sync-");
  spawnSync("node", [CLI, "install", target, "--force"], {
    cwd: ROOT,
    encoding: "utf8"
  });

  const draftPath = path.join(target, ".dove", "drafts", "introduction.md");
  const archivePath = path.join(target, ".dove-archive", "legacy", "state.json");
  fs.mkdirSync(path.dirname(draftPath), { recursive: true });
  fs.mkdirSync(path.dirname(archivePath), { recursive: true });
  fs.writeFileSync(draftPath, "# Introduction\n\nUser-owned draft content.\n", "utf8");
  fs.writeFileSync(archivePath, '{"legacy":true}\n', "utf8");

  const result = spawnSync("node", [CLI, "sync", target, "--force"], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(fs.readFileSync(draftPath, "utf8"), /User-owned draft content/);
  assert.equal(fs.readFileSync(archivePath, "utf8"), '{"legacy":true}\n');
});

test("CLI doctor treats an installed runtime with absent workspace state as healthy", () => {
  const target = createTempRoot("dove-doctor-");
  const envRoot = createTempRoot("dove-doctor-claude-isolated-");
  const result = spawnSync("node", [CLI, "doctor", target], { cwd: ROOT, encoding: "utf8", env: { ...process.env, DOVE_CLAUDE_CONFIG_DIR: envRoot } });
  assert.equal(result.status, 1, result.stdout);
  const install = spawnSync("node", [CLI, "install", target, "--force", "--host", "opencode", "--json"], { cwd: ROOT, encoding: "utf8", env: { ...process.env, DOVE_CLAUDE_CONFIG_DIR: envRoot } });
  assert.equal(install.status, 0, install.stderr || install.stdout);
  const ready = spawnSync("node", [CLI, "doctor", target, "--json"], { cwd: ROOT, encoding: "utf8", env: { ...process.env, DOVE_CLAUDE_CONFIG_DIR: envRoot } });
  assert.equal(ready.status, 0, ready.stdout);
  assert.equal(JSON.parse(ready.stdout).workspaceMode, "runtime-only");
});

test("CLI doctor reports installed host adapters for multi-host workspaces", () => {
  const target = createTempRoot("dove-doctor-hosts-");
  spawnSync("node", [CLI, "install", target, "--force", "--host", "cursor,codex"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  bootstrapCurrentWorkspace(target, "Doctor host adapters");

  const result = spawnSync("node", [CLI, "doctor", target], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.deepEqual(payload.hostAdapters.filter((host) => host !== "claude"), ["codex", "cursor"]);
  assert.ok(payload.checks.some((check) => check.check === "host-adapter:codex" && check.ok));
  assert.ok(payload.checks.some((check) => check.check === "host-adapter:cursor" && check.ok));
  assert.ok(payload.checks.some((check) => check.check === "workspace-schema" && check.ok));
  assert.equal(payload.workspaceMode, "current-schema");
  assert.equal(payload.workspaceSchema.schemaVersion, 8);
});

test("CLI doctor ignores Claude settings and shell health", () => {
  const target = createTempRoot("dove-doctor-claude-settings-");
  const { claudeConfigRoot, claudeShellRc, env } = createClaudeHostTestEnv();
  const settings = '{"fastMode":false,"env":{"KEEP":"unchanged"}}\n';
  const shell = "# unchanged shell\n";
  fs.writeFileSync(path.join(claudeConfigRoot, "settings.json"), settings, "utf8");
  fs.writeFileSync(claudeShellRc, shell, "utf8");
  const install = spawnSync("node", [CLI, "install", target, "--force", "--host", "claude", "--json"], { cwd: ROOT, encoding: "utf8", env });
  assert.equal(install.status, 0, install.stderr || install.stdout);
  const result = spawnSync("node", [CLI, "doctor", target, "--json"], { cwd: ROOT, encoding: "utf8", env });
  assert.equal(result.status, 0, result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.checks.some((check) => check.check === "claude-code-gateway"), false);
  assert.equal(Object.hasOwn(payload, "claudeCodeGateway"), false);
  assert.equal(fs.readFileSync(path.join(claudeConfigRoot, "settings.json"), "utf8"), settings);
  assert.equal(fs.readFileSync(claudeShellRc, "utf8"), shell);
});

test("CLI doctor passes for a Claude-only install without requiring OpenCode", () => {
  const target = createTempRoot("dove-doctor-claude-ready-");
  const { env } = createClaudeHostTestEnv();
  const install = spawnSync("node", [CLI, "install", target, "--force", "--host", "claude"], {
    cwd: ROOT,
    encoding: "utf8",
    env
  });
  assert.equal(install.status, 0, install.stderr || install.stdout);

  const result = spawnSync("node", [CLI, "doctor", target], {
    cwd: ROOT,
    encoding: "utf8",
    env
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(Object.hasOwn(payload, "claudeCodeGateway"), false);
  assert.deepEqual(payload.hostAdapters, ["claude"]);
  assert.equal(fs.existsSync(path.join(target, ".opencode")), false);
  assert.ok(payload.checks.some((check) => check.check === "host-adapter:claude" && check.ok));
  assert.equal(payload.checks.some((check) => check.check === "host-adapter:opencode"), false);
  assert.equal(payload.checks.some((check) => check.check === "claude-code-gateway"), false);
  assertNoSecretValues(result.stdout);
});

test("CLI doctor fails when a required Dove adapter is missing", () => {
  const target = createTempRoot("dove-doctor-missing-host-");
  spawnSync("node", [CLI, "install", target, "--force", "--host", "cursor"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  const missingAdapterPath = ".cursor/commands/dove-draft.md";
  fs.rmSync(path.join(target, missingAdapterPath));

  const result = spawnSync("node", [CLI, "doctor", target], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 1, result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.ok(payload.missing.includes(missingAdapterPath));
  assert.ok(payload.checks.some((check) => check.check === "host-adapter:cursor" && !check.ok && check.requiredPaths.includes(missingAdapterPath)));
});

test("CLI doctor reports a healthy current schema without legacy orchestration diagnostics", () => {
  const target = createTempRoot("dove-doctor-current-schema-");
  spawnSync("node", [CLI, "install", target, "--force"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  bootstrapCurrentWorkspace(target, "Doctor current schema");

  const result = spawnSync("node", [CLI, "doctor", target], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.healthy, true);
  assert.equal(payload.workspaceMode, "current-schema");
  assert.equal(payload.workspaceSchema.state, "current-healthy");
  assert.equal(payload.workspaceSchema.schemaVersion, 8);
  assert.deepEqual(payload.writes, []);
  assert.equal(payload.checks.some((check) => check.check === "meta-optimize-frontier"), false);
  assert.equal(payload.checks.some((check) => check.check === "dove-authority"), false);
});

test("retired autonomy CLI commands fail without creating workspace state", () => {
  for (const command of ["autonomy-once", "autonomy-foreground", "autonomy-operate"]) {
    const target = createTempRoot(`dove-retired-${command}-`);
    try {
      const result = spawnSync("node", [CLI, command, target, "--actor-role", "planner"], {
        cwd: ROOT,
        encoding: "utf8"
      });

      assert.notEqual(result.status, 0, result.stderr || result.stdout);
      assert.match(result.stderr || result.stdout, /Usage:/);
      assert.equal(fs.existsSync(path.join(target, ".dove")), false);
      assert.deepEqual(fs.readdirSync(target), []);
    } finally {
      fs.rmSync(target, { recursive: true, force: true });
    }
  }
});

test("CLI doctor fails visibly when current manifest JSON is malformed", () => {
  const target = createTempRoot("dove-doctor-bad-json-");
  spawnSync("node", [CLI, "install", target, "--force"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  bootstrapCurrentWorkspace(target, "Doctor malformed manifest");
  fs.writeFileSync(path.join(target, ".dove", "manifest.json"), "{bad json", "utf8");

  const before = snapshotInstalledDurableState(target);
  const result = spawnSync("node", [CLI, "doctor", target], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 1, result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.workspaceMode, "archive-reset-required");
  assert.equal(payload.workspaceSchema.state, "malformed-manifest");
  assert.match(payload.workspaceSchema.error, /Malformed durable JSON/u);
  assert.deepEqual(snapshotInstalledDurableState(target), before);
});

test("CLI doctor classifies legacy workspaces as archive-reset required without inspecting legacy internals", () => {
  const target = createTempRoot("dove-doctor-legacy-root-");
  spawnSync("node", [CLI, "install", target, "--force"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  bootstrapLegacyWorkspace(target);
  const legacyWorkspacePath = path.join(target, ".paper", "workspace");
  fs.mkdirSync(legacyWorkspacePath, { recursive: true });
  fs.writeFileSync(path.join(legacyWorkspacePath, "index.json"), "{}\n", "utf8");
  const before = snapshotInstalledDurableState(target);

  const result = spawnSync("node", [CLI, "doctor", target], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 1, result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.healthy, false);
  assert.equal(payload.workspaceMode, "archive-reset-required");
  assert.equal(payload.workspaceSchema.category, "legacy");
  assert.equal(payload.workspaceSchema.state, "legacy-authority-manifest");
  assert.ok(payload.checks.some((check) => check.check === "workspace-schema" && !check.ok && /archive-reset/u.test(check.message)));
  assert.equal(payload.checks.some((check) => check.check === "dove-authority" || check.check === "meta-optimize-frontier" || check.check === "typed-wiki-relations-health"), false);
  assert.deepEqual(payload.writes, []);
  assert.deepEqual(snapshotInstalledDurableState(target), before);
});
