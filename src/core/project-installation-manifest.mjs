import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { parseJsonWithoutDuplicateKeys } from "./strict-json.mjs";

export const INSTALLATION_MANIFEST_PATH = ".dove-install/manifest.json";
export const INSTALLATION_MANIFEST_SCHEMA_VERSION = 1;
export const INSTALLATION_INTEGRATION_VERSION = 2;
export const INSTALLATION_OWNERSHIP_VERSION = 2;
export const PREVIOUS_INSTALLATION_INTEGRATION_VERSION = 1;
export const PREVIOUS_INSTALLATION_OWNERSHIP_VERSION = 1;
export const INSTALLATION_RUNTIME_PROTOCOL_VERSION = 1;

const MANIFEST_FIELDS = new Set([
  "schemaVersion", "integrationVersion", "ownershipVersion", "installationId", "package", "runtime", "hosts", "managed", "createdAt", "updatedAt"
]);
const PACKAGE_FIELDS = new Set(["name", "version"]);
const RUNTIME_FIELDS = new Set(["mode", "protocolVersion"]);
const MANAGED_FIELDS = new Set(["path", "owner", "mode", "selector", "digest"]);
const MANAGED_MODES = new Set(["exclusive-file", "json-fragment", "text-block"]);
const SHA256 = /^[a-f0-9]{64}$/u;
const INSTALLATION_ID = /^installation-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;

function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertPlainObject(value, label) {
  if (!plainObject(value)) throw new Error(`${label} must be a plain object.`);
}

function assertSealed(value, fields, label) {
  assertPlainObject(value, label);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length > 0) throw new Error(`${label} does not accept unknown fields: ${unknown.join(", ")}.`);
  const missing = [...fields].filter((field) => !Object.hasOwn(value, field));
  if (missing.length > 0) throw new Error(`${label} is missing required fields: ${missing.join(", ")}.`);
}

function nonEmptyString(value, label) {
  if (typeof value !== "string" || !value || value !== value.trim() || value.includes("\0")) throw new Error(`${label} must be a non-empty trimmed string.`);
  return value;
}

function exactPositiveInteger(value, expected, label) {
  if (value !== expected) throw new Error(`${label} must equal ${expected}.`);
  return value;
}

function exactIsoTimestamp(value, label) {
  nonEmptyString(value, label);
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) throw new Error(`${label} must be an exact ISO timestamp.`);
  return value;
}

function canonicalProjectRelativePath(value, label) {
  nonEmptyString(value, label);
  if (value.includes("\\") || path.posix.isAbsolute(value) || /^[A-Za-z]:[\\/]/u.test(value)) {
    throw new Error(`${label} must be a project-relative path without backslashes: ${value}`);
  }
  const normalized = path.posix.normalize(value);
  if (normalized !== value || normalized === "." || normalized === ".." || normalized.startsWith("../") || value.includes("//") || value.endsWith("/")) {
    throw new Error(`${label} must be one canonical project-relative path: ${value}`);
  }
  if (value === ".dove" || value.startsWith(".dove/")) throw new Error(`${label} must not manage Dove workspace state: ${value}`);
  return value;
}

function normalizeAllowedHosts(options) {
  const allowed = options.hostIds;
  if (!Array.isArray(allowed) || allowed.length === 0 || allowed.some((hostId) => typeof hostId !== "string" || !hostId || hostId === "all")) {
    throw new Error("Project installation manifest validation requires concrete hostIds in registry order.");
  }
  if (new Set(allowed).size !== allowed.length) throw new Error("Project installation manifest hostIds must be unique.");
  return allowed;
}

function validateHosts(hosts, allowedHosts) {
  if (!Array.isArray(hosts) || hosts.length === 0) throw new Error("Project installation manifest hosts must be a non-empty array.");
  for (const hostId of hosts) {
    nonEmptyString(hostId, "Project installation manifest host");
    if (hostId === "all") throw new Error("Project installation manifest hosts must contain concrete host ids, not all.");
    if (!allowedHosts.includes(hostId)) throw new Error(`Project installation manifest contains unknown host: ${hostId}.`);
  }
  const normalized = allowedHosts.filter((hostId) => hosts.includes(hostId));
  if (normalized.length !== hosts.length || normalized.some((hostId, index) => hostId !== hosts[index])) {
    throw new Error("Project installation manifest hosts must be unique and sorted in registry order.");
  }
  return hosts;
}

function validateManagedEntry(entry, index) {
  const label = `Project installation manifest managed[${index}]`;
  assertSealed(entry, MANAGED_FIELDS, label);
  canonicalProjectRelativePath(entry.path, `${label}.path`);
  nonEmptyString(entry.owner, `${label}.owner`);
  if (!MANAGED_MODES.has(entry.mode)) throw new Error(`${label}.mode is unsupported: ${entry.mode}.`);
  if (entry.mode === "exclusive-file") {
    if (entry.selector !== null) throw new Error(`${label}.selector must be null for exclusive-file ownership.`);
  } else {
    nonEmptyString(entry.selector, `${label}.selector`);
  }
  if (typeof entry.digest !== "string" || !SHA256.test(entry.digest)) throw new Error(`${label}.digest must be a lowercase 64-character SHA-256 digest.`);
  return entry;
}

function managedKey(entry) {
  return `${entry.path}\0${entry.mode}\0${entry.selector ?? ""}\0${entry.owner}`;
}

function compareManaged(left, right) {
  return left.path.localeCompare(right.path)
    || left.mode.localeCompare(right.mode)
    || String(left.selector ?? "").localeCompare(String(right.selector ?? ""))
    || left.owner.localeCompare(right.owner);
}

function validateManaged(managed) {
  if (!Array.isArray(managed)) throw new Error("Project installation manifest managed must be an array.");
  managed.forEach(validateManagedEntry);
  const keys = managed.map(managedKey);
  if (new Set(keys).size !== keys.length) throw new Error("Project installation manifest managed entries must be unique.");
  const sorted = [...managed].sort(compareManaged);
  if (sorted.some((entry, index) => entry !== managed[index])) throw new Error("Project installation manifest managed entries must use stable sort order.");
  return managed;
}

function normalizeCreatedAt(value) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return exactIsoTimestamp(value, "Project installation manifest timestamp");
  if (value === undefined) return new Date().toISOString();
  throw new Error("Project installation manifest timestamp must be a Date or exact ISO timestamp.");
}

function cloneManagedEntry(entry) {
  return {
    path: entry.path,
    owner: entry.owner,
    mode: entry.mode,
    selector: entry.selector ?? null,
    digest: entry.digest
  };
}

function deepFreezeManifest(manifest) {
  Object.freeze(manifest.package);
  Object.freeze(manifest.runtime);
  Object.freeze(manifest.hosts);
  manifest.managed.forEach(Object.freeze);
  Object.freeze(manifest.managed);
  return Object.freeze(manifest);
}

export function validateProjectInstallationManifest(value, options = {}) {
  const allowedHosts = normalizeAllowedHosts(options);
  const acceptedVersionPairs = options.acceptedVersionPairs ?? [[INSTALLATION_INTEGRATION_VERSION, INSTALLATION_OWNERSHIP_VERSION]];
  if (!Array.isArray(acceptedVersionPairs) || acceptedVersionPairs.length === 0 || acceptedVersionPairs.some((pair) => !Array.isArray(pair) || pair.length !== 2 || pair.some((version) => !Number.isSafeInteger(version) || version < 1))) {
    throw new Error("Project installation manifest validation requires explicit positive integration/ownership version pairs.");
  }
  assertSealed(value, MANIFEST_FIELDS, "Project installation manifest");
  exactPositiveInteger(value.schemaVersion, INSTALLATION_MANIFEST_SCHEMA_VERSION, "Project installation manifest schemaVersion");
  if (!acceptedVersionPairs.some(([integrationVersion, ownershipVersion]) => value.integrationVersion === integrationVersion && value.ownershipVersion === ownershipVersion)) {
    throw new Error(`Project installation manifest integrationVersion/ownershipVersion must equal one accepted pair: ${acceptedVersionPairs.map((pair) => pair.join("/")).join(", ")}.`);
  }
  nonEmptyString(value.installationId, "Project installation manifest installationId");
  if (!INSTALLATION_ID.test(value.installationId)) throw new Error("Project installation manifest installationId must use installation-<uuid> format.");

  assertSealed(value.package, PACKAGE_FIELDS, "Project installation manifest package");
  nonEmptyString(value.package.name, "Project installation manifest package.name");
  nonEmptyString(value.package.version, "Project installation manifest package.version");
  if (!SEMVER.test(value.package.version)) throw new Error("Project installation manifest package.version must be a semantic version.");

  assertSealed(value.runtime, RUNTIME_FIELDS, "Project installation manifest runtime");
  if (value.runtime.mode !== "user-cli") throw new Error("Project installation manifest runtime.mode must be user-cli.");
  exactPositiveInteger(value.runtime.protocolVersion, INSTALLATION_RUNTIME_PROTOCOL_VERSION, "Project installation manifest runtime.protocolVersion");

  validateHosts(value.hosts, allowedHosts);
  validateManaged(value.managed);
  const createdAt = exactIsoTimestamp(value.createdAt, "Project installation manifest createdAt");
  const updatedAt = exactIsoTimestamp(value.updatedAt, "Project installation manifest updatedAt");
  if (Date.parse(updatedAt) < Date.parse(createdAt)) throw new Error("Project installation manifest updatedAt must not precede createdAt.");
  return value;
}

export function createProjectInstallationManifest(input = {}, options = {}) {
  const allowedHosts = normalizeAllowedHosts(options);
  const hosts = allowedHosts.filter((hostId) => (input.hosts ?? []).includes(hostId));
  if ((input.hosts ?? []).some((hostId) => hostId === "all" || !allowedHosts.includes(hostId))) {
    throw new Error("Project installation manifest hosts must contain only concrete known host ids.");
  }
  const managedByKey = new Map();
  for (const rawEntry of input.managed ?? []) {
    const entry = cloneManagedEntry(rawEntry);
    validateManagedEntry(entry, managedByKey.size);
    const key = managedKey(entry);
    const existing = managedByKey.get(key);
    if (existing && existing.digest !== entry.digest) throw new Error(`Conflicting project installation ownership entry: ${entry.path}.`);
    managedByKey.set(key, entry);
  }
  const createdAt = normalizeCreatedAt(input.createdAt ?? input.now);
  const updatedAt = normalizeCreatedAt(input.updatedAt ?? createdAt);
  const manifest = {
    schemaVersion: INSTALLATION_MANIFEST_SCHEMA_VERSION,
    integrationVersion: INSTALLATION_INTEGRATION_VERSION,
    ownershipVersion: INSTALLATION_OWNERSHIP_VERSION,
    installationId: input.installationId ?? `installation-${crypto.randomUUID()}`,
    package: {
      name: input.package?.name,
      version: input.package?.version
    },
    runtime: {
      mode: "user-cli",
      protocolVersion: INSTALLATION_RUNTIME_PROTOCOL_VERSION
    },
    hosts,
    managed: [...managedByKey.values()].sort(compareManaged),
    createdAt,
    updatedAt
  };
  validateProjectInstallationManifest(manifest, { hostIds: allowedHosts });
  return deepFreezeManifest(manifest);
}

export function serializeProjectInstallationManifest(value, options = {}) {
  validateProjectInstallationManifest(value, options);
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function isPreviousProjectInstallationManifest(value) {
  return value?.schemaVersion === INSTALLATION_MANIFEST_SCHEMA_VERSION
    && value?.integrationVersion === PREVIOUS_INSTALLATION_INTEGRATION_VERSION
    && value?.ownershipVersion === PREVIOUS_INSTALLATION_OWNERSHIP_VERSION;
}

function inspectManifestFile(root, fsOps) {
  const installationDirectory = path.join(root, path.posix.dirname(INSTALLATION_MANIFEST_PATH));
  const directoryStat = fsOps.lstatSync(installationDirectory);
  if (directoryStat.isSymbolicLink()) throw new Error(`Dove project installation directory must not be a symbolic link: ${installationDirectory}.`);
  if (!directoryStat.isDirectory()) throw new Error(`Dove project installation path must be a directory: ${installationDirectory}.`);
  const manifestPath = path.join(root, INSTALLATION_MANIFEST_PATH);
  let stat;
  try {
    stat = fsOps.lstatSync(manifestPath);
  } catch (error) {
    if (error?.code === "ENOENT") throw new Error(`Dove project installation manifest is missing: ${INSTALLATION_MANIFEST_PATH}.`);
    throw error;
  }
  if (stat.isSymbolicLink()) throw new Error(`Dove project installation manifest must not be a symbolic link: ${INSTALLATION_MANIFEST_PATH}.`);
  if (!stat.isFile()) throw new Error(`Dove project installation manifest must be a regular file: ${INSTALLATION_MANIFEST_PATH}.`);
  return manifestPath;
}

export function readProjectInstallationManifest(root, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const manifestPath = inspectManifestFile(root, fsOps);
  let parsed;
  try {
    parsed = parseJsonWithoutDuplicateKeys(fsOps.readFileSync(manifestPath, "utf8"), "Dove project installation manifest");
    validateProjectInstallationManifest(parsed, options.allowPrevious === true ? {
      ...options,
      acceptedVersionPairs: [
        [PREVIOUS_INSTALLATION_INTEGRATION_VERSION, PREVIOUS_INSTALLATION_OWNERSHIP_VERSION],
        [INSTALLATION_INTEGRATION_VERSION, INSTALLATION_OWNERSHIP_VERSION]
      ]
    } : options);
  } catch (error) {
    throw new Error(`Invalid Dove project installation manifest at ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
  return deepFreezeManifest(structuredClone(parsed));
}
