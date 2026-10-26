import assert from "node:assert/strict";
import test from "node:test";

import { coreNeedsOf, latestLongTermIntent, longTermIntentDue, ownMessagesSince } from "../src/core/mentor-intent.mjs";

test("the intent comparison comes due by rounds: three ended since it, or a method decision", () => {
  assert.equal(longTermIntentDue(null, []), true);
  assert.equal(longTermIntentDue({ date: null }, []), true);
  const intent = { date: "2026-10-10" };
  assert.equal(longTermIntentDue(intent, []), false, "calendar time alone does not make it due");
  assert.equal(longTermIntentDue(intent, [{ day: "2026-10-09", kind: "missed" }, { day: "2026-10-11", kind: "missed" }, { day: "2026-10-12", kind: "delivered" }]), false, "a round before the comparison does not count");
  assert.equal(longTermIntentDue(intent, [{ day: "2026-10-11", kind: "missed" }, { day: "2026-10-12", kind: "delivered" }, { day: "2026-10-13", kind: "missed" }]), true);
  assert.equal(longTermIntentDue(intent, [{ day: "2026-10-11", kind: "decision" }]), true, "a decision on the core method makes it due at once");
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
    assert.equal(longTermIntentDue(intent, [{ day: "2026-10-02", kind: "decision" }]), true);
  }
});

test("an intent after a long history is not lost to a prefix window", () => {
  const notes = `${"历史笔记\n".repeat(20000)}\n## 长期意图（2026-10-16）\n最近的长期意图。`;
  assert.deepEqual(latestLongTermIntent(notes), { date: "2026-10-16", text: "最近的长期意图。" });
});

test("the user's own words also bring the comparison due, and its core needs are what a host carries", () => {
  const intent = { date: "2026-10-10" };
  const entries = Array.from({ length: 30 }, (_, index) => ({ day: index < 2 ? "2026-10-09" : "2026-10-11" }));
  assert.equal(ownMessagesSince(entries, "2026-10-10"), 28);
  assert.equal(longTermIntentDue(intent, [], 28), false);
  assert.equal(longTermIntentDue(intent, [], 30), true);
  const full = latestLongTermIntent("## 长期意图（2026-10-10）\n### 核心需求\n- 学会写可改的程序\n### 约束\n- 不做模板库\n### 偏离\n没有偏离。");
  assert.equal(coreNeedsOf(full), "核心需求：\n- 学会写可改的程序\n约束：\n- 不做模板库");
  assert.equal(coreNeedsOf({ date: null, text: "只有一段旧格式的意图。" }), "只有一段旧格式的意图。", "older sections without the two headings are shown as they are");
});
