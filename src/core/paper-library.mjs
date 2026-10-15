import fs from "node:fs";
import path from "node:path";

const LIBRARY = ".dove/research/papers/library";
const IMPACT_LABELS = { overlap: "撞题", baseline: "新基线", borrow: "可借用" };

export function readPaperLibrary(root) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, `${LIBRARY}.json`), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return { papers: [] };
    throw error;
  }
}

export function groupPaperLibrary(papers) {
  const groups = new Map();
  for (const paper of papers) {
    const direction = paper.direction || "待归类";
    if (!groups.has(direction)) groups.set(direction, []);
    groups.get(direction).push(paper);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b, "zh-CN"))
    .map(([direction, items]) => ({ direction, papers: items.sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")) || a.id.localeCompare(b.id)) }));
}

const markdown = (value) => String(value ?? "").replace(/[\r\n]+/gu, " ").replace(/[\\`*\[\]<>]/gu, "\\$&");

export function renderPaperLibrary(papers) {
  const lines = ["# 项目文献库", "", "按方向累积已判为新基线、可借用或撞题的追踪论文。一句话由导师或主会话据摘要提供，不代表读过全文；正文问答另存同目录的论文笔记。", ""];
  for (const group of groupPaperLibrary(papers)) {
    lines.push(`## ${markdown(group.direction)}`, "");
    for (const paper of group.papers) {
      const title = markdown(paper.title || paper.id);
      const metadata = [paper.authors?.length ? paper.authors.join(", ") : null, paper.venue, paper.arxivId ? `arXiv ${paper.arxivId}` : null, paper.date].filter(Boolean);
      lines.push(`- **${paper.url ? `[${title}](<${paper.url}>)` : title}** · ${markdown(paper.id)}`,
        `  ${markdown(paper.line || "中文一句话待据摘要补充。")}`, `  ${metadata.map(markdown).join(" · ")}`,
        `  ${IMPACT_LABELS[paper.impact]}：${markdown(paper.note)}${paper.impactFile ? `（${markdown(paper.impactFile)}）` : ""}`, "");
    }
  }
  return `${lines.join("\n")}\n`;
}

const bibtexText = (value) => String(value).replace(/\s+/gu, " ").replace(/[\\{}%&#_$~^]/gu, (char) => ({ "\\": "\\textbackslash{}", "~": "\\textasciitilde{}", "^": "\\textasciicircum{}" }[char] ?? `\\${char}`));

// Unknown fields stay absent. A venue name alone does not establish a conference.
export function exportPaperBibtex(papers) {
  return [...new Map(papers.map((paper) => [paper.id, paper])).values()].map((paper) => {
    const type = paper.kind === "conference" ? "inproceedings" : paper.kind === "journal" ? "article" : "misc";
    const fields = { title: paper.title };
    if (paper.authors?.length) fields.author = paper.authors.join(" and ");
    const year = String(paper.date ?? "").match(/^(\d{4})(?:-|$)/u)?.[1];
    if (year) fields.year = year;
    if (paper.venue) fields[type === "inproceedings" ? "booktitle" : type === "article" ? "journal" : "howpublished"] = paper.venue;
    if (paper.arxivId) Object.assign(fields, { eprint: paper.arxivId, archivePrefix: "arXiv" });
    if (paper.url) fields.url = paper.url;
    const key = `dove:${paper.id.replace(/[^a-zA-Z0-9.:-]/gu, "-")}`;
    return `@${type}{${key},\n${Object.entries(fields).filter(([, value]) => value).map(([name, value]) => `  ${name} = {${name === "url" ? String(value).replace(/[{}]/gu, "\\$&") : bibtexText(value)}}`).join(",\n")}\n}`;
  }).join("\n\n") + (papers.length ? "\n" : "");
}

// Called only by the watch runner or the explicit dashboard accumulation action.
// These two projections never overwrite papers/<id>.md reading notes.
export function writePaperLibrary(root, papers) {
  const library = { papers };
  for (const [extension, content] of [["json", `${JSON.stringify(library, null, 2)}\n`], ["md", renderPaperLibrary(papers)]]) {
    const file = path.join(root, `${LIBRARY}.${extension}`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, content);
    fs.renameSync(temporary, file);
  }
  return library;
}
