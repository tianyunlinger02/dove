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

export function parseDoveCurrentRound(card = "") {
  const brief = card.match(/^Current round:[ \t]*(.+)$/mu)?.[1]?.trim();
  const status = card.match(/^Round status:[ \t]*(.+)$/mu)?.[1]?.trim();
  return brief ? { brief, ongoing: /^(ongoing|进行中)$/iu.test(status ?? "") } : null;
}

export function identityCardContext(project, options = {}) {
  const card = readCard(project, options);
  if (!card) return `No readable short identity card at ${DOVE_IDENTITY_CARD_PATH}. Do not infer a mainline from old notes. Create one for a confirmed goal when writing is permitted.`;
  const reminder = card.truncated ? "\nIdentity card exceeds 4KB; the beginning is shown, not a missing card. Read the full card when needed and shorten it without changing Mainline; keep round details in rounds/ and measurements in EVAL.md." : "";
  return `Project identity card (researcher-owned; corrections affect only relevant fields, not an unchanged Mainline):\n${card.text}${reminder}`;
}
