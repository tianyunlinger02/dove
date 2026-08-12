import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { PACKAGE_RUNTIME_PATHS } from "../../src/core/command-manifest.mjs";
import { inspectProjectDoctor } from "../../src/core/project-doctor.mjs";
import { initializeProjectIntegration } from "../../src/core/project-installation.mjs";
import { cleanupTempRoot, createTempRoot } from "../helpers/temp-root.mjs";

const PACKAGE = { packageName: "dove", packageVersion: "3.0.0" };

function withRoot(prefix, callback) {
  const root = createTempRoot(prefix);
  try {
    return callback(root);
  } finally {
    cleanupTempRoot(root);
  }
}

function snapshot(root) {
  const entries = [];
  function visit(directory, prefix = "") {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const relativePath = prefix ? path.posix.join(prefix, entry.name) : entry.name;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        entries.push({ path: relativePath, type: "directory" });
        visit(absolutePath, relativePath);
      } else if (entry.isSymbolicLink()) {
        entries.push({ path: relativePath, type: "symlink", target: fs.readlinkSync(absolutePath) });
      } else {
        entries.push({ path: relativePath, type: "file", bytes: fs.readFileSync(absolutePath).toString("base64") });
      }
    }
  }
  visit(root);
  return entries;
}

function options(overrides = {}) {
  return {
    ...PACKAGE,
    packageRoot: path.resolve(import.meta.dirname, "../.."),
    executablePath: path.resolve(import.meta.dirname, "../../bin/dove.mjs"),
    inspectPathExecutable: () => ({ found: true, usable: true, path: "/usr/local/bin/dove", state: "found" }),
    ...overrides
  };
}

function initialize(root) {
  initializeProjectIntegration(root, { ...PACKAGE, hosts: ["claude"] });
}

test("Doctor is zero-write and reports absent Markdown research documents as healthy", () => withRoot("dove-doctor-absent-", (root) => {
  initialize(root);
  const before = snapshot(root);
  const result = inspectProjectDoctor(root, options());
  assert.deepEqual(snapshot(root), before);
  assert.equal(result.ready, true);
  assert.equal(result.projectIntegration.healthy, true);
  assert.equal(result.workspaceState.state, "absent");
  assert.equal(result.workspaceState.mode, "absent");
  assert.equal(result.workspaceState.healthy, true);
  assert.equal(result.legacyCopiedRuntime.detected, false);
  for (const retired of ["userMcpRegistration", "projectEligibility", "connection", "hostRegistration", "readiness"]) {
    assert.equal(Object.hasOwn(result, retired), false, retired);
  }
}));

test("Doctor recommends explicit export for exact v2 research state", () => withRoot("dove-doctor-v2-", (root) => {
  initialize(root);
  fs.writeFileSync(path.join(root, ".dove", "format.json"), '{"format":"dove-research-v2"}\n');
  const result = inspectProjectDoctor(root, options());
  assert.equal(result.workspaceState.state, "previous-research-format");
  assert.equal(result.workspaceState.mode, "previous-research-format");
  assert.equal(result.workspaceState.healthy, true);
  assert.equal(result.ready, true);
  assert.deepEqual(result.actions[0], { kind: "export-research", command: "dove export-research" });
}));

test("Doctor accepts free-form UTF-8 RESEARCH.md without fixed headings", () => withRoot("dove-doctor-markdown-", (root) => {
  initialize(root);
  fs.mkdirSync(path.join(root, ".dove", "research"), { recursive: true });
  fs.writeFileSync(path.join(root, ".dove", "research", "RESEARCH.md"), "自由格式科研记录\n\n没有固定标题。\n");
  const result = inspectProjectDoctor(root, options());
  assert.equal(result.workspaceState.state, "current");
  assert.equal(result.workspaceState.mode, "current");
  assert.equal(result.workspaceState.healthy, true);
  assert.equal(result.ready, true);
}));

test("Doctor treats a missing Markdown overview as normal without writes", () => withRoot("dove-doctor-markdown-missing-", (root) => {
  initialize(root);
  fs.mkdirSync(path.join(root, ".dove", "research"), { recursive: true });
  const before = snapshot(root);
  const result = inspectProjectDoctor(root, options());
  assert.deepEqual(snapshot(root), before);
  assert.equal(result.workspaceState.state, "current");
  assert.equal(result.workspaceState.mode, "current");
  assert.equal(result.workspaceState.overview, null);
  assert.equal(result.workspaceState.healthy, true);
  assert.equal(result.ready, true);
}));

test("Doctor rejects symlinked and invalid Markdown overviews without writes", () => {
  for (const mode of ["symlink", "invalid-utf8"]) withRoot(`dove-doctor-markdown-${mode}-`, (root) => {
    initialize(root);
    const researchRoot = path.join(root, ".dove", "research");
    fs.mkdirSync(researchRoot, { recursive: true });
    if (mode === "symlink") {
      fs.writeFileSync(path.join(root, "outside.md"), "outside\n");
      fs.symlinkSync(path.join(root, "outside.md"), path.join(researchRoot, "RESEARCH.md"));
    } else {
      fs.writeFileSync(path.join(researchRoot, "RESEARCH.md"), Buffer.from([0xff, 0xfe]));
    }
    const before = snapshot(root);
    const result = inspectProjectDoctor(root, options());
    assert.deepEqual(snapshot(root), before);
    assert.equal(result.workspaceState.state, "invalid");
    assert.equal(result.workspaceState.mode, "invalid");
    assert.equal(result.workspaceState.healthy, false);
    assert.equal(result.ready, false);
  });
});

test("Doctor does not inspect linked research content or judge science", () => withRoot("dove-doctor-outer-only-", (root) => {
  initialize(root);
  fs.mkdirSync(path.join(root, ".dove", "research", "missions"), { recursive: true });
  fs.writeFileSync(path.join(root, ".dove", "research", "RESEARCH.md"), "See missions/broken.md\n");
  fs.writeFileSync(path.join(root, ".dove", "research", "missions", "broken.md"), Buffer.from([0xff]));
  const forbidden = path.join(root, ".dove", "research", "missions");
  const fsOps = {
    ...fs,
    readFileSync(target, ...args) {
      if (path.resolve(String(target)).startsWith(forbidden)) throw new Error("Doctor read linked research content");
      return fs.readFileSync(target, ...args);
    }
  };
  const result = inspectProjectDoctor(root, options({ fsOps }));
  assert.equal(result.workspaceState.healthy, true);
  assert.equal(result.ready, true);
}));

test("Doctor reports missing active package runtime files", () => withRoot("dove-doctor-package-", (packageRoot) => withRoot("dove-doctor-project-", (root) => {
  initialize(root);
  for (const relativePath of PACKAGE_RUNTIME_PATHS) {
    const target = path.join(packageRoot, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, "runtime\n");
  }
  fs.rmSync(path.join(packageRoot, "dist/index.mjs"));
  const result = inspectProjectDoctor(root, options({ packageRoot, executablePath: path.join(packageRoot, "bin/dove-package.mjs") }));
  assert.equal(result.userCli.healthy, false);
  assert.deepEqual(result.userCli.missing, ["dist/index.mjs"]);
  assert.equal(result.ready, false);
})));

test("Doctor detects retired copied runtime without inspecting historical registration config", () => withRoot("dove-doctor-retired-runtime-", (root) => {
  initialize(root);
  fs.writeFileSync(path.join(root, ".mcp.json"), `${JSON.stringify({
    mcpServers: {
      dove: { type: "stdio", command: "dove", args: ["mcp", "serve", "--project", "."] }
    }
  }, null, 2)}\n`);
  let result = inspectProjectDoctor(root, options());
  assert.equal(result.legacyCopiedRuntime.detected, false);
  assert.equal(Object.hasOwn(result.legacyCopiedRuntime, "registrationHits"), false);
  assert.equal(Object.hasOwn(result.legacyCopiedRuntime, "markerHits"), false);

  const retiredBundle = path.join(root, "mcp/dove-state-server-package.mjs");
  fs.mkdirSync(path.dirname(retiredBundle), { recursive: true });
  fs.writeFileSync(retiredBundle, "create_ambient_dove_mission\nquery_dove_status\nDove MCP\n");
  result = inspectProjectDoctor(root, options());
  assert.equal(result.legacyCopiedRuntime.detected, true);
  assert.deepEqual(result.legacyCopiedRuntime.copiedRuntimeHits.map((entry) => entry.path), ["mcp/dove-state-server-package.mjs"]);
  assert.equal(result.legacyCopiedRuntime.healthy, false);
  assert.equal(result.ready, false);
}));
