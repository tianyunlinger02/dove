import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  DOVE_CLAUDE_AMBIENT_HOOK_COMMAND,
  DOVE_CLAUDE_AMBIENT_HOOK_ENTRY,
  DOVE_CLAUDE_SETTINGS_PATH,
  mergeClaudeAmbientSettings
} from "./ambient-policy.mjs";
import { PACKAGE_RUNTIME_PATHS, RETIRED_MANAGED_PATHS, RETIRED_PACKAGE_RUNTIME_PATHS } from "./command-manifest.mjs";
import { DOVE_CLAUDE_LOCAL_SETTINGS_PATH, inspectLegacyClaudeEnabledMcpSettings } from "./claude-project-settings.mjs";
import { writeFileSetTransaction } from "./file-set-transaction.mjs";
import { PROJECT_HOST_IDS, normalizeHostSelection } from "./host-registry.mjs";
import { LEGACY_PROJECT_BUNDLE_PROBES, inspectLegacyProjectInstallation } from "./project-legacy-installation.mjs";
import {
  INSTALLATION_MANIFEST_PATH,
  LEGACY_INSTALLATION_MANIFEST_PATH,
  createProjectInstallationManifest,
  readProjectInstallationManifest,
  readProjectInstallationManifestForMigration,
  serializeProjectInstallationManifest
} from "./project-installation-manifest.mjs";
import { resolveInstalledProjectRoot, resolveProjectRootForInit } from "./project-root.mjs";
import { parseJsonWithoutDuplicateKeys } from "./strict-json.mjs";
import { generatedAdapterEntries, generatedClaudeAmbientProjectEntries } from "../../scripts/generate-command-adapters.mjs";
import { generatedRoleDefinitionEntries } from "./role-definitions.mjs";

const MCP_PATH = ".mcp.json";
const MCP_SELECTOR = "/mcpServers/dove";
const LEGACY_ENABLED_MCP_SELECTOR = "/enabledMcpjsonServers[dove]";
const SETTINGS_SELECTOR = "/hooks/UserPromptSubmit[dove-user-prompt-submit]";
const CLAUDE_HOST = "claude";
const MANIFEST_LABEL = "Dove project installation manifest";
const FORBIDDEN_RESOURCE_PREFIXES = [".dove/", "bin/", "dist/", "mcp/", "scripts/"];
const LEGACY_DOVE_MCP_BUNDLE_ARGS = new Set([
  "./mcp/dove-state-server-package.mjs",
  "${CLAUDE_PROJECT_DIR:-.}/mcp/dove-state-server-package.mjs"
]);
const RETIRED_EXCLUSIVE_PATHS = new Set([
  ...Object.values(RETIRED_MANAGED_PATHS).flat().filter((relativePath) => relativePath !== ".opencode.json"),
  ".claude/commands/dove/init.md",
  ".claude/commands/dove/version.md",
  "mcp/dove-claude-project.json"
]);
const KNOWN_RETIRED_DIGESTS = new Map([
  [".claude/commands/dove/init.md", new Set([
    "8bc54cb154048273c4e6f8b5c77ae76453d2cff788c98bab6fc4882bc2a7dc5e",
    "a9afa0a020eef967d02780d4604ea38c14c07a32f8de3e21c5b85e414afd1a49",
    "f75287da81a7fb18c80895388dec5ee5536336450123ad2ab4dcb49155e50e4e"
  ])],
  [".claude/commands/dove/version.md", new Set([
    "17c468e5e92a69d4466918f1d251bdc67d68e9cc0fed0f166807256529b89207",
    "6d1a56d47e843ea5f976a399b314e90a51fb7e409daa2b673ba2e4bfecfd02c5",
    "e02ccf0c83499d893104b542d5ef9ad6238dc88cdc108e5c2dfde1aa0a66bfb2"
  ])],
  [".claude/commands/dove/workspace.md", new Set(["1a6a38f1a448258faecff76e185161ebb922a359b8000ef7e14148838bd23fe4"])],
  [".claude/commands/dove/mission.md", new Set(["b237ce2efa7a95f14a288bc5d7198ef0b9f582e4a9fa7938061ab71b9066c949"])],
  [".claude/commands/dove/note.md", new Set(["dc68943606243671e869a89cf9bf93b8c943697ca01ae98ca5f202adf3d5569e"])],
  [".claude/commands/dove/experience.md", new Set(["33843d7c0d2950ec90b1ec4c466a3ff07a07860f9e6ec712e8addd0143155400"])]
]);

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
  const hook = {
    hostId: CLAUDE_HOST,
    path: DOVE_CLAUDE_SETTINGS_PATH,
    kind: "json-fragment",
    selector: SETTINGS_SELECTOR,
    fragment: DOVE_CLAUDE_AMBIENT_HOOK_ENTRY,
    digest: semanticDigest(DOVE_CLAUDE_AMBIENT_HOOK_ENTRY)
  };
  const resources = [...files, hook];
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

function referencesDoveHook(entry) {
  return plainObject(entry) && Array.isArray(entry.hooks) && entry.hooks.some((hook) => plainObject(hook)
    && typeof hook.command === "string"
    && (hook.command.includes("dove hook user-prompt-submit") || hook.command.includes("dove-user-prompt-submit-package.mjs")));
}

function hookFragmentState(settings) {
  if (settings.hooks !== undefined && !plainObject(settings.hooks)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} hooks must be a JSON object.`);
  const entries = settings.hooks?.UserPromptSubmit;
  if (entries !== undefined && !Array.isArray(entries)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} hooks.UserPromptSubmit must be an array.`);
  const candidates = (entries ?? []).map((entry, index) => ({ entry, index })).filter(({ entry }) => referencesDoveHook(entry));
  if (candidates.length > 1) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} defines multiple Dove UserPromptSubmit hooks.`);
  if (candidates.length === 0) return { exists: false, digest: null, index: -1, fragment: null };
  return { exists: true, digest: semanticDigest(candidates[0].entry), index: candidates[0].index, fragment: candidates[0].entry };
}

function mcpFragmentState(config) {
  if (config.mcpServers !== undefined && !plainObject(config.mcpServers)) throw new Error(`${MCP_PATH} mcpServers must be a JSON object.`);
  if (!Object.hasOwn(config.mcpServers ?? {}, "dove")) return { exists: false, digest: null, fragment: null };
  const fragment = config.mcpServers.dove;
  return { exists: true, digest: semanticDigest(fragment), fragment };
}

function enabledMcpFragmentState(settings) {
  const legacy = inspectLegacyClaudeEnabledMcpSettings(settings);
  return { exists: legacy.declaredEnabled, digest: legacy.declaredEnabled ? semanticDigest("dove") : null, fragment: legacy.declaredEnabled ? "dove" : null };
}

function fragmentState(resource, value) {
  if (resource.selector === SETTINGS_SELECTOR) return hookFragmentState(value);
  if (resource.selector === MCP_SELECTOR) return mcpFragmentState(value);
  if (resource.selector === LEGACY_ENABLED_MCP_SELECTOR) return enabledMcpFragmentState(value);
  throw new Error(`Unsupported Dove project integration selector: ${resource.selector}.`);
}

function removeFragment(resource, value, current) {
  if (resource.selector === SETTINGS_SELECTOR) {
    const promptHooks = value.hooks.UserPromptSubmit.filter((_, index) => index !== current.index);
    return { ...value, hooks: { ...value.hooks, UserPromptSubmit: promptHooks } };
  }
  if (resource.selector === MCP_SELECTOR) {
    const servers = { ...value.mcpServers };
    delete servers.dove;
    return { ...value, mcpServers: servers };
  }
  if (resource.selector === LEGACY_ENABLED_MCP_SELECTOR) {
    return { ...value, enabledMcpjsonServers: value.enabledMcpjsonServers.filter((name) => name !== "dove") };
  }
  throw new Error(`Unsupported Dove project integration selector: ${resource.selector}.`);
}

function emptySharedJsonShell(resource, value) {
  if (resource.selector === MCP_SELECTOR) return Object.keys(value).length === 1 && plainObject(value.mcpServers) && Object.keys(value.mcpServers).length === 0;
  if (resource.selector === LEGACY_ENABLED_MCP_SELECTOR) return Object.keys(value).length === 1 && Array.isArray(value.enabledMcpjsonServers) && value.enabledMcpjsonServers.length === 0;
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
    if (observed.digest !== oldEntry.digest && observed.digest !== desired.digest) throw driftError(resource, observed.digest);
    if (observed.digest === desired.digest) return { entry: null, changed: oldEntry.digest !== desired.digest };
    return { entry: transactionWrite(root, desired, desired.content, observed), changed: true };
  }
  if (!observed.exists) return { entry: null, changed: true };
  if (observed.digest !== oldEntry.digest) throw driftError(resource, observed.digest);
  return { entry: transactionDelete(root, resource, observed), changed: true };
}

function planJsonFragment(root, desired, oldEntry, fsOps) {
  const resource = desired ?? oldEntry;
  const observed = inspectRegularProjectFile(root, resource.path, fsOps);
  const value = parseSharedJson(observed, resource.path);
  const current = fragmentState(resource, value);
  if (!oldEntry) {
    if (current.exists) {
      if (current.digest === desired.digest) return { entry: null, changed: false };
      throw conflictError(desired);
    }
    if (desired.selector !== SETTINGS_SELECTOR) throw new Error(`Dove no longer installs project-local fragment ${desired.path}#${desired.selector}.`);
    const merged = mergeClaudeAmbientSettings(value);
    return { entry: merged.changed ? transactionWrite(root, desired, serializeSharedJson(merged.settings), observed) : null, changed: merged.changed };
  }
  if (desired) {
    if (!current.exists || (current.digest !== oldEntry.digest && current.digest !== desired.digest)) throw driftError(resource, current.digest);
    if (current.digest === desired.digest) return { entry: null, changed: oldEntry.digest !== desired.digest };
    if (desired.selector !== SETTINGS_SELECTOR) throw new Error(`Dove no longer installs project-local fragment ${desired.path}#${desired.selector}.`);
    const entries = [...value.hooks.UserPromptSubmit];
    entries[current.index] = DOVE_CLAUDE_AMBIENT_HOOK_ENTRY;
    const next = { ...value, hooks: { ...value.hooks, UserPromptSubmit: entries } };
    return { entry: transactionWrite(root, desired, serializeSharedJson(next), observed), changed: true };
  }
  if (!current.exists) return { entry: null, changed: true };
  if (current.digest !== oldEntry.digest) throw driftError(resource, current.digest);
  const next = removeFragment(resource, value, current);
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
  if (kind === "json-fragment") return planJsonFragment(root, desired, oldEntry, fsOps);
  throw new Error(`Unsupported project integration resource kind: ${kind}.`);
}

function rejectLegacy(root, fsOps) {
  const legacy = inspectLegacyProjectInstallation(root, { fsOps });
  if (legacy.detected) throw new Error(`Unsupported legacy Dove project installation detected at ${root}: ${legacy.evidence.join(", ")}. Run dove upgrade or dove reinstall explicitly.`);
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
  for (const key of [...new Set([...oldByKey.keys(), ...desiredByKey.keys()])].sort()) {
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

export function initializeProjectIntegration(rootOrProject, options = {}) {
  const fsOps = options.fsOps ?? fs;
  assertPackageInput(options.packageName, options.packageVersion, { required: true });
  const hosts = normalizeSelectedHosts(options.hosts, { defaultWhenEmpty: true });
  const now = exactTimestamp(options.now);
  const root = resolveProjectRootForInit(rootOrProject, { fsOps, hostIds: PROJECT_HOST_IDS });
  rejectLegacy(root, fsOps);
  const plan = preparePlan({ root, hosts, packageName: options.packageName, packageVersion: options.packageVersion, now, fsOps });
  return resultFromTransaction("initialized", root, hosts, plan.manifest, writeFileSetTransaction(plan.entries, { fsOps }));
}

function prepareInstalledPlan(start, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const root = resolveInstalledProjectRoot(start, { fsOps, hostIds: PROJECT_HOST_IDS });
  rejectLegacy(root, fsOps);
  const manifest = readProjectInstallationManifest(root, { fsOps, hostIds: PROJECT_HOST_IDS });
  const hosts = options.hosts === undefined ? [...manifest.hosts] : normalizeSelectedHosts(options.hosts, { defaultWhenEmpty: false });
  const packageName = options.packageName ?? manifest.package.name;
  const packageVersion = options.packageVersion ?? manifest.package.version;
  assertPackageInput(packageName, packageVersion, { required: true });
  const plan = preparePlan({ root, hosts, packageName, packageVersion, now: exactTimestamp(options.now), fsOps, manifest });
  return { fsOps, root, hosts, currentManifest: manifest, ...plan };
}

export function syncProjectIntegration(start, options = {}) {
  const prepared = prepareInstalledPlan(start, options);
  const transaction = writeFileSetTransaction(prepared.entries, { fsOps: prepared.fsOps });
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

function recognizedLifecycleMcpFragment(fragment) {
  if (!plainObject(fragment) || fragment.type !== "stdio" || !Array.isArray(fragment.args)) return false;
  if (fragment.command === "dove") return sameArray(fragment.args, ["mcp", "serve", "--project", "."]);
  return fragment.command === "node" && fragment.args.length === 1 && LEGACY_DOVE_MCP_BUNDLE_ARGS.has(fragment.args[0]);
}

function recognizedLifecycleHook(entry) {
  if (!plainObject(entry) || !Array.isArray(entry.hooks) || entry.hooks.length !== 1) return false;
  const hook = entry.hooks[0];
  return plainObject(hook)
    && hook.type === "command"
    && typeof hook.command === "string"
    && (hook.command === DOVE_CLAUDE_AMBIENT_HOOK_COMMAND || hook.command === "node ./scripts/dove-user-prompt-submit-package.mjs");
}

function planRecognizedSharedCleanup(root, relativePath, fsOps, { installClaude }) {
  const observed = inspectRegularProjectFile(root, relativePath, fsOps);
  const value = parseSharedJson(observed, relativePath);
  let next = value;
  if (relativePath === MCP_PATH || relativePath === ".opencode.json") {
    if (value.mcpServers !== undefined && !plainObject(value.mcpServers)) throw new Error(`${relativePath} mcpServers must be a JSON object.`);
    if (Object.hasOwn(value.mcpServers ?? {}, "dove")) {
      if (!recognizedLifecycleMcpFragment(value.mcpServers.dove)) throw new Error(`${relativePath} contains an ambiguous non-Dove fragment at /mcpServers/dove.`);
      const servers = { ...value.mcpServers };
      delete servers.dove;
      next = { ...value, mcpServers: servers };
    }
  } else if (relativePath === DOVE_CLAUDE_SETTINGS_PATH) {
    const entries = value.hooks?.UserPromptSubmit;
    if (entries !== undefined && !Array.isArray(entries)) throw new Error(`${relativePath} hooks.UserPromptSubmit must be an array.`);
    const doveEntries = (entries ?? []).filter(referencesDoveHook);
    if (doveEntries.length > 1 || doveEntries.some((entry) => !recognizedLifecycleHook(entry))) throw new Error(`${relativePath} contains an ambiguous Dove UserPromptSubmit hook.`);
    if (doveEntries.length === 1) next = { ...value, hooks: { ...value.hooks, UserPromptSubmit: entries.filter((entry) => !referencesDoveHook(entry)) } };
    if (installClaude) next = mergeClaudeAmbientSettings(next).settings;
  } else if (relativePath === DOVE_CLAUDE_LOCAL_SETTINGS_PATH) {
    inspectLegacyClaudeEnabledMcpSettings(value);
    if ((value.enabledMcpjsonServers ?? []).includes("dove")) next = { ...value, enabledMcpjsonServers: value.enabledMcpjsonServers.filter((name) => name !== "dove") };
  }
  if (canonicalJson(next) === canonicalJson(value)) return null;
  const emptyShell = (relativePath === MCP_PATH || relativePath === ".opencode.json")
    ? Object.keys(next).length === 1 && Object.keys(next.mcpServers ?? {}).length === 0
    : relativePath === DOVE_CLAUDE_LOCAL_SETTINGS_PATH
      ? Object.keys(next).length === 1 && (next.enabledMcpjsonServers ?? []).length === 0
      : false;
  return emptyShell
    ? transactionDelete(root, { path: relativePath }, observed)
    : transactionWrite(root, { path: relativePath }, serializeSharedJson(next), observed);
}

function knownRetiredFile(root, relativePath, fsOps, manifestDigests = new Map()) {
  const observed = inspectRegularProjectFile(root, relativePath, fsOps);
  if (!observed.exists) return null;
  const authorizedByManifest = manifestDigests.get(relativePath)?.has(observed.digest) === true;
  const recognizedKnownContent = KNOWN_RETIRED_DIGESTS.get(relativePath)?.has(observed.digest) === true;
  if (!authorizedByManifest && !recognizedKnownContent) {
    throw new Error(`Dove lifecycle refuses to remove retired file with unrecognized content: ${relativePath}.`);
  }
  return transactionDelete(root, { path: relativePath }, observed);
}

function manifestDigestInventory(manifest) {
  const result = new Map();
  for (const entry of manifest?.managed ?? []) {
    if (entry.kind !== "exclusive-file") continue;
    if (!result.has(entry.path)) result.set(entry.path, new Set());
    result.get(entry.path).add(entry.digest);
  }
  return result;
}

function knownCopiedRuntime(root, relativePath, fsOps) {
  const observed = inspectRegularProjectFile(root, relativePath, fsOps);
  if (!observed.exists) return null;
  const probe = LEGACY_PROJECT_BUNDLE_PROBES.find((entry) => entry.path === relativePath);
  const content = observed.bytes.toString("utf8");
  if ((probe?.signatures ?? []).filter((signature) => content.includes(signature)).length < 2) {
    throw new Error(`Dove lifecycle cannot safely remove copied runtime without affirmative Dove signatures: ${relativePath}.`);
  }
  return transactionDelete(root, { path: relativePath }, observed);
}

function walkDeletion(root, relativePath, fsOps, entries, scope) {
  const absolutePath = path.join(root, relativePath);
  const stat = lstatOrNull(fsOps, absolutePath);
  if (stat === null) return;
  if (stat.isSymbolicLink()) throw new Error(`Dove lifecycle refuses symbolic links in destructive scope: ${relativePath}.`);
  if (stat.isFile()) {
    const observed = inspectRegularProjectFile(root, relativePath, fsOps);
    entries.push(transactionDelete(root, { path: relativePath }, observed));
    scope.push({ path: relativePath, kind: "file", digest: observed.digest });
    return;
  }
  if (!stat.isDirectory()) throw new Error(`Dove lifecycle found unsupported project state: ${relativePath}.`);
  for (const child of fsOps.readdirSync(absolutePath).map(String).sort()) walkDeletion(root, path.posix.join(relativePath, child), fsOps, entries, scope);
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

function lifecycleManifest(options, hosts, now, source = null) {
  return createProjectInstallationManifest({
    package: { name: options.packageName, version: options.packageVersion },
    hosts,
    managed: desiredManaged(resourcesForHosts(hosts)),
    createdAt: source?.createdAt ?? now,
    updatedAt: now
  }, { hostIds: PROJECT_HOST_IDS });
}

function migrationSource(root, fsOps) {
  const current = lstatOrNull(fsOps, path.join(root, INSTALLATION_MANIFEST_PATH));
  const legacy = lstatOrNull(fsOps, path.join(root, LEGACY_INSTALLATION_MANIFEST_PATH));
  if (current !== null && legacy !== null) throw new Error("Dove Upgrade found both current and 1.0 project installation manifests.");
  if (current !== null) return readProjectInstallationManifestForMigration(root, { fsOps, hostIds: PROJECT_HOST_IDS, manifestPath: INSTALLATION_MANIFEST_PATH });
  if (legacy !== null) return readProjectInstallationManifestForMigration(root, { fsOps, hostIds: PROJECT_HOST_IDS, manifestPath: LEGACY_INSTALLATION_MANIFEST_PATH });
  throw new Error("Dove Upgrade requires an installation revision 1.0 manifest.");
}

function prepareLifecycleIntegration(root, options, { hosts, source = null, reinstall = false }) {
  const fsOps = options.fsOps ?? fs;
  const entries = [];
  const scope = [];
  const manifestDigests = manifestDigestInventory(source);
  for (const relativePath of [MCP_PATH, DOVE_CLAUDE_SETTINGS_PATH, DOVE_CLAUDE_LOCAL_SETTINGS_PATH, ".opencode.json"]) {
    const entry = planRecognizedSharedCleanup(root, relativePath, fsOps, { installClaude: hosts.includes(CLAUDE_HOST) });
    if (entry) entries.push(entry);
  }
  for (const relativePath of RETIRED_EXCLUSIVE_PATHS) {
    const entry = knownRetiredFile(root, relativePath, fsOps, manifestDigests);
    if (entry) entries.push(entry);
  }
  for (const relativePath of [...PACKAGE_RUNTIME_PATHS, ...RETIRED_PACKAGE_RUNTIME_PATHS]) {
    const entry = knownCopiedRuntime(root, relativePath, fsOps);
    if (entry) entries.push(entry);
  }
  const desired = resourcesForHosts(hosts);
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
  if (reinstall) {
    const replacedPaths = new Set(planned.entries.filter((entry) => entry.delete !== true).map((entry) => entry.relativePath));
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      if (replacedPaths.has(entries[index].relativePath)) entries.splice(index, 1);
    }
  }
  const duplicatePaths = new Set(entries.map((entry) => entry.relativePath));
  for (const entry of planned.entries) {
    if (duplicatePaths.has(entry.relativePath)) continue;
    entries.push(entry);
  }
  if (reinstall) {
    const doveRoot = path.join(root, ".dove");
    const doveStat = lstatOrNull(fsOps, doveRoot);
    if (doveStat !== null) {
      if (doveStat.isSymbolicLink() || !doveStat.isDirectory()) throw new Error("Complete Reinstall requires .dove to be a real directory.");
      for (const child of fsOps.readdirSync(doveRoot).map(String).sort()) {
        if (child !== "install") walkDeletion(root, `.dove/${child}`, fsOps, entries, scope);
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
  } else if (source?.sourcePath === LEGACY_INSTALLATION_MANIFEST_PATH) {
    const legacyDirectory = lstatOrNull(fsOps, path.join(root, ".dove-install"));
    if (legacyDirectory?.isSymbolicLink() || (legacyDirectory !== null && !legacyDirectory.isDirectory())) {
      throw new Error("Dove Upgrade requires .dove-install to be a real directory.");
    }
    const legacyChildren = legacyDirectory === null ? [] : fsOps.readdirSync(path.join(root, ".dove-install")).map(String).sort();
    if (!sameArray(legacyChildren, ["manifest.json"])) {
      throw new Error("Dove Upgrade requires .dove-install to contain only its 1.0 manifest.");
    }
    const legacyObserved = inspectRegularProjectFile(root, LEGACY_INSTALLATION_MANIFEST_PATH, fsOps);
    entries.push(transactionDelete(root, { path: LEGACY_INSTALLATION_MANIFEST_PATH }, legacyObserved));
    if (legacyDirectory?.isDirectory()) {
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
  return { entries, manifest: planned.manifest, scope, desired };
}

function previewShape(kind, root, hosts, prepared, confirmationRequired) {
  const writtenPaths = prepared.entries.filter((entry) => entry.delete !== true).map((entry) => entry.relativePath);
  const removedPaths = prepared.entries.filter((entry) => entry.delete === true).map((entry) => entry.relativePath);
  return {
    status: "ready",
    action: kind,
    target: root,
    hosts: [...hosts],
    writtenPaths,
    removedPaths,
    changedPaths: [...new Set([...writtenPaths, ...removedPaths])],
    destructiveScope: prepared.scope,
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
  return resultFromTransaction("upgraded", root, hosts, prepared.manifest, writeFileSetTransaction(prepared.entries, { fsOps }));
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
  return resultFromTransaction("reinstalled", root, hosts, prepared.manifest, writeFileSetTransaction(prepared.entries, { fsOps, transactionBase: ".dove-transaction" }));
}

export const PROJECT_INTEGRATION_MANAGED_PATHS = Object.freeze(claudeResources().map((resource) => resource.path).sort());
export const PROJECT_INTEGRATION_CLAUDE_HOOK_COMMAND = DOVE_CLAUDE_AMBIENT_HOOK_COMMAND;
