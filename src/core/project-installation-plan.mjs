import fs from "node:fs";
import path from "node:path";

import {
  DOVE_CLAUDE_SETTINGS_PATH,
  DOVE_CLAUDE_STATUS_LINE,
  mergeClaudeAmbientSettings
} from "./ambient-policy.mjs";
import {
  PAPER_SEARCH_MCP_PATH,
  PAPER_SEARCH_MCP_SELECTOR,
  PAPER_SEARCH_MCP_SERVER_NAME
} from "./paper-search-integration.mjs";
import {
  EXA_MCP_SELECTOR,
  EXA_MCP_SERVER_NAME,
  WEB_FETCH_DENY_SELECTOR,
  mergeWebFetchDenyPermission,
  removeWebFetchDenyPermission,
  webFetchDenyFragmentState as inspectWebFetchDenyFragmentState
} from "./web-access-integration.mjs";
import { PROJECT_HOST_IDS } from "./host-registry.mjs";
import {
  INSTALLATION_MANIFEST_PATH,
  createProjectInstallationManifest,
  serializeProjectInstallationManifest
} from "./project-installation-manifest.mjs";
import {
  SETTINGS_SELECTOR,
  STATUS_LINE_SELECTOR,
  canonicalJson,
  compareManaged,
  desiredManaged,
  managedKey,
  resourcesForHosts,
  sameArray,
  sameManaged,
  samePackage,
  semanticDigest,
  sha256
} from "./project-installation-resources.mjs";
import { parseJsonWithoutDuplicateKeys } from "./strict-json.mjs";

function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function lstatOrNull(fsOps, targetPath) {
  try {
    return fsOps.lstatSync(targetPath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

export function inspectRegularProjectFile(root, relativePath, fsOps = fs) {
  let current = root;
  const components = relativePath.split("/");
  for (const [index, component] of components.entries()) {
    current = path.join(current, component);
    const stat = lstatOrNull(fsOps, current);
    if (stat === null) return { exists: false, bytes: null, digest: null, mode: null, type: "absent" };
    if (stat.isSymbolicLink()) throw new Error(`Dove project integration path must not be a symbolic link: ${relativePath}.`);
    if (index < components.length - 1) {
      if (!stat.isDirectory()) throw new Error(`Dove project integration parent must be a directory: ${relativePath}.`);
      continue;
    }
    if (!stat.isFile()) throw new Error(`Dove project integration path must be absent or a regular file: ${relativePath}.`);
    const bytes = fsOps.readFileSync(current);
    return { exists: true, bytes, digest: sha256(bytes), mode: stat.mode & 0o7777, type: "file" };
  }
  throw new Error(`Invalid Dove project integration path: ${relativePath}.`);
}

export function expectedFileState(state) {
  return state.exists
    ? { exists: true, type: "file", sha256: state.digest, mode: state.mode }
    : { exists: false, type: "absent", sha256: null, mode: null };
}

export function transactionWrite(root, resource, content, observed) {
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

export function transactionDelete(root, resource, observed) {
  return {
    root,
    relativePath: resource.path,
    delete: true,
    force: true,
    expectedState: expectedFileState(observed),
    label: `Dove project integration resource ${resource.path}`
  };
}

export function parseSharedJson(state, relativePath) {
  if (!state.exists) return {};
  const value = parseJsonWithoutDuplicateKeys(state.bytes.toString("utf8"), relativePath);
  if (!plainObject(value)) throw new Error(`${relativePath} must contain a JSON object.`);
  return value;
}

export function serializeSharedJson(value) {
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
  if (config.mcpServers !== undefined && !plainObject(config.mcpServers)) throw new Error(`${PAPER_SEARCH_MCP_PATH} mcpServers must be a JSON object.`);
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

function removeFragment(resource, value, current, options = {}) {
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
    if (options.force === true || JSON.stringify(next.statusLine) === JSON.stringify(DOVE_CLAUDE_STATUS_LINE)) delete next.statusLine;
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

function planExclusive(root, desired, oldEntry, fsOps, options = {}) {
  const resource = desired ?? oldEntry;
  const replaceDrift = options.replacementPolicy === "confirmed-reinstall";
  const observed = inspectRegularProjectFile(root, resource.path, fsOps);
  if (!oldEntry) {
    if (!observed.exists) return { entry: transactionWrite(root, desired, desired.content, observed), changed: true };
    if (observed.digest === desired.digest) return { entry: null, changed: false };
    throw conflictError(desired);
  }
  if (desired) {
    if (!observed.exists) return { entry: transactionWrite(root, desired, desired.content, observed), changed: true };
    if (!replaceDrift && observed.digest !== oldEntry.digest && observed.digest !== desired.digest) throw driftError(resource, observed.digest);
    if (observed.digest === desired.digest) return { entry: null, changed: oldEntry.digest !== desired.digest };
    return { entry: transactionWrite(root, desired, desired.content, observed), changed: true };
  }
  if (!observed.exists) return { entry: null, changed: true };
  if (!replaceDrift && observed.digest !== oldEntry.digest) throw driftError(resource, observed.digest);
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

export function planJsonFragments(root, relativePath, desiredEntries, oldEntries, fsOps = fs, options = {}) {
  const replaceDrift = options.replacementPolicy === "confirmed-reinstall";
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
      if (!replaceDrift && current.digest !== oldEntry.digest && current.digest !== desired.digest && !oldEntryMatchesRetiredStop) throw driftError(resource, current.digest);
      if (current.digest === desired.digest) {
        if (oldEntry.digest !== desired.digest) changed = true;
        continue;
      }
      next = addFragment(desired, removeFragment(desired, next, current, { force: replaceDrift }));
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
    if (!replaceDrift && current.digest !== oldEntry.digest && !oldEntryMatchesRetiredStop) throw driftError(resource, current.digest);
    next = removeFragment(resource, next, current, { force: replaceDrift });
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

export function planResource(root, desired, oldEntry, fsOps = fs, options = {}) {
  const kind = desired?.kind ?? oldEntry.kind;
  if (kind === "exclusive-file") return planExclusive(root, desired, oldEntry, fsOps, options);
  throw new Error(`Unsupported project integration resource kind: ${kind}.`);
}

export function preparePlan({ root, hosts, packageName, packageVersion, now, fsOps = fs, manifest = null, adopt = false, replacementPolicy = "safe" }) {
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
      { adopt, replacementPolicy }
    );
    if (planned.entry) entries.push(planned.entry);
    if (planned.changed) resourcesChanged = true;
  }
  const keys = [...new Set([...oldByKey.keys(), ...desiredByKey.keys()])]
    .filter((key) => (desiredByKey.get(key) ?? oldByKey.get(key)).kind !== "json-fragment")
    .sort();
  for (const key of keys) {
    const planned = planResource(root, desiredByKey.get(key) ?? null, oldByKey.get(key) ?? null, fsOps, { replacementPolicy });
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
