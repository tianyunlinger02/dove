import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  DOVE_CLAUDE_AMBIENT_HOOK_COMMAND,
  DOVE_CLAUDE_AMBIENT_HOOK_ENTRY,
  DOVE_CLAUDE_SETTINGS_PATH,
  LEGACY_DOVE_CLAUDE_AMBIENT_HOOK_COMMAND,
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
  LEGACY_PROJECT_MARKER_PATHS,
  inspectLegacyProjectInstallation
} from "./project-legacy-installation.mjs";
import {
  INSTALLATION_MANIFEST_PATH,
  createProjectInstallationManifest,
  isPreviousProjectInstallationManifest,
  readProjectInstallationManifest,
  serializeProjectInstallationManifest
} from "./project-installation-manifest.mjs";
import { resolveInstalledProjectRoot, resolveProjectRootForInit } from "./project-root.mjs";
import { parseJsonWithoutDuplicateKeys } from "./strict-json.mjs";
import { generatedAdapterEntries, generatedClaudeAmbientProjectEntries } from "../../scripts/generate-command-adapters.mjs";

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
  const exclusiveEntries = [
    ...generatedAdapterEntries().filter((entry) => entry.hostId === CLAUDE_HOST),
    ...generatedClaudeAmbientProjectEntries()
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

function recognizedOverlayDoveHookEntry(entry) {
  if (!plainObject(entry) || Object.keys(entry).length !== 1 || !Array.isArray(entry.hooks) || entry.hooks.length !== 1) return false;
  const hook = entry.hooks[0];
  if (!plainObject(hook) || hook.type !== "command" || typeof hook.command !== "string") return false;
  if (Object.keys(hook).some((key) => !["type", "command", "timeout"].includes(key))) return false;
  if (hook.command === DOVE_CLAUDE_AMBIENT_HOOK_COMMAND) return hook.timeout === 10;
  const legacyCommand = hook.command === LEGACY_DOVE_CLAUDE_AMBIENT_HOOK_COMMAND
    || hook.command === "node ./scripts/dove-user-prompt-submit-package.mjs";
  return legacyCommand && (hook.timeout === undefined || hook.timeout === 10);
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

const OVERLAY_PREVIEW_VERSION = 1;
const OVERLAY_MANIFEST_PATH = INSTALLATION_MANIFEST_PATH;
const LEGACY_DOVE_MCP_BUNDLE_ARGS = Object.freeze(new Set([
  "./mcp/dove-state-server-package.mjs",
  "${CLAUDE_PROJECT_DIR:-.}/mcp/dove-state-server-package.mjs"
]));
const OVERLAY_SHARED_JSON_PATHS = Object.freeze([MCP_PATH, DOVE_CLAUDE_SETTINGS_PATH, DOVE_CLAUDE_LOCAL_SETTINGS_PATH, ".opencode.json"]);
const LEGACY_MARKER_PATH = LEGACY_PROJECT_MARKER_PATHS[0];
const LEGACY_RUNTIME_SIGNATURES = Object.freeze(Object.fromEntries(
  LEGACY_PROJECT_BUNDLE_PROBES.map((probe) => [probe.path, probe.signatures])
));

function canonicalOverlayRoot(root, fsOps) {
  if (typeof root !== "string" || !root.trim() || root.includes("\0")) throw new Error("Overlay upgrade project root must name an existing directory.");
  const resolved = path.resolve(root);
  const stat = fsOps.lstatSync(resolved);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Overlay upgrade project root must be a real directory: ${resolved}.`);
  return typeof fsOps.realpathSync.native === "function" ? fsOps.realpathSync.native(resolved) : fsOps.realpathSync(resolved);
}

function overlayPathState(root, relativePath, fsOps) {
  const state = inspectRegularProjectFile(root, relativePath, fsOps);
  return { ...state, relativePath };
}

function overlayExpectedFileState(state) {
  return state.exists
    ? { exists: true, type: "file", sha256: state.digest, mode: state.mode }
    : { exists: false, type: "absent", sha256: null, mode: null };
}

function bindOverlayEntryState(root, relativePath, state, entry = null) {
  const expectedState = overlayExpectedFileState(state);
  return entry === null
    ? { root, relativePath, assertOnly: true, expectedState, label: `Dove overlay replay assertion ${relativePath}` }
    : { ...entry, expectedState };
}

function overlayReservedPaths() {
  return [...new Set([
    ...Object.values(CURRENT_MANAGED_PATHS).flat(),
    ...Object.values(RETIRED_MANAGED_PATHS).flat(),
    LEGACY_MARKER_PATH
  ])];
}

function overlayExclusiveCleanupPaths() {
  return overlayReservedPaths()
    .filter((relativePath) => !OVERLAY_SHARED_JSON_PATHS.includes(relativePath))
    .filter((relativePath) => relativePath !== "AGENTS.md")
    .filter((relativePath) => !PACKAGE_RUNTIME_PATHS.includes(relativePath))
    .filter((relativePath) => /(?:\.md|SKILL\.md|\.json)$/u.test(relativePath))
    .sort();
}

function overlayDirectoryCleanupPaths() {
  return overlayReservedPaths()
    .filter((relativePath) => !path.posix.extname(relativePath))
    .sort((left, right) => right.split("/").length - left.split("/").length || left.localeCompare(right));
}

function inspectRealProjectDirectory(root, relativePath, fsOps) {
  let current = root;
  for (const component of relativePath.split("/")) {
    current = path.join(current, component);
    const stat = lstatOrNull(fsOps, current);
    if (stat === null) return false;
    if (stat.isSymbolicLink()) throw new Error(`Dove overlay reserved directory must not be a symbolic link: ${relativePath}.`);
    if (!stat.isDirectory()) throw new Error(`Dove overlay reserved directory path must be a real directory: ${relativePath}.`);
  }
  return true;
}

function assertOverlayDirectoryCleanupExact(root, relativePath, entries, fsOps) {
  const scheduledChildren = new Set(entries
    .filter((entry) => entry.delete === true && path.posix.dirname(entry.relativePath) === relativePath)
    .map((entry) => path.posix.basename(entry.relativePath)));
  const children = fsOps.readdirSync(path.join(root, relativePath)).map(String);
  const unexpected = children.filter((child) => !scheduledChildren.has(child));
  if (unexpected.length > 0) {
    throw new Error(`Dove overlay reserved directory contains unowned entries and cannot be removed: ${relativePath}/${unexpected.sort().join(`, ${relativePath}/`)}.`);
  }
}

function recognizedDoveMcpFragment(fragment) {
  if (!plainObject(fragment) || !sameArray(Object.keys(fragment).sort(), ["args", "command", "type"])) return false;
  if (fragment.type !== "stdio") return false;
  if (fragment.command === "dove") {
    return sameArray(fragment.args ?? [], ["mcp", "serve", "--project", "."]);
  }
  return fragment.command === "node"
    && Array.isArray(fragment.args)
    && fragment.args.length === 1
    && LEGACY_DOVE_MCP_BUNDLE_ARGS.has(fragment.args[0]);
}

function overlaySharedJson(root, relativePath, fsOps, { installClaude }) {
  const state = overlayPathState(root, relativePath, fsOps);
  const value = parseSharedJson(state, relativePath);
  let next = value;
  if (relativePath === MCP_PATH || relativePath === ".opencode.json") {
    if (value.mcpServers !== undefined && !plainObject(value.mcpServers)) throw new Error(`${relativePath} mcpServers must be a JSON object.`);
    const servers = value.mcpServers ?? {};
    const hasDove = Object.hasOwn(servers, "dove");
    if (hasDove && !recognizedDoveMcpFragment(servers.dove)) {
      throw new Error(`${relativePath} contains an ambiguous non-Dove fragment at /mcpServers/dove.`);
    }
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
    if (doveHooks.length > 1 || doveHooks.some((entry) => !recognizedOverlayDoveHookEntry(entry))) {
      throw new Error(`${relativePath} contains an ambiguous Dove UserPromptSubmit hook.`);
    }
    if (doveHooks.length === 1) {
      const retainedHooks = promptHooks.filter((entry) => !referencesDoveHook(entry));
      next = { ...value, hooks: { ...value.hooks, UserPromptSubmit: retainedHooks } };
    }
    if (installClaude) next = mergeClaudeAmbientSettings(next).settings;
  } else if (relativePath === DOVE_CLAUDE_LOCAL_SETTINGS_PATH) {
    inspectClaudeMcpApprovalSettings(value);
    const hasEnabledDove = (value.enabledMcpjsonServers ?? []).includes("dove");
    if (hasEnabledDove) {
      next = { ...value, enabledMcpjsonServers: value.enabledMcpjsonServers.filter((name) => name !== "dove") };
    }
    if (installClaude) next = mergeClaudeMcpApprovalSettings(next).settings;
  }
  if (canonicalJson(next) === canonicalJson(value)) return { entry: null, observedDigest: state.digest, state };
  const content = serializeSharedJson(next);
  return {
    entry: { root, relativePath, content, encoding: "utf8", force: true, label: `Dove overlay shared JSON ${relativePath}` },
    observedDigest: state.digest,
    state
  };
}

function assertLegacyRuntimeOwned(root, relativePath, fsOps) {
  const state = overlayPathState(root, relativePath, fsOps);
  if (!state.exists) return state;
  const content = state.bytes.toString("utf8");
  const signatures = LEGACY_RUNTIME_SIGNATURES[relativePath] ?? [];
  const matchedSignatures = signatures.filter((signature) => content.includes(signature));
  if (matchedSignatures.length < 2) {
    throw new Error(`Dove overlay upgrade cannot safely remove copied runtime without affirmative Dove signatures: ${relativePath}.`);
  }
  return state;
}

function overlayArchiveRelativePath(treeDigest) {
  return `.dove-archive/upgrade-${treeDigest.slice(0, 24)}`;
}

function overlayPlanBinding(plan) {
  return semanticDigest({
    previewVersion: OVERLAY_PREVIEW_VERSION,
    target: plan.root,
    hosts: plan.hosts,
    package: plan.manifest.package,
    manifest: plan.manifest,
    sourceTreeDigest: plan.sourceTreeDigest,
    archiveRelativePath: plan.archiveRelativePath,
    operations: plan.operations
  });
}

function prepareOverlayUpgrade(rootInput, options = {}, replay = null) {
  const fsOps = options.fsOps ?? fs;
  assertPackageInput(options.packageName, options.packageVersion, { required: true });
  const hosts = normalizeSelectedHosts(options.hosts, { defaultWhenEmpty: true });
  const root = canonicalOverlayRoot(rootInput, fsOps);
  const now = replay?.manifest?.createdAt ?? exactTimestamp(options.now);
  const desiredResources = resourcesForHosts(hosts);
  const desiredExclusive = desiredResources.filter((resource) => resource.kind === "exclusive");
  const desiredExclusivePaths = new Set(desiredExclusive.map((resource) => resource.path));
  const entries = [];
  const operations = [];
  const observedFileStates = new Map();
  const rememberFileState = (relativePath, state) => {
    const previous = observedFileStates.get(relativePath);
    if (previous && (previous.exists !== state.exists || previous.digest !== state.digest || previous.mode !== state.mode)) {
      throw new Error(`Dove overlay observed inconsistent file state while preparing ${relativePath}.`);
    }
    observedFileStates.set(relativePath, state);
  };

  for (const relativePath of OVERLAY_SHARED_JSON_PATHS) {
    const planned = overlaySharedJson(root, relativePath, fsOps, { installClaude: hosts.includes(CLAUDE_HOST) });
    rememberFileState(relativePath, planned.state);
    operations.push({ path: relativePath, action: planned.entry ? "write" : "unchanged", observedDigest: planned.observedDigest, observedMode: planned.state.mode });
    if (planned.entry) entries.push(planned.entry);
  }

  for (const relativePath of overlayExclusiveCleanupPaths()) {
    const state = overlayPathState(root, relativePath, fsOps);
    rememberFileState(relativePath, state);
    if (!state.exists) continue;
    if (relativePath === LEGACY_MARKER_PATH) {
      const marker = parseJsonWithoutDuplicateKeys(state.bytes.toString("utf8"), "Legacy Dove project marker");
      if (!plainObject(marker)
        || !sameArray(Object.keys(marker).sort(), ["host", "version"])
        || marker.version !== 1
        || marker.host !== "claude") {
        throw new Error(`Dove overlay upgrade cannot safely remove an ambiguous project marker: ${relativePath}.`);
      }
    }
    operations.push({ path: relativePath, action: desiredExclusivePaths.has(relativePath) ? "replace" : "remove", observedDigest: state.digest, observedMode: state.mode });
    if (!desiredExclusivePaths.has(relativePath)) {
      entries.push(bindOverlayEntryState(root, relativePath, state, { root, relativePath, delete: true, force: true, label: `Dove overlay reserved resource ${relativePath}` }));
    }
  }

  for (const relativePath of PACKAGE_RUNTIME_PATHS) {
    const state = assertLegacyRuntimeOwned(root, relativePath, fsOps);
    rememberFileState(relativePath, state);
    if (!state.exists) continue;
    operations.push({ path: relativePath, action: "remove", observedDigest: state.digest, observedMode: state.mode });
    entries.push(bindOverlayEntryState(root, relativePath, state, { root, relativePath, delete: true, force: true, label: `Dove overlay copied runtime ${relativePath}` }));
  }

  for (const relativePath of overlayDirectoryCleanupPaths()) {
    if (!inspectRealProjectDirectory(root, relativePath, fsOps)) {
      operations.push({ path: relativePath, action: "unchanged", treeDigest: null });
      entries.push({
        root,
        relativePath,
        assertOnly: true,
        expectedState: { exists: false, type: "absent", sha256: null, mode: null },
        label: `Dove overlay replay assertion ${relativePath}`
      });
      continue;
    }
    assertOverlayDirectoryCleanupExact(root, relativePath, entries, fsOps);
    const directoryStat = fsOps.lstatSync(path.join(root, relativePath));
    const treeDigest = inspectDirectoryTreeDigest(root, relativePath, { fsOps });
    operations.push({ path: relativePath, action: "remove-empty-directory", treeDigest });
    entries.push({
      root,
      relativePath,
      delete: true,
      deleteEmptyDirectory: true,
      expectedState: { exists: true, type: "directory", sha256: null, mode: directoryStat.mode & 0o7777 },
      expectedTreeDigest: treeDigest,
      force: true,
      label: `Dove overlay retired directory ${relativePath}`
    });
  }

  for (const resource of desiredExclusive) {
    const state = overlayPathState(root, resource.path, fsOps);
    rememberFileState(resource.path, state);
    operations.push({ path: resource.path, action: state.digest === resource.digest ? "claim" : "write", observedDigest: state.digest, observedMode: state.mode, nextDigest: resource.digest });
    if (state.digest !== resource.digest) entries.push(transactionWrite(root, resource, resource.content));
  }

  const doveStat = lstatOrNull(fsOps, path.join(root, ".dove"));
  let sourceTreeDigest = null;
  let archiveRelativePath = null;
  if (doveStat !== null) {
    if (doveStat.isSymbolicLink() || !doveStat.isDirectory()) throw new Error("Dove overlay upgrade requires .dove to be absent or a real directory.");
    sourceTreeDigest = inspectDirectoryTreeDigest(root, ".dove", { fsOps });
    archiveRelativePath = overlayArchiveRelativePath(sourceTreeDigest);
    const archiveParentState = lstatOrNull(fsOps, path.join(root, ".dove-archive"));
    if (archiveParentState !== null && (archiveParentState.isSymbolicLink() || !archiveParentState.isDirectory())) {
      throw new Error("Dove overlay archive parent must be a real directory, not a symbolic link.");
    }
    const archiveState = lstatOrNull(fsOps, path.join(root, archiveRelativePath));
    if (archiveState !== null) throw new Error(`Dove overlay archive target is already occupied: ${archiveRelativePath}.`);
    entries.unshift({ root, relativePath: ".dove", moveTo: archiveRelativePath, expectedTreeDigest: sourceTreeDigest, label: "Dove overlay workspace archive" });
    operations.unshift({ path: ".dove", action: "archive", destination: archiveRelativePath, treeDigest: sourceTreeDigest });
  }

  const managed = desiredResources.map((resource) => ({ path: resource.path, owner: resource.owner, mode: resource.mode, selector: resource.selector, digest: resource.digest }));
  const manifest = replay?.manifest ?? createProjectInstallationManifest({
    package: { name: options.packageName, version: options.packageVersion },
    hosts,
    managed,
    createdAt: now,
    updatedAt: now
  }, { hostIds: PROJECT_HOST_IDS });
  const manifestState = overlayPathState(root, OVERLAY_MANIFEST_PATH, fsOps);
  rememberFileState(OVERLAY_MANIFEST_PATH, manifestState);
  const manifestContent = serializeProjectInstallationManifest(manifest, { hostIds: PROJECT_HOST_IDS });
  entries.push({ root, relativePath: OVERLAY_MANIFEST_PATH, content: manifestContent, encoding: "utf8", force: true, label: MANIFEST_OWNER });
  operations.push({ path: OVERLAY_MANIFEST_PATH, action: "write", observedDigest: manifestState.digest, observedMode: manifestState.mode, nextDigest: sha256(manifestContent) });

  const entryPaths = new Set(entries.map((entry) => entry.relativePath));
  for (let index = 0; index < entries.length; index += 1) {
    const state = observedFileStates.get(entries[index].relativePath);
    if (state) entries[index] = bindOverlayEntryState(root, entries[index].relativePath, state, entries[index]);
  }
  for (const [relativePath, state] of observedFileStates) {
    if (!entryPaths.has(relativePath)) entries.push(bindOverlayEntryState(root, relativePath, state));
  }
  if (doveStat === null) {
    entries.push({
      root,
      relativePath: ".dove",
      assertOnly: true,
      expectedState: { exists: false, type: "absent", sha256: null, mode: null },
      label: "Dove overlay replay assertion .dove"
    });
  }

  operations.sort((left, right) => left.path.localeCompare(right.path) || left.action.localeCompare(right.action));
  const plan = { fsOps, root, hosts, entries, operations, manifest, sourceTreeDigest, archiveRelativePath };
  return { ...plan, previewDigest: overlayPlanBinding(plan) };
}

function overlayPreviewShape(plan) {
  const mutationEntries = plan.entries.filter((entry) => entry.assertOnly !== true);
  const writtenPaths = mutationEntries.filter((entry) => entry.delete !== true && entry.moveTo === undefined).map((entry) => entry.relativePath);
  const removedPaths = mutationEntries.filter((entry) => entry.delete === true).map((entry) => entry.relativePath);
  const movedPaths = plan.archiveRelativePath ? [{ from: ".dove", to: plan.archiveRelativePath }] : [];
  return Object.freeze({
    status: "ready",
    previewVersion: OVERLAY_PREVIEW_VERSION,
    target: plan.root,
    hosts: Object.freeze([...plan.hosts]),
    writtenPaths: Object.freeze(writtenPaths),
    removedPaths: Object.freeze(removedPaths),
    movedPaths: Object.freeze(movedPaths.map(Object.freeze)),
    changedPaths: Object.freeze([...new Set([...writtenPaths, ...removedPaths, ...movedPaths.flatMap((move) => [move.from, move.to])])]),
    sourceTreeDigest: plan.sourceTreeDigest,
    archiveTarget: plan.archiveRelativePath ? path.join(plan.root, plan.archiveRelativePath) : null,
    manifest: plan.manifest,
    confirmation: Object.freeze({ required: true, exactReplay: true, previewDigest: plan.previewDigest })
  });
}

export function previewProjectIntegrationOverlayUpgrade(root, options = {}) {
  if (options.confirmed === true) throw new Error("Overlay upgrade preview does not accept confirmed execution.");
  return overlayPreviewShape(prepareOverlayUpgrade(root, options));
}

export function overlayUpgradeProjectIntegration(root, options = {}) {
  if (options.confirmed !== true) throw new Error("Dove project integration overlay upgrade requires confirmed: true.");
  const preview = options.preview;
  if (!plainObject(preview) || preview.status !== "ready" || preview.previewVersion !== OVERLAY_PREVIEW_VERSION) {
    throw new Error("Dove project integration overlay upgrade requires the exact preview returned for approval.");
  }
  if (preview.manifest?.package?.name !== options.packageName || preview.manifest?.package?.version !== options.packageVersion) {
    throw new Error("Dove project integration overlay execution package options must match the approved preview.");
  }
  const prepared = prepareOverlayUpgrade(root, options, preview);
  if (preview.target !== prepared.root
    || !sameArray(preview.hosts ?? [], prepared.hosts)
    || preview.sourceTreeDigest !== prepared.sourceTreeDigest
    || preview.archiveTarget !== (prepared.archiveRelativePath ? path.join(prepared.root, prepared.archiveRelativePath) : null)
    || preview.confirmation?.previewDigest !== prepared.previewDigest) {
    throw new Error("Dove project integration overlay preview is stale or does not match the approved project state.");
  }
  const transaction = writeFileSetTransaction(prepared.entries, { fsOps: prepared.fsOps });
  return {
    ...resultFromTransaction("overlay-upgraded", prepared.root, prepared.hosts, prepared.manifest, transaction),
    movedPaths: [...transaction.movedPaths],
    sourceTreeDigest: prepared.sourceTreeDigest,
    archiveTarget: prepared.archiveRelativePath ? path.join(prepared.root, prepared.archiveRelativePath) : null
  };
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

export const PROJECT_INTEGRATION_MANAGED_PATHS = Object.freeze(
  claudeResources().map((resource) => resource.path).sort()
);

export const PROJECT_INTEGRATION_CLAUDE_HOOK_COMMAND = DOVE_CLAUDE_AMBIENT_HOOK_COMMAND;
