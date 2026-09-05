#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const args = process.argv.slice(2);
const expectedPrefix = ["--print", "--verbose", "--output-format", "stream-json", "--input-format", "text", "--permission-mode", "acceptEdits", "--max-budget-usd"];
assert.deepEqual(args.slice(0, expectedPrefix.length), expectedPrefix);
assert.equal(args.includes("--dangerously-skip-permissions"), false);
assert.equal(args.includes("--permission-mode") && /bypass/iu.test(args[args.indexOf("--permission-mode") + 1] ?? ""), false);
const budget = Number(args[expectedPrefix.length]);
assert.equal(Number.isFinite(budget), true, "budget must be numeric");
if (process.env.DOVE_FAKE_EXPECT_MAX_BUDGET_USD) assert.equal(budget, Number(process.env.DOVE_FAKE_EXPECT_MAX_BUDGET_USD));

let input = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) input += chunk;
assert.match(input, /\/dove:research/u);
assert.match(input, /Option A|Option B/u);

const workspace = process.cwd();
const manuscript = path.join(workspace, "paper", "main.tex");
assert.equal(fs.existsSync(path.join(workspace, ".dove", "install", "manifest.json")), true, "runner must install Dove through deployed project surface before invoking Claude");
assert.equal(fs.existsSync(path.join(workspace, ".git", "HEAD")), true, "runner must create a real git repository boundary");
assert.equal(fs.existsSync(manuscript), true, "fixture manuscript must exist");

const records = [
  { type: "system", subtype: "init", cwd: workspace, session_id: "fake-behavior-smoke" },
  { type: "assistant", message: { role: "assistant", content: [
    { type: "text", text: "I will inspect the bounded framing source before answering." },
    { type: "tool_use", id: "toolu_read", name: "Read", input: { file_path: manuscript } }
  ] } },
  { type: "result", subtype: "success", total_cost_usd: 0.001, result: "Option A is safer: the available evidence supports a regularizer claim, while Option B overstates the evidence as an architecture-family contribution. Stopping here without file changes." }
];
process.stderr.write("fake Claude diagnostic on stderr\n");
for (const record of records) process.stdout.write(`${JSON.stringify(record)}\n`);
