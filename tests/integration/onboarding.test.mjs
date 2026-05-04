import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { ARTIFACT_PATHS, discoverPaperArtifacts, ensureWorkspace } from "../../src/core/index.mjs";

const ROOT = process.cwd();
const CLI = path.join(ROOT, "bin", "paper-factory.mjs");

function tempRoot(prefix = "paper-factory-onboarding-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
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

test("CLI onboard defaults to proposal-only and migrate can persist the map", () => {
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

  const writeRun = spawnSync("node", [CLI, "migrate", root, "--write-map"], {
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
  assert.match(beforeCheck.message, /run paper-factory onboard \. --write-map/);
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
