import test from "node:test";
import assert from "node:assert/strict";

import { recommendedDoveAction, renderDoveDoctor } from "../../src/cli/doctor-output.mjs";

function result(overrides = {}) {
  return {
    userCli: {
      healthy: true,
      package: { version: "0.7.0" },
      pathExecutable: { path: "/home/test/.local/bin/dove" }
    },
    projectIntegration: { state: "current", healthy: true, manifest: { package: { version: "0.7.0" } } },
    mcpProbe: { state: "current", healthy: true },
    runningMcpSelfComparison: { state: "inaccessible", healthy: true },
    workspaceState: { mode: "current", state: "readable-current-format", category: "current", healthy: true },
    hostRegistration: { approval: { state: "approved" } },
    readiness: { state: "connected", ready: true },
    legacyCopiedRuntime: { detected: false },
    ...overrides
  };
}

test("doctor recommends integration sync separately from host restart", () => {
  const integration = recommendedDoveAction(result({ mcpProbe: { state: "integration-mismatch", healthy: false } }));
  assert.equal(integration.kind, "sync-integration-version");
  assert.equal(integration.command, "dove sync");

  const server = recommendedDoveAction(result({ runningMcpSelfComparison: { state: "restart-required", healthy: false, inspected: true } }));
  assert.equal(server.kind, "restart-host");
  assert.equal(server.command, "claude");
});

test("doctor reports legacy workspace only as unsupported-legacy-format", () => {
  const action = recommendedDoveAction(result({ workspaceState: { mode: "unsupported", state: "unsupported-legacy-format", category: "legacy", healthy: false } }));
  assert.equal(action.kind, "unsupported-legacy-format");
  assert.equal(action.command, "dove doctor --json");
  assert.match(action.message, /只报告格式状态/u);
  assert.doesNotMatch(action.message, /reset|migrate|archive|重置|迁移|归档/iu);

  const output = renderDoveDoctor(result({ workspaceState: { mode: "unsupported", state: "unsupported-legacy-format", category: "legacy", healthy: false } }), { stream: { isTTY: false }, env: {} });
  assert.match(output, /旧版研究格式.*不会读取或修改/u);
  assert.doesNotMatch(output, /unsupported-legacy-format/u);
  assert.doesNotMatch(output, /reset|migrate|archive|重置|迁移|归档/iu);
});

test("doctor human output separates CLI runtime, project integration, MCP, and research format", () => {
  const output = renderDoveDoctor(result({ workspaceState: { mode: "current", state: "readable-current-format", category: "current", healthy: true, format: "dove-research-v1" } }), { stream: { isTTY: false }, env: {} });
  assert.match(output, /Dove CLI 运行时.*Dove 0\.7\.0 可用/u);
  assert.doesNotMatch(output, /\/home\/test\/\.local\/bin\/dove/u);
  assert.match(output, /项目集成.*已是当前版本 0\.7\.0/u);
  assert.match(output, /Dove MCP.*已连接/u);
  assert.match(output, /研究状态.*dove-research-v1 可读/u);
  assert.doesNotMatch(output, /Claim|completion|digest|完成证明|独立评审/iu);
});
