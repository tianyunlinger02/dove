import assert from "node:assert/strict";
import test from "node:test";

import { latestLongTermIntent, longTermIntentDue } from "../src/core/mentor-intent.mjs";

const now = new Date(2026, 9, 16, 18, 0);

test("intent comparison is due only after seven local calendar days", () => {
  assert.equal(longTermIntentDue(null, now), true);
  assert.equal(longTermIntentDue({ date: null }, now), true);
  for (const [date, due] of [["2026-10-16", false], ["2026-10-10", false], ["2026-10-09", false], ["2026-10-08", true], ["2026-10-17", true]]) {
    assert.equal(longTermIntentDue({ date }, now), due, date);
  }
});

test("latest dated intent wins regardless of append order and keeps nested Markdown", () => {
  const notes = "# 导师笔记\n\n## 长期意图（2026-10-15）\n用户要通用能力。\n### 核心能力\n- 实际指标仍有差距。\n\n## 其它判断\n不是意图。\n\n## 长期意图（2026-10-01）\n旧目标。\n\n## 长期意图\n没有日期的草稿。";
  assert.deepEqual(latestLongTermIntent(notes), { date: "2026-10-15", text: "用户要通用能力。\n### 核心能力\n- 实际指标仍有差距。" });
  assert.equal(latestLongTermIntent(`${notes}\n## 长期意图（2026-10-15）\n同日的新版本。`).text, "同日的新版本。");
});

test("explicit section and enclosing note dates count, unrelated prose and fenced examples do not", () => {
  assert.deepEqual(latestLongTermIntent("## 2026-10-14 导师笔记\n### 长期意图\n真实目标。\n### 预测\n预测。"), { date: "2026-10-14", text: "真实目标。" });
  assert.deepEqual(latestLongTermIntent("## 长期意图\n日期：2026-10-13\n真实目标。"), { date: "2026-10-13", text: "日期：2026-10-13\n真实目标。" });
  assert.equal(latestLongTermIntent("## 普通笔记 2026-10-16\n新判断。"), null);
  assert.equal(latestLongTermIntent("## 长期意图\n这里引用 2026-10-16 的普通事实。").date, null);
  assert.equal(latestLongTermIntent("```md\n## 长期意图（2026-10-16）\n示例。\n```"), null);
  assert.equal(latestLongTermIntent("## 长期意图（2026-02-30）\n错误日期。").date, null);
});

test("a code example or child section date cannot renew an undated intent draft", () => {
  for (const example of ["```md\n日期：2026-10-16\n```", "### 近邻论文\n日期：2026-10-16"]) {
    const intent = latestLongTermIntent(`## 长期意图（2026-10-01）\n旧目标。\n## 长期意图\n无日期的新草稿。\n${example}`);
    assert.deepEqual(intent, { date: "2026-10-01", text: "旧目标。" });
    assert.equal(longTermIntentDue(intent, now), true);
  }
});

test("an intent after a long history is not lost to a prefix window", () => {
  const notes = `${"历史笔记\n".repeat(20000)}\n## 长期意图（2026-10-16）\n最近的长期意图。`;
  assert.deepEqual(latestLongTermIntent(notes), { date: "2026-10-16", text: "最近的长期意图。" });
});
