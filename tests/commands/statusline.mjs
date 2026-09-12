import assert from "node:assert/strict";

import {
  formatContextCapacity,
  formatSessionDuration,
  inspectGitBranch,
  parseDoveStatusLinePayload,
  renderDoveStatusLine
} from "../../src/core/statusline.mjs";

export function assertDoveStatusLineRenderer() {
  const payload = {
    model: { display_name: "gpt-5.6-sol(high)" },
    context_window: {
      context_window_size: 272_000,
      used_percentage: 76,
      remaining_percentage: 24
    },
    cost: { total_duration_ms: ((54 * 60) + 34) * 60_000 }
  };
  assert.equal(
    renderDoveStatusLine(payload, {
      projectRoot: "/home/nvme01/paper_factory",
      branch: "dove-mission-handoff-search"
    }),
    "gpt-5.6-sol(high) (272K) · ctx 24% · /home/nvme01/paper_factory · " +
      "dove-mission-handoff-search · 54h34m"
  );
  assert.equal(renderDoveStatusLine({
    model: { display_name: "Opus 4.8 (1M context)" },
    context_window: { context_window_size: 1_000_000, used_percentage: 85 },
    cost: {}
  }, { branch: null }), "Opus 4.8 (1M context)", "used percentage must not masquerade as remaining context");
  assert.equal(renderDoveStatusLine({
    model: { display_name: "Model\nInjected" },
    context_window: { remaining_percentage: 0 },
    cost: { total_duration_ms: 0 }
  }, { branch: "main\rbranch" }), "Model?Injected · ctx 0% · main?branch · 0m");
  assert.equal(renderDoveStatusLine("{broken", { branch: null }), "Dove");
  assert.deepEqual(parseDoveStatusLinePayload("[]"), {});
  assert.equal(formatContextCapacity(1_500_000), "1.5M");
  assert.equal(formatContextCapacity(undefined), null);
  assert.equal(formatSessionDuration(59_999), "0m");
  assert.equal(formatSessionDuration(undefined), null);

  let invocation = null;
  assert.equal(inspectGitBranch("/workspace/project", {
    timeoutMs: 125,
    spawnSync(command, argv, options) {
      invocation = { command, argv, options };
      return { status: 0, signal: null, stdout: "research-mainline\n", stderr: "" };
    }
  }), "research-mainline");
  assert.deepEqual(invocation.command, "git");
  assert.deepEqual(invocation.argv, ["branch", "--show-current"]);
  assert.equal(invocation.options.cwd, "/workspace/project");
  assert.equal(invocation.options.timeout, 125);
  assert.equal(invocation.options.env.GIT_CEILING_DIRECTORIES, "/workspace");
  assert.equal(inspectGitBranch("/workspace/project", {
    spawnSync() { return { status: 1, signal: null, stdout: "" }; }
  }), null);
  assert.equal(inspectGitBranch("/workspace/project", {
    spawnSync() { throw new Error("git unavailable"); }
  }), null);
}
