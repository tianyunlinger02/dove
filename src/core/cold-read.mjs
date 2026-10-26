import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { findExecutable } from "./figure-generation.mjs";
import { updateHookState } from "./hook-state.mjs";

// A cold read: the compiled manuscript, and nothing else, for a reader who has
// never seen the project. Authors cannot see their own jargon after weeks in a
// project, and a reviewer handed the source, the readouts and the background
// reads as a developer and checks numbers. Dove turns the PDF into page text
// and page images in a temporary folder outside the project and writes the
// body the host passes, unchanged, to a fresh review agent.

export const COLD_READ_KEY = "coldread:last";
const PAGE_DPI = 100;

function pad(number, width) {
  return String(number).padStart(width, "0");
}

function folderFor(root, env) {
  const base = env.DOVE_COLD_READ_DIR || path.join(os.tmpdir(), "dove-cold-read");
  return path.join(base, `${path.basename(root)}-${createHash("sha256").update(root).digest("hex").slice(0, 8)}`);
}

function preparePdf(pdf, target, tools) {
  const stem = path.basename(pdf, path.extname(pdf));
  const folder = path.join(target, stem);
  fs.mkdirSync(folder, { recursive: true });
  const text = spawnSync(tools.pdftotext, ["-layout", pdf, "-"], { encoding: "utf8", maxBuffer: 64 << 20, timeout: 300000 });
  if (text.status !== 0) throw new Error(`pdftotext could not read ${pdf}: ${(text.stderr || "").trim().slice(0, 300)}`);
  // pdftotext separates pages with form feeds; a trailing one ends the last page.
  const pages = text.stdout.split("\f");
  if (pages.length > 1 && !pages.at(-1).trim()) pages.pop();
  const width = String(pages.length).length;
  pages.forEach((page, index) => fs.writeFileSync(path.join(folder, `page-${pad(index + 1, width)}.txt`), page));
  const render = spawnSync(tools.pdftoppm, ["-png", "-r", String(PAGE_DPI), pdf, path.join(folder, "page")], { encoding: "utf8", timeout: 600000 });
  if (render.status !== 0) throw new Error(`pdftoppm could not render ${pdf}: ${(render.stderr || "").trim().slice(0, 300)}`);
  const images = fs.readdirSync(folder).filter((name) => /^page-\d+\.png$/u.test(name)).sort((left, right) => Number(left.match(/\d+/u)[0]) - Number(right.match(/\d+/u)[0]));
  return { pdf, stem, folder, pages: pages.length, texts: pages.map((_, index) => path.join(folder, `page-${pad(index + 1, width)}.txt`)), images: images.map((name) => path.join(folder, name)) };
}

function renderBody(prepared, options) {
  const lines = [
    "# 冷读：第一次读这篇稿子的读者",
    "",
    "你从没接触过这个项目，只拿到下面这份编译好的稿件。像审稿人第一次拿到它那样从头读，只看这里列出的逐页文字和页面图片；不打开项目里的任何其他文件（tex 源码、结果、记录、笔记都不看），也不联网查。读不懂的地方正是要报告的地方，不要去别处找答案。",
    ""
  ];
  if (options.venue) lines.push(`投稿目标：${options.venue}`, "");
  for (const item of prepared) {
    lines.push(`## ${path.basename(item.pdf)}（共 ${item.pages} 页）`, "");
    lines.push(`- 逐页文字：${item.folder}/page-*.txt（${path.basename(item.texts[0] ?? "")} 到 ${path.basename(item.texts.at(-1) ?? "")}）`);
    lines.push(`- 页面图片：${item.folder}/page-*.png（看图、图里的字和版面）`, "");
  }
  lines.push(
    "读完用中文返回，引用原文时保留英文原句并注明页码：",
    "",
    "1. 读完第一页，用一两句话说这篇论文解决什么问题、新在哪里、主要结果是什么；读完全文，再列你认为它有哪几条贡献。",
    "2. 行话清单：第一次出现时没有定义、定义得太晚，或者听起来像项目内部说法的词（内部代号、配置名、没解释的缩写和数字设定）；正文、图里的标签和图例、表头都算。每个注明是这个领域的通用说法还是像项目内部的说法，内部说法排在前面；逐个给出页码、原句、你猜它指什么、外行可能怎么误解。",
    "3. 读不懂或要读两遍的地方：页码、原句、卡在哪里。",
    "4. 防御性措辞：反复出现的限定、免责和找补，摘要或段落结尾落在局限上的地方，同一个限定说了几次。",
    "5. 稿内一致性：同一量、符号、数字、成功定义或引用是否前后矛盾；只列稿内可见的疑点，不猜哪一个是真的。",
    "6. 图表：只看图和图注能不能懂；这个尺寸下看不清的字，没解释的符号、颜色或缩写，与正文不同名或不同符号的标签。",
    "7. 版面：空栏、大片空白、离第一次提到超过一页或排到结论后的图表；结论末行所在页，不只查标题。",
    "8. 如果你是审稿人，最想问作者的三个问题。",
    "",
    "按影响排序，分列‘必须改’和‘可改可不改’；没有必须改就明确写无。每条给页码、原句、问题和可行替换或改法。事实与数字疑点另列，交掌握原始读数的一方核查；你不读读数、不验证实验真假，也不把疑点当事实。‘看不懂’要明确指出稿子哪处须改，不要求作者在稿外向你补背景；建议增加限定时说明为什么必要，不惯性削弱有据强项。作者处理后会用重新编译的稿件交给新的读者再冷读。"
  );
  return `${lines.join("\n")}\n`;
}

/** Options: pdf (one or more paths), venue, env, now. */
export function prepareColdRead(projectRoot, options = {}) {
  const env = options.env ?? process.env;
  const root = path.resolve(projectRoot);
  const pdfs = [].concat(options.pdf ?? []).map((item) => path.resolve(root, String(item)));
  if (!pdfs.length) throw new Error("Give the compiled manuscript: --pdf <paper.pdf> (repeat for the supplement).");
  for (const pdf of pdfs) {
    if (!/\.pdf$/iu.test(pdf) || !fs.existsSync(pdf)) throw new Error(`Not a compiled PDF: ${pdf}`);
  }
  const tools = { pdftotext: findExecutable("pdftotext", env), pdftoppm: findExecutable("pdftoppm", env) };
  if (!tools.pdftotext || !tools.pdftoppm) throw new Error("pdftotext and pdftoppm (poppler) are needed for a cold read.");
  const folder = folderFor(root, env);
  fs.rmSync(folder, { recursive: true, force: true });
  fs.mkdirSync(folder, { recursive: true });
  const prepared = pdfs.map((pdf) => preparePdf(pdf, folder, tools));
  const body = renderBody(prepared, options);
  fs.writeFileSync(path.join(folder, "handoff.md"), body);
  const at = new Date(options.now ?? Date.now()).toISOString();
  updateHookState(root, (state) => {
    state.asked[COLD_READ_KEY] = at;
  }, options);
  return { status: "prepared", folder, handoff: path.join(folder, "handoff.md"), documents: prepared.map((item) => ({ pdf: item.pdf, pages: item.pages, folder: item.folder })), body };
}
