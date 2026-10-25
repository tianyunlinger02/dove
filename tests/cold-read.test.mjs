import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { COLD_READ_KEY, prepareColdRead } from "../src/core/cold-read.mjs";
import { findExecutable } from "../src/core/figure-generation.mjs";
import { readHookState } from "../src/core/hook-state.mjs";
import { stopHookOutput, turnRebuiltManuscript } from "../src/core/stop-hook.mjs";

const user = (text) => JSON.stringify({ type: "user", message: { role: "user", content: text } });
const toolResult = () => JSON.stringify({ type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: "a", content: "ok" }] } });
const bash = (command) => JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "tool_use", id: "a", name: "Bash", input: { command } }] } });
const say = (text) => JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text }] } });

function project(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dove-cold-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test("a turn that rebuilt the manuscript is told about the cold read once until the next one", (t) => {
  const root = project(t);
  const transcript = path.join(root, "session.jsonl");
  fs.writeFileSync(transcript, [user("改一下引言"), bash("cd docs/paper && latexmk -pdf main.tex"), toolResult(), say("改好了。"), ""].join("\n"));
  assert.equal(turnRebuiltManuscript(transcript), true);
  const payload = { hook_event_name: "Stop", transcript_path: transcript };
  const first = stopHookOutput(payload, root);
  assert.equal(first?.decision, "block");
  assert.match(first.reason, /冷读/u);
  assert.match(first.reason, /dove cold-read --pdf/u);
  assert.equal(stopHookOutput(payload, root), null, "said once until a cold read happens");
  assert.equal(stopHookOutput({ ...payload, stop_hook_active: true }, root), null);

  const state = path.join(root, ".dove/install/hook-state.json");
  const saved = JSON.parse(fs.readFileSync(state, "utf8"));
  saved.asked[COLD_READ_KEY] = "2026-10-25T08:00:00.000Z";
  fs.writeFileSync(state, JSON.stringify(saved));
  assert.equal(stopHookOutput(payload, root)?.decision, "block", "after a cold read, the next rebuild is reminded again");
  assert.equal(stopHookOutput(payload, root, { enabled: false }), null, "the stop-prompts setting turns it off");
});

test("a build in an earlier turn, or none at all, does not count", (t) => {
  const root = project(t);
  const transcript = path.join(root, "session.jsonl");
  fs.writeFileSync(transcript, [user("编译一下"), bash("latexmk -pdf main.tex"), toolResult(), say("好了"), user("下一步做什么？"), say("先看实验。"), ""].join("\n"));
  assert.equal(turnRebuiltManuscript(transcript), false);
  fs.writeFileSync(transcript, [user("跑一下评测"), bash("python eval.py --latex-table"), toolResult(), ""].join("\n"));
  assert.equal(turnRebuiltManuscript(transcript), false);
  assert.equal(turnRebuiltManuscript(path.join(root, "missing.jsonl")), false);
  assert.equal(stopHookOutput({ hook_event_name: "Stop", transcript_path: transcript }, root), null);
});

test("the cold read hands a fresh reader the compiled pages and nothing else", (t) => {
  const pdflatex = findExecutable("pdflatex", process.env);
  if (!pdflatex || !findExecutable("pdftotext", process.env) || !findExecutable("pdftoppm", process.env)) {
    t.skip("needs pdflatex and poppler");
    return;
  }
  const root = project(t);
  const scratch = path.join(root, "cold");
  fs.mkdirSync(path.join(root, "paper"));
  fs.writeFileSync(path.join(root, "paper/main.tex"), [
    "\\documentclass{article}",
    "\\begin{document}",
    "\\section{Introduction}",
    "We call the budget 256 setting the interface model.",
    "\\newpage",
    "\\section{Method}",
    "The own-image variant is described here.",
    "\\end{document}",
    ""
  ].join("\n"));
  const build = spawnSync(pdflatex, ["-interaction=nonstopmode", "-halt-on-error", "main.tex"], { cwd: path.join(root, "paper"), encoding: "utf8" });
  assert.equal(build.status, 0, build.stdout.slice(-400));
  const result = prepareColdRead(root, { pdf: "paper/main.pdf", venue: "CVPR 2026", env: { ...process.env, DOVE_COLD_READ_DIR: scratch }, now: Date.parse("2026-10-25T09:00:00Z") });
  assert.equal(result.documents[0].pages, 2);
  assert.ok(result.folder.startsWith(scratch), "materials stay outside the project");
  assert.match(result.body, /^# 冷读/u);
  assert.match(result.body, /投稿目标：CVPR 2026/u);
  assert.match(result.body, /不打开项目里的任何其他文件/u);
  assert.match(result.body, /行话清单/u);
  assert.ok(!result.body.includes("main.tex"), "the source is not offered");
  const pages = fs.readdirSync(path.join(result.folder, "main"));
  assert.deepEqual(pages.filter((name) => name.endsWith(".txt")).length, 2);
  assert.deepEqual(pages.filter((name) => name.endsWith(".png")).length, 2);
  assert.match(fs.readFileSync(path.join(result.folder, "main", pages.find((name) => name.endsWith("1.txt"))), "utf8"), /budget 256/u);
  assert.equal(readHookState(root).asked[COLD_READ_KEY], "2026-10-25T09:00:00.000Z");
  assert.ok(fs.existsSync(result.handoff));
});
