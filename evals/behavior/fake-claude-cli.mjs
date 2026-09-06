#!/usr/bin/env node

import assert from "node:assert/strict";
import path from "node:path";
import process from "node:process";

// Offline spawn contract only: no model, initialization, installation, or host settings.
const args = process.argv.slice(2);
const expectedPrefix = ["--print", "--verbose", "--output-format", "stream-json", "--input-format", "text", "--permission-mode", "acceptEdits", "--max-budget-usd"];
assert.deepEqual(args.slice(0, expectedPrefix.length), expectedPrefix);
assert.equal(args.includes("--dangerously-skip-permissions"), false);
const budget = Number(args[expectedPrefix.length]);
assert.ok(Number.isFinite(budget) && budget > 0);
const model = args.includes("--model") ? args[args.indexOf("--model") + 1] : null;

let input = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) input += chunk;
assert.ok(input.trim().length > 0);
const workspace = process.cwd();
const terminal = {
  type: "result", subtype: "success", is_error: false,
  total_cost_usd: 0.001,
  modelUsage: { synthetic: { costUSD: 0.0001 } },
  permission_denials: [],
  result: "Offline synthetic answer; no research judgment was exercised."
};
if (model === "fake-stream-error") {
  terminal.subtype = "error_during_execution";
  terminal.is_error = true;
  terminal.errors = ["Synthetic host execution failure"];
} else if (model === "fake-budget-stop") {
  terminal.subtype = "error_max_budget_usd";
  terminal.is_error = true;
} else if (model === "fake-over-budget") {
  terminal.total_cost_usd = budget + 0.001;
} else if (model === "fake-permission-denial") {
  terminal.permission_denials = [{ tool_name: "Bash", tool_use_id: "toolu_denied", tool_input: { command: "python scripts/central_probe.py" } }];
}

const records = [
  { type: "system", subtype: "init", cwd: workspace, argv: args, input, childPath: process.env.PATH, evalFlag: process.env.DOVE_BEHAVIOR_EVAL },
  { type: "assistant", message: { role: "assistant", content: [
    { type: "text", text: "Inspecting the synthetic fixture." },
    { type: "tool_use", id: "toolu_read", name: "Read", input: { file_path: path.join(workspace, "paper", "main.tex") } }
  ] } },
  ...(model === "fake-incomplete" ? [] : [terminal])
];
process.stderr.write("fake Claude diagnostic on stderr\n");
for (const record of records) process.stdout.write(`${JSON.stringify(record)}\n`);
