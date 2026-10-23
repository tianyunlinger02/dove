import assert from "node:assert/strict";
import test from "node:test";

import { cardField, identityCardContext, parseDoveCurrentRound, readDoveIdentityCard } from "../../src/core/identity-card.mjs";

function memoryCard(card) {
  return {
    fsOps: {
      realpathSync: (target) => target,
      lstatSync: (target) => ({ isSymbolicLink: () => false, isDirectory: () => !target.endsWith(".md"), isFile: () => target.endsWith(".md") }),
      readFileSync: () => Buffer.from(card)
    }
  };
}

test("oversized identity retains a UTF-8-safe beginning instead of becoming missing", () => {
  const beginning = "Mainline: 合成目标\nCurrent round: rounds/003-brief.md\nRound status: ongoing\n";
  const card = beginning + "甲".repeat(1500);
  const options = memoryCard(card);
  const text = readDoveIdentityCard("/virtual", options);
  assert.ok(Buffer.byteLength(text) <= 4096);
  assert.ok(text.startsWith(beginning));
  assert.equal(text.includes("�"), false);
  const context = identityCardContext("/virtual", options);
  assert.match(context, /身份卡超过 4KB/u);
  assert.doesNotMatch(context, /未读到身份卡/u);
  assert.deepEqual(parseDoveCurrentRound(text), { brief: "rounds/003-brief.md", ongoing: true });
});

test("hook context finds research state after the old 4KB prefix without duplicating or rewriting it", () => {
  const state = "最近两轮只接通了真实评测，方法还没胜过现有对照；下一步先用真实失败检验核心假设。";
  const beginning = "Mainline: 用户确认的主线\nCurrent round: rounds/009-brief.md\nRound status: ongoing\n";
  const card = `${beginning}${"旧卡说明。".repeat(1000)}\nResearch state: ${state}\nMethod design: rounds/006-brief.md\n`;
  const options = memoryCard(card);
  const raw = readDoveIdentityCard("/virtual", options);
  assert.ok(!raw.includes(state), "the public raw reader retains its original prefix contract");
  assert.deepEqual(parseDoveCurrentRound(raw), { brief: "rounds/009-brief.md", ongoing: true });
  const context = identityCardContext("/virtual", options);
  assert.ok(context.includes(state));
  assert.equal(context.split(state).length - 1, 1);
  assert.ok(context.indexOf(state) < context.indexOf("Mainline:"));
  assert.match(context, /从完整原卡提取/u);
  assert.match(context, /方法设计留在 Method design 指向的说明里/u);
  assert.ok(!context.includes("�"));
});

test("multiline and decorated research state is shown once, not clipped into a fake summary", () => {
  const state = `做了评价修复，未证明方法有效。\n${"没有新的方法结果。".repeat(50)}\n最后一句仍是未知，不是成功。`;
  const card = `Mainline: 保持原目标\n- **Research state（研究状态）**：${state}\nMethod design: rounds/005-brief.md\nCore capability: 学到可泛化机制\n`;
  const options = memoryCard(card);
  assert.equal(readDoveIdentityCard("/virtual", options), card.trim());
  const context = identityCardContext("/virtual", options);
  assert.ok(context.includes(state), "the state is shown verbatim; the mentor writes it, the hook never clips it");
  assert.equal(context.split("最后一句仍是未知，不是成功。").length - 1, 1);
  assert.doesNotMatch(context, /超过约 300 字|请宿主.*重写/u, "no length nag: the research state is the mentor's to write");
  assert.match(context, /Method design: rounds\/005-brief.md/u);
  assert.match(context, /Core capability: 学到可泛化机制/u);
  assert.ok(!context.includes("- **Research state"), "the original field block is not copied again");
});

test("empty fields cannot borrow the next field as their value", () => {
  const card = "Mainline: 保持原目标\nResearch state: \nMethod design:   \nCore capability: 不能误作方法设计\nCurrent round:\nRound status: ongoing\n";
  assert.equal(cardField(card, "Method design"), null);
  assert.equal(cardField(card, "Research state"), null);
  assert.equal(parseDoveCurrentRound(card), null);
  const context = identityCardContext("/virtual", memoryCard(card));
  assert.match(context, /研究状态：原卡未填写/u);
  assert.match(context, /Core capability: 不能误作方法设计/u);
});

test("Chinese state fields are recognized and absent cards are not inferred", () => {
  const state = "目前只有开发信号，尚无真实数据上的方法收益。";
  const context = identityCardContext("/virtual", memoryCard(`研究状态：${state}\nMainline: 目标\n`));
  assert.ok(context.includes(state));
  assert.equal(context.split(state).length - 1, 1);
  assert.match(identityCardContext(null), /未读到身份卡.*不要从旧笔记推定主线/u);
});
