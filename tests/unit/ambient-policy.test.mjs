import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { createTempRoot } from "../helpers/temp-root.mjs";
import {
  DOVE_CLAUDE_AMBIENT_HOOK_COMMAND,
  ambientContextForPrompt,
  classifyLessonsIntent,
  isHighConfidenceAmbientWorkPrompt,
  lessonsContextForPrompt,
  mergeClaudeAmbientSettings,
  renderClaudeAmbientSkill,
  renderClaudeLessonsIntakeSkill
} from "../../src/core/ambient-policy.mjs";

const ROOT = process.cwd();
const HOOK = path.join(ROOT, "scripts", "dove-user-prompt-submit.mjs");

function runHook(input) {
  return spawnSync(process.execPath, [HOOK], { cwd: ROOT, encoding: "utf8", input });
}

test("ambient admission is pure, conservative, and bilingual", () => {
  const negative = [
    "   /dove:status",
    "   ",
    "Hello!",
    "谢谢",
    "Approved.",
    "确认",
    "Continue.",
    "Do it.",
    "继续",
    "执行吧",
    "What is the status?",
    "进展怎么样？",
    "进度",
    "Why does this test fail?",
    "解释一下这个模块如何工作",
    "Review src/core/ambient-policy.mjs and tell me what you think.",
    "检查 README 是否清楚",
    "Maybe we should improve the docs.",
    "要不要重构这个模块？",
    "Can you help?",
    "看看这个"
  ];
  for (const prompt of negative) {
    assert.equal(isHighConfidenceAmbientWorkPrompt(prompt), false, prompt);
    assert.equal(ambientContextForPrompt(prompt), null, prompt);
  }

  const positive = [
    "Build the requested benchmark report",
    "Please implement the focused parser change and add tests.",
    "Fix the failing ambient hook test.",
    "Create docs/RESULTS.md with the accepted findings.",
    "Run the bounded benchmark and save the results to benchmark.json.",
    "Investigate the regression and write a reproducible diagnosis to DIAGNOSIS.md.",
    "实现已批准的 ambient 准入修改并补充测试。",
    "请创建一份 benchmark 报告并保存到 reports/benchmark.md。",
    "运行这组有界实验并生成 results.json。",
    "排查该回归并把可复现结论写入 DIAGNOSIS.md。"
  ];
  for (const prompt of positive) {
    assert.equal(isHighConfidenceAmbientWorkPrompt(prompt), true, prompt);
    const context = ambientContextForPrompt(prompt);
    assert.match(context, /hidden `dove-intake`/u);
    assert.ok(context.length < 400);
    assert.doesNotMatch(context, new RegExp(prompt.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
    assert.doesNotMatch(context, /\.dove|prompt.*store|transcript|call.*model/iu);
  }
});

test("Lessons intent classification is pure, explicit, and separate from Mission intake", () => {
  const positive = new Map([
    ["Read our lessons", "read"],
    ["Show me what we learned", "read"],
    ["查看经验文档", "read"],
    ["Remember this lesson: preserve failed cases", "remember"],
    ["保存这条经验：失败案例也要保留", "remember"],
    ["Reflect on our experience", "reflect"],
    ["Summarize what we learned", "reflect"],
    ["复盘本次经验", "reflect"]
  ]);
  for (const [prompt, intent] of positive) {
    assert.equal(classifyLessonsIntent(prompt), intent, prompt);
    assert.match(lessonsContextForPrompt(prompt), /dove-lessons-intake/u, prompt);
  }
  const negative = [
    "/dove:lessons",
    "Do not remember this lesson",
    "不要保存这条经验",
    "Can you remember this lesson?",
    "是否可以查看经验文档",
    "The example is \"remember this lesson\"",
    "例如：保存这条经验",
    "Summarize the paper",
    "总结一下",
    "Maybe remember this",
    "保存一下",
    "What is a lesson?"
  ];
  for (const prompt of negative) {
    assert.equal(classifyLessonsIntent(prompt), null, prompt);
    assert.equal(lessonsContextForPrompt(prompt), null, prompt);
  }
});

test("Claude ambient settings merge preserves unrelated hooks and is idempotent", () => {
  const original = {
    theme: "dark",
    hooks: {
      SessionStart: [{ matcher: "startup", hooks: [{ type: "command", command: "keep", timeout: 5 }] }],
      UserPromptSubmit: [{ matcher: "user-owned", hooks: [{ type: "command", command: "keep-prompt", timeout: 5 }] }]
    }
  };
  const first = mergeClaudeAmbientSettings(original);
  assert.equal(first.changed, true);
  assert.deepEqual(first.settings.theme, "dark");
  assert.deepEqual(first.settings.hooks.SessionStart, original.hooks.SessionStart);
  assert.deepEqual(first.settings.hooks.UserPromptSubmit[0], original.hooks.UserPromptSubmit[0]);
  assert.equal(first.settings.hooks.UserPromptSubmit[1].hooks[0].command, DOVE_CLAUDE_AMBIENT_HOOK_COMMAND);
  const second = mergeClaudeAmbientSettings(first.settings);
  assert.equal(second.changed, false);
  assert.deepEqual(second.settings, first.settings);
});

test("Claude ambient settings fail closed on conflicting current and legacy Dove-managed hooks", () => {
  for (const command of [
    "dove hook user-prompt-submit --project . --changed",
    "node ./scripts/dove-user-prompt-submit-package.mjs --changed"
  ]) {
    assert.throws(() => mergeClaudeAmbientSettings({
      hooks: {
        UserPromptSubmit: [{ hooks: [{ type: "command", command, timeout: 10 }] }]
      }
    }), /conflicting Dove-managed UserPromptSubmit hook/u);
  }
  assert.throws(() => mergeClaudeAmbientSettings({ hooks: { UserPromptSubmit: {} } }), /must be an array/u);
});

test("ambient hook skips slash prompts and rejects malformed or unsupported input", () => {
  const workspace = createTempRoot("dove-ambient-hook-zero-write-");
  const before = fs.readdirSync(workspace, { recursive: true }).map(String).sort();
  const slash = spawnSync(process.execPath, [HOOK], { cwd: workspace, encoding: "utf8", input: JSON.stringify({ hook_event_name: "UserPromptSubmit", prompt: "  /dove:status" }) });
  assert.equal(slash.status, 0, slash.stderr);
  assert.equal(slash.stdout, "");

  const ordinary = spawnSync(process.execPath, [HOOK], { cwd: workspace, encoding: "utf8", input: JSON.stringify({ hook_event_name: "UserPromptSubmit", prompt: "Implement the focused change" }) });
  assert.equal(ordinary.status, 0, ordinary.stderr);
  const payload = JSON.parse(ordinary.stdout);
  assert.equal(payload.hookSpecificOutput.hookEventName, "UserPromptSubmit");
  assert.match(payload.hookSpecificOutput.additionalContext, /dove-intake/u);
  assert.doesNotMatch(ordinary.stdout, /Implement the focused change/u);

  const lessons = spawnSync(process.execPath, [HOOK], { cwd: workspace, encoding: "utf8", input: JSON.stringify({ hook_event_name: "UserPromptSubmit", prompt: "保存这条经验：失败案例也要保留" }) });
  assert.equal(lessons.status, 0, lessons.stderr);
  const lessonsPayload = JSON.parse(lessons.stdout);
  assert.match(lessonsPayload.hookSpecificOutput.additionalContext, /dove-lessons-intake/u);
  assert.doesNotMatch(lessonsPayload.hookSpecificOutput.additionalContext, /create_ambient_dove_mission/u);

  for (const prompt of ["Hello", "Thanks", "Approved", "Continue", "What is the status?", "Explain how this works", "Review this file", "Maybe improve it"]) {
    const skipped = spawnSync(process.execPath, [HOOK], { cwd: workspace, encoding: "utf8", input: JSON.stringify({ hook_event_name: "UserPromptSubmit", prompt }) });
    assert.equal(skipped.status, 0, skipped.stderr);
    assert.equal(skipped.stdout, "", prompt);
  }

  assert.deepEqual(fs.readdirSync(workspace, { recursive: true }).map(String).sort(), before);
  assert.equal(fs.existsSync(path.join(workspace, ".dove")), false);

  for (const [input, message] of [
    ["{bad", /malformed JSON/u],
    [JSON.stringify({ hook_event_name: "SessionStart", prompt: "work" }), /unsupported or missing hook event/u],
    [JSON.stringify({ prompt: "work" }), /unsupported or missing hook event/u],
    [JSON.stringify({ hook_event_name: "UserPromptSubmit" }), /requires a string prompt/u]
  ]) {
    const result = runHook(input);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, message);
    assert.equal(result.stdout, "");
  }
});

test("hidden Lessons intake uses read-update MCP flow without Mission or fallback", () => {
  const skill = renderClaudeLessonsIntakeSkill();
  assert.match(skill, /user-invocable: false/u);
  assert.match(skill, /manage_dove_lessons.*operation=read/isu);
  assert.match(skill, /operation=update.*binding unchanged.*complete replacement Markdown/isu);
  assert.match(skill, /reflection.*read.*update/isu);
  assert.match(skill, /do not create a Mission/iu);
  assert.match(skill, /do not call `create_ambient_dove_mission`/u);
  assert.match(skill, /not evidence, authority, completion proof/iu);
  assert.match(skill, /CLI, shell, or direct Dove state access/iu);
  assert.doesNotMatch(skill, /query_dove_lessons|record_dove_lesson|lessonId|scope enum|kind enum/iu);
  assert.ok(Buffer.byteLength(skill, "utf8") <= 2600);
});

test("hidden intake skill preserves five concise ambient capabilities", () => {
  const skill = renderClaudeAmbientSkill();
  assert.match(skill, /user-invocable: false/u);
  const capabilities = [
    /conservative judgment.*(?:starts new work|clear new work)|(?:starts new work|clear new work).*conservative judgment/isu,
    /(?:ambigu.*one.*zero-write clarification|one.*zero-write clarification.*ambigu)/isu,
    /create_ambient_dove_mission/iu,
    /(?:successful create|success).*(?:resume|continue).*original (?:request|task)|(?:resume|continue).*original (?:request|task).*successful create/isu,
    /closureRequest.*exactly once.*boundArgs/isu
  ];
  for (const capability of capabilities) assert.match(skill, capability);
  assert.match(skill, /outcomeContract.*literally.*rather than inferring/isu);
  assert.match(skill, /(?:hostControl|researchHandoff).*(?:machine channels|out of user-facing output)|(?:machine channels|out of user-facing output).*(?:hostControl|researchHandoff)/isu);
  assert.match(skill, /(?:clarification|blocks|fails).*(?:show only|public human).*report.*stop|stop.*(?:clarification|blocks|fails)/isu);
  assert.match(skill, /artifact:<path>.*validation:<path>/isu);
  assert.doesNotMatch(skill, /note:<id>/iu);
  assert.match(skill, /remains unclear.*no work was started.*stop/isu);
  assert.doesNotMatch(skill, /remains unclear.*continue/isu);
  assert.match(skill, /(?:direct (?:Dove )?state|\.dove).*(?:public tools|host integration|never|must not)|(?:public tools|host integration|never|must not).*(?:direct (?:Dove )?state|\.dove)/isu);
  assert.match(skill, /(?:public Dove (?:MCP )?(?:tools|surfaces)).*(?:CLI|shell)|(?:CLI|shell).*(?:public Dove (?:MCP )?(?:tools|surfaces))/isu);
  assert.doesNotMatch(skill, /when it says|terminal.*stop|resume.*same turn|generate one private safe mission id|separate Dove confirmation|evidence close|never retry|closure decision|decision table/iu);
  assert.ok(Buffer.byteLength(skill, "utf8") <= 2600);
  assert.equal(fs.existsSync(path.join(ROOT, ".claude", "skills", "dove-intake", "SKILL.md")), true);
});
