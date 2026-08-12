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
  renderClaudeAmbientRule,
  renderClaudeAmbientSkill,
  renderClaudeLessonsIntakeSkill
} from "../../src/core/ambient-policy.mjs";
import { USER_RESPONSE_POLICY } from "../../src/core/user-response-policy.mjs";

const ROOT = process.cwd();
const HOOK = path.join(ROOT, "scripts", "dove-user-prompt-submit.mjs");

function runHook(input) {
  return spawnSync(process.execPath, [HOOK], { cwd: ROOT, encoding: "utf8", input });
}

test("ambient admission excludes only slash, empty, and obvious conversation", () => {
  const negative = ["   /dove:status", "   ", "Hello!", "谢谢", "确认", "继续"];
  for (const prompt of negative) {
    assert.equal(isHighConfidenceAmbientWorkPrompt(prompt), false, prompt);
    assert.equal(ambientContextForPrompt(prompt), null, prompt);
  }

  const positive = [
    "What is the status?",
    "Why does this test fail?",
    "Review src/core/ambient-policy.mjs and tell me what you think.",
    "Maybe we should improve the docs.",
    "Build the requested benchmark report",
    "实现已批准的 ambient 准入修改并补充测试。"
  ];
  for (const prompt of positive) {
    assert.equal(isHighConfidenceAmbientWorkPrompt(prompt), true, prompt);
    assert.match(ambientContextForPrompt(prompt), /hidden `dove-intake`/u);
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
  for (const prompt of ["  /dove:status", "  /dove:auto", "/dove:auto investigate the strongest alternative hypothesis"]) {
    const slash = spawnSync(process.execPath, [HOOK], { cwd: workspace, encoding: "utf8", input: JSON.stringify({ hook_event_name: "UserPromptSubmit", prompt }) });
    assert.equal(slash.status, 0, slash.stderr);
    assert.equal(slash.stdout, "", prompt);
  }

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

  for (const prompt of ["Hello", "Thanks", "继续"]) {
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

test("hidden Lessons intake maintains one ordinary advisory Markdown", () => {
  const skill = renderClaudeLessonsIntakeSkill();
  assert.match(skill, /user-invocable: false/u);
  assert.match(skill, /\.dove\/research\/LESSONS\.md/u);
  assert.match(skill, /read the document directly/iu);
  assert.match(skill, /preserve its useful structure.*organize it naturally/isu);
  assert.match(skill, /reflection.*integrate only supported reusable guidance/isu);
  assert.match(skill, /Do not create unrelated research documents/iu);
  assert.match(skill, /not evidence, authority, completion proof/iu);
  assert.match(skill, /host file tools directly/iu);
  assert.doesNotMatch(skill, /manage_dove|lessonId|scope enum|kind enum|database.*required/iu);
  assert.ok(Buffer.byteLength(skill, "utf8") <= 3000);
});

test("hidden intake skill preserves concise zero-write routing and excludes explicit-only Auto", () => {
  const rule = renderClaudeAmbientRule();
  const skill = renderClaudeAmbientSkill();
  for (const bullet of USER_RESPONSE_POLICY) {
    assert.equal(rule.split(bullet).length - 1, 1, bullet);
  }
  assert.match(rule, /10 flat Skills: research, status, source, experiment, draft, figure, review, rebuttal, lessons, and auto/iu);
  assert.match(rule, /Auto is explicit-only.*hidden intake cannot select it/isu);
  assert.match(skill, /user-invocable: false/u);
  assert.match(skill, /without reimplementing natural-language admission rules/iu);
  assert.match(skill, /(?:ambigu.*one.*zero-write clarification|one.*zero-write clarification.*ambigu)/isu);
  assert.match(skill, /smallest ambient-eligible Skill/iu);
  assert.match(skill, /research, status, source, experiment, draft, figure, review, rebuttal, or lessons/iu);
  assert.match(skill, /Auto.*explicit-only.*never select/isu);
  assert.match(skill, /Do not create a research document merely because a prompt was selected/iu);
  assert.match(skill, /remains unclear.*no work was started.*stop/isu);
  assert.match(skill, /host file and research tools directly/iu);
  assert.match(skill, /\.dove\/research\/RESEARCH\.md/u);
  assert.match(skill, /Do not introduce IDs, fixed schemas, a database, or a hidden state service/iu);
  assert.doesNotMatch(skill, /manage_dove|public Dove MCP|create_ambient_dove_mission|closureRequest|hostControl|researchHandoff|outcomeContract|binding/iu);
  assert.ok(Buffer.byteLength(skill, "utf8") <= 2600);
  assert.equal(fs.existsSync(path.join(ROOT, ".claude", "skills", "dove-intake", "SKILL.md")), true);
});
