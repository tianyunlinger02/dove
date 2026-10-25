#!/usr/bin/env node
// Development only (not packaged): replay a real decision point on a copy of a
// real project under a given Dove CLI, so old and new guidance can be compared
// on the same situation. Never touches the project itself or the user's Dove
// registry: the copy gets its own Dove configuration directory, and the host
// session may read and write only inside the copy (no shell, no subagents, no web).
//
//   node scripts/replay-decision-points.mjs --project /path/to/project [--round 88] \
//     --cli /path/to/dove-entry.mjs --label new --out /tmp/replays [--prompt <text>] [--max-turns 40] \
//     [--agent <name> [--agent-body rules]]
//
// --agent runs the main thread as that agent (claude --agent). With --agent-body rules
// the copy gets .claude/agents/<name>.md whose prompt is the copy's own operating
// manual followed by Dove's main-agent role, so the manual sits in the system prompt.
//
// Without --round the copy is the project's current state (the next real decision).
// With --round N, rounds from N on are removed and the card, EVAL and mentor notes
// are restored from git history when the project tracks them.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function options(argv) {
  // The session cannot run commands, so it is told so; both sides of a comparison get the same words.
  const result = { prompt: "继续。这次会话只能读写文件，不能运行命令或调用子代理。请按 Dove 的做法往下推进：该写的轮次说明、方法设计或给我的决定备忘就直接写进项目记录，需要我决定的就问我。", maxTurns: "40" };
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index].replace(/^--/u, "").replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
    result[key] = argv[index + 1];
  }
  for (const required of ["project", "cli", "label", "out"]) {
    if (!result[required]) throw new Error(`missing --${required}`);
  }
  return result;
}

function run(command, args, extra = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", maxBuffer: 256 << 20, ...extra });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  return result.stdout;
}

const SMALL_FILE = 2 << 20;
const HEAVY = /(?:^|\/)(?:\.git|node_modules|__pycache__|\.venv|venv|checkpoints?|ckpts?|wandb|data|datasets|paper_downloads|runs)(?:\/|$)/u;
// Without git, copy only code and text a host reads when deciding the next step.
const TEXT = /\.(?:py|md|txt|json|jsonl|yaml|yml|toml|cfg|ini|sh|csv|tsv|tex|bib|js|mjs|ts|cpp|c|h|hpp|cu|log)$/iu;
const SMALL_TEXT = 1 << 20;

// Code and small artifacts are enough to decide the next step; data and weights are not copied.
function copyProject(source, target) {
  fs.mkdirSync(target, { recursive: true });
  // Tracked and untracked-but-not-ignored files: current code is often not committed yet.
  const tracked = spawnSync("git", ["-C", source, "ls-files", "-z", "--cached", "--others", "--exclude-standard"], { encoding: "utf8", maxBuffer: 256 << 20 });
  const files = tracked.status === 0 ? tracked.stdout.split("\0").filter(Boolean).filter((item) => !HEAVY.test(item)) : [];
  const walk = (relative) => {
    for (const name of fs.readdirSync(path.join(source, relative))) {
      const item = path.join(relative, name);
      if (HEAVY.test(item)) continue;
      const stat = fs.lstatSync(path.join(source, item));
      if (stat.isDirectory()) walk(item);
      else if (stat.isFile() && stat.size <= SMALL_TEXT && TEXT.test(name)) files.push(item);
    }
  };
  if (files.length === 0) walk(".");
  for (const extra of [".dove/install", ".dove/research", ".claude", "CLAUDE.md", ".mcp.json"]) {
    if (!fs.existsSync(path.join(source, extra))) continue;
    if (fs.statSync(path.join(source, extra)).isDirectory()) {
      const stack = [extra];
      while (stack.length) {
        const directory = stack.pop();
        for (const name of fs.readdirSync(path.join(source, directory))) {
          const item = path.join(directory, name);
          if (HEAVY.test(item)) continue;
          const stat = fs.lstatSync(path.join(source, item));
          if (stat.isDirectory()) stack.push(item);
          else if (stat.isFile() && stat.size <= SMALL_FILE) files.push(item);
        }
      }
    } else files.push(extra);
  }
  for (const item of new Set(files)) {
    const from = path.join(source, item);
    if (!fs.existsSync(from) || !fs.lstatSync(from).isFile() || fs.statSync(from).size > SMALL_FILE) continue;
    fs.mkdirSync(path.dirname(path.join(target, item)), { recursive: true });
    fs.copyFileSync(from, path.join(target, item));
  }
}

// Remove rounds from the decision point on; restore the other records from git history when tracked.
function rewindRecords(source, target, round) {
  const rounds = path.join(target, ".dove/research/rounds");
  for (const name of fs.existsSync(rounds) ? fs.readdirSync(rounds) : []) {
    const number = Number(name.match(/^(\d+)[-_]/u)?.[1]);
    if (Number.isFinite(number) && number >= round) fs.rmSync(path.join(rounds, name), { force: true });
  }
  const brief = `.dove/research/rounds/${String(round).padStart(3, "0")}-brief.md`;
  const added = spawnSync("git", ["-C", source, "log", "--diff-filter=A", "--format=%H", "-1", "--", brief], { encoding: "utf8" });
  const commit = added.status === 0 ? added.stdout.trim() : "";
  const restored = [];
  if (commit) {
    for (const record of [".dove/research/IDENTITY.md", ".dove/research/EVAL.md", ".dove/research/MENTOR_NOTES.md"]) {
      const shown = spawnSync("git", ["-C", source, "show", `${commit}^:${record}`], { encoding: "utf8", maxBuffer: 64 << 20 });
      if (shown.status === 0) {
        fs.writeFileSync(path.join(target, record), shown.stdout);
        restored.push(record);
      }
    }
  }
  return { commit: commit || null, restored };
}

const args = options(process.argv.slice(2));
const project = path.resolve(args.project);
const round = args.round === undefined ? null : Number(args.round);
const name = `${path.basename(project)}-${round === null ? "now" : `r${String(round).padStart(3, "0")}`}-${args.label}`;
const out = path.resolve(args.out);
const copy = path.join(out, name);
const config = path.join(out, `${name}.config`);
const bin = path.join(out, `${name}.bin`);
if (copy === project || copy.startsWith(`${project}${path.sep}`)) throw new Error("the replay copy must live outside the project");
fs.rmSync(copy, { recursive: true, force: true });
fs.rmSync(config, { recursive: true, force: true });
fs.mkdirSync(path.join(config, "dove"), { recursive: true, mode: 0o700 });
fs.chmodSync(config, 0o700);
fs.chmodSync(path.join(config, "dove"), 0o700);
fs.writeFileSync(path.join(config, "dove/settings.json"), `${JSON.stringify({ hostMigration: false })}\n`);
fs.mkdirSync(bin, { recursive: true });
fs.writeFileSync(path.join(bin, "dove"), `#!/bin/sh\nexec "${process.execPath}" "${path.resolve(args.cli)}" "$@"\n`, { mode: 0o755 });

copyProject(project, copy);
const rewound = round === null ? null : rewindRecords(project, copy, round);
const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, XDG_CONFIG_HOME: config };
run(path.join(bin, "dove"), ["update", "--project", copy, "--json"], { env });
if (args.agent && args.agentBody === "rules") {
  // Strip frontmatter from Dove's own main-agent file and put the manual ahead of its role text.
  const manual = fs.readFileSync(path.join(copy, ".claude/rules/dove.md"), "utf8").replace(/^---\n[\s\S]*?\n---\n/u, "");
  const role = fs.readFileSync(path.join(copy, ".claude/agents/dove.md"), "utf8").replace(/^---\n[\s\S]*?\n---\n/u, "");
  fs.writeFileSync(path.join(copy, `.claude/agents/${args.agent}.md`), `---\nname: ${args.agent}\ndescription: Dove 研究伙伴（操作说明放在系统提示里）\n---\n\n${manual.trim()}\n\n${role.trim()}\n`);
}
const before =new Map(fs.readdirSync(path.join(copy, ".dove/research"), { recursive: true }).map((item) => [item, fs.statSync(path.join(copy, ".dove/research", item)).mtimeMs]));

const session = spawnSync("claude", [
  "-p", args.prompt,
  "--output-format", "stream-json", "--verbose",
  "--max-turns", args.maxTurns,
  ...(args.agent ? ["--agent", args.agent] : []),
  // The host may read the real project but never write to it.
  "--disallowedTools", `Bash,Agent,Task,WebSearch,WebFetch,NotebookEdit,Edit(/${project}/**),Write(/${project}/**),MultiEdit(/${project}/**)`
], { cwd: copy, env, encoding: "utf8", maxBuffer: 512 << 20, timeout: 45 * 60 * 1000 });
fs.writeFileSync(path.join(out, `${name}.jsonl`), session.stdout ?? "");
const events = (session.stdout ?? "").split("\n").filter(Boolean).map((line) => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);
const resultEvent = events.filter((event) => event.type === "result").at(-1);
const final = resultEvent?.result ?? (resultEvent ? `（会话结束：${resultEvent.subtype}）` : "");
const changed = fs.readdirSync(path.join(copy, ".dove/research"), { recursive: true })
  .filter((item) => fs.statSync(path.join(copy, ".dove/research", item)).isFile() && before.get(item) !== fs.statSync(path.join(copy, ".dove/research", item)).mtimeMs);
const report = [
  `# ${name}`,
  "",
  `项目：${project}（副本：${copy}）`,
  rewound === null
    ? "决策点：项目现在的状态（最新一轮之后的下一步）"
    : `决策点：第 ${round} 轮开工前；${rewound.commit ? `身份卡、EVAL、导师笔记还原到 ${rewound.commit.slice(0, 8)} 之前（${rewound.restored.join("、") || "无"}）` : "没有 git 历史，身份卡、EVAL、导师笔记是现在的版本"}`,
  `CLI：${args.cli}；入口：${args.agent ? `claude --agent ${args.agent}${args.agentBody === "rules" ? "（操作说明在系统提示里）" : ""}` : "普通 claude"}；提示：${args.prompt}；退出码 ${session.status}`,
  "",
  "## 宿主最后的回复",
  "",
  final || "（没有 result 事件）",
  "",
  "## 宿主改动的研究记录",
  "",
  ...(changed.length ? changed.map((item) => `- .dove/research/${item}`) : ["无"]),
  ""
].join("\n");
fs.writeFileSync(path.join(out, `${name}.md`), report);
console.log(report);
