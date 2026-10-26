import assert from "node:assert/strict";
import test from "node:test";

import {
  COMMAND_SURFACE_BY_ID,
  COMMAND_SURFACES,
  PROJECT_HOST_IDS,
  allGeneratedCommandAdapterPaths,
  adapterPathForCommand,
  commandAdapterPathsForHost,
  commandIdToSlug,
  hostCommandSlug
} from "../../src/core/command-manifest.mjs";
import { renderClaudeDoveMentorAgent } from "../../src/core/dove-agent-definition.mjs";

const SKILLS = ["research", "status", "source", "experiment", "draft", "figure", "review"];

test("Dove keeps seven flat Skills on the Claude Code host", () => {
  const ids = SKILLS.map((slug) => `dove.${slug}`);
  assert.deepEqual(COMMAND_SURFACES.map(({ id }) => id), ids);
  assert.deepEqual(Object.keys(COMMAND_SURFACE_BY_ID), ids);
  assert.deepEqual(PROJECT_HOST_IDS, ["claude"]);
  for (const [index, command] of COMMAND_SURFACES.entries()) {
    assert.equal(COMMAND_SURFACE_BY_ID[command.id], command);
    assert.equal(commandIdToSlug(command.id), SKILLS[index]);
    assert.equal(hostCommandSlug(command.id), SKILLS[index]);
    assert.ok(command.summary.trim());
    assert.ok(command.contract.actions.length);
    assert.ok(command.contract.boundaries.length);
  }
  const paths = SKILLS.map((slug) => `.claude/commands/dove/${slug}.md`);
  assert.deepEqual(commandAdapterPathsForHost("claude"), paths);
  for (const [index, command] of COMMAND_SURFACES.entries()) {
    assert.equal(adapterPathForCommand("claude", command), paths[index]);
    assert.equal(adapterPathForCommand("claude", command.id), paths[index]);
  }
  assert.deepEqual(allGeneratedCommandAdapterPaths(), paths);
  assert.throws(() => adapterPathForCommand("dsh", "dove.research"), /Unknown host/u);
});

test("author responses to reviews live in the draft Skill", () => {
  const draft = COMMAND_SURFACE_BY_ID["dove.draft"].contract;
  const text = [draft.purpose, draft.when, ...draft.actions, ...draft.boundaries].join("\n");
  assert.match(text, /审稿意见/u);
  assert.match(text, /接受、反驳、限定或调查/u);
  assert.equal(COMMAND_SURFACE_BY_ID["dove.rebuttal"], undefined);
  assert.equal(COMMAND_SURFACE_BY_ID["dove.lessons"], undefined);
});

test("the mentor is called at decision points and returns what Dove and the host use", () => {
  const mentor = renderClaudeDoveMentorAgent();
  assert.match(mentor, /一轮出判定时、超时或停滞时、新方法设计时、用户要求时/u);
  for (const question of ["实质科研进展", "检验核心方法，还是在修工程", "离用户要的最终结果还差什么"]) assert.ok(mentor.includes(question), question);
  // Returns that the dashboard and the hooks read back.
  assert.match(mentor, /最卡的一维/u);
  assert.match(mentor, /可迁移（<八维中的一维>）：/u);
  assert.match(mentor, /### 待用户决定/u);
  assert.match(mentor, /研究状态/u);
  assert.match(mentor, /判定核对/u);
  assert.match(mentor, /论文追踪每周判断一次/u);
});
