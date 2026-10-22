import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { parseCardHeader, readTopicCriteriaInfo, readTopics, startTopicSelection } from "../src/core/topic-selection.mjs";

function setup() {
  const env = { HOME: fs.mkdtempSync(path.join(os.tmpdir(), "dove-topic-home-")) };
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dove-topic-project-"));
  fs.mkdirSync(path.join(root, ".dove/research"), { recursive: true });
  return { env, root };
}

test("topic selection follows Dove's installed standard and keeps only project settings in the project", () => {
  const { root } = setup();
  const info = readTopicCriteriaInfo();
  assert.deepEqual([info.present, info.source, info.version], [true, "dove", "29"]);
  const topics = startTopicSelection(root);
  assert.equal(topics.started, true);
  assert.equal(topics.criteria.version, "29", "before installation the bundled standard applies");
  assert.equal(fs.existsSync(path.join(root, ".dove/research/topics/CRITERIA.md")), false, "the project keeps no copy of the standard");
  fs.mkdirSync(path.join(root, ".dove/install"), { recursive: true });
  fs.writeFileSync(path.join(root, ".dove/install/TOPIC_CRITERIA.md"), "# 选题标准\n\n第29版。\n");
  assert.equal(readTopics(root).criteria.version, "29", "the copy Dove installed in the project is the one in use");
  const readme = fs.readFileSync(path.join(root, ".dove/research/topics/README.md"), "utf8");
  assert.ok(readme.includes(".dove/install/TOPIC_CRITERIA.md"));
  assert.ok(readme.includes("头部前 40 行"));
  for (const field of ["一句话", "缺口", "来源机制", "对应关系", "成立前提", "近邻差别", "最大风险", "改进自", "评审结论", "修改焦点", "最强反对", "评审依据"]) {
    assert.ok(readme.includes(`${field}：`));
  }
  assert.ok(readme.includes("RESEARCH_QUALITY.md"));
  const project = fs.readFileSync(path.join(root, ".dove/research/topics/PROJECT.md"), "utf8");
  assert.match(project, /用户原话.*日期\/出处/u);
  assert.match(project, /明确.*不重复确认.*未知.*待用户确认.*暂定.*不把记录当批准/u);
  assert.match(project, /只读\/设计讨论.*资源.*宿主权限.*仍适用/u);
});

test("card headers expose seven candidate columns and the adversarial verdict", () => {
  const card = parseCardHeader(`# 方向甲
状态：推荐
- **阶段**：三
定位：平衡
一句话：让反馈决定何时改变结构
缺口：现有方法保留了不适合当前约束的结构假设
- **来源机制：** [P1] 的分解机制在原问题中保留全局约束
对应关系：原问题的模块对应这里的结构片段
成立前提：局部反馈足以识别全局约束变化
近邻差别：[P2] 只修改固定结构内的参数
最大风险：局部反馈无法辨别结构变化
改进自：C1；补充来源机制及成立条件
评审结论：修改
修改焦点：依据
最强反对：现有证据尚不能证明该条件在目标问题成立
评审依据：[P1] 第三节仅覆盖固定约束，需要核实其边界

## 详细论证
正文……`);
  assert.deepEqual(card, {
    title: "方向甲",
    status: "推荐",
    stage: "三",
    position: "平衡",
    summary: "让反馈决定何时改变结构",
    gap: "现有方法保留了不适合当前约束的结构假设",
    source: "[P1] 的分解机制在原问题中保留全局约束",
    mapping: "原问题的模块对应这里的结构片段",
    assumptions: "局部反馈足以识别全局约束变化",
    novelty: "[P2] 只修改固定结构内的参数",
    risk: "局部反馈无法辨别结构变化",
    improves: "C1；补充来源机制及成立条件",
    verdict: "修改",
    focus: "依据",
    objection: "现有证据尚不能证明该条件在目标问题成立",
    reviewEvidence: "[P1] 第三节仅覆盖固定约束，需要核实其边界"
  });
});

test("card headers preserve explicit text without deriving decisions or reading retired fields", () => {
  assert.deepEqual(parseCardHeader(), {});
  assert.deepEqual(parseCardHeader("# 旧卡\n状态：候选\n六点：问题 满足｜创新 不满足"), { title: "旧卡", status: "候选" });
  const card = parseCardHeader("# 简卡\r\n一句话: 想法\r\n修改焦点：   \r\n评审结论：否掉（来源不支持迁移）\r\n评审结论：留下\r\nconstructor：不读取\r\n__proto__：不读取");
  assert.deepEqual(card, { title: "简卡", summary: "想法", verdict: "否掉（来源不支持迁移）" });
  assert.deepEqual(parseCardHeader(`${"\n".repeat(40)}评审结论：留下`), {}, "Only the first forty header lines feed the dashboard");
});

test("dashboard lists topic cards and serves only topic documents", async () => {
  const { createDashboardActions } = await import("../src/cli/dashboard-actions.mjs");
  const { renderDashboardHtml, startDashboardServer } = await import("../src/cli/dashboard-server.mjs");
  const { collectDashboard, readProjectDocument } = await import("../src/core/dashboard-data.mjs");
  const { changeRegisteredProjects } = await import("../src/core/project-registry.mjs");
  const { env, root } = setup();
  startTopicSelection(root);
  fs.writeFileSync(path.join(root, ".dove/research/topics/cards/01-a.md"), "# 方向甲\n状态：候选\n阶段：一\n定位：探索\n一句话：甲\n缺口：待正文核实\n来源机制：待阅读\n对应关系：待说明\n成立前提：待核实\n近邻差别：待比较\n最大风险：前提不成立\n");
  fs.writeFileSync(path.join(root, ".dove/research/topics/stage1-问题池.md"), "# 问题池\n");
  assert.deepEqual(readTopics(root).documents, ["topics/PROJECT.md", "topics/README.md", "topics/stage1-问题池.md"]);
  assert.match(readProjectDocument(root, "topics/cards/01-a.md").text, /方向甲/u);
  assert.equal(readProjectDocument(root, "topics/../IDENTITY.md"), null);
  assert.equal(readProjectDocument(root, "topics/cards/../../IDENTITY.md"), null);
  changeRegisteredProjects([root], [], { env });
  const actions = createDashboardActions({ env });
  const server = await startDashboardServer({ collect: () => collectDashboard({ projects: [root] }), listRoots: () => [root], readDocument: readProjectDocument, actions, port: 0 });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const overview = await (await fetch(`${base}/api/topics`)).json();
    assert.equal(overview.criteria.version, "29");
    assert.equal(overview.projects[0].cards[0].title, "方向甲");
    const refused = await fetch(`${base}/api/action`, { method: "POST", headers: { "content-type": "application/json", "x-dove-request": "1" }, body: JSON.stringify({ type: "saveTopicCriteria", text: "# 任意\n" }) });
    assert.notEqual(refused.status, 200, "the standard is revised in Dove, not saved from the dashboard");
  } finally {
    server.close();
  }
  for (const options of [{ canEdit: true }, { canEdit: true, canSignOut: true }]) {
    const html = renderDashboardHtml(options);
    assert.doesNotThrow(() => new Function(html.split("<script>")[1].split("</script>")[0]));
  }
});
