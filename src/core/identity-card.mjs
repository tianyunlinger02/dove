import fs from "node:fs";

import { openRootedFilesystem } from "./rooted-filesystem.mjs";

export const DOVE_IDENTITY_CARD_PATH = ".dove/research/IDENTITY.md";
const MAX_CARD_BYTES = 4096;

function readCard(project, options) {
  if (!project) return null;
  try {
    const root = openRootedFilesystem(project, { fsOps: options.fsOps ?? fs });
    const bytes = root.readFile(DOVE_IDENTITY_CARD_PATH);
    const truncated = bytes.length > MAX_CARD_BYTES;
    const text = new TextDecoder("utf-8", { fatal: true })
      .decode(bytes.subarray(0, MAX_CARD_BYTES), { stream: truncated }).trim();
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
  const pattern = new RegExp(`^\\s*(?:[-*]\\s*)?\\**\\s*${name}[^:：\\n*]{0,20}\\**\\s*[:：]\\s*(.+)$`, "imu");
  return card.match(pattern)?.[1]?.trim() ?? null;
}

export function parseDoveCurrentRound(card = "") {
  const value = cardField(card, "Current round");
  const status = cardField(card, "Round status");
  if (!value) return null;
  const brief = value.match(/rounds\/[^\s)\]，。；;]+\.md/u)?.[0] ?? value.replace(/^\[([^\]]+)\]\([^)]*\).*$/u, "$1");
  return { brief, ongoing: /^\**\s*(ongoing|进行中)/iu.test(status ?? "") };
}

export function identityCardContext(project, options = {}) {
  const card = readCard(project, options);
  if (!card) return `No readable short identity card at ${DOVE_IDENTITY_CARD_PATH}. Do not infer a mainline from old notes. Create one for a confirmed goal when writing is permitted.`;
  const reminder = card.truncated ? "\nIdentity card exceeds 4KB; the beginning is shown, not a missing card. Read the full card when needed and shorten it without changing Mainline; keep round details in rounds/ and measurements in EVAL.md." : "";
  return `Project identity card (researcher-owned; corrections affect only relevant fields, not an unchanged Mainline):\n${card.text}${reminder}`;
}
