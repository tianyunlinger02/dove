import assert from "node:assert/strict";
import test from "node:test";

import { runInteractiveDoveSetup } from "../../src/cli/interactive-setup.mjs";

function stream() {
  let output = "";
  return { isTTY: false, write(value) { output += value; }, output() { return output; } };
}

function inspection(root = "/project") {
  return {
    target: root,
    projectIntegration: { state: "current" },
    legacyCopiedRuntime: { detected: false },
    setup: { mode: "reinstall", allowedActions: ["reinstall", "exit"] }
  };
}

test("installed Dove menu exposes Doctor toggle and human document", async () => {
  const output = stream();
  let choices;
  const result = await runInteractiveDoveSetup({
    target: "/project",
    inspect: async () => inspection(),
    readDoctorState: async () => ({ enabled: true, issues: [{ state: "open", summary: "当前项目集成需要更新", action: "dove sync" }] }),
    readDoctorDocument: async () => ({ path: ".dove/install/DOCTOR.md", exists: true, markdown: "# Dove 问题\n\n## 当前问题\n\n- 当前项目集成需要更新\n" }),
    setDoctorEnabled: async (_root, enabled) => ({ enabled, issues: [] }),
    promptSelect: async (question) => { choices = question.choices; return "doctor-issues"; },
    stream: output,
    env: { NO_COLOR: "1" }
  });
  assert.deepEqual(choices.map((choice) => choice.value), ["toggle-doctor", "doctor-issues", "reinstall", "exit"]);
  assert.match(choices[1].name, /DOCTOR\.md.*1/u);
  assert.equal(result.result.exists, true);
  assert.match(output.output(), /Dove 问题文档：\/project\/\.dove\/install\/DOCTOR\.md/u);
  assert.match(output.output(), /# Dove 问题/u);
});

test("Doctor toggle still explains manual Doctor remains available", async () => {
  const output = stream();
  const result = await runInteractiveDoveSetup({
    target: "/project",
    inspect: async () => inspection(),
    readDoctorState: async () => ({ enabled: true, issues: [] }),
    setDoctorEnabled: async (_root, enabled) => ({ enabled, issues: [] }),
    promptSelect: async () => "toggle-doctor",
    stream: output,
    env: { NO_COLOR: "1" }
  });
  assert.equal(result.result.enabled, false);
  assert.match(output.output(), /手动 dove doctor 始终可用/u);
});

test("missing Doctor document is explained without synthesizing JSON prose", async () => {
  const output = stream();
  await runInteractiveDoveSetup({
    target: "/project",
    inspect: async () => inspection(),
    readDoctorState: async () => ({ enabled: true, issues: [] }),
    readDoctorDocument: async () => ({ path: ".dove/install/DOCTOR.md", exists: false, markdown: null }),
    promptSelect: async () => "doctor-issues",
    stream: output,
    env: { NO_COLOR: "1" }
  });
  assert.match(output.output(), /当前尚无已记录问题/u);
});
