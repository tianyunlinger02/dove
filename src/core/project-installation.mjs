import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  DOVE_CLAUDE_AMBIENT_HOOK_COMMAND,
  DOVE_CLAUDE_AMBIENT_HOOK_ENTRY,
  DOVE_CLAUDE_SETTINGS_PATH,
  DOVE_CLAUDE_STOP_HOOK_ENTRY,
  mergeClaudeAmbientSettings
} from "./ambient-policy.mjs";
import {
  PAPER_SEARCH_MCP_FRAGMENT,
  PAPER_SEARCH_MCP_PATH,
  PAPER_SEARCH_MCP_SELECTOR,
  PAPER_SEARCH_MCP_SERVER_NAME
} from "./paper-search-integration.mjs";
import { writeFileSetTransaction } from "./file-set-transaction.mjs";
import { PROJECT_HOST_IDS, normalizeHostSelection } from "./host-registry.mjs";
import {
  INSTALLATION_MANIFEST_PATH,
  LEGACY_INSTALLATION_MANIFEST_PATH,
  createProjectInstallationManifest,
  readProjectInstallationManifest,
  readProjectInstallationManifestForMigration,
  serializeProjectInstallationManifest
} from "./project-installation-manifest.mjs";
import { resolveInstalledProjectRoot, resolveProjectRootForInit } from "./project-root.mjs";
import {
  RESEARCH_DEFAULT_DIRECTORY_PATHS,
  RESEARCH_DEFAULT_FILE_PATHS,
  RESEARCH_DEFAULT_PATHS,
  prepareResearchDefaults
} from "./research-defaults.mjs";
import { parseJsonWithoutDuplicateKeys } from "./strict-json.mjs";
import { generatedAdapterEntries, generatedClaudeAmbientProjectEntries } from "../../scripts/generate-command-adapters.mjs";
import { generatedRoleDefinitionEntries } from "./role-definitions.mjs";

const MCP_PATH = PAPER_SEARCH_MCP_PATH;
const SETTINGS_SELECTOR = "/hooks/UserPromptSubmit[dove-user-prompt-submit]";
const CLAUDE_HOST = "claude";
const FORBIDDEN_RESOURCE_PREFIXES = [".dove/", "bin/", "dist/", "mcp/", "scripts/"];

function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

function semanticDigest(value) {
  return sha256(canonicalJson(value));
}

function normalizedGeneratedContent(content) {
  return `${String(content).trimEnd()}\n`;
}

function managedKey(entry) {
  return `${entry.path}\0${entry.kind}\0${entry.selector ?? ""}`;
}

function compareManaged(left, right) {
  return left.path.localeCompare(right.path)
    || left.kind.localeCompare(right.kind)
    || String(left.selector ?? "").localeCompare(String(right.selector ?? ""));
}

function sameArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function samePackage(left, right) {
  return left.name === right.name && left.version === right.version;
}

function sameManaged(left, right) {
  const sortedLeft = [...left].sort(compareManaged);
  const sortedRight = [...right].sort(compareManaged);
  return sortedLeft.length === sortedRight.length
    && sortedLeft.every((entry, index) => managedKey(entry) === managedKey(sortedRight[index]) && entry.digest === sortedRight[index].digest);
}

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

function assertManagedResourcePath(relativePath) {
  if (relativePath === ".dove" || relativePath.startsWith(".dove/")) throw new Error(`Project integration resources must not manage Dove workspace state: ${relativePath}.`);
  if (FORBIDDEN_RESOURCE_PREFIXES.some((prefix) => relativePath.startsWith(prefix))) throw new Error(`Project integration resources must not install runtime bundles: ${relativePath}.`);
}

function claudeResources() {
  const roleEntries = generatedRoleDefinitionEntries().filter((entry) => entry.relativePath.startsWith(".claude/agents/"));
  const files = [
    ...generatedAdapterEntries().filter((entry) => entry.hostId === CLAUDE_HOST),
    ...generatedClaudeAmbientProjectEntries(),
    ...roleEntries
  ].map((entry) => {
    assertManagedResourcePath(entry.relativePath);
    const content = normalizedGeneratedContent(entry.content);
    return {
      hostId: CLAUDE_HOST,
      path: entry.relativePath,
      kind: "exclusive-file",
      selector: null,
      content,
      digest: sha256(content)
    };
  });
  const hooks = {
    UserPromptSubmit: DOVE_CLAUDE_AMBIENT_HOOK_ENTRY,
    Stop: DOVE_CLAUDE_STOP_HOOK_ENTRY
  };
  const hook = {
    hostId: CLAUDE_HOST,
    path: DOVE_CLAUDE_SETTINGS_PATH,
    kind: "json-fragment",
    selector: SETTINGS_SELECTOR,
    fragment: hooks,
    digest: semanticDigest(hooks)
  };
  const paperSearch = {
    hostId: CLAUDE_HOST,
    path: PAPER_SEARCH_MCP_PATH,
    kind: "json-fragment",
    selector: PAPER_SEARCH_MCP_SELECTOR,
    fragment: PAPER_SEARCH_MCP_FRAGMENT,
    digest: semanticDigest(PAPER_SEARCH_MCP_FRAGMENT)
  };
  const resources = [...files, hook, paperSearch];
  if (new Set(resources.map(managedKey)).size !== resources.length) throw new Error("Generated project integration resources contain duplicate manifest entries.");
  return resources;
}

function resourcesForHosts(hosts) {
  return claudeResources().filter((entry) => hosts.includes(entry.hostId)).sort(compareManaged);
}

function lstatOrNull(fsOps, targetPath) {
  try {
    return fsOps.lstatSync(targetPath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function inspectRegularProjectFile(root, relativePath, fsOps) {
  let current = root;
  for (const [index, component] of relativePath.split("/").entries()) {
    current = path.join(current, component);
    const stat = lstatOrNull(fsOps, current);
    if (stat === null) return { exists: false, bytes: null, digest: null, mode: null, type: "absent" };
    if (stat.isSymbolicLink()) throw new Error(`Dove project integration path must not be a symbolic link: ${relativePath}.`);
    if (index < relativePath.split("/").length - 1) {
      if (!stat.isDirectory()) throw new Error(`Dove project integration parent must be a directory: ${relativePath}.`);
      continue;
    }
    if (!stat.isFile()) throw new Error(`Dove project integration path must be absent or a regular file: ${relativePath}.`);
    const bytes = fsOps.readFileSync(current);
    return { exists: true, bytes, digest: sha256(bytes), mode: stat.mode & 0o7777, type: "file" };
  }
  throw new Error(`Invalid Dove project integration path: ${relativePath}.`);
}

function expectedFileState(state) {
  return state.exists
    ? { exists: true, type: "file", sha256: state.digest, mode: state.mode }
    : { exists: false, type: "absent", sha256: null, mode: null };
}

function transactionWrite(root, resource, content, observed) {
  return {
    root,
    relativePath: resource.path,
    content,
    encoding: "utf8",
    force: true,
    expectedState: expectedFileState(observed),
    label: `Dove project integration resource ${resource.path}`
  };
}

function transactionDelete(root, resource, observed) {
  return {
    root,
    relativePath: resource.path,
    delete: true,
    force: true,
    expectedState: expectedFileState(observed),
    label: `Dove project integration resource ${resource.path}`
  };
}

function parseSharedJson(state, relativePath) {
  if (!state.exists) return {};
  const value = parseJsonWithoutDuplicateKeys(state.bytes.toString("utf8"), relativePath);
  if (!plainObject(value)) throw new Error(`${relativePath} must contain a JSON object.`);
  return value;
}

function serializeSharedJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function referencesDoveHook(entry, eventName) {
  return plainObject(entry) && Array.isArray(entry.hooks) && entry.hooks.some((hook) => {
    if (!plainObject(hook) || typeof hook.command !== "string") return false;
    if (eventName === "UserPromptSubmit") {
      return hook.command.includes("dove hook user-prompt-submit") || hook.command.includes("dove-user-prompt-submit-package.mjs");
    }
    return hook.command.includes("dove hook stop");
  });
}

function hookFragmentState(settings, eventName) {
  if (settings.hooks !== undefined && !plainObject(settings.hooks)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} hooks must be a JSON object.`);
  const entries = settings.hooks?.[eventName];
  if (entries !== undefined && !Array.isArray(entries)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} hooks.${eventName} must be an array.`);
  const candidates = (entries ?? []).map((entry, index) => ({ entry, index })).filter(({ entry }) => referencesDoveHook(entry, eventName));
  if (candidates.length > 1) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} defines multiple Dove ${eventName} hooks.`);
  if (candidates.length === 0) return { exists: false, digest: null, index: -1, fragment: null };
  return { exists: true, digest: semanticDigest(candidates[0].entry), index: candidates[0].index, fragment: candidates[0].entry };
}

function namedMcpFragmentState(config, serverName) {
  if (config.mcpServers !== undefined && !plainObject(config.mcpServers)) throw new Error(`${MCP_PATH} mcpServers must be a JSON object.`);
  if (!Object.hasOwn(config.mcpServers ?? {}, serverName)) return { exists: false, digest: null, fragment: null };
  const fragment = config.mcpServers[serverName];
  return { exists: true, digest: semanticDigest(fragment), fragment };
}

function paperSearchMcpFragmentState(config) {
  return namedMcpFragmentState(config, PAPER_SEARCH_MCP_SERVER_NAME);
}

function fragmentState(resource, value) {
  if (resource.selector === SETTINGS_SELECTOR) {
    const prompt = hookFragmentState(value, "UserPromptSubmit");
    const stop = hookFragmentState(value, "Stop");
    if (!prompt.exists) return { exists: false, digest: null, index: -1, fragment: null };
    if (!stop.exists) return prompt;
    const fragment = { UserPromptSubmit: prompt.fragment, Stop: stop.fragment };
    return { exists: true, digest: semanticDigest(fragment), index: -1, fragment };
  }
  if (resource.selector === PAPER_SEARCH_MCP_SELECTOR) return paperSearchMcpFragmentState(value);
  throw new Error(`Unsupported Dove project integration selector: ${resource.selector}.`);
}

function removeFragment(resource, value, current) {
  if (resource.selector === SETTINGS_SELECTOR) {
    let next = value;
    for (const eventName of ["UserPromptSubmit", "Stop"]) {
      const state = hookFragmentState(next, eventName);
      if (!state.exists) continue;
      next = { ...next, hooks: { ...next.hooks, [eventName]: next.hooks[eventName].filter((_, index) => index !== state.index) } };
    }
    return next;
  }
  if (resource.selector === PAPER_SEARCH_MCP_SELECTOR) {
    const servers = { ...value.mcpServers };
    delete servers[PAPER_SEARCH_MCP_SERVER_NAME];
    return { ...value, mcpServers: servers };
  }
  throw new Error(`Unsupported Dove project integration selector: ${resource.selector}.`);
}

function emptySharedJsonShell(resource, value) {
  if (resource.selector === PAPER_SEARCH_MCP_SELECTOR) {
    return Object.keys(value).length === 1 && plainObject(value.mcpServers) && Object.keys(value.mcpServers).length === 0;
  }
  return false;
}

function driftError(resource, currentDigest) {
  return new Error(`Dove project integration ownership drift at ${resource.path}${resource.selector ? `#${resource.selector}` : ""}; current digest ${currentDigest ?? "absent"} matches neither the manifest nor the expected resource.`);
}

function conflictError(resource) {
  return new Error(`Dove project integration cannot claim conflicting content at ${resource.path}${resource.selector ? `#${resource.selector}` : ""}.`);
}

function planExclusive(root, desired, oldEntry, fsOps) {
  const resource = desired ?? oldEntry;
  const observed = inspectRegularProjectFile(root, resource.path, fsOps);
  if (!oldEntry) {
    if (!observed.exists) return { entry: transactionWrite(root, desired, desired.content, observed), changed: true };
    if (observed.digest === desired.digest) return { entry: null, changed: false };
    throw conflictError(desired);
  }
  if (desired) {
    if (!observed.exists) return { entry: transactionWrite(root, desired, desired.content, observed), changed: true };
    if (observed.digest !== oldEntry.digest && observed.digest !== desired.digest) throw driftError(resource, observed.digest);
    if (observed.digest === desired.digest) return { entry: null, changed: oldEntry.digest !== desired.digest };
    return { entry: transactionWrite(root, desired, desired.content, observed), changed: true };
  }
  if (!observed.exists) return { entry: null, changed: true };
  if (observed.digest !== oldEntry.digest) throw driftError(resource, observed.digest);
  return { entry: transactionDelete(root, resource, observed), changed: true };
}

function addFragment(resource, value) {
  if (resource.selector === SETTINGS_SELECTOR) return mergeClaudeAmbientSettings(value).settings;
  if (resource.selector === PAPER_SEARCH_MCP_SELECTOR) {
    return {
      ...value,
      mcpServers: {
        ...(value.mcpServers ?? {}),
        [PAPER_SEARCH_MCP_SERVER_NAME]: resource.fragment
      }
    };
  }
  throw new Error(`Dove does not install unsupported project-local fragment ${resource.path}#${resource.selector}.`);
}

function planJsonFragments(root, relativePath, desiredEntries, oldEntries, fsOps) {
  const observed = inspectRegularProjectFile(root, relativePath, fsOps);
  const original = parseSharedJson(observed, relativePath);
  const desiredByKey = new Map(desiredEntries.map((entry) => [managedKey(entry), entry]));
  const oldByKey = new Map(oldEntries.map((entry) => [managedKey(entry), entry]));
  let next = original;
  let changed = false;

  for (const key of [...new Set([...oldByKey.keys(), ...desiredByKey.keys()])].sort()) {
    const desired = desiredByKey.get(key) ?? null;
    const oldEntry = oldByKey.get(key) ?? null;
    const resource = desired ?? oldEntry;
    const current = fragmentState(resource, next);
    if (!oldEntry) {
      if (current.exists && current.digest === desired.digest) continue;
      if (current.exists) throw conflictError(desired);
      next = addFragment(desired, next);
      changed = true;
      continue;
    }
    if (desired) {
      if (!current.exists) {
        next = addFragment(desired, next);
        changed = true;
        continue;
      }
      if (current.digest !== oldEntry.digest && current.digest !== desired.digest) throw driftError(resource, current.digest);
      if (current.digest === desired.digest) {
        if (oldEntry.digest !== desired.digest) changed = true;
        continue;
      }
      next = addFragment(desired, removeFragment(desired, next, current));
      changed = true;
      continue;
    }
    if (!current.exists) {
      changed = true;
      continue;
    }
    if (current.digest !== oldEntry.digest) throw driftError(resource, current.digest);
    next = removeFragment(resource, next, current);
    changed = true;
  }

  if (canonicalJson(next) === canonicalJson(original)) return { entry: null, changed };
  const resource = desiredEntries[0] ?? oldEntries[0];
  return {
    entry: emptySharedJsonShell(resource, next)
      ? transactionDelete(root, resource, observed)
      : transactionWrite(root, resource, serializeSharedJson(next), observed),
    changed: true
  };
}

function planResource(root, desired, oldEntry, fsOps) {
  const kind = desired?.kind ?? oldEntry.kind;
  if (kind === "exclusive-file") return planExclusive(root, desired, oldEntry, fsOps);
  throw new Error(`Unsupported project integration resource kind: ${kind}.`);
}

function desiredManaged(resources) {
  return resources.map(({ path: relativePath, kind, selector, digest }) => ({ path: relativePath, kind, selector, digest })).sort(compareManaged);
}

function preparePlan({ root, hosts, packageName, packageVersion, now, fsOps, manifest = null }) {
  const desiredResources = resourcesForHosts(hosts);
  const desiredByKey = new Map(desiredResources.map((entry) => [managedKey(entry), entry]));
  const oldByKey = new Map((manifest?.managed ?? []).map((entry) => [managedKey(entry), entry]));
  const entries = [];
  let resourcesChanged = false;
  const sharedPaths = [...new Set([
    ...desiredResources.filter((entry) => entry.kind === "json-fragment").map((entry) => entry.path),
    ...(manifest?.managed ?? []).filter((entry) => entry.kind === "json-fragment").map((entry) => entry.path)
  ])].sort();
  for (const relativePath of sharedPaths) {
    const planned = planJsonFragments(
      root,
      relativePath,
      desiredResources.filter((entry) => entry.kind === "json-fragment" && entry.path === relativePath),
      (manifest?.managed ?? []).filter((entry) => entry.kind === "json-fragment" && entry.path === relativePath),
      fsOps
    );
    if (planned.entry) entries.push(planned.entry);
    if (planned.changed) resourcesChanged = true;
  }
  const keys = [...new Set([...oldByKey.keys(), ...desiredByKey.keys()])]
    .filter((key) => (desiredByKey.get(key) ?? oldByKey.get(key)).kind !== "json-fragment")
    .sort();
  for (const key of keys) {
    const planned = planResource(root, desiredByKey.get(key) ?? null, oldByKey.get(key) ?? null, fsOps);
    if (planned.entry) entries.push(planned.entry);
    if (planned.changed) resourcesChanged = true;
  }
  const managed = desiredManaged(desiredResources);
  const packageInfo = { name: packageName, version: packageVersion };
  const manifestChanged = manifest === null
    || resourcesChanged
    || !sameArray(manifest.hosts, hosts)
    || !samePackage(manifest.package, packageInfo)
    || !sameManaged(manifest.managed, managed);
  const nextManifest = manifestChanged
    ? createProjectInstallationManifest({
      package: packageInfo,
      hosts,
      managed,
      createdAt: manifest?.createdAt ?? now,
      updatedAt: now
    }, { hostIds: PROJECT_HOST_IDS })
    : manifest;
  if (manifestChanged) {
    const observed = inspectRegularProjectFile(root, INSTALLATION_MANIFEST_PATH, fsOps);
    entries.push(transactionWrite(root, { path: INSTALLATION_MANIFEST_PATH }, serializeProjectInstallationManifest(nextManifest, { hostIds: PROJECT_HOST_IDS }), observed));
  }
  return { entries, manifest: nextManifest, manifestChanged };
}

function resultFromTransaction(status, target, hosts, manifest, transaction) {
  return {
    status,
    target,
    hosts: [...hosts],
    writtenPaths: [...transaction.writtenPaths],
    removedPaths: [...transaction.removedPaths],
    changedPaths: [...transaction.changedPaths],
    cleanupWarnings: [...transaction.cleanupWarnings],
    omittedCleanupWarningCount: transaction.omittedCleanupWarningCount,
    manifest
  };
}

function appendResearchDefaults(root, entries, options = {}) {
  const prepared = prepareResearchDefaults(root, {
    fsOps: options.fsOps,
    mode: options.mode ?? "sync",
    migrateRetiredLessons: options.migrateRetiredLessons,
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
  const researchDefaults = appendResearchDefaults(root, plan.entries, { fsOps, label: "Dove research bootstrap" });
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
  const plan = preparePlan({ root, hosts, packageName, packageVersion, now: exactTimestamp(options.now), fsOps, manifest });
  const researchDefaults = appendResearchDefaults(root, plan.entries, { fsOps, label: "Dove research defaults sync" });
  return { fsOps, root, hosts, currentManifest: manifest, researchDefaults, ...plan };
}

function synchronizeProjectIntegration(start, options = {}) {
  const prepared = prepareInstalledPlan(start, options);
  const transaction = writeFileSetTransaction(
    prepared.entries,
    transactionOptions(prepared.fsOps)
  );
  return resultFromTransaction(transaction.changedPaths.length === 0 ? "unchanged" : "synchronized", prepared.root, prepared.hosts, prepared.manifest, transaction);
}

export function inspectProjectIntegration(start, options = {}) {
  const prepared = prepareInstalledPlan(start, options);
  const writtenPaths = prepared.entries.filter((entry) => entry.delete !== true).map((entry) => entry.relativePath);
  const removedPaths = prepared.entries.filter((entry) => entry.delete === true).map((entry) => entry.relativePath);
  return {
    status: prepared.entries.length === 0 ? "current" : "needs-sync",
    target: prepared.root,
    hosts: [...prepared.hosts],
    writtenPaths,
    removedPaths,
    changedPaths: prepared.entries.map((entry) => entry.relativePath),
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

function prepareLifecycleIntegration(root, options, { hosts, source = null, reinstall = false }) {
  const fsOps = options.fsOps ?? fs;
  const entries = [];
  const scope = [];
  const oldManifest = source ? { ...source, managed: source.managed } : null;
  const planned = preparePlan({
    root,
    hosts,
    packageName: options.packageName,
    packageVersion: options.packageVersion,
    now: exactTimestamp(options.now),
    fsOps,
    manifest: oldManifest
  });
  const existingPaths = new Set(entries.map((entry) => entry.relativePath));
  for (const entry of planned.entries) {
    if (existingPaths.has(entry.relativePath)) continue;
    existingPaths.add(entry.relativePath);
    entries.push(entry);
  }
  let researchDefaults = null;
  if (reinstall) {
    const preservedResearchPaths = new Set([
      ...RESEARCH_DEFAULT_DIRECTORY_PATHS,
      ...RESEARCH_DEFAULT_FILE_PATHS
    ]);
    const doveRoot = path.join(root, ".dove");
    const doveStat = lstatOrNull(fsOps, doveRoot);
    if (doveStat !== null) {
      if (doveStat.isSymbolicLink() || !doveStat.isDirectory()) throw new Error("Complete Reinstall requires .dove to be a real directory.");
      for (const child of fsOps.readdirSync(doveRoot).map(String).sort()) {
        if (child !== "install") walkDeletion(root, `.dove/${child}`, fsOps, entries, scope, preservedResearchPaths);
      }
      const installRoot = path.join(doveRoot, "install");
      const installStat = lstatOrNull(fsOps, installRoot);
      if (installStat !== null) {
        if (installStat.isSymbolicLink() || !installStat.isDirectory()) throw new Error("Complete Reinstall requires .dove/install to be a real directory.");
        for (const child of fsOps.readdirSync(installRoot).map(String).sort()) {
          if (child !== "manifest.json") walkDeletion(root, `.dove/install/${child}`, fsOps, entries, scope);
        }
      }
    }
    walkDeletion(root, ".dove-archive", fsOps, entries, scope);
    walkDeletion(root, ".dove-install", fsOps, entries, scope);
    researchDefaults = appendResearchDefaults(root, entries, {
      fsOps,
      mode: "replace",
      migrateRetiredLessons: false,
      label: "Dove Complete Reinstall research bootstrap"
    });
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
  if (!reinstall) {
    researchDefaults = appendResearchDefaults(root, entries, {
      fsOps,
      label: "Dove research defaults update"
    });
  }
  return { entries, manifest: planned.manifest, scope, researchDefaults };
}

function previewShape(kind, root, hosts, prepared, confirmationRequired) {
  const writtenEntries = prepared.entries.filter((entry) => entry.delete !== true);
  const writtenPaths = writtenEntries.map((entry) => entry.relativePath);
  const removedPaths = prepared.entries.filter((entry) => entry.delete === true).map((entry) => entry.relativePath);
  const defaultResearchPaths = new Set(RESEARCH_DEFAULT_FILE_PATHS);
  const replacedPaths = writtenEntries
    .filter((entry) => entry.expectedState?.exists === true && defaultResearchPaths.has(entry.relativePath))
    .map((entry) => entry.relativePath);
  return {
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
    writeFileSetTransaction(prepared.entries, transactionOptions(fsOps, prepared.researchDefaults))
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

export function completeReinstallProjectIntegration(start, options = {}) {
  if (options.confirmed !== true) throw new Error("Complete Reinstall requires confirmed: true after displaying the real destructive scope.");
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
    )
  );
}

export function updateProjectIntegration(start, options = {}) {
  return synchronizeProjectIntegration(start, options);
}

export const PROJECT_INTEGRATION_MANAGED_PATHS = Object.freeze(claudeResources().map((resource) => resource.path).sort());
export const PROJECT_INTEGRATION_CLAUDE_HOOK_COMMAND = DOVE_CLAUDE_AMBIENT_HOOK_COMMAND;
