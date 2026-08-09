import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

import { renderClaudeReviewerAgent, renderOpenCodeReviewerAgent, reviewerPrompt } from "../../src/core/role-definitions.mjs";
import { TOOL_INPUT_SCHEMAS } from "../../src/mcp/tool-definitions.mjs";
import { assertMcpInputSchema } from "../../src/mcp/schema-validation.mjs";

const ROOT = process.cwd();

function runPython(relativePath, input) {
  return spawnSync("python3", [path.join(ROOT, relativePath)], {
    cwd: ROOT,
    input: JSON.stringify(input),
    encoding: "utf8"
  });
}

test("dedicated Reviewer prompt declares only frozen content and structured return", () => {
  const prompt = reviewerPrompt({
    hostKind: "claude",
    reviewedArtifacts: [{ path: "paper/result.md", sizeBytes: 42, sha256: "a".repeat(64) }]
  });
  assert.match(prompt, /paper\/result\.md \(42 bytes; SHA-256 [a-f0-9]{64}\)/u);
  assert.match(prompt, /Read only those exact project-relative files/u);
  for (const forbiddenAccess of ["parent transcript", "Trellis task", "Dove state", "undeclared file"]) assert.match(prompt, new RegExp(forbiddenAccess, "iu"));
  for (const forbiddenAction of ["edit", "rebut", "self-fix", "launch another reviewer", "delegate"]) assert.match(prompt, new RegExp(forbiddenAction, "iu"));
  for (const field of ["status", "verdict", "summary", "rubric", "findings", "actionItems", "report", "provenance", "limitations", "reviewedAt"]) assert.match(prompt, new RegExp(`"${field}"`, "u"));
  assert.match(prompt, /Do not claim authority, identity, sign-off, acceptance, or independence/u);
});

test("Reviewer prompt field set passes the strict review import schema", () => {
  const review = {
    status: "completed",
    verdict: "coherent",
    summary: "The declared artifact is internally coherent.",
    rubric: ["Correctness and internal coherence"],
    findings: [],
    actionItems: [],
    report: "# Review\n\nNo material finding in the declared scope.\n",
    provenance: { hostKind: "claude" },
    limitations: ["Only the declared artifact was reviewed."],
    reviewedAt: "2026-08-09T00:00:00.000Z"
  };
  assert.doesNotThrow(() => assertMcpInputSchema("manage_dove_reviews", {
    operation: "import",
    missionId: "mission-review",
    exchangeId: "exchange-review",
    review
  }, TOOL_INPUT_SCHEMAS.get("manage_dove_reviews")));
  const prompt = reviewerPrompt({ hostKind: "claude", reviewedArtifacts: [{ path: "paper.md", sizeBytes: 1, sha256: "a".repeat(64) }] });
  assert.deepEqual(
    [...prompt.matchAll(/^  "([A-Za-z]+)":/gmu)].map((match) => match[1]),
    Object.keys(review)
  );
});

test("Claude and OpenCode Reviewer agents are dedicated and read-only", () => {
  const claude = renderClaudeReviewerAgent();
  assert.match(claude, /^---\nname: dove-reviewer\n[\s\S]*\ntools: Read\n---/u);
  assert.doesNotMatch(claude, /tools:.*(?:Write|Edit|Bash|Task)/u);
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
