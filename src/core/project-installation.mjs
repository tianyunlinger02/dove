import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  DOVE_CLAUDE_AMBIENT_HOOK_COMMAND,
  DOVE_CLAUDE_AMBIENT_HOOK_ENTRY,
  DOVE_CLAUDE_SETTINGS_PATH,
  mergeClaudeAmbientSettings
} from "./ambient-policy.mjs";
import {
  CURRENT_MANAGED_PATHS,
  INSTALLED_DOVE_MCP_SERVER,
  PACKAGE_RUNTIME_PATHS,
  RETIRED_MANAGED_PATHS
} from "./command-manifest.mjs";
import {
  DOVE_CLAUDE_LOCAL_SETTINGS_PATH,
  DOVE_CLAUDE_MCP_APPROVAL_SELECTOR,
  inspectClaudeMcpApprovalSettings,
  mergeClaudeMcpApprovalSettings,
  removeClaudeMcpApprovalSettings
} from "./claude-project-settings.mjs";
import { inspectDirectoryTreeDigest, writeFileSetTransaction } from "./file-set-transaction.mjs";
import { PROJECT_HOST_IDS, normalizeHostSelection } from "./host-registry.mjs";
import {
  LEGACY_PROJECT_BUNDLE_PROBES,
  inspectLegacyProjectInstallation
} from "./project-legacy-installation.mjs";
import {
  INSTALLATION_MANIFEST_PATH,
  LEGACY_INSTALLATION_MANIFEST_PATH,
  createProjectInstallationManifest,
  isPreviousProjectInstallationManifest,
  readLegacyProjectInstallationManifest,
  readProjectInstallationManifest,
  serializeProjectInstallationManifest
} from "./project-installation-manifest.mjs";
import { resolveInstalledProjectRoot, resolveProjectRootForInit } from "./project-root.mjs";
import { parseJsonWithoutDuplicateKeys } from "./strict-json.mjs";
import { generatedAdapterEntries, generatedClaudeAmbientProjectEntries } from "../../scripts/generate-command-adapters.mjs";
import { generatedRoleDefinitionEntries } from "./role-definitions.mjs";

const MCP_PATH = ".mcp.json";
const MCP_SELECTOR = "/mcpServers/dove";
const SETTINGS_SELECTOR = "/hooks/UserPromptSubmit[dove-user-prompt-submit]";
const MCP_APPROVAL_DIGEST = semanticDigest("dove");
const CLAUDE_HOST = "claude";
const MANIFEST_OWNER = "integration:manifest";
const FORBIDDEN_RESOURCE_PREFIXES = [".dove/", "bin/", "dist/", "mcp/", "scripts/"];
const PREVIOUS_CLAUDE_INIT_PATH = ".claude/commands/dove/init.md";
const RETIRED_DOMAIN_COMMAND_PATHS = Object.freeze([
  ".claude/commands/dove/version.md"
]);
const UPGRADE_PREVIEW_TYPE = "project-upgrade";
const UPGRADE_PREVIEW_VERSION = 1;
const COMPLETE_REINSTALL_PREVIEW_TYPE = "project-complete-reinstall";
const COMPLETE_REINSTALL_PREVIEW_VERSION = 1;
const LIFECYCLE_SHARED_JSON_PATHS = Object.freeze([
  MCP_PATH,
  DOVE_CLAUDE_SETTINGS_PATH,
  DOVE_CLAUDE_LOCAL_SETTINGS_PATH,
  ".opencode.json"
]);
const LEGACY_DOVE_MCP_BUNDLE_ARGS = Object.freeze(new Set([
  "./mcp/dove-state-server-package.mjs",
  "${CLAUDE_PROJECT_DIR:-.}/mcp/dove-state-server-package.mjs"
]));
const PREVIOUS_CLAUDE_INIT_DIGESTS = Object.freeze(new Set([
  "8bc54cb154048273c4e6f8b5c77ae76453d2cff788c98bab6fc4882bc2a7dc5e"
]));

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
  return `${entry.path}\0${entry.mode}\0${entry.selector ?? ""}\0${entry.owner}`;
}

function sameArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function samePackage(left, right) {
  return left.name === right.name && left.version === right.version;
}

function sameManaged(left, right) {
  return left.length === right.length && left.every((entry, index) => managedKey(entry) === managedKey(right[index]) && entry.digest === right[index].digest);
}

function exactTimestamp(value) {
  if (value === undefined) return new Date().toISOString();
  const timestamp = value instanceof Date ? value.toISOString() : value;
  if (typeof timestamp !== "string" || new Date(timestamp).toISOString() !== timestamp) {
    throw new Error("Project integration now must be a Date or exact ISO timestamp.");
  }
  return timestamp;
}

function assertPackageInput(packageName, packageVersion, { required }) {
  if (!required && packageName === undefined && packageVersion === undefined) return;
  if (typeof packageName !== "string" || !packageName || packageName !== packageName.trim() || packageName.includes("\0")) {
    throw new Error("Project integration packageName must be a non-empty trimmed string.");
  }
  if (typeof packageVersion !== "string" || !packageVersion || packageVersion !== packageVersion.trim()) {
    throw new Error("Project integration packageVersion must be a semantic version string.");
  }
}

function normalizeSelectedHosts(raw, { defaultWhenEmpty }) {
  if (Array.isArray(raw) && raw.length === 0) throw new Error("Dove project integration requires at least one host.");
  const hosts = normalizeHostSelection(raw, { defaultWhenEmpty, requireInitializable: true });
  if (hosts.length === 0) throw new Error("Dove project integration requires at least one host.");
  return [...hosts];
}

function assertManagedResourcePath(relativePath) {
  if (relativePath === ".dove" || relativePath.startsWith(".dove/")) {
    throw new Error(`Project integration resources must not manage Dove workspace state: ${relativePath}.`);
  }
  if (FORBIDDEN_RESOURCE_PREFIXES.some((prefix) => relativePath.startsWith(prefix))) {
    throw new Error(`Project integration resources must not install runtime bundles: ${relativePath}.`);
  }
}

function claudeResources() {
  const claudeRoleEntries = generatedRoleDefinitionEntries()
    .filter((entry) => entry.relativePath.startsWith(".claude/agents/"));
  const exclusiveEntries = [
    ...generatedAdapterEntries().filter((entry) => entry.hostId === CLAUDE_HOST),
    ...generatedClaudeAmbientProjectEntries(),
    ...claudeRoleEntries
  ].map((entry) => {
    assertManagedResourcePath(entry.relativePath);
    const content = normalizedGeneratedContent(entry.content);
    return {
      hostId: CLAUDE_HOST,
      kind: "exclusive",
      path: entry.relativePath,
      owner: `host:${CLAUDE_HOST}:file:${entry.relativePath}`,
      mode: "exclusive-file",
      selector: null,
      content,
      digest: sha256(content)
    };
  });

  const fragments = [
    {
      hostId: CLAUDE_HOST,
      kind: "mcp-fragment",
      path: MCP_PATH,
      owner: `host:${CLAUDE_HOST}:mcp:dove`,
      mode: "json-fragment",
      selector: MCP_SELECTOR,
      fragment: INSTALLED_DOVE_MCP_SERVER,
      digest: semanticDigest(INSTALLED_DOVE_MCP_SERVER)
    },
    {
      hostId: CLAUDE_HOST,
      kind: "settings-fragment",
      path: DOVE_CLAUDE_SETTINGS_PATH,
      owner: `host:${CLAUDE_HOST}:ambient-hook`,
      mode: "json-fragment",
      selector: SETTINGS_SELECTOR,
      fragment: DOVE_CLAUDE_AMBIENT_HOOK_ENTRY,
      digest: semanticDigest(DOVE_CLAUDE_AMBIENT_HOOK_ENTRY)
    },
    {
      hostId: CLAUDE_HOST,
      kind: "mcp-approval-fragment",
      path: DOVE_CLAUDE_LOCAL_SETTINGS_PATH,
      owner: `host:${CLAUDE_HOST}:mcp-approval:dove`,
      mode: "json-fragment",
      selector: DOVE_CLAUDE_MCP_APPROVAL_SELECTOR,
      fragment: "dove",
      digest: MCP_APPROVAL_DIGEST
    }
  ];
  fragments.forEach((entry) => assertManagedResourcePath(entry.path));

  const resources = [...exclusiveEntries, ...fragments];
  const keys = resources.map(managedKey);
  if (new Set(keys).size !== keys.length) throw new Error("Generated project integration resources contain duplicate ownership entries.");
  return resources;
}

function resourcesForHosts(hosts) {
  const resources = claudeResources().filter((entry) => hosts.includes(entry.hostId));
  return resources.sort((left, right) => managedKey(left).localeCompare(managedKey(right)));
}

function retiredExclusiveResource(oldEntry) {
  return {
    hostId: CLAUDE_HOST,
    kind: "exclusive",
    path: oldEntry.path,
    owner: oldEntry.owner,
    mode: oldEntry.mode,
    selector: oldEntry.selector,
    content: null,
    digest: oldEntry.digest
  };
}

function previousManifestRetiredResources(manifest) {
  if (!isPreviousProjectInstallationManifest(manifest)) return [];
  return manifest.managed.flatMap((entry) => {
    if (entry.path !== PREVIOUS_CLAUDE_INIT_PATH || entry.mode !== "exclusive-file" || entry.selector !== null) return [];
    if (!PREVIOUS_CLAUDE_INIT_DIGESTS.has(entry.digest)) {
      throw new Error(`Previous Dove project installation manifest has an unrecognized retired resource digest at ${entry.path}.`);
    }
    return [retiredExclusiveResource(entry)];
  });
}

function currentManifestRetiredDomainResources(manifest) {
  if (isPreviousProjectInstallationManifest(manifest)) return [];
  const retiredEntries = manifest.managed.filter((entry) => RETIRED_DOMAIN_COMMAND_PATHS.includes(entry.path));
  if (retiredEntries.length === 0) return [];
  if (retiredEntries.length !== RETIRED_DOMAIN_COMMAND_PATHS.length
    || RETIRED_DOMAIN_COMMAND_PATHS.some((retiredPath) => !retiredEntries.some((entry) => entry.path === retiredPath))) {
    throw new Error("Dove project installation manifest contains an incomplete retired domain command inventory.");
  }
  for (const entry of retiredEntries) {
    if (entry.mode !== "exclusive-file" || entry.selector !== null || entry.owner !== `host:${CLAUDE_HOST}:file:${entry.path}`) {
      throw new Error(`Dove project installation manifest contains invalid retired domain command ownership at ${entry.path}.`);
    }
  }
  return retiredEntries.map(retiredExclusiveResource);
}

function manifestRetiredResources(manifest) {
  return [
    ...previousManifestRetiredResources(manifest),
    ...currentManifestRetiredDomainResources(manifest)
  ];
}

function lstatOrNull(fsOps, absolutePath) {
  try {
    return fsOps.lstatSync(absolutePath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function inspectRegularProjectFile(root, relativePath, fsOps) {
  let current = root;
  const components = relativePath.split("/");
  for (let index = 0; index < components.length; index += 1) {
    current = path.join(current, components[index]);
    const stat = lstatOrNull(fsOps, current);
    if (stat === null) return { exists: false, bytes: null, digest: null, mode: null };
    if (stat.isSymbolicLink()) throw new Error(`Dove project integration path must not be a symbolic link: ${relativePath}.`);
    if (index < components.length - 1) {
      if (!stat.isDirectory()) throw new Error(`Dove project integration parent must be a directory: ${relativePath}.`);
      continue;
    }
    if (!stat.isFile()) throw new Error(`Dove project integration path must be absent or a regular file: ${relativePath}.`);
    const bytes = fsOps.readFileSync(current);
    return { exists: true, bytes, digest: sha256(bytes), mode: stat.mode & 0o7777 };
  }
  throw new Error(`Invalid Dove project integration path: ${relativePath}.`);
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
  if (!plainObject(entry) || !Array.isArray(entry.hooks)) return false;
  return entry.hooks.some((hook) => plainObject(hook)
    && typeof hook.command === "string"
    && (hook.command.includes("dove hook user-prompt-submit") || hook.command.includes("dove-user-prompt-submit-package.mjs")));
}

function recognizedLifecycleDoveHookEntry(entry) {
  if (!plainObject(entry) || Object.keys(entry).length !== 1 || !Array.isArray(entry.hooks) || entry.hooks.length !== 1) return false;
  const hook = entry.hooks[0];
  if (!plainObject(hook) || hook.type !== "command" || typeof hook.command !== "string") return false;
  if (Object.keys(hook).some((key) => !["type", "command", "timeout"].includes(key))) return false;
  if (hook.command === DOVE_CLAUDE_AMBIENT_HOOK_COMMAND) return hook.timeout === 10;
  return hook.command === "node ./scripts/dove-user-prompt-submit-package.mjs" && (hook.timeout === undefined || hook.timeout === 10);
}

function mcpApprovalFragmentState(settings) {
  const approval = inspectClaudeMcpApprovalSettings(settings);
  return {
    exists: approval.approved,
    disabled: approval.disabled,
    digest: approval.approved ? MCP_APPROVAL_DIGEST : null
  };
}

function settingsFragmentState(settings) {
  if (settings.hooks !== undefined && !plainObject(settings.hooks)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} hooks must be a JSON object.`);
  const promptHooks = settings.hooks?.UserPromptSubmit;
  if (promptHooks !== undefined && !Array.isArray(promptHooks)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} hooks.UserPromptSubmit must be an array.`);
  const entries = promptHooks ?? [];
  const candidates = entries.map((entry, index) => ({ entry, index })).filter(({ entry }) => referencesDoveHook(entry));
  if (candidates.length > 1) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} defines multiple Dove-managed UserPromptSubmit hooks.`);
  if (candidates.length === 0) return { exists: false, digest: null, index: -1, entry: null };
  return { exists: true, digest: semanticDigest(candidates[0].entry), index: candidates[0].index, entry: candidates[0].entry };
}

function mcpFragmentState(config) {
  if (config.mcpServers !== undefined && !plainObject(config.mcpServers)) throw new Error(`${MCP_PATH} mcpServers must be a JSON object.`);
  if (!Object.hasOwn(config.mcpServers ?? {}, "dove")) return { exists: false, digest: null, fragment: null };
  const fragment = config.mcpServers.dove;
  return { exists: true, digest: semanticDigest(fragment), fragment };
}

function driftError(resource, currentDigest) {
  const current = currentDigest ?? "absent";
  return new Error(`Dove project integration ownership drift at ${resource.path}${resource.selector ? `#${resource.selector}` : ""}; current digest ${current} matches neither the manifest nor the expected resource.`);
}

function conflictError(resource) {
  return new Error(`Dove project integration cannot claim conflicting content at ${resource.path}${resource.selector ? `#${resource.selector}` : ""}.`);
}

function transactionWrite(root, resource, content) {
  return { root, relativePath: resource.path, content, encoding: "utf8", force: true, label: `Dove project integration resource ${resource.path}` };
}

function transactionDelete(root, resource) {
  return { root, relativePath: resource.path, delete: true, force: true, label: `Dove project integration resource ${resource.path}` };
}

function planExclusive(root, resource, oldEntry, selected, fsOps) {
  const state = inspectRegularProjectFile(root, resource.path, fsOps);
  if (!oldEntry) {
    if (!selected) throw new Error(`Cannot remove unowned project integration resource: ${resource.path}.`);
    if (!state.exists) return { entry: transactionWrite(root, resource, resource.content), changed: true };
    if (state.digest === resource.digest) return { entry: null, changed: false };
    throw conflictError(resource);
  }
  if (selected) {
    if (state.digest !== oldEntry.digest && state.digest !== resource.digest) throw driftError(resource, state.digest);
    if (state.digest === resource.digest) return { entry: null, changed: oldEntry.digest !== resource.digest };
    return { entry: transactionWrite(root, resource, resource.content), changed: true };
  }
  if (state.digest !== oldEntry.digest) throw driftError(resource, state.digest);
  return { entry: transactionDelete(root, resource), changed: true };
}

function planMcpFragment(root, resource, oldEntry, selected, fsOps) {
  const state = inspectRegularProjectFile(root, resource.path, fsOps);
  const config = parseSharedJson(state, resource.path);
  const current = mcpFragmentState(config);
  if (!oldEntry) {
    if (!selected) throw new Error(`Cannot remove unowned project integration fragment: ${resource.path}#${resource.selector}.`);
    if (current.exists) {
      if (current.digest === resource.digest) return { entry: null, changed: false };
      throw conflictError(resource);
    }
    const merged = { ...config, mcpServers: { ...(config.mcpServers ?? {}), dove: INSTALLED_DOVE_MCP_SERVER } };
    return { entry: transactionWrite(root, resource, serializeSharedJson(merged)), changed: true };
  }
  if (!current.exists || (current.digest !== oldEntry.digest && current.digest !== resource.digest)) throw driftError(resource, current.digest);
  if (selected) {
    if (current.digest === resource.digest) return { entry: null, changed: oldEntry.digest !== resource.digest };
    const merged = { ...config, mcpServers: { ...config.mcpServers, dove: INSTALLED_DOVE_MCP_SERVER } };
    return { entry: transactionWrite(root, resource, serializeSharedJson(merged)), changed: true };
  }
  const servers = { ...config.mcpServers };
  delete servers.dove;
  return { entry: transactionWrite(root, resource, serializeSharedJson({ ...config, mcpServers: servers })), changed: true };
}

function planMcpApprovalFragment(root, resource, oldEntry, selected, fsOps) {
  const state = inspectRegularProjectFile(root, resource.path, fsOps);
  const settings = parseSharedJson(state, resource.path);
  const current = mcpApprovalFragmentState(settings);
  if (current.disabled) {
    throw new Error(`${DOVE_CLAUDE_LOCAL_SETTINGS_PATH} explicitly disables the Dove MCP server; Dove will not override that decision.`);
  }
  if (!oldEntry) {
    if (!selected) throw new Error(`Cannot remove unowned project integration fragment: ${resource.path}#${resource.selector}.`);
    if (current.exists) return { entry: null, changed: false };
    const merged = mergeClaudeMcpApprovalSettings(settings);
    return { entry: transactionWrite(root, resource, serializeSharedJson(merged.settings)), changed: true };
  }
  if (!current.exists || (current.digest !== oldEntry.digest && current.digest !== resource.digest)) {
    throw driftError(resource, current.digest);
  }
  if (selected) return { entry: null, changed: oldEntry.digest !== resource.digest };
  const merged = removeClaudeMcpApprovalSettings(settings);
  return merged.changed
    ? { entry: transactionWrite(root, resource, serializeSharedJson(merged.settings)), changed: true }
    : { entry: null, changed: false };
}

function planSettingsFragment(root, resource, oldEntry, selected, fsOps) {
  const state = inspectRegularProjectFile(root, resource.path, fsOps);
  const settings = parseSharedJson(state, resource.path);
  const current = settingsFragmentState(settings);
  if (!oldEntry) {
    if (!selected) throw new Error(`Cannot remove unowned project integration fragment: ${resource.path}#${resource.selector}.`);
    if (current.exists) {
      if (current.digest === resource.digest) return { entry: null, changed: false };
      throw conflictError(resource);
    }
    const merged = mergeClaudeAmbientSettings(settings);
    if (!merged.changed) return { entry: null, changed: false };
    return { entry: transactionWrite(root, resource, serializeSharedJson(merged.settings)), changed: true };
  }
  if (!current.exists || (current.digest !== oldEntry.digest && current.digest !== resource.digest)) throw driftError(resource, current.digest);
  if (selected) {
    if (current.digest === resource.digest) return { entry: null, changed: oldEntry.digest !== resource.digest };
    const promptHooks = [...settings.hooks.UserPromptSubmit];
    promptHooks[current.index] = DOVE_CLAUDE_AMBIENT_HOOK_ENTRY;
    const merged = { ...settings, hooks: { ...settings.hooks, UserPromptSubmit: promptHooks } };
    return { entry: transactionWrite(root, resource, serializeSharedJson(merged)), changed: true };
  }
  const promptHooks = settings.hooks.UserPromptSubmit.filter((_, index) => index !== current.index);
  const merged = { ...settings, hooks: { ...settings.hooks, UserPromptSubmit: promptHooks } };
  return { entry: transactionWrite(root, resource, serializeSharedJson(merged)), changed: true };
}

function planResource(root, resource, oldEntry, selected, fsOps) {
  if (resource.kind === "exclusive") return planExclusive(root, resource, oldEntry, selected, fsOps);
  if (resource.kind === "mcp-fragment") return planMcpFragment(root, resource, oldEntry, selected, fsOps);
  if (resource.kind === "mcp-approval-fragment") return planMcpApprovalFragment(root, resource, oldEntry, selected, fsOps);
  if (resource.kind === "settings-fragment") return planSettingsFragment(root, resource, oldEntry, selected, fsOps);
  throw new Error(`Unsupported project integration resource kind: ${resource.kind}.`);
}

function rejectLegacy(root, fsOps) {
  const legacy = inspectLegacyProjectInstallation(root, { fsOps });
  if (legacy.detected) {
    throw new Error(`Unsupported legacy Dove project installation detected at ${root}: ${legacy.evidence.join(", ")}. Remove or migrate the legacy installation before continuing.`);
  }
}

function assertManifestInventory(manifest, allResources) {
  const retired = manifestRetiredResources(manifest);
  const selectedResources = resourcesForHosts(manifest.hosts);
  const expectedKeys = new Set([...selectedResources, ...retired].map(managedKey));
  const actualKeys = new Set(manifest.managed.map(managedKey));
  if (expectedKeys.size !== actualKeys.size || [...actualKeys].some((key) => !expectedKeys.has(key))) {
    throw new Error("Dove project installation manifest ownership inventory does not match its selected hosts and versioned migration inventory.");
  }
  const knownKeys = new Set([...allResources, ...retired].map(managedKey));
  if (manifest.managed.some((entry) => !knownKeys.has(managedKey(entry)))) {
    throw new Error("Dove project installation manifest contains unknown managed ownership entries.");
  }
}

function preparePlan({ root, hosts, packageName, packageVersion, now, fsOps, manifest = null }) {
  const currentResources = claudeResources();
  const allResources = manifest ? [...currentResources, ...manifestRetiredResources(manifest)] : currentResources;
  if (manifest) assertManifestInventory(manifest, currentResources);
  const oldByKey = new Map((manifest?.managed ?? []).map((entry) => [managedKey(entry), entry]));
  const desiredResources = resourcesForHosts(hosts);
  const desiredKeys = new Set(desiredResources.map(managedKey));
  const resourceByKey = new Map(allResources.map((entry) => [managedKey(entry), entry]));
  const keys = new Set([...oldByKey.keys(), ...desiredKeys]);
  const entries = [];
  let resourcesChanged = false;

  for (const key of [...keys].sort()) {
    const resource = resourceByKey.get(key);
    if (!resource) throw new Error("Dove project installation manifest references an unknown resource.");
    const planned = planResource(root, resource, oldByKey.get(key) ?? null, desiredKeys.has(key), fsOps);
    if (planned.entry) entries.push(planned.entry);
    if (planned.changed) resourcesChanged = true;
  }

  const managed = desiredResources.map((resource) => ({
    path: resource.path,
    owner: resource.owner,
    mode: resource.mode,
    selector: resource.selector,
    digest: resource.digest
  }));
  const packageInfo = { name: packageName, version: packageVersion };
  const selectionChanged = manifest ? !sameArray(manifest.hosts, hosts) : true;
  const packageChanged = manifest ? !samePackage(manifest.package, packageInfo) : true;
  const ownershipChanged = manifest ? !sameManaged(manifest.managed, [...managed].sort((left, right) => managedKey(left).localeCompare(managedKey(right)))) : true;
  const manifestChanged = manifest === null || resourcesChanged || selectionChanged || packageChanged || ownershipChanged;
  const nextManifest = manifestChanged
    ? createProjectInstallationManifest({
      ...(manifest ? { installationId: manifest.installationId, createdAt: manifest.createdAt } : {}),
      package: packageInfo,
      hosts,
      managed,
      updatedAt: now,
      ...(!manifest ? { createdAt: now } : {})
    }, { hostIds: PROJECT_HOST_IDS })
    : manifest;

  if (manifestChanged) {
    entries.push({
      root,
      relativePath: INSTALLATION_MANIFEST_PATH,
      content: serializeProjectInstallationManifest(nextManifest, { hostIds: PROJECT_HOST_IDS }),
      encoding: "utf8",
      force: true,
      label: MANIFEST_OWNER
    });
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
    transactionState: transaction.transactionState,
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
  const plan = preparePlan({
    root,
    hosts,
    packageName: options.packageName,
    packageVersion: options.packageVersion,
    now,
    fsOps
  });
  const transaction = writeFileSetTransaction(plan.entries, { fsOps });
  return resultFromTransaction("initialized", root, hosts, plan.manifest, transaction);
}

function prepareInstalledPlan(start, options) {
  const fsOps = options.fsOps ?? fs;
  const root = resolveInstalledProjectRoot(start, { fsOps, hostIds: PROJECT_HOST_IDS });
  rejectLegacy(root, fsOps);
  const manifest = readProjectInstallationManifest(root, { fsOps, hostIds: PROJECT_HOST_IDS, allowPrevious: true });
  const hosts = options.hosts === undefined
    ? [...manifest.hosts]
    : normalizeSelectedHosts(options.hosts, { defaultWhenEmpty: false });
  const packageName = options.packageName ?? manifest.package.name;
  const packageVersion = options.packageVersion ?? manifest.package.version;
  assertPackageInput(packageName, packageVersion, { required: true });
  const now = exactTimestamp(options.now);
  const plan = preparePlan({ root, hosts, packageName, packageVersion, now, fsOps, manifest });
  return { fsOps, root, hosts, currentManifest: manifest, ...plan };
}

export function syncProjectIntegration(start, options = {}) {
  const prepared = prepareInstalledPlan(start, options);
  const transaction = writeFileSetTransaction(prepared.entries, { fsOps: prepared.fsOps });
  const status = transaction.changedPaths.length === 0 ? "unchanged" : "synchronized";
  return resultFromTransaction(status, prepared.root, prepared.hosts, prepared.manifest, transaction);
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
    transactionState: null,
    manifest: prepared.currentManifest
  };
}

function canonicalLifecycleRoot(start, fsOps) {
  const resolved = path.resolve(start ?? process.cwd());
  const stat = fsOps.lstatSync(resolved);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Dove lifecycle project root must be a real directory: ${resolved}.`);
  return typeof fsOps.realpathSync.native === "function" ? fsOps.realpathSync.native(resolved) : fsOps.realpathSync(resolved);
}

function lifecyclePathState(root, relativePath, fsOps) {
  const state = inspectRegularProjectFile(root, relativePath, fsOps);
  return { ...state, relativePath };
}

function expectedLifecycleFileState(state) {
  return state.exists
    ? { exists: true, type: "file", sha256: state.digest, mode: state.mode }
    : { exists: false, type: "absent", sha256: null, mode: null };
}

function bindLifecycleFileState(root, relativePath, state, entry = null) {
  const expectedState = expectedLifecycleFileState(state);
  return entry === null
    ? { root, relativePath, assertOnly: true, expectedState, label: `Dove lifecycle replay assertion ${relativePath}` }
    : { ...entry, expectedState };
}

function lifecycleReservedPaths() {
  return [...new Set([
    ...Object.values(CURRENT_MANAGED_PATHS).flat(),
    ...Object.values(RETIRED_MANAGED_PATHS).flat(),
    PREVIOUS_CLAUDE_INIT_PATH,
    ...RETIRED_DOMAIN_COMMAND_PATHS,
    "mcp/dove-claude-project.json"
  ])];
}

function lifecycleExclusiveCleanupPaths() {
  return lifecycleReservedPaths()
    .filter((relativePath) => !LIFECYCLE_SHARED_JSON_PATHS.includes(relativePath))
    .filter((relativePath) => relativePath !== "AGENTS.md")
    .filter((relativePath) => !PACKAGE_RUNTIME_PATHS.includes(relativePath))
    .filter((relativePath) => /(?:\.md|SKILL\.md|\.json)$/u.test(relativePath))
    .sort();
}

function lifecycleDirectoryCleanupPaths() {
  return lifecycleReservedPaths()
    .filter((relativePath) => !path.posix.extname(relativePath))
    .filter((relativePath) => ![".dove", ".dove/install"].includes(relativePath))
    .sort((left, right) => right.split("/").length - left.split("/").length || left.localeCompare(right));
}

function inspectRealLifecycleDirectory(root, relativePath, fsOps) {
  let current = root;
  for (const component of relativePath.split("/")) {
    current = path.join(current, component);
    const stat = lstatOrNull(fsOps, current);
    if (stat === null) return false;
    if (stat.isSymbolicLink()) throw new Error(`Dove lifecycle reserved directory must not be a symbolic link: ${relativePath}.`);
    if (!stat.isDirectory()) throw new Error(`Dove lifecycle reserved directory path must be a real directory: ${relativePath}.`);
  }
  return true;
}

function assertLifecycleDirectoryCleanupExact(root, relativePath, entries, fsOps) {
  const scheduledChildren = new Set(entries
    .filter((entry) => entry.delete === true && path.posix.dirname(entry.relativePath) === relativePath)
    .map((entry) => path.posix.basename(entry.relativePath)));
  const unexpected = fsOps.readdirSync(path.join(root, relativePath)).map(String)
    .filter((child) => !scheduledChildren.has(child));
  if (unexpected.length > 0) {
    throw new Error(`Dove lifecycle reserved directory contains unowned entries and cannot be removed: ${relativePath}/${unexpected.sort().join(`, ${relativePath}/`)}.`);
  }
}

function recognizedLifecycleMcpFragment(fragment) {
  if (!plainObject(fragment) || !sameArray(Object.keys(fragment).sort(), ["args", "command", "type"])) return false;
  if (fragment.type !== "stdio") return false;
  if (fragment.command === "dove") return sameArray(fragment.args ?? [], ["mcp", "serve", "--project", "."]);
  return fragment.command === "node"
    && Array.isArray(fragment.args)
    && fragment.args.length === 1
    && LEGACY_DOVE_MCP_BUNDLE_ARGS.has(fragment.args[0]);
}

function planLifecycleSharedJson(root, relativePath, fsOps, { installClaude }) {
  const state = lifecyclePathState(root, relativePath, fsOps);
  const value = parseSharedJson(state, relativePath);
  let next = value;
  if (relativePath === MCP_PATH || relativePath === ".opencode.json") {
    if (value.mcpServers !== undefined && !plainObject(value.mcpServers)) throw new Error(`${relativePath} mcpServers must be a JSON object.`);
    const servers = value.mcpServers ?? {};
    const hasDove = Object.hasOwn(servers, "dove");
    if (hasDove && !recognizedLifecycleMcpFragment(servers.dove)) throw new Error(`${relativePath} contains an ambiguous non-Dove fragment at /mcpServers/dove.`);
    if (hasDove || (relativePath === MCP_PATH && installClaude)) {
      const nextServers = { ...servers };
      delete nextServers.dove;
      if (relativePath === MCP_PATH && installClaude) nextServers.dove = INSTALLED_DOVE_MCP_SERVER;
      next = { ...value, mcpServers: nextServers };
    }
  } else if (relativePath === DOVE_CLAUDE_SETTINGS_PATH) {
    if (value.hooks !== undefined && !plainObject(value.hooks)) throw new Error(`${relativePath} hooks must be a JSON object.`);
    const promptHooks = value.hooks?.UserPromptSubmit;
    if (promptHooks !== undefined && !Array.isArray(promptHooks)) throw new Error(`${relativePath} hooks.UserPromptSubmit must be an array.`);
    const doveHooks = (promptHooks ?? []).filter(referencesDoveHook);
    if (doveHooks.length > 1 || doveHooks.some((entry) => !recognizedLifecycleDoveHookEntry(entry))) {
      throw new Error(`${relativePath} contains an ambiguous Dove UserPromptSubmit hook.`);
    }
    if (doveHooks.length === 1) {
      next = { ...value, hooks: { ...value.hooks, UserPromptSubmit: promptHooks.filter((entry) => !referencesDoveHook(entry)) } };
    }
    if (installClaude) next = mergeClaudeAmbientSettings(next).settings;
  } else if (relativePath === DOVE_CLAUDE_LOCAL_SETTINGS_PATH) {
    inspectClaudeMcpApprovalSettings(value);
    if ((value.enabledMcpjsonServers ?? []).includes("dove")) {
      next = { ...value, enabledMcpjsonServers: value.enabledMcpjsonServers.filter((name) => name !== "dove") };
    }
    if (installClaude) next = mergeClaudeMcpApprovalSettings(next).settings;
  }
  if (canonicalJson(next) === canonicalJson(value)) return { state, entry: null };
  return {
    state,
    entry: { root, relativePath, content: serializeSharedJson(next), encoding: "utf8", force: true, label: `Dove lifecycle shared JSON ${relativePath}` }
  };
}

function assertLifecycleRuntimeOwned(root, relativePath, fsOps) {
  const state = lifecyclePathState(root, relativePath, fsOps);
  if (!state.exists) return state;
  const probe = LEGACY_PROJECT_BUNDLE_PROBES.find((entry) => entry.path === relativePath);
  const content = state.bytes.toString("utf8");
  if ((probe?.signatures ?? []).filter((signature) => content.includes(signature)).length < 2) {
    throw new Error(`Dove lifecycle cannot safely remove copied runtime without affirmative Dove signatures: ${relativePath}.`);
  }
  return state;
}

function lifecycleManifest(root, options, hosts, now, replay = null) {
  const desiredResources = resourcesForHosts(hosts);
  const managed = desiredResources.map((resource) => ({
    path: resource.path,
    owner: resource.owner,
    mode: resource.mode,
    selector: resource.selector,
    digest: resource.digest
  }));
  return replay ?? createProjectInstallationManifest({
    package: { name: options.packageName, version: options.packageVersion },
    hosts,
    managed,
    createdAt: now,
    updatedAt: now
  }, { hostIds: PROJECT_HOST_IDS });
}

function assertLegacyInstallationRoot(root, fsOps) {
  const legacyRoot = path.join(root, ".dove-install");
  const stat = lstatOrNull(fsOps, legacyRoot);
  if (stat === null || stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error("Dove Upgrade requires .dove-install to be a real directory.");
  }
  const children = fsOps.readdirSync(legacyRoot).map(String).sort();
  if (!sameArray(children, ["manifest.json"])) {
    throw new Error("Dove Upgrade requires .dove-install to contain only its legacy manifest.");
  }
  return { mode: stat.mode & 0o7777, treeDigest: inspectDirectoryTreeDigest(root, ".dove-install", { fsOps }) };
}

function installationSource(root, fsOps) {
  const currentState = lifecyclePathState(root, INSTALLATION_MANIFEST_PATH, fsOps);
  const legacyState = lifecyclePathState(root, LEGACY_INSTALLATION_MANIFEST_PATH, fsOps);
  if (currentState.exists && legacyState.exists) {
    throw new Error("Dove Upgrade found both current and legacy project installation manifests.");
  }
  if (currentState.exists) {
    return { kind: "current", state: currentState, manifest: readProjectInstallationManifest(root, { fsOps, hostIds: PROJECT_HOST_IDS, allowPrevious: true }) };
  }
  if (legacyState.exists) {
    return {
      kind: "legacy",
      state: legacyState,
      rootState: assertLegacyInstallationRoot(root, fsOps),
      manifest: readLegacyProjectInstallationManifest(root, { fsOps, hostIds: PROJECT_HOST_IDS, allowPrevious: true })
    };
  }
  throw new Error("Dove Upgrade requires an installed project manifest.");
}

function prepareLifecycleIntegration(root, options, { hosts, manifest, removeOnly }) {
  const fsOps = options.fsOps ?? fs;
  const desiredResources = removeOnly ? [] : resourcesForHosts(hosts);
  const desiredExclusivePaths = new Set(desiredResources.filter((resource) => resource.kind === "exclusive").map((resource) => resource.path));
  const entries = [];
  const operations = [];
  const observed = new Map();
  const remember = (relativePath, state) => {
    const previous = observed.get(relativePath);
    if (previous && (previous.exists !== state.exists || previous.digest !== state.digest || previous.mode !== state.mode)) {
      throw new Error(`Dove lifecycle observed inconsistent file state while preparing ${relativePath}.`);
    }
    observed.set(relativePath, state);
  };

  for (const relativePath of LIFECYCLE_SHARED_JSON_PATHS) {
    const planned = planLifecycleSharedJson(root, relativePath, fsOps, { installClaude: !removeOnly && hosts.includes(CLAUDE_HOST) });
    remember(relativePath, planned.state);
    operations.push({ path: relativePath, action: planned.entry ? "write" : "unchanged", observedDigest: planned.state.digest, observedMode: planned.state.mode });
    if (planned.entry) entries.push(planned.entry);
  }

  for (const relativePath of lifecycleExclusiveCleanupPaths()) {
    const state = lifecyclePathState(root, relativePath, fsOps);
    remember(relativePath, state);
    if (!state.exists) continue;
    if (relativePath === "mcp/dove-claude-project.json") {
      const marker = parseJsonWithoutDuplicateKeys(state.bytes.toString("utf8"), "Legacy Dove project marker");
      if (!plainObject(marker) || !sameArray(Object.keys(marker).sort(), ["host", "version"]) || marker.host !== "claude" || marker.version !== 1) {
        throw new Error(`Dove lifecycle cannot safely remove an ambiguous project marker: ${relativePath}.`);
      }
    }
    operations.push({ path: relativePath, action: desiredExclusivePaths.has(relativePath) ? "replace" : "remove", observedDigest: state.digest, observedMode: state.mode });
    if (!desiredExclusivePaths.has(relativePath)) {
      entries.push(bindLifecycleFileState(root, relativePath, state, { root, relativePath, delete: true, force: true, label: `Dove lifecycle reserved resource ${relativePath}` }));
    }
  }

  for (const relativePath of PACKAGE_RUNTIME_PATHS) {
    const state = assertLifecycleRuntimeOwned(root, relativePath, fsOps);
    remember(relativePath, state);
    if (!state.exists) continue;
    operations.push({ path: relativePath, action: "remove", observedDigest: state.digest, observedMode: state.mode });
    entries.push(bindLifecycleFileState(root, relativePath, state, { root, relativePath, delete: true, force: true, label: `Dove lifecycle copied runtime ${relativePath}` }));
  }

  for (const relativePath of lifecycleDirectoryCleanupPaths()) {
    if (!inspectRealLifecycleDirectory(root, relativePath, fsOps)) continue;
    assertLifecycleDirectoryCleanupExact(root, relativePath, entries, fsOps);
    const stat = fsOps.lstatSync(path.join(root, relativePath));
    const treeDigest = inspectDirectoryTreeDigest(root, relativePath, { fsOps });
    operations.push({ path: relativePath, action: "remove-empty-directory", treeDigest });
    entries.push({
      root,
      relativePath,
      delete: true,
      deleteEmptyDirectory: true,
      expectedState: { exists: true, type: "directory", sha256: null, mode: stat.mode & 0o7777 },
      expectedTreeDigest: treeDigest,
      force: true,
      label: `Dove lifecycle retired directory ${relativePath}`
    });
  }

  if (!removeOnly) {
    for (const resource of desiredResources.filter((entry) => entry.kind === "exclusive")) {
      const state = lifecyclePathState(root, resource.path, fsOps);
      remember(resource.path, state);
      operations.push({ path: resource.path, action: state.digest === resource.digest ? "claim" : "write", observedDigest: state.digest, observedMode: state.mode, nextDigest: resource.digest });
      if (state.digest !== resource.digest) entries.push(transactionWrite(root, resource, resource.content));
    }
  }
  return { entries, operations, observed, manifest };
}

function bindLifecycleObservedFiles(root, prepared) {
  const entryPaths = new Set(prepared.entries.map((entry) => entry.relativePath));
  prepared.entries = prepared.entries.map((entry) => {
    const state = prepared.observed.get(entry.relativePath);
    return state ? bindLifecycleFileState(root, entry.relativePath, state, entry) : entry;
  });
  for (const [relativePath, state] of prepared.observed) {
    if (!entryPaths.has(relativePath)) prepared.entries.push(bindLifecycleFileState(root, relativePath, state));
  }
}

function lifecyclePreviewShape(plan) {
  const mutations = plan.entries.filter((entry) => entry.assertOnly !== true);
  const writtenPaths = mutations.filter((entry) => entry.delete !== true && entry.moveTo === undefined).map((entry) => entry.relativePath);
  const removedPaths = mutations.filter((entry) => entry.delete === true).map((entry) => entry.relativePath);
  const movedPaths = mutations.filter((entry) => entry.moveTo !== undefined).map((entry) => ({ from: entry.relativePath, to: entry.moveTo }));
  return Object.freeze({
    status: "ready",
    previewType: plan.previewType,
    previewVersion: plan.previewVersion,
    target: plan.root,
    hosts: Object.freeze([...plan.hosts]),
    writtenPaths: Object.freeze(writtenPaths),
    removedPaths: Object.freeze(removedPaths),
    movedPaths: Object.freeze(movedPaths.map(Object.freeze)),
    changedPaths: Object.freeze([...new Set([...writtenPaths, ...removedPaths, ...movedPaths.flatMap((move) => [move.from, move.to])])]),
    manifest: plan.manifest,
    confirmation: Object.freeze({ required: plan.confirmationRequired, default: false, exactReplay: true, previewDigest: plan.previewDigest })
  });
}

function lifecycleBinding(plan) {
  return semanticDigest({
    previewType: plan.previewType,
    previewVersion: plan.previewVersion,
    target: plan.root,
    hosts: plan.hosts,
    manifest: plan.manifest,
    operations: plan.operations
  });
}

function prepareUpgrade(start, options = {}, replay = null) {
  const fsOps = options.fsOps ?? fs;
  assertPackageInput(options.packageName, options.packageVersion, { required: true });
  const root = canonicalLifecycleRoot(start, fsOps);
  const source = installationSource(root, fsOps);
  const hosts = options.hosts === undefined ? [...source.manifest.hosts] : normalizeSelectedHosts(options.hosts, { defaultWhenEmpty: false });
  const now = replay?.manifest?.createdAt ?? exactTimestamp(options.now);
  const manifest = lifecycleManifest(root, options, hosts, now, replay?.manifest);
  const prepared = prepareLifecycleIntegration(root, options, { hosts, manifest, removeOnly: false });

  if (source.kind === "legacy") {
    prepared.entries.push(bindLifecycleFileState(root, LEGACY_INSTALLATION_MANIFEST_PATH, source.state, {
      root,
      relativePath: LEGACY_INSTALLATION_MANIFEST_PATH,
      delete: true,
      force: true,
      label: "Legacy Dove installation manifest migration"
    }));
    prepared.entries.push({
      root,
      relativePath: ".dove-install",
      delete: true,
      deleteEmptyDirectory: true,
      expectedState: { exists: true, type: "directory", sha256: null, mode: source.rootState.mode },
      expectedTreeDigest: source.rootState.treeDigest,
      force: true,
      label: "Legacy Dove installation root cleanup"
    });
    prepared.operations.push({ path: ".dove-install", action: "remove-empty-directory", treeDigest: source.rootState.treeDigest });
    prepared.operations.push({ path: LEGACY_INSTALLATION_MANIFEST_PATH, action: "remove", observedDigest: source.state.digest, observedMode: source.state.mode });
  }

  const manifestState = lifecyclePathState(root, INSTALLATION_MANIFEST_PATH, fsOps);
  const manifestContent = serializeProjectInstallationManifest(manifest, { hostIds: PROJECT_HOST_IDS });
  prepared.entries.push(bindLifecycleFileState(root, INSTALLATION_MANIFEST_PATH, manifestState, {
    root,
    relativePath: INSTALLATION_MANIFEST_PATH,
    content: manifestContent,
    encoding: "utf8",
    force: true,
    label: MANIFEST_OWNER
  }));
  prepared.operations.push({ path: INSTALLATION_MANIFEST_PATH, action: "write", observedDigest: manifestState.digest, observedMode: manifestState.mode, nextDigest: sha256(manifestContent) });

  const legacyArchiveStat = lstatOrNull(fsOps, path.join(root, ".dove-archive"));
  if (legacyArchiveStat !== null) {
    if (legacyArchiveStat.isSymbolicLink() || !legacyArchiveStat.isDirectory()) throw new Error("Dove Upgrade requires .dove-archive to be a real directory.");
    const archiveTarget = ".dove/archive";
    if (lstatOrNull(fsOps, path.join(root, archiveTarget)) !== null) throw new Error(`Dove Upgrade archive destination is already occupied: ${archiveTarget}.`);
    const treeDigest = inspectDirectoryTreeDigest(root, ".dove-archive", { fsOps });
    prepared.entries.unshift({ root, relativePath: ".dove-archive", moveTo: archiveTarget, expectedTreeDigest: treeDigest, label: "Dove legacy archive migration" });
    prepared.operations.unshift({ path: ".dove-archive", action: "move", destination: archiveTarget, treeDigest });
  } else {
    prepared.entries.push({ root, relativePath: ".dove-archive", assertOnly: true, expectedState: { exists: false, type: "absent", sha256: null, mode: null }, label: "Dove Upgrade legacy archive assertion" });
  }

  bindLifecycleObservedFiles(root, prepared);
  prepared.operations.sort((left, right) => left.path.localeCompare(right.path) || left.action.localeCompare(right.action));
  const plan = { ...prepared, fsOps, root, hosts, previewType: UPGRADE_PREVIEW_TYPE, previewVersion: UPGRADE_PREVIEW_VERSION, confirmationRequired: false };
  plan.previewDigest = lifecycleBinding(plan);
  return plan;
}

export function previewProjectUpgrade(start, options = {}) {
  return lifecyclePreviewShape(prepareUpgrade(start, options));
}

export function upgradeProjectIntegration(start, options = {}) {
  const preview = options.preview;
  if (!plainObject(preview) || preview.previewType !== UPGRADE_PREVIEW_TYPE || preview.previewVersion !== UPGRADE_PREVIEW_VERSION) {
    throw new Error("Dove Upgrade requires the exact project-upgrade preview.");
  }
  const prepared = prepareUpgrade(start, options, preview);
  if (preview.target !== prepared.root || !sameArray(preview.hosts ?? [], prepared.hosts) || preview.confirmation?.previewDigest !== prepared.previewDigest) {
    throw new Error("Dove Upgrade preview is stale or does not match the approved project state.");
  }
  const transaction = writeFileSetTransaction(prepared.entries, { fsOps: prepared.fsOps });
  return { ...resultFromTransaction("upgraded", prepared.root, prepared.hosts, prepared.manifest, transaction), movedPaths: [...transaction.movedPaths] };
}

function prepareCompleteReinstall(start, options = {}, replay = null) {
  const fsOps = options.fsOps ?? fs;
  assertPackageInput(options.packageName, options.packageVersion, { required: true });
  const root = canonicalLifecycleRoot(start, fsOps);
  const hosts = options.hosts === undefined ? [CLAUDE_HOST] : normalizeSelectedHosts(options.hosts, { defaultWhenEmpty: false });
  const now = replay?.manifest?.createdAt ?? exactTimestamp(options.now);
  const manifest = lifecycleManifest(root, options, hosts, now, replay?.manifest);
  const prepared = prepareLifecycleIntegration(root, options, { hosts, manifest, removeOnly: false });

  const manifestState = lifecyclePathState(root, INSTALLATION_MANIFEST_PATH, fsOps);
  const manifestContent = serializeProjectInstallationManifest(manifest, { hostIds: PROJECT_HOST_IDS });
  prepared.entries.push(bindLifecycleFileState(root, INSTALLATION_MANIFEST_PATH, manifestState, {
    root,
    relativePath: INSTALLATION_MANIFEST_PATH,
    content: manifestContent,
    encoding: "utf8",
    force: true,
    label: MANIFEST_OWNER
  }));
  prepared.operations.push({
    path: INSTALLATION_MANIFEST_PATH,
    action: "write",
    observedDigest: manifestState.digest,
    observedMode: manifestState.mode,
    nextDigest: sha256(manifestContent)
  });

  const legacyInstallStat = lstatOrNull(fsOps, path.join(root, ".dove-install"));
  if (legacyInstallStat !== null) {
    if (legacyInstallStat.isSymbolicLink() || !legacyInstallStat.isDirectory()) {
      throw new Error("Complete Reinstall requires .dove-install to be a real directory.");
    }
    const treeDigest = inspectDirectoryTreeDigest(root, ".dove-install", { fsOps });
    prepared.entries.unshift({
      root,
      relativePath: ".dove-install",
      delete: true,
      deleteTree: true,
      expectedState: { exists: true, type: "directory", sha256: null, mode: legacyInstallStat.mode & 0o7777 },
      expectedTreeDigest: treeDigest,
      force: true,
      label: "Complete Reinstall legacy installation deletion"
    });
    prepared.operations.unshift({ path: ".dove-install", action: "remove-tree", treeDigest });
  } else {
    prepared.entries.push({
      root,
      relativePath: ".dove-install",
      assertOnly: true,
      expectedState: { exists: false, type: "absent", sha256: null, mode: null },
      label: "Complete Reinstall legacy installation assertion"
    });
  }

  const doveStat = lstatOrNull(fsOps, path.join(root, ".dove"));
  if (doveStat !== null) {
    if (doveStat.isSymbolicLink() || !doveStat.isDirectory()) throw new Error("Complete Reinstall requires .dove to be a real directory.");
    for (const child of fsOps.readdirSync(path.join(root, ".dove")).map(String).sort()) {
      if (child === "install") continue;
      const relativePath = `.dove/${child}`;
      const stat = fsOps.lstatSync(path.join(root, relativePath));
      if (stat.isSymbolicLink()) throw new Error(`Complete Reinstall refuses symbolic links in project-private Dove state: ${relativePath}.`);
      if (stat.isFile()) {
        const state = lifecyclePathState(root, relativePath, fsOps);
        prepared.entries.unshift(bindLifecycleFileState(root, relativePath, state, { root, relativePath, delete: true, force: true, label: `Complete Reinstall deletion ${relativePath}` }));
        prepared.operations.unshift({ path: relativePath, action: "remove", observedDigest: state.digest, observedMode: state.mode });
      } else if (stat.isDirectory()) {
        const treeDigest = inspectDirectoryTreeDigest(root, relativePath, { fsOps });
        prepared.entries.unshift({ root, relativePath, delete: true, deleteTree: true, expectedState: { exists: true, type: "directory", sha256: null, mode: stat.mode & 0o7777 }, expectedTreeDigest: treeDigest, force: true, label: `Complete Reinstall tree deletion ${relativePath}` });
        prepared.operations.unshift({ path: relativePath, action: "remove-tree", treeDigest });
      } else {
        throw new Error(`Complete Reinstall found unsupported project-private Dove state: ${relativePath}.`);
      }
    }
  }
  const archiveStat = lstatOrNull(fsOps, path.join(root, ".dove-archive"));
  if (archiveStat !== null) {
    if (archiveStat.isSymbolicLink() || !archiveStat.isDirectory()) throw new Error("Complete Reinstall requires .dove-archive to be a real directory.");
    const treeDigest = inspectDirectoryTreeDigest(root, ".dove-archive", { fsOps });
    prepared.entries.unshift({ root, relativePath: ".dove-archive", delete: true, deleteTree: true, expectedState: { exists: true, type: "directory", sha256: null, mode: archiveStat.mode & 0o7777 }, expectedTreeDigest: treeDigest, force: true, label: "Complete Reinstall legacy archive deletion" });
    prepared.operations.unshift({ path: ".dove-archive", action: "remove-tree", treeDigest });
  }

  bindLifecycleObservedFiles(root, prepared);
  prepared.operations.sort((left, right) => left.path.localeCompare(right.path) || left.action.localeCompare(right.action));
  const plan = { ...prepared, fsOps, root, hosts, previewType: COMPLETE_REINSTALL_PREVIEW_TYPE, previewVersion: COMPLETE_REINSTALL_PREVIEW_VERSION, confirmationRequired: true };
  plan.previewDigest = lifecycleBinding(plan);
  return plan;
}

export function previewProjectCompleteReinstall(start, options = {}) {
  return lifecyclePreviewShape(prepareCompleteReinstall(start, options));
}

export function completeReinstallProjectIntegration(start, options = {}) {
  if (options.confirmed !== true) throw new Error("Complete Reinstall requires confirmed: true.");
  const preview = options.preview;
  if (!plainObject(preview) || preview.previewType !== COMPLETE_REINSTALL_PREVIEW_TYPE || preview.previewVersion !== COMPLETE_REINSTALL_PREVIEW_VERSION) {
    throw new Error("Complete Reinstall requires the exact project-complete-reinstall preview.");
  }
  const prepared = prepareCompleteReinstall(start, options, preview);
  if (preview.target !== prepared.root || !sameArray(preview.hosts ?? [], prepared.hosts) || preview.confirmation?.previewDigest !== prepared.previewDigest) {
    throw new Error("Complete Reinstall preview is stale or does not match the approved project state.");
  }
  const transaction = writeFileSetTransaction(prepared.entries, { fsOps: prepared.fsOps });
  return { ...resultFromTransaction("reinstalled", prepared.root, prepared.hosts, prepared.manifest, transaction), movedPaths: [...transaction.movedPaths] };
}

export const PROJECT_INTEGRATION_MANAGED_PATHS = Object.freeze(
  claudeResources().map((resource) => resource.path).sort()
);

export const PROJECT_INTEGRATION_CLAUDE_HOOK_COMMAND = DOVE_CLAUDE_AMBIENT_HOOK_COMMAND;
