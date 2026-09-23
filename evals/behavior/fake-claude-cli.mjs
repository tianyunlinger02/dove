#!/usr/bin/env node

// Minimal offline spawn fixture: it exercises public completion and one non-success terminal.
import process from "node:process";

const args = process.argv.slice(2);
const budgetIndex = args.indexOf("--max-budget-usd");
const budget = budgetIndex >= 0 ? Number(args[budgetIndex + 1]) : NaN;
if (!Number.isFinite(budget) || budget <= 0) process.exit(2);

let input = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) input += chunk;
if (!input.trim()) process.exit(2);

const modelIndex = args.indexOf("--model");
const model = modelIndex >= 0 ? args[modelIndex + 1] : "fake-success";
const terminal = {
  type: "result",
  subtype: model === "fake-failure" ? "error_during_execution" : "success",
  is_error: model === "fake-failure",
  permission_denials: model === "fake-permission-denial"
    ? [{ tool_name: "Write", tool_use_id: "toolu_denied" }]
    : [],
  total_cost_usd: 0.001,
  result: "Offline synthetic answer; no research judgment was exercised."
};
const records = [
  { type: "assistant", message: { role: "assistant", content: [
    { type: "text", text: "Inspecting the synthetic fixture." },
    { type: "tool_use", name: "Read", input: { file_path: "paper/main.tex" } }
  ] } },
  ...(model === "fake-incomplete" ? [] : [terminal])
];
process.stderr.write("fake Claude diagnostic on stderr\n");
for (const record of records) process.stdout.write(`${JSON.stringify(record)}\n`);
