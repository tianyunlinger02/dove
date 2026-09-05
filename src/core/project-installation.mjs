import fs from "node:fs";
import path from "node:path";

import { writeFileSetTransaction } from "./file-set-transaction.mjs";
import { PROJECT_HOST_IDS, normalizeHostSelection } from "./host-registry.mjs";
import { LEGACY_WORKSPACE_MARKER_PATH, readLegacyWorkspaceMarker } from "./legacy-workspace-marker.mjs";
import { classifyPackageCompatibility } from "./package-metadata.mjs";
import {
  INSTALLATION_MANIFEST_PATH,
  LEGACY_INSTALLATION_MANIFEST_PATH,
  readProjectInstallationManifest,
  readProjectInstallationManifestForMigration
} from "./project-installation-manifest.mjs";
import {
  inspectRegularProjectFile,
  lstatOrNull,
  planJsonFragments,
  planResource,
  preparePlan,
  transactionDelete
} from "./project-installation-plan.mjs";
import { CLAUDE_HOST, claudeResources, compareManaged, sameArray } from "./project-installation-resources.mjs";
import { resolveExactInstalledProjectRoot, resolveInstalledProjectRoot, resolveProjectRootForInit, resolveProjectRootForSetup } from "./project-root.mjs";
import { prepareResearchDefaults } from "./research-defaults.mjs";
import { inspectResearchDocuments } from "./research-documents.mjs";

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

function appendResearchBootstrap(root, entries, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const researchRoot = path.join(root, ".dove", "research");
  const researchStat = lstatOrNull(fsOps, researchRoot);
  if (researchStat !== null) {
    if (researchStat.isSymbolicLink() || !researchStat.isDirectory()) throw new Error("Dove research root must be a real directory when project integration is initialized.");
    return null;
  }
  const prepared = prepareResearchDefaults(root, {
    fsOps,
    mode: options.mode ?? "sync",
    label: options.label
  });
  const existingTargets = new Set(entries.map((entry) => entry.relativePath));
  for (const entry of prepared.entries) {
    if (!existingTargets.has(entry.relativePath)) entries.push(entry);
  }
  return prepared;
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
  appendResearchBootstrap(root, plan.entries, { fsOps, label: "Dove research bootstrap" });
  return resultFromTransaction(
    "initialized",
    root,
    hosts,
    plan.manifest,
    writeFileSetTransaction(plan.entries, transactionOptions(fsOps))
  );
}

function prepareInstalledIntegrationPlan(start, options = {}) {
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

function prepareInstalledPlan(start, options = {}) {
  return prepareInstalledIntegrationPlan(start, options);
}

function synchronizeProjectIntegration(start, options = {}) {
  const prepared = prepareInstalledPlan(start, { ...options, replacementPolicy: "explicit-update" });
  const transaction = writeFileSetTransaction(
    prepared.entries,
    transactionOptions(prepared.fsOps)
  );
  return resultFromTransaction(transaction.changedPaths.length === 0 ? "unchanged" : "synchronized", prepared.root, prepared.hosts, prepared.manifest, transaction, prepared);
}

function assertIntegrationOnlyEntries(entries) {
  if (entries.some((entry) => entry.relativePath === ".dove/research" || entry.relativePath.startsWith(".dove/research/"))) {
    throw new Error("Dove SessionStart sync refuses to write Dove research state.");
  }
  if (entries.some((entry) => entry.relativePath === ".dove/reviews" || entry.relativePath.startsWith(".dove/reviews/"))) {
    throw new Error("Dove SessionStart sync refuses to write Dove review records.");
  }
  if (entries.some((entry) => entry.relativePath === ".dove/runs" || entry.relativePath.startsWith(".dove/runs/"))) {
    throw new Error("Dove SessionStart sync refuses to write Dove run records.");
  }
  if (entries.some((entry) => entry.relativePath === ".dove/install/DOCTOR.md")) {
    throw new Error("Dove SessionStart sync refuses to write Dove Doctor feedback.");
  }
}

export function synchronizeProjectIntegrationOnly(start, options = {}) {
  const fsOps = options.fsOps ?? fs;
  assertPackageInput(options.packageName, options.packageVersion, { required: true });
  const root = resolveExactInstalledProjectRoot(start, { fsOps, hostIds: PROJECT_HOST_IDS });
  const currentManifest = readProjectInstallationManifest(root, { fsOps, hostIds: PROJECT_HOST_IDS });
  const compatibility = classifyPackageCompatibility(currentManifest.package, {
    name: options.packageName,
    version: options.packageVersion
  });
  if (["identity-mismatch", "invalid-version", "newer"].includes(compatibility)) {
    throw new Error("Dove SessionStart sync refuses missing, invalid, newer, or foreign project integration.");
  }
  if (!currentManifest.hosts.includes(CLAUDE_HOST)) {
    throw new Error("Dove SessionStart sync requires Claude Code host integration.");
  }
  const plan = preparePlan({
    root,
    hosts: [...currentManifest.hosts],
    packageName: options.packageName,
    packageVersion: options.packageVersion,
    now: exactTimestamp(options.now),
    fsOps,
    manifest: currentManifest,
    replacementPolicy: "session-start"
  });
  assertIntegrationOnlyEntries(plan.entries);
  const transaction = writeFileSetTransaction(plan.entries, transactionOptions(fsOps));
  return resultFromTransaction(transaction.changedPaths.length === 0 ? "unchanged" : "synchronized", root, currentManifest.hosts, plan.manifest, transaction, plan);
}

export function inspectProjectIntegration(start, options = {}) {
  const prepared = prepareInstalledPlan(start, options);
  const writtenPaths = prepared.entries.filter((entry) => entry.delete !== true).map((entry) => entry.relativePath);
  const removedPaths = prepared.entries.filter((entry) => entry.delete === true).map((entry) => entry.relativePath);
  const needsSync = prepared.entries.length > 0 || prepared.skippedLocalEdits.length > 0;
  return {
    status: needsSync ? "needs-sync" : "current",
    target: prepared.root,
    hosts: [...prepared.hosts],
    writtenPaths,
    removedPaths,
    changedPaths: prepared.entries.map((entry) => entry.relativePath),
    skippedLocalEdits: [...prepared.skippedLocalEdits],
    replacedLocalEdits: [...prepared.replacedLocalEdits],
    manifest: prepared.currentManifest
  };
}

function canonicalLifecycleRoot(start, fsOps) {
  const resolved = path.resolve(start ?? process.cwd());
  const stat = fsOps.lstatSync(resolved);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Dove lifecycle project root must be a real directory: ${resolved}.`);
  return typeof fsOps.realpathSync.native === "function" ? fsOps.realpathSync.native(resolved) : fsOps.realpathSync(resolved);
}

function walkDeletion(root, relativePath, fsOps, entries, scope, preservePaths = new Set()) {
  const absolutePath = path.join(root, relativePath);
  const stat = lstatOrNull(fsOps, absolutePath);
  if (stat === null) return;
  if (stat.isSymbolicLink()) throw new Error(`Dove lifecycle refuses symbolic links in destructive scope: ${relativePath}.`);
  if (stat.isFile()) {
    if (preservePaths.has(relativePath)) return;
    const observed = inspectRegularProjectFile(root, relativePath, fsOps);
    entries.push(transactionDelete(root, { path: relativePath }, observed));
    scope.push({ path: relativePath, kind: "file", digest: observed.digest });
    return;
  }
  if (!stat.isDirectory()) throw new Error(`Dove lifecycle found unsupported project state: ${relativePath}.`);
  for (const child of fsOps.readdirSync(absolutePath).map(String).sort()) {
    walkDeletion(root, path.posix.join(relativePath, child), fsOps, entries, scope, preservePaths);
  }
  if (preservePaths.has(relativePath)) return;
  entries.push({
    root,
    relativePath,
    delete: true,
    deleteEmptyDirectory: true,
    force: true,
    expectedState: { exists: true, type: "directory", sha256: null, mode: stat.mode & 0o7777 },
    label: `Dove lifecycle directory deletion ${relativePath}`
  });
  scope.push({ path: relativePath, kind: "directory", digest: null });
}

function migrationSource(root, fsOps) {
  const current = lstatOrNull(fsOps, path.join(root, INSTALLATION_MANIFEST_PATH));
  const legacy = lstatOrNull(fsOps, path.join(root, LEGACY_INSTALLATION_MANIFEST_PATH));
  if (current !== null && legacy !== null) throw new Error("Dove project update found both current and 1.0 project installation manifests.");
  if (current !== null) return readProjectInstallationManifestForMigration(root, { fsOps, hostIds: PROJECT_HOST_IDS, manifestPath: INSTALLATION_MANIFEST_PATH });
  if (legacy !== null) return readProjectInstallationManifestForMigration(root, { fsOps, hostIds: PROJECT_HOST_IDS, manifestPath: LEGACY_INSTALLATION_MANIFEST_PATH });
  throw new Error("Dove project update requires an installation revision 1.0 manifest.");
}

function assertAdoptableResearch(root, fsOps) {
  const research = inspectResearchDocuments(root, { fsOps });
  if (research.state !== "current" || research.healthy !== true) {
    throw new Error("Dove project adoption requires a readable current Markdown research tree.");
  }
  return research;
}

function adoptionSource(start, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const root = resolveProjectRootForSetup(start, { fsOps, hostIds: PROJECT_HOST_IDS });
  const current = lstatOrNull(fsOps, path.join(root, INSTALLATION_MANIFEST_PATH));
  if (current !== null) throw new Error("Dove project adoption requires an uninitialized project without a current installation manifest.");
  const legacyInstall = lstatOrNull(fsOps, path.join(root, LEGACY_INSTALLATION_MANIFEST_PATH));
  if (legacyInstall !== null) throw new Error("Dove project adoption accepts only the old .dove/manifest.json workspace marker, not legacy installation manifests.");
  if (readLegacyWorkspaceMarker(root, { fsOps }) === null) {
    throw new Error("Dove project adoption requires the old .dove/manifest.json workspace marker.");
  }
  assertAdoptableResearch(root, fsOps);
  return { root, sourcePath: LEGACY_WORKSPACE_MARKER_PATH, createdAt: null };
}

function prepareLifecycleIntegration(root, options, { hosts, source = null, reinstall = false, adopt = false }) {
  const fsOps = options.fsOps ?? fs;
  const entries = [];
  const scope = [];
  const oldManifest = source ? { ...source, managed: source.managed } : null;
  const now = exactTimestamp(options.now);
  const planned = preparePlan({
    root,
    hosts,
    packageName: options.packageName,
    packageVersion: options.packageVersion,
    now,
    fsOps,
    manifest: oldManifest,
    adopt,
    replacementPolicy: reinstall ? "confirmed-reinstall" : "explicit-update"
  });
  const existingPaths = new Set(entries.map((entry) => entry.relativePath));
  for (const entry of planned.entries) {
    if (existingPaths.has(entry.relativePath)) continue;
    existingPaths.add(entry.relativePath);
    entries.push(entry);
  }
  if (reinstall) {
    const doveRoot = path.join(root, ".dove");
    const doveStat = lstatOrNull(fsOps, doveRoot);
    if (doveStat !== null) {
      if (doveStat.isSymbolicLink() || !doveStat.isDirectory()) throw new Error("Complete Reinstall requires .dove to be a real directory.");
      const installRoot = path.join(doveRoot, "install");
      const installStat = lstatOrNull(fsOps, installRoot);
      if (installStat !== null) {
        if (installStat.isSymbolicLink() || !installStat.isDirectory()) throw new Error("Complete Reinstall requires .dove/install to be a real directory.");
        for (const child of fsOps.readdirSync(installRoot).map(String).sort()) {
          if (child !== "manifest.json" && child !== "DOCTOR.md") walkDeletion(root, `.dove/install/${child}`, fsOps, entries, scope);
        }
      }
    }
    walkDeletion(root, ".dove-install", fsOps, entries, scope);
  } else if (source?.sourcePath === LEGACY_INSTALLATION_MANIFEST_PATH) {
    const legacyDirectory = lstatOrNull(fsOps, path.join(root, ".dove-install"));
    if (legacyDirectory?.isSymbolicLink() || (legacyDirectory !== null && !legacyDirectory.isDirectory())) {
      throw new Error("Updating Dove project integration requires .dove-install to be a real directory.");
    }
    const legacyObserved = inspectRegularProjectFile(root, LEGACY_INSTALLATION_MANIFEST_PATH, fsOps);
    entries.push(transactionDelete(root, { path: LEGACY_INSTALLATION_MANIFEST_PATH }, legacyObserved));
    const legacyChildren = legacyDirectory === null ? [] : fsOps.readdirSync(path.join(root, ".dove-install")).map(String).sort();
    if (sameArray(legacyChildren, ["manifest.json"])) {
      entries.push({
        root,
        relativePath: ".dove-install",
        delete: true,
        deleteEmptyDirectory: true,
        force: true,
        expectedState: { exists: true, type: "directory", sha256: null, mode: legacyDirectory.mode & 0o7777 },
        label: "Dove 1.0 installation directory cleanup"
      });
    }
  }
  return { entries, manifest: planned.manifest, scope, skippedLocalEdits: planned.skippedLocalEdits, replacedLocalEdits: planned.replacedLocalEdits };
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

export function previewProjectUpgrade(start, options = {}) {
  const fsOps = options.fsOps ?? fs;
  assertPackageInput(options.packageName, options.packageVersion, { required: true });
  const root = canonicalLifecycleRoot(start, fsOps);
  const source = migrationSource(root, fsOps);
  const hosts = options.hosts === undefined ? [...source.hosts] : normalizeSelectedHosts(options.hosts, { defaultWhenEmpty: false });
  const prepared = prepareLifecycleIntegration(root, options, { hosts, source, reinstall: false });
  return previewShape("upgrade", root, hosts, prepared, false);
}

export function upgradeProjectIntegration(start, options = {}) {
  const fsOps = options.fsOps ?? fs;
  assertPackageInput(options.packageName, options.packageVersion, { required: true });
  const root = canonicalLifecycleRoot(start, fsOps);
  const source = migrationSource(root, fsOps);
  const hosts = options.hosts === undefined ? [...source.hosts] : normalizeSelectedHosts(options.hosts, { defaultWhenEmpty: false });
  const prepared = prepareLifecycleIntegration(root, options, { hosts, source, reinstall: false });
  return resultFromTransaction(
    "upgraded",
    root,
    hosts,
    prepared.manifest,
    writeFileSetTransaction(prepared.entries, transactionOptions(fsOps)),
    prepared
  );
}

export function previewProjectAdoption(start, options = {}) {
  const fsOps = options.fsOps ?? fs;
  assertPackageInput(options.packageName, options.packageVersion, { required: true });
  const source = adoptionSource(start, { ...options, fsOps });
  const hosts = normalizeSelectedHosts(options.hosts, { defaultWhenEmpty: true });
  const prepared = prepareLifecycleIntegration(source.root, options, { hosts, source: null, reinstall: false, adopt: true });
  return previewShape("adopt", source.root, hosts, prepared, false);
}

export function adoptProjectIntegration(start, options = {}) {
  const fsOps = options.fsOps ?? fs;
  assertPackageInput(options.packageName, options.packageVersion, { required: true });
  const source = adoptionSource(start, { ...options, fsOps });
  const hosts = normalizeSelectedHosts(options.hosts, { defaultWhenEmpty: true });
  const prepared = prepareLifecycleIntegration(source.root, options, { hosts, source: null, reinstall: false, adopt: true });
  return resultFromTransaction(
    "adopted",
    source.root,
    hosts,
    prepared.manifest,
    writeFileSetTransaction(prepared.entries, transactionOptions(fsOps)),
    prepared
  );
}

export function previewProjectCompleteReinstall(start, options = {}) {
  const fsOps = options.fsOps ?? fs;
  assertPackageInput(options.packageName, options.packageVersion, { required: true });
  const root = canonicalLifecycleRoot(start, fsOps);
  let source = null;
  try {
    source = readProjectInstallationManifest(root, { fsOps, hostIds: PROJECT_HOST_IDS });
  } catch {
    try { source = migrationSource(root, fsOps); } catch { source = null; }
  }
  const hosts = options.hosts === undefined ? [...(source?.hosts ?? [CLAUDE_HOST])] : normalizeSelectedHosts(options.hosts, { defaultWhenEmpty: false });
  const prepared = prepareLifecycleIntegration(root, options, { hosts, source, reinstall: true });
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
  let source = null;
  try {
    source = readProjectInstallationManifest(root, { fsOps, hostIds: PROJECT_HOST_IDS });
  } catch {
    try { source = migrationSource(root, fsOps); } catch { source = null; }
  }
  const hosts = options.hosts === undefined ? [...(source?.hosts ?? [CLAUDE_HOST])] : normalizeSelectedHosts(options.hosts, { defaultWhenEmpty: false });
  const prepared = prepareLifecycleIntegration(root, options, { hosts, source, reinstall: true });
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
  const legacyMarker = readLegacyWorkspaceMarker(root, { fsOps, strict: false });
  if (legacyMarker !== null) {
    const markerObserved = inspectRegularProjectFile(root, LEGACY_WORKSPACE_MARKER_PATH, fsOps);
    entries.push(transactionDelete(root, { path: LEGACY_WORKSPACE_MARKER_PATH }, markerObserved));
  }
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

export function updateProjectIntegration(start, options = {}) {
  return synchronizeProjectIntegration(start, options);
}

export const PROJECT_INTEGRATION_MANAGED_PATHS = Object.freeze(claudeResources().map((resource) => resource.path).sort());
