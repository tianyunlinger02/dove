import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  DOVE_CLAUDE_AMBIENT_HOOK_COMMAND,
  DOVE_CLAUDE_AMBIENT_HOOK_ENTRY,
  DOVE_CLAUDE_SESSION_START_HOOK_ENTRY,
  DOVE_CLAUDE_SETTINGS_PATH,
  DOVE_CLAUDE_STATUS_LINE,
  mergeClaudeAmbientSettings
} from "./ambient-policy.mjs";
import {
  PAPER_SEARCH_MCP_FRAGMENT,
  PAPER_SEARCH_MCP_PATH,
  PAPER_SEARCH_MCP_SELECTOR,
  PAPER_SEARCH_MCP_SERVER_NAME
} from "./paper-search-integration.mjs";
import {
  EXA_MCP_FRAGMENT,
  EXA_MCP_SELECTOR,
  EXA_MCP_SERVER_NAME,
  WEB_FETCH_DENY_PERMISSION,
  WEB_FETCH_DENY_SELECTOR,
  mergeWebFetchDenyPermission,
  removeWebFetchDenyPermission,
  webFetchDenyFragmentState as inspectWebFetchDenyFragmentState
} from "./web-access-integration.mjs";
import { writeFileSetTransaction } from "./file-set-transaction.mjs";
import { PROJECT_HOST_IDS, normalizeHostSelection } from "./host-registry.mjs";
import { LEGACY_WORKSPACE_MARKER_PATH, readLegacyWorkspaceMarker } from "./legacy-workspace-marker.mjs";
import { classifyPackageCompatibility } from "./package-metadata.mjs";
import {
  INSTALLATION_MANIFEST_PATH,
  LEGACY_INSTALLATION_MANIFEST_PATH,
  createProjectInstallationManifest,
  readProjectInstallationManifest,
  readProjectInstallationManifestForMigration,
  serializeProjectInstallationManifest
} from "./project-installation-manifest.mjs";
import { resolveExactInstalledProjectRoot, resolveInstalledProjectRoot, resolveProjectRootForInit, resolveProjectRootForSetup } from "./project-root.mjs";
import { prepareResearchDefaults } from "./research-defaults.mjs";
import { inspectResearchDocuments } from "./research-documents.mjs";
import { parseJsonWithoutDuplicateKeys } from "./strict-json.mjs";
import { generatedAdapterEntries, generatedClaudeAmbientProjectEntries } from "../../scripts/generate-command-adapters.mjs";
import { generatedDoveAgentEntries } from "./dove-agent-definition.mjs";

const MCP_PATH = PAPER_SEARCH_MCP_PATH;
const SETTINGS_SELECTOR = "/hooks/UserPromptSubmit[dove-user-prompt-submit]";
const STATUS_LINE_SELECTOR = "/statusLine[dove-project-directory]";
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
  const agentEntries = generatedDoveAgentEntries().filter((entry) => entry.relativePath.startsWith(".claude/agents/"));
  const files = [
    ...generatedAdapterEntries().filter((entry) => entry.hostId === CLAUDE_HOST),
    ...generatedClaudeAmbientProjectEntries(),
    ...agentEntries
  ].map((entry) => {
    const destinationPath = entry.destinationPath ?? entry.relativePath;
    assertManagedResourcePath(destinationPath);
    const content = normalizedGeneratedContent(entry.content);
    return {
      hostId: CLAUDE_HOST,
      path: destinationPath,
      kind: "exclusive-file",
      selector: null,
      content,
      digest: sha256(content)
    };
  });
  const hooks = {
    SessionStart: DOVE_CLAUDE_SESSION_START_HOOK_ENTRY,
    UserPromptSubmit: DOVE_CLAUDE_AMBIENT_HOOK_ENTRY
  };
  const hook = {
    hostId: CLAUDE_HOST,
    path: DOVE_CLAUDE_SETTINGS_PATH,
    kind: "json-fragment",
    selector: SETTINGS_SELECTOR,
    fragment: hooks,
    digest: semanticDigest(hooks)
  };
  const statusLine = {
    hostId: CLAUDE_HOST,
    path: DOVE_CLAUDE_SETTINGS_PATH,
    kind: "json-fragment",
    selector: STATUS_LINE_SELECTOR,
    fragment: DOVE_CLAUDE_STATUS_LINE,
    digest: semanticDigest(DOVE_CLAUDE_STATUS_LINE)
  };
  const webFetchDeny = {
    hostId: CLAUDE_HOST,
    path: DOVE_CLAUDE_SETTINGS_PATH,
    kind: "json-fragment",
    selector: WEB_FETCH_DENY_SELECTOR,
    fragment: WEB_FETCH_DENY_PERMISSION,
    digest: semanticDigest(WEB_FETCH_DENY_PERMISSION)
  };
  const paperSearch = {
    hostId: CLAUDE_HOST,
    path: PAPER_SEARCH_MCP_PATH,
    kind: "json-fragment",
    selector: PAPER_SEARCH_MCP_SELECTOR,
    fragment: PAPER_SEARCH_MCP_FRAGMENT,
    digest: semanticDigest(PAPER_SEARCH_MCP_FRAGMENT)
  };
  const exa = {
    hostId: CLAUDE_HOST,
    path: PAPER_SEARCH_MCP_PATH,
    kind: "json-fragment",
    selector: EXA_MCP_SELECTOR,
    fragment: EXA_MCP_FRAGMENT,
    digest: semanticDigest(EXA_MCP_FRAGMENT)
  };
  const resources = [...files, hook, statusLine, webFetchDeny, paperSearch, exa];
  if (new Set(resources.map(managedKey)).size !== resources.length) throw new Error("Generated project integration resources contain duplicate manifest entries.");
  return resources;
}

function dshResources() {
  return generatedAdapterEntries().filter((entry) => entry.hostId === "dsh").map((entry) => {
    const content = normalizedGeneratedContent(entry.content);
    return {
      hostId: "dsh",
      path: entry.destinationPath,
      kind: "exclusive-file",
      selector: null,
      content,
      digest: sha256(content)
    };
  });
}

function resourcesForHosts(hosts) {
  return [...claudeResources(), ...dshResources()].filter((entry) => hosts.includes(entry.hostId)).sort(compareManaged);
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

function sameKeys(value, keys) {
  return plainObject(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(",");
}

function exactLegacyDoveStopHook(entry) {
  if (!sameKeys(entry, ["hooks"]) || !Array.isArray(entry.hooks) || entry.hooks.length !== 1) return false;
  const hook = entry.hooks[0];
  return sameKeys(hook, ["command", "timeout", "type"])
    && hook.type === "command"
    && hook.command === 'dove hook stop --project "$CLAUDE_PROJECT_DIR"'
    && hook.timeout === 10;
}

function hookCommandMarkers(eventName) {
  if (eventName === "SessionStart") return ["dove hook session-start"];
  if (eventName === "UserPromptSubmit") return ["dove hook user-prompt-submit", "dove-user-prompt-submit-package.mjs"];
  throw new Error(`Unsupported Dove Claude hook event: ${eventName}.`);
}

function referencesDoveHook(entry, eventName) {
  if (eventName === "Stop") return exactLegacyDoveStopHook(entry);
  if (!plainObject(entry) || !Array.isArray(entry.hooks)) return false;
  const markers = hookCommandMarkers(eventName);
  return entry.hooks.some((hook) => plainObject(hook)
    && typeof hook.command === "string"
    && markers.some((marker) => hook.command.includes(marker)));
}

function hookFragmentState(settings, eventName) {
  if (settings.hooks !== undefined && !plainObject(settings.hooks)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} hooks must be a JSON object.`);
  const entries = settings.hooks?.[eventName];
  if (entries !== undefined && !Array.isArray(entries)) {
    if (eventName === "Stop") return { exists: false, digest: null, index: -1, fragment: null };
    throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} hooks.${eventName} must be an array.`);
  }
  const candidates = (entries ?? []).map((entry, index) => ({ entry, index })).filter(({ entry }) => referencesDoveHook(entry, eventName));
  if (candidates.length > 1) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} defines multiple Dove ${eventName} hooks.`);
  if (candidates.length === 0) return { exists: false, digest: null, index: -1, fragment: null };
  return { exists: true, digest: semanticDigest(candidates[0].entry), index: candidates[0].index, fragment: candidates[0].entry };
}

function removeExactLegacyDoveStopHook(settings) {
  if (settings.hooks?.Stop === undefined) return { settings, changed: false };
  if (!plainObject(settings.hooks) || !Array.isArray(settings.hooks.Stop)) return { settings, changed: false };
  const entries = settings.hooks.Stop.filter((entry) => !exactLegacyDoveStopHook(entry));
  if (entries.length === settings.hooks.Stop.length) return { settings, changed: false };
  return {
    settings: {
      ...settings,
      hooks: {
        ...settings.hooks,
        Stop: entries
      }
    },
    changed: true
  };
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

function exaMcpFragmentState(config) {
  return namedMcpFragmentState(config, EXA_MCP_SERVER_NAME);
}

function webFetchDenyFragmentState(settings) {
  const state = inspectWebFetchDenyFragmentState(settings);
  return state.exists ? { ...state, digest: semanticDigest(state.fragment) } : state;
}

function settingsHookFragmentState(value, options = {}) {
  const prompt = hookFragmentState(value, "UserPromptSubmit");
  const sessionStart = hookFragmentState(value, "SessionStart");
  const stop = options.includeRetiredStop === true ? hookFragmentState(value, "Stop") : { exists: false };
  if (!prompt.exists) return { exists: false, digest: null, index: -1, fragment: null };
  const fragment = {
    UserPromptSubmit: prompt.fragment,
    ...(sessionStart.exists ? { SessionStart: sessionStart.fragment } : {}),
    ...(stop.exists ? { Stop: stop.fragment } : {})
  };
  return { exists: true, digest: semanticDigest(fragment), index: -1, fragment };
}

function fragmentState(resource, value) {
  if (resource.selector === SETTINGS_SELECTOR) return settingsHookFragmentState(value);
  if (resource.selector === STATUS_LINE_SELECTOR) {
    if (value.statusLine === undefined) return { exists: false, digest: null, index: -1, fragment: null };
    return { exists: true, digest: semanticDigest(value.statusLine), index: -1, fragment: value.statusLine };
  }
  if (resource.selector === WEB_FETCH_DENY_SELECTOR) return webFetchDenyFragmentState(value);
  if (resource.selector === PAPER_SEARCH_MCP_SELECTOR) return paperSearchMcpFragmentState(value);
  if (resource.selector === EXA_MCP_SELECTOR) return exaMcpFragmentState(value);
  throw new Error(`Unsupported Dove project integration selector: ${resource.selector}.`);
}

function removeFragment(resource, value, current) {
  if (resource.selector === SETTINGS_SELECTOR) {
    let next = value;
    for (const eventName of ["UserPromptSubmit", "SessionStart"]) {
      const state = hookFragmentState(next, eventName);
      if (!state.exists) continue;
      next = { ...next, hooks: { ...next.hooks, [eventName]: next.hooks[eventName].filter((_, index) => index !== state.index) } };
    }
    return next;
  }
  if (resource.selector === STATUS_LINE_SELECTOR) {
    const next = { ...value };
    if (JSON.stringify(next.statusLine) === JSON.stringify(DOVE_CLAUDE_STATUS_LINE)) delete next.statusLine;
    return next;
  }
  if (resource.selector === WEB_FETCH_DENY_SELECTOR) {
    return removeWebFetchDenyPermission(value).settings;
  }
  if (resource.selector === PAPER_SEARCH_MCP_SELECTOR) {
    const servers = { ...value.mcpServers };
    delete servers[PAPER_SEARCH_MCP_SERVER_NAME];
    return { ...value, mcpServers: servers };
  }
  if (resource.selector === EXA_MCP_SELECTOR) {
    const servers = { ...value.mcpServers };
    delete servers[EXA_MCP_SERVER_NAME];
    return { ...value, mcpServers: servers };
  }
  throw new Error(`Unsupported Dove project integration selector: ${resource.selector}.`);
}

function emptySharedJsonShell(resource, value) {
  if (resource.selector === PAPER_SEARCH_MCP_SELECTOR || resource.selector === EXA_MCP_SELECTOR) {
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
  if (resource.selector === STATUS_LINE_SELECTOR) {
    if (value.statusLine !== undefined && JSON.stringify(value.statusLine) !== JSON.stringify(DOVE_CLAUDE_STATUS_LINE)) throw conflictError(resource);
    return { ...value, statusLine: DOVE_CLAUDE_STATUS_LINE };
  }
  if (resource.selector === WEB_FETCH_DENY_SELECTOR) return mergeWebFetchDenyPermission(value).settings;
  if (resource.selector === PAPER_SEARCH_MCP_SELECTOR) {
    return {
      ...value,
      mcpServers: {
        ...(value.mcpServers ?? {}),
        [PAPER_SEARCH_MCP_SERVER_NAME]: resource.fragment
      }
    };
  }
  if (resource.selector === EXA_MCP_SELECTOR) {
    return {
      ...value,
      mcpServers: {
        ...(value.mcpServers ?? {}),
        [EXA_MCP_SERVER_NAME]: resource.fragment
      }
    };
  }
  throw new Error(`Dove does not install unsupported project-local fragment ${resource.path}#${resource.selector}.`);
}

function planJsonFragments(root, relativePath, desiredEntries, oldEntries, fsOps, options = {}) {
  const observed = inspectRegularProjectFile(root, relativePath, fsOps);
  const original = parseSharedJson(observed, relativePath);
  const desiredByKey = new Map(desiredEntries.map((entry) => [managedKey(entry), entry]));
  const oldByKey = new Map(oldEntries.map((entry) => [managedKey(entry), entry]));
  let next = original;
  let changed = false;
  const managesSettingsHook = relativePath === DOVE_CLAUDE_SETTINGS_PATH
    && [...oldEntries, ...desiredEntries].some((entry) => entry.selector === SETTINGS_SELECTOR);
  const originalSettingsHookWithRetiredStop = managesSettingsHook
    ? settingsHookFragmentState(original, { includeRetiredStop: true })
    : { exists: false, digest: null };
  if (managesSettingsHook) {
    const cleaned = removeExactLegacyDoveStopHook(next);
    next = cleaned.settings;
    changed = cleaned.changed;
  }

  for (const key of [...new Set([...oldByKey.keys(), ...desiredByKey.keys()])].sort()) {
    const desired = desiredByKey.get(key) ?? null;
    const oldEntry = oldByKey.get(key) ?? null;
    const resource = desired ?? oldEntry;
    const current = fragmentState(resource, next);
    if (!oldEntry) {
      if (current.exists && current.digest === desired.digest) continue;
      const adoptableClaudeHookFragment = options.adopt === true
        && relativePath === DOVE_CLAUDE_SETTINGS_PATH
        && resource.selector === SETTINGS_SELECTOR;
      if (adoptableClaudeHookFragment) {
        for (const eventName of ["UserPromptSubmit", "SessionStart"]) {
          const eventState = hookFragmentState(next, eventName);
          if (eventState.exists && eventState.digest !== semanticDigest(desired.fragment[eventName])) throw conflictError(desired);
        }
      } else if (current.exists) {
        throw conflictError(desired);
      }
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
      const oldEntryMatchesRetiredStop = managesSettingsHook
        && resource.selector === SETTINGS_SELECTOR
        && originalSettingsHookWithRetiredStop.exists
        && originalSettingsHookWithRetiredStop.digest === oldEntry.digest;
      if (current.digest !== oldEntry.digest && current.digest !== desired.digest && !oldEntryMatchesRetiredStop) throw driftError(resource, current.digest);
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
    const oldEntryMatchesRetiredStop = managesSettingsHook
      && resource.selector === SETTINGS_SELECTOR
      && originalSettingsHookWithRetiredStop.exists
      && originalSettingsHookWithRetiredStop.digest === oldEntry.digest;
    if (current.digest !== oldEntry.digest && !oldEntryMatchesRetiredStop) throw driftError(resource, current.digest);
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

function preparePlan({ root, hosts, packageName, packageVersion, now, fsOps, manifest = null, adopt = false }) {
  const oldByKey = new Map((manifest?.managed ?? []).map((entry) => [managedKey(entry), entry]));
  const desiredResources = resourcesForHosts(hosts).filter((entry) => {
    if (entry.selector !== WEB_FETCH_DENY_SELECTOR || oldByKey.has(managedKey(entry))) return true;
    const observed = inspectRegularProjectFile(root, entry.path, fsOps);
    if (!observed.exists) return true;
    return !inspectWebFetchDenyFragmentState(parseSharedJson(observed, entry.path)).exists;
  });
  const desiredByKey = new Map(desiredResources.map((entry) => [managedKey(entry), entry]));
  const entries = [];
  let resourcesChanged = false;
  const sharedPaths = [...new Set([
    ...desiredResources.filter((entry) => entry.kind === "json-fragment").map((entry) => entry.path),
    ...(manifest?.managed ?? []).filter((entry) => entry.kind === "json-fragment").map((entry) => entry.path),
    ...(desiredResources.some((entry) => entry.selector === WEB_FETCH_DENY_SELECTOR) || (manifest?.managed ?? []).some((entry) => entry.selector === WEB_FETCH_DENY_SELECTOR) ? [DOVE_CLAUDE_SETTINGS_PATH] : []),
    ...(desiredResources.some((entry) => entry.selector === EXA_MCP_SELECTOR) || (manifest?.managed ?? []).some((entry) => entry.selector === EXA_MCP_SELECTOR) ? [PAPER_SEARCH_MCP_PATH] : [])
  ])].sort();
  for (const relativePath of sharedPaths) {
    const planned = planJsonFragments(
      root,
      relativePath,
      desiredResources.filter((entry) => entry.kind === "json-fragment" && entry.path === relativePath),
      (manifest?.managed ?? []).filter((entry) => entry.kind === "json-fragment" && entry.path === relativePath),
      fsOps,
      { adopt }
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
  const plan = preparePlan({ root, hosts, packageName, packageVersion, now: exactTimestamp(options.now), fsOps, manifest });
  return { fsOps, root, hosts, currentManifest: manifest, ...plan };
}

function prepareInstalledPlan(start, options = {}) {
  return prepareInstalledIntegrationPlan(start, options);
}

function synchronizeProjectIntegration(start, options = {}) {
  const prepared = prepareInstalledPlan(start, options);
  const transaction = writeFileSetTransaction(
    prepared.entries,
    transactionOptions(prepared.fsOps)
  );
  return resultFromTransaction(transaction.changedPaths.length === 0 ? "unchanged" : "synchronized", prepared.root, prepared.hosts, prepared.manifest, transaction);
}

function assertIntegrationOnlyEntries(entries) {
  if (entries.some((entry) => entry.relativePath === ".dove/research" || entry.relativePath.startsWith(".dove/research/"))) {
    throw new Error("Dove hot sync refuses to write Dove research state.");
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
    throw new Error("Dove hot sync refuses missing, invalid, newer, or foreign project integration.");
  }
  if (!currentManifest.hosts.includes(CLAUDE_HOST)) {
    throw new Error("Dove hot sync requires Claude Code host integration.");
  }
  const plan = preparePlan({
    root,
    hosts: [...currentManifest.hosts],
    packageName: options.packageName,
    packageVersion: options.packageVersion,
    now: exactTimestamp(options.now),
    fsOps,
    manifest: currentManifest
  });
  assertIntegrationOnlyEntries(plan.entries);
  const transaction = writeFileSetTransaction(plan.entries, transactionOptions(fsOps));
  return resultFromTransaction(transaction.changedPaths.length === 0 ? "unchanged" : "synchronized", root, currentManifest.hosts, plan.manifest, transaction);
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
    adopt
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
  return { entries, manifest: planned.manifest, scope };
}

function previewShape(kind, root, hosts, prepared, confirmationRequired) {
  const writtenEntries = prepared.entries.filter((entry) => entry.delete !== true);
  const writtenPaths = writtenEntries.map((entry) => entry.relativePath);
  const removedPaths = prepared.entries.filter((entry) => entry.delete === true).map((entry) => entry.relativePath);
  const replacedPaths = kind === "reinstall" ? writtenPaths : [];
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
    writeFileSetTransaction(prepared.entries, transactionOptions(fsOps))
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
    writeFileSetTransaction(prepared.entries, transactionOptions(fsOps))
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
      fsOps
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
    preservedPaths: [".dove/research/**", ".dove/install/DOCTOR.md"],
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
    preservedPaths: [".dove/research/**", ".dove/install/DOCTOR.md"]
  };
}

export function updateProjectIntegration(start, options = {}) {
  return synchronizeProjectIntegration(start, options);
}

export const PROJECT_INTEGRATION_MANAGED_PATHS = Object.freeze(claudeResources().map((resource) => resource.path).sort());
export const PROJECT_INTEGRATION_CLAUDE_HOOK_COMMAND = DOVE_CLAUDE_AMBIENT_HOOK_COMMAND;
