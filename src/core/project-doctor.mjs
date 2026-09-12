import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PACKAGE_RUNTIME_PATHS } from "./command-manifest.mjs";
import { PROJECT_HOST_IDS } from "./host-registry.mjs";
import { classifyPackageCompatibility } from "./package-metadata.mjs";
import { inspectProjectIntegration } from "./project-installation.mjs";
import { INSTALLATION_MANIFEST_PATH, readProjectInstallationManifest } from "./project-installation-manifest.mjs";
import { inspectResearchDocuments } from "./research-documents.mjs";
import { inspectProjectRoot, resolveProjectRootForSetup } from "./project-root.mjs";
import { classifyProjectSetup } from "./project-setup-classification.mjs";

const MODULE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PACKAGE_ROOT = path.resolve(MODULE_DIRECTORY, ["dist", "bin"].includes(path.basename(MODULE_DIRECTORY)) ? ".." : "../..");

function messageFor(error) {
  return error instanceof Error ? error.message : String(error);
}

function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function lstatOrNull(fsOps, targetPath) {
  try {
    return fsOps.lstatSync(targetPath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function regularNonSymlink(fsOps, targetPath) {
  const stat = lstatOrNull(fsOps, targetPath);
  return stat !== null && stat.isFile() && !stat.isSymbolicLink();
}

function inspectUserCli(options) {
  const fsOps = options.fsOps ?? fs;
  const packageRoot = path.resolve(options.packageRoot ?? DEFAULT_PACKAGE_ROOT);
  const runtimePaths = (options.packageRuntimePaths ?? PACKAGE_RUNTIME_PATHS).map((relativePath) => {
    const absolutePath = path.resolve(packageRoot, relativePath);
    const relative = path.relative(packageRoot, absolutePath);
    const contained = relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
    const healthy = contained && regularNonSymlink(fsOps, absolutePath);
    return { path: relativePath, healthy, state: healthy ? "current" : contained ? "missing-or-invalid" : "outside-package-root" };
  });
  const executablePath = path.resolve(options.executablePath ?? path.join(packageRoot, "bin/dove-package.mjs"));
  const executableRelative = path.relative(packageRoot, executablePath);
  const executableContained = executableRelative === "" || (!executableRelative.startsWith("..") && !path.isAbsolute(executableRelative));
  const executableHealthy = executableContained && regularNonSymlink(fsOps, executablePath);
  const executable = { path: executablePath, healthy: executableHealthy, state: executableHealthy ? "current" : "missing-or-invalid" };
  const healthy = runtimePaths.every((entry) => entry.healthy) && executable.healthy;
  return {
    healthy,
    state: healthy ? "healthy" : "unhealthy",
    package: { name: options.packageName ?? null, version: options.packageVersion ?? null, root: packageRoot },
    runtimePaths,
    executable,
    missing: runtimePaths.filter((entry) => !entry.healthy).map((entry) => entry.path)
  };
}

function manifestSummary(manifest) {
  return manifest ? {
    path: INSTALLATION_MANIFEST_PATH,
    revision: manifest.revision,
    package: manifest.package,
    runtime: manifest.runtime,
    hosts: [...manifest.hosts]
  } : null;
}

function inspectIntegration(start, options) {
  const project = inspectProjectRoot(start, { fsOps: options.fsOps, hostIds: PROJECT_HOST_IDS });
  if (!project.initialized) return { healthy: false, state: project.state, start: project.start, root: project.root, error: project.error, manifest: null, missing: [], drifted: [] };
  let manifest;
  try {
    manifest = readProjectInstallationManifest(project.root, { fsOps: options.fsOps, hostIds: PROJECT_HOST_IDS });
  } catch (error) {
    return {
      healthy: false,
      state: "blocked",
      start: project.start,
      root: project.root,
      error: messageFor(error),
      manifest: null,
      missing: [],
      drifted: []
    };
  }
  if (options.packageName !== undefined && options.packageVersion !== undefined) {
    const compatibility = classifyPackageCompatibility(manifest.package, { name: options.packageName, version: options.packageVersion });
    if (["identity-mismatch", "newer", "invalid-version"].includes(compatibility)) {
      return { healthy: false, state: "blocked", start: project.start, root: project.root, error: "Dove project integration package is incompatible with the running CLI.", manifest: manifestSummary(manifest), packageCompatibility: compatibility, missing: [], drifted: [] };
    }
  }
  try {
    const canonical = (options.inspectCurrentIntegration ?? inspectProjectIntegration)(project.root, {
      packageName: options.packageName ?? manifest.package.name,
      packageVersion: options.packageVersion ?? manifest.package.version,
      fsOps: options.fsOps
    });
    return {
      healthy: canonical.status === "current",
      state: canonical.status,
      start: project.start,
      root: project.root,
      error: null,
      manifest: manifestSummary(manifest),
      needsUpdate: canonical.status === "needs-update",
      updatePaths: [...canonical.changedPaths],
      skippedLocalEdits: [...(canonical.skippedLocalEdits ?? [])],
      replacedLocalEdits: [...(canonical.replacedLocalEdits ?? [])],
      retiredHooks: canonical.retiredHooks ?? null,
      missing: [],
      drifted: [...(canonical.skippedLocalEdits ?? [])]
    };
  } catch (error) {
    const message = messageFor(error);
    return {
      healthy: false,
      state: "blocked",
      start: project.start,
      root: project.root,
      error: message,
      manifest: manifestSummary(manifest),
      missing: [],
      drifted: []
    };
  }
}

function researchState(root, options) {
  if (!root) return { healthy: false, state: "unavailable", mode: "unavailable", error: "Project root is unavailable." };
  try {
    const inspected = (options.inspectResearchDocuments ?? inspectResearchDocuments)(root, { fsOps: options.fsOps });
    if (!plainObject(inspected)) throw new Error("Research document inspection returned an invalid result.");
    const mode = inspected.state === "absent"
      ? "absent"
      : inspected.state === "previous-research-format"
        ? "previous-research-format"
        : inspected.healthy === true
          ? "current"
          : "invalid";
    return { ...inspected, mode, healthy: inspected.healthy === true };
  } catch (error) {
    return { healthy: false, state: "invalid", mode: "invalid", error: messageFor(error) };
  }
}

function actionsFor(result) {
  if (result.setup.mode === "uninitialized") return [{ kind: "init", command: "dove init" }];
  if (result.setup.mode === "needs-update") return [{ kind: "update", command: "dove update" }];
  if (result.setup.mode === "blocked" || result.projectIntegration.retiredHooks?.matchedPaths.length > 0) {
    return [{ kind: "inspect", command: "dove doctor --json" }];
  }
  return [];
}

export function inspectProjectDoctor(start, options = {}) {
  const userCli = inspectUserCli(options);
  let setupRoot = null;
  try { setupRoot = resolveProjectRootForSetup(start, { fsOps: options.fsOps }); } catch { setupRoot = typeof start === "string" ? path.resolve(start) : null; }
  const projectIntegration = inspectIntegration(start, options);
  const safeRoot = projectIntegration.root ?? setupRoot;
  const workspaceState = researchState(safeRoot, options);
  const setup = classifyProjectSetup({ projectIntegration });
  const staticChecksPassed = userCli.healthy
    && projectIntegration.healthy
    && workspaceState.healthy;
  const result = {
    staticChecksPassed,
    state: staticChecksPassed ? "static-checks-passed" : "attention",
    target: safeRoot,
    userCli,
    projectIntegration,
    workspaceState,
    setup
  };
  result.actions = actionsFor(result);
  return result;
}
