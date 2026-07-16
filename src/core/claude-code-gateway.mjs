import os from "node:os";
import path from "node:path";
import process from "node:process";

export function resolveClaudeConfigRoot(env = process.env) {
  return path.resolve(env.DOVE_CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude"));
}
