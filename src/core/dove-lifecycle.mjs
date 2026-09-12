import fs from "node:fs";

import {
  completeReinstallProjectIntegration,
  previewProjectUninstall,
  uninstallProjectIntegration,
  updateProjectIntegration
} from "./project-installation.mjs";
import { resolveProjectRootForSetup } from "./project-root.mjs";

export function updateDoveLifecycle(start, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const root = resolveProjectRootForSetup(start, { fsOps });
  return updateProjectIntegration(root, options);
}

export function completeReinstallDoveLifecycle(start, options = {}) {
  if (options.confirmed !== true) throw new Error("Complete Reinstall requires confirmed: true.");
  return completeReinstallProjectIntegration(start, options);
}

export function previewUninstallDoveLifecycle(start, options = {}) {
  return previewProjectUninstall(start, options);
}

export function uninstallDoveLifecycle(start, options = {}) {
  if (options.confirmed !== true) throw new Error("Dove uninstall requires confirmed: true.");
  return uninstallProjectIntegration(start, options);
}
