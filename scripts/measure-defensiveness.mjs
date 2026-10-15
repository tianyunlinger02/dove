#!/usr/bin/env node
// Count defensive writing in real host transcripts so tone changes can be
// compared before and after a release. Read-only; prints one row per project.
//
//   node scripts/measure-defensiveness.mjs --since 2026-10-14T00:00 [--until ...] project-root...
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";

const HEDGES = ["但是", "不过", "可能", "尚未", "仍需", "不代表", "不等于", "不能宣称", "不保证", "证据边界", "有待", "暂不"];
const GATES = /sha256|hash|哈希|冻结|frozen|等价门禁|一致性门禁|equivalence gate|只读清单/giu;

function args(argv) {
  const options = { since: "", until: "9999", projects: [] };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--since") options.since = argv[++index];
    else if (argv[index] === "--until") options.until = argv[++index];
    else options.projects.push(path.resolve(argv[index]));
  }
  return options;
}

function transcripts(project) {
  const directory = path.join(os.homedir(), ".claude/projects", project.replace(/[^A-Za-z0-9]/gu, "-"));
  try {
    return fs.readdirSync(directory).filter((name) => name.endsWith(".jsonl")).map((name) => path.join(directory, name));
  } catch {
    return [];
  }
}

const count = (text, needle) => text.split(needle).length - 1;
const per1k = (n, chars) => (chars ? (1000 * n / chars).toFixed(1) : "-");

async function measure(project, since, until) {
  const total = { replyChars: 0, hedges: 0, replyNegations: 0, mentorCalls: 0, mentorChars: 0, mentorNegations: 0, gateWrites: 0 };
  for (const file of transcripts(project)) {
    // Stream: long-lived sessions exceed the maximum string length.
    for await (const line of readline.createInterface({ input: fs.createReadStream(file, "utf8"), crlfDelay: Infinity })) {
      if (!line.includes('"assistant"')) continue;
      let record;
      try { record = JSON.parse(line); } catch { continue; }
      const time = record.timestamp ?? "";
      if (record.type !== "assistant" || record.isSidechain || time < since || time >= until) continue;
      for (const block of record.message?.content ?? []) {
        if (block.type === "text") {
          total.replyChars += [...block.text].length;
          total.hedges += HEDGES.reduce((sum, word) => sum + count(block.text, word), 0);
          total.replyNegations += count(block.text, "不");
        } else if (block.type === "tool_use") {
          const input = block.input ?? {};
          if (["Agent", "Task"].includes(block.name) && input.subagent_type === "dove-mentor") {
            const prompt = String(input.prompt ?? "");
            total.mentorCalls += 1;
            total.mentorChars += [...prompt].length;
            total.mentorNegations += count(prompt, "不") + count(prompt, "禁");
          } else if (["Write", "Edit"].includes(block.name)) {
            const text = `${input.content ?? ""}${input.new_string ?? ""}`;
            const before = String(input.old_string ?? "").match(GATES)?.length ?? 0;
            total.gateWrites += Math.max(0, (text.match(GATES)?.length ?? 0) - before);
          }
        }
      }
    }
  }
  return total;
}

const options = args(process.argv.slice(2));
if (!options.since || !options.projects.length) {
  console.error("usage: measure-defensiveness.mjs --since <ISO time> [--until <ISO time>] <project-root>...");
  process.exit(2);
}
console.log("项目\t回复千字转折兜底\t回复千字“不”\t导师调用次数\t导师调用平均字数\t导师调用千字禁令\t新增自设门禁词");
for (const project of options.projects) {
  const t = await measure(project, options.since, options.until);
  console.log([
    path.basename(project),
    per1k(t.hedges, t.replyChars),
    per1k(t.replyNegations, t.replyChars),
    t.mentorCalls,
    t.mentorCalls ? Math.round(t.mentorChars / t.mentorCalls) : "-",
    per1k(t.mentorNegations, t.mentorChars),
    t.gateWrites
  ].join("\t"));
}
