import fs from "node:fs";

import { openRootedFilesystem } from "./rooted-filesystem.mjs";

export const DOVE_IDENTITY_CARD_PATH = ".dove/research/IDENTITY.md";
const MAX_CARD_BYTES = 4096;

export function readDoveIdentityCard(project, options = {}) {
  if (!project) return null;
  const fsOps = options.fsOps ?? fs;
  try {
    const root = openRootedFilesystem(project, { fsOps });
    const stat = root.inspectRegularFile(DOVE_IDENTITY_CARD_PATH);
    if (stat.size > MAX_CARD_BYTES) return null;
    const text = new TextDecoder("utf-8", { fatal: true }).decode(root.readFile(DOVE_IDENTITY_CARD_PATH)).trim();
    return text || null;
  } catch {
    return null;
  }
}

export function identityCardContext(project, options = {}) {
  const card = readDoveIdentityCard(project, options);
  return card ? `Project identity card (researcher-owned; check against the user's latest correction):\n${card}` : `No readable short identity card at ${DOVE_IDENTITY_CARD_PATH}. Do not infer a mainline from old notes or developer test prompts; if the card is too long, shorten it. Create one for a user-confirmed open goal or a material user correction when writing is permitted; leave an unconfirmed Mainline unknown.`;
}
