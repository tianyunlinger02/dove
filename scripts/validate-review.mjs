#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { generatedDoveAgentEntries, renderClaudeDoveMentorAgent, renderClaudeDoveReviewAgent } from "../src/core/dove-agent-definition.mjs";
import { CLI_COMMAND_SPECS, parseDoveCli } from "../src/cli/command-parser.mjs";
import * as publicCore from "../src/core/index.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

for (const [name, render] of [["dove-mentor", renderClaudeDoveMentorAgent], ["dove-review", renderClaudeDoveReviewAgent]]) {
  const content = render();
  assert.equal(content.match(/^name: (.+)$/mu)?.[1], name);
  assert.deepEqual(content.match(/^tools: (.+)$/mu)?.[1].split(", "), ["Read", "Grep", "Glob"]);
  assert.equal(generatedDoveAgentEntries().find(({ relativePath }) => relativePath === `.claude/agents/${name}.md`)?.content, content);
  assert.match(content, /实际读过的文件/u);
}
assert.equal(Object.hasOwn(CLI_COMMAND_SPECS, "review"), false);
for (const name of ["handoffReview", "resumeReview", "rerunReview", "importReviewReturn", "inspectReviewStatus", "inspectReviewReport", "reviewStateLocation", "createReviewId", "normalizeReviewMaterialList", "prepareReviewWorkspace", "DOVE_REVIEW_BACKEND_ID", "renderDoveReviewerStanceSection"]) {
  assert.equal(Object.hasOwn(publicCore, name), false, `Retired review export ${name} must not remain`);
}
for (const subcommand of ["handoff", "status", "resume", "rerun", "import", "report"]) {
  assert.throws(() => parseDoveCli(["review", subcommand]), /Dove 不支持这个命令：review/u);
  const result = spawnSync(process.execPath, [path.join(ROOT, "bin/dove.mjs"), "review", subcommand, "--json"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(result.status, 1, result.stderr);
  assert.equal(result.stdout, "");
  const failure = JSON.parse(result.stderr);
  assert.equal(failure.status, "blocked");
  assert.match(failure.message, /Dove 不支持这个命令：review/u);
}

console.log("Review checks passed: read-only native agent definitions and retired CLI/export removal. No files written, project initialized or model invoked.");
