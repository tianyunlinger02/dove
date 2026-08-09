import crypto from "node:crypto";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  DOVE_CLAUDE_AMBIENT_HOOK_COMMAND,
  DOVE_CLAUDE_AMBIENT_RULE_PATH,
  DOVE_CLAUDE_AMBIENT_SKILL_PATH,
  DOVE_CLAUDE_SETTINGS_PATH,
  mergeClaudeAmbientSettings
} from "./ambient-policy.mjs";
import {
  DOVE_MCP_CONFIG_PATH,
  DOVE_MCP_SERVER_NAME,
  INSTALLED_DOVE_MCP_SERVER,
  PACKAGE_RUNTIME_PATHS
} from "./command-manifest.mjs";
import { PROJECT_HOST_IDS } from "./host-registry.mjs";
import {
  DOVE_CLAUDE_LOCAL_SETTINGS_PATH,
  DOVE_CLAUDE_MCP_APPROVAL_SELECTOR,
  inspectClaudeMcpApprovalSettings
} from "./claude-project-settings.mjs";
import {
  inspectProjectIntegration,
  previewProjectCompleteReinstall,
  previewProjectUpgrade
} from "./project-installation.mjs";
import {
  INSTALLATION_MANIFEST_PATH,
  LEGACY_INSTALLATION_MANIFEST_PATH,
  readLegacyProjectInstallationManifest,
  readProjectInstallationManifest
} from "./project-installation-manifest.mjs";
import { inspectLegacyProjectInstallation } from "./project-legacy-installation.mjs";
import { inspectProjectRoot } from "./project-root.mjs";
import { classifyProjectSetup } from "./project-setup-classification.mjs";
import { parseJsonWithoutDuplicateKeys } from "./strict-json.mjs";
import { ARTIFACT_PATHS, DOVE_RESEARCH_FORMAT, RESEARCH_DIRECTORIES, RESEARCH_REQUIRED_FILES } from "./schema.mjs";
import { DOVE_MCP_PROBE_PROTOCOL_VERSION } from "./mcp-runtime-identity.mjs";

const MODULE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PACKAGE_ROOT = path.resolve(MODULE_DIRECTORY, "../..");
const SHA256 = /^[a-f0-9]{64}$/u;

function messageFor(error) {
  return error instanceof Error ? error.message : String(error);
}

function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function lstatOrNull(targetPath) {
  try {
    return fs.lstatSync(targetPath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function regularNonSymlink(targetPath) {
  try {
    const stat = fs.lstatSync(targetPath);
    return stat.isFile() && !stat.isSymbolicLink();
  } catch {
    return false;
  }
}

function containedPackagePath(packageRoot, relativePath) {
  const absolutePath = path.resolve(packageRoot, relativePath);
  const relative = path.relative(packageRoot, absolutePath);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function defaultInspectPathExecutable() {
  const result = spawnSync("which", ["dove"], {
    encoding: "utf8",
    shell: false,
    timeout: 5000,
    maxBuffer: 64 * 1024
  });
  if (result.error?.code === "ENOENT" || result.status !== 0) {
    return { found: false, path: null, usable: false, state: "unavailable" };
  }
  const executablePath = String(result.stdout ?? "").split(/\r?\n/u).map((item) => item.trim()).find(Boolean) ?? null;
  return { found: executablePath !== null, path: executablePath, usable: executablePath !== null, state: executablePath ? "found" : "unavailable" };
}

function normalizeExecutableInspection(value) {
  if (typeof value === "string") return { found: true, path: value, usable: true, state: "found", message: null };
  if (!plainObject(value)) return { found: false, path: null, usable: false, state: "invalid-result", message: "PATH executable inspection returned an invalid result." };
  const executablePath = typeof value.path === "string" && value.path ? value.path : null;
  const found = value.found === true || executablePath !== null;
  return {
    found,
    path: executablePath,
    usable: value.usable === undefined ? found : value.usable === true,
    state: typeof value.state === "string" && value.state ? value.state : found ? "found" : "unavailable",
    message: typeof value.message === "string" ? value.message : null
  };
}

function inspectUserCli(options) {
  const packageRoot = path.resolve(options.packageRoot ?? DEFAULT_PACKAGE_ROOT);
  const runtimePaths = (options.packageRuntimePaths ?? PACKAGE_RUNTIME_PATHS).map((relativePath) => {
    const absolutePath = path.resolve(packageRoot, relativePath);
    const contained = containedPackagePath(packageRoot, relativePath);
    const healthy = contained && regularNonSymlink(absolutePath);
    return { path: relativePath, absolutePath, healthy, state: healthy ? "current" : contained ? "missing-or-invalid" : "outside-package-root" };
  });
  const executablePath = path.resolve(options.executablePath ?? path.join(packageRoot, "bin/dove-package.mjs"));
  const executableRelative = path.relative(packageRoot, executablePath);
  const executableContained = executableRelative === "" || (!executableRelative.startsWith("..") && !path.isAbsolute(executableRelative));
  const executable = {
    path: executablePath,
    healthy: executableContained && regularNonSymlink(executablePath),
    state: executableContained && regularNonSymlink(executablePath) ? "current" : executableContained ? "missing-or-invalid" : "outside-package-root"
  };
  let pathExecutable;
  try {
    const inspected = options.inspectPathExecutable
      ? options.inspectPathExecutable({ command: "dove", packageRoot, executablePath })
      : options.commandResolver
        ? options.commandResolver("dove")
        : defaultInspectPathExecutable();
    pathExecutable = normalizeExecutableInspection(inspected);
  } catch (error) {
    pathExecutable = { found: false, path: null, usable: false, state: "failed", message: messageFor(error) };
  }
  const registry = options.inspectStaticRuntime
    ? options.inspectStaticRuntime({ packageRoot })
    : { healthy: true, state: "loadable" };
  const staticRuntime = plainObject(registry)
    ? { healthy: registry.healthy === true, state: registry.state ?? (registry.healthy === true ? "loadable" : "invalid"), message: registry.message ?? null }
    : { healthy: false, state: "invalid-result", message: "Static runtime inspection returned an invalid result." };
  const healthy = runtimePaths.every((entry) => entry.healthy) && executable.healthy && pathExecutable.usable && staticRuntime.healthy;
  return {
    healthy,
    state: healthy ? "healthy" : "unhealthy",
    package: { name: options.packageName ?? null, version: options.packageVersion ?? null, root: packageRoot },
    runtimePaths,
    executable,
    pathExecutable,
    staticRuntime,
    missing: runtimePaths.filter((entry) => !entry.healthy).map((entry) => entry.path)
  };
}

function decodePointerToken(value) {
  return value.replaceAll("~1", "/").replaceAll("~0", "~");
}

function referencesDovePromptHook(value) {
  return plainObject(value) && Array.isArray(value.hooks) && value.hooks.some((hook) => plainObject(hook)
    && typeof hook.command === "string"
    && (hook.command.includes("dove hook user-prompt-submit") || hook.command.includes("dove-user-prompt-submit-package.mjs")));
}

function extractJsonPointer(value, selector) {
  if (selector === "") return value;
  if (selector === "/hooks/UserPromptSubmit[dove-user-prompt-submit]") {
    const entries = value?.hooks?.UserPromptSubmit;
    if (!Array.isArray(entries)) throw new Error(`JSON fragment selector does not exist: ${selector}.`);
    const matches = entries.filter(referencesDovePromptHook);
    if (matches.length !== 1) throw new Error(`JSON fragment selector must resolve exactly once: ${selector}.`);
    return matches[0];
  }
  if (selector === DOVE_CLAUDE_MCP_APPROVAL_SELECTOR) {
    const approval = inspectClaudeMcpApprovalSettings(value);
    if (!approval.approved) throw new Error(`JSON fragment selector does not exist: ${selector}.`);
    return DOVE_MCP_SERVER_NAME;
  }
  if (typeof selector !== "string" || !selector.startsWith("/")) throw new Error(`Unsupported JSON fragment selector: ${String(selector)}.`);
  let current = value;
  for (const rawToken of selector.slice(1).split("/")) {
    const token = decodePointerToken(rawToken);
    if (Array.isArray(current)) {
      if (!/^(?:0|[1-9]\d*)$/u.test(token) || Number(token) >= current.length) throw new Error(`JSON fragment selector does not exist: ${selector}.`);
      current = current[Number(token)];
    } else if (plainObject(current) && Object.hasOwn(current, token)) {
      current = current[token];
    } else {
      throw new Error(`JSON fragment selector does not exist: ${selector}.`);
    }
  }
  return current;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (plainObject(value)) {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stableValue(item)]));
  }
  return value;
}

function managedContentDigest(root, entry) {
  const absolutePath = path.join(root, entry.path);
  const stat = lstatOrNull(absolutePath);
  if (stat === null) return { state: "missing", digest: null, message: null };
  if (stat.isSymbolicLink() || !stat.isFile()) return { state: "drifted", digest: null, message: `${entry.path} must be a regular non-symbolic-link file.` };
  if (entry.mode === "exclusive-file") return { state: "current", digest: sha256(fs.readFileSync(absolutePath)), message: null };
  if (entry.mode === "json-fragment") {
    try {
      const value = parseJsonWithoutDuplicateKeys(fs.readFileSync(absolutePath, "utf8"), entry.path);
      const fragment = extractJsonPointer(value, entry.selector);
      return { state: "current", digest: sha256(JSON.stringify(stableValue(fragment))), message: null };
    } catch (error) {
      return { state: "drifted", digest: null, message: messageFor(error) };
    }
  }
  return { state: "drifted", digest: null, message: `Managed mode ${entry.mode} is not inspectable by project doctor.` };
}

function inspectIntegrationManifest(start, options) {
  const project = inspectProjectRoot(start, { fsOps: options.fsOps, hostIds: PROJECT_HOST_IDS });
  if (!project.initialized) {
    return {
      healthy: false,
      state: project.state,
      start: project.start,
      root: project.root,
      error: project.error,
      manifest: null,
      missing: [],
      drifted: []
    };
  }
  let manifest;
  try {
    manifest = options.readInstallationManifest
      ? options.readInstallationManifest(project.root)
      : readProjectInstallationManifest(project.root, { fsOps: options.fsOps, hostIds: PROJECT_HOST_IDS, allowPrevious: true });
  } catch (error) {
    return invalidIntegration(project, error);
  }
  try {
    const ownership = inspectManifestOwnership(project, manifest);
    if (!ownership.healthy) return ownership;
    const inspectCurrentIntegration = options.inspectCurrentIntegration ?? inspectProjectIntegration;
    const canonical = inspectCurrentIntegration(project.root, {
      packageName: options.packageName ?? manifest.package.name,
      packageVersion: options.packageVersion ?? manifest.package.version,
      fsOps: options.fsOps
    });
    if (canonical.status === "needs-sync") {
      return {
        ...ownership,
        healthy: false,
        state: "needs-sync",
        error: null,
        needsSync: true,
        syncPaths: [...canonical.changedPaths]
      };
    }
    return {
      ...ownership,
      state: "current",
      needsSync: false,
      syncPaths: []
    };
  } catch (error) {
    return {
      healthy: false,
      state: "invalid",
      start: project.start,
      root: project.root,
      error: messageFor(error),
      manifest: {
        path: INSTALLATION_MANIFEST_PATH,
        schemaVersion: manifest.schemaVersion,
        integrationVersion: manifest.integrationVersion,
        ownershipVersion: manifest.ownershipVersion,
        installationId: manifest.installationId,
        package: manifest.package,
        runtime: manifest.runtime,
        hosts: [...manifest.hosts]
      },
      managed: [],
      missing: [],
      drifted: []
    };
  }
}

function invalidIntegration(project, error) {
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

function inspectManifestOwnership(project, manifest, manifestPath = INSTALLATION_MANIFEST_PATH) {
  const managed = manifest.managed.map((entry) => {
    try {
      const inspected = managedContentDigest(project.root, entry);
      const healthy = inspected.state === "current" && SHA256.test(entry.digest) && inspected.digest === entry.digest;
      return {
        path: entry.path,
        owner: entry.owner,
        mode: entry.mode,
        selector: entry.selector,
        expectedDigest: entry.digest,
        actualDigest: inspected.digest,
        healthy,
        state: inspected.state === "missing" ? "missing" : healthy ? "current" : "drifted",
        message: inspected.message
      };
    } catch (error) {
      return {
        path: entry.path,
        owner: entry.owner,
        mode: entry.mode,
        selector: entry.selector,
        expectedDigest: entry.digest,
        actualDigest: null,
        healthy: false,
        state: "drifted",
        message: messageFor(error)
      };
    }
  });
  const missing = managed.filter((entry) => entry.state === "missing").map((entry) => entry.path);
  const drifted = managed.filter((entry) => entry.state === "drifted").map((entry) => entry.path);
  const healthy = missing.length === 0 && drifted.length === 0;
  return {
    healthy,
    state: healthy ? "healthy" : "drifted",
    start: project.start,
    root: project.root,
    error: null,
    manifest: {
      path: manifestPath,
      schemaVersion: manifest.schemaVersion,
      integrationVersion: manifest.integrationVersion,
      ownershipVersion: manifest.ownershipVersion,
      installationId: manifest.installationId,
      package: manifest.package,
      runtime: manifest.runtime,
      hosts: [...manifest.hosts]
    },
    managed,
    missing,
    drifted
  };
}

function previewState(callback) {
  try {
    const preview = callback();
    return { ready: preview.status === "ready", error: null, preview };
  } catch (error) {
    return { ready: false, error: messageFor(error), preview: null };
  }
}

function inspectMigrationInstallation(root, options = {}) {
  const currentPath = path.join(root, INSTALLATION_MANIFEST_PATH);
  const legacyPath = path.join(root, LEGACY_INSTALLATION_MANIFEST_PATH);
  const current = lstatOrNull(currentPath);
  const legacy = lstatOrNull(legacyPath);
  const legacyDirectory = lstatOrNull(path.join(root, ".dove-install"));
  const currentDirectory = lstatOrNull(path.join(root, ".dove/install"));
  const legacyResearch = lstatOrNull(path.join(root, ".dove/manifest.json"));
  const requiresReinstallPreview = legacy !== null || legacyDirectory !== null || legacyResearch !== null;
  const reinstall = requiresReinstallPreview
    ? previewState(() => previewProjectCompleteReinstall(root, { ...options, fsOps: options.fsOps ?? fs }))
    : { ready: false, error: null, preview: null };
  const result = (state, fields = {}) => ({
    state,
    root,
    markerPath: legacy === null ? null : LEGACY_INSTALLATION_MANIFEST_PATH,
    upgrade: { ready: false, error: null, preview: null },
    reinstall,
    ...fields
  });

  if (current !== null && legacy !== null) {
    return result("conflicting-manifests", {
      error: "Dove found both current and legacy project installation manifests."
    });
  }
  if (legacy === null) {
    if (legacyDirectory !== null || (current === null && currentDirectory !== null)) {
      return result("invalid-legacy", {
        error: "Dove found an incomplete current or legacy installation directory without its manifest."
      });
    }
    return result("absent", { error: null });
  }
  if (legacy.isSymbolicLink() || !legacy.isFile()) {
    return result("invalid-legacy", {
      error: `Dove legacy project installation manifest must be a regular non-symbolic-link file: ${legacyPath}.`
    });
  }
  try {
    const manifest = readLegacyProjectInstallationManifest(root, {
      fsOps: options.fsOps,
      hostIds: PROJECT_HOST_IDS,
      allowPrevious: true
    });
    const ownership = inspectManifestOwnership({ start: root, root }, manifest, LEGACY_INSTALLATION_MANIFEST_PATH);
    if (!ownership.healthy) {
      return result("invalid-legacy", {
        error: "Dove legacy project installation ownership has missing or drifted resources.",
        manifest: ownership.manifest,
        managed: ownership.managed,
        missing: ownership.missing,
        drifted: ownership.drifted
      });
    }
    const upgrade = previewState(() => previewProjectUpgrade(root, { ...options, fsOps: options.fsOps ?? fs }));
    if (!upgrade.ready) {
      return result("invalid-legacy", {
        error: upgrade.error,
        manifest: ownership.manifest,
        managed: ownership.managed,
        missing: [],
        drifted: []
      });
    }
    return result("valid-legacy", {
      error: null,
      manifest: ownership.manifest,
      managed: ownership.managed,
      missing: [],
      drifted: [],
      upgrade
    });
  } catch (error) {
    return result("invalid-legacy", { error: messageFor(error) });
  }
}

function workspaceResult(fields) {
  return { format: null, error: null, zeroWrite: true, ...fields };
}

function inspectWorkspace(root, options = {}) {
  if (!root) return workspaceResult({ healthy: false, state: "unavailable", mode: "unavailable", category: "invalid", error: "Project root is unavailable." });
  const fsOps = options.fsOps ?? fs;
  const statOrNull = (targetPath) => {
    try {
      return fsOps.lstatSync(targetPath);
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
  };
  const doveRoot = path.join(root, ARTIFACT_PATHS.doveRoot);
  const formatPath = path.join(root, ARTIFACT_PATHS.format);
  try {
    const rootStat = statOrNull(doveRoot);
    if (rootStat === null) return workspaceResult({ healthy: true, state: "absent", mode: "absent", category: "absent" });
    if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
      return workspaceResult({ healthy: false, state: "invalid-root", mode: "invalid", category: "invalid", error: `${ARTIFACT_PATHS.doveRoot} must be a real directory.` });
    }
    const formatStat = statOrNull(formatPath);
    if (formatStat === null) {
      const legacyManifest = statOrNull(path.join(root, ".dove/manifest.json"));
      if (legacyManifest !== null) return workspaceResult({ healthy: false, state: "unsupported-legacy-format", mode: "unsupported", category: "legacy", error: "unsupported-legacy-format" });
      const doveChildren = fsOps.readdirSync(doveRoot).map(String).sort();
      const allowedDoveChildren = new Set(["archive", "install"]);
      if (doveChildren.length > 0 && doveChildren.every((child) => allowedDoveChildren.has(child))) {
        const installDirectory = doveChildren.includes("install") ? statOrNull(path.join(root, ARTIFACT_PATHS.installDir)) : null;
        const archiveStat = doveChildren.includes("archive") ? statOrNull(path.join(root, ".dove/archive")) : null;
        let installHealthy = installDirectory === null;
        if (installDirectory !== null && installDirectory.isDirectory() && !installDirectory.isSymbolicLink()) {
          const installChildren = fsOps.readdirSync(path.join(root, ARTIFACT_PATHS.installDir)).map(String).sort();
          const allowedInstallChildren = new Set(["manifest.json", "transactions"]);
          const installManifest = installChildren.includes("manifest.json") ? statOrNull(path.join(root, INSTALLATION_MANIFEST_PATH)) : null;
          const transactionsStat = installChildren.includes("transactions") ? statOrNull(path.join(root, ARTIFACT_PATHS.transactionsDir)) : null;
          installHealthy = installChildren.every((child) => allowedInstallChildren.has(child))
            && (installManifest === null || (installManifest.isFile() && !installManifest.isSymbolicLink()))
            && (transactionsStat === null || (transactionsStat.isDirectory() && !transactionsStat.isSymbolicLink()));
        }
        if (installHealthy && (archiveStat === null || (archiveStat.isDirectory() && !archiveStat.isSymbolicLink()))) {
          return workspaceResult({ healthy: true, state: "absent", mode: "absent", category: "absent" });
        }
      }
      return workspaceResult({ healthy: false, state: "unknown-format", mode: "invalid", category: "unknown", error: "unknown-format" });
    }
    if (formatStat.isSymbolicLink() || !formatStat.isFile()) {
      return workspaceResult({ healthy: false, state: "invalid-format", mode: "invalid", category: "invalid", error: `${ARTIFACT_PATHS.format} must be a regular file.` });
    }
    const marker = parseJsonWithoutDuplicateKeys(fsOps.readFileSync(formatPath, "utf8"), ARTIFACT_PATHS.format);
    if (!plainObject(marker) || Object.keys(marker).length !== 1 || typeof marker.format !== "string" || marker.format.length === 0) {
      return workspaceResult({ healthy: false, state: "invalid-format", mode: "invalid", category: "invalid", error: `${ARTIFACT_PATHS.format} must contain only a non-empty format discriminator.` });
    }
    if (marker.format !== DOVE_RESEARCH_FORMAT) {
      return workspaceResult({ healthy: false, state: "unsupported-format", mode: "unsupported", category: "unknown", format: marker.format, error: "unsupported-format" });
    }
    const layoutProblems = [];
    for (const relativePath of RESEARCH_DIRECTORIES) {
      const stat = statOrNull(path.join(root, relativePath));
      if (stat === null) layoutProblems.push(`${relativePath} is missing`);
      else if (stat.isSymbolicLink() || !stat.isDirectory()) layoutProblems.push(`${relativePath} must be a real directory`);
    }
    for (const relativePath of RESEARCH_REQUIRED_FILES.filter((item) => item !== ARTIFACT_PATHS.format)) {
      const stat = statOrNull(path.join(root, relativePath));
      if (stat === null) layoutProblems.push(`${relativePath} is missing`);
      else if (stat.isSymbolicLink() || !stat.isFile()) layoutProblems.push(`${relativePath} must be a regular file`);
    }
    if (layoutProblems.length > 0) {
      return workspaceResult({ healthy: false, state: "incomplete-current-format", mode: "invalid", category: "invalid", format: marker.format, error: layoutProblems.join("; ") });
    }
    return workspaceResult({ healthy: true, state: "readable-current-format", mode: "current", category: "current", format: marker.format });
  } catch (error) {
    return workspaceResult({ healthy: false, state: "invalid-format", mode: "invalid", category: "invalid", error: messageFor(error) });
  }
}

function sameMcpServer(value) {
  return plainObject(value)
    && Object.keys(value).sort().join(",") === "args,command,type"
    && value.type === INSTALLED_DOVE_MCP_SERVER.type
    && value.command === INSTALLED_DOVE_MCP_SERVER.command
    && Array.isArray(value.args)
    && value.args.length === INSTALLED_DOVE_MCP_SERVER.args.length
    && value.args.every((item, index) => item === INSTALLED_DOVE_MCP_SERVER.args[index]);
}

function inspectClaudeRegistration(root, integration) {
  if (!root || !integration.manifest?.hosts?.includes("claude")) {
    return { healthy: false, state: root ? "not-registered" : "unavailable", host: "claude", mcp: { healthy: false, state: "missing" }, approval: { healthy: false, state: "missing" }, ambient: { healthy: false, state: "missing", missing: [], drifted: [] }, missing: [], drifted: [] };
  }
  const missing = [];
  const drifted = [];
  let mcp = { healthy: false, state: "missing", message: null };
  try {
    const mcpPath = path.join(root, DOVE_MCP_CONFIG_PATH);
    const stat = lstatOrNull(mcpPath);
    if (stat === null) missing.push(DOVE_MCP_CONFIG_PATH);
    else if (stat.isSymbolicLink() || !stat.isFile()) drifted.push(DOVE_MCP_CONFIG_PATH);
    else {
      const value = parseJsonWithoutDuplicateKeys(fs.readFileSync(mcpPath, "utf8"), DOVE_MCP_CONFIG_PATH);
      mcp = sameMcpServer(value?.mcpServers?.[DOVE_MCP_SERVER_NAME])
        ? { healthy: true, state: "registered", message: null }
        : { healthy: false, state: "drifted", message: `${DOVE_MCP_CONFIG_PATH} does not contain the current Dove user-CLI registration.` };
      if (!mcp.healthy) drifted.push(DOVE_MCP_CONFIG_PATH);
    }
  } catch (error) {
    mcp = { healthy: false, state: "invalid", message: messageFor(error) };
    drifted.push(DOVE_MCP_CONFIG_PATH);
  }

  let approval = { healthy: false, state: "missing", message: null };
  try {
    const approvalPath = path.join(root, DOVE_CLAUDE_LOCAL_SETTINGS_PATH);
    const stat = lstatOrNull(approvalPath);
    if (stat === null) missing.push(DOVE_CLAUDE_LOCAL_SETTINGS_PATH);
    else if (stat.isSymbolicLink() || !stat.isFile()) drifted.push(DOVE_CLAUDE_LOCAL_SETTINGS_PATH);
    else {
      const settings = parseJsonWithoutDuplicateKeys(fs.readFileSync(approvalPath, "utf8"), DOVE_CLAUDE_LOCAL_SETTINGS_PATH);
      const inspected = inspectClaudeMcpApprovalSettings(settings);
      approval = inspected.disabled
        ? { healthy: false, state: "disabled", message: "Dove MCP is explicitly disabled in Claude project-local settings." }
        : inspected.approved
          ? { healthy: true, state: "approved", message: null }
          : { healthy: false, state: "missing", message: "Dove MCP is not approved in Claude project-local settings." };
      if (!approval.healthy) drifted.push(DOVE_CLAUDE_LOCAL_SETTINGS_PATH);
    }
  } catch (error) {
    approval = { healthy: false, state: "invalid", message: messageFor(error) };
    drifted.push(DOVE_CLAUDE_LOCAL_SETTINGS_PATH);
  }

  for (const relativePath of [DOVE_CLAUDE_AMBIENT_RULE_PATH, DOVE_CLAUDE_AMBIENT_SKILL_PATH]) {
    if (!regularNonSymlink(path.join(root, relativePath))) missing.push(relativePath);
  }
  let ambientMessage = null;
  try {
    const settingsPath = path.join(root, DOVE_CLAUDE_SETTINGS_PATH);
    const stat = lstatOrNull(settingsPath);
    if (stat === null) missing.push(DOVE_CLAUDE_SETTINGS_PATH);
    else if (stat.isSymbolicLink() || !stat.isFile()) drifted.push(DOVE_CLAUDE_SETTINGS_PATH);
    else {
      const settings = parseJsonWithoutDuplicateKeys(fs.readFileSync(settingsPath, "utf8"), DOVE_CLAUDE_SETTINGS_PATH);
      const merged = mergeClaudeAmbientSettings(settings);
      if (merged.changed) {
        drifted.push(DOVE_CLAUDE_SETTINGS_PATH);
        ambientMessage = `${DOVE_CLAUDE_SETTINGS_PATH} does not contain ${DOVE_CLAUDE_AMBIENT_HOOK_COMMAND}.`;
      }
    }
  } catch (error) {
    drifted.push(DOVE_CLAUDE_SETTINGS_PATH);
    ambientMessage = messageFor(error);
  }
  const uniqueMissing = [...new Set(missing)];
  const uniqueDrifted = [...new Set(drifted)];
  const ambientHealthy = uniqueMissing.filter((item) => item !== DOVE_MCP_CONFIG_PATH).length === 0
    && uniqueDrifted.filter((item) => item !== DOVE_MCP_CONFIG_PATH).length === 0;
  const healthy = mcp.healthy && approval.healthy && ambientHealthy;
  return {
    healthy,
    state: healthy ? "registered" : "unhealthy",
    host: "claude",
    mcp,
    approval,
    ambient: { healthy: ambientHealthy, state: ambientHealthy ? "configured" : uniqueMissing.length > 0 ? "missing" : "drifted", missing: uniqueMissing.filter((item) => ![DOVE_MCP_CONFIG_PATH, DOVE_CLAUDE_LOCAL_SETTINGS_PATH].includes(item)), drifted: uniqueDrifted.filter((item) => ![DOVE_MCP_CONFIG_PATH, DOVE_CLAUDE_LOCAL_SETTINGS_PATH].includes(item)), message: ambientMessage },
    missing: uniqueMissing,
    drifted: uniqueDrifted
  };
}

function stripAnsi(value) {
  return String(value ?? "").replace(/\x1B\[[0-?]*[ -/]*[@-~]/gu, "");
}

export function parseClaudeMcpStatus(output) {
  const statusLines = stripAnsi(output).replaceAll("\r\n", "\n").split("\n").filter((line) => /^\s*Status\s*:/iu.test(line));
  if (statusLines.length !== 1) return "unknown";
  const value = statusLines[0].replace(/^\s*Status\s*:\s*/iu, "").trim();
  if (/Pending approval/iu.test(value)) return "pending-approval";
  if (/Failed to connect/iu.test(value)) return "failed";
  if (/Connected/iu.test(value)) return "connected";
  return "unknown";
}

export function inspectClaudeMcpConnection(root, options = {}) {
  const result = (options.spawnSync ?? spawnSync)(options.claudeCommand ?? "claude", ["mcp", "get", DOVE_MCP_SERVER_NAME], {
    cwd: root,
    env: { ...process.env, ...options.env, CLAUDE_PROJECT_DIR: root },
    encoding: "utf8",
    shell: false,
    timeout: options.timeout ?? 15000,
    maxBuffer: 1024 * 1024
  });
  if (result.error?.code === "ENOENT") return { state: "unavailable", ready: false, message: "Claude Code is unavailable." };
  if (result.error?.code === "ETIMEDOUT") return { state: "timeout", ready: false, message: "Claude Code MCP status timed out." };
  const state = parseClaudeMcpStatus(`${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  return { state, ready: state === "connected", message: state === "connected" ? null : `Claude Code MCP state is ${state}.` };
}

function normalizeReadiness(value) {
  if (!plainObject(value)) return { healthy: false, ready: false, state: "invalid-result", message: "Claude connection inspection returned an invalid result." };
  const state = typeof value.state === "string" && value.state ? value.state : "unknown";
  const ready = state === "connected";
  return { healthy: ready, ready, state, message: typeof value.message === "string" ? value.message : null };
}

function defaultInspectMcpProbe({ packageRoot, projectRoot, packageVersion }) {
  const sourceProbePath = path.join(packageRoot, "scripts/doctor-mcp-probe.mjs");
  const packagedProbePath = path.join(packageRoot, "scripts/doctor-mcp-probe-package.mjs");
  const probePath = regularNonSymlink(sourceProbePath) ? sourceProbePath : packagedProbePath;
  if (!regularNonSymlink(probePath)) return { state: "not-run", healthy: true, message: "The MCP self-probe is not present in this package root." };
  const result = spawnSync(process.execPath, [probePath, packageRoot, "--identity"], {
    cwd: packageRoot,
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectRoot },
    encoding: "utf8",
    shell: false,
    timeout: 30000,
    maxBuffer: 1024 * 1024
  });
  if (result.error?.code === "ENOENT") return { state: "unavailable", healthy: false, message: "The Dove MCP probe is unavailable." };
  if (result.error?.code === "ETIMEDOUT") return { state: "timeout", healthy: false, message: "The Dove MCP probe timed out." };
  if (result.status !== 0) return { state: "failed", healthy: false, message: String(result.stderr || result.stdout || "The Dove MCP probe failed.").trim() };
  let payload;
  try {
    payload = JSON.parse(result.stdout);
  } catch (error) {
    return { state: "invalid", healthy: false, message: `The Dove MCP probe returned invalid JSON: ${messageFor(error)}` };
  }
  const serverName = payload.serverName ?? null;
  const serverVersion = payload.serverVersion ?? null;
  const protocolVersion = payload.protocolVersion ?? null;
  const expectedVersion = packageVersion ?? null;
  const healthy = payload.ok === true
    && serverName === DOVE_MCP_SERVER_NAME
    && payload.packageVersion === expectedVersion
    && serverVersion === expectedVersion
    && expectedVersion !== null
    && protocolVersion === DOVE_MCP_PROBE_PROTOCOL_VERSION;
  return {
    healthy,
    state: healthy ? "current" : serverName !== DOVE_MCP_SERVER_NAME ? "server-name-mismatch" : serverVersion !== expectedVersion ? "server-version-mismatch" : protocolVersion !== DOVE_MCP_PROBE_PROTOCOL_VERSION ? "protocol-incompatible" : "invalid",
    serverName,
    serverVersion,
    expectedVersion,
    protocolVersion,
    expectedProtocolVersion: DOVE_MCP_PROBE_PROTOCOL_VERSION,
    scope: "launched-package-runtime",
    runningHostInspected: false,
    message: healthy ? null : "The launched package MCP self-probe did not match the current Dove server identity, package version, or protocol."
  };
}

function normalizeMcpProbe(value) {
  if (!plainObject(value)) return { healthy: false, state: "invalid-result", message: "MCP self-probe returned an invalid result." };
  return {
    healthy: value.healthy === true,
    state: typeof value.state === "string" && value.state ? value.state : "unknown",
    serverName: typeof value.serverName === "string" ? value.serverName : null,
    serverVersion: typeof value.serverVersion === "string" ? value.serverVersion : null,
    expectedVersion: typeof value.expectedVersion === "string" ? value.expectedVersion : null,
    protocolVersion: typeof value.protocolVersion === "string" ? value.protocolVersion : null,
    expectedProtocolVersion: typeof value.expectedProtocolVersion === "string" ? value.expectedProtocolVersion : DOVE_MCP_PROBE_PROTOCOL_VERSION,
    scope: typeof value.scope === "string" ? value.scope : "launched-package-runtime",
    runningHostInspected: false,
    message: typeof value.message === "string" ? value.message : null
  };
}

function inspectMcpProbe(packageRoot, projectRoot, options) {
  if ((options.runMcpProbe !== true && options.packageRoot === undefined) && typeof options.inspectMcpProbe !== "function") {
    return { healthy: true, state: "not-run", serverName: null, serverVersion: null, expectedVersion: options.packageVersion ?? null, protocolVersion: null, expectedProtocolVersion: DOVE_MCP_PROBE_PROTOCOL_VERSION, scope: "launched-package-runtime", runningHostInspected: false, message: "The package MCP self-probe was not requested." };
  }
  try {
    const inspected = options.inspectMcpProbe
      ? options.inspectMcpProbe({ packageRoot, projectRoot, packageVersion: options.packageVersion })
      : defaultInspectMcpProbe({ packageRoot, projectRoot, packageVersion: options.packageVersion });
    return normalizeMcpProbe(inspected);
  } catch (error) {
    return { healthy: false, state: "failed", serverName: null, serverVersion: null, expectedVersion: options.packageVersion ?? null, protocolVersion: null, expectedProtocolVersion: DOVE_MCP_PROBE_PROTOCOL_VERSION, scope: "launched-package-runtime", runningHostInspected: false, message: messageFor(error) };
  }
}

function inspectRunningMcpSelfComparison(options) {
  if (typeof options.inspectRunningMcpSelfComparison !== "function") {
    return {
      healthy: true,
      state: "inaccessible",
      inspected: false,
      serverInfo: null,
      protocolVersion: null,
      message: "A standalone CLI cannot inspect the already-running host MCP process. Query full Dove status inside the host for MCP self-comparison."
    };
  }
  try {
    const value = options.inspectRunningMcpSelfComparison();
    if (!plainObject(value)) throw new Error("Running MCP self-comparison returned an invalid result.");
    return {
      healthy: value.state === "current",
      state: typeof value.state === "string" ? value.state : "unknown",
      inspected: true,
      serverInfo: plainObject(value.serverInfo) ? { name: value.serverInfo.name ?? null, version: value.serverInfo.version ?? null } : null,
      protocolVersion: typeof value.protocolVersion === "string" ? value.protocolVersion : null,
      message: typeof value.message === "string" ? value.message : null
    };
  } catch (error) {
    return { healthy: false, state: "failed", inspected: true, serverInfo: null, protocolVersion: null, message: messageFor(error) };
  }
}

function inspectReadiness(root, registration, options, integration = null) {
  if (integration?.state === "needs-sync") return { healthy: false, ready: false, state: "blocked", message: "Claude readiness is blocked until the project integration is synchronized with the current Dove package." };
  if (!registration.healthy) return { healthy: false, ready: false, state: "blocked", message: "Claude readiness is blocked until project registration is current." };
  try {
    const inspector = options.inspectClaudeConnection ?? ((target) => inspectClaudeMcpConnection(target, options));
    return normalizeReadiness(inspector(root));
  } catch (error) {
    return { healthy: false, ready: false, state: "failed", message: messageFor(error) };
  }
}

function inspectLegacy(root) {
  if (!root) return { state: "unavailable", detected: false, healthy: true, root: null, markerHits: [], registrationHits: [], bundleHits: [], evidence: [] };
  try {
    const result = inspectLegacyProjectInstallation(root);
    return { ...result, healthy: !result.detected };
  } catch (error) {
    return { state: "invalid", detected: false, healthy: false, root, markerHits: [], registrationHits: [], bundleHits: [], evidence: [], error: messageFor(error) };
  }
}

export function inspectProjectDoctor(start, options = {}) {
  const userCli = inspectUserCli(options);
  const projectIntegration = inspectIntegrationManifest(start, options);
  const safeRoot = projectIntegration.root ?? projectIntegration.start;
  const workspaceState = inspectWorkspace(safeRoot, options);
  const migrationInstallation = safeRoot
    ? inspectMigrationInstallation(safeRoot, options)
    : { state: "absent", root: null, markerPath: null, upgrade: { ready: false, error: null, preview: null }, reinstall: { ready: false, error: null, preview: null }, error: "Project root is unavailable." };
  const mcpProbe = inspectMcpProbe(userCli.package.root, safeRoot, options);
  const runningMcpSelfComparison = inspectRunningMcpSelfComparison(options);
  const hostRegistration = inspectClaudeRegistration(projectIntegration.root, projectIntegration);
  const readiness = inspectReadiness(projectIntegration.root, hostRegistration, options, projectIntegration);
  const legacyCopiedRuntime = inspectLegacy(safeRoot);
  const setup = classifyProjectSetup({ projectIntegration, migrationInstallation, workspaceState, legacyCopiedRuntime });
  const healthy = userCli.healthy
    && projectIntegration.healthy
    && workspaceState.healthy
    && mcpProbe.healthy
    && runningMcpSelfComparison.healthy
    && hostRegistration.healthy
    && readiness.healthy
    && legacyCopiedRuntime.healthy;
  const diagnosticProbe = projectIntegration.state === "needs-sync"
    ? { ...mcpProbe, healthy: false, state: "integration-mismatch", message: "Project integration must be synchronized with the current Dove package." }
    : mcpProbe;
  return {
    healthy,
    state: healthy ? "healthy" : "unhealthy",
    target: safeRoot ?? (typeof start === "string" ? path.resolve(start) : null),
    userCli,
    projectIntegration,
    migrationInstallation,
    setup,
    mcpProbe: diagnosticProbe,
    runningMcpSelfComparison,
    workspaceState,
    hostRegistration,
    readiness,
    legacyCopiedRuntime,
    zeroWrite: true,
    writes: []
  };
}
