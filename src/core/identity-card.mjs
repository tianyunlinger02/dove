import fs from "node:fs";

import { openRootedFilesystem } from "./rooted-filesystem.mjs";

export const DOVE_IDENTITY_CARD_PATH = ".dove/research/IDENTITY.md";
const MAX_CARD_BYTES = 4096;
const CARD_FIELD = /^[ \t]*(?:[-*][ \t]*)?\**[ \t]*(Current round|Round status|Mainline|Research scope|研究范围|Core capability|Target tier|Deployment inputs\/outputs|Completion|User restrictions|Recent corrections|Research state|研究状态|Method design)[^:：\r\n*]{0,20}\**[ \t]*[:：][ \t]*(.*)$/iu;

function readCard(project, options, full = false) {
  if (!project) return null;
  try {
    const root = openRootedFilesystem(project, { fsOps: options.fsOps ?? fs });
    const bytes = root.readFile(DOVE_IDENTITY_CARD_PATH);
    const truncated = bytes.length > MAX_CARD_BYTES;
    const text = new TextDecoder("utf-8", { fatal: true })
      .decode(full ? bytes : bytes.subarray(0, MAX_CARD_BYTES), { stream: !full && truncated }).trim();
    return text ? { text, truncated } : null;
  } catch {
    return null;
  }
}

export function readDoveIdentityCard(project, options = {}) {
  return readCard(project, options)?.text ?? null;
}

// Card fields may be written as "Field: value", "- Field: value" or "- **Field（说明）**：value".
export function cardField(card, name) {
  const pattern = new RegExp(`^[ \\t]*(?:[-*][ \\t]*)?\\**[ \\t]*${name}[^:：\\r\\n*]{0,20}\\**[ \\t]*[:：][ \\t]*([^\\r\\n]*)\\r?$`, "imu");
  return card.match(pattern)?.[1]?.trim() || null;
}

export function parseDoveCurrentRound(card = "") {
  const value = cardField(card, "Current round");
  const status = cardField(card, "Round status");
  if (!value) return null;
  const brief = value.match(/rounds\/[^\s)\]，。；;]+\.md/u)?.[0] ?? value.replace(/^\[([^\]]+)\]\([^)]*\).*$/u, "$1");
  return { brief, ongoing: /^\**\s*(?:ongoing|进行中)(?=$|[^\p{L}\p{M}\p{N}_-])/iu.test(status ?? "") };
}

function separateResearchState(card) {
  const lines = card.split(/\r?\n/u);
  const start = lines.findIndex((line) => /^(Research state|研究状态)$/iu.test(line.match(CARD_FIELD)?.[1] ?? ""));
  if (start === -1) return { state: "", rest: card };
  let end = start + 1;
  while (end < lines.length && !CARD_FIELD.test(lines[end])) end += 1;
  return {
    state: [lines[start].match(CARD_FIELD)[2], ...lines.slice(start + 1, end)].join("\n").trim(),
    rest: [...lines.slice(0, start), ...lines.slice(end)].join("\n").trim()
  };
}

export function identityCardContext(project, options = {}) {
  // The public reader keeps its 4 KiB prefix contract; hooks locate state in the
  // complete card before bounding the other fields. Neither path writes a card.
  const card = readCard(project, options, true);
  if (!card) return `未读到身份卡 ${DOVE_IDENTITY_CARD_PATH}。要接着做研究时，从项目已有说明、代码、结果和用户原话起草身份卡，主线和核心能力先标暂定，请用户确认一次；旧笔记只作线索，不当作用户确认。还没有主线就先选题。`;
  const { state, rest } = separateResearchState(card.text);
  const otherBytes = Buffer.from(rest);
  const otherFields = new TextDecoder().decode(otherBytes.subarray(0, MAX_CARD_BYTES), { stream: otherBytes.length > MAX_CARD_BYTES }).trim();
  const lines = [
    "项目身份卡（研究者维护；只更正相关字段，不改写未变的 Mainline）：",
    state ? `研究状态（原卡原文）：\n${state}` : "研究状态：原卡未填写；下次请导师判断时由导师写，不从其他字段臆造。"
  ];
  if (otherFields) lines.push("其余身份卡字段：", otherFields);
  if (card.truncated) lines.push(`身份卡超过 4KB；研究状态已从完整原卡提取，其余字段只展示前 4KB，全文见 ${DOVE_IDENTITY_CARD_PATH}。方法设计留在 Method design 指向的说明里，过程细节移到普通项目文件，卡上只留字段本身。`);
  return lines.join("\n");
}
