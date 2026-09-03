import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PACKAGE_RUNTIME_PATHS } from "./command-manifest.mjs";
import { PROJECT_HOST_IDS } from "./host-registry.mjs";
import { classifyPackageCompatibility } from "./package-metadata.mjs";
import { inspectProjectIntegration, previewProjectAdoption } from "./project-installation.mjs";
import { INSTALLATION_MANIFEST_PATH, LEGACY_INSTALLATION_MANIFEST_PATH, readProjectInstallationManifest, readProjectInstallationManifestForMigration } from "./project-installation-manifest.mjs";
import { inspectResearchDocuments } from "./research-documents.mjs";
import { inspectProjectRoot, resolveProjectRootForSetup } from "./project-root.mjs";
import { classifyProjectSetup } from "./project-setup-classification.mjs";

const MODULE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PACKAGE_ROOT = path.resolve(MODULE_DIRECTORY, "../..");

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
      state: "invalid",
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
      return { healthy: false, state: "invalid", start: project.start, root: project.root, error: "Dove project integration package is incompatible with the running CLI.", manifest: manifestSummary(manifest), packageCompatibility: compatibility, missing: [], drifted: [] };
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
      needsSync: canonical.status === "needs-sync",
      syncPaths: [...canonical.changedPaths],
      missing: [],
      drifted: []
    };
  } catch (error) {
    const message = messageFor(error);
    return {
      healthy: false,
      state: /ownership drift/iu.test(message) ? "drifted" : "invalid",
      start: project.start,
      root: project.root,
      error: message,
      manifest: manifestSummary(manifest),
      missing: [],
      drifted: []
    };
  }
}

function inspectMigration(root, options) {
  const fsOps = options.fsOps ?? fs;
  const current = lstatOrNull(fsOps, path.join(root, INSTALLATION_MANIFEST_PATH));
  const legacy = lstatOrNull(fsOps, path.join(root, LEGACY_INSTALLATION_MANIFEST_PATH));
  const migrationPath = legacy ? LEGACY_INSTALLATION_MANIFEST_PATH : current ? INSTALLATION_MANIFEST_PATH : null;
  const result = (state, fields = {}) => ({ state, root, markerPath: migrationPath, ...fields });
  if (current && legacy) return result("conflicting-manifests", { error: "Dove found both current and 1.0 installation manifests." });
  if (!legacy && !current) {
    const legacyDirectory = lstatOrNull(fsOps, path.join(root, ".dove-install"));
    return legacyDirectory ? result("invalid-legacy", { error: "Dove found an incomplete 1.0 installation directory." }) : result("absent", { error: null });
  }
  if (current) {
    try {
      readProjectInstallationManifest(root, { fsOps, hostIds: PROJECT_HOST_IDS });
      return result("absent", { markerPath: null, error: null });
    } catch {
      // A current-path 1.0 manifest is classified only by the explicit migration reader below.
    }
  }
  try {
    const manifest = readProjectInstallationManifestForMigration(root, { fsOps, hostIds: PROJECT_HOST_IDS, manifestPath: migrationPath });
    return result("valid-legacy", { error: null, manifest: { path: migrationPath, revision: manifest.revision, package: manifest.package, runtime: manifest.runtime, hosts: [...manifest.hosts] } });
  } catch (error) {
    return result("invalid-legacy", { error: messageFor(error) });
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

function adoptionState(root, options) {
  if (!root) return { state: "absent", ready: false, preview: null, error: "Project root is unavailable." };
  try {
    const preview = (options.previewProjectAdoption ?? previewProjectAdoption)(root, {
      fsOps: options.fsOps,
      packageName: options.packageName,
      packageVersion: options.packageVersion
    });
    return { state: "adoptable", ready: true, preview, error: null };
  } catch (error) {
    return { state: "absent", ready: false, preview: null, error: messageFor(error) };
  }
}

function actionsFor(result) {
  const actions = [];
  const adoptReady = result.adoption.state === "adoptable";
  if (adoptReady) actions.push({ kind: "update", command: "dove update" });
  if (!adoptReady && result.setup.mode === "init") actions.push({ kind: "init", command: "dove init" });
  else if (!adoptReady && result.projectIntegration.state === "needs-sync") actions.push({ kind: "update", command: "dove update" });
  else if (!adoptReady && result.setup.mode === "reinstall" && result.projectIntegration.state !== "current") actions.push({ kind: "reinstall", command: "dove reinstall" });
  else if (!adoptReady && result.setup.mode === "blocked") actions.push({ kind: "inspect", command: "dove doctor --json" });
  return actions;
}

export function inspectProjectDoctor(start, options = {}) {
  const userCli = inspectUserCli(options);
  let setupRoot = null;
  try { setupRoot = resolveProjectRootForSetup(start, { fsOps: options.fsOps }); } catch { setupRoot = typeof start === "string" ? path.resolve(start) : null; }
  const projectIntegration = inspectIntegration(start, options);
  const safeRoot = projectIntegration.root ?? setupRoot;
  const migrationInstallation = safeRoot ? inspectMigration(safeRoot, options) : { state: "absent", root: null, error: "Project root is unavailable." };
  const workspaceState = researchState(safeRoot, options);
  const adoption = safeRoot ? adoptionState(safeRoot, options) : { state: "absent", ready: false, preview: null, error: "Project root is unavailable." };
  const setup = classifyProjectSetup({ projectIntegration, migrationInstallation, workspaceState, adoption });
  const staticChecksPassed = userCli.healthy
    && projectIntegration.healthy
    && workspaceState.healthy;
  const result = {
    staticChecksPassed,
    state: staticChecksPassed ? "static-checks-passed" : "attention",
    target: safeRoot,
    userCli,
    projectIntegration,
    migrationInstallation,
    workspaceState,
    adoption,
    setup
  };
  result.actions = actionsFor(result);
  return result;
}
