import fs from "node:fs";
import path from "node:path";

import { writeFileSetTransaction } from "./file-set-transaction.mjs";
import { PROJECT_HOST_IDS, normalizeHostSelection } from "./host-registry.mjs";
import {
  INSTALLATION_MANIFEST_PATH,
  readProjectInstallationManifest
} from "./project-installation-manifest.mjs";
import {
  assertManagedOwnership,
  inspectRegularProjectFile,
  planJsonFragments,
  planResource,
  preparePlan,
  transactionDelete
} from "./project-installation-plan.mjs";
import { compareManaged } from "./project-installation-resources.mjs";
import { resolveInstalledProjectRoot, resolveProjectRootForInit } from "./project-root.mjs";
import { prepareResearchDefaults } from "./research-defaults.mjs";

function exactTimestamp(value) {
  if (value === undefined) return new Date().toISOString();
  const timestamp = value instanceof Date ? value.toISOString() : value;
  if (typeof timestamp !== "string" || new Date(timestamp).toISOString() !== timestamp) throw new Error("Project integration now must be a Date or exact ISO timestamp.");
  return timestamp;
}

function assertPackageInput(packageName, packageVersion, { required }) {
  if (!required && packageName === undefined && packageVersion === undefined) return;
  if (typeof packageName !== "string" || !packageName || packageName !== packageName.trim() || packageName.includes("\0")) throw new Error("Project integration packageName must be a non-empty trimmed string.");
  if (typeof packageVersion !== "string" || !packageVersion || packageVersion !== packageVersion.trim()) throw new Error("Project integration packageVersion must be a semantic version string.");
}

function normalizeSelectedHosts(raw, { defaultWhenEmpty }) {
  if (Array.isArray(raw) && raw.length === 0) throw new Error("Dove project integration requires at least one host.");
  const hosts = normalizeHostSelection(raw, { defaultWhenEmpty, requireInitializable: true });
  if (hosts.length === 0) throw new Error("Dove project integration requires at least one host.");
  return [...hosts];
}

function resultFromTransaction(status, target, hosts, manifest, transaction, details = {}) {
  return {
    status,
    target,
    hosts: [...hosts],
    writtenPaths: [...transaction.writtenPaths],
    removedPaths: [...transaction.removedPaths],
    changedPaths: [...transaction.changedPaths],
    cleanupWarnings: [...transaction.cleanupWarnings],
    omittedCleanupWarningCount: transaction.omittedCleanupWarningCount,
    skippedLocalEdits: [...(details.skippedLocalEdits ?? [])],
    replacedLocalEdits: [...(details.replacedLocalEdits ?? [])],
    manifest
  };
}

function transactionOptions(fsOps, options = {}) {
  return { ...options, fsOps };
}

export function initializeProjectIntegration(rootOrProject, options = {}) {
  const fsOps = options.fsOps ?? fs;
  assertPackageInput(options.packageName, options.packageVersion, { required: true });
  const hosts = normalizeSelectedHosts(options.hosts, { defaultWhenEmpty: true });
  const now = exactTimestamp(options.now);
  const root = resolveProjectRootForInit(rootOrProject, { fsOps, hostIds: PROJECT_HOST_IDS });
  const plan = preparePlan({ root, hosts, packageName: options.packageName, packageVersion: options.packageVersion, now, fsOps });
  plan.entries.push(...prepareResearchDefaults(root, { fsOps }).entries);
  return resultFromTransaction(
    "initialized",
    root,
    hosts,
    plan.manifest,
    writeFileSetTransaction(plan.entries, transactionOptions(fsOps))
  );
}

function prepareInstalledPlan(start, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const root = resolveInstalledProjectRoot(start, { fsOps, hostIds: PROJECT_HOST_IDS });
  const manifest = readProjectInstallationManifest(root, { fsOps, hostIds: PROJECT_HOST_IDS });
  const hosts = options.hosts === undefined ? [...manifest.hosts] : normalizeSelectedHosts(options.hosts, { defaultWhenEmpty: false });
  const packageName = options.packageName ?? manifest.package.name;
  const packageVersion = options.packageVersion ?? manifest.package.version;
  assertPackageInput(packageName, packageVersion, { required: true });
  const plan = preparePlan({ root, hosts, packageName, packageVersion, now: exactTimestamp(options.now), fsOps, manifest, replacementPolicy: options.replacementPolicy ?? "safe" });
  return { fsOps, root, hosts, currentManifest: manifest, ...plan };
}

export function updateProjectIntegration(start, options = {}) {
  const prepared = prepareInstalledPlan(start, { ...options, replacementPolicy: "explicit-update" });
  const transaction = writeFileSetTransaction(
    prepared.entries,
    transactionOptions(prepared.fsOps)
  );
  return resultFromTransaction(transaction.changedPaths.length === 0 ? "unchanged" : "updated", prepared.root, prepared.hosts, prepared.manifest, transaction, prepared);
}

export function inspectProjectIntegration(start, options = {}) {
  const prepared = prepareInstalledPlan(start, { ...options, replacementPolicy: "inspect" });
  const writtenPaths = prepared.entries.filter((entry) => entry.delete !== true).map((entry) => entry.relativePath);
  const removedPaths = prepared.entries.filter((entry) => entry.delete === true).map((entry) => entry.relativePath);
  const needsUpdate = prepared.entries.length > 0 || prepared.skippedLocalEdits.length > 0;
  return {
    status: needsUpdate ? "needs-update" : "current",
    target: prepared.root,
    hosts: [...prepared.hosts],
    writtenPaths,
    removedPaths,
    changedPaths: prepared.entries.map((entry) => entry.relativePath),
    skippedLocalEdits: [...prepared.skippedLocalEdits],
    replacedLocalEdits: [...prepared.replacedLocalEdits],
    retiredHooks: prepared.retiredHooks,
    manifest: prepared.currentManifest
  };
}

function canonicalLifecycleRoot(start, fsOps) {
  const resolved = path.resolve(start ?? process.cwd());
  const stat = fsOps.lstatSync(resolved);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Dove lifecycle project root must be a real directory: ${resolved}.`);
  return typeof fsOps.realpathSync.native === "function" ? fsOps.realpathSync.native(resolved) : fsOps.realpathSync(resolved);
}

function prepareLifecycleIntegration(root, options, { hosts, source }) {
  const planned = preparePlan({
    root,
    hosts,
    packageName: options.packageName,
    packageVersion: options.packageVersion,
    now: exactTimestamp(options.now),
    fsOps: options.fsOps ?? fs,
    manifest: source,
    replacementPolicy: "confirmed-reinstall"
  });
  return { ...planned, scope: [] };
}

function previewShape(kind, root, hosts, prepared, confirmationRequired) {
  const writtenEntries = prepared.entries.filter((entry) => entry.delete !== true);
  const writtenPaths = writtenEntries.map((entry) => entry.relativePath);
  const removedPaths = prepared.entries.filter((entry) => entry.delete === true).map((entry) => entry.relativePath);
  const replacedPaths = kind === "reinstall" ? writtenPaths : [];
  const preview = {
    status: "ready",
    action: kind,
    target: root,
    hosts: [...hosts],
    writtenPaths,
    removedPaths,
    changedPaths: [...new Set([...writtenPaths, ...removedPaths])],
    destructiveScope: prepared.scope,
    ...(kind === "reinstall" ? { replacedPaths } : {}),
    confirmation: { required: confirmationRequired, default: false },
    manifest: prepared.manifest
  };
  if (kind === "reinstall") {
    Object.defineProperty(preview, "approvalState", {
      value: writtenEntries.map((entry) => ({
        path: entry.relativePath,
        expectedState: entry.expectedState
      })),
      enumerable: false
    });
  }
  return preview;
}

export function previewProjectCompleteReinstall(start, options = {}) {
  const fsOps = options.fsOps ?? fs;
  assertPackageInput(options.packageName, options.packageVersion, { required: true });
  const root = canonicalLifecycleRoot(start, fsOps);
  const source = readProjectInstallationManifest(root, { fsOps, hostIds: PROJECT_HOST_IDS });
  const hosts = options.hosts === undefined ? [...source.hosts] : normalizeSelectedHosts(options.hosts, { defaultWhenEmpty: false });
  const prepared = prepareLifecycleIntegration(root, options, { hosts, source });
  return previewShape("reinstall", root, hosts, prepared, true);
}

function reinstallPreviewScope(preview) {
  return JSON.stringify({
    target: preview.target,
    hosts: preview.hosts,
    writtenPaths: preview.writtenPaths,
    removedPaths: preview.removedPaths,
    changedPaths: preview.changedPaths,
    replacedPaths: preview.replacedPaths,
    destructiveScope: preview.destructiveScope,
    approvalState: preview.approvalState
  });
}

export function completeReinstallProjectIntegration(start, options = {}) {
  if (options.confirmed !== true) throw new Error("Complete Reinstall requires confirmed: true after displaying the real destructive scope.");
  if (!options.preview || options.preview.action !== "reinstall") throw new Error("Complete Reinstall requires the approved reinstall preview.");
  const fsOps = options.fsOps ?? fs;
  assertPackageInput(options.packageName, options.packageVersion, { required: true });
  const root = canonicalLifecycleRoot(start, fsOps);
  const source = readProjectInstallationManifest(root, { fsOps, hostIds: PROJECT_HOST_IDS });
  const hosts = options.hosts === undefined ? [...source.hosts] : normalizeSelectedHosts(options.hosts, { defaultWhenEmpty: false });
  const prepared = prepareLifecycleIntegration(root, options, { hosts, source });
  const currentPreview = previewShape("reinstall", root, hosts, prepared, true);
  if (reinstallPreviewScope(currentPreview) !== reinstallPreviewScope(options.preview)) {
    throw new Error("Complete Reinstall preview is stale; review the current destructive scope and confirm again.");
  }
  return resultFromTransaction(
    "reinstalled",
    root,
    hosts,
    prepared.manifest,
    writeFileSetTransaction(
      prepared.entries,
      transactionOptions(fsOps, {
        transactionBase: ".dove-transaction"
      })
    ),
    prepared
  );
}

function prepareUninstall(start, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const root = canonicalLifecycleRoot(start, fsOps);
  const manifest = readProjectInstallationManifest(root, { fsOps, hostIds: PROJECT_HOST_IDS });
  assertManagedOwnership(manifest);
  const entries = [];
  const sharedPaths = [...new Set(manifest.managed.filter((entry) => entry.kind === "json-fragment").map((entry) => entry.path))].sort();
  for (const relativePath of sharedPaths) {
    const planned = planJsonFragments(
      root,
      relativePath,
      [],
      manifest.managed.filter((entry) => entry.kind === "json-fragment" && entry.path === relativePath),
      fsOps,
      { replacementPolicy: "safe" }
    );
    if (planned.entry) entries.push(planned.entry);
  }
  for (const entry of manifest.managed.filter((managed) => managed.kind !== "json-fragment").sort(compareManaged)) {
    const planned = planResource(root, null, entry, fsOps);
    if (planned.entry) entries.push(planned.entry);
  }
  const manifestObserved = inspectRegularProjectFile(root, INSTALLATION_MANIFEST_PATH, fsOps);
  if (!manifestObserved.exists) throw new Error("Dove uninstall requires the current project installation manifest.");
  entries.push(transactionDelete(root, { path: INSTALLATION_MANIFEST_PATH }, manifestObserved));
  return { fsOps, root, manifest, entries };
}

function uninstallPreview(prepared) {
  const writtenPaths = prepared.entries.filter((entry) => entry.delete !== true).map((entry) => entry.relativePath);
  const removedPaths = prepared.entries.filter((entry) => entry.delete === true).map((entry) => entry.relativePath);
  return {
    status: "ready",
    action: "uninstall",
    target: prepared.root,
    hosts: [...prepared.manifest.hosts],
    writtenPaths,
    removedPaths,
    changedPaths: [...new Set([...writtenPaths, ...removedPaths])],
    preservedPaths: [".dove/research/**", ".dove/reviews/**", ".dove/runs/**", ".dove/install/DOCTOR.md"],
    confirmation: { required: true, default: false }
  };
}

export function previewProjectUninstall(start, options = {}) {
  return uninstallPreview(prepareUninstall(start, options));
}

export function uninstallProjectIntegration(start, options = {}) {
  if (options.confirmed !== true) throw new Error("Dove uninstall requires confirmed: true after displaying the exact removal scope.");
  const prepared = prepareUninstall(start, options);
  const transaction = writeFileSetTransaction(prepared.entries, transactionOptions(prepared.fsOps));
  return {
    status: "uninstalled",
    target: prepared.root,
    hosts: [...prepared.manifest.hosts],
    writtenPaths: [...transaction.writtenPaths],
    removedPaths: [...transaction.removedPaths],
    changedPaths: [...transaction.changedPaths],
    cleanupWarnings: [...transaction.cleanupWarnings],
    omittedCleanupWarningCount: transaction.omittedCleanupWarningCount,
    preservedPaths: [".dove/research/**", ".dove/reviews/**", ".dove/runs/**", ".dove/install/DOCTOR.md"]
  };
}
