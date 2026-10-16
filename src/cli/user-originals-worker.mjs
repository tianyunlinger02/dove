import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

import { refreshUserOriginals, USER_ORIGINALS_BUDGET_MS } from "../core/user-originals.mjs";

const ENTRY = "__dove-user-originals";

// This private entry works both as a source module and inside the standalone
// CLI bundle. Exit before the normal CLI handles arguments; no extra installed
// worker file or public command is needed.
if (process.argv[2] === ENTRY) {
  try {
    const { root, ...options } = JSON.parse(process.argv[3]);
    const result = refreshUserOriginals(root, options);
    await new Promise((resolve) => process.stdout.write(`${JSON.stringify(result)}\n`, resolve));
    process.exit(0);
  } catch (error) {
    await new Promise((resolve) => process.stderr.write(`${error.message}\n`, resolve));
    process.exit(1);
  }
}

// Keep synchronous transcript/index parsing off the dashboard event loop.
// The scan retains its budget; startup and atomic output get a short grace
// period so a stuck filesystem cannot hold up every later project forever.
export function refreshUserOriginalsInBackground(root, { env = process.env, home = env.HOME, budgetMs = USER_ORIGINALS_BUDGET_MS } = {}) {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [fileURLToPath(import.meta.url), ENTRY, JSON.stringify({ root, home, budgetMs })], {
      env,
      timeout: budgetMs + 5000,
      killSignal: "SIGKILL",
      windowsHide: true
    }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr.trim() || error.message));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(error);
      }
    });
  });
}
