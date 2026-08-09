import test from "node:test";
import assert from "node:assert/strict";

import { initializeProjectIntegration } from "../../src/core/project-installation.mjs";
import { DOVE_RESEARCH_FORMAT, PACKAGE_VERSION } from "../../src/core/schema.mjs";
import {
  inspectRunningMcpRuntime,
  negotiateDoveMcpProtocol
} from "../../src/mcp/runtime-info.mjs";
import { cleanupTempRoot, createTempRoot } from "../helpers/temp-root.mjs";

test("running MCP self-report separates package, integration, protocol, and research format", () => {
  const root = createTempRoot("dove-mcp-runtime-info-");
  try {
    initializeProjectIntegration(root, { packageName: "dove", packageVersion: PACKAGE_VERSION, hosts: ["claude"], now: "2026-08-02T00:00:00.000Z" });
    const runtime = inspectRunningMcpRuntime(root, "2025-06-18");
    assert.deepEqual(runtime.serverInfo, { name: "dove", version: PACKAGE_VERSION });
    assert.equal(runtime.protocolVersion, "2025-06-18");
    assert.equal(runtime.researchFormat, DOVE_RESEARCH_FORMAT);
    assert.equal(runtime.projectIntegration.package.version, PACKAGE_VERSION);
    assert.equal(Number.isSafeInteger(runtime.projectIntegration.integrationVersion), true);
    assert.equal(Number.isSafeInteger(runtime.projectIntegration.ownershipVersion), true);
    assert.match(runtime.projectIntegration.installationId, /^installation-/u);
    assert.deepEqual(runtime.comparison, { state: "current", remediation: "none" });
  } finally {
    cleanupTempRoot(root);
  }
});

test("running MCP self-report distinguishes integration mismatch and rejects protocol fallback", () => {
  const root = createTempRoot("dove-mcp-runtime-mismatch-");
  try {
    initializeProjectIntegration(root, { packageName: "dove", packageVersion: "0.4.1", hosts: ["claude"], now: "2026-08-02T00:00:00.000Z" });
    assert.deepEqual(inspectRunningMcpRuntime(root, "2025-06-18").comparison, {
      state: "integration-mismatch",
      remediation: "sync-project-integration"
    });
    assert.throws(() => negotiateDoveMcpProtocol("unsupported"), /Unsupported MCP protocol version/u);
    assert.deepEqual(inspectRunningMcpRuntime(root, "unsupported").comparison, {
      state: "protocol-incompatible",
      remediation: "update-host-or-dove"
    });
  } finally {
    cleanupTempRoot(root);
  }
});
