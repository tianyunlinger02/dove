import fs from "node:fs";
import path from "node:path";

const DEFAULT_TEMP_BASE = path.join(process.cwd(), ".claude", "tmp", "dove-workspaces");

export function resolveTempWorkspaceBase() {
  return path.resolve(process.env.DOVE_TEMP_ROOT || process.env.DOVE_TEST_TMPDIR || DEFAULT_TEMP_BASE);
}

export function createTempWorkspace(prefix = "dove-workspace-") {
  const base = resolveTempWorkspaceBase();
  fs.mkdirSync(base, { recursive: true });
  return fs.mkdtempSync(path.join(base, prefix));
}

export function cleanupTempWorkspace(root) {
  if (root) {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
