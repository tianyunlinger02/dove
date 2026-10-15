import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createDashboardActions } from "../src/cli/dashboard-actions.mjs";
import { renderDashboardHtml, startDashboardServer } from "../src/cli/dashboard-server.mjs";
import { collectDashboard, readProjectDocument } from "../src/core/dashboard-data.mjs";
import { changeRegisteredProjects } from "../src/core/project-registry.mjs";
import { parseCardHeader, readTopicCriteriaInfo, readTopics, startTopicSelection, writeTopicCriteria } from "../src/core/topic-selection.mjs";

const criteria = `# 论文选题要求、论证原则与交付规范\n\n本版为第23版。\n${"## 一、原则\n先发散，再审查。\n".repeat(20)}## 附录 E：当前项目设置（point1）\n\n找题期间尽量不做实验。\n\n## 修订记录\n第22版到第23版。\n`;

function setup() {
  const env = { HOME: fs.mkdtempSync(path.join(os.tmpdir(), "dove-topic-home-")) };
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dove-topic-project-"));
  fs.mkdirSync(path.join(root, ".dove/research"), { recursive: true });
  return { env, root };
}

test("criteria are kept at user level and copied into a project when selection starts", () => {
  const { env, root } = setup();
  assert.throws(() => startTopicSelection(root, { env }), /还没有选题标准/u);
  assert.throws(() => writeTopicCriteria("太短", { env }), /太短/u);
  const info = writeTopicCriteria(criteria, { env });
  assert.equal(info.version, "23");
  assert.equal(readTopicCriteriaInfo({ env }).title, "论文选题要求、论证原则与交付规范");
  const topics = startTopicSelection(root, { env });
  assert.equal(topics.started, true);
  assert.equal(topics.criteria.version, "23");
  const readme = fs.readFileSync(path.join(root, ".dove/research/topics/README.md"), "utf8");
  assert.ok(readme.includes("开头固定五行"));
  assert.match(readme, /必须先读并遵循项目标准/u);
  assert.match(readme, /用户尚未确认主线.*并列候选.*生成时不砍题/u);
  assert.match(readme, /真实.*检索.*拓宽候选.*2–3.*用户选定.*选择前不实现方法/u);
  assert.match(readme, /卡片记录不是选择.*已有主线.*不重选或降级/u);
  const copied = fs.readFileSync(path.join(root, ".dove/research/topics/CRITERIA.md"), "utf8");
  assert.doesNotMatch(copied, /找题期间尽量不做实验/u, "another project's settings stay out of the copy");
  assert.match(copied, /## 修订记录/u, "sections after the project settings are kept");
  assert.equal(info.projectSection, "附录 E：当前项目设置（point1）");
  const project = fs.readFileSync(path.join(root, ".dove/research/topics/PROJECT.md"), "utf8");
  assert.match(project, /用户原话.*日期\/出处/u);
  assert.match(project, /明确.*不重复确认.*未知.*待用户确认.*暂定.*不把记录当批准/u);
  assert.match(project, /只读\/设计讨论.*资源.*宿主权限.*仍适用/u);
});

test("card headers give status, stage, position, summary and the six conclusions", () => {
  const card = parseCardHeader("# 结构感知纸样编辑\n状态：推荐\n- **阶段**：三\n定位：平衡\n一句话：用穿着反馈决定何时改结构\n六点：问题 满足｜方法 待核实｜贡献 满足｜创新 不满足｜可行 满足｜重要 满足\n\n正文……");
  assert.equal(card.title, "结构感知纸样编辑");
  assert.equal(card.status, "推荐");
  assert.equal(card.stage, "三");
  assert.deepEqual(card.sixParts.map((part) => part.state), ["yes", "pending", "yes", "no", "yes", "yes"]);
});

test("dashboard lists topic cards and serves only topic documents", async () => {
  const { env, root } = setup();
  writeTopicCriteria(criteria, { env });
  startTopicSelection(root, { env });
  fs.writeFileSync(path.join(root, ".dove/research/topics/cards/01-a.md"), "# 方向甲\n状态：候选\n阶段：一\n定位：探索\n一句话：甲\n六点：问题 待核实\n");
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
    assert.equal(overview.criteria.version, "23");
    assert.equal(overview.projects[0].cards[0].title, "方向甲");
    const saved = await fetch(`${base}/api/action`, { method: "POST", headers: { "content-type": "application/json", "x-dove-request": "1" }, body: JSON.stringify({ type: "saveTopicCriteria", text: criteria.replace("第23版", "第24版") }) });
    assert.equal((await saved.json()).result.version, "24");
  } finally {
    server.close();
  }
  for (const options of [{ canEdit: true }, { canEdit: true, canSignOut: true }]) {
    const html = renderDashboardHtml(options);
    assert.doesNotThrow(() => new Function(html.split("<script>")[1].split("</script>")[0]));
  }
});
