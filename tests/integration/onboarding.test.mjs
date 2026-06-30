import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { ARTIFACT_PATHS, createDoveTask, discoverPaperArtifacts, ensureWorkspace, initDoveGoal, queryDoveOnboarding } from "../../src/core/index.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

const ROOT = process.cwd();
const CLI = path.join(ROOT, "bin", "dove.mjs");

function tempRoot(prefix = "dove-onboarding-") {
  return createTempRoot(prefix);
}

function writeFixturePaper(root) {
  fs.mkdirSync(path.join(root, "figures"), { recursive: true });
  fs.mkdirSync(path.join(root, "results"), { recursive: true });
  const manuscriptPath = path.join(root, "main.tex");
  fs.writeFileSync(manuscriptPath, "\\documentclass{article}\n\\begin{document}\nHello.\\end{document}\n", "utf8");
  fs.writeFileSync(path.join(root, "refs.bib"), "@article{a, title={A}}\n", "utf8");
  fs.writeFileSync(path.join(root, "figures", "plot.pdf"), "%PDF fixture\n", "utf8");
  fs.writeFileSync(path.join(root, "results", "metrics.json"), "{\"accuracy\":1}\n", "utf8");
  return { manuscriptPath, manuscriptBefore: fs.readFileSync(manuscriptPath, "utf8") };
}

function seedDoveProject(root, suffix) {
  fs.mkdirSync(root, { recursive: true });
  initDoveGoal(root, {
    id: `cli-global-init-${suffix}`,
    title: `CLI Global Project ${suffix}`,
    goal: "Validate CLI global public status publishing."
  });
  createDoveTask(root, {
    id: `cli-global-task-${suffix}`,
    title: `CLI global task ${suffix}`,
    goal: "Keep one project available for CLI global status aggregation.",
    confirmed: true
  });
}

test("discoverPaperArtifacts proposes mappings without writing by default", () => {
  const root = tempRoot();
  const { manuscriptPath, manuscriptBefore } = writeFixturePaper(root);

  const proposal = discoverPaperArtifacts(root);

  assert.equal(proposal.mode, "onboarding-artifact-map");
  assert.equal(proposal.proposalOnly, true);
  assert.equal(proposal.noAutoApply, true);
  assert.equal(proposal.writeMap, false);
  assert.deepEqual(proposal.written, []);
  assert.equal(fs.existsSync(path.join(root, ARTIFACT_PATHS.workspaceArtifactMap)), false);
  assert.equal(fs.readFileSync(manuscriptPath, "utf8"), manuscriptBefore);
  assert.ok(proposal.mappings.some((item) => item.sourcePath === "main.tex" && item.artifactType === "manuscript" && item.lifecycleFamily === "structure"));
  assert.ok(proposal.mappings.some((item) => item.sourcePath === "refs.bib" && item.artifactType === "bibliography" && item.lifecycleFamily === "knowledge"));
});

test("discoverPaperArtifacts writeMap writes only the artifact map", () => {
  const root = tempRoot();
  const { manuscriptPath, manuscriptBefore } = writeFixturePaper(root);
  ensureWorkspace(root);
  const watched = [
    ARTIFACT_PATHS.state,
    ARTIFACT_PATHS.workspaceIndex,
    ARTIFACT_PATHS.orchestrationBoard,
    ARTIFACT_PATHS.workspaceArtifactMap
  ];
  const before = Object.fromEntries(watched.map((relativePath) => {
    const fullPath = path.join(root, relativePath);
    return [relativePath, fs.existsSync(fullPath) ? fs.readFileSync(fullPath, "utf8") : null];
  }));

  const proposal = discoverPaperArtifacts(root, { writeMap: true });
  const after = Object.fromEntries(watched.map((relativePath) => {
    const fullPath = path.join(root, relativePath);
    return [relativePath, fs.existsSync(fullPath) ? fs.readFileSync(fullPath, "utf8") : null];
  }));

  assert.deepEqual(proposal.written, [ARTIFACT_PATHS.workspaceArtifactMap]);
  assert.equal(fs.readFileSync(manuscriptPath, "utf8"), manuscriptBefore);
  assert.equal(after[ARTIFACT_PATHS.state], before[ARTIFACT_PATHS.state]);
  assert.equal(after[ARTIFACT_PATHS.workspaceIndex], before[ARTIFACT_PATHS.workspaceIndex]);
  assert.equal(after[ARTIFACT_PATHS.orchestrationBoard], before[ARTIFACT_PATHS.orchestrationBoard]);
  assert.notEqual(after[ARTIFACT_PATHS.workspaceArtifactMap], before[ARTIFACT_PATHS.workspaceArtifactMap]);
  const writtenMap = JSON.parse(after[ARTIFACT_PATHS.workspaceArtifactMap]);
  assert.equal(writtenMap.proposalOnly, true);
  assert.equal(writtenMap.noAutoApply, true);
  assert.equal(writtenMap.writeMap, true);
});

test("queryDoveOnboarding stays proposal-only even when writeMap is requested", () => {
  const root = tempRoot();
  const { manuscriptPath, manuscriptBefore } = writeFixturePaper(root);

  const proposal = queryDoveOnboarding(root, { writeMap: true });

  assert.equal(proposal.mode, "dove-onboarding-query");
  assert.equal(proposal.proposalOnly, true);
  assert.equal(proposal.noAutoApply, true);
  assert.equal(proposal.writeMap, false);
  assert.deepEqual(proposal.written, []);
  assert.deepEqual(proposal.writes, []);
  assert.equal(proposal.diagnostics.writeMapForcedFalse, true);
  assert.equal(fs.existsSync(path.join(root, ARTIFACT_PATHS.workspaceArtifactMap)), false);
  assert.equal(fs.readFileSync(manuscriptPath, "utf8"), manuscriptBefore);
});

test("CLI onboard defaults to proposal-only and can persist the map", () => {
  const root = tempRoot();
  const { manuscriptPath, manuscriptBefore } = writeFixturePaper(root);

  const dryRun = spawnSync("node", [CLI, "onboard", root], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(dryRun.status, 0, dryRun.stderr || dryRun.stdout);
  const dryPayload = JSON.parse(dryRun.stdout);
  assert.equal(dryPayload.proposalOnly, true);
  assert.equal(dryPayload.writeMap, false);
  assert.deepEqual(dryPayload.written, []);
  assert.equal(fs.existsSync(path.join(root, ARTIFACT_PATHS.workspaceArtifactMap)), false);
  assert.equal(fs.readFileSync(manuscriptPath, "utf8"), manuscriptBefore);

  const writeRun = spawnSync("node", [CLI, "onboard", root, "--write-map"], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(writeRun.status, 0, writeRun.stderr || writeRun.stdout);
  const writePayload = JSON.parse(writeRun.stdout);
  assert.equal(writePayload.proposalOnly, true);
  assert.equal(writePayload.writeMap, true);
  assert.deepEqual(writePayload.written, [ARTIFACT_PATHS.workspaceArtifactMap]);
  assert.equal(fs.existsSync(path.join(root, ARTIFACT_PATHS.workspaceArtifactMap)), true);
  assert.equal(fs.readFileSync(manuscriptPath, "utf8"), manuscriptBefore);
});

test("CLI onboard supports flag-first optional target parsing", () => {
  const root = tempRoot();
  writeFixturePaper(root);

  const result = spawnSync("node", [CLI, "onboard", "--write-map"], {
    cwd: root,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.writeMap, true);
  assert.deepEqual(payload.written, [ARTIFACT_PATHS.workspaceArtifactMap]);
  assert.equal(fs.existsSync(path.join(root, ARTIFACT_PATHS.workspaceArtifactMap)), true);
});

test("CLI onboard write-map patch-plan returns operations without writing disk", () => {
  const root = tempRoot("dove-onboarding-patch-plan-");
  writeFixturePaper(root);

  const result = spawnSync("node", [CLI, "onboard", "--write-map", "--mutation-mode", "patch-plan"], {
    cwd: root,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.mutationMode, "patch-plan");
  assert.equal(payload.writesApplied, false);
  assert.equal(payload.hostRollbackEligible, true);
  assert.equal(payload.writeMap, true);
  assert.deepEqual(payload.written, [ARTIFACT_PATHS.workspaceArtifactMap]);
  assert.equal(payload.mutationPlan.operations.some((operation) => operation.relativePath === ARTIFACT_PATHS.workspaceArtifactMap), true);
  assert.equal(payload.mutationPlan.operations.some((operation) => operation.relativePath === ARTIFACT_PATHS.mutationsIndex), true);
  assert.equal(fs.existsSync(path.join(root, ARTIFACT_PATHS.workspaceArtifactMap)), false);
});

test("CLI install rejects patch-plan mode before bootstrap writes", () => {
  const root = tempRoot("dove-install-patch-plan-");

  const result = spawnSync("node", [CLI, "install", root, "--mutation-mode", "patch-plan"], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /install cannot run in patch-plan mode/);
  assert.equal(fs.existsSync(path.join(root, ".dove")), false);
});

test("CLI doctor rejects patch-plan mode before bootstrap writes", () => {
  const root = tempRoot("dove-doctor-patch-plan-");

  const result = spawnSync("node", [CLI, "doctor", root, "--mutation-mode", "patch-plan"], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /doctor cannot run in patch-plan mode/);
  assert.equal(fs.existsSync(path.join(root, ".dove")), false);
});

test("CLI publish-global-status refreshes only explicit projects", () => {
  const root = tempRoot("dove-global-status-cli-");
  const projectA = path.join(root, "project-a");
  const projectB = path.join(root, "project-b");
  const outputDir = path.join(root, "global-public");
  try {
    seedDoveProject(projectA, "a");
    seedDoveProject(projectB, "b");

    const result = spawnSync("node", [CLI, "publish-global-status", "--project", projectA, "--output", outputDir, "--refresh", "--quiet"], {
      cwd: ROOT,
      encoding: "utf8"
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(result.stdout, "");
    assert.equal(fs.existsSync(path.join(projectA, ".dove", "public", "status.json")), true);
    assert.equal(fs.existsSync(path.join(projectB, ".dove", "public", "status.json")), false);
    assert.equal(fs.existsSync(path.join(outputDir, "status.json")), true);
    assert.equal(fs.existsSync(path.join(outputDir, "status.md")), true);
    assert.equal(fs.existsSync(path.join(outputDir, "index.html")), true);
    const snapshot = JSON.parse(fs.readFileSync(path.join(outputDir, "status.json"), "utf8"));
    assert.equal(snapshot.mode, "dove-global-public-status");
    assert.equal(snapshot.counts.configured, 1);
    assert.equal(snapshot.counts.published, 1);
    assert.equal(snapshot.privacy.absoluteRootsIncluded, false);
    const publicText = `${fs.readFileSync(path.join(outputDir, "status.json"), "utf8")}\n${fs.readFileSync(path.join(outputDir, "status.md"), "utf8")}\n${fs.readFileSync(path.join(outputDir, "index.html"), "utf8")}`;
    assert.equal(publicText.includes(root), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("CLI publish-global-status patch-plan stages project-local output", () => {
  const root = tempRoot("dove-global-status-cli-patch-");
  const projectA = path.join(root, "project-a");
  const outputDir = path.join(root, "global-public");
  try {
    seedDoveProject(projectA, "a");
    const statusResult = spawnSync("node", [CLI, "publish-status", projectA, "--quiet"], {
      cwd: ROOT,
      encoding: "utf8"
    });
    assert.equal(statusResult.status, 0, statusResult.stderr || statusResult.stdout);

    const result = spawnSync("node", [CLI, "publish-global-status", "--project", projectA, "--output", outputDir, "--mutation-mode", "patch-plan"], {
      cwd: root,
      encoding: "utf8"
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.mode, "dove-global-public-status-publish");
    assert.equal(payload.mutationMode, "patch-plan");
    assert.equal(payload.writesApplied, false);
    assert.equal(payload.hostRollbackEligible, true);
    assert.equal(payload.mutationPlan.operations.some((operation) => operation.relativePath === "global-public/status.json"), true);
    assert.equal(payload.mutationPlan.operations.some((operation) => operation.relativePath === "global-public/projects/project-a/status.json"), true);
    assert.equal(payload.mutationPlan.operations.some((operation) => operation.relativePath === ARTIFACT_PATHS.mutationsIndex), true);
    assert.equal(fs.existsSync(outputDir), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("CLI serve-global-status rejects patch-plan mode", () => {
  const root = tempRoot("dove-global-status-serve-patch-");
  const outputDir = path.join(root, "global-public");
  try {
    const result = spawnSync("node", [CLI, "serve-global-status", "--output", outputDir, "--dry-run", "--mutation-mode", "patch-plan"], {
      cwd: root,
      encoding: "utf8"
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /serve-global-status cannot run in patch-plan mode/);
    assert.equal(fs.existsSync(outputDir), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("CLI serve-global-status dry-run plans explicit Cloudflare serving without publishing", () => {
  const root = tempRoot("dove-global-status-serve-cli-");
  const projectRoot = path.join(root, "project-a");
  const outputDir = path.join(root, "global-public");
  const configPath = path.join(root, "dove-config.json");
  try {
    fs.writeFileSync(configPath, JSON.stringify({}), "utf8");
    const result = spawnSync("node", [CLI, "serve-global-status", "--project", projectRoot, "--output", outputDir, "--auth", "--auth-password-env", "DOVE_GLOBAL_STATUS_PASSWORD", "--cloudflare", "--domain", "keli.eu.cc", "--port", "8787", "--dry-run"], {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...process.env, DOVE_CONFIG_PATH: configPath }
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.mode, "dove-global-status-serving-plan");
    assert.equal(payload.dryRun, true);
    assert.equal(payload.willStartHttpServer, false);
    assert.equal(payload.willStartExternalProcess, false);
    assert.equal(payload.auth.enabled, true);
    assert.equal(payload.auth.scheme, "password");
    assert.equal(payload.auth.passwordConfigured, false);
    assert.equal(payload.auth.passwordEnv, "DOVE_GLOBAL_STATUS_PASSWORD");
    assert.equal(payload.auth.passwordEnvConfigured, true);
    assert.equal(payload.cloudflare.enabled, true);
    assert.equal(payload.cloudflare.domain, "keli.eu.cc");
    assert.deepEqual(payload.cloudflare.commands.routeDns.args, ["tunnel", "route", "dns", payload.cloudflare.tunnelName, "keli.eu.cc"]);
    assert.equal(fs.existsSync(path.join(outputDir, "status.json")), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("legacy migration alias is rejected", () => {
  const root = tempRoot();
  writeFixturePaper(root);

  const rejected = spawnSync("node", [CLI, "migrate", root, "--write-map"], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stdout, /Usage:/);
  assert.equal(fs.existsSync(path.join(root, ARTIFACT_PATHS.workspaceArtifactMap)), false);
});

test("CLI doctor reports artifact-map onboarding status without failing", () => {
  const root = tempRoot();
  writeFixturePaper(root);
  const install = spawnSync("node", [CLI, "install", root, "--force"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert.equal(install.status, 0, install.stderr || install.stdout);

  const beforeMapDoctor = spawnSync("node", [CLI, "doctor", root], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert.equal(beforeMapDoctor.status, 0, beforeMapDoctor.stderr || beforeMapDoctor.stdout);
  const beforePayload = JSON.parse(beforeMapDoctor.stdout);
  const beforeCheck = beforePayload.checks.find((check) => check.check === "onboarding-artifact-map");
  assert.ok(beforeCheck);
  assert.match(beforeCheck.message, /run dove onboard \. --write-map/);
  assert.equal(beforePayload.managedArtifacts.onboardingArtifactMap.mapExists, false);

  const onboard = spawnSync("node", [CLI, "onboard", root, "--write-map"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert.equal(onboard.status, 0, onboard.stderr || onboard.stdout);

  const afterMapDoctor = spawnSync("node", [CLI, "doctor", root], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert.equal(afterMapDoctor.status, 0, afterMapDoctor.stderr || afterMapDoctor.stdout);
  const afterPayload = JSON.parse(afterMapDoctor.stdout);
  const afterCheck = afterPayload.checks.find((check) => check.check === "onboarding-artifact-map");
  assert.equal(afterPayload.managedArtifacts.onboardingArtifactMap.mapExists, true);
  assert.match(afterCheck.message, /artifact map present/);
});
