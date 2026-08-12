import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

import {
  DOVE_PRIMARY_ROLES,
  renderClaudeReviewerAgent,
  renderOpenCodeReviewerAgent,
  renderOpenCodeRoleSkill,
  reviewerPrompt
} from "../../src/core/role-definitions.mjs";

const ROOT = process.cwd();

function runPython(relativePath, input) {
  return spawnSync("python3", [path.join(ROOT, relativePath)], { cwd: ROOT, input: JSON.stringify(input), encoding: "utf8" });
}

test("Planner and Builder use internal conditions rather than report templates", () => {
  for (const roleId of ["planner", "builder"]) {
    const role = DOVE_PRIMARY_ROLES[roleId];
    assert.equal("outputs" in role, false);
    assert.ok(role.internalCompletionConditions.length > 0);
    const rendered = renderOpenCodeRoleSkill(roleId);
    assert.match(rendered, /## Internal Responsibilities and Completion Conditions/u);
    assert.doesNotMatch(rendered, /## Outputs/u);
    assert.match(rendered, /not a required.*template|not a requirement/iu);
  }
});

test("Reviewer returns readable scope-bound Markdown rather than a machine import object", () => {
  assert.match(DOVE_PRIMARY_ROLES.reviewer.description, /convenience definition.*not evidence of independence or authority/iu);
  assert.match(DOVE_PRIMARY_ROLES.reviewer.responsibility, /user-managed separate exchange.*does not establish independence.*authority/isu);
  const reviewer = renderOpenCodeRoleSkill("reviewer");
  assert.match(reviewer, /## Outputs/u);
  assert.match(reviewer, /readable Markdown review/u);
  assert.doesNotMatch(reviewer, /strict JSON|machine exchange|findingId|verdict enum/iu);
});

test("dedicated Reviewer prompt declares only user-managed paths and natural review output", () => {
  const prompt = reviewerPrompt({ artifactPaths: ["paper/result.md"] });
  assert.match(prompt, /user-managed separate review exchange.*do not prove independence, identity, or authority/isu);
  assert.match(prompt, /paper\/result\.md/u);
  assert.match(prompt, /Read only those exact project-relative files/u);
  for (const forbiddenAccess of ["parent transcript", "Trellis tasks", "Dove installation state", "undeclared file"]) assert.match(prompt, new RegExp(forbiddenAccess, "iu"));
  for (const forbiddenAction of ["edit", "self-fix", "launch another reviewer", "delegate"]) assert.match(prompt, new RegExp(forbiddenAction, "iu"));
  assert.match(prompt, /Return one readable Markdown review/u);
  assert.match(prompt, /Tie every concrete finding.*declared paths/isu);
  assert.match(prompt, /Do not use IDs, fixed verdict enums, or a strict import schema/iu);
  assert.doesNotMatch(prompt, /"status"|"verdict"|"findingId"|SHA-256/iu);
});

test("Reviewer prompt rejects an empty scope", () => {
  assert.throws(() => reviewerPrompt({ artifactPaths: [] }), /at least one declared artifact path/iu);
});

test("Claude and OpenCode Reviewer agents are dedicated and read-only", () => {
  const claude = renderClaudeReviewerAgent();
  assert.match(claude, /^---\nname: dove-reviewer\n[\s\S]*\ntools: Read\n---/u);
  assert.doesNotMatch(claude, /tools:.*(?:Write|Edit|Bash|Task)/u);
  assert.match(claude, /Return one readable Markdown review/u);
  const opencode = renderOpenCodeReviewerAgent();
  assert.match(opencode, /mode: subagent/u);
  assert.match(opencode, /read: allow/u);
  for (const capability of ["write", "edit", "bash", "glob", "grep", "task", "skill"]) assert.match(opencode, new RegExp(`${capability}: deny`, "u"));
});

test("Trellis injector and Ralph loop ignore dove-reviewer", () => {
  const injected = runPython(".claude/hooks/inject-subagent-context.py", {
    tool_name: "Agent",
    tool_input: { subagent_type: "dove-reviewer", prompt: "Review only the declared artifact." },
    cwd: ROOT
  });
  assert.equal(injected.status, 0);
  assert.equal(injected.stdout, "");
  assert.equal(injected.stderr, "");

  const ralph = runPython(".claude/hooks/ralph-loop.py", {
    hook_event_name: "SubagentStop",
    agent_type: "dove-reviewer",
    last_assistant_message: "Review complete.",
    cwd: ROOT
  });
  assert.equal(ralph.status, 0);
  assert.equal(ralph.stdout, "");
  assert.equal(ralph.stderr, "");
});
