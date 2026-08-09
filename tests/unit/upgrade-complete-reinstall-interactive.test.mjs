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

function currentDoctor(target = "/work/example") {
  return {
    target,
    projectIntegration: { state: "current", healthy: true },
    workspaceState: { mode: "current", healthy: true },
    readiness: { state: "connected", ready: true },
    legacyCopiedRuntime: { detected: false }
  };
}

test("interactive initialized menu exposes exactly Upgrade, Complete Reinstall, and Exit", async () => {
  const stream = outputStream();
  let choices;
  let writes = 0;
  const result = await runInteractiveDoveSetup({
    target: "/work/example",
    stream,
    env: { NO_COLOR: "1" },
    inspect: () => currentDoctor(),
    promptSelect: async (question) => {
      choices = question.choices;
      return "exit";
    },
    initialize: () => { writes += 1; },
    upgrade: () => { writes += 1; },
    completeReinstall: () => { writes += 1; }
  });

  assert.equal(result.status, "exited");
  assert.equal(writes, 0);
  assert.deepEqual(choices.map((choice) => choice.value), ["upgrade", "reinstall", "exit"]);
  assert.deepEqual(choices.map((choice) => choice.name), ["升级项目配置", "完全重新安装项目配置", "退出"]);
  assert.match(stream.text(), /未修改任何文件/u);
});

test("Complete Reinstall lists destructive scope and defaults confirmation to No", async () => {
  const stream = outputStream();
  let confirmation;
  let writes = 0;
  const result = await runInteractiveDoveSetup({
    target: "/work/example",
    stream,
    env: { NO_COLOR: "1" },
    inspect: () => currentDoctor(),
    promptSelect: async () => "reinstall",
    promptConfirm: async (question) => {
      confirmation = question;
      return false;
    },
    initialize: () => { writes += 1; },
    upgrade: () => { writes += 1; },
    completeReinstall: () => { writes += 1; }
  });

  assert.equal(result.status, "cancelled");
  assert.equal(result.action, "reinstall");
  assert.equal(writes, 0);
  assert.equal(confirmation.default, false);
  assert.match(confirmation.message, /当前项目中的全部 Dove 配置、研究状态和旧归档/u);
  assert.match(stream.text(), /当前项目中的 Dove commands、Skills、agents、MCP、Hook/u);
  assert.match(stream.text(), /旧的 \.dove-install\//u);
  assert.match(stream.text(), /\/work\/example\/\.dove\//u);
  assert.match(stream.text(), /\/work\/example\/\.dove-archive\//u);
  assert.match(stream.text(), /用户级 Dove 安装.*不会被删除/u);
  assert.match(stream.text(), /未修改任何文件/u);
});

test("Upgrade and approved Complete Reinstall dispatch only their selected lifecycle", async () => {
  for (const action of ["upgrade", "reinstall"]) {
    const stream = outputStream();
    const calls = [];
    const result = await runInteractiveDoveSetup({
      target: "/work/example",
      stream,
      env: { NO_COLOR: "1" },
      inspect: () => currentDoctor(),
      promptSelect: async () => action,
      promptConfirm: async () => true,
      initialize: () => calls.push("initialize"),
      upgrade(target) {
        calls.push(`upgrade:${target}`);
        return { status: "upgraded", target };
      },
      completeReinstall(target) {
        calls.push(`reinstall:${target}`);
        return { status: "reinstalled", target };
      }
    });

    assert.deepEqual(calls, [`${action}:/work/example`]);
    assert.equal(result.action, action);
    assert.equal(result.status, action === "upgrade" ? "upgraded" : "reinstalled");
    assert.match(stream.text(), action === "upgrade" ? /Dove 项目配置升级完成/u : /Dove 项目配置完全重新安装完成/u);
  }
});
