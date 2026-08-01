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

test("interactive setup initializes an unconfigured project only after confirmation", async () => {
  const stream = outputStream();
  let initialized = 0;
  let inspection = 0;
  const result = await runInteractiveDoveSetup({
    target: "/work/example",
    stream,
    env: { NO_COLOR: "1" },
    promptConfirm: promptAnswers([true]),
    inspect() {
      inspection += 1;
      return doctor(inspection === 1 ? "uninitialized" : "current");
    },
    initialize() {
      initialized += 1;
    },
    synchronize() {
      assert.fail("sync must not run");
    }
  });

  assert.equal(result.status, "initialized");
  assert.equal(initialized, 1);
  assert.match(stream.text(), /项目配置完成/u);
  assert.match(stream.text(), /进入或重新进入 Claude Code/u);
  assert.match(stream.text(), /仅在当前项目为你批准/u);
  assert.match(stream.text(), /\/dove:workspace/u);
  assert.doesNotMatch(stream.text(), /请批准|\/mcp/u);
});

test("interactive setup cancellation is zero-write", async () => {
  const stream = outputStream();
  let writes = 0;
  const result = await runInteractiveDoveSetup({
    target: "/work/example",
    stream,
    env: { NO_COLOR: "1" },
    promptConfirm: promptAnswers([false]),
    inspect: () => doctor("uninitialized"),
    initialize: () => { writes += 1; },
    synchronize: () => { writes += 1; }
  });

  assert.equal(result.status, "cancelled");
  assert.equal(writes, 0);
  assert.match(stream.text(), /未修改任何文件/u);
});

test("interactive setup upgrades a self-consistent old integration", async () => {
  const stream = outputStream();
  let synchronized = 0;
  let inspection = 0;
  const result = await runInteractiveDoveSetup({
    target: "/work/example",
    stream,
    env: { NO_COLOR: "1" },
    promptConfirm: promptAnswers([true]),
    inspect() {
      inspection += 1;
      return doctor(inspection === 1 ? "needs-sync" : "current");
    },
    initialize() {
      assert.fail("init must not run");
    },
    synchronize() {
      synchronized += 1;
    }
  });

  assert.equal(result.status, "synchronized");
  assert.equal(synchronized, 1);
  assert.match(stream.text(), /项目配置完成/u);
  assert.match(stream.text(), /项目集成已是当前版本/u);
});

test("interactive setup blocks legacy copied runtimes without overwriting", async () => {
  const stream = outputStream();
  let writes = 0;
  const result = await runInteractiveDoveSetup({
    target: "/work/example",
    stream,
    env: { NO_COLOR: "1" },
    promptConfirm: promptAnswers([]),
    promptSelect: promptAnswers([]),
    inspect: () => doctor("current", {
      projectIntegration: { healthy: true },
      legacyCopiedRuntime: { detected: true }
    }),
    initialize: () => { writes += 1; },
    synchronize: () => { writes += 1; }
  });

  assert.equal(result.status, "blocked");
  assert.equal(writes, 0);
  assert.match(stream.text(), /无法明确判定覆盖升级是否安全/u);
});

test("current integration menu can inspect without writes", async () => {
  const stream = outputStream();
  let writes = 0;
  const result = await runInteractiveDoveSetup({
    target: "/work/example",
    stream,
    env: { NO_COLOR: "1" },
    promptSelect: promptAnswers(["doctor"]),
    inspect: () => doctor("current"),
    initialize: () => { writes += 1; },
    synchronize: () => { writes += 1; }
  });

  assert.equal(result.status, "inspected");
  assert.equal(writes, 0);
  assert.match(stream.text(), /当前 Claude Code 会话尚未连接/u);
  assert.match(stream.text(), /不是 Workspace 初始化失败/u);
});

test("current integration menu exposes overlay upgrade with default-false destructive confirmation", async () => {
  const stream = outputStream();
  let overlayWrites = 0;
  let confirmation;
  let choices;
  const preview = { status: "ready", changedPaths: [".claude/rules/dove.md"] };
  const result = await runInteractiveDoveSetup({
    target: "/work/example",
    stream,
    env: { NO_COLOR: "1" },
    inspect: () => doctor("current"),
    promptSelect: async (question) => {
      choices = question.choices;
      return "overlay";
    },
    promptConfirm: async (question) => {
      confirmation = question;
      return false;
    },
    previewOverlayUpgrade: () => preview,
    overlayUpgrade: () => { overlayWrites += 1; },
    initialize: () => assert.fail("init must not run"),
    synchronize: () => assert.fail("sync must not run")
  });

  assert.equal(result.status, "cancelled");
  assert.equal(result.action, "overlay");
  assert.equal(result.preview, preview);
  assert.equal(overlayWrites, 0);
  assert.equal(choices.some((choice) => choice.value === "overlay"), true);
  assert.match(choices.find((choice) => choice.value === "overlay").name, /覆盖升级 Dove（归档当前科研状态）/u);
  assert.equal(confirmation.default, false);
  assert.match(confirmation.message, /项目集成的本地修改/u);
  assert.match(confirmation.message, /归档并重置当前科研状态/u);
  assert.match(confirmation.message, /项目文件和已有归档会保留/u);
  assert.match(stream.text(), /未修改任何文件/u);
});

test("drifted integration offers overlay only after a successful preview and re-inspects on success", async () => {
  const stream = outputStream();
  const preview = { status: "ready", target: "/work/example" };
  const upgrade = { status: "overlay-upgraded", archiveTarget: "/work/example/.dove-archive/overlay/example" };
  let inspections = 0;
  let appliedPreview = null;
  const result = await runInteractiveDoveSetup({
    target: "/work/example",
    stream,
    env: { NO_COLOR: "1" },
    inspect() {
      inspections += 1;
      return doctor(inspections === 1 ? "drifted" : "current");
    },
    promptSelect: promptAnswers(["overlay"]),
    promptConfirm: promptAnswers([true]),
    previewOverlayUpgrade: () => preview,
    overlayUpgrade(target, receivedPreview) {
      assert.equal(target, "/work/example");
      appliedPreview = receivedPreview;
      return upgrade;
    },
    initialize: () => assert.fail("init must not run"),
    synchronize: () => assert.fail("strict sync must not run")
  });

  assert.equal(result.status, "overlay-upgraded");
  assert.equal(result.result.projectIntegration.state, "current");
  assert.equal(result.upgrade, upgrade);
  assert.equal(appliedPreview, preview);
  assert.equal(inspections, 2);
  assert.match(stream.text(), /当前科研状态已归档并重置/u);
  assert.match(stream.text(), /项目文件和已有归档均已保留/u);
  assert.match(stream.text(), /重新进入 Claude Code/u);
  assert.match(stream.text(), /\/dove:workspace/u);
});

test("drifted integration diagnoses before offering overlay or zero-write exit", async () => {
  const stream = outputStream();
  let choices;
  let writes = 0;
  const preview = { status: "ready" };
  const result = await runInteractiveDoveSetup({
    target: "/work/example",
    stream,
    env: { NO_COLOR: "1" },
    inspect: () => doctor("drifted"),
    previewOverlayUpgrade: () => preview,
    promptSelect: async (question) => {
      choices = question.choices;
      assert.match(stream.text(), /Dove 项目检查/u);
      return "exit";
    },
    promptConfirm: () => assert.fail("confirmation must not be shown after exit"),
    overlayUpgrade: () => { writes += 1; },
    initialize: () => { writes += 1; },
    synchronize: () => { writes += 1; }
  });

  assert.equal(result.status, "exited");
  assert.equal(result.preview, preview);
  assert.equal(writes, 0);
  assert.deepEqual(choices.map((choice) => choice.value), ["overlay", "exit"]);
  assert.match(choices[0].name, /覆盖升级 Dove（归档当前科研状态）/u);
  assert.match(stream.text(), /未修改任何文件/u);
});

test("legacy or invalid integration remains blocked when overlay preview is ambiguous", async () => {
  for (const initial of [
    doctor("current", { legacyCopiedRuntime: { detected: true } }),
    doctor("invalid")
  ]) {
    const stream = outputStream();
    let writes = 0;
    const result = await runInteractiveDoveSetup({
      target: "/work/example",
      stream,
      env: { NO_COLOR: "1" },
      inspect: () => initial,
      previewOverlayUpgrade() {
        throw new Error("ambiguous ownership");
      },
      promptConfirm: () => assert.fail("confirmation must not be shown"),
      overlayUpgrade: () => { writes += 1; },
      initialize: () => { writes += 1; },
      synchronize: () => { writes += 1; }
    });

    assert.equal(result.status, "blocked");
    assert.equal(writes, 0);
    assert.match(stream.text(), /无法明确判定覆盖升级是否安全/u);
    assert.doesNotMatch(stream.text(), /ambiguous ownership/u);
  }
});

test("ambiguous preview failure preserves an explicitly safe public message", async () => {
  const stream = outputStream();
  const error = new Error("private path and ownership details");
  error.publicMessage = "现有归档结构无法安全预览。";
  const result = await runInteractiveDoveSetup({
    target: "/work/example",
    stream,
    env: { NO_COLOR: "1" },
    inspect: () => doctor("invalid"),
    previewOverlayUpgrade() {
      throw error;
    },
    initialize: () => assert.fail("init must not run"),
    synchronize: () => assert.fail("sync must not run")
  });

  assert.equal(result.status, "blocked");
  assert.match(stream.text(), /现有归档结构无法安全预览/u);
  assert.doesNotMatch(stream.text(), /private path/u);
});

test("blocked output renders doctor with the injected stream and environment", async () => {
  const stream = outputStream();
  const result = await runInteractiveDoveSetup({
    target: "/work/example",
    stream,
    env: {},
    inspect: () => doctor("drifted"),
    previewOverlayUpgrade() {
      throw new Error("ambiguous ownership");
    },
    initialize: () => assert.fail("init must not run"),
    synchronize: () => assert.fail("sync must not run")
  });

  assert.equal(result.status, "blocked");
  assert.match(stream.text(), /\x1b\[1mDove 项目检查\x1b\[0m/u);
});
