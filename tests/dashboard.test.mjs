import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { collectDashboard, parseAuthor, parseMarkdownTables, readProjectDocument, summarizeProject } from "../src/core/dashboard-data.mjs";
import { renderDashboardHtml, startDashboardServer } from "../src/cli/dashboard-server.mjs";

function fixtureProject(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dove-dashboard-"));
  for (const [relative, content] of Object.entries(files)) {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  return root;
}

const researchFiles = {
  ".dove/research/IDENTITY.md": "Current round: rounds/002-brief.md\nRound status: ongoing\nMainline: 从四张图恢复完整服装结构\n",
  ".dove/research/EVAL.md": "# EVAL\n\n| 轮次 | 基线 | 未见类别 |\n|---|---:|---:|\n| 001 | 0.31 | 0.12 |\n| 002 | 0.31 | 0.18 |\n",
  ".dove/research/rounds/001-brief.md": "# 统一解码\nAuthor: 导师\n\n预测：未见类别 0.15\n",
  ".dove/research/rounds/001-result.md": "未见类别 0.12，低于预测。\n",
  ".dove/research/rounds/002-brief.md": "# 联合生成\n作者：用户\n"
};

test("summarizes identity, evaluation tables and rounds without writing", () => {
  const root = fixtureProject(researchFiles);
  const before = fs.readdirSync(path.join(root, ".dove/research/rounds")).sort();
  const project = summarizeProject(root);
  assert.equal(project.mainline, "从四张图恢复完整服装结构");
  assert.equal(project.currentRound, "rounds/002-brief.md");
  assert.equal(project.roundStatus, "ongoing");
  assert.deepEqual(project.evaluation.tables[0].header, ["轮次", "基线", "未见类别"]);
  assert.equal(project.evaluation.tables[0].rows.length, 2);
  assert.deepEqual(project.rounds.map((round) => [round.label, round.author, Boolean(round.result)]), [["002", "user", false], ["001", "mentor", true]]);
  assert.equal(project.rounds[1].title, "统一解码");
  assert.equal(project.rounds[1].brief.text, undefined);
  assert.match(readProjectDocument(root, "001-result.md").text, /低于预测/u);
  assert.equal(readProjectDocument(root, "../IDENTITY.md"), null);
  assert.match(readProjectDocument(root, "EVAL.md").text, /未见类别/u);
  assert.equal(project.evaluation.text, null);
  assert.deepEqual(fs.readdirSync(path.join(root, ".dove/research/rounds")).sort(), before);
});

test("parses authors and markdown tables tolerantly", () => {
  assert.equal(parseAuthor("Author: external reviewer"), "external");
  assert.equal(parseAuthor("- **作者**：导师"), "mentor");
  assert.equal(parseAuthor("no author line"), null);
  assert.deepEqual(parseMarkdownTables("| a | b |\n| :- | -: |\n| 1 | 2 |\n\ntext\n| c |\n|---|\n"), [
    { header: ["a", "b"], rows: [["1", "2"]] },
    { header: ["c"], rows: [] }
  ]);
});

test("collect skips missing roots and projects without research records", () => {
  const withResearch = fixtureProject(researchFiles);
  const bare = fixtureProject({ "README.md": "x" });
  const result = collectDashboard({ projects: [withResearch, bare, path.join(bare, "missing")], packageVersion: "9.9.9" });
  assert.deepEqual(result.projects.map((project) => project.root), [withResearch]);
  assert.equal(result.version, "9.9.9");
});

test("server serves the page and read-only JSON", async () => {
  const root = fixtureProject(researchFiles);
  const server = await startDashboardServer({ collect: () => collectDashboard({ projects: [root] }), listRoots: () => [root], readDocument: readProjectDocument, port: 0 });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const page = await fetch(`${base}/`);
    assert.match(await page.text(), /Dove 科研面板/u);
    const api = await (await fetch(`${base}/api/dashboard`)).json();
    assert.equal(api.projects[0].name, path.basename(root));
    const brief = await (await fetch(`${base}/api/doc?project=${encodeURIComponent(root)}&name=001-brief.md`)).json();
    assert.match(brief.text, /预测：未见类别 0\.15/u);
    assert.equal((await fetch(`${base}/api/doc?project=${encodeURIComponent(root)}&name=../IDENTITY.md`)).status, 404);
    assert.equal((await fetch(`${base}/api/doc?project=%2Ftmp&name=001-brief.md`)).status, 404);
    assert.equal((await fetch(`${base}/api/dashboard`, { method: "POST" })).status, 405);
    assert.equal((await fetch(`${base}/nope`)).status, 404);
  } finally {
    server.close();
  }
  assert.ok(renderDashboardHtml().includes("/api/dashboard"));
});

test("with a password every page and API request needs the session cookie", async () => {
  const root = fixtureProject(researchFiles);
  const server = await startDashboardServer({ collect: () => collectDashboard({ projects: [root] }), listRoots: () => [root], readDocument: readProjectDocument, password: "s3cret-pass", port: 0 });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const login = await (await fetch(`${base}/`)).text();
    assert.match(login, /请输入访问密码/u);
    assert.doesNotMatch(login, /从四张图/u);
    assert.equal((await fetch(`${base}/api/dashboard`)).status, 401);
    assert.equal((await fetch(`${base}/api/doc?project=${encodeURIComponent(root)}&name=001-brief.md`)).status, 401);
    const post = (password) => fetch(`${base}/login`, { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ password }) });
    const wrong = await post("nope");
    assert.equal(wrong.headers.get("location"), "/?failed=1");
    assert.equal(wrong.headers.get("set-cookie"), null);
    const right = await post("s3cret-pass");
    const cookie = right.headers.get("set-cookie");
    assert.match(cookie, /^dove_dashboard=[^;]+; Path=\/; HttpOnly; SameSite=Strict/u);
    const headers = { cookie: cookie.split(";")[0] };
    assert.equal((await fetch(`${base}/api/dashboard`, { headers })).status, 200);
    assert.match(await (await fetch(`${base}/`, { headers })).text(), /action="\/logout"/u);
    assert.equal((await fetch(`${base}/api/dashboard`, { headers: { cookie: "dove_dashboard=forged" } })).status, 401);
  } finally {
    server.close();
  }
});

test("page scripts parse in every mode", () => {
  for (const options of [{}, { canEdit: true }, { canEdit: true, canSignOut: true }]) {
    const html = renderDashboardHtml(options);
    assert.doesNotThrow(() => new Function(html.split("<script>")[1].split("</script>")[0]), JSON.stringify(options));
  }
});
