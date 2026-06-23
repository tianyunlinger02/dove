import { cleanupTempWorkspace, createTempWorkspace } from "../../scripts/temp-workspace.mjs";

const roots = new Set();
let cleanupRegistered = false;

function cleanupAll() {
  for (const root of roots) {
    cleanupTempWorkspace(root);
  }
  roots.clear();
}

function registerCleanup() {
  if (cleanupRegistered) {
    return;
  }
  cleanupRegistered = true;
  process.once("exit", cleanupAll);
}

export function createTempRoot(prefix = "dove-test-") {
  registerCleanup();
  const root = createTempWorkspace(prefix);
  roots.add(root);
  return root;
}

export function cleanupTempRoot(root) {
  roots.delete(root);
  cleanupTempWorkspace(root);
}
