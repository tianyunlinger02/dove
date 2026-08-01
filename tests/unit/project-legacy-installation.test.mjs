import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { inspectLegacyProjectInstallation } from "../../src/core/project-legacy-installation.mjs";
import { cleanupTempRoot, createTempRoot } from "../helpers/temp-root.mjs";

function write(root, relativePath, content) {
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content);
}

test("legacy detector does not misclassify a lone dist index even with Dove signatures", () => {
  const root = createTempRoot("dove-legacy-single-dist-");
  try {
    write(root, "dist/index.mjs", "export const DOVE_WORKSPACE_SCHEMA_VERSION = 11;\nexport function createDoveMission() {}\nexport function queryDoveStatus() {}\n");
    const result = inspectLegacyProjectInstallation(root);
    assert.equal(result.detected, false);
    assert.equal(result.state, "absent");
    assert.equal(result.bundleHits.length, 1);
    assert.equal(result.bundleHits[0].signatureMatched, true);
  } finally {
    cleanupTempRoot(root);
  }
});

test("legacy detector recognizes old marker and two copied bundle paths", () => {
  const markerRoot = createTempRoot("dove-legacy-marker-");
  const bundleRoot = createTempRoot("dove-legacy-bundles-");
  try {
    write(markerRoot, "mcp/dove-claude-project.json", '{"version":1,"host":"claude"}\n');
    const markerResult = inspectLegacyProjectInstallation(markerRoot);
    assert.equal(markerResult.detected, true);
    assert.deepEqual(markerResult.markerHits, ["mcp/dove-claude-project.json"]);

    write(bundleRoot, "dist/index.mjs", "ordinary bundle\n");
    write(bundleRoot, "bin/dove-package.mjs", "ordinary bundle\n");
    const bundleResult = inspectLegacyProjectInstallation(bundleRoot);
    assert.equal(bundleResult.detected, true);
    assert.equal(bundleResult.bundleHits.length, 2);
    assert.equal(Object.isFrozen(bundleResult), true);
    assert.equal(Object.isFrozen(bundleResult.bundleHits[0]), true);
  } finally {
    cleanupTempRoot(markerRoot);
    cleanupTempRoot(bundleRoot);
  }
});

test("legacy detector recognizes old project-bundle MCP and hook registrations", () => {
  const root = createTempRoot("dove-legacy-registration-");
  try {
    write(root, ".mcp.json", JSON.stringify({ mcpServers: { dove: { type: "stdio", command: "node", args: ["${CLAUDE_PROJECT_DIR:-.}/mcp/dove-state-server-package.mjs"] } } }));
    write(root, ".claude/settings.json", JSON.stringify({ hooks: { UserPromptSubmit: [{ hooks: [{ type: "command", command: "node ./scripts/dove-user-prompt-submit-package.mjs" }] }] } }));
    const result = inspectLegacyProjectInstallation(root);
    assert.equal(result.detected, true);
    assert.deepEqual(result.registrationHits, [".mcp.json#/mcpServers/dove", ".claude/settings.json#/hooks/UserPromptSubmit"]);
  } finally {
    cleanupTempRoot(root);
  }
});

test("legacy detector does not treat current user-cli registrations as copied runtime", () => {
  const root = createTempRoot("dove-legacy-current-registration-");
  try {
    write(root, ".mcp.json", JSON.stringify({ mcpServers: { dove: { type: "stdio", command: "dove", args: ["mcp", "serve", "--project", "${CLAUDE_PROJECT_DIR}"] } } }));
    write(root, ".claude/settings.json", JSON.stringify({ hooks: { UserPromptSubmit: [{ hooks: [{ type: "command", command: "dove hook user-prompt-submit --project \"$CLAUDE_PROJECT_DIR\"" }] }] } }));
    assert.equal(inspectLegacyProjectInstallation(root).detected, false);
  } finally {
    cleanupTempRoot(root);
  }
});

test("legacy detector never traverses or reads .dove", () => {
  const root = createTempRoot("dove-legacy-ignore-workspace-");
  try {
    write(root, ".dove/dist/index.mjs", "DOVE_WORKSPACE_SCHEMA_VERSION createDoveMission queryDoveStatus\n");
    write(root, ".dove/bin/dove-package.mjs", "dove-state-server-package.mjs DOVE_MCP_SERVER_NAME create_ambient_dove_mission\n");
    assert.equal(inspectLegacyProjectInstallation(root).detected, false);
  } finally {
    cleanupTempRoot(root);
  }
});
