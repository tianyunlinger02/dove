import test from "node:test";
import assert from "node:assert/strict";

import { runInteractiveDoveSetup } from "../../src/cli/interactive-setup.mjs";

function outputStream() {
  let output = "";
  return {
    isTTY: true,
    write(chunk) {
      output += String(chunk);
      return true;
    },
    text() {
      return output;
    }
  };
}

function doctor(state, overrides = {}) {
  return {
    target: "/work/example",
    projectIntegration: {
      state,
      healthy: state === "current",
      ...overrides.projectIntegration
    },
    workspaceState: { mode: "absent", healthy: true },
    readiness: { state: "pending-approval", ready: false },
    legacyCopiedRuntime: { detected: false },
    ...overrides
  };
}

function promptAnswers(values) {
  const queue = [...values];
  return async () => queue.shift();
}

test("interactive setup initializes an unconfigured project from the concise setup menu", async () => {
  const stream = outputStream();
  let initialized = 0;
  let inspection = 0;
  let choices;
  const result = await runInteractiveDoveSetup({
    target: "/work/example",
    stream,
    env: { NO_COLOR: "1" },
    promptSelect: async (question) => {
      choices = question.choices;
      return "init";
    },
    inspect() {
      inspection += 1;
      return doctor(inspection === 1 ? "uninitialized" : "current");
    },
    initialize() {
      initialized += 1;
    },
    upgrade: () => assert.fail("upgrade must not run"),
    completeReinstall: () => assert.fail("complete reinstall must not run")
  });

  assert.equal(result.status, "initialized");
  assert.equal(initialized, 1);
  assert.deepEqual(choices.map((choice) => choice.name), ["初始化项目配置", "退出"]);
  assert.match(stream.text(), /项目配置完成/u);
  assert.match(stream.text(), /进入或重新进入 Claude Code/u);
  assert.match(stream.text(), /仅在当前项目为你批准/u);
  assert.match(stream.text(), /Dove 项目入口/u);
});

test("interactive setup cancellation is zero-write", async () => {
  const stream = outputStream();
  let writes = 0;
  const result = await runInteractiveDoveSetup({
    target: "/work/example",
    stream,
    env: { NO_COLOR: "1" },
    promptSelect: promptAnswers(["exit"]),
    inspect: () => doctor("uninitialized"),
    initialize: () => { writes += 1; },
    upgrade: () => { writes += 1; },
    completeReinstall: () => { writes += 1; }
  });

  assert.equal(result.status, "exited");
  assert.equal(writes, 0);
  assert.match(stream.text(), /未修改任何文件/u);
});

test("interactive setup upgrades an initialized project without confirmation", async () => {
  const stream = outputStream();
  let upgraded = 0;
  const result = await runInteractiveDoveSetup({
    target: "/work/example",
    stream,
    env: { NO_COLOR: "1" },
    promptSelect: promptAnswers(["upgrade"]),
    promptConfirm: () => assert.fail("upgrade must not ask for confirmation"),
    inspect: () => doctor("current"),
    initialize: () => assert.fail("init must not run"),
    upgrade(target) {
      upgraded += 1;
      return { status: "upgraded", target };
    },
    completeReinstall: () => assert.fail("complete reinstall must not run")
  });

  assert.equal(result.status, "upgraded");
  assert.equal(result.action, "upgrade");
  assert.equal(upgraded, 1);
  assert.match(stream.text(), /Dove 项目配置升级完成/u);
  assert.match(stream.text(), /研究状态已保留/u);
});

test("interactive setup blocks drifted and legacy copied integrations without overwriting", async () => {
  for (const inspection of [
    doctor("drifted"),
    doctor("current", {
      projectIntegration: { healthy: true },
      legacyCopiedRuntime: { detected: true }
    })
  ]) {
    const stream = outputStream();
    let writes = 0;
    const result = await runInteractiveDoveSetup({
      target: "/work/example",
      stream,
      env: { NO_COLOR: "1" },
      promptConfirm: () => assert.fail("blocked setup must not confirm"),
      promptSelect: () => assert.fail("blocked setup must not show a lifecycle menu"),
      inspect: () => inspection,
      initialize: () => { writes += 1; },
      upgrade: () => { writes += 1; },
      completeReinstall: () => { writes += 1; }
    });

    assert.equal(result.status, "blocked");
    assert.equal(writes, 0);
    assert.match(stream.text(), /Dove 检测到项目集成需要人工处理，未进行修改/u);
  }
});

test("interactive setup routes a valid legacy installation to Upgrade without Init", async () => {
  const stream = outputStream();
  let choices;
  let upgrades = 0;
  const result = await runInteractiveDoveSetup({
    target: "/work/legacy",
    stream,
    env: { NO_COLOR: "1" },
    promptSelect: async (question) => {
      choices = question.choices;
      return "upgrade";
    },
    promptConfirm: () => assert.fail("legacy Upgrade must not ask for confirmation"),
    inspect: () => ({
      ...doctor("uninitialized", {
        migrationInstallation: { state: "valid-legacy", upgrade: { ready: true }, reinstall: { ready: true } },
        setup: { mode: "upgrade", reason: "valid-legacy", allowedActions: ["upgrade", "reinstall", "exit"] },
        workspaceState: { state: "unsupported-legacy-format", mode: "unsupported", healthy: false }
      })
    }),
    initialize: () => assert.fail("legacy setup must not initialize"),
    upgrade: (target) => {
      upgrades += 1;
      return { status: "upgraded", target };
    },
    completeReinstall: () => assert.fail("complete reinstall must not run")
  });

  assert.equal(result.status, "upgraded");
  assert.equal(upgrades, 1);
  assert.deepEqual(choices.map((choice) => choice.value), ["upgrade", "reinstall", "exit"]);
  assert.doesNotMatch(stream.text(), /初始化项目配置/u);
});

test("initialized menu exposes exactly Upgrade, Complete Reinstall, and Exit", async () => {
  const stream = outputStream();
  let choices;
  let message;
  let writes = 0;
  const result = await runInteractiveDoveSetup({
    target: "/work/example",
    stream,
    env: { NO_COLOR: "1" },
    promptSelect: async (question) => {
      choices = question.choices;
      message = question.message;
      return "exit";
    },
    inspect: () => doctor("current"),
    initialize: () => { writes += 1; },
    upgrade: () => { writes += 1; },
    completeReinstall: () => { writes += 1; }
  });

  assert.equal(result.status, "exited");
  assert.equal(writes, 0);
  assert.equal(message, "当前项目已配置 Dove。请选择：");
  assert.deepEqual(choices.map((choice) => choice.value), ["upgrade", "reinstall", "exit"]);
  assert.deepEqual(choices.map((choice) => choice.name), ["升级项目配置", "完全重新安装项目配置", "退出"]);
  assert.match(stream.text(), /未修改任何文件/u);
});

test("Complete Reinstall exposes destructive inventory and default-false confirmation", async () => {
  const stream = outputStream();
  let reinstallWrites = 0;
  let confirmation;
  const result = await runInteractiveDoveSetup({
    target: "/work/example",
    stream,
    env: { NO_COLOR: "1" },
    inspect: () => doctor("current"),
    promptSelect: promptAnswers(["reinstall"]),
    promptConfirm: async (question) => {
      confirmation = question;
      return false;
    },
    completeReinstall: () => { reinstallWrites += 1; },
    initialize: () => assert.fail("init must not run"),
    upgrade: () => assert.fail("upgrade must not run")
  });

  assert.equal(result.status, "cancelled");
  assert.equal(result.action, "reinstall");
  assert.equal(reinstallWrites, 0);
  assert.equal(confirmation.default, false);
  assert.match(confirmation.message, /确认完全重新安装项目配置/u);
  assert.match(confirmation.message, /全部 Dove 配置、研究状态和旧归档/u);
  assert.match(stream.text(), /完全重新安装项目配置将永久删除/u);
  assert.match(stream.text(), /旧的 \.dove-install\//u);
  assert.match(stream.text(), /\/work\/example\/\.dove\//u);
  assert.match(stream.text(), /未修改任何文件/u);
});

test("approved Complete Reinstall deletes research state through the selected lifecycle", async () => {
  const stream = outputStream();
  const calls = [];
  const result = await runInteractiveDoveSetup({
    target: "/work/example",
    stream,
    env: { NO_COLOR: "1" },
    inspect: () => doctor("current"),
    promptSelect: promptAnswers(["reinstall"]),
    promptConfirm: promptAnswers([true]),
    initialize: () => calls.push("initialize"),
    upgrade: () => calls.push("upgrade"),
    completeReinstall(target) {
      calls.push(`reinstall:${target}`);
      return { status: "reinstalled", target };
    }
  });

  assert.deepEqual(calls, ["reinstall:/work/example"]);
  assert.equal(result.status, "reinstalled");
  assert.equal(result.action, "reinstall");
  assert.match(stream.text(), /Dove 项目配置完全重新安装完成/u);
  assert.match(stream.text(), /旧 Dove 集成和研究状态已按确认删除/u);
  assert.match(stream.text(), /新项目私有状态仅从 \.dove\/install\/ 开始/u);
});

test("blocked output renders doctor with the injected stream and environment", async () => {
  const stream = outputStream();
  const result = await runInteractiveDoveSetup({
    target: "/work/example",
    stream,
    env: {},
    inspect: () => doctor("drifted"),
    initialize: () => assert.fail("init must not run"),
    upgrade: () => assert.fail("upgrade must not run"),
    completeReinstall: () => assert.fail("complete reinstall must not run")
  });

  assert.equal(result.status, "blocked");
  assert.match(stream.text(), /\x1b\[1mDove 检查\x1b\[0m/u);
});
