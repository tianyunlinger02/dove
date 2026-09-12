import assert from "node:assert/strict";

import { runInteractiveDoveSetup } from "../../src/cli/interactive-setup.mjs";
import {
  DEFAULT_INITIALIZABLE_HOSTS,
  HOST_REGISTRY,
  PROJECT_HOST_IDS as REGISTERED_PROJECT_HOST_IDS
} from "../../src/core/host-registry.mjs";
import { EXPECTED_HOST_IDS } from "./common.mjs";

export async function assertInteractiveHostSelection() {
  assert.deepEqual(REGISTERED_PROJECT_HOST_IDS, EXPECTED_HOST_IDS);
  assert.deepEqual(DEFAULT_INITIALIZABLE_HOSTS, ["claude"]);

  for (const { selectedHosts, bootstrap } of [["claude"], ["dsh"], ["claude", "dsh"]].flatMap((selectedHosts) => [true, false].map((bootstrap) => ({ selectedHosts, bootstrap })))) {
    const target = "/workspace/example-project";
    let inspectionCount = 0;
    let initializeCall = null;
    let checkboxConfig = null;
    const output = [];
    const result = await runInteractiveDoveSetup({
      target,
      inspect: async () => {
        inspectionCount += 1;
        if (inspectionCount === 1) {
          return {
            target,
            setup: { mode: "uninitialized", reason: "uninitialized", allowedActions: ["init", "exit"] },
            projectIntegration: { state: "uninitialized" }
          };
        }
        return {
          target,
          setup: { mode: "current", reason: "current", allowedActions: ["reinstall", "uninstall", "exit"] },
          projectIntegration: { state: "current", manifest: { hosts: selectedHosts } }
        };
      },
      initialize: async (receivedTarget, lifecycleOptions) => {
        initializeCall = { target: receivedTarget, lifecycleOptions };
        return { status: "initialized", target: receivedTarget, hosts: lifecycleOptions.hosts, writtenPaths: bootstrap ? [".dove/research/RESEARCH.md"] : [] };
      },
      promptSelect: async () => "init",
      promptCheckbox: async (config) => {
        checkboxConfig = config;
        return selectedHosts;
      },
      stream: { isTTY: false, write: (chunk) => output.push(chunk) },
      env: { NO_COLOR: "1" }
    });

    assert.equal(result.status, "initialized");
    assert.deepEqual(initializeCall, { target, lifecycleOptions: { hosts: selectedHosts } });
    assert.equal(checkboxConfig.message, "选择要安装 Dove 的平台：");
    assert.equal(checkboxConfig.required, true);
    assert.deepEqual(checkboxConfig.choices, EXPECTED_HOST_IDS.map((hostId) => ({
      name: HOST_REGISTRY[hostId].label,
      value: hostId,
      checked: DEFAULT_INITIALIZABLE_HOSTS.includes(hostId)
    })));
    const text = output.join("");
    assert.match(text, /Dove 已在此项目启用/u);
    assert.doesNotMatch(text, /Prompt Hook/u);
    if (bootstrap) assert.match(text, /RESEARCH\.md 已建立/u);
    else {
      assert.match(text, /现有研究目录保持不变/u);
      assert.doesNotMatch(text, /RESEARCH\.md 已建立/u);
    }
    if (selectedHosts.includes("claude")) assert.match(text, /SessionStart hook/u);
    else assert.doesNotMatch(text, /WebFetch 禁用|Exa MCP/u);
  }
}

export async function assertInteractiveLifecycleMenus() {
  const target = "/workspace/example-project";
  const streamFor = () => {
    const chunks = [];
    return { chunks, stream: { isTTY: false, write: (chunk) => chunks.push(chunk) } };
  };

  {
    const actions = ["details", "exit"];
    const { chunks, stream } = streamFor();
    let detailsCalls = 0;
    let initialMenuOutput = null;
    const result = await runInteractiveDoveSetup({
      target,
      inspect: async () => ({
        target,
        staticChecksPassed: false,
        userCli: { healthy: true, package: { version: "3.0.0" } },
        projectIntegration: {
          state: "blocked",
          manifest: { hosts: ["claude"] }
        },
        workspaceState: { mode: "current", healthy: true },
        actions: [{ kind: "inspect", command: "dove doctor --json" }],
        setup: { mode: "blocked", reason: "blocked", allowedActions: ["details", "exit"] }
      }),
      promptSelect: async (config) => {
        if (actions.length === 2) {
          assert.deepEqual(config.choices.map((choice) => choice.value), ["details", "exit"]);
          initialMenuOutput = chunks.join("");
          assert.equal(initialMenuOutput.includes("Dove 检查"), false);
        }
        return actions.shift();
      },
      promptCheckbox: async () => { throw new Error("Drifted menu must not ask for install hosts."); },
      previewCompleteReinstall: async () => { throw new Error("Details must remain read-only."); },
      stream,
      env: { NO_COLOR: "1" }
    });
    detailsCalls += chunks.join("").match(/Dove 检查/gu)?.length ?? 0;
    assert.equal(result.status, "exited");
    assert.equal(detailsCalls, 1);
    assert.match(initialMenuOutput, /无法安全确认/u);
    assert.doesNotMatch(initialMenuOutput, /面向 Dove 开发排查/u);
  }

  {
    const { stream } = streamFor();
    let updateCall = null;
    let checkboxConfig = null;
    const result = await runInteractiveDoveSetup({
      target,
      inspect: async () => ({
        target,
        projectIntegration: { state: "current", manifest: { hosts: ["dsh"] } },
        setup: { mode: "current", reason: "current", allowedActions: ["change-hosts", "reinstall", "uninstall", "details", "exit"] }
      }),
      promptSelect: async (config) => {
        assert.deepEqual(config.choices.map((choice) => choice.value), ["change-hosts", "reinstall", "uninstall", "details", "exit"]);
        assert.equal(config.choices.some((choice) => choice.value === "init"), false);
        return "change-hosts";
      },
      promptCheckbox: async (config) => {
        checkboxConfig = config;
        return ["claude", "dsh"];
      },
      update: async (receivedTarget, lifecycleOptions) => {
        updateCall = { target: receivedTarget, lifecycleOptions };
        return { status: "updated", target: receivedTarget, hosts: lifecycleOptions.hosts, writtenPaths: [], removedPaths: [], changedPaths: [] };
      },
      stream,
      env: { NO_COLOR: "1" }
    });
    assert.equal(result.action, "change-hosts");
    assert.deepEqual(updateCall, { target, lifecycleOptions: { hosts: ["claude", "dsh"] } });
    assert.deepEqual(checkboxConfig.choices.map(({ value, checked }) => ({ value, checked })), [
      { value: "claude", checked: false },
      { value: "dsh", checked: true }
    ]);
  }

  {
    const { stream } = streamFor();
    let updateCall = null;
    const result = await runInteractiveDoveSetup({
      target,
      inspect: async () => ({
        target,
        projectIntegration: { state: "needs-update", manifest: { hosts: ["dsh"] } },
        setup: { mode: "needs-update", reason: "needs-update", allowedActions: ["update", "details", "exit"] }
      }),
      promptSelect: async (config) => {
        assert.deepEqual(config.choices.map((choice) => choice.value), ["update", "details", "exit"]);
        return "update";
      },
      promptCheckbox: async () => ["dsh"],
      update: async (receivedTarget, lifecycleOptions) => {
        updateCall = { target: receivedTarget, lifecycleOptions };
        return { status: "updated", target: receivedTarget, hosts: ["dsh"], writtenPaths: [], removedPaths: [], changedPaths: [] };
      },
      stream,
      env: { NO_COLOR: "1" }
    });
    assert.equal(result.action, "update");
    assert.deepEqual(updateCall, { target, lifecycleOptions: undefined });
  }
}
