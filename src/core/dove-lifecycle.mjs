import fs from "node:fs";
import path from "node:path";

import {
  adoptProjectIntegration,
  completeReinstallProjectIntegration,
  previewProjectUninstall,
  uninstallProjectIntegration,
  updateProjectIntegration
} from "./project-installation.mjs";
import { INSTALLATION_MANIFEST_PATH } from "./project-installation-manifest.mjs";
import { resolveProjectRootForSetup } from "./project-root.mjs";

function publicUpdateResult(result) {
  return {
    ...result,
    status: result.status === "unchanged" || result.status === "adopted" ? result.status : "updated"
  };
}

function lstatOrNull(fsOps, targetPath) {
  try {
    return fsOps.lstatSync(targetPath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function hasCurrentManifest(root, fsOps) {
  return lstatOrNull(fsOps, path.join(root, INSTALLATION_MANIFEST_PATH)) !== null;
}

export function updateDoveLifecycle(start, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const root = resolveProjectRootForSetup(start, { fsOps });
  return publicUpdateResult(hasCurrentManifest(root, fsOps)
    ? updateProjectIntegration(root, options)
    : adoptProjectIntegration(root, options));
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
