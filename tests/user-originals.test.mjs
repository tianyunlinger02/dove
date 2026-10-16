import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { refreshUserOriginals, USER_ORIGINALS_PATH } from "../src/core/user-originals.mjs";

const user = (time, content, extra = {}) => JSON.stringify({ type: "user", timestamp: time, message: { role: "user", content }, ...extra });

test("the user's own words are gathered from current and legacy sessions, with relays marked and noise left out", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "dove-originals-home-"));
  const project = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "dove-originals-")), "garment-study");
  fs.mkdirSync(project);
  const encode = (value) => value.replace(/[^A-Za-z0-9]/gu, "-");
  const current = path.join(home, ".claude/projects", encode(project));
  const legacy = path.join(home, ".claude/projects", `-old-place-legacy-${encode("garment-study")}`);
  const unrelated = path.join(home, ".claude/projects", "-home-someone-else");
  for (const directory of [current, legacy, unrelated]) fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(legacy, "aaaaaaaa-1.jsonl"), `${user("2026-09-06T16:05:00Z", "如果科研我们需不需要训练或者微调一个我们的模型")}\n`);
  fs.writeFileSync(path.join(unrelated, "cccccccc-1.jsonl"), `${user("2026-09-01T00:00:00Z", "这是别的项目的话，不应出现")}\n`);
  const session = path.join(current, "bbbbbbbb-1.jsonl");
  fs.writeFileSync(session, [
    user("2026-10-04T10:00:00Z", "主会话 Claude，转达用户新要求：只推理，不训练"),
    user("2026-10-04T10:01:00Z", "This session is being continued from a previous conversation."),
    user("2026-10-04T10:02:00Z", [{ type: "tool_result", content: "工具输出不算" }]),
    user("2026-10-04T10:03:00Z", "子任务里的话不算", { isSidechain: true }),
    user("2026-10-04T10:04:00Z", "继续"),
    user("2026-10-04T10:05:00Z", [{ type: "text", text: "记得我们不是要把服装写死，而是要让那模型学会" }]),
    ""
  ].join("\n"));
  const first = refreshUserOriginals(project, { home });
  assert.deepEqual([first.own, first.relay, first.directories.length], [2, 1, 2]);
  const text = fs.readFileSync(path.join(project, USER_ORIGINALS_PATH), "utf8");
  assert.ok(text.indexOf("需不需要训练") < text.indexOf("让那模型学会"), "entries are in time order across directories");
  assert.match(text, /转述 · 主会话 Claude/u);
  assert.match(text, /短消息 1 条/u);
  assert.doesNotMatch(text, /工具输出不算|子任务里的话不算|previous conversation|别的项目/u);
  fs.appendFileSync(session, `${user("2026-10-12T05:53:00Z", "确保有真的意义先，然后提出几个想法")}\n`);
  const second = refreshUserOriginals(project, { home });
  assert.equal(second.own, 3, "appended messages are read incrementally without losing earlier ones");
});

test("huge tool and image lines are skipped and a time budget defers the rest to the next call", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "dove-originals-home-"));
  const project = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "dove-originals-")), "big-study");
  fs.mkdirSync(project);
  const directory = path.join(home, ".claude/projects", project.replace(/[^A-Za-z0-9]/gu, "-"));
  fs.mkdirSync(directory, { recursive: true });
  const image = JSON.stringify({ type: "user", timestamp: "2026-10-01T00:00:00Z", message: { role: "user", content: [{ type: "text", text: "x".repeat(600 << 10) }] } });
  fs.writeFileSync(path.join(directory, "dddddddd-1.jsonl"), `${image}\n${user("2026-10-02T00:00:00Z", "我问的就是自主完整生成整件衣服")}\n`);
  const deferred = refreshUserOriginals(project, { home, budgetMs: 0 });
  assert.equal(deferred.own, 0);
  assert.ok(deferred.pendingBytes > 0);
  assert.match(fs.readFileSync(path.join(project, USER_ORIGINALS_PATH), "utf8"), /未整理/u);
  const done = refreshUserOriginals(project, { home });
  assert.deepEqual([done.own, done.pendingBytes], [1, 0]);
  assert.doesNotMatch(fs.readFileSync(path.join(project, USER_ORIGINALS_PATH), "utf8"), /xxxx/u);
});
